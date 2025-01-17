<script>
	import { onMount } from 'svelte';
	import { ref, onValue, set, update } from 'firebase/database';
	import { db } from '../../../firebaseClient';

	const packs = ['Pack 1', 'Pack 2', 'Pack 3'];

	let allCards = [];
	let filteredCards = [];
	let stats = {
		combinedKeywords: {},
		pitch: {}
	};
	let selectedFilters = {
		combinedKeywords: {},
		pitch: {}
	};

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
				allCards = combinedCards;

				filterCards();
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
				selectedFilters.combinedKeywords[keyword] = true;
			}
		});
		Object.keys(stats.pitch).forEach((pitch) => {
			if (!(pitch in selectedFilters.pitch)) {
				selectedFilters.pitch[pitch] = true;
			}
		});
	};

	const filterCards = () => {
		filteredCards = allCards.filter((card) => {
			const combinedKeywords = new Set([
				...(card.types || []),
				...(card.card_keywords || []),
				...(card.defense ? [`Block ${card.defense}`] : [])
			]);

			return (
				Array.from(combinedKeywords).some((keyword) => selectedFilters.combinedKeywords[keyword]) &&
				(selectedFilters.pitch[card.pitch] || false)
			);
		});
	};

	const syncFiltersFromDatabase = () => {
		const filtersRef = ref(db, databasePath);
		onValue(filtersRef, (snapshot) => {
			const remoteFilters = snapshot.val();
			if (remoteFilters) {
				selectedFilters = remoteFilters;
				filterCards();
			}
		});
	};

	const updateFiltersInDatabase = () => {
		const filtersRef = ref(db, databasePath);
		update(filtersRef, selectedFilters).catch((error) => {
			console.error('Failed to update filters in database:', error);
		});
	};

	const toggleFilter = (category, value) => {
		selectedFilters[category][value] = !selectedFilters[category][value];
		filterCards();
		updateFiltersInDatabase();
	};
</script>

<div class="container mx-auto px-4 py-6">
	<h1 class="text-2xl font-bold mb-6">Combined Packs View</h1>

	<!-- Pool Stats Display -->
	<div class="mb-6">
		<h2 class="text-xl font-semibold mb-4">Selected Pool Stats</h2>

		<!-- Display Selected Keywords -->
		<div class="mb-4">
			<h3 class="font-medium">Selected Keywords, Types, and Defense</h3>
			<ul>
				{#each Object.entries(selectedFilters.combinedKeywords).filter(([key, value]) => value) as [keyword]}
					<li>{keyword} ({stats.combinedKeywords[keyword]})</li>
				{/each}
			</ul>
		</div>

		<!-- Display Selected Pitch -->
		<div class="mb-4">
			<h3 class="font-medium">Selected Pitch</h3>
			<ul>
				{#each Object.entries(selectedFilters.pitch).filter(([key, value]) => value) as [pitch]}
					<li>Pitch {pitch} ({stats.pitch[pitch]})</li>
				{/each}
			</ul>
		</div>
	</div>

	<!-- Cards -->
	<div class="md:grid md:grid-cols-4 gap-4">
		{#if filteredCards.length > 0}
			{#each filteredCards as card}
				<div class="border rounded p-4 bg-gray-100">
					<h3 class="font-bold">{card.name}</h3>
					<p>Pitch: {card.pitch}</p>
					<p>Defense: {card.defense}</p>
					<p>
						Types and Keywords: {(card.types || []).concat(card.card_keywords || []).join(', ')}
					</p>
				</div>
			{/each}
		{:else}
			<p class="text-gray-500">No cards available.</p>
		{/if}
	</div>

	<div class="mt-12">
		<h2 class="text-xl font-semibold mb-4">Pool Stats Filters</h2>

		<!-- Combined Keywords -->
		<div class="mb-4">
			<h3 class="font-medium mb-2">Keywords, Types, and Defense</h3>
			<div class="flex flex-wrap gap-2">
				{#each Object.keys(stats.combinedKeywords) as keyword}
					<button
						class={`px-3 py-1 rounded-lg border text-sm font-medium cursor-pointer transition ${
							selectedFilters.combinedKeywords[keyword]
								? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
								: 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'
						}`}
						on:click={() => toggleFilter('combinedKeywords', keyword)}
					>
						{keyword} ({stats.combinedKeywords[keyword]})
					</button>
				{/each}
			</div>
		</div>

		<!-- Pitch -->
		<div class="mb-4">
			<h3 class="font-medium mb-2">Pitch</h3>
			<div class="flex flex-wrap gap-2">
				{#each Object.keys(stats.pitch) as pitch}
					<button
						class={`px-3 py-1 rounded-lg border text-sm font-medium cursor-pointer transition ${
							selectedFilters.pitch[pitch]
								? 'bg-green-600 text-white border-green-700 hover:bg-green-700'
								: 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
						}`}
						on:click={() => toggleFilter('pitch', pitch)}
					>
						Pitch {pitch} ({stats.pitch[pitch]})
					</button>
				{/each}
			</div>
		</div>
	</div>
</div>
