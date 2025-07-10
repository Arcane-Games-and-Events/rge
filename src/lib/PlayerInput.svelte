<script>
	import { onMount } from 'svelte';
	import { ref, set, onValue, off } from 'firebase/database';
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

	let roundInfo = '';
	let tournamentStatus = '';

	function fetchData() {
		Object.keys(players).forEach((playerId) => {
			const playerRef = ref(db, `playerInfo/${playerId}`);
			onValue(playerRef, (snapshot) => {
				const data = snapshot.val();
				if (data) {
					players[playerId].name = data.name || '';
					players[playerId].record = data.record || '';
					players[playerId].hero = data.hero || '';
					players[playerId].query = data.hero || '';
				}
			});
		});

		onValue(ref(db, 'roundInfo'), (snapshot) => {
			roundInfo = snapshot.val() ?? '';
		});

		onValue(ref(db, 'tournamentStatus'), (snapshot) => {
			tournamentStatus = snapshot.val() ?? '';
		});
	}

	// Debounced for normal input
	const updateFirebase = debounce(async (path, value) => {
		try {
			await set(ref(db, path), value);
		} catch (err) {
			console.error(`Error saving ${path}:`, err);
		}
	}, 300);

	// Immediate updates (for switch)
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

	const handleHeroChange = (playerId, hero) => {
		players[playerId].hero = hero.name;
		players[playerId].query = hero.name;
		players[playerId].isDropdownOpen = false;
		updateFirebase(`playerInfo/${playerId}/hero`, hero.name);
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

	const handleMouseEnter = (playerId, idx) => {
		players[playerId].highlightedIndex = idx;
	};

	const handleClickOutside = (e) => {
		if (!e.target.closest('.combobox')) {
			Object.keys(players).forEach((pid) => (players[pid].isDropdownOpen = false));
		}
	};

	function switchPlayers() {
		const p1Copy = structuredClone(players.p1);
		const p2Copy = structuredClone(players.p2);

		// detach listeners
		off(ref(db, 'playerInfo/p1'));
		off(ref(db, 'playerInfo/p2'));

		// swap local state
		players = { p1: p2Copy, p2: p1Copy };

		// immediate DB writes
		updateFirebaseNow(`playerInfo/p1/name`, p2Copy.name);
		updateFirebaseNow(`playerInfo/p1/record`, p2Copy.record);
		updateFirebaseNow(`playerInfo/p1/hero`, p2Copy.hero);
		updateFirebaseNow(`playerInfo/p1/query`, p2Copy.query);

		updateFirebaseNow(`playerInfo/p2/name`, p1Copy.name);
		updateFirebaseNow(`playerInfo/p2/record`, p1Copy.record);
		updateFirebaseNow(`playerInfo/p2/hero`, p1Copy.hero);
		updateFirebaseNow(`playerInfo/p2/query`, p1Copy.query);

		// re-attach listeners
		setTimeout(fetchData, 500);
	}

	onMount(() => {
		fetchData();
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<div class="w-full mt-4 sm:mt-0 border border-gray-500 text-white rounded-lg">
	<!-- PLAYER 1 -->
	<div class="p-4">
		<h2 class="text-lg font-medium mb-2">Player 1</h2>

		<div class="flex space-x-4">
			<div class="w-2/3">
				<label class="block text-sm font-medium">Name</label>
				<input
					type="text"
					class="mt-2 w-full rounded-md bg-gray-800 py-3 px-3 ring-1 ring-inset ring-gray-300"
					bind:value={players.p1.name}
					on:input={(e) => handleInputChange('p1', 'name', e.target.value)}
				/>
			</div>
			<div class="w-1/3">
				<label class="block text-sm font-medium">Record</label>
				<input
					type="text"
					class="mt-2 w-full rounded-md bg-gray-800 py-3 px-3 ring-1 ring-inset ring-gray-300"
					bind:value={players.p1.record}
					on:input={(e) => handleInputChange('p1', 'record', e.target.value)}
				/>
			</div>
		</div>

		<label class="block text-sm font-medium mt-4">Hero</label>
		<div class="relative mt-2 combobox">
			<input
				type="text"
				class="w-full rounded-md bg-gray-800 py-3 px-3 ring-1 ring-inset ring-gray-300"
				role="combobox"
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
					class="absolute z-10 mt-1 max-h-60 w-full overflow-auto bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5"
				>
					{#each players.p1.filteredHeroes.slice(0, 20) as hero, idx}
						<li
							id={'option-p1-' + idx}
							class="cursor-default select-none py-2 px-3 {players.p1.highlightedIndex === idx
								? 'bg-indigo-600'
								: ''}"
							on:mouseenter={() => handleMouseEnter('p1', idx)}
						>
							<button
								type="button"
								class="w-full text-left"
								on:click={() => handleHeroChange('p1', hero)}
							>
								{hero.name}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>

	<!-- SWITCH ICON BUTTON -->
	<div class="flex justify-center py-2">
		<button
			on:click={switchPlayers}
			aria-label="Switch Players"
			class="p-2 rounded hover:bg-gray-700 focus:outline-none"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6 text-white"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<!-- up arrow -->
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 4v16m0 0l-4-4m4 4l4-4"
				/>
				<!-- down arrow -->
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 20V4m0 0l4 4m-4-4l-4 4"
				/>
			</svg>
		</button>
	</div>

	<!-- PLAYER 2 -->
	<div class="p-4">
		<h2 class="text-lg font-medium mb-2">Player 2</h2>

		<div class="flex space-x-4">
			<div class="w-2/3">
				<label class="block text-sm font-medium">Name</label>
				<input
					type="text"
					class="mt-2 w-full rounded-md bg-gray-800 py-3 px-3 ring-1 ring-inset ring-gray-300"
					bind:value={players.p2.name}
					on:input={(e) => handleInputChange('p2', 'name', e.target.value)}
				/>
			</div>
			<div class="w-1/3">
				<label class="block text-sm font-medium">Record</label>
				<input
					type="text"
					class="mt-2 w-full rounded-md bg-gray-800 py-3 px-3 ring-1 ring-inset ring-gray-300"
					bind:value={players.p2.record}
					on:input={(e) => handleInputChange('p2', 'record', e.target.value)}
				/>
			</div>
		</div>

		<label class="block text-sm font-medium mt-4">Hero</label>
		<div class="relative mt-2 combobox">
			<input
				type="text"
				class="w-full rounded-md bg-gray-800 py-3 px-3 ring-1 ring-inset ring-gray-300"
				role="combobox"
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
					class="absolute z-10 mt-1 max-h-60 w-full overflow-auto bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5"
				>
					{#each players.p2.filteredHeroes.slice(0, 20) as hero, idx}
						<li
							id={'option-p2-' + idx}
							class="cursor-default select-none py-2 px-3 {players.p2.highlightedIndex === idx
								? 'bg-indigo-600'
								: ''}"
							on:mouseenter={() => handleMouseEnter('p2', idx)}
						>
							<button
								type="button"
								class="w-full text-left"
								on:click={() => handleHeroChange('p2', hero)}
							>
								{hero.name}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>

	<!-- ROUND INFO & STATUS -->
	<div class="p-4 border-t border-gray-600">
		<h2 class="text-lg font-medium mb-2">Round Information</h2>
		<label class="block text-sm font-medium">Round</label>
		<input
			type="text"
			placeholder="Round 1 of 6"
			class="mt-2 w-full rounded-md bg-gray-800 py-3 px-3 ring-1 ring-inset ring-gray-300"
			bind:value={roundInfo}
			on:input={(e) => handleRoundChange(e.target.value)}
		/>

		<h2 class="text-lg font-medium mt-4 mb-2">Tournament Status</h2>
		<label class="block text-sm font-medium">Status</label>
		<input
			type="text"
			placeholder="In Progress"
			class="mt-2 w-full rounded-md bg-gray-800 py-3 px-3 ring-1 ring-inset ring-gray-300"
			bind:value={tournamentStatus}
			on:input={(e) => handleTournamentStatusChange(e.target.value)}
		/>
	</div>
</div>
