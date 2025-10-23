<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../firebaseClient';

	const ROOT = 'tournament';

	let currentRound = 1;
	let players = [];
	let roundsList = [];
	let roundsTree = {};
	let historyMap = {};
	let standings = [];

	// helpers
	const slugify = (name) =>
		(name || '')
			.toLowerCase()
			.replace(/["',]/g, '')
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.trim();
	const imgSrc = (name) => `/heroImages/${slugify(name)}.jpg`;

	function normalizePlayers(map) {
		const ids = Object.keys(map || {})
			.map(Number)
			.filter(Number.isInteger);
		const maxId = Math.max(-1, ...ids);
		const arr = Array.from({ length: Math.max(maxId + 1, 0) }, (_, id) => ({
			id,
			name: '',
			hero: '',
			wins: 0,
			losses: 0,
			draws: 0,
			dropped: false
		}));
		for (const [k, v] of Object.entries(map || {})) {
			const id = Number(k);
			if (!Number.isInteger(id)) continue;
			arr[id] = {
				id,
				name: v?.name || '',
				hero: v?.hero || '',
				wins: Number(v?.wins) || 0,
				losses: Number(v?.losses) || 0,
				draws: Number(v?.draws) || 0,
				dropped: !!v?.dropped
			};
		}
		return arr;
	}

	function cmpWeights(N) {
		const base = 2 ** N;
		return Array.from({ length: N }, (_, i) => base - 2 ** i);
	}
	function seedFromId(id) {
		let x = (id * 9301 + 49297) % 233280;
		return x / 233280;
	}

	// Overlay ONLY normal winners/draws from pairings (no special BYE injection here)
	function makeOverlayHistory() {
		const overlay = {};
		for (const [pid, perRound] of Object.entries(historyMap || {})) overlay[pid] = { ...perRound };

		for (const rStr of Object.keys(roundsTree || {})) {
			const r = Number(rStr);
			const pr = roundsTree[r]?.pairings || {};
			for (const [tKey, m] of Object.entries(pr)) {
				const p1 = m?.p1 === 0 || m?.p1 ? Number(m.p1) : '';
				const p2 = m?.p2 === 0 || m?.p2 ? Number(m.p2) : '';
				const tableNum = m?.table || Number(tKey);
				if (p1 === '' || p2 === '') continue;

				const winner =
					m?.winner === 'draw' ? 'draw' : m?.winner === 0 || m?.winner ? Number(m.winner) : null;

				if (winner == null) continue;

				if (winner === 'draw') {
					overlay[p1] ??= {};
					overlay[p2] ??= {};
					overlay[p1][r] ??= { round: r, table: tableNum, opponentId: p2, result: 'D', live: true };
					overlay[p2][r] ??= { round: r, table: tableNum, opponentId: p1, result: 'D', live: true };
				} else {
					const loser = winner === p1 ? p2 : p1;
					overlay[winner] ??= {};
					overlay[loser] ??= {};
					overlay[winner][r] ??= {
						round: r,
						table: tableNum,
						opponentId: loser,
						result: 'W',
						live: true
					};
					overlay[loser][r] ??= {
						round: r,
						table: tableNum,
						opponentId: winner,
						result: 'L',
						live: true
					};
				}
			}
		}
		return overlay;
	}

	// Open-match check (unchanged logic)
	function currentRoundHasOpenMatches() {
		const pr = roundsTree?.[currentRound]?.pairings || {};
		for (const m of Object.values(pr)) {
			const p1 = m?.p1 === 0 || m?.p1 ? Number(m.p1) : '';
			const p2 = m?.p2 === 0 || m?.p2 ? Number(m.p2) : '';
			const winner =
				m?.winner === 'draw' ? 'draw' : m?.winner === 0 || m?.winner ? Number(m.winner) : null;
			if (p1 !== '' && p2 !== '' && winner == null) return true;
		}
		return false;
	}

	function computeStandings() {
		const maxRound = roundsList.length ? Math.max(...roundsList) : currentRound || 0;
		const weights = cmpWeights(maxRound);
		const overlay = makeOverlayHistory();
		const inProgress = currentRoundHasOpenMatches();

		const base = players.map((p) => {
			const pid = p.id,
				h = overlay?.[pid] || {};
			let wins = 0,
				losses = 0,
				draws = 0,
				byes = 0,
				mp = 0;
			const winByRound = Array.from({ length: maxRound }, () => 0);
			const opps = new Set();

			for (let r = 1; r <= maxRound; r++) {
				const rec = h?.[r];
				if (!rec) continue;
				const res = String(rec.result || '').toUpperCase();
				const opp = rec.opponentId;

				// CALCULATION BEHAVIOR = original:
				// - W increases wins and MP and counts toward CMP
				// - L increases losses
				// - D increases draws
				// - B/BYE is counted into "byes" ONLY (no MP/CMP/MLP effects, no opponent)
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
					byes++; // display-only win
					// no MP / no CMP / not an opponent
				}
			}

			const cmp = winByRound.reduce((a, v, i) => a + (v ? weights[i] : 0), 0);

			// MLP (ignore BYE rounds just like original behavior would)
			let lossesCount = 0,
				playedCount = 0;
			for (let r = 1; r <= maxRound; r++) {
				const rec = h?.[r];
				if (!rec) continue;
				const res = String(rec.result || '').toUpperCase();
				if (res === 'B' || res === 'BYE') continue;
				playedCount++;
				if (res === 'L') lossesCount++;
			}
			const mlp = playedCount > 0 ? lossesCount / playedCount : 0;

			return {
				id: pid,
				name: p.name,
				hero: p.hero,
				dropped: p.dropped,
				record: { wins, losses, draws, byes }, // keep byes separately
				mp,
				cmp,
				mlp,
				opponents: Array.from(opps),
				seed: seedFromId(pid)
			};
		});

		// Opponents' tie-breakers (unchanged)
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

		// Sort rule (unchanged)
		if (inProgress) {
			base.sort((a, b) => {
				if (b.record.wins !== a.record.wins) return b.record.wins - a.record.wins;
				if (a.record.losses !== b.record.losses) return a.record.losses - b.record.losses;
				if (b.record.draws !== a.record.draws) return b.record.draws - a.record.draws;
				if (b.mp !== a.mp) return b.mp - a.mp;
				if (b.cmp !== a.cmp) return b.cmp - a.cmp;
				if (a.mlp !== b.mlp) return a.mlp - b.mlp;
				if (a.omlp !== b.omlp) return a.omlp - b.omlp;
				if (b.ocmp !== a.ocmp) return b.ocmp - a.ocmp;
				return a.seed - b.seed;
			});
		} else {
			base.sort((a, b) => {
				if (b.mp !== a.mp) return b.mp - a.mp;
				if (b.cmp !== a.cmp) return b.cmp - a.cmp;
				if (a.mlp !== b.mlp) return a.mlp - b.mlp;
				if (a.omlp !== b.omlp) return a.omlp - b.omlp;
				if (b.ocmp !== a.ocmp) return b.ocmp - a.ocmp;
				return a.seed - b.seed;
			});
		}

		standings = base.map((s, i) => ({ rank: i + 1, ...s }));
	}

	onMount(() => {
		const unsubRound = onValue(ref(db, `${ROOT}/currentRound`), (s) => {
			currentRound = s.val() || 1;
			computeStandings();
		});
		const unsubPlayers = onValue(ref(db, `${ROOT}/players`), (s) => {
			players = normalizePlayers(s.val());
			computeStandings();
		});
		const unsubRounds = onValue(ref(db, `${ROOT}/rounds`), (s) => {
			roundsTree = s.val() || {};
			roundsList = Object.keys(roundsTree)
				.map(Number)
				.filter(Number.isInteger)
				.sort((a, b) => a - b);
			computeStandings();
		});
		const unsubHistory = onValue(ref(db, `${ROOT}/history`), (s) => {
			historyMap = s.val() || {};
			computeStandings();
		});
		return () => {
			unsubRound?.();
			unsubPlayers?.();
			unsubRounds?.();
			unsubHistory?.();
		};
	});

	// DISPLAY: show BYE as a win (wins + byes), but calculations use pure wins
	const recStr = (s) =>
		`${s.record.wins + (s.record.byes || 0)}-${s.record.losses}-${s.record.draws}`;

	// record color by *losses* (unchanged)
	const recClass = (losses = 0) =>
		losses === 0 ? 'text-green-500' : losses === 1 ? 'text-yellow-500' : 'text-red-700';

	$: colLeft = standings.slice(0, 8);
	$: colRight = standings.slice(8, 16);
</script>

<div class="min-h-screen text-white p-4 sm:p-6">
	<!-- Header -->
	<div class="flex flex-wrap items-center gap-3 mb-4">
		<h1 class="text-7xl font-bold">Round {currentRound}</h1>
	</div>

	<!-- Two fixed columns: 1–8 and 9–16 -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<!-- Left column (1–8) -->
		<div class="space-y-1 py-12 max-w-md">
			{#each colLeft as s}
				<div class={`bg-gray-900 bg-opacity-50 rounded-lg p-3 ${s.dropped ? 'opacity-70' : ''}`}>
					<div class="grid items-stretch gap-3 [grid-template-columns:2.5rem_auto_1fr]">
						<div class="text-xl text-white font-semibold tabular-nums text-right pr-3 self-center">
							{s.rank}
						</div>
						<div class="self-stretch">
							<div class="h-full aspect-square overflow-hidden rounded-lg bg-gray-800">
								{#if s.hero}
									<img
										src={imgSrc(s.hero)}
										alt={s.hero}
										class="h-14 w-14 object-cover object-right"
									/>
								{:else}
									<div class="h-full w-full"></div>
								{/if}
							</div>
						</div>
						<div class="min-w-0 leading-tight self-center">
							<div class="truncate text-base sm:text-xl font-semibold">
								{s.name || `Player ${s.id}`}
							</div>
							<div class="mt-0.5 text-sm flex items-center gap-2 leading-tight">
								{#if s.dropped}
									<span class="font-bold text-red-500">Dropped</span>
								{:else}
									<span class={`font-bold ${recClass(s.record.losses)}`}>{recStr(s)}</span>
								{/if}
								<span class="text-white">•</span>
								<span class="truncate text-white">{s.hero || '—'}</span>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Right column (9–16) -->
		<div class="space-y-1 py-12 max-w-md">
			{#each colRight as s}
				<div class={`bg-gray-900 bg-opacity-50 rounded-lg p-3 ${s.dropped ? 'opacity-70' : ''}`}>
					<div class="grid items-stretch gap-3 [grid-template-columns:2.5rem_auto_1fr]">
						<div class="text-xl text-white font-semibold tabular-nums text-right pr-3 self-center">
							{s.rank}
						</div>
						<div class="self-stretch">
							<div class="h-full aspect-square overflow-hidden rounded-lg bg-gray-800">
								{#if s.hero}
									<img
										src={imgSrc(s.hero)}
										alt={s.hero}
										class="h-14 w-14 object-cover object-right"
									/>
								{:else}
									<div class="h-full w-full"></div>
								{/if}
							</div>
						</div>
						<div class="min-w-0 leading-tight self-center">
							<div class="truncate text-base sm:text-xl font-semibold">
								{s.name || `Player ${s.id}`}
							</div>
							<div class="mt-0.5 text-sm flex items-center gap-2 leading-tight">
								{#if s.dropped}
									<span class="font-bold text-red-500">Dropped</span>
								{:else}
									<span class={`font-bold ${recClass(s.record.losses)}`}>{recStr(s)}</span>
								{/if}
								<span class="text-white">•</span>
								<span class="truncate text-white">{s.hero || '—'}</span>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
