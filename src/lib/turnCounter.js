/**
 * The shared turn counter.
 *
 * One number for the booth rather than one per table, so the keyboard shortcut
 * is never ambiguous about which match it means.
 */
export const TURN_COUNTER_PATH = 'turnCounter';

/** Turns start at one; the control will not go below this. */
export const MIN_TURN = 1;

/**
 * Coerce whatever is stored into a usable turn number.
 * @param {unknown} value
 * @returns {number}
 */
export function toTurn(value) {
	const n = Number(value);
	return Number.isFinite(n) && n >= MIN_TURN ? Math.floor(n) : MIN_TURN;
}
