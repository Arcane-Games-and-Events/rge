<script>
	import { onMount } from 'svelte';
	import { ref, set, onValue, off, get } from 'firebase/database';
	import { db } from '../firebaseClient';
	import heroes from '$lib/data/heroes.json';
	import debounce from 'lodash.debounce';

	let players = {
		p1: {
			name: '',
			record: '',
			hero: '',
			query: '',
			isDropdownOpen: false,
			filteredHeroes: [],
			highlightedIndex: -1,
			error: null
		},
		p2: {
			name: '',
			record: '',
			hero: '',
			query: '',
			isDropdownOpen: false,
			filteredHeroes: [],
			highlightedIndex: -1,
			error: null
		}
	};

	// Table 2 players
	let players2 = {
		p1: {
			name: '',
			record: '',
			hero: '',
			query: '',
			isDropdownOpen: false,
			filteredHeroes: [],
			highlightedIndex: -1
		},
		p2: {
			name: '',
			record: '',
			hero: '',
			query: '',
			isDropdownOpen: false,
			filteredHeroes: [],
			highlightedIndex: -1
		}
	};

	let roundInfo = '';
	let tournamentStatus = '';

	function fetchData() {
		Object.keys(players).forEach((playerId) => {
			const playerRef = ref(db, `playerInfo/${playerId}`);
			onValue(playerRef, (snapshot) => {
				const data = snapshot.val() || {};
				players[playerId].name = data.name || '';
				players[playerId].record = data.record || '';
				players[playerId].hero = data.hero || '';
				players[playerId].query = data.hero || '';
			});
		});

		onValue(ref(db, 'roundInfo'), (snapshot) => {
			roundInfo = snapshot.val() ?? '';
		});
		onValue(ref(db, 'tournamentStatus'), (snapshot) => {
			tournamentStatus = snapshot.val() ?? '';
		});
	}

	function fetchData2() {
		Object.keys(players2).forEach((playerId) => {
			const playerRef = ref(db, `playerInfo2/${playerId}`);
			onValue(playerRef, (snapshot) => {
				const data = snapshot.val() || {};
				players2[playerId].name = data.name || '';
				players2[playerId].record = data.record || '';
				players2[playerId].hero = data.hero || '';
				players2[playerId].query = data.hero || '';
			});
		});
	}

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

	function handleInputChange(playerId, field, value) {
		players[playerId][field] = value;
		updateFirebase(`playerInfo/${playerId}/${field}`, value);
	}

	// Table 2 input change handler
	function handleInputChange2(playerId, field, value) {
		players2[playerId][field] = value;
		updateFirebase(`playerInfo2/${playerId}/${field}`, value);
	}

	function handleRoundChange(value) {
		roundInfo = value;
		updateFirebase('roundInfo', value);
	}

	function handleTournamentStatusChange(value) {
		tournamentStatus = value;
		updateFirebase('tournamentStatus', value);
	}

	const updateFilteredHeroes = (playerId) => {
		players[playerId].filteredHeroes =
			players[playerId].query.trim() === ''
				? []
				: heroes.filter((h) =>
						h.name.toLowerCase().includes(players[playerId].query.toLowerCase())
					);
		players[playerId].highlightedIndex = -1;
	};

	// Table 2 filtered heroes
	const updateFilteredHeroes2 = (playerId) => {
		players2[playerId].filteredHeroes =
			players2[playerId].query.trim() === ''
				? []
				: heroes.filter((h) =>
						h.name.toLowerCase().includes(players2[playerId].query.toLowerCase())
					);
		players2[playerId].highlightedIndex = -1;
	};

	const handleHeroChange = (playerId, hero) => {
		players[playerId].hero = hero.name;
		players[playerId].query = hero.name;
		players[playerId].isDropdownOpen = false;
		updateFirebase(`playerInfo/${playerId}/hero`, hero.name);
	};

	// Table 2 hero change handler
	const handleHeroChange2 = (playerId, hero) => {
		players2[playerId].hero = hero.name;
		players2[playerId].query = hero.name;
		players2[playerId].isDropdownOpen = false;
		updateFirebase(`playerInfo2/${playerId}/hero`, hero.name);
	};

	const handleKeyDown = (playerId, e) => {
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				if (players[playerId].highlightedIndex < players[playerId].filteredHeroes.length - 1) {
					players[playerId].highlightedIndex += 1;
				}
				break;
			case 'ArrowUp':
				e.preventDefault();
				if (players[playerId].highlightedIndex > 0) {
					players[playerId].highlightedIndex -= 1;
				}
				break;
			case 'Enter':
				e.preventDefault();
				const idx = players[playerId].highlightedIndex;
				if (idx >= 0 && idx < players[playerId].filteredHeroes.length) {
					handleHeroChange(playerId, players[playerId].filteredHeroes[idx]);
				}
				break;
		}
		if (players[playerId].highlightedIndex !== -1) {
			const opt = document.getElementById(
				`option-${playerId}-${players[playerId].highlightedIndex}`
			);
			opt?.scrollIntoView({ block: 'nearest' });
		}
	};

	// Table 2 key down handler
	const handleKeyDown2 = (playerId, e) => {
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				if (players2[playerId].highlightedIndex < players2[playerId].filteredHeroes.length - 1) {
					players2[playerId].highlightedIndex += 1;
				}
				break;
			case 'ArrowUp':
				e.preventDefault();
				if (players2[playerId].highlightedIndex > 0) {
					players2[playerId].highlightedIndex -= 1;
				}
				break;
			case 'Enter':
				e.preventDefault();
				const idx2 = players2[playerId].highlightedIndex;
				if (idx2 >= 0 && idx2 < players2[playerId].filteredHeroes.length) {
					handleHeroChange2(playerId, players2[playerId].filteredHeroes[idx2]);
				}
				break;
		}
		if (players2[playerId].highlightedIndex !== -1) {
			const opt = document.getElementById(
				`option-t2-${playerId}-${players2[playerId].highlightedIndex}`
			);
			opt?.scrollIntoView({ block: 'nearest' });
		}
	};

	const handleMouseEnter = (playerId, idx) => {
		players[playerId].highlightedIndex = idx;
	};

	// Table 2 mouse enter handler
	const handleMouseEnter2 = (playerId, idx) => {
		players2[playerId].highlightedIndex = idx;
	};

	const handleClickOutside = (e) => {
		if (!e.target.closest('.combobox')) {
			Object.keys(players).forEach((pid) => {
				players[pid].isDropdownOpen = false;
			});
			Object.keys(players2).forEach((pid) => {
				players2[pid].isDropdownOpen = false;
			});
		}
	};

	// Switch Table 2 players only
	async function switchPlayers2() {
		const p1Copy2 = structuredClone(players2.p1);
		const p2Copy2 = structuredClone(players2.p2);

		off(ref(db, 'playerInfo2/p1'));
		off(ref(db, 'playerInfo2/p2'));

		players2 = { p1: p2Copy2, p2: p1Copy2 };

		updateFirebaseNow(`playerInfo2/p1/name`, p2Copy2.name);
		updateFirebaseNow(`playerInfo2/p1/record`, p2Copy2.record);
		updateFirebaseNow(`playerInfo2/p1/hero`, p2Copy2.hero);

		updateFirebaseNow(`playerInfo2/p2/name`, p1Copy2.name);
		updateFirebaseNow(`playerInfo2/p2/record`, p1Copy2.record);
		updateFirebaseNow(`playerInfo2/p2/hero`, p1Copy2.hero);

		// Swap life totals - Table 2 only
		try {
			const p1Life2Snap = await get(ref(db, 'lifecounter2/p1'));
			const p2Life2Snap = await get(ref(db, 'lifecounter2/p2'));
			const p1Life2 = p1Life2Snap.val() ?? 20;
			const p2Life2 = p2Life2Snap.val() ?? 20;
			await set(ref(db, 'lifecounter2/p1'), p2Life2);
			await set(ref(db, 'lifecounter2/p2'), p1Life2);
		} catch (err) {
			console.error('Error swapping life totals for Table 2:', err);
		}

		setTimeout(fetchData2, 500);
	}

	async function switchPlayers() {
		const p1Copy = structuredClone(players.p1);
		const p2Copy = structuredClone(players.p2);

		off(ref(db, 'playerInfo/p1'));
		off(ref(db, 'playerInfo/p2'));

		players = { p1: p2Copy, p2: p1Copy };

		updateFirebaseNow(`playerInfo/p1/name`, p2Copy.name);
		updateFirebaseNow(`playerInfo/p1/record`, p2Copy.record);
		updateFirebaseNow(`playerInfo/p1/hero`, p2Copy.hero);
		updateFirebaseNow(`playerInfo/p1/query`, p2Copy.query);

		updateFirebaseNow(`playerInfo/p2/name`, p1Copy.name);
		updateFirebaseNow(`playerInfo/p2/record`, p1Copy.record);
		updateFirebaseNow(`playerInfo/p2/hero`, p1Copy.hero);
		updateFirebaseNow(`playerInfo/p2/query`, p1Copy.query);

		// Swap life totals - Table 1
		try {
			const p1LifeSnap = await get(ref(db, 'lifecounter/p1'));
			const p2LifeSnap = await get(ref(db, 'lifecounter/p2'));
			const p1Life = p1LifeSnap.val() ?? 20;
			const p2Life = p2LifeSnap.val() ?? 20;
			await set(ref(db, 'lifecounter/p1'), p2Life);
			await set(ref(db, 'lifecounter/p2'), p1Life);
		} catch (err) {
			console.error('Error swapping life totals:', err);
		}

		// Swap life totals - Table 2
		try {
			const p1Life2Snap = await get(ref(db, 'lifecounter2/p1'));
			const p2Life2Snap = await get(ref(db, 'lifecounter2/p2'));
			const p1Life2 = p1Life2Snap.val() ?? 20;
			const p2Life2 = p2Life2Snap.val() ?? 20;
			await set(ref(db, 'lifecounter2/p1'), p2Life2);
			await set(ref(db, 'lifecounter2/p2'), p1Life2);
		} catch (err) {
			console.error('Error swapping life totals for Table 2:', err);
		}

		// Swap player info - Table 2
		const p1Copy2 = structuredClone(players2.p1);
		const p2Copy2 = structuredClone(players2.p2);

		off(ref(db, 'playerInfo2/p1'));
		off(ref(db, 'playerInfo2/p2'));

		players2 = { p1: p2Copy2, p2: p1Copy2 };

		updateFirebaseNow(`playerInfo2/p1/name`, p2Copy2.name);
		updateFirebaseNow(`playerInfo2/p1/hero`, p2Copy2.hero);

		updateFirebaseNow(`playerInfo2/p2/name`, p1Copy2.name);
		updateFirebaseNow(`playerInfo2/p2/hero`, p1Copy2.hero);

		setTimeout(() => {
			fetchData();
			fetchData2();
		}, 500);
	}

	onMount(() => {
		fetchData();
		fetchData2();
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<div class="space-y-3 text-white">
	<!-- Match Info Card -->
	<div class="rounded-lg border border-gray-800 bg-gray-800/30 p-2.5">
		<div class="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2">Match Info</div>
		<div class="grid grid-cols-2 gap-1.5">
			<input
				type="text"
				placeholder="Round"
				class="w-full px-2 py-1.5 rounded border border-gray-700 bg-gray-900 text-xs text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none transition-colors"
				bind:value={roundInfo}
				on:input={(e) => handleRoundChange(e.target.value)}
			/>
			<input
				type="text"
				placeholder="Status"
				class="w-full px-2 py-1.5 rounded border border-gray-700 bg-gray-900 text-xs text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none transition-colors"
				bind:value={tournamentStatus}
				on:input={(e) => handleTournamentStatusChange(e.target.value)}
			/>
		</div>
	</div>

	<!-- Table 1 Players Section -->
	<div class="rounded-lg border border-purple-500/30 bg-gray-800/30 p-2.5">
		<div class="flex items-center justify-between mb-2">
			<div class="text-[10px] text-purple-400 uppercase tracking-wider font-medium">Table 1 Players</div>
			<button
				type="button"
				on:click={switchPlayers}
				aria-label="Switch Table 1 Players"
				class="px-2 py-0.5 rounded text-[9px] font-medium bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white transition-colors border border-purple-500/30"
			>
				Switch
			</button>
		</div>
		<div class="grid grid-cols-2 gap-2">
			<!-- Table 1 P1 -->
			<div class="space-y-1.5">
				<div class="text-[9px] text-red-400 uppercase font-medium">P1</div>
				<div class="flex items-center gap-1">
					<input
						type="text"
						placeholder="Name"
						class="flex-1 min-w-0 px-2 py-1.5 rounded border border-gray-700 bg-gray-900 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-colors"
						bind:value={players.p1.name}
						on:input={(e) => handleInputChange('p1', 'name', e.target.value)}
					/>
					<input
						type="text"
						placeholder="0-0"
						class="w-10 px-1 py-1.5 rounded border border-gray-700 bg-gray-900 text-xs text-white text-center font-mono focus:border-purple-500 focus:outline-none transition-colors"
						bind:value={players.p1.record}
						on:input={(e) => handleInputChange('p1', 'record', e.target.value)}
					/>
				</div>
				<div class="relative combobox">
					<input
						type="text"
						placeholder="Hero..."
						class="w-full px-2 py-1.5 rounded border border-gray-700 bg-gray-900 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-colors"
						role="combobox"
						aria-controls="p1-hero-list"
						aria-expanded={players.p1.isDropdownOpen}
						bind:value={players.p1.query}
						on:input={(e) => {
							players.p1.query = e.target.value;
							updateFilteredHeroes('p1');
							players.p1.isDropdownOpen = true;
						}}
						on:keydown={(e) => handleKeyDown('p1', e)}
					/>
					{#if players.p1.isDropdownOpen && players.p1.filteredHeroes.length}
						<ul
							id="p1-hero-list"
							role="listbox"
							class="absolute z-10 mt-1 max-h-32 w-full overflow-auto rounded border border-gray-700 bg-gray-900 py-1 shadow-xl"
						>
							{#each players.p1.filteredHeroes.slice(0, 8) as hero, idx}
								<li
									id={'option-p1-' + idx}
									role="option"
									aria-selected={players.p1.highlightedIndex === idx}
									class="cursor-pointer select-none py-1.5 px-2 text-xs transition-colors {players.p1.highlightedIndex === idx ? 'bg-purple-600/40 text-white' : 'text-gray-300 hover:bg-gray-800'}"
									on:mouseenter={() => handleMouseEnter('p1', idx)}
								>
									<button type="button" class="w-full text-left" on:click={() => handleHeroChange('p1', hero)}>
										{hero.name}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
			<!-- Table 1 P2 -->
			<div class="space-y-1.5">
				<div class="text-[9px] text-blue-400 uppercase font-medium">P2</div>
				<div class="flex items-center gap-1">
					<input
						type="text"
						placeholder="Name"
						class="flex-1 min-w-0 px-2 py-1.5 rounded border border-gray-700 bg-gray-900 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-colors"
						bind:value={players.p2.name}
						on:input={(e) => handleInputChange('p2', 'name', e.target.value)}
					/>
					<input
						type="text"
						placeholder="0-0"
						class="w-10 px-1 py-1.5 rounded border border-gray-700 bg-gray-900 text-xs text-white text-center font-mono focus:border-purple-500 focus:outline-none transition-colors"
						bind:value={players.p2.record}
						on:input={(e) => handleInputChange('p2', 'record', e.target.value)}
					/>
				</div>
				<div class="relative combobox">
					<input
						type="text"
						placeholder="Hero..."
						class="w-full px-2 py-1.5 rounded border border-gray-700 bg-gray-900 text-xs text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-colors"
						role="combobox"
						aria-controls="p2-hero-list"
						aria-expanded={players.p2.isDropdownOpen}
						bind:value={players.p2.query}
						on:input={(e) => {
							players.p2.query = e.target.value;
							updateFilteredHeroes('p2');
							players.p2.isDropdownOpen = true;
						}}
						on:keydown={(e) => handleKeyDown('p2', e)}
					/>
					{#if players.p2.isDropdownOpen && players.p2.filteredHeroes.length}
						<ul
							id="p2-hero-list"
							role="listbox"
							class="absolute z-10 mt-1 max-h-32 w-full overflow-auto rounded border border-gray-700 bg-gray-900 py-1 shadow-xl"
						>
							{#each players.p2.filteredHeroes.slice(0, 8) as hero, idx}
								<li
									id={'option-p2-' + idx}
									role="option"
									aria-selected={players.p2.highlightedIndex === idx}
									class="cursor-pointer select-none py-1.5 px-2 text-xs transition-colors {players.p2.highlightedIndex === idx ? 'bg-purple-600/40 text-white' : 'text-gray-300 hover:bg-gray-800'}"
									on:mouseenter={() => handleMouseEnter('p2', idx)}
								>
									<button type="button" class="w-full text-left" on:click={() => handleHeroChange('p2', hero)}>
										{hero.name}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Table 2 Section -->
	<div class="rounded-lg border border-orange-500/30 bg-gray-800/30 p-2.5">
		<div class="flex items-center justify-between mb-2">
			<div class="text-[10px] text-orange-400 uppercase tracking-wider font-medium">Table 2 Players</div>
			<button
				type="button"
				on:click={switchPlayers2}
				aria-label="Switch Table 2 Players"
				class="px-2 py-0.5 rounded text-[9px] font-medium bg-orange-600/20 text-orange-400 hover:bg-orange-600 hover:text-white transition-colors border border-orange-500/30"
			>
				Switch
			</button>
		</div>
		<div class="grid grid-cols-2 gap-2">
			<!-- Table 2 P1 -->
			<div class="space-y-1.5">
				<div class="text-[9px] text-red-400 uppercase font-medium">P1</div>
				<div class="flex items-center gap-1">
					<input
						type="text"
						placeholder="Name"
						class="flex-1 min-w-0 px-2 py-1.5 rounded border border-gray-700 bg-gray-900 text-xs text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none transition-colors"
						bind:value={players2.p1.name}
						on:input={(e) => handleInputChange2('p1', 'name', e.target.value)}
					/>
					<input
						type="text"
						placeholder="0-0"
						class="w-10 px-1 py-1.5 rounded border border-gray-700 bg-gray-900 text-xs text-white text-center font-mono focus:border-orange-500 focus:outline-none transition-colors"
						bind:value={players2.p1.record}
						on:input={(e) => handleInputChange2('p1', 'record', e.target.value)}
					/>
				</div>
				<div class="relative combobox">
					<input
						type="text"
						placeholder="Hero..."
						class="w-full px-2 py-1.5 rounded border border-gray-700 bg-gray-900 text-xs text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none transition-colors"
						role="combobox"
						aria-controls="t2-p1-hero-list"
						aria-expanded={players2.p1.isDropdownOpen}
						bind:value={players2.p1.query}
						on:input={(e) => {
							players2.p1.query = e.target.value;
							updateFilteredHeroes2('p1');
							players2.p1.isDropdownOpen = true;
						}}
						on:keydown={(e) => handleKeyDown2('p1', e)}
					/>
					{#if players2.p1.isDropdownOpen && players2.p1.filteredHeroes.length}
						<ul
							id="t2-p1-hero-list"
							role="listbox"
							class="absolute z-10 mt-1 max-h-32 w-full overflow-auto rounded border border-gray-700 bg-gray-900 py-1 shadow-xl"
						>
							{#each players2.p1.filteredHeroes.slice(0, 8) as hero, idx}
								<li
									id={'option-t2-p1-' + idx}
									role="option"
									aria-selected={players2.p1.highlightedIndex === idx}
									class="cursor-pointer select-none py-1.5 px-2 text-xs transition-colors {players2.p1.highlightedIndex === idx ? 'bg-orange-600/40 text-white' : 'text-gray-300 hover:bg-gray-800'}"
									on:mouseenter={() => handleMouseEnter2('p1', idx)}
								>
									<button type="button" class="w-full text-left" on:click={() => handleHeroChange2('p1', hero)}>
										{hero.name}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
			<!-- Table 2 P2 -->
			<div class="space-y-1.5">
				<div class="text-[9px] text-blue-400 uppercase font-medium">P2</div>
				<div class="flex items-center gap-1">
					<input
						type="text"
						placeholder="Name"
						class="flex-1 min-w-0 px-2 py-1.5 rounded border border-gray-700 bg-gray-900 text-xs text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none transition-colors"
						bind:value={players2.p2.name}
						on:input={(e) => handleInputChange2('p2', 'name', e.target.value)}
					/>
					<input
						type="text"
						placeholder="0-0"
						class="w-10 px-1 py-1.5 rounded border border-gray-700 bg-gray-900 text-xs text-white text-center font-mono focus:border-orange-500 focus:outline-none transition-colors"
						bind:value={players2.p2.record}
						on:input={(e) => handleInputChange2('p2', 'record', e.target.value)}
					/>
				</div>
				<div class="relative combobox">
					<input
						type="text"
						placeholder="Hero..."
						class="w-full px-2 py-1.5 rounded border border-gray-700 bg-gray-900 text-xs text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none transition-colors"
						role="combobox"
						aria-controls="t2-p2-hero-list"
						aria-expanded={players2.p2.isDropdownOpen}
						bind:value={players2.p2.query}
						on:input={(e) => {
							players2.p2.query = e.target.value;
							updateFilteredHeroes2('p2');
							players2.p2.isDropdownOpen = true;
						}}
						on:keydown={(e) => handleKeyDown2('p2', e)}
					/>
					{#if players2.p2.isDropdownOpen && players2.p2.filteredHeroes.length}
						<ul
							id="t2-p2-hero-list"
							role="listbox"
							class="absolute z-10 mt-1 max-h-32 w-full overflow-auto rounded border border-gray-700 bg-gray-900 py-1 shadow-xl"
						>
							{#each players2.p2.filteredHeroes.slice(0, 8) as hero, idx}
								<li
									id={'option-t2-p2-' + idx}
									role="option"
									aria-selected={players2.p2.highlightedIndex === idx}
									class="cursor-pointer select-none py-1.5 px-2 text-xs transition-colors {players2.p2.highlightedIndex === idx ? 'bg-orange-600/40 text-white' : 'text-gray-300 hover:bg-gray-800'}"
									on:mouseenter={() => handleMouseEnter2('p2', idx)}
								>
									<button type="button" class="w-full text-left" on:click={() => handleHeroChange2('p2', hero)}>
										{hero.name}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
