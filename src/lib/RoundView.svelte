<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../firebaseClient';

	const ROOT = 'tournament';

	let currentRound = 1;
	let players = {}; // { [id:number]: { id, name, hero, wins, losses, draws, dropped } }
	let pairings = []; // [{ table, p1, p2, winner }]

	let unsubPairings = null;

	// A simple tick that increments whenever /players changes.
	// We use it in {#key} blocks so Svelte re-renders seat cards
	// with the latest records instead of reusing DOM.
	let playersTick = 0;

	// --- helpers ---
	const normalize = (s = '') => s.toLowerCase().replace(/["',]/g, '').trim();

	// Exceptions: normalized hero name -> explicit filename
	const IMAGE_EXCEPTIONS = {
		'arakni huntsman': '/heroImages/arakni-huntsman1.jpg'
		// add more here if needed
	};

	const slugify = (name) =>
		(name || '')
			.toLowerCase()
			.replace(/["',]/g, '')
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.trim();

	function imgSrc(name) {
		if (!name) return '/heroImages/default.jpg';
		const key = normalize(name);
		if (key in IMAGE_EXCEPTIONS) return IMAGE_EXCEPTIONS[key];
		return `/heroImages/${slugify(name)}.jpg`;
	}

	function onImgError(e, name) {
		const key = normalize(name || '');
		if (key in IMAGE_EXCEPTIONS) {
			e.target.src = IMAGE_EXCEPTIONS[key].replace(/\.jpg$/i, '.png');
		} else {
			e.target.src = `/heroImages/${slugify(name)}.png`;
		}
	}

	const isBye = (x) => x === 'BYE';

	// record color by losses
	const recClassByLosses = (losses = 0) =>
		losses === 0 ? 'text-green-500' : losses === 1 ? 'text-yellow-500' : 'text-red-500';

	// safe player fetch
	function getPlayer(id) {
		if (id === '' || id == null) {
			return {
				id: '',
				name: '—',
				hero: '',
				wins: 0,
				losses: 0,
				draws: 0,
				dropped: false,
				isEmpty: true
			};
		}
		if (isBye(id)) {
			return {
				id: 'BYE',
				name: 'BYE',
				hero: '',
				wins: 0,
				losses: 0,
				draws: 0,
				dropped: false,
				isBye: true
			};
		}
		const pid = Number(id);
		const p = players[pid];
		if (!p)
			return {
				id: pid,
				name: `Player ${pid}`,
				hero: '',
				wins: 0,
				losses: 0,
				draws: 0,
				dropped: false
			};
		return {
			id: pid,
			name: p?.name || `Player ${pid}`,
			hero: p?.hero || '',
			wins: Number(p?.wins) || 0,
			losses: Number(p?.losses) || 0,
			draws: Number(p?.draws) || 0,
			dropped: !!p?.dropped
		};
	}

	const recText = (id) => {
		if (isBye(id)) return '—';
		const p = getPlayer(id);
		return `${p.wins}-${p.losses}-${p.draws}`;
	};
	const recLosses = (id) => (isBye(id) ? 0 : getPlayer(id).losses);

	// outline helpers (ignore BYE)
	const outlineForSeat = (m, seatId) =>
		m.winner === 'draw'
			? 'outline outline-2 outline-amber-500'
			: m.winner != null && !isBye(seatId) && Number(m.winner) === Number(seatId)
				? 'outline outline-2 outline-green-500'
				: '';

	// --- Firebase wiring ---
	function attachPairingsListener(round) {
		unsubPairings?.();
		unsubPairings = onValue(ref(db, `${ROOT}/rounds/${round}/pairings`), (snap) => {
			const v = snap.val() || {};
			const arr = Object.values(v).map((m) => ({
				table: Number(m?.table) || 0,
				p1: m?.p1 === 'BYE' ? 'BYE' : m?.p1 === 0 || m?.p1 ? Number(m.p1) : '',
				p2: m?.p2 === 'BYE' ? 'BYE' : m?.p2 === 0 || m?.p2 ? Number(m.p2) : '',
				winner:
					m?.winner === 'draw' ? 'draw' : m?.winner === 0 || m?.winner ? Number(m.winner) : null
			}));
			pairings = arr.sort((a, b) => a.table - b.table);
		});
	}

	onMount(() => {
		// current round
		const unsub1 = onValue(ref(db, `${ROOT}/currentRound`), (s) => {
			currentRound = s.val() || 1;
			attachPairingsListener(currentRound);
		});

		// players (records come directly from here)
		const unsub2 = onValue(ref(db, `${ROOT}/players`), (snap) => {
			const v = snap.val() || {};
			players = Object.fromEntries(
				Object.entries(v).map(([id, p]) => [
					Number(id),
					{
						id: Number(id),
						name: p?.name || '',
						hero: p?.hero || '',
						wins: Number(p?.wins) || 0,
						losses: Number(p?.losses) || 0,
						draws: Number(p?.draws) || 0,
						dropped: !!p?.dropped
					}
				])
			);
			// force re-render of seat cards with fresh records
			playersTick += 1;
		});

		// if the rounds subtree changes, keep the pairings listener on the correct node
		const unsub3 = onValue(ref(db, `${ROOT}/rounds`), () => {
			attachPairingsListener(currentRound);
		});

		return () => {
			unsub1?.();
			unsub2?.();
			unsub3?.();
			unsubPairings?.();
		};
	});

	// split tables: left = first half, right = second half
	$: tablesSorted = [...pairings].sort((a, b) => a.table - b.table);
	$: half = Math.ceil(tablesSorted.length / 2);
	$: leftTables = tablesSorted.slice(0, half);
	$: rightTables = tablesSorted.slice(half);
</script>

<div class="min-h-screen text-white p-4 sm:p-6">
	<!-- Header -->
	<div class="flex flex-wrap items-center gap-3 mb-4">
		<h1 class="text-7xl font-bold">Round {currentRound}</h1>
	</div>

	<!-- Two fixed columns -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-10">
		<!-- Left column -->
		<div class="space-y-2 py-8 max-w-md">
			{#each leftTables as m (m.table)}
				<div class="relative pl-5">
					<div class="mb-2">
						<span
							class="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-gray-800/80 ring-1 ring-white/10 text-xs text-gray-200"
						>
							Table {m.table}
						</span>
					</div>
					<div class="pointer-events-none absolute left-1 top-9 bottom-4 w-px bg-yellow-500"></div>

					<div class="space-y-3">
						{#key `L-${m.table}-p1-${m.p1}-${playersTick}-${m.winner ?? 'x'}`}
							<!-- P1 card -->
							<div
								class={`bg-gray-900/60 rounded-lg p-2 ${!isBye(m.p1) && getPlayer(m.p1).dropped ? 'opacity-70' : ''} ${outlineForSeat(m, m.p1)}`}
							>
								<div class="grid items-center gap-3 grid-cols-[auto_1fr]">
									<!-- avatar -->
									<div class="h-14 w-14 overflow-hidden rounded-lg bg-gray-800">
										{#if !isBye(m.p1) && getPlayer(m.p1).hero}
											<img
												src={imgSrc(getPlayer(m.p1).hero)}
												alt={getPlayer(m.p1).hero}
												class="h-14 w-14 object-cover object-right"
												on:error={(e) => onImgError(e, getPlayer(m.p1).hero)}
											/>
										{/if}
									</div>
									<!-- text -->
									<div class="min-w-0 leading-tight">
										<div class="truncate text-base sm:text-xl font-semibold">
											{#if isBye(m.p1)}BYE{:else}{getPlayer(m.p1).name}{/if}
										</div>
										<div class="mt-0.5 text-sm flex items-center gap-2 leading-tight">
											{#if isBye(m.p1) || getPlayer(m.p1).isEmpty}
												<span class="text-gray-400">—</span>
											{:else if getPlayer(m.p1).dropped}
												<span class="font-bold text-red-500">Dropped</span>
											{:else}
												<span class={`font-bold ${recClassByLosses(recLosses(m.p1))}`}
													>{recText(m.p1)}</span
												>
												<span class="text-white">•</span>
												<span class="truncate text-white">{getPlayer(m.p1).hero || '—'}</span>
											{/if}
										</div>
									</div>
								</div>
							</div>
						{/key}

						{#key `L-${m.table}-p2-${m.p2}-${playersTick}-${m.winner ?? 'x'}`}
							<!-- P2 card -->
							<div
								class={`bg-gray-900/60 rounded-lg p-2 ${!isBye(m.p2) && getPlayer(m.p2).dropped ? 'opacity-70' : ''} ${outlineForSeat(m, m.p2)}`}
							>
								<div class="grid items-center gap-3 grid-cols-[auto_1fr]">
									<div class="h-14 w-14 overflow-hidden rounded-lg bg-gray-800">
										{#if !isBye(m.p2) && getPlayer(m.p2).hero}
											<img
												src={imgSrc(getPlayer(m.p2).hero)}
												alt={getPlayer(m.p2).hero}
												class="h-14 w-14 object-cover object-right"
												on:error={(e) => onImgError(e, getPlayer(m.p2).hero)}
											/>
										{/if}
									</div>
									<div class="min-w-0 leading-tight">
										<div class="truncate text-base sm:text-xl font-semibold">
											{#if isBye(m.p2)}BYE{:else}{getPlayer(m.p2).name}{/if}
										</div>
										<div class="mt-0.5 text-sm flex items-center gap-2 leading-tight">
											{#if isBye(m.p2) || getPlayer(m.p2).isEmpty}
												<span class="text-gray-400">—</span>
											{:else if getPlayer(m.p2).dropped}
												<span class="font-bold text-red-500">Dropped</span>
											{:else}
												<span class={`font-bold ${recClassByLosses(recLosses(m.p2))}`}
													>{recText(m.p2)}</span
												>
												<span class="text-white">•</span>
												<span class="truncate text-white">{getPlayer(m.p2).hero || '—'}</span>
											{/if}
										</div>
									</div>
								</div>
							</div>
						{/key}
					</div>
					<!-- /seats -->
				</div>
			{/each}
		</div>

		<!-- Right column (mirrored) -->
		<div class="space-y-2 py-8 max-w-md">
			{#each rightTables as m (m.table)}
				<div class="relative pr-5">
					<div class="mb-2 flex justify-end">
						<span
							class="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-gray-800/80 ring-1 ring-white/10 text-xs text-gray-200"
						>
							Table {m.table}
						</span>
					</div>
					<div class="pointer-events-none absolute right-1 top-9 bottom-4 w-px bg-yellow-500"></div>

					<div class="space-y-3">
						{#key `R-${m.table}-p1-${m.p1}-${playersTick}-${m.winner ?? 'x'}`}
							<!-- P1 mirrored -->
							<div
								class={`bg-gray-900/60 rounded-lg p-2 ${!isBye(m.p1) && getPlayer(m.p1).dropped ? 'opacity-70' : ''} ${outlineForSeat(m, m.p1)}`}
							>
								<div class="grid items-center gap-3 grid-cols-[1fr_auto]">
									<div class="min-w-0 leading-tight text-right">
										<div class="truncate text-base sm:text-xl font-semibold">
											{#if isBye(m.p1)}BYE{:else}{getPlayer(m.p1).name}{/if}
										</div>
										<div class="mt-0.5 text-sm flex items-center justify-end gap-2 leading-tight">
											{#if isBye(m.p1) || getPlayer(m.p1).isEmpty}
												<span class="text-gray-400">—</span>
											{:else if getPlayer(m.p1).dropped}
												<span class="font-bold text-red-500">Dropped</span>
											{:else}
												<span class={`font-bold ${recClassByLosses(recLosses(m.p1))}`}
													>{recText(m.p1)}</span
												>
												<span class="text-white">•</span>
												<span class="truncate text-white">{getPlayer(m.p1).hero || '—'}</span>
											{/if}
										</div>
									</div>
									<div class="h-14 w-14 overflow-hidden rounded-lg bg-gray-800">
										{#if !isBye(m.p1) && getPlayer(m.p1).hero}
											<img
												src={imgSrc(getPlayer(m.p1).hero)}
												alt={getPlayer(m.p1).hero}
												class="h-14 w-14 object-cover object-right"
												on:error={(e) => onImgError(e, getPlayer(m.p1).hero)}
											/>
										{/if}
									</div>
								</div>
							</div>
						{/key}

						{#key `R-${m.table}-p2-${m.p2}-${playersTick}-${m.winner ?? 'x'}`}
							<!-- P2 mirrored -->
							<div
								class={`bg-gray-900/60 rounded-lg p-2 ${!isBye(m.p2) && getPlayer(m.p2).dropped ? 'opacity-70' : ''} ${outlineForSeat(m, m.p2)}`}
							>
								<div class="grid items-center gap-3 grid-cols-[1fr_auto]">
									<div class="min-w-0 leading-tight text-right">
										<div class="truncate text-base sm:text-xl font-semibold">
											{#if isBye(m.p2)}BYE{:else}{getPlayer(m.p2).name}{/if}
										</div>
										<div class="mt-0.5 text-sm flex items-center justify-end gap-2 leading-tight">
											{#if isBye(m.p2) || getPlayer(m.p2).isEmpty}
												<span class="text-gray-400">—</span>
											{:else if getPlayer(m.p2).dropped}
												<span class="font-bold text-red-500">Dropped</span>
											{:else}
												<span class={`font-bold ${recClassByLosses(recLosses(m.p2))}`}
													>{recText(m.p2)}</span
												>
												<span class="text-white">•</span>
												<span class="truncate text-white">{getPlayer(m.p2).hero || '—'}</span>
											{/if}
										</div>
									</div>
									<div class="h-14 w-14 overflow-hidden rounded-lg bg-gray-800">
										{#if !isBye(m.p2) && getPlayer(m.p2).hero}
											<img
												src={imgSrc(getPlayer(m.p2).hero)}
												alt={getPlayer(m.p2).hero}
												class="h-14 w-14 object-cover object-right"
												on:error={(e) => onImgError(e, getPlayer(m.p2).hero)}
											/>
										{/if}
									</div>
								</div>
							</div>
						{/key}
					</div>
					<!-- /seats -->
				</div>
			{/each}
		</div>
	</div>
</div>
