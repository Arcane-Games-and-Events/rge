/**
 * Start signals expire on their own.
 *
 * A start signal used to be stored as a bare `true` that the clicking browser
 * wrote back to `false` on a timer. If that browser closed, lost its network,
 * or was simply refreshed inside the window, nothing ever wrote the `false`:
 * the signal stayed pinned on air and the button stayed disabled forever.
 *
 * Storing the moment it fired instead lets every reader decide for itself
 * whether the signal is still live, so a writer that never comes back cannot
 * leave one stuck.
 */

export const DEFAULT_START_SIGNAL_MS = 10000;

/** Value to write when firing a start signal. */
export function startSignalPayload() {
	return { active: true, triggeredAt: Date.now() };
}

/**
 * How much longer a stored start signal should show, in milliseconds.
 * Returns 0 for cleared, missing, expired, and legacy boolean values — a stale
 * `true` from before this shape existed reads as expired rather than forever.
 * @param {unknown} value - Raw value stored at the signal path
 * @param {number} [durationMs] - How long a signal stays up
 * @returns {number}
 */
export function startSignalRemainingMs(value, durationMs = DEFAULT_START_SIGNAL_MS) {
	if (!value || value === true || !value.active || !value.triggeredAt) return 0;
	return Math.max(0, durationMs - (Date.now() - value.triggeredAt));
}
