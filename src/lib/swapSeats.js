import { ref, get, update } from 'firebase/database';
import { CHOICE_PATH, toChoice } from '$lib/choice';
import { ACTIVE_PLAYER_PATH, toActivePlayer } from '$lib/activePlayer';

/**
 * Swap a table's two seats: the players' names, heroes, records, flags and
 * pronouns change places, the life totals go with them, and the life history
 * is re-labelled so each change stays with the player who took it. On Table 1
 * the turn choice and the active-player marker, which are kept by seat, change
 * sides too, so they still point at the same people. One multi-path update, so
 * nothing watching the table ever sees one seat's new player beside the
 * other's old one.
 *
 * Shared by the production booth's swap button and the scorekeeper's, so the
 * two do exactly the same thing.
 *
 * @param {import('firebase/database').Database} db
 * @param {string} playerPath  'playerInfo' or 'playerInfo2'
 * @param {string} lifePath    'lifecounter' or 'lifecounter2'
 */
export async function swapSeats(db, playerPath, lifePath) {
	const tableOne = playerPath === 'playerInfo';
	const read = (path) => get(ref(db, path)).then((snap) => snap.val());
	const [p1, p2, l1, l2, history, choice, active] = await Promise.all([
		read(`${playerPath}/p1`),
		read(`${playerPath}/p2`),
		read(`${lifePath}/p1`),
		read(`${lifePath}/p2`),
		read(`${lifePath}/history`),
		tableOne ? read(CHOICE_PATH) : null,
		tableOne ? read(ACTIVE_PLAYER_PATH) : null
	]);
	const seat = (v) => v || {};
	const updates = {};
	for (const field of ['name', 'record', 'hero', 'flag', 'pronouns']) {
		updates[`${playerPath}/p1/${field}`] = seat(p2)[field] ?? '';
		updates[`${playerPath}/p2/${field}`] = seat(p1)[field] ?? '';
	}
	updates[`${lifePath}/p1`] = l2 ?? 20;
	updates[`${lifePath}/p2`] = l1 ?? 20;
	for (const [key, entry] of Object.entries(history || {})) {
		if (entry?.player === 'p1' || entry?.player === 'p2') {
			updates[`${lifePath}/history/${key}/player`] = entry.player === 'p1' ? 'p2' : 'p1';
		}
	}
	if (tableOne) {
		const c = toChoice(choice);
		if (c)
			updates[CHOICE_PATH] = c.startsWith('p1') ? c.replace('p1', 'p2') : c.replace('p2', 'p1');
		const a = toActivePlayer(active);
		if (a) updates[ACTIVE_PLAYER_PATH] = a === 'p1' ? 'p2' : 'p1';
	}
	await update(ref(db), updates);
}
