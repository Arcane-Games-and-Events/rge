<script>
	import { onMount, onDestroy } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { ref, set, onValue, off } from 'firebase/database';
	import { db } from '../../../firebaseClient';
	import LazyImage from '../../../lib/LazyImage.svelte';

	// -------------------- CONSTANTS --------------------
	const PACKS = ['Pack 1', 'Pack 2', 'Pack 3'];
	const CARDS_PER_PAGE = 8;
	const MAX_SELECTED_KEYWORDS = 8;
	const PITCH_COLORS = { '1': 'red-500', '2': 'yellow-500', '3': 'blue-500' };
	const RARITY_COLORS = { C: 'gray-600', R: 'blue-600', M: 'red-600', L: 'yellow-600' };

	// -------------------- STATE --------------------
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
	let slideDirection = 'left';
	let previousPage = 1;
	let draftInfo = { name: '', pod: '', seat: '' };
	let format = '';

	// Loading tracking
	let loadedPacks = new Set();
	let cardsLoaded = false;
	let draftInfoLoaded = false;
	let formatLoaded = false;
	$: isLoaded = cardsLoaded && draftInfoLoaded && formatLoaded;

	// -------------------- FIREBASE --------------------
	const firebaseListeners = [];
	const getDbRef = (path) => ref(db, path);

	// -------------------- UTILITIES --------------------
	const chunkArray = (arr, size) =>
		arr.length
			? Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
					arr.slice(i * size, i * size + size)
				)
			: [];

	const pitchColorClass = (pitch) => PITCH_COLORS[pitch] || 'gray-400';
	const rarityColorClass = (rarity) => RARITY_COLORS[rarity] || 'gray-400';

	function getCardKeywords(card) {
		return new Set([
			...(card.types || []),
			...(card.card_keywords || []),
			...(card.ability_and_effect_keywords || []),
			...(card.granted_keywords || []),
			...(card.defense ? [`Block ${card.defense}`] : [])
		]);
	}

	function sortCards(cards) {
		return cards.sort((a, b) => {
			if (!a.pitch && !b.pitch) return a.name.localeCompare(b.name);
			if (!a.pitch) return 1;
			if (!b.pitch) return -1;
			return a.pitch - b.pitch || a.name.localeCompare(b.name);
		});
	}

	// -------------------- DATA HANDLING --------------------
	function calculateStats() {
		keywordCounts = {};
		pitchStats = {};

		allCards.forEach((card) => {
			getCardKeywords(card).forEach((kw) => (keywordCounts[kw] = (keywordCounts[kw] || 0) + 1));
			if (card.pitch) pitchStats[card.pitch] = (pitchStats[card.pitch] || 0) + 1;
		});
	}

	async function removeStaleKeywords() {
		const staleKeywords = [...selectedKeywords.keys()].filter((kw) => !keywordCounts[kw]);
		if (staleKeywords.length) {
			staleKeywords.forEach((kw) => selectedKeywords.delete(kw));
			await set(getDbRef('draftTool/selectedKeywords'), Object.fromEntries(selectedKeywords));
		}
	}

	// -------------------- FILTERING & PAGINATION --------------------
	function applyFilter() {
		const filteredCards = filteredWord
			? allCards.filter(
					(card) => getCardKeywords(card).has(filteredWord) || card.pitch === filteredWord
				)
			: allCards;

		isFiltered = !!filteredWord;
		displayedCards = showImageGrid ? processPaginatedCards(filteredCards) : filteredCards;
	}

	function processPaginatedCards(cards) {
		pagedCards = chunkArray(cards, CARDS_PER_PAGE);
		totalPages = Math.max(1, pagedCards.length);
		currentPage = Math.min(currentPage, totalPages);
		return pagedCards[currentPage - 1] || [];
	}

	// -------------------- FIREBASE SYNC --------------------
	function setupFirebaseListener(path, callback) {
		const dbRef = getDbRef(path);
		const listener = onValue(dbRef, (snapshot) => callback(snapshot.val()));
		firebaseListeners.push({ ref: dbRef, listener });
	}

	function syncState() {
		setupFirebaseListener(
			'draftTool/selectedKeywords',
			(val) => (selectedKeywords = new Map(Object.entries(val || {})))
		);

		setupFirebaseListener('draftTool/filteredWord', (val) => {
			filteredWord = val || '';
			applyFilter();
		});

		setupFirebaseListener('draftTool/showImageGrid', (val) => {
			showImageGrid = val || false;
			applyFilter();
		});

		setupFirebaseListener('draftTool/modalCard', (val) => {
			modalCard = val;
			showModal = !!val;
		});

		setupFirebaseListener('draftTool/currentPage', handlePageChange);
	}

	function handlePageChange(newPage = 1) {
		if (isFirstLoad) {
			currentPage = newPage;
			isFirstLoad = false;
		} else if (newPage !== currentPage) {
			slideDirection = newPage > currentPage ? 'left' : 'right';
		}
		previousPage = currentPage;
		currentPage = newPage;
		applyFilter();
	}

	// -------------------- DATA FETCHING --------------------
	function fetchPackData(pack) {
		const packRef = getDbRef(`draftTool/saved_cards/${pack}`);
		const listener = onValue(packRef, (snapshot) => {
			const data = snapshot.val() || {};
			const packCards = Object.entries(data).map(([id, card]) => ({ id, ...card, pack }));

			// Update cards while maintaining state
			allCards = allCards.filter((c) => c.pack !== pack).concat(packCards);
			allCards = sortCards(allCards);

			loadedPacks.add(pack);
			calculateStats();
			removeStaleKeywords();
			applyFilter();

			if (!cardsLoaded && PACKS.every((p) => loadedPacks.has(p))) {
				cardsLoaded = true;
				checkAllLoaded();
			}
		});

		firebaseListeners.push({ ref: packRef, listener });
	}

	function fetchInitialData() {
		PACKS.forEach(fetchPackData);
		setupFirebaseListener('playerInfo/draft', updateDraftInfo);
		setupFirebaseListener('draftTool/selectedSet', updateFormat);
	}

	function updateDraftInfo(data = {}) {
		draftInfo = { name: data.name || '', pod: data.pod || '', seat: data.seat || '' };
		if (data.name && !draftInfoLoaded) {
			draftInfoLoaded = true;
			checkAllLoaded();
		}
	}

	function updateFormat(val = '') {
		format = val;
		if (val && !formatLoaded) {
			formatLoaded = true;
			checkAllLoaded();
		}
	}

	// -------------------- UI ACTIONS --------------------
	async function toggleFilteredWord(word) {
		const newFilter = filteredWord === word ? '' : word;
		await Promise.all([
			set(getDbRef('draftTool/filteredWord'), newFilter),
			set(getDbRef('draftTool/showImageGrid'), !!newFilter),
			set(getDbRef('draftTool/currentPage'), 1)
		]);
	}

	async function openModal(card) {
		await set(getDbRef('draftTool/modalCard'), card);
	}

	async function closeModal() {
		await set(getDbRef('draftTool/modalCard'), null);
	}

	// -------------------- LIFECYCLE --------------------
	onMount(() => {
		fetchInitialData();
		syncState();
	});

	onDestroy(() => {
		firebaseListeners.forEach(({ ref, listener }) => off(ref, 'value', listener));
	});

	function checkAllLoaded() {
		// Handled reactively by isLoaded
	}

	$: selectedKeywordCounts = new Map(
		[...selectedKeywords.keys()].map((kw) => [
			kw,
			allCards.filter((c) => getCardKeywords(c).has(kw)).length
		])
	);
