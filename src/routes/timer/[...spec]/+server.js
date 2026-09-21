// Set a clock by hitting a URL, from Bitfocus Companion, a stream deck, a phone
// or a bookmark.
//
// This is an endpoint rather than a page on purpose. A page would only set the
// timer once a browser had run its JavaScript, and Companion's HTTP request
// fetches the response and stops -- nothing would happen. The write is done here,
// on the server, so the status code alone tells the caller whether it worked.
//
// The write goes through the database's REST API rather than firebase-admin: the
// admin credentials are a Vercel-only secret, so an admin call would fail on a
// local machine, and the REST endpoint needs nothing the client does not already
// have.
import { env } from '$env/dynamic/private';
import { formatTime } from '$lib/timerDisplay';
import { parseTimerCommand } from '$lib/timerCommand';

const EXAMPLES = [
	['/timer/round/down/55', 'Round counts down from 55 minutes'],
	['/timer/round/up', 'Round counts up from zero'],
	['/timer/round/up/5', 'Round counts up starting at 5 minutes'],
	['/timer/break/10', 'Break counts down from 10 minutes'],
	['/timer/break/down/10', 'The same, said longhand']
];

/** A GET that changes something must never be served from a cache. */
const NO_STORE = { 'cache-control': 'no-store, no-cache, must-revalidate' };

const escape = (s) =>
	String(s).replace(
		/[&<>"]/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
	);

function htmlPage(ok, headline, detail, clock) {
	const rows = EXAMPLES.map(
		([url, what]) => `<li><code>${escape(url)}</code><span>${escape(what)}</span></li>`
	).join('');
	return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(headline)}</title>
<style>
body{min-height:100vh;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
gap:.75rem;padding:1.5rem;background:#0b0f14;color:#e8eef5;font-family:ui-sans-serif,system-ui,sans-serif;text-align:center}
.badge{font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:.25rem .6rem;border-radius:.25rem;
background:${ok ? '#065f46' : '#7f1d1d'};color:${ok ? '#d1fae5' : '#fee2e2'}}
.clock{font-size:4.5rem;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;margin:0}
p{margin:0}.note{font-size:.8rem;color:#8fa3b8}
ul{list-style:none;margin:.5rem 0 0;padding:0;display:grid;gap:.4rem;text-align:left;font-size:.85rem}
li{display:flex;flex-wrap:wrap;gap:.5rem;align-items:baseline}
code{font-family:ui-monospace,monospace;background:#151c25;border:1px solid #243040;border-radius:.25rem;padding:.15rem .4rem;white-space:nowrap}
span{color:#8fa3b8}
</style>
<p class="badge">${escape(headline)}</p>
${clock ? `<p class="clock">${escape(clock)}</p>` : ''}
<p>${escape(detail)}</p>
${ok ? '<p class="note">Running now. Close this page — the clock keeps going.</p>' : `<ul>${rows}</ul>`}`;
}

/**
 * Plain text for machines, a page for browsers. Companion only reads the status
 * code, so the body is for whoever is looking.
 */
function respond(request, status, headline, detail, clock) {
	const ok = status < 400;
	const wantsHtml = (request.headers.get('accept') || '').includes('text/html');

	if (wantsHtml) {
		return new Response(htmlPage(ok, headline, detail, clock), {
			status,
			headers: { 'content-type': 'text/html; charset=utf-8', ...NO_STORE }
		});
	}

	const body = clock ? `${headline}: ${detail} (${clock})\n` : `${headline}: ${detail}\n`;
	return new Response(body, {
		status,
		headers: { 'content-type': 'text/plain; charset=utf-8', ...NO_STORE }
	});
}

// The write goes out through Node's own fetch, taken as this module loads, not
// the global looked up at call time. In development SvelteKit swaps that global
// for a warning wrapper while it renders a page, and Companion tends to send a
// timer command in the same instant OBS reloads its sources, which logged
// "Avoid calling fetch eagerly during server-side rendering" for a write that
// has nothing to do with rendering.
const nativeFetch = globalThis.fetch;

/** @param {{ params: { spec?: string }, request: Request }} event */
async function setTimer({ params, request }) {
	const command = parseTimerCommand((params.spec || '').split('/'));

	if (!command.ok) {
		return respond(request, 400, 'Not set', command.error);
	}

	const base = (env.VITE_FIREBASE_DATABASE_URL || '').trim().replace(/\/+$/, '');
	if (!base) {
		return respond(request, 500, 'Not set', 'No database URL configured.');
	}

	// One PATCH rather than a field at a time: the booth and the overlays each watch
	// these keys separately, and a half-applied timer would briefly have them
	// counting the wrong thing. PATCH merges, so sibling keys such as the start
	// signal are left alone.
	const fields = {
		remainingTime: command.seconds,
		displayTime: formatTime(command.seconds),
		isPaused: false,
		startTime: Date.now()
	};
	if (command.type === 'Round') fields.isCountingUp = command.countUp;

	try {
		const res = await nativeFetch(`${base}/timers/${command.type}.json`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(fields)
		});
		if (!res.ok) {
			return respond(request, 502, 'Not set', `Database refused the write (${res.status}).`);
		}
	} catch (err) {
		return respond(request, 502, 'Not set', `Could not reach the database: ${err.message}`);
	}

	return respond(request, 200, 'Timer set', command.summary, formatTime(command.seconds));
}

// Companion's HTTP action can be configured either way, so accept both rather
// than making the choice matter.
export const GET = setTimer;
export const POST = setTimer;
