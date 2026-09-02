<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, set, onValue, off, get } from 'firebase/database';
	import { db } from '../firebaseClient';
	import { heroes, loadHeroes } from '$lib/heroes';
	import { startSignalPayload, startSignalRemainingMs } from '$lib/startSignal';
	import debounce from 'lodash.debounce';

	// Everything for one table in one card: its two players, their life totals,
	// and the signals sent to that table's screen.
	export let index = 1;

	const isTableOne = index === 1;

	// Table 1 predates Table 2 and kept the original paths, so the two are not
	// a simple suffix apart.
	const playerPath = isTableOne ? 'playerInfo' : 'playerInfo2';
	const lifePath = isTableOne ? 'lifecounter' : 'lifecounter2';
	const startSignalPath = isTableOne ? 'timers/Round/startSignal' : 'signals/table2/startSignal';
	const customSignalPath = isTableOne ? 'timers/Round/customSignal' : 'signals/table2/customSignal';

	// Spelled out in full so the CSS purge pass keeps them.
	const accent = isTableOne
		? {
				border: 'border-purple-500/30',
				label: 'text-purple-400',
				focus: 'focus:border-purple-500',
				chip: 'bg-purple-600/20 text-purple-400 border-purple-500/30 hover:bg-purple-600 hover:text-white',
				option: 'bg-purple-600/40',
				send: 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600',
				dismiss: 'bg-red-500 hover:bg-red-400'
			}
		: {
				border: 'border-orange-500/30',
				label: 'text-orange-400',
				focus: 'focus:border-orange-500',
				chip: 'bg-orange-600/20 text-orange-400 border-orange-500/30 hover:bg-orange-600 hover:text-white',
				option: 'bg-orange-600/40',
				send: 'bg-gradient-to-r from-orange-600 to-amber-700 hover:from-orange-500 hover:to-amber-600',
				dismiss: 'bg-orange-500 hover:bg-orange-400'
			};

	const seats = [
		{ id: 'p1', label: 'P1', accent: 'text-red-400' },
		{ id: 'p2', label: 'P2', accent: 'text-blue-400' }
	];

	const blankSeat = () => ({
		name: '',
		record: '',
		hero: '',
		query: '',
		isDropdownOpen: false,
		filteredHeroes: [],
		highlightedIndex: -1
	});

	let players = { p1: blankSeat(), p2: blankSeat() };
	let life = { p1: 20, p2: 20 };
	let startActive = false;
	let customActive = false;
	let customText = '';
	let startSignalTimer = null;

	const updateFirebase = debounce(async (path, value) => {
		try {
			await set(ref(db, path), value);
		} catch (err) {
			console.error(`Error saving ${path}:`, err);
		}
	}, 300);

	function updateFirebaseNow(path, value) {
		try {
			set(ref(db, path), value);
		} catch (err) {
			console.error(`Error saving ${path}:`, err);
		}
	}

	function subscribePlayers() {
		for (const seat of seats) {
			onValue(ref(db, `${playerPath}/${seat.id}`), (snap) => {
				const data = snap.val() || {};
				players[seat.id].name = data.name || '';
				players[seat.id].record = data.record || '';
				players[seat.id].hero = data.hero || '';
				players[seat.id].query = data.hero || '';
			});
		}
	}

	const handleInputChange = (seatId, field, value) => {
		players[seatId][field] = value;
		updateFirebase(`${playerPath}/${seatId}/${field}`, value);
	};

	const updateFilteredHeroes = (seatId) => {
		const q = players[seatId].query.trim().toLowerCase();
		players[seatId].filteredHeroes = q
			? $heroes.filter((h) => h.name.toLowerCase().includes(q))
			: [];
		players[seatId].highlightedIndex = -1;
	};

	const handleHeroChange = (seatId, hero) => {
		players[seatId].hero = hero.name;
		players[seatId].query = hero.name;
		players[seatId].isDropdownOpen = false;
		updateFirebase(`${playerPath}/${seatId}/hero`, hero.name);
	};

	const handleKeyDown = (seatId, e) => {
		const seat = players[seatId];
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				if (seat.highlightedIndex < seat.filteredHeroes.length - 1) seat.highlightedIndex += 1;
				break;
			case 'ArrowUp':
				e.preventDefault();
				if (seat.highlightedIndex > 0) seat.highlightedIndex -= 1;
				break;
			case 'Enter':
				e.preventDefault();
				if (seat.highlightedIndex >= 0 && seat.highlightedIndex < seat.filteredHeroes.length) {
					handleHeroChange(seatId, seat.filteredHeroes[seat.highlightedIndex]);
				}
				break;
			case 'Escape':
				seat.isDropdownOpen = false;
				break;
			default:
				return;
		}
		if (seat.highlightedIndex !== -1) {
			document
				.getElementById(`t${index}-${seatId}-opt-${seat.highlightedIndex}`)
				?.scrollIntoView({ block: 'nearest' });
		}
	};

	// Swaps this table's seats only. The old Table 1 control also swapped
	// Table 2, which left the other table's graphics wrong.
	async function switchPlayers() {
		const p1Copy = structuredClone(players.p1);
		const p2Copy = structuredClone(players.p2);

		off(ref(db, `${playerPath}/p1`));
		off(ref(db, `${playerPath}/p2`));
		players = { p1: p2Copy, p2: p1Copy };

		for (const field of ['name', 'record', 'hero']) {
			updateFirebaseNow(`${playerPath}/p1/${field}`, p2Copy[field]);
			updateFirebaseNow(`${playerPath}/p2/${field}`, p1Copy[field]);
		}

		try {
			const p1Life = (await get(ref(db, `${lifePath}/p1`))).val() ?? 20;
			const p2Life = (await get(ref(db, `${lifePath}/p2`))).val() ?? 20;
			await set(ref(db, `${lifePath}/p1`), p2Life);
			await set(ref(db, `${lifePath}/p2`), p1Life);
		} catch (err) {
			console.error(`Error swapping life totals for table ${index}:`, err);
		}

		setTimeout(subscribePlayers, 500);
	}

	const adjustLife = async (seatId, delta) => {
		life[seatId] += delta;
		await set(ref(db, `${lifePath}/${seatId}`), life[seatId]);
	};

	const resetLife = async (total) => {
		life = { p1: total, p2: total };
		await set(ref(db, `${lifePath}/p1`), total);
		await set(ref(db, `${lifePath}/p2`), total);
	};

	const triggerStartSignal = () => set(ref(db, startSignalPath), startSignalPayload());

	const triggerCustomSignal = async () => {
		const text = customText.trim();
		if (!text) return;
		customActive = true;
		await set(ref(db, customSignalPath), { active: true, text });
	};

	const dismissCustomSignal = async () => {
		customActive = false;
		await set(ref(db, customSignalPath), { active: false, text: '' });
	};

	const handleClickOutside = (e) => {
		if (!e.target.closest(`.combobox-t${index}`)) {
			for (const seat of seats) players[seat.id].isDropdownOpen = false;
		}
	};

	onMount(() => {
		loadHeroes();
		subscribePlayers();

		for (const seat of seats) {
			onValue(ref(db, `${lifePath}/${seat.id}`), (snap) => {
				if (snap.val() !== null) life[seat.id] = snap.val();
			});
		}

		onValue(ref(db, startSignalPath), (snap) => {
			clearTimeout(startSignalTimer);
			const remaining = startSignalRemainingMs(snap.val());
			startActive = remaining > 0;
			if (remaining > 0) startSignalTimer = setTimeout(() => (startActive = false), remaining);
		});

		onValue(ref(db, customSignalPath), (snap) => {
			const data = snap.val();
			customActive = data?.active ?? false;
			if (data?.text !== undefined) customText = data.text ?? '';
		});

		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});

	onDestroy(() => clearTimeout(startSignalTimer));
