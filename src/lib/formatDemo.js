/**
 * The Swiss format walk-through: the field from the tournament page played
 * through five rounds as an example, round by round, so the format graphic
 * can show the players moving from record to record and into the Top 8 or
 * out. Round 1 is seated as the tournament page has it paired, with its real
 * results where they are in; after that each match is decided by a coin that
 * is seeded from the field, so the walk-through looks random but comes out
 * the same every time it is drawn. Whatever the results, the format's counts
 * hold -- 8 through, 8 out.
 *
 * `step` is how far the walk-through has gone: 0 is the bracket alone with
 * nobody on it, 1 is round 1 seated, 2 is round 2 seated after round 1's
 * results, and so on to 6, after round 5.
 */
export const FORMAT_DEMO_PATH = 'formatDemo';
export const ROUNDS = 5;
export const LAST_STEP = ROUNDS + 1;
export const WINS = 3;
export const LOSSES = 3;

/** A small, seeded random source, so the same field plays the same rounds. */
function coin(seed) {
	let t = seed >>> 0;
	return () => {
		t = (t + 0x6d2b79f5) >>> 0;
		let x = Math.imul(t ^ (t >>> 15), 1 | t);
		x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
}

/** What a step shows, in words. */
export const describeStep = (step) =>
	step === 0
		? 'Blank bracket'
		: step === 1
			? 'Round 1 seated'
			: step <= ROUNDS
				? `After round ${step - 1} · round ${step} seated`
				: 'After round 5 · the cut is made';

export const toStep = (v) => {
	const n = Number(v);
	return Number.isInteger(n) ? Math.max(0, Math.min(LAST_STEP, n)) : 0;
};

/**
 * Where every player stands at each step. A player keeps the table they came
 * from: the next round seats each record's players in the order of the tables
 * they played at, winners of a higher record first, so nobody is shuffled.
 * Each placement also carries how the player got there -- a win or a loss,
 * and from which table -- and their place in the order the moves are shown:
 * the round's winners first, table by table, then its losers.
 * @param {{ id: number, name: string, hero: string }[]} players  in seed order
 * @param {Record<string, { p1: any, p2: any, winner?: any }>} [round1]  the tournament's round 1 pairings, by table
 * @returns {Array<Map<number, Placement>>} one map a step
 * @typedef {{ kind: 'match', record: string, row: number, side: 0 | 1, result?: 'W'|'L', order?: number } |
 *           { kind: 'end', record: string, slot: number, result?: 'W'|'L', order?: number }} Placement
 */
export function walkThrough(players, round1 = {}) {
	const field = players.filter((p) => p && p.name).slice(0, 16);
	const ids = new Set(field.map((p) => p.id));
	const flip = coin(field.reduce((h, p) => h * 31 + p.id * 7 + p.name.length, 17));
	// Round 1 as paired on the tournament page: table by table, P1 on the left.
	const seat1 = [];
	const real = new Map(); // id -> result in round 1, where it is in
	for (const m of Object.values(round1 || {}).sort((a, b) => Number(a?.table) - Number(b?.table))) {
		const p1 = Number(m?.p1);
		const p2 = Number(m?.p2);
		if (!ids.has(p1) || !ids.has(p2)) continue;
		seat1.push(p1, p2);
		const w = m?.winner === 0 || m?.winner ? Number(m.winner) : null;
		if (w === p1 || w === p2) {
			real.set(p1, w === p1 ? 'W' : 'L');
			real.set(p2, w === p2 ? 'W' : 'L');
		}
	}
	for (const p of field) if (!seat1.includes(p.id)) seat1.push(p.id);
	const record = new Map(field.map((p) => [p.id, { w: 0, l: 0 }]));
	const locked = new Map(); // id -> { kind: 'end', record, slot, result, order }
	// How each player arrived at the current step: their last result, and the
	// record and table they played at.
	const came = new Map(
		seat1.map((id, i) => [id, { result: null, record: '0-0', row: Math.floor(i / 2), wins: 0 }])
	);
	let round = 0;
	const steps = [];

	const key = (r) => `${r.w}-${r.l}`;
	// The order the moves are shown in: winners first, by the record they
	// came from (best first) and then by table; then the losers the same way.
	const showOrder = (ids) =>
		[...ids].sort((a, b) => {
			const A = came.get(a);
			const B = came.get(b);
			return (A.result === 'L') - (B.result === 'L') || B.wins - A.wins || A.row - B.row || a - b;
		});
	const seat = () => {
		// Everyone still playing, grouped by record, each group seated in the
		// order of the tables its players came from.
		const placement = new Map(locked);
		const groups = new Map();
		for (const p of field) {
			if (locked.has(p.id)) continue;
			const k = key(record.get(p.id));
			if (!groups.has(k)) groups.set(k, []);
			groups.get(k).push(p.id);
		}
		const order = new Map();
		const counts = { W: 0, L: 0 };
		for (const id of showOrder(field.map((p) => p.id))) {
			const res = came.get(id).result;
			order.set(id, {
				phase: res === 'L' ? 1 : 0,
				rank: counts[res === 'L' ? 'L' : 'W']++,
				winners: 0
			});
		}
		for (const v of order.values()) v.winners = counts.W;
		for (const [k, ids] of groups) {
			const seated =
				round === 0
					? seat1.filter((id) => ids.includes(id))
					: [...ids].sort((a, b) => {
							const A = came.get(a);
							const B = came.get(b);
							return B.wins - A.wins || A.row - B.row || a - b;
						});
			seated.forEach((id, i) => {
				placement.set(id, {
					kind: 'match',
					record: k,
					row: Math.floor(i / 2),
					side: i % 2,
					result: came.get(id).result,
					order: order.get(id)
				});
			});
		}
		for (const [id, at] of locked) placement.set(id, { ...at, order: order.get(id) });
		return placement;
	};
	const play = () => {
		// Round 1 goes as it really went where a result is in; otherwise the
		// coin decides.
		round += 1;
		const current = steps[steps.length - 1];
		const pairs = new Map();
		for (const [id, at] of current) {
			if (at.kind !== 'match') continue;
			const k = `${at.record}/${at.row}`;
			if (!pairs.has(k)) pairs.set(k, []);
			pairs.get(k)[at.side] = id;
		}
		const won = new Set();
		for (const [, pair] of pairs) {
			const [a, b] = pair;
			if (a == null || b == null) {
				// A player without an opponent takes the win.
				const solo = a ?? b;
				if (solo != null) won.add(solo);
			} else {
				const known = round === 1 && real.has(a) ? real.get(a) : null;
				const aWins = known ? known === 'W' : flip() < 0.5;
				won.add(aWins ? a : b);
			}
		}
		for (const [id, at] of current) {
			if (at.kind !== 'match') continue;
			const w = won.has(id);
			if (w) record.get(id).w += 1;
			else record.get(id).l += 1;
			// Each player remembers the table they just played at and how it went.
			came.set(id, {
				result: w ? 'W' : 'L',
				record: at.record,
				row: at.row,
				wins: Number(at.record.split('-')[0])
			});
		}
		// Anyone at three of either is locked into a box, in the order of the
		// tables they came from.
		const arriving = field
			.filter((p) => !locked.has(p.id))
			.filter((p) => record.get(p.id).w >= WINS || record.get(p.id).l >= LOSSES)
			.sort((a, b) => came.get(a.id).row - came.get(b.id).row || a.id - b.id);
		for (const p of arriving) {
			const k = key(record.get(p.id));
			const slot = [...locked.values()].filter((v) => v.record === k).length;
			locked.set(p.id, { kind: 'end', record: k, slot, result: came.get(p.id).result });
		}
	};

	steps.push(seat());
	for (let r = 1; r <= ROUNDS; r++) {
		play();
		steps.push(seat());
	}
	return steps;
}
