/**
 * Standings for the tournament overlay, computed from the tournament node.
 *
 * Shared by the on-air standings view and the management page's preview, so the
 * producer sees exactly the order the overlay will show. The arithmetic is the
 * overlay's original: a win adds a match point and counts toward cumulative
 * match points weighted by round; a bye shows as a win but earns nothing in the
 * tie-breakers; while the current round still has open matches the order is by
 * record first, otherwise by the tie-breakers alone.
 */

/** Weights per round for cumulative match points: later rounds weigh more. */
function cmpWeights(roundCount) {
	const base = 2 ** roundCount;
	return Array.from({ length: roundCount }, (_, i) => base - 2 ** i);
}

/** A stable pseudo-random tie-break per player, so equal players keep their order. */
function seedFromId(id) {
	return ((id * 9301 + 49297) % 233280) / 233280;
}

const seat = (x) => (x === 0 || x ? Number(x) : '');
const winnerOf = (m) =>
	m?.winner === 'draw' ? 'draw' : m?.winner === 0 || m?.winner ? Number(m.winner) : null;

/**
 * Per-player results, the stored history overlaid with whatever the round
 * pairings say, so a result just clicked shows before history catches up. Byes
 * are not injected here; they come only from stored history.
 */
function overlayHistory(historyMap, roundsTree) {
	const overlay = {};
	for (const [pid, perRound] of Object.entries(historyMap || {})) overlay[pid] = { ...perRound };

	for (const rStr of Object.keys(roundsTree || {})) {
		const r = Number(rStr);
		const pairings = roundsTree[r]?.pairings || {};
		for (const [tKey, m] of Object.entries(pairings)) {
			const p1 = seat(m?.p1);
			const p2 = seat(m?.p2);
			const table = m?.table || Number(tKey);
			if (p1 === '' || p2 === '') continue;
			const winner = winnerOf(m);
			if (winner == null) continue;

			if (winner === 'draw') {
				overlay[p1] ??= {};
				overlay[p2] ??= {};
				overlay[p1][r] ??= { round: r, table, opponentId: p2, result: 'D', live: true };
				overlay[p2][r] ??= { round: r, table, opponentId: p1, result: 'D', live: true };
			} else {
				const loser = winner === p1 ? p2 : p1;
				overlay[winner] ??= {};
				overlay[loser] ??= {};
				overlay[winner][r] ??= { round: r, table, opponentId: loser, result: 'W', live: true };
				overlay[loser][r] ??= { round: r, table, opponentId: winner, result: 'L', live: true };
			}
		}
	}
	return overlay;
}

/** Whether any seated table in the current round is still without a result. */
export function roundHasOpenMatches(roundsTree, round) {
	const pairings = roundsTree?.[round]?.pairings || {};
	return Object.values(pairings).some(
		(m) => seat(m?.p1) !== '' && seat(m?.p2) !== '' && winnerOf(m) == null
	);
}

/**
 * @param {Array<{id:number,name:string,hero:string,dropped:boolean}>} players
 * @param {{ roundsTree: object, historyMap: object, currentRound: number }} state
 * @returns {Array<object>} ranked standings, best first, each with `rank`
 */