</script>

<section class="rounded-lg border {accent.border} bg-gray-900 p-2">
	<header class="mb-1.5 flex items-center justify-between gap-2">
		<h2 class="text-[10px] font-semibold uppercase tracking-wider {accent.label}">Table {index}</h2>
		<div class="flex items-center gap-1">
			<button
				type="button"
				on:click={switchPlayers}
				aria-label="Swap Table {index} players"
				class="h-7 rounded border px-2 text-[10px] font-medium transition-colors {accent.chip}"
			>
				Swap
			</button>
			<button
				type="button"
				on:click={() => resetLife(20)}
				class="h-7 rounded bg-gray-800 px-2 text-[10px] text-gray-300 transition-colors hover:bg-gray-700"
				>20</button
			>
			<button
				type="button"
				on:click={() => resetLife(40)}
				class="h-7 rounded bg-gray-800 px-2 text-[10px] text-gray-300 transition-colors hover:bg-gray-700"
				>40</button
			>
		</div>
	</header>

	<div class="grid gap-1.5 sm:grid-cols-2">
		{#each seats as seat (seat.id)}
			<div class="space-y-1 rounded bg-gray-800/40 p-1.5">
				<!-- Seat label, life and its buttons on one line: the total is never
				     far from the control that changes it. -->
				<div class="flex items-center gap-1.5 rounded bg-gray-900/70 px-1.5 py-1">
					<span class="w-4 flex-none text-[10px] font-semibold uppercase {seat.accent}">
						{seat.label}
					</span>
					<button
						type="button"
						aria-label="{seat.label} life down"
						on:click={() => adjustLife(seat.id, -1)}
						class="h-9 w-9 flex-none rounded bg-red-600/20 text-xl font-bold leading-none text-red-400 transition-colors hover:bg-red-600 hover:text-white active:bg-red-700"
						>−</button
					>
					<span
						class="flex-1 text-center font-mono text-3xl font-bold tabular-nums leading-none"
						aria-live="polite"
						aria-label="{seat.label} life total"
					>
						{life[seat.id]}
					</span>
					<button
						type="button"
						aria-label="{seat.label} life up"
						on:click={() => adjustLife(seat.id, 1)}
						class="h-9 w-9 flex-none rounded bg-green-600/20 text-xl font-bold leading-none text-green-400 transition-colors hover:bg-green-600 hover:text-white active:bg-green-700"
						>+</button
					>
				</div>

				<div class="flex items-center gap-1">
					<input
						type="text"
						placeholder="Name"
						class="h-9 min-w-0 flex-1 rounded border border-gray-700 bg-gray-900 px-1.5 text-sm text-white placeholder-gray-500 transition-colors focus:outline-none {accent.focus}"
						bind:value={players[seat.id].name}
						on:input={(e) => handleInputChange(seat.id, 'name', e.target.value)}
					/>
					<input
						type="text"
						placeholder="0-0"
						aria-label="{seat.label} record"
						class="h-9 w-12 flex-none rounded border border-gray-700 bg-gray-900 px-1 text-center font-mono text-xs text-white transition-colors focus:outline-none {accent.focus}"
						bind:value={players[seat.id].record}
						on:input={(e) => handleInputChange(seat.id, 'record', e.target.value)}
					/>
				</div>

				<div class="relative combobox-t{index}">
					<input
						type="text"
						placeholder="Hero..."
						class="h-9 w-full rounded border border-gray-700 bg-gray-900 px-1.5 text-sm text-white placeholder-gray-500 transition-colors focus:outline-none {accent.focus}"
						role="combobox"
						aria-controls="t{index}-{seat.id}-hero-list"
						aria-expanded={players[seat.id].isDropdownOpen}
						autocomplete="off"
						bind:value={players[seat.id].query}
						on:input={(e) => {
							players[seat.id].query = e.target.value;
							updateFilteredHeroes(seat.id);
							players[seat.id].isDropdownOpen = true;
						}}
						on:keydown={(e) => handleKeyDown(seat.id, e)}
					/>
					{#if players[seat.id].isDropdownOpen && players[seat.id].filteredHeroes.length}
						<ul
							id="t{index}-{seat.id}-hero-list"
							role="listbox"
							class="absolute z-20 mt-1 max-h-44 w-full overflow-auto rounded border border-gray-700 bg-gray-900 py-0.5 shadow-xl"
						>
							{#each players[seat.id].filteredHeroes.slice(0, 8) as hero, idx (hero.name)}
								<li
									id="t{index}-{seat.id}-opt-{idx}"
									role="option"
									aria-selected={players[seat.id].highlightedIndex === idx}
									class={players[seat.id].highlightedIndex === idx
										? accent.option
										: 'hover:bg-gray-800'}
									on:mouseenter={() => (players[seat.id].highlightedIndex = idx)}
								>
									<button
										type="button"
										class="flex h-9 w-full items-center gap-1.5 px-1.5 text-left text-xs text-gray-200"
										on:click={() => handleHeroChange(seat.id, hero)}
									>
										{#if hero.image}
											<img
												src={hero.image}
												alt=""
												class="h-5 w-5 flex-none rounded object-cover"
												loading="lazy"
											/>
										{:else}
											<span
												class="flex h-5 w-5 flex-none items-center justify-center rounded bg-gray-700 text-[9px] font-bold text-gray-400"
											>
												{hero.name.charAt(0)}
											</span>
										{/if}
										<span class="truncate">{hero.name}</span>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Signals share one row so they cost a single line -->
	<div class="mt-1.5 flex flex-wrap items-center gap-1 border-t border-gray-800 pt-1.5">
		<button
			type="button"
			on:click={triggerStartSignal}
			disabled={startActive}
			class="h-9 flex-none rounded px-2.5 text-xs font-bold transition-all {startActive
				? 'animate-pulse cursor-not-allowed bg-green-500 text-white'
				: 'bg-gradient-to-r from-green-600 to-emerald-700 text-white hover:from-green-500 hover:to-emerald-600'}"
		>
			{startActive ? 'Active…' : 'Start'}
		</button>
		<input
			type="text"
			bind:value={customText}
			on:keydown={(e) => e.key === 'Enter' && triggerCustomSignal()}
			placeholder="Custom message…"
			disabled={customActive}
			class="h-9 min-w-0 flex-1 rounded border border-gray-700 bg-gray-800 px-1.5 text-xs transition-colors focus:outline-none disabled:opacity-50 {accent.focus}"
		/>
		{#if customActive}
			<button
				type="button"
				on:click={dismissCustomSignal}
				class="h-9 flex-none animate-pulse rounded px-2.5 text-xs font-bold text-white transition-colors {accent.dismiss}"
			>
				Dismiss
			</button>
		{:else}
			<button
				type="button"
				on:click={triggerCustomSignal}
				disabled={!customText.trim()}
				class="h-9 flex-none rounded px-2.5 text-xs font-bold transition-colors {customText.trim()
					? `${accent.send} text-white`
					: 'cursor-not-allowed bg-gray-800 text-gray-500'}"
			>
				Send
			</button>
		{/if}
	</div>
</section>
