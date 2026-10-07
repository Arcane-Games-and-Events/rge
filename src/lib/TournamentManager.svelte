<script>
	import { onMount } from 'svelte';
	import { ref, onValue, update } from 'firebase/database';
	import { db } from '../firebaseClient';
	import { loadHeroes } from '$lib/heroes';
	import { heroImageUrl } from '$lib/heroMedia';
	import HeroPicker from '$lib/HeroPicker.svelte';
	import {
		computeStandings,
		recordString,
		top8Seeding,
		orderWithTop8,
		ordinal,
		recordAfter
	} from '$lib/standings';
	import * as T from '$lib/tournament';
	import { FEATURE_PATH, sendFeatureMatch, isFeaturedTable } from '$lib/featureMatch';

	// The producer's tournament page, arranged around the job: enter the field
	// once, then each round seat the tables, click the results, advance. The
	// pairings and a live preview of the standings -- the same arithmetic the
	// overlay runs -- sit side by side, so what has gone on air is never a guess.
	// The players list, needed at the start and rarely after, folds away below.
	let currentRound = 1;
	let selectedRound = 1;
	let players = T.blankPlayers();
	let roundsTree = {};
	let historyMap = {};
	let ready = false;
	let busy = false;
	let error = '';
	let playersOpen = true;
	let menuOpen = false;
	// Which table is on the booth as the feature match, if one was sent from here.
	let feature = null;

	onMount(() => {
		loadHeroes();
		let unsub = null;
		const unsubFeature = onValue(ref(db, FEATURE_PATH), (snap) => (feature = snap.val()));
		T.ensureBootstrapped(db)
			.catch((err) => (error = `Could not open the tournament: ${err.message}`))
			.then(() => {
				unsub = onValue(ref(db, T.ROOT), (snap) => {
					const v = snap.val() || {};
					currentRound = Number(v.currentRound) || 1;
					players = T.normalizePlayers(v.players);
					roundsTree = v.rounds || {};
					historyMap = v.history || {};
					const rounds = Object.keys(roundsTree).map(Number).filter(Number.isInteger);
					if (!ready || !rounds.includes(selectedRound)) selectedRound = currentRound;
					ready = true;
				});
			});
		return () => {
			unsub?.();
			unsubFeature();
		};
	});

	$: roundsList = Object.keys(roundsTree)
		.map(Number)
		.filter(Number.isInteger)
		.sort((a, b) => a - b);
	$: latestRound = roundsList.length ? roundsList[roundsList.length - 1] : 1;
	$: isCurrent = selectedRound === currentRound;
	$: pairings = T.normalizePairings(roundsTree[selectedRound]?.pairings);
	$: standings = computeStandings(players, { roundsTree, historyMap, currentRound });

	// The Top 8 fills itself in. Whoever has clinched is written into the bracket
	// page's slots by their Top 8 seed, and slots not yet earned are emptied, so
	// the bracket always mirrors the tournament -- names and heroes only, so a
	// flag set there by hand is kept. Rewritten whenever the seeding changes,
	// which it can within a round as results land.
	$: top8Seeds = top8Seeding(players, historyMap);
	$: if (ready) syncTop8(top8Seeds, players);

	// Round 1 seats itself by seed as the field is entered -- seed 1 against 16
	// at table 1 and so on -- and for whoever is already entered when the page
	// opens. Only while round 1 is live, and never over a seat already taken.
	// The statement depends only on the data; the dedupe key below is what
	// stops it running again on its own completion.
	$: if (ready && currentRound === 1 && roundsTree[1]) seatRound1(players, roundsTree[1].pairings);

	let lastSeating = '';
	async function seatRound1(roster, pairingsMap) {
		const key = JSON.stringify([
			roster.map((p) => [p.name, p.dropped]),
			T.normalizePairings(pairingsMap).map((m) => [m.p1, m.p2, m.winner])
		]);
		if (key === lastSeating) return;
		lastSeating = key;
		try {
			await T.fillRound1(db, roster, pairingsMap);
		} catch (err) {
			error = `Could not seat round 1: ${err.message}`;
		}
	}

	let lastSynced = '';
	async function syncTop8(seeds, roster) {
		const payload = Object.fromEntries(
			Array.from({ length: 8 }, (_, slot) => [slot, { name: '', hero: '' }])
		);
		for (const [id, seed] of seeds) {
			const p = roster[id];
			if (!p || seed > 8) continue;
			payload[seed - 1] = { name: p.name, hero: p.hero };
		}
		// Nothing is written until someone has clinched, so an empty or freshly
		// reset tournament does not blank a bracket entered by hand.
		const key = JSON.stringify(payload);
		if (key === lastSynced || seeds.size === 0) return;
		lastSynced = key;
		const updates = {};
		for (const [slot, v] of Object.entries(payload)) {
			updates[`top8/players/${slot}/name`] = v.name;
			updates[`top8/players/${slot}/hero`] = v.hero;
		}
		try {
			await update(ref(db), updates);
		} catch (err) {
			error = `Could not update the Top 8 bracket: ${err.message}`;
		}
	}

	$: named = players.filter((p) => p.name.trim());
	$: dropped = named.filter((p) => p.dropped);
	// Dropped players are not offered for a seat. One already seated when dropped
	// stays in that seat (choicesFor keeps whoever is in it), so a pairing on
	// record is never broken.
	$: eligible = named.filter((p) => !p.dropped);
	$: seatedIds = new Set(
		pairings.flatMap((m) => [m.p1, m.p2]).filter((x) => typeof x === 'number')
	);
	$: unseated = eligible.filter((p) => !seatedIds.has(p.id));
	$: tablesInUse = pairings.filter((m) => m.p1 !== '' || m.p2 !== '');
	$: resultsIn = pairings.filter(T.tableComplete).length;
	// Every table that has anyone seated has both seats and a result.
	$: roundComplete = tablesInUse.length > 0 && tablesInUse.every(T.tableComplete);
	$: unfinished = tablesInUse.filter((m) => !T.tableComplete(m)).map((m) => m.table);

	// Helpers used in the template take their data as arguments rather than
	// reading it from the closure, so Svelte sees what each expression depends on
	// and redraws when it changes.
	const shortName = (id, roster) =>
		typeof id === 'number' ? roster[id]?.name || `Player ${id + 1}` : '';
	// Draws are not played, so a record is wins and losses.
	const record = (p) => `${p.wins}-${p.losses}`;
	const optionLabel = (p) => `${p.name} (${record(p)})${p.dropped ? ' · dropped' : ''}`;

	/**
	 * The players a seat may take, best record first: the unseated, undropped
	 * ones, plus whoever is in it now -- dropped or not, so a seat keeps showing
	 * its player through a drop and a restore rather than going blank.
	 */
	const choicesFor = (row, seatKey, pool, taken) =>
		pool
			.filter((p) => p.id === row[seatKey] || (!p.dropped && !taken.has(p.id)))
			// Best record first, so the players most likely to be paired are at the
			// top: most wins, then fewest losses, then seed.
			.sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.id - b.id);

	// Every write goes through here: one at a time, and a failure is shown rather
	// than lost in the console.
	async function run(task) {
		if (busy) return;
		busy = true;
		error = '';
		try {
			await task();
		} catch (err) {
			error = err?.message || String(err);
		} finally {
			busy = false;
		}
	}

	const savePlayerField = (p, field, value) =>
		run(() => T.savePlayer(db, { ...p, [field]: value }));

	const seat = (row, seatKey, value) =>
		run(() => T.setSeat(db, players, selectedRound, row, seatKey, value));
	const result = (row, winner) => run(() => T.setWinner(db, players, selectedRound, row, winner));

	// Send a table to the booth as the feature match: each player's name and
	// hero, and their record as this round began -- what the pairings overlay
	// shows for the table -- so a result entered first does not change it.
	const featureTable = (row) =>
		run(() => {
			const seatOf = (id) => {
				const p = players[id];
				const r = recordAfter(historyMap, id, selectedRound - 1);
				return { name: p?.name || '', hero: p?.hero || '', record: `${r.wins}-${r.losses}` };
			};
			return sendFeatureMatch(
				db,
				{ p1: seatOf(row.p1), p2: seatOf(row.p2) },
				{
					kind: 'swiss',
					round: selectedRound,
					table: row.table
				}
			);
		});
	const clearResult = (row) => run(() => T.clearResult(db, players, selectedRound, row));

	function advance() {
		if (!roundComplete) return;
		run(async () => {
			if (currentRound === latestRound) {
				selectedRound = await T.createRound(db, roundsList, players);
			} else {
				await T.setCurrentRound(db, currentRound + 1);
				selectedRound = currentRound + 1;
			}
		});
	}

	function newRound() {
		run(async () => {
			selectedRound = await T.createRound(db, roundsList, players);
		});
	}

	function removeRound() {
		menuOpen = false;
		const r = selectedRound;
		if (!confirm(`Delete round ${r}? Its results are removed and the records recounted.`)) return;
		run(async () => {
			selectedRound = await T.deleteRound(db, players, r, currentRound);
		});
	}

	function reset() {
		menuOpen = false;
		if (
			!confirm(
				'Reset the tournament? Every round and result is removed and records go back to 0-0; the players stay in their seeds.'
			)
		)
			return;
		if (!confirm('This cannot be undone. Reset it?')) return;
		run(async () => {
			await T.resetTournament(db, players);
			selectedRound = 1;
		});
	}

	const closeMenu = (e) => {
		if (!e.target.closest('.menu')) menuOpen = false;
	};