export function computeStandings(players, { roundsTree, historyMap, currentRound }) {
	const rounds = Object.keys(roundsTree || {})
		.map(Number)
		.filter(Number.isInteger);
	const maxRound = rounds.length ? Math.max(...rounds) : currentRound || 0;
	const weights = cmpWeights(maxRound);
	const overlay = overlayHistory(historyMap, roundsTree);
	const inProgress = roundHasOpenMatches(roundsTree, currentRound);

	const base = players.map((p) => {
		const h = overlay?.[p.id] || {};
		let wins = 0;
		let losses = 0;
		let draws = 0;
		let byes = 0;
		let mp = 0;
		const winByRound = Array.from({ length: maxRound }, () => 0);
		const opps = new Set();

		for (let r = 1; r <= maxRound; r++) {
			const rec = h?.[r];
			if (!rec) continue;
			const res = String(rec.result || '').toUpperCase();
			const opp = rec.opponentId;
			if (res === 'W') {
				wins++;
				mp++;
				winByRound[r - 1] = 1;
				if (opp !== '' && opp != null) opps.add(Number(opp));
			} else if (res === 'L') {
				losses++;
				if (opp !== '' && opp != null) opps.add(Number(opp));
			} else if (res === 'D') {
				draws++;
				if (opp !== '' && opp != null) opps.add(Number(opp));
			} else if (res === 'B' || res === 'BYE') {
				byes++;
			}
		}

		const cmp = winByRound.reduce((a, v, i) => a + (v ? weights[i] : 0), 0);

		// Match loss percentage, byes left out.
		let lossCount = 0;
		let played = 0;
		for (let r = 1; r <= maxRound; r++) {
			const rec = h?.[r];
			if (!rec) continue;
			const res = String(rec.result || '').toUpperCase();
			if (res === 'B' || res === 'BYE') continue;
			played++;
			if (res === 'L') lossCount++;
		}
		const mlp = played > 0 ? lossCount / played : 0;

		return {
			id: p.id,
			name: p.name,
			hero: p.hero,
			dropped: p.dropped,
			record: { wins, losses, draws, byes },
			mp,
			cmp,
			mlp,
			opponents: Array.from(opps),
			seed: seedFromId(p.id)
		};
	});

	const mlpById = Object.fromEntries(base.map((s) => [s.id, s.mlp]));
	const cmpById = Object.fromEntries(base.map((s) => [s.id, s.cmp]));
	for (const s of base) {
		const opps = Array.from(new Set(s.opponents)).filter((x) => mlpById[x] != null);
		if (opps.length === 0) {
			s.omlp = 1;
			s.ocmp = 0;
		} else {
			s.omlp = opps.reduce((a, id) => a + mlpById[id], 0) / opps.length;
			s.ocmp = opps.reduce((a, id) => a + cmpById[id], 0) / opps.length;
		}
	}

	const byTiebreaks = (a, b) =>
		b.mp - a.mp ||
		b.cmp - a.cmp ||
		a.mlp - b.mlp ||
		a.omlp - b.omlp ||
		b.ocmp - a.ocmp ||
		a.seed - b.seed;

	if (inProgress) {
		base.sort(
			(a, b) =>
				b.record.wins - a.record.wins ||
				a.record.losses - b.record.losses ||
				b.record.draws - a.record.draws ||
				byTiebreaks(a, b)
		);
	} else {
		base.sort(byTiebreaks);
	}

	return base.map((s, i) => ({ rank: i + 1, ...s }));
}

/** The record as shown on air: wins and losses, a bye counted as a win. Draws are not played. */
export function recordString(s) {
	return `${s.record.wins + (s.record.byes || 0)}-${s.record.losses}`;
}

/** How many wins lock a place in the Top 8, and how many losses put a player out. */
export const WINS_TO_ADVANCE = 3;
export const LOSSES_TO_DROP = 3;

/**
 * Top 8 seeding for the players already through: by the round in which they
 * took their third win, earliest first, and within a round by their original
 * seed. Two players reaching 3-0 in round three as the 4th and 7th seeds become
 * the 1st and 2nd seeds of the Top 8. Byes count as wins, as they do everywhere.
 * @param {Array<{id:number,wins:number}>|Record<string,{id:number,wins:number}>} players
 * @param {object} historyMap  history/<id>/<round> = { result }
 * @returns {Map<number, number>} player id to Top 8 seed
 */
