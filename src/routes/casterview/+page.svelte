<script>
	import { onMount } from 'svelte';
	import { fly, fade, slide } from 'svelte/transition';
	import { ref, set, onValue } from 'firebase/database';
	import { db } from '../../firebaseClient';

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
		return new Set([
			...(card.types || []),
			...(card.card_keywords || []),
			...(card.ability_and_effect_keywords || []),
			...(card.granted_keywords || []),
			...(card.defense ? [`Block ${card.defense}`] : [])
		]);
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

	async function changePage(newPage) {
		if (newPage < 1 || newPage > totalPages) return;
		slideDirection = newPage > currentPage ? 'left' : 'right';

		await set(getDbRef('draftTool/currentPage'), newPage);
		currentPage = newPage;
		displayedCards = pagedCards[currentPage - 1] || [];
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

	async function toggleKeyword(keyword) {
		const updatedSelected = new Map(selectedKeywords);

		if (updatedSelected.has(keyword)) {
			updatedSelected.delete(keyword);
		} else if (updatedSelected.size < MAX_SELECTED_KEYWORDS) {
			updatedSelected.set(keyword, true);
		}

		selectedKeywords = updatedSelected;
		await set(getDbRef('draftTool/selectedKeywords'), Object.fromEntries(updatedSelected));
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
</script>

<!-- Main Container -->
<div class="min-h-screen bg-gray-950 px-4 py-8 text-white">
	<div class="mx-auto max-w-7xl">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="font-display text-3xl font-bold text-white">Caster View</h1>
			<p class="mt-2 text-gray-400">Browse and display cards from the draft pool.</p>
		</div>

		<div class="flex flex-wrap gap-8 md:flex-nowrap">
			<!-- LEFT: Grid/List Section -->
			<div class="mb-8 w-full md:w-3/4">
				<div class="grid-container relative overflow-hidden rounded-xl border border-gray-800 bg-gray-900/50 p-4 backdrop-blur-sm">
					{#if showImageGrid}
						<div class="inset-0 w-full" in:fade={{ duration: 1000 }} out:fade={{ duration: 1000 }}>
							<div class="mx-auto h-full max-w-4xl">
								{#key currentPage}
									<div
										class="h-full"
										in:slide={{ direction: slideDirection, duration: 300 }}
										out:slide={{ direction: slideDirection, duration: 300 }}
									>
										<div class="grid grid-cols-3 gap-4 md:grid-cols-4">
											{#each displayedCards as card, i (card.id)}
												<button
													class="relative cursor-pointer overflow-hidden rounded-lg shadow-lg transition-transform hover:scale-105"
													on:click={() => openModal(card)}
													in:fly={{ x: 50, duration: 300, delay: i * 50 }}
													out:fly={{ x: 50, duration: 300, delay: i * 50 }}
												>
													{#if card.printings?.[0]?.image_url}
														<LazyImage
															src={card.printings[0].image_url}
															alt={card.name}
															class="h-full w-full object-cover"
														/>
													{:else}
														<div class="bg-red-500/20 p-2 text-red-400">
															No image for {card.name}
														</div>
													{/if}
												</button>
											{/each}
										</div>
									</div>
								{/key}

								<!-- Pagination Controls -->
								<div class="mt-6 flex items-center justify-between">
									<button
										class="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
										on:click={() => changePage(currentPage - 1)}
										disabled={currentPage === 1}
									>
										&larr; Previous
									</button>
									<span class="text-gray-400">
										Page {currentPage} of {totalPages}
									</span>
									<button
										class="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
										on:click={() => changePage(currentPage + 1)}
										disabled={currentPage === totalPages}
									>
										Next &rarr;
									</button>
								</div>
							</div>
						</div>
					{:else}
						<div
							class="absolute inset-0"
							in:fade={{ duration: 1000 }}
							out:fade={{ duration: 100 }}
						>
							<div class="h-full">
								<div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
									{#each displayedCards as card, i (card.id)}
										<button
											class="relative rounded-lg border-l-4 bg-gray-800 p-3 transition-colors hover:bg-gray-700 border-{pitchColorClass(card.pitch)}"
											on:click={() => openModal(card)}
											in:fly={{ x: 50, duration: 300, delay: i * 50 }}
										>
											<div class="flex items-center justify-between overflow-hidden">
												<p class="truncate text-sm font-medium text-white">
													{card.name}
												</p>
												<p class="text-xs font-semibold {rarityColorClass(card.printings?.[0]?.rarity)}">
													{card.printings?.[0]?.rarity || '?'}
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
			<div class="mb-8 w-full md:w-1/4">
				<div class="rounded-xl border border-gray-800 bg-gray-900/50 p-4 backdrop-blur-sm">
					<h2 class="mb-4 font-display text-lg font-semibold text-white">Pool Stats</h2>
					<div class="mb-4 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
						<p class="text-sm text-gray-400">Player: <span class="font-semibold text-blue-400">{draftInfo.name}</span></p>
						<div class="mt-1 flex gap-4 text-sm">
							<p class="text-gray-400">Pod: <span class="font-semibold text-blue-400">{draftInfo.pod}</span></p>
							<p class="text-gray-400">Seat: <span class="font-semibold text-blue-400">{draftInfo.seat}</span></p>
						</div>
					</div>

					<!-- Pitch Stats -->
					{#if Object.keys(pitchStats).length > 0}
						<h3 class="mb-3 text-sm font-semibold text-gray-300">Pitch Distribution</h3>
						{#each Object.keys(pitchStats).sort((a, b) => a - b) as pitch}
							<button
								class="mb-2 flex w-full cursor-pointer items-center rounded-lg p-1 transition-colors hover:bg-white/5 {filteredWord === pitch ? 'ring-2 ring-blue-500' : ''}"
								on:click={() => toggleFilteredWord(pitch)}
							>
								<div
									class="h-3 rounded bg-{pitchColorClass(pitch)}"
									style="width: {(pitchStats[pitch] / Math.max(...Object.values(pitchStats))) * 100}%"
								></div>
								<span class="ml-2 text-sm text-gray-300">{pitchStats[pitch]}</span>
							</button>
						{/each}
					{:else}
						<p class="text-sm text-gray-500">No pitch data available.</p>
					{/if}

					<!-- Keyword Stats -->
					<h3 class="mb-3 mt-4 text-sm font-semibold text-gray-300">Keyword Stats</h3>
					<div class="grid grid-cols-2 gap-2">
						{#each Array.from(selectedKeywords.keys()) as keyword}
							<button
								class="cursor-pointer rounded-lg p-2 text-center transition-colors hover:bg-white/5 {filteredWord === keyword ? 'bg-blue-500/20 ring-1 ring-blue-500' : ''}"
								on:click={() => toggleFilteredWord(keyword)}
							>
								<p class="text-xl font-bold text-blue-400">
									{selectedKeywordCounts.get(keyword) ?? 0}
								</p>
								<p class="text-xs text-gray-400">{keyword}</p>
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<!-- Keyword Selection List -->
		<div class="mb-8 rounded-xl border border-gray-800 bg-gray-900/50 p-6 backdrop-blur-sm">
			<h2 class="mb-4 font-display text-lg font-semibold text-white">Keyword List</h2>
			<div class="grid grid-cols-2 gap-2 md:grid-cols-6">
				{#each Object.entries(keywordCounts).sort(([, a], [, b]) => b - a) as [keyword, count]}
					<label class="flex cursor-pointer items-center space-x-2 rounded-lg border border-gray-700 bg-gray-800 p-2 transition-colors hover:border-gray-600 hover:bg-gray-700">
						<input
							type="checkbox"
							checked={selectedKeywords.has(keyword)}
							on:change={() => toggleKeyword(keyword)}
							disabled={!selectedKeywords.has(keyword) && selectedKeywords.size >= MAX_SELECTED_KEYWORDS}
							class="rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-blue-500"
						/>
						<span class="text-sm font-medium text-blue-400">{keyword}</span>
						<span class="text-xs text-gray-500">({count})</span>
					</label>
				{/each}
			</div>
		</div>
	</div>
</div>

<!-- Modal Overlay -->
<button
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-300 ease-in-out opacity-0 pointer-events-none"
	class:opacity-100={showModal}
	class:pointer-events-auto={showModal}
	on:click={closeModal}
>
	<button class="relative max-w-sm rounded-xl p-4 shadow-2xl" on:click|stopPropagation>
		{#if modalCard}
			<img
				src={modalCard.printings?.[0]?.image_url}
				alt={modalCard.name}
				class="max-w-md w-full rounded-lg object-cover"
			/>
		{/if}
	</button>
</button>

<style>
	.grid-container {
		min-height: 500px;
		overflow: scroll;
	}
	@media (width >= 48rem) {
		.grid-container {
			min-height: 600px;
			overflow: auto;
		}
	}
</style>
