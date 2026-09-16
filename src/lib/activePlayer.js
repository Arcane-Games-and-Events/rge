/**
 * Which side of the table is currently the active player.
 *
 * One value for the booth, mirroring the turn counter: 'p1' for the left seat,
 * 'p2' for the right, or '' for neither.
 */
export const ACTIVE_PLAYER_PATH = 'activePlayer';

/**
 * Coerce whatever is stored into a seat, or '' when nothing is marked.
 * @param {unknown} value
 * @returns {'p1' | 'p2' | ''}
 */
export function toActivePlayer(value) {
	return value === 'p1' || value === 'p2' ? value : '';
}
