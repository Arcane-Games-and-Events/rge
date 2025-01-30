<script>
	import { onMount } from 'svelte';
	import { ref, push, remove, onValue } from 'firebase/database';
	import { db } from '../../firebaseClient';
	import cards from '../../lib/data/cards.json'; // Adjust the path to your cards.json file

	let query = '';
	let filteredCards = [];
	let selectedCard = null;
	let highlightedIndex = -1; // Tracks which card is highlighted
	let isDropdownOpen = false;

	let savedCards = [];
	let setId = ''; // Fetched from Firebase
	let selectedPack = 'Pack 1'; // Default pack
	let error = null;

	const packs = ['Pack 1', 'Pack 2', 'Pack 3'];

	// Determine the border color based on the pitch value
	const pitchBorderColor = (pitch) => {
		switch (pitch) {
			case '1':
				return 'border-l-8 border-red-500';
			case '2':
				return 'border-l-8 border-yellow-500';
			case '3':
				return 'border-l-8 border-blue-500';
			default:
				return 'border-l-8 border-gray-500';
		}
	};

	// Fetch set_id from Firebase
	const fetchSetId = () => {
		const setIdRef = ref(db, 'draftTool/selectedSet');
		onValue(setIdRef, (snapshot) => {
			const newSetId = snapshot.val();
			if (newSetId) {
				setId = newSetId;
				updateFilteredCards(); // Update the filtered cards when set_id changes
				fetchSavedCards(); // Fetch saved cards when set_id changes
			} else {
				console.error('set_id not found in database');
				setId = '';
			}
		});
	};

	// Filter cards based on set_id and query
	const updateFilteredCards = () => {
		filteredCards = cards.filter(
			(card) =>
				card.printings.some((printing) => printing.set_id === setId) &&
				card.name.toLowerCase().includes(query.toLowerCase())
		);
		highlightedIndex = -1; // Reset the highlighted index when the list updates
		isDropdownOpen = query.trim() !== '' && filteredCards.length > 0; // Open dropdown only when there is input and results
	};

	// Fetch saved cards for the selected pack
	const fetchSavedCards = () => {
		const savedCardsRef = ref(db, `draftTool/saved_cards/${selectedPack}`);
		onValue(savedCardsRef, (snapshot) => {
			const data = snapshot.val();
			savedCards = data
				? Object.entries(data)
						.map(([id, value]) => ({ id, ...value }))
						.reverse() // Newest card at the top
				: [];
		});
	};

	// Handle card selection
	const handleCardChange = async (card) => {
		selectedCard = card; // Update selected card
		query = ''; // Clear the input
		isDropdownOpen = false; // Close the dropdown
		highlightedIndex = -1; // Reset highlighted index

		try {
			await push(ref(db, `draftTool/saved_cards/${selectedPack}`), card);
		} catch (err) {
			console.error('Error saving card to Firebase:', err);
			error = err.message;
		}
	};

	// Handle keyboard navigation
	const handleKeyDown = (event) => {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				if (highlightedIndex < filteredCards.length - 1) {
					highlightedIndex++;
				}
				break;
			case 'ArrowUp':
				event.preventDefault();
				if (highlightedIndex > 0) {
					highlightedIndex--;
				}
				break;
			case 'Enter':
				event.preventDefault();
				if (highlightedIndex >= 0 && highlightedIndex < filteredCards.length) {
					handleCardChange(filteredCards[highlightedIndex]);
				}
				break;
			case 'Escape':
				isDropdownOpen = false; // Close dropdown on Escape
				break;
			default:
				break;
		}
	};

	// Handle pack selection
	const handlePackChange = (pack) => {
		selectedPack = pack;
		fetchSavedCards(); // Fetch cards for the newly selected pack
	};

	const handleRemove = async (id) => {
		await remove(ref(db, `draftTool/saved_cards/${selectedPack}/${id}`));
	};

	const handleClear = () => {
		query = '';
		filteredCards = [];
		selectedCard = null;
		isDropdownOpen = false; // Explicitly close dropdown when cleared
		error = null;
	};

	// Close the dropdown when clicking outside of it
	const handleClickOutside = (event) => {
		if (!event.target.closest('.dropdown-container')) {
			isDropdownOpen = false; // Close dropdown if clicked outside
		}
	};

	onMount(() => {
		fetchSetId();
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<div class="bg-gray-800 min-h-screen">
	<div class="max-w-2xl mx-auto p-6 text-white">
		<h1 class="text-3xl font-bold text-center">Draft Picker</h1>
		<label for="pack-dropdown" class="mt-2 block text-sm font-medium text-gray-300"
			>Select Pack [Current Set: {setId || 'None selected'}]</label
		>
		<!-- Pack Selection Dropdown -->
		<div class="mt-2">
			<select
				id="pack-dropdown"
				bind:value={selectedPack}
				class="w-full p-2 rounded bg-gray-700 text-white"
				on:change={(e) => handlePackChange(e.target.value)}
			>
				{#each packs as pack}
					<option value={pack}>{pack}</option>
				{/each}
			</select>
		</div>

		<!-- Search and Dropdown -->
		<div class="mt-4 dropdown-container relative">
			<input
				type="text"
				bind:value={query}
				class="w-full p-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
				placeholder="Search cards..."
				on:input={updateFilteredCards}
				on:focus={() => (isDropdownOpen = true)}
				on:keydown={handleKeyDown}
			/>
			{#if isDropdownOpen && filteredCards.length > 0}
				<ul
					class="absolute z-10 mt-1 max-h-60 w-full overflow-auto bg-gray-700 rounded-md shadow-md"
				>
					{#each filteredCards as card, index}
						<button
							class={`w-full p-3 flex items-center justify-between cursor-pointer hover:bg-indigo-600 ${
								index === highlightedIndex ? 'bg-indigo-600 text-white' : ''
							} ${pitchBorderColor(card.pitch)}`}
							on:click={() => handleCardChange(card)}
						>
							{card.name}
						</button>
					{/each}
				</ul>
			{/if}
			{#if selectedCard}
				<p class="mt-2 text-sm text-gray-400">
					<strong>Selected Card:</strong>
					{selectedCard.name}
				</p>
			{/if}
		</div>

		<!-- Saved Cards -->
		<h2 class="text-xl font-semibold mb-4 mt-6">Saved Cards in {selectedPack}</h2>
		<ul>
			{#each savedCards as item, index (index)}
				<li
					class={`rounded my-2 p-4 bg-gray-700 flex justify-between items-center ${pitchBorderColor(
						item.pitch
					)}`}
				>
					<div>
						<span class="font-bold">P{savedCards.length - index}</span>
						<span class="ml-2">{item.name}</span>
					</div>
					<div class="flex gap-2">
						<button class="px-2 py-1 bg-red-500 rounded" on:click={() => handleRemove(item.id)}>
							Remove
						</button>
					</div>
				</li>
			{/each}
		</ul>
	</div>
</div>
