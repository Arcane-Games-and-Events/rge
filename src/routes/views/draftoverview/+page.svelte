<script>
	import { onMount } from 'svelte';
	import { ref, onValue, update } from 'firebase/database';
	import { db } from '../../../firebaseClient';

	const packs = ['Pack 1', 'Pack 2', 'Pack 3'];

	let allCards = [];
	let stats = {
		combinedKeywords: {},
		pitch: {}
	};
	let selectedFilters = {
		combinedKeywords: {}
	};

	const maxSelectedFilters = 8; // Maximum number of selected filters
	const databasePath = 'draftTool/filters';

	// Fetch data from Firebase
	onMount(() => {
		fetchCards();
		syncFiltersFromDatabase();
	});

	const fetchCards = () => {
		const allCardsData = {};
		let combinedCards = [];

		packs.forEach((pack) => {
			const packRef = ref(db, `draftTool/saved_cards/${pack}`);
			onValue(packRef, (snapshot) => {
				const data = snapshot.val();
				if (data) {
					const packCards = Object.entries(data).map(([id, card]) => ({
						id,
						...card,
						pack
					}));
					allCardsData[pack] = packCards;
				} else {
					allCardsData[pack] = [];
				}

				combinedCards = Object.values(allCardsData).flat();

				// Sort by pitch value and alphabetically by name
				combinedCards.sort((a, b) => {
					if (!a.pitch && !b.pitch) return a.name.localeCompare(b.name); // Both without pitch
					if (!a.pitch) return 1; // Empty pitch to the end
					if (!b.pitch) return -1; // Empty pitch to the end
					if (a.pitch !== b.pitch) return a.pitch - b.pitch; // Sort by pitch (1 -> 2 -> 3)
					return a.name.localeCompare(b.name); // Alphabetical sort for the same pitch
				});

				allCards = combinedCards;

				calculateStats();
			});
		});
	};

	const calculateStats = () => {
		const newStats = { combinedKeywords: {}, pitch: {} };

		allCards.forEach((card) => {
			// Combine types, keywords, and defense into one category
			const combinedKeywords = new Set([
				...(card.types || []),
				...(card.card_keywords || []),
				...(card.defense ? [`Block ${card.defense}`] : [])
			]);

			combinedKeywords.forEach((keyword) => {
				newStats.combinedKeywords[keyword] = (newStats.combinedKeywords[keyword] || 0) + 1;
			});

			if (card.pitch) {
				newStats.pitch[card.pitch] = (newStats.pitch[card.pitch] || 0) + 1;
			}
		});

		stats = newStats;

		// Initialize selected filters if not already set
		Object.keys(stats.combinedKeywords).forEach((keyword) => {
			if (!(keyword in selectedFilters.combinedKeywords)) {
				selectedFilters.combinedKeywords[keyword] = false;
			}
		});

		console.log('Updated Stats:', stats);
	};

	const syncFiltersFromDatabase = () => {
		const filtersRef = ref(db, databasePath);
		onValue(filtersRef, (snapshot) => {
			const remoteFilters = snapshot.val();
			if (remoteFilters) {
				selectedFilters = remoteFilters;
			}
		});
	};

	const updateFiltersInDatabase = () => {
		const filtersRef = ref(db, databasePath);
		update(filtersRef, selectedFilters).catch((error) => {
			console.error('Failed to update filters in database:', error);
		});
	};

	// Enforce maximum selected filters
	const toggleFilter = (category, value) => {
		const selectedCount = Object.values(selectedFilters[category]).filter(Boolean).length;

		if (!selectedFilters[category][value] && selectedCount >= maxSelectedFilters) {
			alert(
				`You can only select up to ${maxSelectedFilters} properties. Please deselect another before selecting a new one.`
			);
			return;
		}

		selectedFilters[category][value] = !selectedFilters[category][value];
		updateFiltersInDatabase();
	};

	// Get keywords for checkboxes
	const getKeywordsForCheckboxes = () => {
		const keywords = Object.entries(stats.combinedKeywords)
			.sort(([, a], [, b]) => b - a) // Sort by count descending
			.map(([key]) => ({
				name: key, // Keyword name
				count: stats.combinedKeywords[key], // Keyword count
				isSelected: selectedFilters.combinedKeywords[key] || false // Check if selected
			}));

		console.log('Keywords for Checkboxes:', keywords);
		return keywords;
	};

	// Map rarity to Tailwind color classes
	const rarityColorClass = (rarity) => {
		switch (rarity) {
			case 'C':
				return 'text-gray-600';
			case 'R':
				return 'text-blue-600';
			case 'M':
				return 'text-red-600';
			case 'L':
				return 'text-yellow-600';
			default:
				return 'text-gray-400';
		}
	};
</script>

<div class="h-full px-4 py-6 bg-gray-800 text-white">
	<div class="container mx-auto">
		<!-- Pool Stats Display -->
		<div class="flex flex-row-reverse items-center text-center">
			<div class="w-1/4 mb-6">
				<!-- Display Selected Keywords -->
				<div class="mb-4">
					<h3 class="font-medium">Key Stats</h3>
					<div class="grid grid-cols-2 gap-4 max-w-xs mx-auto">
						{#each getKeywordsForCheckboxes() as { name, count, isSelected }}
							<div class="p-3 bg-gray-900">
								<p class="font-bold text-3xl text-green-500">{count}</p>
								<p class="mt-1">{name}</p>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Cards -->
			<div class="w-3/4 grid grid-cols-4 gap-2">
				{#each allCards as card}
					<div
						class={`border-l-8 p-2 bg-gray-100 relative ${
							card.pitch === '1'
								? 'border-red-500'
								: card.pitch === '2'
									? 'border-yellow-500'
									: card.pitch === '3'
										? 'border-blue-500'
										: 'border-gray-400'
						}`}
					>
						<div class="px-2 flex justify-between items-center">
							<p class="text-sm font-bold text-gray-800">{card.name}</p>
							<p class={`text-sm font-bold ${rarityColorClass(card.printings[0]?.rarity || '')}`}>
								{card.printings[0]?.rarity || 'Unknown'}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="mt-12">
			<h2 class="text-xl font-semibold mb-4">Pool Stats Filters</h2>

			<!-- Combined Keywords -->
			<div class="mb-4">
				<h3 class="font-medium mb-2">Keywords, Types, and Defense</h3>
				<div class="flex flex-wrap gap-2">
					{#each getKeywordsForCheckboxes() as { name, count, isSelected }}
						<button
							class={`px-4 py-2 border text-sm font-medium cursor-pointer transition ${
								isSelected
									? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
									: 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'
							}`}
							on:click={() => toggleFilter('combinedKeywords', name)}
						>
							{name} ({count})
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
