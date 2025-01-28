<script>
	import { onMount } from 'svelte';
	import { fly, fade, slide } from 'svelte/transition';
	import { ref, set, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';

	import LazyImage from '../../../lib/LazyImage.svelte';

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
	let pagedCards = [];
	let displayedCards = [];
	let keywordCounts = {};
	let pitchStats = {};

	let selectedKeywords = new Map();
	let selectedKeywordCounts = new Map();

	let filteredWord = '';
	let showImageGrid = false;
	let currentPage = 1;
	let totalPages = 1;
	let modalCard = null;
	let showModal = false;
	let isFiltered = false;
	let isFirstLoad = true;
	let slideDirection = 'left'; // controlling slide direction

	// NEW: We'll store the three fields from 'playerInfo/draft'
	let draftInfo = {
		name: '',
		pod: '',
		seat: ''
	};

	let format = '';

	// --------------------
	// Firebase Helpers
	// --------------------
	const getDbRef = (path) => ref(db, path);

	// --------------------
	// Utility
	// --------------------
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
		(card.ability_and_effect_keywords || []).forEach((kw) => collected.add(kw));
		return collected;
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

	function chunkArray(array, size) {
		const result = [];
		for (let i = 0; i < array.length; i += size) {
			result.push(array.slice(i, i + size));
		}
		return result;
	}

	// --------------------
	// Data Fetching & Stats
	// --------------------
	function fetchCards() {
		const allCardsData = {};

		PACKS.forEach((pack) => {
			onValue(getDbRef(`draftTool/saved_cards/${pack}`), async (snapshot) => {
				const data = snapshot.val() || {};
				allCardsData[pack] = Object.entries(data).map(([id, card]) => ({
					id,
					...card,
					pack
				}));

				allCards = sortCards(Object.values(allCardsData).flat());
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
			kws.forEach((kw) => {
				keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
			});
			if (card.pitch) {
				pitchStats[card.pitch] = (pitchStats[card.pitch] || 0) + 1;
			}
		});
	}

	async function removeStaleKeywords() {
		let changed = false;
		for (const [keyword] of selectedKeywords.entries()) {
			if (!keywordCounts[keyword]) {
				selectedKeywords.delete(keyword);
				changed = true;
			}
		}
		if (changed) {
			await set(getDbRef('draftTool/selectedKeywords'), Object.fromEntries(selectedKeywords));
		}
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
			displayedCards = pagedCards[currentPage - 1] || [];
		} else {
			displayedCards = filteredCards;
			totalPages = 1;
			currentPage = 1;
		}
	}

	// --------------------
	// Firebase State Sync
	// --------------------
	function syncState() {
		onValue(getDbRef('draftTool/selectedKeywords'), (snapshot) => {
			selectedKeywords = new Map(Object.entries(snapshot.val() || {}));
		});

		onValue(getDbRef('draftTool/filteredWord'), (snapshot) => {
			filteredWord = snapshot.val() || '';
			applyFilter();
		});

		onValue(getDbRef('draftTool/showImageGrid'), (snapshot) => {
			showImageGrid = snapshot.val() || false;
			applyFilter();
		});

		onValue(getDbRef('draftTool/modalCard'), (snapshot) => {
			modalCard = snapshot.val();
			showModal = !!modalCard;
		});

		let oldPage = currentPage;
		onValue(getDbRef('draftTool/currentPage'), (snapshot) => {
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
			set(getDbRef('draftTool/filteredWord'), newFilterWord),
			set(getDbRef('draftTool/showImageGrid'), !isDeselecting),
			set(getDbRef('draftTool/currentPage'), 1)
		]);
	}

	// --------------------
	// Dynamic counts
	// --------------------
	function getSelectedKeywordCounts(cards, selKws) {
		const map = new Map();
		for (const card of cards) {
			const cKeywords = getCardKeywords(card);
			for (const [kw] of selKws.entries()) {
				if (cKeywords.has(kw)) {
					map.set(kw, (map.get(kw) || 0) + 1);
				}
			}
		}
		return map;
	}

	$: selectedKeywordCounts = getSelectedKeywordCounts(allCards, selectedKeywords);

	// --------------------
	// Modal
	// --------------------
	async function openModal(card) {
		await set(getDbRef('draftTool/modalCard'), card);
	}

	async function closeModal() {
		await set(getDbRef('draftTool/modalCard'), null);
	}

	// --------------------
	// Lifecycle
	// --------------------
	onMount(() => {
		// 1) Fetch your card data
		fetchCards();
		// 2) Sync the draftTool states
		syncState();
		// 3) Fetch the "draft" info: name, pod, seat
		fetchDraftInfo();
		// 4) Fetch set name
		fetchFormat();
	});

	function fetchDraftInfo() {
		const playerRef = getDbRef('playerInfo/draft');
		onValue(playerRef, (snapshot) => {
			const data = snapshot.val() || {};
			draftInfo.name = data.name || '';
			draftInfo.pod = data.pod || '';
			draftInfo.seat = data.seat || '';
		});
	}

	function fetchFormat() {
		const formatRef = getDbRef('draftTool/selectedSet');
		onValue(formatRef, (snapshot) => {
			const data = snapshot.val() || {};
			format = data || '';
		});
	}
</script>

<!-- Main Container -->
<div>
	<div
		class="bg-gray-900 text-white px-12 py-5"
		in:fade={{ duration: 1000 }}
		out:fade={{ duration: 1000 }}
	>
		<p class="text-3xl font-bold">
			{format} Draft Pool | Pod {draftInfo.pod} Seat {draftInfo.seat}
		</p>
		<p class="mt-1 text-5xl font-bold text-yellow-500">{draftInfo.name}</p>
	</div>
	<div class="px-4 py-6 bg-gray-800 bg-opacity-60 text-white min-h-screen">
		<div class="max-w-7xl container mx-auto">
			<div class="flex flex-wrap md:flex-nowrap gap-4 gallery">
				<!-- LEFT: Grid/List Section -->
				<div class="w-full md:w-3/4 mb-8">
					<div class="relative overflow-hidden grid-container">
						{#if showImageGrid}
							<div
								class="w-full inset-0"
								in:fade={{ duration: 1000 }}
								out:fade={{ duration: 1000 }}
							>
								<div class="max-w-4xl mx-auto h-full">
									{#key currentPage}
										<div
											class="h-full"
											in:slide={{ direction: slideDirection, duration: 300 }}
											out:slide={{ direction: slideDirection, duration: 300 }}
										>
											<div class="grid grid-cols-3 md:grid-cols-4 gap-x-3 gap-y-2">
												{#each displayedCards as card, i (card.id)}
													<button
														class="relative shadow overflow-hidden cursor-pointer"
														on:click={() => openModal(card)}
														in:fly={{ x: 50, duration: 300, delay: i * 50 }}
														out:fly={{ x: 50, duration: 300, delay: i * 50 }}
													>
														{#if card.printings?.[0]?.image_url}
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
							</div>
						{:else}
							<div
								class="absolute center inset-0 mt-6"
								in:fade={{ duration: 1000 }}
								out:fade={{ duration: 100 }}
							>
								<div class="h-full">
									<div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
										{#each displayedCards as card, i (card.id)}
											<button
												class="border-l-8 p-2.5 bg-gray-100 relative border-{pitchColorClass(
													card.pitch
												)}"
												on:click={() => openModal(card)}
												in:fly={{ x: 50, duration: 300, delay: i * 50 }}
											>
												<div class="px-2 flex justify-between items-center overflow-hidden">
													<p class="text-sm font-bold text-gray-800 truncate">
														{card.name}
													</p>
													<p
														class="text-sm font-bold {rarityColorClass(
															card.printings?.[0]?.rarity
														)}"
													>
														{card.printings?.[0]?.rarity || 'Unknown'}
													</p>
												</div>
											</button>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>

				<!-- RIGHT: Stats Panel -->
				<div class="w-full h-full pt-4 border-t-4 border-white pb-6 md:w-1/4 mb-8 bg-gray-900">
					<h2 class="text-3xl font-bold py-2 text-center bg-white text-gray-900 font-bold mb-4">
						Pool Stats
					</h2>
					<!-- Pitch Stats -->
					{#if Object.keys(pitchStats).length > 0}
						<h3 class="bg-white bg-opacity-20 py-2 pl-6 text-lg font-bold mb-3 tracking-wide">
							Pitch Distribution
						</h3>
						{#each Object.keys(pitchStats).sort((a, b) => a - b) as pitch}
							<div class="px-4">
								<button
									class="px-3 py-1 w-full block flex items-center cursor-pointer {filteredWord ===
									pitch
										? 'bg-white bg-opacity-15 rounded-full'
										: ''}"
									on:click={() => toggleFilteredWord(pitch)}
								>
									<div
										class="h-4 rounded-lg bg-{pitchColorClass(pitch)}"
										style="width: {(pitchStats[pitch] / Math.max(...Object.values(pitchStats))) *
											100}%"
									></div>
									<span class="ml-2 text-lg font-bold tracking-wde">{pitchStats[pitch]}</span>
								</button>
							</div>
						{/each}
					{:else}
						<p class="text-center text-sm text-gray-400">No pitch data available.</p>
					{/if}

					<!-- Keyword Stats -->
					<h3 class="bg-white bg-opacity-20 py-2 pl-6 text-lg font-bold mt-4 mb-3 tracking-wide">
						Key Stats
					</h3>
					<div class="px-4 grid grid-cols-2 gap-x-4">
						{#each Array.from(selectedKeywords.keys()) as keyword}
							<button
								class="inline-block pt-1 pb-2 text-left text-sm text-gray-300 cursor-pointer
									{filteredWord === keyword ? 'font-bold bg-white bg-opacity-10' : ''}"
								on:click={() => toggleFilteredWord(keyword)}
							>
								<div class="text-center">
									<p class="text-2xl text-green-500 font-bold">
										{selectedKeywordCounts.get(keyword) ?? 0}
									</p>
									<p>{keyword}</p>
								</div>
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Modal Overlay -->
<button
	class="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center
		transition-opacity ease-in-out duration-500
		opacity-0 pointer-events-none
		"
	class:opacity-100={showModal}
	class:pointer-events-auto={showModal}
	on:click={closeModal}
>
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
	.grid-container {
		min-height: 600px;
	}
</style>