export function top8Seeding(players, historyMap) {
	const through = [];
	for (const p of Object.values(players || {})) {
		if (!p || p.wins < WINS_TO_ADVANCE) continue;
		const per = historyMap?.[p.id] || {};
		const rounds = Object.keys(per)
			.map(Number)
			.filter(Number.isInteger)
			.sort((a, b) => a - b);
		let wins = 0;
		let clinched = Infinity;
		for (const r of rounds) {
			const res = String(per[r]?.result || '').toUpperCase();
			if (res !== 'W' && res !== 'B' && res !== 'BYE') continue;
			wins += 1;
			if (wins >= WINS_TO_ADVANCE) {
				clinched = r;
				break;
			}
		}
		through.push({ id: p.id, clinched });
	}
	through.sort((a, b) => a.clinched - b.clinched || a.id - b.id);
	return new Map(through.map((q, i) => [q.id, i + 1]));
}

/** 1 → 1st, 2 → 2nd, 3 → 3rd, 4 → 4th … 11 → 11th, 21 → 21st. */
export function ordinal(n) {
	const mod100 = n % 100;
	const suffix =
		mod100 >= 11 && mod100 <= 13
			? 'th'
			: n % 10 === 1
				? 'st'
				: n % 10 === 2
					? 'nd'
					: n % 10 === 3
						? 'rd'
						: 'th';
	return `${n}${suffix}`;
}

/**
 * The standings with the players already through to the Top 8 at the top, in
 * seed order, and everyone else beneath in the order computed. Re-ranked 1..n.
 * @param {Array<object>} standings  from computeStandings
 * @param {Map<number, number>} seeds  from top8Seeding
 */
export function orderWithTop8(standings, seeds) {
	const through = standings
		.filter((s) => seeds.has(s.id))
		.sort((a, b) => seeds.get(a.id) - seeds.get(b.id));
	const rest = standings.filter((s) => !seeds.has(s.id));
	return [...through, ...rest].map((s, i) => ({ ...s, rank: i + 1 }));
}

/**
 * A player's record after a given round, from history, a bye counted as a win.
 */
export function recordAfter(historyMap, id, round) {
	let wins = 0;
	let losses = 0;
	const per = historyMap?.[id] || {};
	for (let r = 1; r <= round; r++) {
		const res = String(per[r]?.result || '').toUpperCase();
		if (res === 'W' || res === 'B' || res === 'BYE') wins++;
		else if (res === 'L') losses++;
	}
	return { wins, losses };
}

/**
 * What has to happen in the tournament software round by round: who to drop
 * at the end of a round (their third loss came in it), who went through to
 * the Top 8 in it, and who gets a bye at the start of the next round (through,
 * and still in). One entry per round that exists, with whether its results are
 * all in.
 */
export function roundActions(players, historyMap, roundsTree) {
	const named = players.filter((p) => p.name);
	const seat = (x) => (x === 0 || x ? x : '');
	return Object.keys(roundsTree || {})
		.map(Number)
		.filter(Number.isInteger)
		.sort((a, b) => a - b)
		.map((r) => {
			const pairings = Object.values(roundsTree[r]?.pairings || {}).filter(Boolean);
			const seated = pairings.filter((m) => seat(m.p1) !== '' || seat(m.p2) !== '');
			const open = seated.filter((m) => m.winner == null).length;
			const crossed = (p, key, limit) =>
				recordAfter(historyMap, p.id, r)[key] >= limit &&
				recordAfter(historyMap, p.id, r - 1)[key] < limit;
			return {
				round: r,
				seatedTables: seated.length,
				openTables: open,
				complete: seated.length > 0 && open === 0,
				drops: named.filter((p) => crossed(p, 'losses', LOSSES_TO_DROP)),
				through: named.filter((p) => crossed(p, 'wins', WINS_TO_ADVANCE)),
				byesNext: named.filter((p) => {
					const rec = recordAfter(historyMap, p.id, r);
					return rec.wins >= WINS_TO_ADVANCE && rec.losses < LOSSES_TO_DROP;
				})
			};
		});
}

/** The quarterfinal draw by seed, as the bracket overlay lays it out. */
export const QUARTERFINALS = [
	[1, 8],
	[4, 5],
	[3, 6],
	[2, 7]
];
