<script>
	import { onMount } from 'svelte';
	import { ref, onValue, set, update, get } from 'firebase/database';
	import { db } from '../firebaseClient';
	import heroes from '$lib/data/heroes.json';

	const ROOT = 'tournament';
	const PLAYER_COUNT = 16;
	const TABLE_COUNT = 8;

	let currentRound = 1;
	let players = []; // [{id,name,hero,wins,losses,draws,dropped}]
	let pairings = []; // [{table,p1,p2,winner}]
	let roundsList = []; // [1,2,3,...]
	let selectedRound = 1;

	// --- utils ---
	const slugify = (name) =>
		(name || '')
			.toLowerCase()
			.replace(/["',]/g, '')
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.trim();
	const imgSrc = (name) => `/heroImages/${slugify(name)}.jpg`;

	function blankPlayers() {
		return Array.from({ length: PLAYER_COUNT }, (_, id) => ({
			id,
			name: '',
			hero: '',
			wins: 0,
			losses: 0,
			draws: 0,
			dropped: false
		}));
	}
	function blankPairings() {
		return Array.from({ length: TABLE_COUNT }, (_, i) => ({
			table: i + 1,
			p1: '',
			p2: '',
			winner: null // number | 'draw' | null
		}));
	}

	const heroOptions = heroes
		.map((h) => h?.name?.trim())
		.filter(Boolean)
		.sort((a, b) => a.localeCompare(b));

	let unsubPairings = null;

	// --- BYE helpers ---
	const isBye = (x) => x === 'BYE';
	const normSeat = (x) => (x === '' || x == null ? '' : isBye(x) ? 'BYE' : Number(x));
	const onlyPid = (x) => (x === '' || x == null || x === 'BYE' ? '' : Number(x));
	function autoWinnerFor(p1, p2) {
		if (isBye(p1) && onlyPid(p2) !== '') return onlyPid(p2);
		if (isBye(p2) && onlyPid(p1) !== '') return onlyPid(p1);
		return null;
	}

	// --- one-time bootstrap ---
	async function ensureBootstrapped() {
		const roundsSnap = await get(ref(db, `${ROOT}/rounds`));
		if (!roundsSnap.exists()) {
			await set(ref(db, `${ROOT}/currentRound`), 1);
			await update(
				ref(db, `${ROOT}/rounds/1/pairings`),
				Object.fromEntries(
					blankPairings().map((p) => [p.table, { table: p.table, p1: '', p2: '', winner: null }])
				)
			);
			selectedRound = 1;
		}
	}

	// Firebase wiring
	onMount(async () => {
		await ensureBootstrapped();

		const unsub1 = onValue(ref(db, `${ROOT}/currentRound`), (snap) => {
			currentRound = snap.val() || 1;
			if (!roundsList.length || selectedRound == null) selectedRound = currentRound;
		});

		const unsub2 = onValue(ref(db, `${ROOT}/players`), (snap) => {
			const v = snap.val();
			players = v ? normalizePlayers(v) : blankPlayers();
		});

		const unsub3 = onValue(ref(db, `${ROOT}/rounds`), (snap) => {
			const val = snap.val() || {};
			roundsList = Object.keys(val)
				.map(Number)
				.filter(Number.isInteger)
				.sort((a, b) => a - b);
			if (!roundsList.includes(selectedRound)) {
				selectedRound = roundsList.length ? roundsList[roundsList.length - 1] : 1;
			}
			attachPairingsListener(selectedRound);
		});

		return () => {
			unsub1?.();
			unsub2?.();
			unsub3?.();
			unsubPairings?.();
		};
	});

	function attachPairingsListener(round) {
		unsubPairings?.();
		unsubPairings = onValue(ref(db, `${ROOT}/rounds/${round}/pairings`), (snap) => {
			pairings = normalizePairings(snap.val());
			if (!snap.exists()) pairings = blankPairings();
		});
	}

	function normalizePlayers(map) {
		const arr = blankPlayers();
		for (const [key, v] of Object.entries(map || {})) {
			const id = Number(key);
			if (Number.isInteger(id) && id >= 0 && id < PLAYER_COUNT) {
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
		}
		return arr;
	}

	function normalizePairings(map) {
		const arr = blankPairings();
		for (const [key, v] of Object.entries(map || {})) {
			const table = Number(key);
			if (Number.isInteger(table) && table >= 1 && table <= TABLE_COUNT) {
				let w = null;
				if (v?.winner === 'draw') w = 'draw';
				else if (v?.winner === 0 || v?.winner) w = Number(v.winner);
				arr[table - 1] = { table, p1: v?.p1 ?? '', p2: v?.p2 ?? '', winner: w };
			}
		}
		return arr;
	}

	// --- history helpers ---
	async function historyClearPathsFor(round, table) {
		// Build a multi-path "null" map for any history entries at (round, table)
		const histSnap = await get(ref(db, `${ROOT}/history`));
		const hist = histSnap.val() || {};
		const clears = {};
		for (const [pid, perRound] of Object.entries(hist)) {
			const rec = perRound?.[round];
			if (rec && Number(rec.table) === Number(table)) {
				clears[`${ROOT}/history/${pid}/${round}`] = null;
			}
		}
		return clears;
	}

	async function recountFromHistory() {
		const histSnap = await get(ref(db, `${ROOT}/history`));
		const hist = histSnap.val() || {};
		const counts = new Map(); // pid -> { w,l,d }
		for (const p of players) counts.set(p.id, { w: 0, l: 0, d: 0 });

		for (const [pidStr, perRound] of Object.entries(hist)) {
			const pid = Number(pidStr);
			const acc = counts.get(pid) || { w: 0, l: 0, d: 0 };
			for (const rec of Object.values(perRound || {})) {
				const r = String(rec?.result || '').toUpperCase();
				if (r === 'W' || r === 'B' || r === 'BYE')
					acc.w += 1; // BYE counts as win
				else if (r === 'L') acc.l += 1;
				else if (r === 'D') acc.d += 1;
			}
			counts.set(pid, acc);
		}

		const updates = {};
		for (const [pid, { w, l, d }] of counts.entries()) {
			updates[`${ROOT}/players/${pid}/wins`] = w;
			updates[`${ROOT}/players/${pid}/losses`] = l;
			updates[`${ROOT}/players/${pid}/draws`] = d;
		}
		if (Object.keys(updates).length) {
			await update(ref(db), updates);
		}
	}

	// Player editing
	function setPlayerField(id, field, val) {
		const p = players[id];
		if (!p) return;

		if (field === 'wins' || field === 'losses' || field === 'draws') {
			p[field] = Math.max(0, parseInt(val || '0', 10) || 0);
		} else if (field === 'hero') {
			p.hero = val || '';
		} else if (field === 'dropped') {
			p.dropped = !!val;
		} else {
			p[field] = val;
		}

		update(ref(db, `${ROOT}/players/${id}`), {
			name: p.name,
			hero: p.hero,
			wins: p.wins,
			losses: p.losses,
			draws: p.draws,
			dropped: p.dropped
		});
	}
	const toggleDrop = (id) => setPlayerField(id, 'dropped', !players[id].dropped);

	// --- Pairings editing (atomic multi-path updates) ---
	async function setSeat(tableIdx, seat, rawVal) {
		const row = pairings[tableIdx];
		const table = row.table;

		// normalize & apply locally
		const newSeat = normSeat(rawVal);
		row[seat] = newSeat;

		// compute auto winner for BYE (if any)
		const autoW = autoWinnerFor(row.p1, row.p2);

		// build a single multi-path update: clear old history (if any) + write pairings + write BYE history if applicable
		const updates = await historyClearPathsFor(selectedRound, table);
		updates[`${ROOT}/rounds/${selectedRound}/pairings/${table}`] = {
			table,
			p1: row.p1,
			p2: row.p2,
			winner: autoW ?? null
		};
		if (autoW != null) {
			updates[`${ROOT}/history/${autoW}/${selectedRound}`] = {
				round: selectedRound,
				table,
				opponentId: null,
				result: 'B'
			};
		}

		await update(ref(db), updates);
		await recountFromHistory();
	}

	async function setWinner(tableIdx, winnerId) {
		const row = pairings[tableIdx];
		const table = row.table;
		const p1 = row.p1;
		const p2 = row.p2;
		if (p1 === '' || p2 === '') return;

		// determine next (respect BYE; no draw when BYE present)
		let next;
		if (isBye(p1) !== isBye(p2)) {
			next = isBye(p1) ? onlyPid(p2) : onlyPid(p1);
		} else if (winnerId === 'draw') {
			next = 'draw';
		} else {
			next = Number(winnerId);
		}

		// single multi-path update: clear old p1/p2 history, write pairings, write new history
		const updates = {};
		if (typeof p1 === 'number') updates[`${ROOT}/history/${p1}/${selectedRound}`] = null;
		if (typeof p2 === 'number') updates[`${ROOT}/history/${p2}/${selectedRound}`] = null;

		updates[`${ROOT}/rounds/${selectedRound}/pairings/${table}`] = { table, p1, p2, winner: next };

		if (next === 'draw') {
			const pid1 = onlyPid(p1);
			const pid2 = onlyPid(p2);
			if (pid1 !== '' && pid2 !== '') {
				updates[`${ROOT}/history/${pid1}/${selectedRound}`] = {
					round: selectedRound,
					table,
					opponentId: pid2,
					result: 'D'
				};
				updates[`${ROOT}/history/${pid2}/${selectedRound}`] = {
					round: selectedRound,
					table,
					opponentId: pid1,
					result: 'D'
				};
			}
		} else if (typeof next === 'number') {
			if (isBye(p1) || isBye(p2)) {
				updates[`${ROOT}/history/${next}/${selectedRound}`] = {
					round: selectedRound,
					table,
					opponentId: null,
					result: 'B'
				};
			} else {
				const pid1 = onlyPid(p1);
				const pid2 = onlyPid(p2);
				const loser = next === pid1 ? pid2 : pid1;
				if (pid1 !== '' && pid2 !== '') {
					updates[`${ROOT}/history/${pid1}/${selectedRound}`] = {
						round: selectedRound,
						table,
						opponentId: pid2,
						result: next === pid1 ? 'W' : 'L'
					};
					updates[`${ROOT}/history/${pid2}/${selectedRound}`] = {
						round: selectedRound,
						table,
						opponentId: pid1,
						result: next === pid2 ? 'W' : 'L'
					};
				}
			}
		}

		await update(ref(db), updates);
		await recountFromHistory();
	}

	// Submit: verify every table has a result, then advance
	async function submitAndAdvance() {
		const incomplete = pairings.some((m) => m.p1 === '' || m.p2 === '' || m.winner == null);
		if (incomplete) {
			alert('Please enter results for all tables before advancing.');
			return;
		}
		const next = Number(currentRound) + 1;
		await set(ref(db, `${ROOT}/currentRound`), next);
		await update(
			ref(db, `${ROOT}/rounds/${next}/pairings`),
			Object.fromEntries(
				blankPairings().map((p) => [p.table, { table: p.table, p1: '', p2: '', winner: null }])
			)
		);
		selectedRound = next;
		attachPairingsListener(selectedRound);
	}

	// Delete round & recount
	async function deleteRound() {
		const r = Number(selectedRound);
		if (!r || !roundsList.includes(r)) return;
		if (!confirm(`Delete round ${r}? This removes its results and restores records.`)) return;

		// remove per-player history entries for that round
		const histSnap = await get(ref(db, `${ROOT}/history`));
		const hist = histSnap.val() || {};
		const updates = {};
		for (const pid of Object.keys(hist)) {
			if (hist[pid]?.[r]) {
				updates[`${ROOT}/history/${pid}/${r}`] = null;
			}
		}
		if (Object.keys(updates).length) await update(ref(db), updates);

		// delete round node
		await set(ref(db, `${ROOT}/rounds/${r}`), null);

		// recount from remaining history
		await recountFromHistory();

		// fix currentRound + selection
		const roundsSnap = await get(ref(db, `${ROOT}/rounds`));
		const remaining = Object.keys(roundsSnap.val() || {})
			.map(Number)
			.filter(Number.isInteger);
		const fallback = remaining.length ? Math.max(...remaining) : 1;
		if (r === currentRound) await set(ref(db, `${ROOT}/currentRound`), fallback);
		selectedRound = fallback;
		attachPairingsListener(selectedRound);
	}

	// Round mgmt
	function onPickRound(e) {
		const picked = Number(e.target.value);
		if (!Number.isInteger(picked)) return;
		selectedRound = picked;
		attachPairingsListener(selectedRound);
	}
	async function setAsCurrent() {
		await set(ref(db, `${ROOT}/currentRound`), Number(selectedRound));
	}
	async function createNextRound() {
		const next = (roundsList.length ? Math.max(...roundsList) : 0) + 1;
		await update(
			ref(db, `${ROOT}/rounds/${next}/pairings`),
			Object.fromEntries(
				blankPairings().map((p) => [p.table, { table: p.table, p1: '', p2: '', winner: null }])
			)
		);
		selectedRound = next;
		attachPairingsListener(selectedRound);
		await set(ref(db, `${ROOT}/currentRound`), next);
	}

	function playerLabel(p) {
		const rec = `${p.wins}-${p.losses}-${p.draws ?? 0}`;
		return p.name ? `${p.name} (${rec})` : `Player ${p.id}`;
	}
	$: totalPlayers = players.reduce((a, p) => a + (p.name && !p.dropped ? 1 : 0), 0);

	function eligiblePlayersFor(round, keepId) {
		if (round <= currentRound) return players;
		return players.filter((p) => !p.dropped || p.id === keepId);
	}

	// winner highlight for numeric seats
	const isWinnerSeat = (row, seatKey) =>
		typeof row.winner === 'number' &&
		typeof row[seatKey] === 'number' &&
		row.winner === row[seatKey];
</script>

<div class="p-3 sm:p-4 max-w-7xl mx-auto space-y-3 text-white">
	<!-- Header Card -->
	<div class="bg-gray-900 border border-gray-800 rounded-lg p-3">
		<div class="flex flex-col sm:flex-row sm:items-center gap-3">
			<!-- Round Info -->
			<div class="flex items-center gap-3 flex-1">
				<div class="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-800 text-sm">
					<span class="text-gray-500">Current:</span>
					<span class="font-mono font-bold text-green-400 tabular-nums">Round {currentRound}</span>
				</div>
				<select
					class="px-3 py-1.5 rounded border border-gray-700 bg-gray-800 text-sm text-white focus:border-blue-500 focus:outline-none transition-colors"
					on:change={onPickRound}
					bind:value={selectedRound}
				>
					{#if roundsList.length === 0}
						<option value={1}>Round 1</option>
					{/if}
					{#each roundsList as r}<option value={r}>Round {r}</option>{/each}
				</select>
			</div>

			<!-- Actions -->
			<div class="flex items-center gap-2 flex-wrap">
				<div class="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-800 text-sm">
					<span class="text-gray-500">Players:</span>
					<span class="font-mono font-bold text-blue-400 tabular-nums">{totalPlayers}</span>
				</div>
				<button
					class="px-3 py-1.5 rounded text-xs font-medium bg-gray-700 text-white hover:bg-gray-600 transition-colors"
					on:click={setAsCurrent}
				>
					Set Current
				</button>
				<button
					class="px-3 py-1.5 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
					on:click={createNextRound}
				>
					New Round
				</button>
				<button
					class="px-3 py-1.5 rounded text-xs bg-gray-800 text-gray-400 hover:bg-red-600 hover:text-white transition-colors"
					on:click={deleteRound}
				>
					Delete
				</button>
			</div>
		</div>
	</div>

	<!-- Players Card -->
	<div class="bg-gray-900 border border-gray-800 rounded-lg p-3">
		<div class="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-3">Players ({players.filter(p => p.name).length})</div>

		<!-- Desktop/Tablet Grid -->
		<div class="hidden md:block">
			<div class="grid grid-cols-12 text-[10px] text-gray-500 uppercase tracking-wider font-medium px-2 py-1 mb-2">
				<div class="col-span-1">#</div>
				<div class="col-span-4">Name</div>
				<div class="col-span-3">Hero</div>
				<div class="col-span-1 text-center">W</div>
				<div class="col-span-1 text-center">L</div>
				<div class="col-span-2 text-right">Record</div>
			</div>
			<div class="space-y-1">
				{#each players as p}
					<div
						class="grid grid-cols-12 gap-1 px-2 py-1.5 items-center rounded-lg border border-gray-800 bg-gray-800/50 transition-colors hover:border-gray-700 hover:bg-gray-800 {p.dropped ? 'opacity-50' : ''} {p.name && !p.dropped ? 'border-l-2 border-l-blue-500' : ''}"
					>
						<div class="col-span-1 text-xs font-mono text-gray-500">{p.id + 1}</div>
						<div class="col-span-4">
							<input
								class="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
								placeholder="Player name"
								bind:value={p.name}
								on:change={(e) => setPlayerField(p.id, 'name', e.target.value)}
							/>
						</div>
						<div class="col-span-3 flex items-center gap-2">
							<img
								src={imgSrc(p.hero)}
								alt={p.hero}
								class="w-6 h-6 rounded object-cover object-right flex-shrink-0"
								loading="lazy"
							/>
							<select
								class="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none transition-colors"
								bind:value={p.hero}
								on:change={(e) => setPlayerField(p.id, 'hero', e.target.value)}
							>
								<option value="">Select hero</option>
								{#each heroOptions as h}<option value={h}>{h}</option>{/each}
							</select>
						</div>
						<div class="col-span-1">
							<input
								class="w-full rounded border border-gray-700 bg-gray-900 px-1 py-1 text-xs text-center font-mono text-white focus:border-blue-500 focus:outline-none transition-colors"
								bind:value={p.wins}
								on:change={(e) => setPlayerField(p.id, 'wins', e.target.value)}
								inputmode="numeric"
							/>
						</div>
						<div class="col-span-1">
							<input
								class="w-full rounded border border-gray-700 bg-gray-900 px-1 py-1 text-xs text-center font-mono text-white focus:border-blue-500 focus:outline-none transition-colors"
								bind:value={p.losses}
								on:change={(e) => setPlayerField(p.id, 'losses', e.target.value)}
								inputmode="numeric"
							/>
						</div>
						<div class="col-span-2 flex items-center justify-end gap-2">
							<span class="font-mono text-xs text-gray-300 tabular-nums">{p.wins}-{p.losses}-{p.draws ?? 0}</span>
							<button
								type="button"
								class="w-7 h-7 rounded text-xs transition-colors {p.dropped ? 'bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white' : 'bg-gray-700 text-gray-400 hover:bg-red-600 hover:text-white'}"
								on:click={() => toggleDrop(p.id)}
								title={p.dropped ? 'Restore player' : 'Drop player'}
							>
								{p.dropped ? '+' : 'x'}
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Mobile Grid -->
		<div class="md:hidden grid grid-cols-1 gap-1.5">
			{#each players as p}
				<div
					class="rounded-lg border border-gray-800 bg-gray-800/50 p-2 transition-colors hover:border-gray-700 hover:bg-gray-800 {p.dropped ? 'opacity-50' : ''} {p.name && !p.dropped ? 'border-l-2 border-l-blue-500' : ''}"
				>
					<div class="flex items-center gap-2">
						<span class="text-xs font-mono text-gray-500 w-5">{p.id + 1}</span>
						<input
							class="flex-1 rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
							placeholder="Name"
							bind:value={p.name}
							on:change={(e) => setPlayerField(p.id, 'name', e.target.value)}
						/>
						<button
							type="button"
							class="w-7 h-7 rounded text-xs transition-colors flex-shrink-0 {p.dropped ? 'bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white' : 'bg-gray-700 text-gray-400 hover:bg-red-600 hover:text-white'}"
							on:click={() => toggleDrop(p.id)}
						>
							{p.dropped ? '+' : 'x'}
						</button>
					</div>
					<div class="flex items-center gap-2 mt-1.5 pl-7">
						<img
							src={imgSrc(p.hero)}
							alt={p.hero}
							class="w-6 h-6 rounded object-cover object-right flex-shrink-0"
							loading="lazy"
						/>
						<select
							class="flex-1 rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
							bind:value={p.hero}
							on:change={(e) => setPlayerField(p.id, 'hero', e.target.value)}
						>
							<option value="">Select hero</option>
							{#each heroOptions as h}<option value={h}>{h}</option>{/each}
						</select>
						<span class="font-mono text-xs text-gray-300 tabular-nums flex-shrink-0">{p.wins}-{p.losses}-{p.draws ?? 0}</span>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Pairings Card -->
	<div class="bg-gray-900 border border-gray-800 rounded-lg p-3">
		<div class="flex items-center justify-between mb-3">
			<div class="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Round {selectedRound} Pairings</div>
		</div>

		<!-- Desktop/Tablet View -->
		<div class="hidden md:block">
			<div class="grid grid-cols-12 text-[10px] text-gray-500 uppercase tracking-wider font-medium px-2 py-1 mb-2">
				<div class="col-span-1">Tbl</div>
				<div class="col-span-4">Player 1</div>
				<div class="col-span-4">Player 2</div>
				<div class="col-span-3 text-right">Result</div>
			</div>
			<div class="space-y-1">
				{#each pairings as m, idx}
					<div class="grid grid-cols-12 gap-1.5 px-2 py-1.5 items-center rounded-lg border border-gray-800 bg-gray-800/50 transition-colors hover:border-gray-700 hover:bg-gray-800 {m.winner !== null ? 'border-l-2 border-l-green-500' : ''}">
						<div class="col-span-1 text-xs font-mono text-gray-500">{m.table}</div>

						<div class="col-span-4">
							<select
								class="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none transition-colors {isWinnerSeat(pairings[idx], 'p1') ? 'border-green-500 bg-green-900/20' : ''}"
								bind:value={pairings[idx].p1}
								on:change={(e) => setSeat(idx, 'p1', e.target.value)}
							>
								<option value="">Select player</option>
								<option value="BYE">Bye</option>
								{#each eligiblePlayersFor(selectedRound, pairings[idx].p1) as p}
									<option value={p.id}>{playerLabel(p)}{p.dropped && selectedRound <= currentRound ? ' (dropped)' : ''}</option>
								{/each}
							</select>
						</div>

						<div class="col-span-4">
							<select
								class="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none transition-colors {isWinnerSeat(pairings[idx], 'p2') ? 'border-green-500 bg-green-900/20' : ''}"
								bind:value={pairings[idx].p2}
								on:change={(e) => setSeat(idx, 'p2', e.target.value)}
							>
								<option value="">Select player</option>
								<option value="BYE">Bye</option>
								{#each eligiblePlayersFor(selectedRound, pairings[idx].p2) as p}
									<option value={p.id}>{playerLabel(p)}{p.dropped && selectedRound <= currentRound ? ' (dropped)' : ''}</option>
								{/each}
							</select>
						</div>

						<div class="col-span-3 flex justify-end gap-1">
							<button
								class="w-8 h-7 rounded text-xs font-medium transition-colors {isWinnerSeat(pairings[idx], 'p1') ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-green-600 hover:text-white'}"
								on:click={() => setWinner(idx, pairings[idx].p1)}
								disabled={pairings[idx].p1 === '' || pairings[idx].p2 === '' || pairings[idx].p1 === 'BYE'}
							>
								P1
							</button>
							<button
								class="w-8 h-7 rounded text-xs font-medium transition-colors {isWinnerSeat(pairings[idx], 'p2') ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-green-600 hover:text-white'}"
								on:click={() => setWinner(idx, pairings[idx].p2)}
								disabled={pairings[idx].p1 === '' || pairings[idx].p2 === '' || pairings[idx].p2 === 'BYE'}
							>
								P2
							</button>
							<button
								class="px-2 h-7 rounded text-xs font-medium transition-colors {pairings[idx].winner === 'draw' ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-amber-600 hover:text-white'}"
								on:click={() => setWinner(idx, 'draw')}
								disabled={pairings[idx].p1 === '' || pairings[idx].p2 === '' || pairings[idx].p1 === 'BYE' || pairings[idx].p2 === 'BYE'}
							>
								Draw
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Pairings Mobile -->
	<div class="md:hidden bg-gray-900 border border-gray-800 rounded-lg p-3">
		<div class="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-3">Round {selectedRound} Pairings</div>
		<div class="grid grid-cols-1 gap-1.5">
			{#each pairings as m, idx}
				<div class="rounded-lg border border-gray-800 bg-gray-800/50 p-2 transition-colors {m.winner !== null ? 'border-l-2 border-l-green-500' : ''}">
					<div class="flex items-center justify-between mb-2">
						<span class="text-xs font-mono text-gray-500">Table {m.table}</span>
						<div class="flex gap-1">
							<button
								class="w-8 h-6 rounded text-[10px] font-medium transition-colors {isWinnerSeat(pairings[idx], 'p1') ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}"
								on:click={() => setWinner(idx, pairings[idx].p1)}
								disabled={pairings[idx].p1 === '' || pairings[idx].p2 === '' || pairings[idx].p1 === 'BYE'}
							>
								P1
							</button>
							<button
								class="w-8 h-6 rounded text-[10px] font-medium transition-colors {isWinnerSeat(pairings[idx], 'p2') ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}"
								on:click={() => setWinner(idx, pairings[idx].p2)}
								disabled={pairings[idx].p1 === '' || pairings[idx].p2 === '' || pairings[idx].p2 === 'BYE'}
							>
								P2
							</button>
							<button
								class="px-2 h-6 rounded text-[10px] font-medium transition-colors {pairings[idx].winner === 'draw' ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-300'}"
								on:click={() => setWinner(idx, 'draw')}
								disabled={pairings[idx].p1 === '' || pairings[idx].p2 === '' || pairings[idx].p1 === 'BYE' || pairings[idx].p2 === 'BYE'}
							>
								D
							</button>
						</div>
					</div>
					<div class="space-y-1.5">
						<select
							class="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none {isWinnerSeat(pairings[idx], 'p1') ? 'border-green-500 bg-green-900/20' : ''}"
							bind:value={pairings[idx].p1}
							on:change={(e) => setSeat(idx, 'p1', e.target.value)}
						>
							<option value="">Player 1</option>
							<option value="BYE">Bye</option>
							{#each eligiblePlayersFor(selectedRound, pairings[idx].p1) as p}
								<option value={p.id}>{playerLabel(p)}{p.dropped && selectedRound <= currentRound ? ' (dropped)' : ''}</option>
							{/each}
						</select>
						<select
							class="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none {isWinnerSeat(pairings[idx], 'p2') ? 'border-green-500 bg-green-900/20' : ''}"
							bind:value={pairings[idx].p2}
							on:change={(e) => setSeat(idx, 'p2', e.target.value)}
						>
							<option value="">Player 2</option>
							<option value="BYE">Bye</option>
							{#each eligiblePlayersFor(selectedRound, pairings[idx].p2) as p}
								<option value={p.id}>{playerLabel(p)}{p.dropped && selectedRound <= currentRound ? ' (dropped)' : ''}</option>
							{/each}
						</select>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Actions Card -->
	<div class="bg-gray-900 border border-gray-800 rounded-lg p-3">
		<div class="flex items-center gap-2">
			<button
				class="px-4 py-2 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
				on:click={submitAndAdvance}
			>
				Submit & Advance Round
			</button>
		</div>
	</div>
</div>
