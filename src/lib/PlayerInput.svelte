<script>
	import { onMount } from 'svelte';
	import { ref, set, onValue } from 'firebase/database';
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

	let roundInfo = ''; // Holds the round information
	let tournamentStatus = ''; // Holds the tournament status information

	// Function to fetch initial data from Firebase
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

		// Fetch round info from Firebase
		const roundInfoRef = ref(db, 'roundInfo');
		onValue(roundInfoRef, (snapshot) => {
			const data = snapshot.val();
			if (data !== null) {
				roundInfo = data;
			}
		});

		// Fetch tournament status from Firebase
		const tournamentStatusRef = ref(db, 'tournamentStatus');
		onValue(tournamentStatusRef, (snapshot) => {
			const data = snapshot.val();
			if (data !== null) {
				tournamentStatus = data;
			}
		});
	}

	// Debounced function to update Firebase [Prevents input lag and flickering]
	const updateFirebase = debounce(async (path, value) => {
		try {
			await set(ref(db, path), value);
		} catch (err) {
			console.error(`Error saving ${path} to Firebase:`, err);
		}
	}, 300);

	// Handle input changes
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
				: heroes.filter((hero) =>
						hero.name.toLowerCase().includes(players[playerId].query.toLowerCase())
					);
		players[playerId].highlightedIndex = -1;
	};

	const handleHeroChange = async (playerId, hero) => {
		players[playerId].hero = hero.name;
		players[playerId].isDropdownOpen = false;
		players[playerId].query = hero.name;
		updateFirebase(`playerInfo/${playerId}/hero`, hero.name);
	};

	const handleKeyDown = (playerId, event) => {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				if (players[playerId].highlightedIndex < players[playerId].filteredHeroes.length - 1) {
					players[playerId].highlightedIndex += 1;
				}
				break;
			case 'ArrowUp':
				event.preventDefault();
				if (players[playerId].highlightedIndex > 0) {
					players[playerId].highlightedIndex -= 1;
				}
				break;
			case 'Enter':
				event.preventDefault();
				if (
					players[playerId].highlightedIndex >= 0 &&
					players[playerId].highlightedIndex < players[playerId].filteredHeroes.length
				) {
					handleHeroChange(
						playerId,
						players[playerId].filteredHeroes[players[playerId].highlightedIndex]
					);
				}
				break;
			default:
				break;
		}

		if (players[playerId].highlightedIndex !== -1) {
			const option = document.getElementById(
				`option-${playerId}-${players[playerId].highlightedIndex}`
			);
			if (option) {
				option.scrollIntoView({ block: 'nearest' });
			}
		}
	};

	const handleMouseEnter = (playerId, index) => {
		players[playerId].highlightedIndex = index;
	};

	const handleClickOutside = (event) => {
		if (!event.target.closest('.combobox')) {
			Object.keys(players).forEach((playerId) => {
				players[playerId].isDropdownOpen = false;
			});
		}
	};

	onMount(() => {
		fetchData();
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<div class="w-full mt-4 sm:mt-0 border border-gray-500 text-white rounded-lg">
	{#each Object.keys(players) as playerId}
		<div class="p-4">
			<h2 class="text-lg font-medium leading-6 mb-2">
				Player {playerId === 'p1' ? '1' : '2'}
			</h2>

			<div class="flex space-x-4">
				<div class="w-2/3">
					<label for="name-{playerId}" class="block text-sm font-medium leading-6">
						Player Name
					</label>
					<input
						id="name-{playerId}"
						type="text"
						class="mt-2 w-full rounded-md border-0 bg-gray-800 py-3 px-3 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
						bind:value={players[playerId].name}
						on:input={(e) => handleInputChange(playerId, 'name', e.target.value)}
					/>
				</div>

				<div class="w-1/3">
					<label for="record-{playerId}" class="block text-sm font-medium leading-6">
						Player Record
					</label>
					<input
						id="record-{playerId}"
						type="text"
						class="mt-2 w-full rounded-md border-0 bg-gray-800 py-3 px-3 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
						bind:value={players[playerId].record}
						on:input={(e) => handleInputChange(playerId, 'record', e.target.value)}
					/>
				</div>
			</div>

			<label for="hero-{playerId}" class="block text-sm font-medium leading-6 mt-4">
				Player Hero
			</label>
			<div class="relative mt-2 combobox">
				<input
					id="hero-{playerId}"
					type="text"
					class="w-full rounded-md border-0 bg-gray-800 py-3 pl-3 pr-12 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
					role="combobox"
					aria-controls="options"
					aria-expanded={players[playerId].isDropdownOpen.toString()}
					on:input={(e) => {
						players[playerId].query = e.target.value;
						updateFilteredHeroes(playerId);
						players[playerId].isDropdownOpen = true;
					}}
					on:focus={() => (players[playerId].isDropdownOpen = true)}
					on:keydown={(e) => handleKeyDown(playerId, e)}
					bind:value={players[playerId].query}
				/>

				{#if players[playerId].isDropdownOpen && players[playerId].filteredHeroes.length > 0}
					<ul
						class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
						id="options"
						role="listbox"
					>
						{#each players[playerId].filteredHeroes.slice(0, 20) as hero, index}
							<li
								class="relative cursor-default select-none py-2 pl-3 pr-9 {players[playerId]
									.highlightedIndex === index
									? 'bg-indigo-600 text-white'
									: ''}"
								id={'option-' + playerId + '-' + index}
								role="option"
								aria-selected="true"
								tabindex="-1"
								on:mouseenter={() => handleMouseEnter(playerId, index)}
							>
								<button
									type="button"
									class="w-full text-left flex items-center"
									on:click={() => handleHeroChange(playerId, hero)}
								>
									<div class="flex-grow">
										<span class="block truncate">{hero.name}</span>
									</div>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			{#if players[playerId].error}
				<div class="text-red-500 mt-5">{players[playerId].error}</div>
			{/if}
		</div>
	{/each}

	<div class="p-4">
		<h2 class="text-lg font-medium leading-6 mb-2">Round Information</h2>
		<div class="w-full">
			<label for="round-info" class="block text-sm font-medium leading-6"> Round </label>
			<input
				id="round-info"
				type="text"
				placeholder="Round 1 of 6"
				class="mt-2 w-full rounded-md border-0 bg-gray-800 py-3 px-3 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
				bind:value={roundInfo}
				on:input={(e) => handleRoundChange(e.target.value)}
			/>
		</div>

		<div class="w-full mt-4">
			<label for="tournament-status" class="block text-sm font-medium leading-6">
				Tournament Status
			</label>
			<input
				id="tournament-status"
				type="text"
				placeholder="Tournament in Progress"
				class="mt-2 w-full rounded-md border-0 bg-gray-800 py-3 px-3 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
				bind:value={tournamentStatus}
				on:input={(e) => handleTournamentStatusChange(e.target.value)}
			/>
		</div>
	</div>
</div>
