/**
 * The two one-tap lengths behind each timer's preset buttons in the booth.
 *
 * They live in the database rather than in the code so a tournament can set its
 * own round and break lengths from the event presets page without a deploy.
 */
export const TIMER_PRESETS_PATH = 'timerPresets';

/** What the buttons read when nothing has been configured. */
export const DEFAULT_TIMER_PRESETS = Object.freeze({
	Round: [55, 35],
	Break: [10, 5]
});

/** Longest preset a button may hold, in minutes. Anything more is a typo. */
const MAX_MINUTES = 600;

/**
 * Coerce a stored value into exactly two usable lengths.
 *
 * Firebase hands back an array for keys 0..n but an object once they are sparse,
 * so both shapes are read. Any slot that is missing or nonsense falls back to
 * that slot's default, which keeps a half-filled form from emptying a button.
 *
 * @param {'Round'|'Break'} type
 * @param {unknown} value
 * @returns {number[]} two minute values
 */
export function toTimerPresets(type, value) {
	const fallback = DEFAULT_TIMER_PRESETS[type] ?? DEFAULT_TIMER_PRESETS.Round;
	const stored = value && typeof value === 'object' ? value : {};

	return [0, 1].map((slot) => {
		const n = Number(Array.isArray(stored) ? stored[slot] : stored[slot]);
		if (!Number.isFinite(n) || n <= 0 || n > MAX_MINUTES) return fallback[slot];
		// Whole or half minutes only: the buttons are labelled "55m" and a value
		// like 54.9837 would render unreadably.
		return Math.round(n * 2) / 2;
	});
}
