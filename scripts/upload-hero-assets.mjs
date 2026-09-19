/**
 * Push the hero videos and hero cards to Supabase storage.
 *
 *   node scripts/upload-hero-assets.mjs            both sets
 *   node scripts/upload-hero-assets.mjs videos     just the videos
 *   node scripts/upload-hero-assets.mjs cards      just the cards
 *   node scripts/upload-hero-assets.mjs --force    re-upload files already there
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_KEY from .env. The key bypasses every
 * security rule, so it stays in that file and never reaches the browser bundle --
 * this script runs on your machine, not in the app.
 *
 * Safe to stop and re-run: it lists what the bucket already holds and skips those,
 * which matters when 1.3GB is going over a venue connection.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const SETS = {
	videos: { dir: 'static/heroes', bucket: 'hero-videos', ext: '.webm', type: 'video/webm' },
	cards: { dir: 'static/heroCards', bucket: 'hero-cards', ext: '.png', type: 'image/png' }
};

// An hour, matching what Supabase serves by default. Long enough that a hero seen
// twice in a session is instant, short enough that re-cutting a file appears the
// same day without a cache purge.
const CACHE_CONTROL = '3600';

const CONCURRENCY = 4;

function loadEnv() {
	const env = {};
	let text;
	try {
		text = readFileSync('.env', 'utf8');
	} catch {
		die('No .env file found. Run this from the project root.');
	}
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
		const i = trimmed.indexOf('=');
		env[trimmed.slice(0, i).trim()] = trimmed
			.slice(i + 1)
			.trim()
			.replace(/^["']|["']$/g, '');
	}
	return env;
}

const die = (msg) => {
	console.error('\n  ' + msg + '\n');
	process.exit(1);
};

const mb = (n) => (n / 1048576).toFixed(1) + 'MB';

/**
 * Check the bucket before sending anything at it. Listing a bucket that does not
 * exist comes back as an empty page rather than an error, so without this the run
 * would cheerfully attempt every file and report the same failure once per file.
 */
async function checkBucket(base, key, bucket) {
	const res = await fetch(`${base}/storage/v1/bucket/${bucket}`, {
		headers: { apikey: key, Authorization: `Bearer ${key}` }
	});
	if (!res.ok) {
		// Supabase answers 400 with a NoSuchBucket body rather than a 404, so the
		// status alone is not enough to tell "missing" from "something else wrong".
		const body = await res.text();
		if (res.status === 404 || /NoSuchBucket|not found/i.test(body)) {
			die(
				`Bucket "${bucket}" does not exist.\n` +
					`  Create it in the dashboard: Storage -> New bucket, named exactly "${bucket}", with Public turned on.`
			);
		}
		die(`Could not read bucket "${bucket}": HTTP ${res.status} ${body.slice(0, 160)}`);
	}
	const info = await res.json();
	if (!info.public) {
		die(
			`Bucket "${bucket}" is private.\n  The overlays load these with a plain <img>/<video>, which cannot use a signed URL.\n  Make it public in the dashboard, then run this again.`
		);
	}
	return info;
}

async function listBucket(base, key, bucket) {
	// The list endpoint pages at 100, so keep asking until a page comes back short.
	const held = new Map();
	for (let offset = 0; ; offset += 100) {
		const res = await fetch(`${base}/storage/v1/object/list/${bucket}`, {
			method: 'POST',
			headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
			body: JSON.stringify({ prefix: '', limit: 100, offset })
		});
		if (!res.ok) {
			if (res.status === 404) die(`Bucket "${bucket}" does not exist. Create it first, public.`);
			die(`Could not list "${bucket}": HTTP ${res.status} ${await res.text()}`);
		}
		const page = await res.json();
		for (const obj of page) held.set(obj.name, obj.metadata?.size ?? 0);
		if (page.length < 100) return held;
	}
}

