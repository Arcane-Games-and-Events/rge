/**
 * Shared clock formatting for the booth and the on-air timer view.
 *
 * The booth writes the display string to Firebase and the view reads it, but
 * the view also computes its own value when those writes go quiet. Both sides
 * format through here so they agree either way.
 */

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
