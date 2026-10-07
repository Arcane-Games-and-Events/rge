/**
 * The tournament node and the operations the management page performs on it.
 *
 * Layout under `tournament/`:
 *   currentRound                number
 *   players/<id>                { name, hero, wins, losses, draws, dropped, autoDropped }, ids 0..15
 *   rounds/<n>/pairings/<table> { table, p1, p2, winner }  seats are ids, '' or 'BYE';
 *                               winner is an id, 'draw' or null
 *   history/<id>/<round>        { round, table, opponentId, result }  result W/L/D/B
 *
 * Records on the players are always recounted from history after a result is
 * written, so history is the truth and the records are a cache the overlays read.
 * The recount also drops a player on their third loss, and undrops them if that
 * loss is taken back; `autoDropped` marks a drop made that way, so a drop made by
 * hand is never undone by a result.
 */
import { ref, set, update, get } from 'firebase/database';
import { LOSSES_TO_DROP, WINS_TO_ADVANCE } from './standings.js';

export const ROOT = 'tournament';
// The Swiss is five rounds; the booth's round line says where in it we are.
export const SWISS_ROUNDS = 5;
export const ROUND_INFO_PATH = 'roundInfo';
export const roundInfoText = (round) => `Round ${round} of ${SWISS_ROUNDS}`;
export const PLAYER_COUNT = 16;
export const TABLE_COUNT = 8;

export const isBye = (x) => x === 'BYE';
/** A stored seat value as the page holds it: a number, 'BYE' or ''. */
export const normSeat = (x) => (x === '' || x == null ? '' : isBye(x) ? 'BYE' : Number(x));
/** The player id in a seat, or '' for an empty seat or a bye. */
export const seatPid = (x) => (x === '' || x == null || x === 'BYE' ? '' : Number(x));

export function blankPlayers() {
	return Array.from({ length: PLAYER_COUNT }, (_, id) => ({
		id,
		name: '',
		hero: '',
		wins: 0,
		losses: 0,
		draws: 0,
		dropped: false,
		autoDropped: false
	}));
}

export function blankPairings() {
	return Array.from({ length: TABLE_COUNT }, (_, i) => ({
		table: i + 1,
		p1: '',
		p2: '',
		winner: null
	}));
}

const blankPairingsMap = () =>
	Object.fromEntries(
		blankPairings().map((p) => [p.table, { table: p.table, p1: '', p2: '', winner: null }])
	);

/**
 * Round 1 as it is always played: seed 1 against seed 16 at table 1, seed 2
 * against seed 15 at table 2, and so on. A seat whose player is not entered,
 * or is dropped, is left empty for the producer.
 */
export function round1Pairings(players = []) {
	const byId = new Map(players.map((p) => [p.id, p]));
	const seat = (id) => {
		const p = byId.get(id);
		return p && p.name && !p.dropped ? id : '';
	};
	return Object.fromEntries(
		blankPairings().map((row) => [
			row.table,
			{
				table: row.table,
				p1: seat(row.table - 1),
				p2: seat(PLAYER_COUNT - row.table),
				winner: null
			}
		])
	);
}

export function normalizePlayers(map) {
	const arr = blankPlayers();
	for (const [key, v] of Object.entries(map || {})) {
		const id = Number(key);
		if (Number.isInteger(id) && id >= 0 && id < PLAYER_COUNT && v) {
			arr[id] = {
				id,
				name: v.name || '',
				hero: v.hero || '',
				wins: Number(v.wins) || 0,
				losses: Number(v.losses) || 0,
				draws: Number(v.draws) || 0,
				dropped: !!v.dropped,
				autoDropped: !!v.autoDropped
			};
		}
	}
	return arr;
}

export function normalizePairings(map) {
	const arr = blankPairings();
	for (const [key, v] of Object.entries(map || {})) {
		const table = Number(key);
		if (Number.isInteger(table) && table >= 1 && table <= TABLE_COUNT && v) {
			let winner = null;
			if (v.winner === 'draw') winner = 'draw';
			else if (v.winner === 0 || v.winner) winner = Number(v.winner);
			arr[table - 1] = { table, p1: normSeat(v.p1), p2: normSeat(v.p2), winner };
		}
	}
	return arr;
}

/** A seat facing a bye wins it; otherwise there is no automatic result. */
export function autoWinnerFor(p1, p2) {
	if (isBye(p1) && seatPid(p2) !== '') return seatPid(p2);
	if (isBye(p2) && seatPid(p1) !== '') return seatPid(p1);
	return null;
}

/** Whether a table counts as finished: both seats filled and a result in. */
export const tableComplete = (m) => m.p1 !== '' && m.p2 !== '' && m.winner != null;

// --- writes --------------------------------------------------------------

/**
 * Fills the empty seats of round 1 by seed as players are entered: a seat whose
 * player is now named, and not dropped, is taken, at any table without a result.
 * Seats already holding someone are left as they are, so a pairing changed by
 * hand stands. Returns the number of seats filled.
 */
