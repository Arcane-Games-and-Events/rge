// Step the sponsor overlay's copy from a URL, for a Bitfocus Companion or
// Stream Deck button: hit /sponsor/next and the pricing gives way to the
// singles message on the overlay. As with /timer and /topics, the write
// happens here on the server through the database's REST API, so a plain
// HTTP request is enough and the status code says whether it worked.
import { env } from '$env/dynamic/private';
import { SPONSOR_PATH, LAST_STEP, describeStep, toStep } from '$lib/sponsorCopy';

const EXAMPLES = [
	['/sponsor/next', 'The next panel of copy'],
	['/sponsor/back', 'The last panel again'],
	['/sponsor/reset', 'Back to the bundle pricing'],
	['/sponsor/1', 'Straight to the singles message']
];

const NO_STORE = { 'cache-control': 'no-store, no-cache, must-revalidate' };

const escape = (s) =>
	String(s).replace(
		/[&<>"]/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
	);

function htmlPage(ok, headline, detail) {
	const rows = EXAMPLES.map(
		([url, what]) => `<li><code>${escape(url)}</code><span>${escape(what)}</span></li>`
	).join('');
	return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(headline)}</title>
<style>
body{min-height:100vh;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
gap:.75rem;padding:1.5rem;background:#0b0f14;color:#e8eef5;font-family:ui-sans-serif,system-ui,sans-serif;text-align:center}
.badge{font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:.25rem .6rem;
background:${ok ? '#065f46' : '#7f1d1d'};color:${ok ? '#d1fae5' : '#fee2e2'}}
p{margin:0;font-size:1.25rem}
ul{list-style:none;margin:.5rem 0 0;padding:0;display:grid;gap:.4rem;text-align:left;font-size:.85rem}
li{display:flex;flex-wrap:wrap;gap:.5rem;align-items:baseline}
code{font-family:ui-monospace,monospace;background:#151c25;border:1px solid #243040;padding:.15rem .4rem;white-space:nowrap}
span{color:#8fa3b8}
</style>
<p class="badge">${escape(headline)}</p>
<p>${escape(detail)}</p>
<ul>${rows}</ul>`;
}

function respond(request, status, headline, detail) {
	const ok = status < 400;
	const wantsHtml = (request.headers.get('accept') || '').includes('text/html');
	if (wantsHtml) {
		return new Response(htmlPage(ok, headline, detail), {
			status,
			headers: { 'content-type': 'text/html; charset=utf-8', ...NO_STORE }
		});
	}
	return new Response(`${headline}: ${detail}\n`, {
		status,
		headers: { 'content-type': 'text/plain; charset=utf-8', ...NO_STORE }
	});
}

function parse(parts) {
	const words = (parts || []).map((p) => String(p).trim().toLowerCase()).filter(Boolean);
	if (words.length !== 1) {
		return {
			ok: false,
			error: `Say what to do: next, back, reset, or a step from 0 to ${LAST_STEP}.`
		};
	}
	const [word] = words;
	if (['next', 'back', 'reset'].includes(word)) return { ok: true, action: word };
	if (/^\d+$/.test(word)) {
		const n = Number(word);
		if (n > LAST_STEP) return { ok: false, error: `The last step is ${LAST_STEP}.` };
		return { ok: true, action: 'set', n };
	}
	return { ok: false, error: `"${word}" is not a command.` };
}

// Node's own fetch, taken as the module loads: in development SvelteKit swaps
// the global for a warning wrapper while it renders a page.
const nativeFetch = globalThis.fetch;

/** @param {{ params: { spec?: string }, request: Request }} event */
async function step({ params, request }) {
	const command = parse((params.spec || '').split('/'));
	if (!command.ok) return respond(request, 400, 'Not changed', command.error);

	const base = (env.VITE_FIREBASE_DATABASE_URL || '').trim().replace(/\/+$/, '');
	if (!base) return respond(request, 500, 'Not changed', 'No database URL configured.');

	try {
		const read = await nativeFetch(`${base}/${SPONSOR_PATH}/step.json`);
		if (!read.ok) {
			return respond(request, 502, 'Not changed', `Database refused the read (${read.status}).`);
		}
		const current = toStep(await read.json());
		const next =
			command.action === 'next'
				? Math.min(LAST_STEP, current + 1)
				: command.action === 'back'
					? Math.max(0, current - 1)
					: command.action === 'reset'
						? 0
						: command.n;

		const write = await nativeFetch(`${base}/${SPONSOR_PATH}.json`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ step: next })
		});
		if (!write.ok) {
			return respond(request, 502, 'Not changed', `Database refused the write (${write.status}).`);
		}
		return respond(request, 200, 'Sponsor', `${describeStep(next)}.`);
	} catch (err) {
		return respond(request, 502, 'Not changed', `Could not reach the database: ${err.message}`);
	}
}

// Companion's HTTP action can be configured either way, so accept both.
export const GET = step;
export const POST = step;
