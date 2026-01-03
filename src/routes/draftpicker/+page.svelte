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

<div class="min-h-screen bg-gray-950">
	<div class="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8 text-center">
			<h1 class="font-display text-3xl font-bold text-white">Draft Picker</h1>
			<p class="mt-2 text-gray-400">Search and add cards to your draft pool.</p>
		</div>

		<!-- Pack Selection Card -->
		<div class="rounded-xl border border-gray-800 bg-gray-900/50 p-6 backdrop-blur-sm">
			<label for="pack-dropdown" class="mb-2 block text-sm font-medium text-gray-300">
				Select Pack
				<span class="ml-2 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
					Set: {setId || 'None'}
				</span>
			</label>
			<select
				id="pack-dropdown"
				bind:value={selectedPack}
				class="w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-white transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				on:change={(e) => handlePackChange(e.target.value)}
			>
				{#each packs as pack}
					<option value={pack}>{pack}</option>
				{/each}
			</select>

			<!-- Search and Dropdown -->
			<div class="dropdown-container relative mt-4">
				<input
					type="text"
					bind:value={query}
					class="w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-white placeholder-gray-500 transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					placeholder="Search cards..."
					on:input={updateFilteredCards}
					on:focus={() => (isDropdownOpen = true)}
					on:keydown={handleKeyDown}
				/>
				{#if isDropdownOpen && filteredCards.length > 0}
					<ul class="absolute z-10 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-gray-700 bg-gray-800 shadow-xl">
						{#each filteredCards as card, index}
							<button
								class="flex w-full cursor-pointer items-center justify-between p-3 text-white transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-blue-600 {index === highlightedIndex ? 'bg-blue-600' : ''} {pitchBorderColor(card.pitch)}"
								on:click={() => handleCardChange(card)}
							>
								{card.name}
							</button>
						{/each}
					</ul>
				{/if}
				{#if selectedCard}
					<p class="mt-3 text-sm text-gray-400">
						<span class="font-medium text-gray-300">Selected:</span>
						<span class="ml-1 text-blue-400">{selectedCard.name}</span>
					</p>
				{/if}
			</div>
		</div>

		<!-- Saved Cards -->
		<div class="mt-8 rounded-xl border border-gray-800 bg-gray-900/50 p-6 backdrop-blur-sm">
			<h2 class="mb-4 font-display text-xl font-semibold text-white">
				Saved Cards in {selectedPack}
				<span class="ml-2 text-sm font-normal text-gray-400">({savedCards.length} cards)</span>
			</h2>
			{#if savedCards.length === 0}
				<p class="text-center text-gray-500">No cards saved yet. Search and add cards above.</p>
			{:else}
				<ul class="space-y-2">
					{#each savedCards as item, index (index)}
						<li class="flex items-center justify-between rounded-lg bg-gray-800 p-4 transition-colors hover:bg-gray-700 {pitchBorderColor(item.pitch)}">
							<div class="flex items-center gap-3">
								<span class="rounded-full bg-gray-700 px-2 py-1 text-xs font-bold text-gray-300">
									P{savedCards.length - index}
								</span>
								<span class="font-medium text-white">{item.name}</span>
							</div>
							<button
								class="rounded-lg bg-red-500/20 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
								on:click={() => handleRemove(item.id)}
							>
								Remove
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>