</script>

<!-- MAIN LAYOUT -->
{#if isLoaded}
	<div
		class="relative mx-auto max-w-7xl text-white min-h-screen bg-gray-800 bg-opacity-80 shadow-lg"
		in:fade={{ duration: 1000 }}
		out:fade={{ duration: 1000 }}
	>
		<!-- HEADER -->
		<div class="bg-gray-900 text-white px-12 py-5 mb-6 rounded">
			<p class="text-3xl font-bold">
				{format} Draft Pool | Pod {draftInfo.pod} Seat {draftInfo.seat}
			</p>
			<p class="mt-1 text-5xl font-bold text-yellow-500">{draftInfo.name}</p>
		</div>

		<!-- MAIN CONTENT -->
		<div class="px-8 flex flex-wrap md:flex-nowrap gap-4 gallery">
			<!-- CARD DISPLAY -->
			<div class="w-full md:w-3/4 mb-8">
				<div class="relative overflow-hidden grid-container">
					{#if showImageGrid}
						<div class="w-full inset-0">
							<div class="max-w-4xl mx-auto h-full">
								{#key currentPage}
									<div
										in:slide={{ direction: slideDirection, duration: 0 }}
										out:slide={{ direction: slideDirection, duration: 300 }}
									>
										<div class="grid grid-cols-3 md:grid-cols-4 gap-x-3 gap-y-2">
											{#each displayedCards as card (card.id)}
												<button
													class="relative shadow overflow-hidden cursor-pointer"
													on:click={() => openModal(card)}
												>
													{#if card.printings?.[0]?.image_url}
														<LazyImage
															src={card.printings[0].image_url}
															alt={card.name}
															class="object-cover w-full h-full"
														/>
													{:else}
														<div class="bg-red-400 text-white p-2">No image for {card.name}</div>
													{/if}
												</button>
											{/each}
										</div>
									</div>
								{/key}
							</div>
						</div>
					{:else}
						<div class="absolute inset-0 mt-3" in:fade out:fade>
							<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
								{#each displayedCards as card (card.id)}
									<button
										class="rounded border-l-8 p-2 bg-gray-100 relative border-{pitchColorClass(
											card.pitch
										)}"
										on:click={() => openModal(card)}
									>
										<div class="px-2 flex justify-between items-center overflow-hidden">
											<p class="text-md font-bold text-gray-800 truncate">{card.name}</p>
											<p class="text-sm font-bold {rarityColorClass(card.printings?.[0]?.rarity)}">
												{card.printings?.[0]?.rarity || 'Unknown'}
											</p>
										</div>
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- STATS PANEL -->
			<div class="w-full h-full pt-4 border-t-4 border-white pb-6 md:w-1/4 mb-8 bg-gray-900">
				<h2 class="text-3xl font-bold py-2 text-center bg-white text-gray-900 mb-4">Pool Stats</h2>

				<!-- PITCH STATS -->
				{#if Object.keys(pitchStats).length}
					<div class="mb-6">
						<h3 class="bg-white bg-opacity-20 py-2 pl-6 text-lg font-bold mb-3 tracking-wide">
							Pitch Distribution
						</h3>
						{#each Object.keys(pitchStats).sort() as pitch}
							<div class="px-4">
								<button
									class="px-3 py-1 w-full flex items-center cursor-pointer
													 {filteredWord === pitch ? 'bg-white bg-opacity-15 rounded-full' : ''}"
									on:click={() => toggleFilteredWord(pitch)}
								>
									<div
										class="h-4 rounded-lg bg-{pitchColorClass(pitch)}"
										style="width: {(pitchStats[pitch] / Math.max(...Object.values(pitchStats))) *
											100}%"
									></div>
									<span class="ml-2 text-lg font-bold">{pitchStats[pitch]}</span>
								</button>
							</div>
						{/each}
					</div>
				{/if}

				<!-- KEYWORD STATS -->
				<div class="mt-6">
					<h3 class="bg-white bg-opacity-20 py-2 pl-6 text-lg font-bold mb-3 tracking-wide">
						Key Stats
					</h3>
					<div class="px-4 grid grid-cols-2 gap-x-4">
						{#each Array.from(selectedKeywords.keys()) as keyword}
							<button
								class="pt-1 pb-2 text-left text-sm text-gray-300 cursor-pointer
													 {filteredWord === keyword ? 'font-bold bg-white bg-opacity-10' : ''}"
								on:click={() => toggleFilteredWord(keyword)}
							>
								<div class="text-center">
									<p class="text-2xl text-green-500 font-bold">
										{selectedKeywordCounts.get(keyword)}
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
{/if}

<!-- MODAL -->
{#if showModal && modalCard}
	<button
		class="max-w-7xl mx-auto fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"
		in:fade
		out:fade
		on:click={closeModal}
	>
		<button class="relative max-w-sm p-4 rounded shadow-lg" on:click|stopPropagation>
			{#if modalCard.printings?.[0]?.image_url}
				<img
					src={modalCard.printings[0].image_url}
					alt={modalCard.name}
					class="object-cover w-full max-w-md rounded"
				/>
			{:else}
				<p class="text-white">No image available for {modalCard.name}.</p>
			{/if}
		</button>
	</button>
{/if}

<style>
	.grid-container {
		min-height: 600px;
	}
	.text-color {
		color: #d8b499;
	}

	@media (min-width: 768px) {
		.gallery {
			display: flex;
			flex-direction: row;
		}
	}
</style>
