/**
 * The pregame form: a prompt the booth sends to a table's scorekeeper, where
 * the players fill in their pronouns, who won the roll and what they chose, and
 * then wait for the green flash that says the match may start.
 *
 * Stored beside the table's other signals. `active` opens the form on the
 * scorekeeper; `submitted` is set by the scorekeeper when the players are done,
 * so the booth can see it; the start signal, or the booth, closes it.
 */

/** @param {1 | 2} table */
export function pregamePath(table) {
	return table === 2 ? 'signals/table2/pregame' : 'timers/Round/pregame';
}

/** Value to write when sending the form. */
export function pregamePayload() {
	return { active: true, submitted: false, triggeredAt: Date.now() };
}

/** Value to write when the form is done with. */
export const PREGAME_CLEARED = { active: false, submitted: false, triggeredAt: null };

/** Who plays first, given who won the roll and what they chose. */
export function firstPlayer(rollWinner, order) {
	if (!rollWinner || !order) return '';
	const other = rollWinner === 'p1' ? 'p2' : 'p1';
	return order === 'first' ? rollWinner : other;
}