async function upload(base, key, bucket, name, body, type) {
	const res = await fetch(`${base}/storage/v1/object/${bucket}/${encodeURIComponent(name)}`, {
		method: 'POST',
		headers: {
			apikey: key,
			Authorization: `Bearer ${key}`,
			'content-type': type,
			'cache-control': CACHE_CONTROL,
			'x-upsert': 'true'
		},
		body
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
}

async function run() {
	const args = process.argv.slice(2);
	const force = args.includes('--force');
	const which = args.filter((a) => !a.startsWith('--'));
	const chosen = which.length ? which : Object.keys(SETS);

	for (const name of chosen) {
		if (!SETS[name]) die(`Unknown set "${name}". Use videos, cards, or neither for both.`);
	}

	const env = loadEnv();
	const base = (env.SUPABASE_URL || '').replace(/\/+$/, '');
	const key = env.SUPABASE_SERVICE_KEY;
	if (!base) die('SUPABASE_URL is not set in .env');
	if (!key) die('SUPABASE_SERVICE_KEY is not set in .env');
	if (base.includes('/rest/'))
		die('SUPABASE_URL should be the bare project URL, with no /rest/v1/');

	for (const setName of chosen) {
		const { dir, bucket, ext, type } = SETS[setName];
		let files;
		try {
			files = (await readdir(dir)).filter((f) => extname(f).toLowerCase() === ext).sort();
		} catch {
			console.log(`\n  ${setName}: no ${dir} folder, skipping`);
			continue;
		}

		await checkBucket(base, key, bucket);
		const held = await listBucket(base, key, bucket);
		const todo = force ? files : files.filter((f) => !held.has(f));
		const sizes = await Promise.all(files.map((f) => stat(join(dir, f)).then((s) => s.size)));
		const total = sizes.reduce((a, b) => a + b, 0);

		console.log(`\n  ${setName} -> ${bucket}`);
		console.log(
			`    ${files.length} files locally (${mb(total)}), ${held.size} already in the bucket`
		);
		if (!todo.length) {
			console.log('    nothing to do');
			continue;
		}
		console.log(`    uploading ${todo.length}`);

		let done = 0;
		const failures = [];
		const queue = [...todo];
		const worker = async () => {
			for (let f = queue.shift(); f; f = queue.shift()) {
				try {
					await upload(base, key, bucket, f, await readFile(join(dir, f)), type);
					done++;
					process.stdout.write(`\r    ${done}/${todo.length}  ${f.slice(0, 44).padEnd(44)}`);
				} catch (err) {
					failures.push([f, err.message]);
				}
			}
		};
		await Promise.all(Array.from({ length: CONCURRENCY }, worker));
		process.stdout.write('\r' + ' '.repeat(70) + '\r');
		console.log(`    uploaded ${done}, failed ${failures.length}`);
		// One line per distinct reason rather than per file: a systemic failure would
		// otherwise print the same message a hundred times and bury anything else.
		const byReason = new Map();
		for (const [f, why] of failures) {
			if (!byReason.has(why)) byReason.set(why, []);
			byReason.get(why).push(f);
		}
		for (const [why, names] of byReason) {
			console.log(`      ${names.length} file(s): ${why}`);
			console.log(`        e.g. ${names.slice(0, 3).join(', ')}`);
		}

		// Prove one file is readable at the URL the app will actually ask for.
		const probe = todo[0];
		const publicUrl = `${base}/storage/v1/object/public/${bucket}/${encodeURIComponent(probe)}`;
		const check = await fetch(publicUrl, { method: 'HEAD' });
		console.log(`    public check: ${check.status} ${check.headers.get('content-type')}  ${probe}`);
		if (check.status === 400 || check.status === 404) {
			console.log('      ^ bucket is probably not public — flip it in the dashboard');
		}
		console.log(`    base URL for .env:\n      ${base}/storage/v1/object/public/${bucket}`);
	}
}

run().catch((err) => die(err.stack || String(err)));
