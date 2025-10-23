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

<div class="space-y-6 p-4 sm:p-6 bg-gray-900 text-white">
	<!-- Header -->
	<div class="flex flex-wrap items-center gap-3">
		<h2 class="text-lg sm:text-xl font-bold">Tournament Manager</h2>
		<div class="text-xs sm:text-sm text-gray-300">
			Current Round: <span class="font-semibold text-white">{currentRound}</span>
		</div>
		<div class="ml-auto flex flex-wrap gap-2">
			<select
				class="px-2 py-1 rounded bg-gray-800 text-white text-xs sm:text-sm"
				on:change={onPickRound}
				bind:value={selectedRound}
			>
				{#if roundsList.length === 0}
					<option value={1}>Round 1</option>
				{/if}
				{#each roundsList as r}<option value={r}>Round {r}</option>{/each}
			</select>
			<button
				class="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs sm:text-sm"
				on:click={setAsCurrent}>Set as Current</button
			>
			<button
				class="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-xs sm:text-sm"
				on:click={createNextRound}>Create Next Round</button
			>
			<button
				class="bg-red-600 hover:bg-red-500 px-3 py-1 rounded text-xs sm:text-sm"
				on:click={deleteRound}>Delete Round</button
			>
		</div>
	</div>

	<!-- Players (desktop/tablet) -->
	<div class="hidden md:block border border-gray-700 rounded overflow-hidden mx-auto">
		<div class="grid grid-cols-12 bg-gray-800 text-gray-300 text-xs font-medium px-2 py-1">
			<div class="col-span-1">Seed</div>
			<div class="col-span-4">Name</div>
			<div class="col-span-3">Hero</div>
			<div class="col-span-1 text-right">W</div>
			<div class="col-span-1 text-right">L</div>
			<div class="col-span-2 text-right">Rec / Drop</div>
		</div>
		{#each players as p}
			<div
				class="grid grid-cols-12 gap-1 px-2 py-1 border-t border-gray-700 items-center {p.dropped
					? 'opacity-60'
					: ''}"
			>
				<div class="col-span-1 text-xs text-gray-400">{p.id + 1}</div>
				<div class="col-span-4">
					<input
						class="w-full bg-gray-800 rounded px-2 py-1 text-xs"
						bind:value={p.name}
						on:change={(e) => setPlayerField(p.id, 'name', e.target.value)}
					/>
				</div>
				<div class="col-span-3 flex items-center gap-2">
					<img
						src={imgSrc(p.hero)}
						alt={p.hero}
						class="w-6 h-6 rounded object-cover object-right"
					/>
					<select
						class="w-full bg-gray-800 rounded px-2 py-1 text-xs"
						bind:value={p.hero}
						on:change={(e) => setPlayerField(p.id, 'hero', e.target.value)}
					>
						<option value="">Select hero…</option>
						{#each heroOptions as h}<option value={h}>{h}</option>{/each}
					</select>
				</div>
				<div class="col-span-1">
					<input
						class="w-full bg-gray-800 rounded px-2 py-1 text-xs text-right"
						bind:value={p.wins}
						on:change={(e) => setPlayerField(p.id, 'wins', e.target.value)}
						inputmode="numeric"
					/>
				</div>
				<div class="col-span-1">
					<input
						class="w-full bg-gray-800 rounded px-2 py-1 text-xs text-right"
						bind:value={p.losses}
						on:change={(e) => setPlayerField(p.id, 'losses', e.target.value)}
						inputmode="numeric"
					/>
				</div>
				<div class="col-span-2 text-xs text-right flex items-center justify-end gap-2">
					<span class="text-gray-200">{p.wins}-{p.losses}-{p.draws ?? 0}</span>
					<button
						type="button"
						class="text-xs px-2 py-1 rounded border border-gray-600 hover:bg-gray-800 {p.dropped
							? 'text-emerald-400'
							: 'text-red-400'}"
						on:click={() => toggleDrop(p.id)}
					>
						{p.dropped ? 'Restore' : 'Drop'}
					</button>
				</div>
			</div>
		{/each}
	</div>

	<!-- Players (mobile) -->
	<div class="md:hidden space-y-2">
		{#each players as p}
			<div class="rounded border border-gray-700 p-3 {p.dropped ? 'opacity-60' : ''}">
				<div class="flex items-center justify-between gap-2">
					<div class="text-sm font-semibold">{p.name || `Player ${p.id}`}</div>
					<button
						type="button"
						class="text-[11px] px-2 py-1 rounded border border-gray-600 hover:bg-gray-800 {p.dropped
							? 'text-emerald-400'
							: 'text-red-400'}"
						on:click={() => toggleDrop(p.id)}
					>
						{p.dropped ? 'Restore' : 'Drop'}
					</button>
				</div>

				<div class="mt-2 grid grid-cols-6 gap-2 items-center">
					<div class="col-span-6">
						<input
							class="w-full bg-gray-800 rounded px-2 py-1 text-xs"
							placeholder="Name"
							bind:value={p.name}
							on:change={(e) => setPlayerField(p.id, 'name', e.target.value)}
						/>
					</div>

					<div class="col-span-6 flex items-center gap-2">
						<img
							src={imgSrc(p.hero)}
							alt={p.hero}
							class="w-7 h-7 rounded object-cover object-right"
						/>
						<select
							class="flex-1 bg-gray-800 rounded px-2 py-1 text-xs"
							bind:value={p.hero}
							on:change={(e) => setPlayerField(p.id, 'hero', e.target.value)}
						>
							<option value="">Select hero…</option>
							{#each heroOptions as h}<option value={h}>{h}</option>{/each}
						</select>
					</div>

					<div class="col-span-3">
						<label class="block text-[11px] text-gray-400">W</label>
						<input
							class="w-full bg-gray-800 rounded px-2 py-1 text-xs text-right"
							inputmode="numeric"
							bind:value={p.wins}
							on:change={(e) => setPlayerField(p.id, 'wins', e.target.value)}
						/>
					</div>
					<div class="col-span-3">
						<label class="block text-[11px] text-gray-400">L</label>
						<input
							class="w-full bg-gray-800 rounded px-2 py-1 text-xs text-right"
							inputmode="numeric"
							bind:value={p.losses}
							on:change={(e) => setPlayerField(p.id, 'losses', e.target.value)}
						/>
					</div>

					<div class="col-span-6 text-right text-xs text-gray-300">
						Record: <span class="text-white">{p.wins}-{p.losses}-{p.draws ?? 0}</span>
					</div>
				</div>
			</div>
		{/each}
	</div>

	<!-- Pairings (desktop/tablet) -->
	<div class="hidden md:block border border-gray-700 rounded overflow-hidden">
		<div class="flex justify-between items-center px-2 py-1 bg-gray-800 text-xs text-gray-300">
			<span>Round {selectedRound} Pairings</span>
			<span class="text-gray-400">Players entered: {totalPlayers}</span>
		</div>
		<div class="grid grid-cols-12 text-xs text-gray-300 px-2 py-1">
			<div class="col-span-1">Tbl</div>
			<div class="col-span-5">Player 1</div>
			<div class="col-span-5">Player 2</div>
			<div class="col-span-1 text-right">Result</div>
		</div>
		{#each pairings as m, idx}
			<div class="grid grid-cols-12 gap-1 px-2 py-1 border-t border-gray-700 items-center">
				<div class="col-span-1 text-xs text-gray-400">{m.table}</div>

				<div class="col-span-5">
					<select
						class="w-full bg-gray-800 rounded px-2 py-1 text-xs"
						bind:value={pairings[idx].p1}
						on:change={(e) => setSeat(idx, 'p1', e.target.value)}
					>
						<option value="">—</option>
						<option value="BYE">Bye</option>
						{#each eligiblePlayersFor(selectedRound, pairings[idx].p1) as p}
							<option value={p.id}
								>{playerLabel(p)}{p.dropped && selectedRound <= currentRound
									? ' (dropped)'
									: ''}</option
							>
						{/each}
					</select>
				</div>

				<div class="col-span-5">
					<select
						class="w-full bg-gray-800 rounded px-2 py-1 text-xs"
						bind:value={pairings[idx].p2}
						on:change={(e) => setSeat(idx, 'p2', e.target.value)}
					>
						<option value="">—</option>
						<option value="BYE">Bye</option>
						{#each eligiblePlayersFor(selectedRound, pairings[idx].p2) as p}
							<option value={p.id}
								>{playerLabel(p)}{p.dropped && selectedRound <= currentRound
									? ' (dropped)'
									: ''}</option
							>
						{/each}
					</select>
				</div>

				<div class="col-span-1 flex justify-end gap-1">
					<button
						class={`bg-gray-800 hover:bg-gray-700 text-white text-xs px-2 py-1 rounded ${isWinnerSeat(pairings[idx], 'p1') ? 'ring-2 ring-emerald-400' : ''}`}
						on:click={() => setWinner(idx, pairings[idx].p1)}
						disabled={pairings[idx].p1 === '' ||
							pairings[idx].p2 === '' ||
							pairings[idx].p1 === 'BYE'}
					>
						P1
					</button>
					<button
						class={`bg-gray-800 hover:bg-gray-700 text-white text-xs px-2 py-1 rounded ${isWinnerSeat(pairings[idx], 'p2') ? 'ring-2 ring-emerald-400' : ''}`}
						on:click={() => setWinner(idx, pairings[idx].p2)}
						disabled={pairings[idx].p1 === '' ||
							pairings[idx].p2 === '' ||
							pairings[idx].p2 === 'BYE'}
					>
						P2
					</button>
					<button
						class={`bg-amber-600 hover:bg-amber-700 text-white text-xs px-2 py-1 rounded ${pairings[idx].winner === 'draw' ? 'ring-2 ring-amber-300' : ''}`}
						on:click={() => setWinner(idx, 'draw')}
						disabled={pairings[idx].p1 === '' ||
							pairings[idx].p2 === '' ||
							pairings[idx].p1 === 'BYE' ||
							pairings[idx].p2 === 'BYE'}
					>
						Draw
					</button>
				</div>
			</div>
		{/each}
	</div>

	<!-- Pairings (mobile) -->
	<div class="md:hidden space-y-2">
		<div class="flex items-center justify-between text-[12px] text-gray-300">
			<span>Round {selectedRound} Pairings</span>
			<span class="text-gray-400">Players: {totalPlayers}</span>
		</div>

		{#each pairings as m, idx}
			<div class="rounded border border-gray-700 p-3 space-y-2">
				<div class="flex items-center justify-between">
					<div class="text-xs text-gray-300">Table {m.table}</div>
					<div class="flex gap-2">
						<button
							class={`px-2 py-1 text-[12px] rounded ${isWinnerSeat(pairings[idx], 'p1') ? 'bg-emerald-600' : 'bg-gray-800'}`}
							on:click={() => setWinner(idx, pairings[idx].p1)}
							disabled={pairings[idx].p1 === '' ||
								pairings[idx].p2 === '' ||
								pairings[idx].p1 === 'BYE'}>P1</button
						>
						<button
							class={`px-2 py-1 text-[12px] rounded ${isWinnerSeat(pairings[idx], 'p2') ? 'bg-emerald-600' : 'bg-gray-800'}`}
							on:click={() => setWinner(idx, pairings[idx].p2)}
							disabled={pairings[idx].p1 === '' ||
								pairings[idx].p2 === '' ||
								pairings[idx].p2 === 'BYE'}>P2</button
						>
						<button
							class={`px-2 py-1 text-[12px] rounded ${pairings[idx].winner === 'draw' ? 'bg-amber-600' : 'bg-gray-800'}`}
							on:click={() => setWinner(idx, 'draw')}
							disabled={pairings[idx].p1 === '' ||
								pairings[idx].p2 === '' ||
								pairings[idx].p1 === 'BYE' ||
								pairings[idx].p2 === 'BYE'}>Draw</button
						>
					</div>
				</div>

				<div class="space-y-2">
					<div>
						<label class="block text-[11px] text-gray-400 mb-1">Player 1</label>
						<select
							class="w-full bg-gray-800 rounded px-2 py-1 text-xs"
							bind:value={pairings[idx].p1}
							on:change={(e) => setSeat(idx, 'p1', e.target.value)}
						>
							<option value="">—</option>
							<option value="BYE">Bye</option>
							{#each eligiblePlayersFor(selectedRound, pairings[idx].p1) as p}
								<option value={p.id}
									>{playerLabel(p)}{p.dropped && selectedRound <= currentRound
										? ' (dropped)'
										: ''}</option
								>
							{/each}
						</select>
					</div>

					<div>
						<label class="block text-[11px] text-gray-400 mb-1">Player 2</label>
						<select
							class="w-full bg-gray-800 rounded px-2 py-1 text-xs"
							bind:value={pairings[idx].p2}
							on:change={(e) => setSeat(idx, 'p2', e.target.value)}
						>
							<option value="">—</option>
							<option value="BYE">Bye</option>
							{#each eligiblePlayersFor(selectedRound, pairings[idx].p2) as p}
								<option value={p.id}
									>{playerLabel(p)}{p.dropped && selectedRound <= currentRound
										? ' (dropped)'
										: ''}</option
								>
							{/each}
						</select>
					</div>
				</div>
			</div>
		{/each}
	</div>

	<!-- Actions -->
	<div class="flex flex-wrap gap-2">
		<button
			class="bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm rounded text-white"
			on:click={submitAndAdvance}
		>
			Submit & Advance
		</button>
	</div>
</div>
