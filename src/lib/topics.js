// The talking-points rundown: a title and up to four topics that come on one
// at a time as the hosts reach them, like a show's story list. The booth sets
// the words, and a Companion button steps `shown` through them.
export const TOPICS_PATH = 'topics';
export const TOPIC_COUNT = 4;

/** The stored node, in a shape the pages can rely on whatever is there. */
export function normalizeTopics(raw) {
	const items = Array.from({ length: TOPIC_COUNT }, (_, i) => {
		const v = raw?.items?.[i];
		return typeof v === 'string' ? v : '';
	});
	const shown = Number(raw?.shown);
	return {
		title: typeof raw?.title === 'string' ? raw.title : '',
		items,
		shown: Number.isInteger(shown) ? Math.max(0, Math.min(TOPIC_COUNT, shown)) : 0
	};
}

/** How many topics are actually written, counting up to the last filled slot. */
export function programmedCount(items) {
	let n = 0;
	items.forEach((t, i) => {
		if (t.trim()) n = i + 1;
	});
	return n;
}

/**
 * A word wrapped in asterisks is the one that reads in gold: "*Oscilio* on top".
 * Returns the runs in order so the overlay can colour them.
 */
export function emphasisRuns(text) {
	const runs = [];
	const re = /\*([^*]+)\*/g;
	let last = 0;
	let m;
	while ((m = re.exec(text || ''))) {
		if (m.index > last) runs.push({ text: text.slice(last, m.index), gold: false });
		runs.push({ text: m[1], gold: true });
		last = m.index + m[0].length;
	}
	if (last < (text || '').length) runs.push({ text: text.slice(last), gold: false });
	return runs;
}

/**
 * The URL commands: next, back, reset, all, or a count. The result says what
 * `shown` becomes given the current count and how many topics are programmed.
 */
export function parseTopicCommand(parts) {
	const words = (parts || []).map((p) => String(p).trim().toLowerCase()).filter(Boolean);
	if (words.length !== 1) {
		return { ok: false, error: 'Say what to do: next, back, reset, all, or a number of topics.' };
	}
	const [word] = words;
	if (['next', 'back', 'reset', 'all'].includes(word)) return { ok: true, action: word };
	if (/^\d+$/.test(word)) {
		const n = Number(word);
		if (n > TOPIC_COUNT) return { ok: false, error: `There are only ${TOPIC_COUNT} topics.` };
		return { ok: true, action: 'set', n };
	}
	return { ok: false, error: `"${word}" is not a command.` };
}

export function nextShown(command, shown, programmed) {
	switch (command.action) {
		case 'next':
			return Math.min(programmed, shown + 1);
		case 'back':
			return Math.max(0, shown - 1);
		case 'reset':
			return 0;
		case 'all':
			return programmed;
		case 'set':
			return Math.min(programmed, command.n);
		default:
			return shown;
	}
}