export async function fillRound1(db, players, pairingsMap) {
	const wanted = round1Pairings(players);
	const current = normalizePairings(pairingsMap);
	const updates = {};
	let filled = 0;
	for (const row of current) {
		if (row.winner != null) continue;
		for (const seatKey of ['p1', 'p2']) {
			const want = wanted[row.table][seatKey];
			if (row[seatKey] === '' && want !== '') {
				updates[`${ROOT}/rounds/1/pairings/${row.table}/${seatKey}`] = want;
				filled += 1;
			}
		}
	}
	if (filled) await update(ref(db), updates);
	return filled;
}

/** Creates round 1 the first time the node is used, paired by seed. */
export async function ensureBootstrapped(db) {
	const rounds = await get(ref(db, `${ROOT}/rounds`));
	if (rounds.exists()) return;
	const players = normalizePlayers((await get(ref(db, `${ROOT}/players`))).val());
	await set(ref(db, `${ROOT}/currentRound`), 1);
	await update(ref(db, `${ROOT}/rounds/1/pairings`), round1Pairings(players));
}

export function savePlayer(db, player) {
	return update(ref(db, `${ROOT}/players/${player.id}`), {
		name: player.name,
		hero: player.hero,
		wins: player.wins,
		losses: player.losses,
		draws: player.draws,
		dropped: player.dropped,
		// A drop or restore made by hand is the producer's call: it clears the mark
		// that would let a result undo it.
		autoDropped: false
	});
}

/** Multi-path nulls for whatever history sits at a round and table. */
async function historyClearsFor(db, round, table) {
	const hist = (await get(ref(db, `${ROOT}/history`))).val() || {};
	const clears = {};
	for (const [pid, perRound] of Object.entries(hist)) {
		const rec = perRound?.[round];
		if (rec && Number(rec.table) === Number(table))
			clears[`${ROOT}/history/${pid}/${round}`] = null;
	}
	return clears;
}

/**
 * Rewrites every player's record from history. A bye counts as a win. A player
 * reaching the losses that end their event is dropped, and one dropped that way
 * is restored if a loss is taken back; a drop made by hand is left alone.
 */
export async function recountFromHistory(db, players) {
	const hist = (await get(ref(db, `${ROOT}/history`))).val() || {};
	const byId = new Map(players.map((p) => [p.id, p]));
	const counts = new Map(players.map((p) => [p.id, { w: 0, l: 0, d: 0 }]));
	for (const [pidStr, perRound] of Object.entries(hist)) {
		const acc = counts.get(Number(pidStr)) || { w: 0, l: 0, d: 0 };
		for (const rec of Object.values(perRound || {})) {
			const r = String(rec?.result || '').toUpperCase();
			if (r === 'W' || r === 'B' || r === 'BYE') acc.w += 1;
			else if (r === 'L') acc.l += 1;
			else if (r === 'D') acc.d += 1;
		}
		counts.set(Number(pidStr), acc);
	}
	const updates = {};
	for (const [pid, { w, l, d }] of counts.entries()) {
		updates[`${ROOT}/players/${pid}/wins`] = w;
		updates[`${ROOT}/players/${pid}/losses`] = l;
		updates[`${ROOT}/players/${pid}/draws`] = d;
		const p = byId.get(pid);
		if (!p) continue;
		if (l >= LOSSES_TO_DROP && !p.dropped) {
			updates[`${ROOT}/players/${pid}/dropped`] = true;
			updates[`${ROOT}/players/${pid}/autoDropped`] = true;
		} else if (l < LOSSES_TO_DROP && p.dropped && p.autoDropped) {
			updates[`${ROOT}/players/${pid}/dropped`] = false;
			updates[`${ROOT}/players/${pid}/autoDropped`] = false;
		}
	}
	if (Object.keys(updates).length) await update(ref(db), updates);
}

/**
 * Seats a player (or a bye, or nobody) at a table. Any result the table had is
 * cleared, since it was for a different pairing; a bye wins itself at once.
 */
export async function setSeat(db, players, round, row, seatKey, rawValue) {
	const next = { ...row, [seatKey]: normSeat(rawValue) };
	const autoWinner = autoWinnerFor(next.p1, next.p2);

	const updates = await historyClearsFor(db, round, row.table);
	updates[`${ROOT}/rounds/${round}/pairings/${row.table}`] = {
		table: row.table,
		p1: next.p1,
		p2: next.p2,
		winner: autoWinner ?? null
	};
	if (autoWinner != null) {
		updates[`${ROOT}/history/${autoWinner}/${round}`] = {
			round,
			table: row.table,
			opponentId: null,
			result: 'B'
		};
	}
	await update(ref(db), updates);
	await recountFromHistory(db, players);
}

