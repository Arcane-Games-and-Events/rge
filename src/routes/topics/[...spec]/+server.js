// Step the topics rundown from a URL, for a Bitfocus Companion button: hit
// /topics/next and the next topic comes on. Like /timer, the write happens here
// on the server through the database's REST API, so Companion's plain HTTP
// request is enough and the status code says whether it worked.
import { env } from '$env/dynamic/private';
import {
	TOPICS_PATH,
	normalizeTopics,
	programmedCount,
	parseTopicCommand,
	nextShown
} from '$lib/topics';

const EXAMPLES = [
	['/topics/next', 'The next topic comes on'],
	['/topics/back', 'The last topic goes off again'],
	['/topics/reset', 'All topics off, title stays'],
	['/topics/all', 'Every programmed topic on at once'],
	['/topics/2', 'Exactly the first two topics on']
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
.badge{font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:.25rem .6rem;border-radius:.25rem;
background:${ok ? '#065f46' : '#7f1d1d'};color:${ok ? '#d1fae5' : '#fee2e2'}}
p{margin:0;font-size:1.25rem}
ul{list-style:none;margin:.5rem 0 0;padding:0;display:grid;gap:.4rem;text-align:left;font-size:.85rem}
li{display:flex;flex-wrap:wrap;gap:.5rem;align-items:baseline}
code{font-family:ui-monospace,monospace;background:#151c25;border:1px solid #243040;border-radius:.25rem;padding:.15rem .4rem;white-space:nowrap}
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

// Node's own fetch, taken as the module loads: in development SvelteKit swaps
// the global for a warning wrapper while it renders a page.
const nativeFetch = globalThis.fetch;

/** @param {{ params: { spec?: string }, request: Request }} event */
async function step({ params, request }) {
	const command = parseTopicCommand((params.spec || '').split('/'));
	if (!command.ok) return respond(request, 400, 'Not changed', command.error);

	const base = (env.VITE_FIREBASE_DATABASE_URL || '').trim().replace(/\/+$/, '');
	if (!base) return respond(request, 500, 'Not changed', 'No database URL configured.');

	try {
		const read = await nativeFetch(`${base}/${TOPICS_PATH}.json`);
		if (!read.ok) {
			return respond(request, 502, 'Not changed', `Database refused the read (${read.status}).`);
		}
		const state = normalizeTopics(await read.json());
		const programmed = programmedCount(state.items);
		const shown = nextShown(command, state.shown, programmed);

		// Only `shown` is written, so the words being typed in the booth are left alone.
		const write = await nativeFetch(`${base}/${TOPICS_PATH}.json`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ shown })
		});
		if (!write.ok) {
			return respond(request, 502, 'Not changed', `Database refused the write (${write.status}).`);
		}

		if (!programmed)
			return respond(request, 200, 'Nothing to show', 'No topics are programmed yet.');
		const detail =
			shown === 0
				? `No topics on. ${programmed} programmed.`
				: `${shown} of ${programmed} on: ${state.items[shown - 1].replace(/\*/g, '')}`;
		return respond(request, 200, 'Topics', detail);
	} catch (err) {
		return respond(request, 502, 'Not changed', `Could not reach the database: ${err.message}`);
	}
}

export const GET = step;
export const POST = step;
