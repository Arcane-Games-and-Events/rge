/**
 * Shared clock formatting for the booth and the on-air timer view.
 *
 * The booth writes the display string to Firebase and the view reads it, but
 * the view also computes its own value when those writes go quiet. Both sides
 * format through here so a break that has run out reads the same either way.
 */

/** Label shown in place of 00:00 once a break has run out. */
export const BREAK_ENDED_LABEL = 'Soon';

/**
 * mm:ss for a number of seconds.
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
	const m = Math.floor(Math.abs(seconds) / 60)
		.toString()
		.padStart(2, '0');
	const s = (Math.abs(seconds) % 60).toString().padStart(2, '0');
	return `${m}:${s}`;
}

/**
 * Clock text for a timer. A break that has counted down to zero reads "Soon"
 * rather than 00:00; the round clock is unaffected, and a break cleared with
 * reset still shows 00:00 because reset writes that string directly.
 * @param {string} type - 'Round' or 'Break'
 * @param {number} seconds
 * @returns {string}
 */
export function formatTimerDisplay(type, seconds) {
	if (type === 'Break' && seconds <= 0) return BREAK_ENDED_LABEL;
	return formatTime(seconds);
}