/** Records a table's result: a player id, or 'draw'. */
export async function setWinner(db, players, round, row, winnerId) {
	const { p1, p2, table } = row;
	if (p1 === '' || p2 === '') return;

	let next;
	if (isBye(p1) !== isBye(p2)) next = isBye(p1) ? seatPid(p2) : seatPid(p1);
	else if (winnerId === 'draw') next = 'draw';
	else next = Number(winnerId);

	const updates = {};
	if (typeof p1 === 'number') updates[`${ROOT}/history/${p1}/${round}`] = null;
	if (typeof p2 === 'number') updates[`${ROOT}/history/${p2}/${round}`] = null;
	updates[`${ROOT}/rounds/${round}/pairings/${table}`] = { table, p1, p2, winner: next };

	const pid1 = seatPid(p1);
	const pid2 = seatPid(p2);
	if (next === 'draw') {
		if (pid1 !== '' && pid2 !== '') {
			updates[`${ROOT}/history/${pid1}/${round}`] = { round, table, opponentId: pid2, result: 'D' };
			updates[`${ROOT}/history/${pid2}/${round}`] = { round, table, opponentId: pid1, result: 'D' };
		}
	} else if (typeof next === 'number') {
		if (isBye(p1) || isBye(p2)) {
			updates[`${ROOT}/history/${next}/${round}`] = { round, table, opponentId: null, result: 'B' };
		} else if (pid1 !== '' && pid2 !== '') {
			updates[`${ROOT}/history/${pid1}/${round}`] = {
				round,
				table,
				opponentId: pid2,
				result: next === pid1 ? 'W' : 'L'
			};
			updates[`${ROOT}/history/${pid2}/${round}`] = {
				round,
				table,
				opponentId: pid1,
				result: next === pid2 ? 'W' : 'L'
			};
		}
	}

	await update(ref(db), updates);
	await recountFromHistory(db, players);
}

/** Clears a table's result, leaving the seats. */
export async function clearResult(db, players, round, row) {
	const updates = await historyClearsFor(db, round, row.table);
	updates[`${ROOT}/rounds/${round}/pairings/${row.table}/winner`] = null;
	await update(ref(db), updates);
	await recountFromHistory(db, players);
}

/**
 * Who gets a bye when a round opens, in table order: the players already
 * through to the Top 8 who are still in, the most wins first and the higher
 * seed (lower id) breaking ties, as many as there are tables.
 */
export function byeSeating(players) {
	return players
		.filter((p) => p.name && !p.dropped && p.wins >= WINS_TO_ADVANCE)
		.sort((a, b) => b.wins - a.wins || a.id - b.id)
		.slice(0, TABLE_COUNT);
}

/**
 * Opens the next round and makes it current. Players already through to the
 * Top 8 are given a bye at the top tables -- the most wins first, then the
 * higher seed -- and the bye is scored at once; the remaining tables are left
 * for the producer to seat.
 */
export async function createRound(db, roundsList, players = []) {
	const next = (roundsList.length ? Math.max(...roundsList) : 0) + 1;
	const through = byeSeating(players);

	const pairings = blankPairingsMap();
	const updates = {};
	through.forEach((p, i) => {
		const table = i + 1;
		pairings[table] = { table, p1: p.id, p2: 'BYE', winner: p.id };
		updates[`${ROOT}/history/${p.id}/${next}`] = {
			round: next,
			table,
			opponentId: null,
			result: 'B'
		};
	});
	updates[`${ROOT}/rounds/${next}/pairings`] = pairings;
	updates[`${ROOT}/currentRound`] = next;
	updates[ROUND_INFO_PATH] = roundInfoText(next);
	await update(ref(db), updates);
	if (through.length) await recountFromHistory(db, players);
	return next;
}

/** Moves the current round, and the booth's round line with it. */
export function setCurrentRound(db, round) {
	return update(ref(db), {
		[`${ROOT}/currentRound`]: Number(round),
		[ROUND_INFO_PATH]: roundInfoText(Number(round))
	});
}

/** Removes a round and its results, restores records, and re-points the current round. */
export async function deleteRound(db, players, round, currentRound) {
	const hist = (await get(ref(db, `${ROOT}/history`))).val() || {};
	const updates = {};
	for (const pid of Object.keys(hist)) {
		if (hist[pid]?.[round]) updates[`${ROOT}/history/${pid}/${round}`] = null;
	}
	updates[`${ROOT}/rounds/${round}`] = null;
	await update(ref(db), updates);
	await recountFromHistory(db, players);

	const remaining = Object.keys((await get(ref(db, `${ROOT}/rounds`))).val() || {})
		.map(Number)
		.filter(Number.isInteger);
	const fallback = remaining.length ? Math.max(...remaining) : 1;
	if (!remaining.length) await update(ref(db, `${ROOT}/rounds/1/pairings`), blankPairingsMap());
	if (round === currentRound) await setCurrentRound(db, fallback);
	return fallback;
}

/**
 * Starts the event over: every round and result is removed and round 1 is
 * opened, paired by seed, with the players kept in their seeds, clean records
 * and nobody dropped, so the field entered at the start is ready to go again.
 */
export async function resetTournament(db, players = []) {
	const roster = {};
	for (const p of players) {
		if (!p.name && !p.hero) continue;
		roster[p.id] = {
			name: p.name,
			hero: p.hero,
			wins: 0,
			losses: 0,
			draws: 0,
			dropped: false,
			autoDropped: false
		};
	}
	await set(ref(db, ROOT), {
		currentRound: 1,
		players: roster,
		rounds: { 1: { pairings: round1Pairings(players) } }
	});
	await set(ref(db, ROUND_INFO_PATH), roundInfoText(1));
}