</script>

<svelte:window on:click={closeMenu} />

<div class="mx-auto max-w-7xl space-y-3 p-3 text-white sm:p-4">
	<!-- Header: which round, how far along it is, and the one button that moves on. -->
	<header class="rounded-lg border border-gray-800 bg-gray-900 p-3">
		<div class="flex flex-wrap items-center gap-2">
			<div class="flex items-center gap-1" role="tablist" aria-label="Rounds">
				{#each roundsList as r (r)}
					<button
						type="button"
						role="tab"
						aria-selected={r === selectedRound}
						on:click={() => (selectedRound = r)}
						class="h-9 min-w-9 rounded px-3 text-sm font-semibold transition-colors {r ===
						selectedRound
							? 'bg-blue-600 text-white'
							: r === currentRound
								? 'bg-gray-800 text-green-400 ring-1 ring-green-500/50 hover:bg-gray-700'
								: 'bg-gray-800 text-gray-400 hover:bg-gray-700'}"
					>
						R{r}
					</button>
				{/each}
				<button
					type="button"
					on:click={newRound}
					disabled={busy}
					title="Open the next round now, without finishing this one. Players already through get a bye at the top tables."
					class="h-9 rounded px-2.5 text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-white disabled:opacity-50"
				>
					+ Round
				</button>
			</div>

			<div class="flex items-center gap-2 text-xs">
				{#if isCurrent}
					<span class="rounded bg-green-600/20 px-2 py-1 font-semibold text-green-400"
						>Round {selectedRound} is live</span
					>
				{:else}
					<span class="rounded bg-gray-800 px-2 py-1 text-gray-400">
						Viewing round {selectedRound} · live is {currentRound}
					</span>
					<button
						type="button"
						on:click={() => run(() => T.setCurrentRound(db, selectedRound))}
						disabled={busy}
						class="h-7 rounded bg-gray-800 px-2 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
					>
						Make it live
					</button>
				{/if}
				<span class="rounded bg-gray-800 px-2 py-1 font-mono tabular-nums text-gray-300">
					{resultsIn}/{tablesInUse.length || T.TABLE_COUNT} results
				</span>
			</div>

			<div class="ml-auto flex items-center gap-2">
				{#if isCurrent}
					<button
						type="button"
						on:click={advance}
						disabled={!roundComplete || busy}
						title={roundComplete
							? `Open round ${currentRound + 1} and make it live; players already through get a bye at the top tables`
							: unfinished.length
								? `Waiting on table${unfinished.length > 1 ? 's' : ''} ${unfinished.join(', ')}`
								: 'Seat the tables first'}
						class="h-9 rounded px-4 text-sm font-bold transition-colors {roundComplete
							? 'bg-blue-600 text-white hover:bg-blue-500'
							: 'cursor-not-allowed bg-gray-800 text-gray-500'}"
					>
						Advance to Round {currentRound + 1} →
					</button>
				{/if}
				<div class="menu relative">
					<button
						type="button"
						aria-label="More actions"
						aria-expanded={menuOpen}
						on:click={() => (menuOpen = !menuOpen)}
						class="h-9 w-9 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
						>⋯</button
					>
					{#if menuOpen}
						<div
							class="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded border border-gray-700 bg-gray-900 shadow-xl"
						>
							<button
								type="button"
								on:click={removeRound}
								class="block w-full px-3 py-2 text-left text-xs text-gray-200 hover:bg-gray-800"
							>
								Delete round {selectedRound}…
							</button>
							<button
								type="button"
								on:click={reset}
								class="block w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-600 hover:text-white"
							>
								Reset tournament…
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>

		{#if error}
			<p
				class="mt-2 rounded border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-xs text-red-300"
			>
				{error}
			</p>
		{/if}
	</header>

	<div class="grid gap-3 lg:grid-cols-[3fr_2fr]">
		<!-- Pairings: seat the tables, click the results -->
		<section class="rounded-lg border border-gray-800 bg-gray-900 p-3" aria-label="Pairings">
			<div class="mb-2 flex flex-wrap items-center gap-2">
				<h2 class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
					Round {selectedRound} pairings
				</h2>
				{#if unseated.length}
					<span class="text-[10px] text-gray-500">Not seated:</span>
					{#each unseated as p (p.id)}
						<span class="rounded bg-amber-600/20 px-1.5 py-0.5 text-[10px] text-amber-300">
							{p.name}
						</span>
					{/each}
				{:else if named.length}
					<span class="text-[10px] text-green-500">Everyone is seated</span>
				{/if}
			</div>

			<div class="space-y-1">
				{#each pairings as row (row.table)}
					{@const complete = T.tableComplete(row)}
					{@const byeTable = T.isBye(row.p1) || T.isBye(row.p2)}
					<div
						class="grid items-center gap-1.5 rounded-lg border bg-gray-800/50 px-2 py-1.5 sm:grid-cols-[2rem_1fr_auto_1fr_auto] {complete
							? 'border-green-500/40'
							: 'border-gray-800'}"
					>
						<div class="text-xs font-mono text-gray-500">T{row.table}</div>

						{#each ['p1', 'p2'] as seatKey (seatKey)}
							{@const won = typeof row.winner === 'number' && row.winner === row[seatKey]}
							{@const hero = typeof row[seatKey] === 'number' ? players[row[seatKey]]?.hero : ''}
							<div class="flex items-center gap-1.5 {seatKey === 'p2' ? 'sm:order-4' : ''}">
								<!-- The seated player's hero, a tiny portrait cropped as the overlays
								     crop it; a blank square while the seat is empty. -->
								<span
									class="h-8 w-8 flex-shrink-0 overflow-hidden rounded border border-gray-700 bg-gray-900"
								>
									{#if hero}
										<img
											src={heroImageUrl(hero)}
											alt=""
											class="h-full w-full object-cover object-right-top"
											loading="lazy"
										/>
									{/if}
								</span>
								<select
									aria-label="Table {row.table} {seatKey === 'p1' ? 'player 1' : 'player 2'}"
									value={row[seatKey]}
									disabled={busy}
									on:change={(e) => seat(row, seatKey, e.target.value)}
									class="h-8 w-full min-w-0 rounded border bg-gray-900 px-2 text-xs text-white transition-colors focus:border-blue-500 focus:outline-none {won
										? 'border-green-500 bg-green-900/20'
										: 'border-gray-700'}"
								>
									<option value="">— empty —</option>
									<option value="BYE">Bye</option>
									{#each choicesFor(row, seatKey, named, seatedIds) as p (p.id)}
										<option value={p.id}>{optionLabel(p)}</option>
									{/each}
								</select>
							</div>
						{/each}

						<div class="flex items-center justify-center gap-1 sm:order-3">
							{#if byeTable}
								<span class="h-8 rounded bg-gray-800 px-2 text-[11px] leading-8 text-gray-400">
									{row.winner != null ? `${shortName(row.winner, players)} gets the bye` : 'Bye'}
								</span>
							{:else}
								{@const seatsSet = row.p1 !== '' && row.p2 !== ''}
								<button
									type="button"
									aria-label="Table {row.table}: {shortName(row.p1, players) || 'player 1'} wins"
									aria-pressed={typeof row.winner === 'number' && row.winner === row.p1}
									disabled={!seatsSet || busy}
									on:click={() => result(row, row.p1)}
									class="h-8 rounded px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 {typeof row.winner ===
										'number' && row.winner === row.p1
										? 'bg-green-600 text-white'
										: 'bg-gray-700 text-gray-300 hover:bg-green-600 hover:text-white'}"
								>
									◀ Wins
								</button>

								<button
									type="button"
									aria-label="Table {row.table}: {shortName(row.p2, players) || 'player 2'} wins"
									aria-pressed={typeof row.winner === 'number' && row.winner === row.p2}
									disabled={!seatsSet || busy}
									on:click={() => result(row, row.p2)}
									class="h-8 rounded px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 {typeof row.winner ===
										'number' && row.winner === row.p2
										? 'bg-green-600 text-white'
										: 'bg-gray-700 text-gray-300 hover:bg-green-600 hover:text-white'}"
								>
									Wins ▶
								</button>
								{#if row.winner != null}
									<button
										type="button"
										aria-label="Table {row.table}: clear result"
										disabled={busy}
										on:click={() => clearResult(row)}
										class="h-8 w-6 rounded text-xs text-gray-500 hover:bg-gray-700 hover:text-white"
										>✕</button
									>
								{/if}
							{/if}
						</div>

						<!-- Feature match: send this table's players to the booth -->
						{#if !byeTable}
							{@const featured = isFeaturedTable(feature, selectedRound, row.table)}
							{@const bothSeated = typeof row.p1 === 'number' && typeof row.p2 === 'number'}
							<button
								type="button"
								aria-label="Table {row.table}: {featured
									? 'on the booth as the feature match'
									: 'send to the booth as the feature match'}"
								aria-pressed={featured}
								title={featured
									? 'On the booth as the feature match'
									: 'Send both players to the booth: names, heroes and records'}
								disabled={!bothSeated || busy}
								on:click={() => featureTable(row)}
								class="h-8 rounded px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:order-5 {featured
									? 'bg-amber-500 text-gray-950'
									: 'bg-gray-700 text-gray-300 hover:bg-amber-500 hover:text-gray-950'}"
							>
								{featured ? '★ Featured' : '☆ Feature'}
							</button>
						{:else}
							<span class="sm:order-5"></span>
						{/if}
					</div>
				{/each}
			</div>
		</section>

		<!-- Standings: what the overlay shows, as the results go in -->
		<section class="rounded-lg border border-gray-800 bg-gray-900 p-3" aria-label="Standings">
			<div class="mb-2 flex items-baseline justify-between">
				<h2 class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Standings</h2>
				<span class="text-[10px] text-gray-500">
					as the overlay orders them · Top 8 fills the bracket page automatically
				</span>
			</div>
			{#if !named.length}
				<p class="py-6 text-center text-xs text-gray-500">Enter players below to see standings.</p>
			{:else}
				<ol class="space-y-0.5">
					{#each orderWithTop8(standings, top8Seeds).filter((s) => s.name) as s (s.id)}
						<li
							class="grid grid-cols-[1.5rem_1.5rem_1fr_auto] items-center gap-2 rounded px-1.5 py-1 text-xs {s.dropped
								? 'opacity-50'
								: ''} {s.rank <= 8 ? 'bg-gray-800/60' : ''}"
						>
							<span class="text-right font-mono tabular-nums text-gray-500">{s.rank}</span>
							{#if s.hero}
								<img
									src={heroImageUrl(s.hero)}
									alt=""
									class="h-6 w-6 rounded object-cover object-right"
									loading="lazy"
								/>
							{:else}
								<span class="h-6 w-6 rounded bg-gray-800"></span>
							{/if}
							<span class="min-w-0">
								<span class="block truncate font-medium text-white">
									{s.name}
									{#if top8Seeds.has(s.id)}
										<span
											class="ml-1 rounded bg-green-600/20 px-1 py-px text-[9px] font-bold uppercase tracking-wider text-green-400"
											title="Written to the Top 8 bracket"
										>
											Top 8 · {ordinal(top8Seeds.get(s.id))}
										</span>
									{/if}
								</span>
								<span class="block truncate text-[10px] text-gray-500">{s.hero || '—'}</span>
							</span>
							{#if s.dropped}
								<span class="text-[10px] font-semibold text-red-400">Dropped</span>
							{:else}
								<span
									class="font-mono tabular-nums {s.record.losses === 0
										? 'text-green-400'
										: s.record.losses === 1
											? 'text-yellow-400'
											: 'text-red-400'}">{recordString(s)}</span
								>
							{/if}
						</li>
					{/each}
				</ol>
			{/if}
		</section>
	</div>

	<!-- Players: the field, entered once -->
	<details
		class="rounded-lg border border-gray-800 bg-gray-900"
		bind:open={playersOpen}
		aria-label="Players"
	>
		<summary
			class="flex cursor-pointer select-none items-center gap-3 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500"
		>
			<span>Players</span>
			<span class="font-mono normal-case tracking-normal text-gray-400">
				{named.length} of {T.PLAYER_COUNT} entered{dropped.length
					? ` · ${dropped.length} dropped`
					: ''}
			</span>
			<span class="ml-auto text-gray-600">{playersOpen ? 'hide' : 'show'}</span>
		</summary>
		<div class="grid gap-1 px-3 pb-3 md:grid-cols-2">
			{#each players as p (p.id)}
				<div
					class="grid grid-cols-[1.5rem_1fr_auto_auto] items-center gap-1.5 rounded-lg border px-2 py-1 sm:grid-cols-[1.5rem_1fr_1fr_auto_auto] {p.dropped
						? 'border-gray-800 opacity-60'
						: p.name
							? 'border-gray-800 bg-gray-800/40'
							: 'border-dashed border-gray-800'}"
				>
					<span class="text-right text-xs font-mono text-gray-500">{p.id + 1}</span>
					<input
						type="text"
						placeholder="Player name"
						aria-label="Player {p.id + 1} name"
						value={p.name}
						disabled={busy}
						on:change={(e) => savePlayerField(p, 'name', e.target.value.trim())}
						class="h-8 min-w-0 rounded border border-gray-700 bg-gray-900 px-2 text-xs text-white placeholder-gray-600 transition-colors focus:border-blue-500 focus:outline-none sm:order-1"
					/>
					<!-- On a phone the hero field takes a second line under the name; on a wider
					     screen the five sit in one row, in the order the classes give. -->
					<span
						class="w-12 text-center font-mono text-xs tabular-nums text-gray-400 sm:order-3"
						title="Record, from the results entered">{record(p)}</span
					>
					<button
						type="button"
						aria-label="{p.dropped ? 'Restore' : 'Drop'} player {p.id + 1}"
						disabled={busy || !p.name}
						on:click={() => savePlayerField(p, 'dropped', !p.dropped)}
						class="h-7 rounded px-2 text-[10px] transition-colors disabled:opacity-30 sm:order-4 {p.dropped
							? 'bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white'
							: 'bg-gray-800 text-gray-400 hover:bg-red-600 hover:text-white'}"
					>
						{p.dropped ? 'Restore' : 'Drop'}
					</button>
					<div class="col-span-3 col-start-2 sm:order-2 sm:col-span-1 sm:col-start-auto">
						<HeroPicker
							id="hero-{p.id}"
							label="Player {p.id + 1} hero"
							value={p.hero}
							on:change={(e) => savePlayerField(p, 'hero', e.detail)}
						/>
					</div>
				</div>
			{/each}
		</div>
	</details>
</div>
