/**
 * URL commands that set a clock, for triggering a timer from a link rather than
 * the booth -- a phone, a stream deck button, a bookmark on the desk.
 *
 * The grammar is the path after /timer:
 *
 *   round/down/55   count the round down from 55 minutes
 *   round/up        count the round up from zero
 *   round/up/5      count the round up starting at 5 minutes
 *   break/10        count the break down from 10 minutes
 *   break/down/10   the same, said longhand
 *
 * The direction is optional and defaults to down, which is what makes
 * `break/10` mean the obvious thing.
 */

/** Longest clock a link may set, in minutes. Anything more is a typo. */
const MAX_MINUTES = 600;

const TYPES = { round: 'Round', break: 'Break' };

/**
 * Read a timer command out of the path segments after /timer.
 *
 * @param {string[]} segments
 * @returns {{ ok: true, type: 'Round'|'Break', countUp: boolean, seconds: number, summary: string }
 *          | { ok: false, error: string }}
 */
export function parseTimerCommand(segments) {
	const parts = (segments || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean);

	if (!parts.length) return { ok: false, error: 'No timer given.' };

	const type = TYPES[parts[0]];
	if (!type) {
		return { ok: false, error: `Unknown timer "${parts[0]}". Use round or break.` };
	}

	let rest = parts.slice(1);
	let countUp = false;

	if (rest[0] === 'up' || rest[0] === 'down') {
		countUp = rest[0] === 'up';
		rest = rest.slice(1);
	}

	// Only the round clock counts up: the booth stores the direction on that timer
	// alone, and a break that counted up would be ignored everywhere downstream.
	if (countUp && type !== 'Round') {
		return { ok: false, error: 'Only the round timer can count up.' };
	}

	if (rest.length > 1) {
		return { ok: false, error: `Too many parts: "${rest.join('/')}".` };
	}

	const raw = rest[0];

	if (raw === undefined) {
		// Counting up from zero is the one case that needs no number.
		if (countUp) return described(type, true, 0);
		return { ok: false, error: 'Give a number of minutes, for example round/down/55.' };
	}

	const minutes = Number(raw);
	if (!Number.isFinite(minutes) || minutes < 0) {
		return { ok: false, error: `"${raw}" is not a number of minutes.` };
	}
	if (minutes > MAX_MINUTES) {
		return { ok: false, error: `${minutes} minutes is longer than this is meant to set.` };
	}
	if (!countUp && minutes === 0) {
		return { ok: false, error: 'A countdown from zero would be over before it started.' };
	}

	return described(type, countUp, Math.round(minutes * 60));
}

/**
 * @param {'Round'|'Break'} type
 * @param {boolean} countUp
 * @param {number} seconds
 */
function described(type, countUp, seconds) {
	const clock = type === 'Round' ? 'Round timer' : 'Break timer';
	const mins = seconds / 60;
	const amount = Number.isInteger(mins) ? `${mins}` : mins.toFixed(2).replace(/0+$/, '');
	const summary = countUp
		? seconds === 0
			? `${clock} counting up from zero`
			: `${clock} counting up from ${amount} minutes`
		: `${clock} counting down from ${amount} minutes`;
	return { ok: true, type, countUp, seconds, summary };
}
