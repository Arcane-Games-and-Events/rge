<script>
	import { onMount } from 'svelte';
	import { ref, set, onValue } from 'firebase/database';
	import { db } from '../../firebaseClient';

	// Constants
	const PACKS = ['Pack 1', 'Pack 2', 'Pack 3'];
	const CARDS_PER_PAGE = 8;
	const MAX_SELECTED_KEYWORDS = 8;

	// State
	let allCards = [];
	let displayedCards = [];
	let keywordCounts = {};
	let pitchStats = {};
	let selectedKeywords = new Map();
	let filteredWord = '';
	let showImageGrid = false;
	let currentPage = 1;
	let totalPages = 1;
	let modalCard = null;
	let showModal = false;
	let galleryKey = 0;
	let isFiltered = false;

	// Firebase refs
	const getDbRef = (path) => ref(db, `draftTool/${path}`);

	// Helper functions
	const sortCards = (cards) => {
		return cards.sort((a, b) => {
			if (!a.pitch && !b.pitch) return a.name.localeCompare(b.name);
			if (!a.pitch) return 1;
			if (!b.pitch) return -1;
			return a.pitch !== b.pitch ? a.pitch - b.pitch : a.name.localeCompare(b.name);
		});
	};

	const getCardKeywords = (card) => {
		return new Set([
			...(card.types || []),
			...(card.card_keywords || []),
			...(card.defense ? [`Block ${card.defense}`] : [])
		]);
	};

	// Data fetching and processing
	const fetchCards = () => {
		const allCardsData = {};

		PACKS.forEach((pack) => {
			onValue(getDbRef(`saved_cards/${pack}`), (snapshot) => {
				const data = snapshot.val();
				allCardsData[pack] = data
					? Object.entries(data).map(([id, card]) => ({ id, ...card, pack }))
					: [];

				allCards = sortCards(Object.values(allCardsData).flat());
				calculateStats();
				applyFilter();
			});
		});
	};

	const calculateStats = () => {
		keywordCounts = {};
		pitchStats = {};

		allCards.forEach((card) => {
			getCardKeywords(card).forEach((keyword) => {
				keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
			});

			if (card.pitch) {
				pitchStats[card.pitch] = (pitchStats[card.pitch] || 0) + 1;
			}
		});
	};

	// Filtering and pagination
	const applyFilter = () => {
		const filteredCards = filteredWord
			? allCards.filter(
					(card) => getCardKeywords(card).has(filteredWord) || card.pitch === filteredWord
				)
			: allCards;

		isFiltered = !!filteredWord;

		// Always apply pagination when showImageGrid is true
		if (showImageGrid) {
			totalPages = Math.max(1, Math.ceil(filteredCards.length / CARDS_PER_PAGE));
			currentPage = Math.min(currentPage, totalPages);
			const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
			displayedCards = filteredCards.slice(startIndex, startIndex + CARDS_PER_PAGE);
		} else {
			// Show all cards when not in grid view
			displayedCards = filteredCards;
			totalPages = 1;
		}
	};

	// Firebase sync functions
	const syncState = () => {
		// Listen to all state changes
		onValue(getDbRef('selectedKeywords'), (snapshot) => {
			selectedKeywords = new Map(Object.entries(snapshot.val() || {}));
		});

		onValue(getDbRef('filteredWord'), (snapshot) => {
			filteredWord = snapshot.val() || '';
			applyFilter();
		});

		onValue(getDbRef('showImageGrid'), (snapshot) => {
			showImageGrid = snapshot.val() || false;
			applyFilter();
		});

		onValue(getDbRef('currentPage'), (snapshot) => {
			currentPage = snapshot.val() || 1;
			applyFilter();
		});

		onValue(getDbRef('modalCard'), (snapshot) => {
			modalCard = snapshot.val();
			showModal = !!modalCard;
		});
	};

	// UI event handlers
	const toggleFilteredWord = async (word) => {
		const isDeselecting = filteredWord === word;

		// Update Firebase state
		await Promise.all([
			set(getDbRef('filteredWord'), isDeselecting ? '' : word),
			set(getDbRef('showImageGrid'), isDeselecting ? false : true),
			set(getDbRef('currentPage'), 1)
		]);

		// Local state updates will be handled by the Firebase listeners
		galleryKey++;
	};

	const toggleKeyword = async (keyword) => {
		const updatedSelected = new Map(selectedKeywords);

		if (updatedSelected.has(keyword)) {
			updatedSelected.delete(keyword);
		} else if (updatedSelected.size < MAX_SELECTED_KEYWORDS) {
			updatedSelected.set(keyword, keywordCounts[keyword] || 0);
		}

		selectedKeywords = updatedSelected;
		await set(getDbRef('selectedKeywords'), Object.fromEntries(updatedSelected));
	};

	const changePage = async (newPage) => {
		if (newPage >= 1 && newPage <= totalPages) {
			await set(getDbRef('currentPage'), newPage);
			galleryKey++;
		}
	};

	const openModal = async (card) => {
		await set(getDbRef('modalCard'), card);
	};

	const closeModal = async () => {
		await set(getDbRef('modalCard'), null);
	};

	onMount(() => {
		fetchCards();
		syncState();
	});
</script>

