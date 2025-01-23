<script>
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition'; // For the slide animation
	import { ref, set, onValue } from 'firebase/database';
	import { db } from '../../firebaseClient';

	// Import our LazyImage component
	import LazyImage from '../../lib/LazyImage.svelte';

	// --------------------
	// Constants
	// --------------------
	const PACKS = ['Pack 1', 'Pack 2', 'Pack 3'];
	const CARDS_PER_PAGE = 8;
	const MAX_SELECTED_KEYWORDS = 8;

	// --------------------
	// State
	// --------------------
	let allCards = [];
	let pagedCards = []; // Array of "pages" for gallery
	let displayedCards = []; // The cards for the current page
	let keywordCounts = {}; // Overall keyword frequencies (all keywords in the pool)
	let pitchStats = {};

	let selectedKeywords = new Map(); // Stores { keyword: true } for each selected keyword
	let selectedKeywordCounts = new Map(); // Dynamically computed counts for selected keywords

	let filteredWord = '';
	let showImageGrid = false;
	let currentPage = 1;
	let totalPages = 1;
	let modalCard = null;
	let showModal = false;
	let isFiltered = false;
	let isFirstLoad = true;
	let slideDirection = 'right'; // for the slide transition

	// --------------------
	// Firebase ref helper
	// --------------------
	const getDbRef = (path) => ref(db, `draftTool/${path}`);

	// --------------------
	// Utility
	// --------------------
	function chunkArray(array, size) {
		const result = [];
		for (let i = 0; i < array.length; i += size) {
			result.push(array.slice(i, i + size));
		}
		return result;
	}

	function pitchColorClass(pitch) {
		switch (pitch) {
			case '1':
				return 'red-500';
			case '2':
				return 'yellow-500';
			case '3':
				return 'blue-500';
			default:
				return 'gray-400';
		}
	}

	function rarityColorClass(rarity) {
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
	}

	function sortCards(cards) {
		return cards.sort((a, b) => {
			if (!a.pitch && !b.pitch) return a.name.localeCompare(b.name);
			if (!a.pitch) return 1;
			if (!b.pitch) return -1;
			if (a.pitch !== b.pitch) return a.pitch - b.pitch;
			return a.name.localeCompare(b.name);
		});
	}

	function getCardKeywords(card) {
		const collected = new Set(card.types || []);
		(card.card_keywords || []).forEach((kw) => collected.add(kw));
		if (card.defense) collected.add(`Block ${card.defense}`);
		return collected;
	}

	// --------------------
	// Data fetching & stats
	// --------------------
	async function removeStaleKeywords() {
		let changed = false;
		for (const [keyword] of selectedKeywords.entries()) {
			if (!keywordCounts[keyword]) {
				selectedKeywords.delete(keyword);
				changed = true;
			}
		}
		if (changed) {
			await set(getDbRef('selectedKeywords'), Object.fromEntries(selectedKeywords));
		}
	}

	function fetchCards() {
		const allCardsData = {};

		PACKS.forEach((pack) => {
			onValue(getDbRef(`saved_cards/${pack}`), async (snapshot) => {
				const data = snapshot.val();
				console.log(`Fetched data for ${pack}:`, data);

				allCardsData[pack] = data
					? Object.entries(data).map(([id, card]) => ({ id, ...card, pack }))
					: [];

				allCards = sortCards(Object.values(allCardsData).flat());
				console.log('allCards (after sorting):', allCards);

				calculateStats();
				await removeStaleKeywords();
				applyFilter();
			});
		});
	}

	function calculateStats() {
		keywordCounts = {};
		pitchStats = {};

		allCards.forEach((card) => {
			const kws = getCardKeywords(card);
			// Count each keyword
			kws.forEach((kw) => {
				keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
			});
			// Pitch stats
			if (card.pitch) {
				pitchStats[card.pitch] = (pitchStats[card.pitch] || 0) + 1;
			}
		});
	}

	// --------------------
	// Filtering & Pagination
	// --------------------
	function applyFilter() {
		const filteredCards = filteredWord
			? allCards.filter((card) => {
					const cKeywords = getCardKeywords(card);
					return cKeywords.has(filteredWord) || card.pitch === filteredWord;
				})
			: allCards;

		isFiltered = !!filteredWord;

		if (showImageGrid) {
			pagedCards = chunkArray(filteredCards, CARDS_PER_PAGE);
			totalPages = Math.max(1, pagedCards.length);
			currentPage = Math.min(currentPage, totalPages);

			// The cards for the current page
			displayedCards = pagedCards[currentPage - 1] || [];
		} else {
			// Show all filtered cards in one list
			displayedCards = filteredCards;
			totalPages = 1;
			currentPage = 1;
		}

		console.log('applyFilter -> filteredCards:', filteredCards.length);
		console.log('applyFilter -> pagedCards:', pagedCards);
		console.log('applyFilter -> displayedCards:', displayedCards);
	}

	async function changePage(newPage) {
		if (newPage < 1 || newPage > totalPages) return;
		slideDirection = newPage > currentPage ? 'right' : 'left';

		await set(getDbRef('currentPage'), newPage);
		currentPage = newPage;
		// Update displayedCards
		displayedCards = pagedCards[currentPage - 1] || [];
	}

	// --------------------
	// Firebase State Sync
	// --------------------
	function syncState() {
		onValue(getDbRef('selectedKeywords'), (snapshot) => {
			// Snapshot is { [keyword]: true, [keyword2]: true, ... }
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

		onValue(getDbRef('modalCard'), (snapshot) => {
			modalCard = snapshot.val();
			showModal = !!modalCard;
		});

		let oldPage = currentPage;
		onValue(getDbRef('currentPage'), (snapshot) => {
			const newPageVal = snapshot.val() || 1;

			if (isFirstLoad) {
				currentPage = newPageVal;
				applyFilter();
				isFirstLoad = false;
				oldPage = newPageVal;
				return;
			}

			if (newPageVal !== oldPage) {
				oldPage = newPageVal;
				currentPage = newPageVal;
				applyFilter();
			}
		});
	}

	// --------------------
	// Keyword Toggles
	// --------------------
	async function toggleFilteredWord(word) {
		const isDeselecting = filteredWord === word;
		const newFilterWord = isDeselecting ? '' : word;

		await Promise.all([
			set(getDbRef('filteredWord'), newFilterWord),
			set(getDbRef('showImageGrid'), !isDeselecting),
			set(getDbRef('currentPage'), 1)
		]);
	}

	async function toggleKeyword(keyword) {
		const updatedSelected = new Map(selectedKeywords);

		if (updatedSelected.has(keyword)) {
			updatedSelected.delete(keyword);
		} else if (updatedSelected.size < MAX_SELECTED_KEYWORDS) {
			// No more storing counts; just store "true"
			updatedSelected.set(keyword, true);
		}

		selectedKeywords = updatedSelected;
		await set(getDbRef('selectedKeywords'), Object.fromEntries(updatedSelected));
	}

	// --------------------
	// Dynamic counts for selected keywords
	// --------------------
	function getSelectedKeywordCounts(cards, selKws) {
		const map = new Map();
		for (const card of cards) {
			const cKeywords = getCardKeywords(card);
			// For each selected keyword, if the card has it, increment
			for (const [kw] of selKws.entries()) {
				if (cKeywords.has(kw)) {
					map.set(kw, (map.get(kw) || 0) + 1);
				}
			}
		}
		return map;
	}

	// When allCards or selectedKeywords changes, recalc the dynamic counts
	$: selectedKeywordCounts = getSelectedKeywordCounts(allCards, selectedKeywords);

	// --------------------
	// Modal Handling
	// --------------------
	async function openModal(card) {
		await set(getDbRef('modalCard'), card);
	}

	async function closeModal() {
		await set(getDbRef('modalCard'), null);
	}

	// --------------------
	// Lifecycle
	// --------------------
	onMount(() => {
		fetchCards();
		syncState();
	});
</script>

<!-- Main Container -->
<div class="px-4 py-6 bg-gray-800 text-white">
	<div class="max-w-7xl container mx-auto">
		<div class="flex flex-wrap md:flex-nowrap gap-8 gallery">
			<!-- Image or Text Grid -->
			<div class="w-full md:w-3/4 mb-8">
				{#if showImageGrid}
					<!-- IMAGE GRID (animate between pages) -->
					<div class="max-w-4xl relative overflow-hidden">
						<!-- Key block so we transition out old page, in new page -->
						{#key currentPage}
							<div
								class="w-full"
								in:slide={{ direction: slideDirection, duration: 300 }}
								out:slide={{ direction: slideDirection, duration: 300 }}
							>
								<div class="grid grid-cols-4 gap-4">
									{#each displayedCards as card (card.id)}
										<button
											class="relative shadow overflow-hidden cursor-pointer"
											on:click={() => openModal(card)}
										>
											{#if card.printings?.[0]?.image_url}
												<!-- Lazy loading + fade-in -->
												<LazyImage
													src={card.printings[0].image_url}
													alt={card.name}
													class="object-cover w-full h-full"
												/>
											{:else}
												<div class="bg-red-400 text-white p-2">
													No image for {card.name}
												</div>
											{/if}
										</button>
									{/each}
								</div>
							</div>
						{/key}
					</div>

					<!-- Pagination Controls -->
					<div class="flex justify-between items-center mt-4">
						<button
							class="bg-gray-700 text-white px-4 py-2 rounded disabled:opacity-50"
							on:click={() => changePage(currentPage - 1)}
							disabled={currentPage === 1}
						>
							&larr; Previous
						</button>
						<span class="text-gray-300">
							Page {currentPage} of {totalPages}
						</span>
						<button
							class="bg-gray-700 text-white px-4 py-2 rounded disabled:opacity-50"
							on:click={() => changePage(currentPage + 1)}
							disabled={currentPage === totalPages}
						>
							Next &rarr;
						</button>
					</div>
				{:else}
					<!-- TEXT/LIST VIEW (no paging or animation) -->
					<div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
						{#each displayedCards as card}
							<button
								class="border-l-8 p-2 bg-gray-100 relative border-{pitchColorClass(card.pitch)}"
								on:click={() => openModal(card)}
							>
								<div class="px-2 flex justify-between items-center overflow-hidden">
									<p class="text-sm font-bold text-gray-800 truncate">
										{card.name}
									</p>
									<p class="text-sm font-bold {rarityColorClass(card.printings?.[0]?.rarity)}">
										{card.printings?.[0]?.rarity || 'Unknown'}
									</p>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Stats Panel -->
			<div class="w-full md:w-1/4 mb-8">
				<h2 class="text-xl font-bold mb-4">Pool Stats</h2>

				<!-- Pitch Stats -->
				{#if Object.keys(pitchStats).length > 0}
					<h3 class="text-lg font-bold mb-2">Pitch Distribution</h3>
					{#each Object.keys(pitchStats).sort((a, b) => a - b) as pitch}
						<button
							class="w-full block flex items-center mb-2 cursor-pointer {filteredWord === pitch
								? 'ring-2 ring-green-400'
								: ''}"
							on:click={() => toggleFilteredWord(pitch)}
						>
							<div
								class="h-4 rounded-xl bg-{pitchColorClass(pitch)}"
								style="width: {(pitchStats[pitch] / Math.max(...Object.values(pitchStats))) * 100}%"
							></div>
							<span class="ml-2">{pitchStats[pitch]}</span>
						</button>
					{/each}
				{:else}
					<p class="text-sm text-gray-400">No pitch data available.</p>
				{/if}

				<!-- Keyword Stats (selected keywords) -->
				<h3 class="text-lg font-bold mt-4 mb-2">Keyword Stats</h3>
				<!-- We no longer rely on stored counts; we iterate selectedKeywords' keys -->
				{#each Array.from(selectedKeywords.keys()) as keyword}
					<button
						class="inline-block w-full text-left text-sm text-gray-300 cursor-pointer hover:text-green-400
						{filteredWord === keyword ? 'text-green-500 font-bold' : ''}"
						on:click={() => toggleFilteredWord(keyword)}
					>
						<p>
							{keyword}: {selectedKeywordCounts.get(keyword) ?? 0}
						</p>
					</button>
				{/each}
			</div>
		</div>

		<!-- Keyword Selection List -->
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
</div>

<!-- Modal Overlay -->
<button
	class="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center
		transition-opacity ease-in-out duration-500
		opacity-0 pointer-events-none
		-mt-32"
	class:opacity-100={showModal}
	class:pointer-events-auto={showModal}
	on:click={closeModal}
>
	<!-- Modal Card Wrapper -->
	<button class="relative max-w-sm p-4 rounded shadow-lg" on:click|stopPropagation>
		{#if modalCard}
			<img
				src={modalCard.printings?.[0]?.image_url}
				alt={modalCard.name}
				class="object-cover w-full max-w-md"
			/>
		{/if}
	</button>
</button>

<style>
	.gallery {
		height: 700px; /* Adjust as needed or remove entirely */
	}
</style>