<div class="px-4 py-6 bg-gray-800 text-white">
	<div class="max-w-7xl container mx-auto">
		<div class="flex flex-wrap md:flex-nowrap gap-8 gallery">
			<!-- Image Gallery -->
			<div class="w-full md:w-3/4 mb-8">
				{#if showImageGrid}
					<div key={galleryKey} class="max-w-4xl grid grid-cols-4 gap-4">
						{#each displayedCards as card}
							<div
								class="relative shadow overflow-hidden cursor-pointer"
								on:click={() => openModal(card)}
							>
								<img
									src={card.printings?.[0]?.image_url}
									alt={card.name}
									class="object-cover w-full h-full"
								/>
							</div>
						{/each}
					</div>

					<!-- Pagination -->
					<div class="flex justify-between items-center mt-4">
						<button
							class="bg-gray-700 text-white px-4 py-2 rounded disabled:opacity-50"
							on:click={() => changePage(currentPage - 1)}
							disabled={currentPage === 1}
						>
							&larr; Previous
						</button>
						<span class="text-gray-300">Page {currentPage} of {totalPages}</span>
						<button
							class="bg-gray-700 text-white px-4 py-2 rounded disabled:opacity-50"
							on:click={() => changePage(currentPage + 1)}
							disabled={currentPage === totalPages}
						>
							Next &rarr;
						</button>
					</div>
				{:else}
					<!-- List View -->
					<div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
						{#each displayedCards as card}
							<div
								class="border-l-8 p-2 bg-gray-100 relative {card.pitch === '1'
									? 'border-red-500'
									: card.pitch === '2'
										? 'border-yellow-500'
										: card.pitch === '3'
											? 'border-blue-500'
											: 'border-gray-400'}"
								on:click={() => openModal(card)}
							>
								<div class="px-2 flex justify-between items-center overflow-hidden">
									<p class="text-sm font-bold text-gray-800 truncate">{card.name}</p>
									<p
										class="text-sm font-bold {card.printings?.[0]?.rarity === 'C'
											? 'text-gray-600'
											: card.printings?.[0]?.rarity === 'R'
												? 'text-blue-600'
												: card.printings?.[0]?.rarity === 'M'
													? 'text-red-600'
													: card.printings?.[0]?.rarity === 'L'
														? 'text-yellow-600'
														: 'text-gray-400'}"
									>
										{card.printings?.[0]?.rarity || 'Unknown'}
									</p>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Pool Stats -->
			<div class="w-full md:w-1/4 mb-8">
				<h2 class="text-xl font-bold mb-4">Pool Stats</h2>

				<!-- Pitch Distribution -->
				{#if Object.keys(pitchStats).length > 0}
					<h3 class="text-lg font-bold mb-2">Pitch Distribution</h3>
					{#each Object.keys(pitchStats).sort((a, b) => a - b) as pitch}
						<button
							class="w-full block flex items-center mb-2 cursor-pointer
                         {filteredWord === pitch ? 'ring-2 ring-green-400' : ''}"
							on:click={() => toggleFilteredWord(pitch)}
						>
							<div
								class="h-4 rounded-xl {pitch === '1'
									? 'bg-red-500'
									: pitch === '2'
										? 'bg-yellow-500'
										: pitch === '3'
											? 'bg-blue-500'
											: 'bg-gray-400'}"
								style="width: {(pitchStats[pitch] / Math.max(...Object.values(pitchStats))) * 100}%"
							></div>
							<span class="ml-2">{pitchStats[pitch]}</span>
						</button>
					{/each}
				{:else}
					<p class="text-sm text-gray-400">No pitch data available.</p>
				{/if}

				<!-- Selected Keywords -->
				<h3 class="text-lg font-bold mt-4 mb-2">Keyword Stats</h3>
				{#each Array.from(selectedKeywords) as [keyword, count]}
					<button
						class="inline-block w-full text-left text-sm text-gray-300 cursor-pointer
                       hover:text-green-400 {filteredWord === keyword
							? 'text-green-500 font-bold'
							: ''}"
						on:click={() => toggleFilteredWord(keyword)}
					>
						<p>{keyword}: {count}</p>
					</button>
				{/each}
			</div>
		</div>

		<!-- Keyword List -->
		<div class="mb-8">
			<h2 class="text-xl font-bold mb-4">Keyword List</h2>
			<div class="grid grid-cols-2 md:grid-cols-6 gap-2">
				{#each Object.entries(keywordCounts).sort(([, a], [, b]) => b - a) as [keyword, count]}
					<label class="flex items-center space-x-2 bg-gray-900 p-2 rounded shadow cursor-pointer">
						<input
							type="checkbox"
							checked={selectedKeywords.has(keyword)}
							on:change={() => toggleKeyword(keyword)}
							disabled={!selectedKeywords.has(keyword) &&
								selectedKeywords.size >= MAX_SELECTED_KEYWORDS}
						/>
						<span class="text-green-400 text-xl font-bold">{keyword}</span>
						<span class="text-gray-300 text-xs">({count})</span>
					</label>
				{/each}
			</div>
		</div>
	</div>

	<!-- Modal -->
	{#if showModal}
		<button
			class="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center -mt-32"
			on:click={closeModal}
		>
			<button class="relative max-w-sm p-4 rounded shadow-lg" on:click|stopPropagation>
				<img
					src={modalCard?.printings?.[0]?.image_url}
					alt={modalCard?.name}
					class="object-cover w-full max-w-md"
				/>
			</button>
		</button>
	{/if}
</div>

<style>
	.gallery {
		height: 700px;
	}
</style>
