<script>
	import { onMount } from 'svelte';
	import { ref, set, onValue } from 'firebase/database';
	import { db } from '../../firebaseClient';

	const packs = ['Pack 1', 'Pack 2', 'Pack 3'];

	let allCards = [];
	let displayedCards = []; // Cards to display based on filter
	let keywordCounts = {};
	let pitchStats = {};
	let selectedKeywords = new Map(); // Map of selected keywords and their counts
	let filteredWord = ''; // The current filtered word (e.g., pitch or keyword)
	let showImageGrid = false; // Determines if the card images grid should be displayed
	let currentPage = 1; // Current page for the gallery
	let totalPages = 1; // Total pages for pagination

	const cardsPerPage = 8; // 4 images per row, 2 rows

	onMount(() => {
		fetchCards();
		syncFilteredWord();
		syncSelectedKeywords();
		syncShowImageGrid();
		syncCurrentPage();
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

				// Sort cards by pitch and alphabetically by name
				combinedCards.sort((a, b) => {
					if (!a.pitch && !b.pitch) return a.name.localeCompare(b.name);
					if (!a.pitch) return 1;
					if (!b.pitch) return -1;
					if (a.pitch !== b.pitch) return a.pitch - b.pitch;
					return a.name.localeCompare(b.name);
				});

				allCards = combinedCards;
				applyFilter(); // Reapply filter after fetching cards
				calculateStats();
			});
		});
	};

	const calculateStats = () => {
		const keywordStats = {};
		const pitchStatsTemp = {};

		allCards.forEach((card) => {
			// Calculate keywords
			const keywords = new Set([
				...(card.types || []),
				...(card.card_keywords || []),
				...(card.defense ? [`Block ${card.defense}`] : [])
			]);

			keywords.forEach((keyword) => {
				keywordStats[keyword] = (keywordStats[keyword] || 0) + 1;
			});

			// Calculate pitch stats
			if (card.pitch) {
				pitchStatsTemp[card.pitch] = (pitchStatsTemp[card.pitch] || 0) + 1;
			}
		});

		keywordCounts = keywordStats;
		pitchStats = pitchStatsTemp;
	};

	const syncSelectedKeywords = () => {
		const selectedRef = ref(db, 'draftTool/selectedKeywords');
		onValue(selectedRef, (snapshot) => {
			const data = snapshot.val() || {};
			selectedKeywords = new Map(Object.entries(data));
		});
	};

	const syncFilteredWord = () => {
		const filteredWordRef = ref(db, 'draftTool/filteredWord');
		onValue(filteredWordRef, (snapshot) => {
			const data = snapshot.val() || '';
			filteredWord = data;
			applyFilter();
		});
	};

	const syncShowImageGrid = () => {
		const showGridRef = ref(db, 'draftTool/showImageGrid');
		onValue(showGridRef, (snapshot) => {
			const data = snapshot.val() || false;
			showImageGrid = data;
		});
	};

	const syncCurrentPage = () => {
		const pageRef = ref(db, 'draftTool/currentPage');
		onValue(pageRef, (snapshot) => {
			currentPage = snapshot.val() || 1;
			applyFilter(); // Ensure displayedCards updates when the page changes
		});
	};

	const toggleFilteredWord = async (word) => {
		const filteredWordRef = ref(db, 'draftTool/filteredWord');
		const showGridRef = ref(db, 'draftTool/showImageGrid');
		const pageRef = ref(db, 'draftTool/currentPage');

		if (filteredWord === word) {
			// Reset the filter if the same word is selected again
			filteredWord = '';
			showImageGrid = false;
			currentPage = 1; // Reset to the first page
			await set(filteredWordRef, '');
			await set(showGridRef, false);
			await set(pageRef, 1);
		} else {
			// Set the new filtered word
			filteredWord = word;
			showImageGrid = true;
			currentPage = 1; // Reset to the first page
			await set(filteredWordRef, word);
			await set(showGridRef, true);
			await set(pageRef, 1);
		}

		applyFilter(); // Apply the filter after changes
	};

	const applyFilter = () => {
		let filteredCards = [];

		// If a filter is applied, filter the cards; otherwise, include all cards
		if (filteredWord) {
			filteredCards = allCards.filter((card) => {
				const cardKeywords = new Set([
					...(card.types || []),
					...(card.card_keywords || []),
					...(card.defense ? [`Block ${card.defense}`] : [])
				]);
				return cardKeywords.has(filteredWord) || card.pitch === filteredWord;
			});
		} else {
			filteredCards = allCards; // No filter, show all cards
		}

		// Handle `showImageGrid` being false with no filter
		if (!filteredWord && !showImageGrid) {
			displayedCards = allCards; // Show all cards without pagination
			return;
		}

		// Update total pages and adjust the current page if needed
		totalPages = Math.max(1, Math.ceil(filteredCards.length / cardsPerPage));
		currentPage = Math.min(currentPage, totalPages);

		// Calculate the slice of cards to display for the current page
		const startIndex = (currentPage - 1) * cardsPerPage;
		const endIndex = startIndex + cardsPerPage;
		displayedCards = filteredCards.slice(startIndex, endIndex);
	};

	let galleryKey = 0; // Unique key to force re-render of gallery

	const changePage = async (newPage) => {
		if (newPage >= 1 && newPage <= totalPages) {
			currentPage = newPage;

			// Update the unique key to force re-render
			galleryKey++;

			// Sync with Firebase
			const pageRef = ref(db, 'draftTool/currentPage');
			await set(pageRef, currentPage);

			applyFilter();
		}
	};

	const toggleKeyword = async (keyword) => {
		const selectedRef = ref(db, 'draftTool/selectedKeywords');
		const updatedSelected = new Map(selectedKeywords);

		if (updatedSelected.has(keyword)) {
			updatedSelected.delete(keyword); // Remove the keyword if already selected
		} else if (updatedSelected.size < 8) {
			updatedSelected.set(keyword, keywordCounts[keyword] || 0); // Add the keyword if space allows
		}

		selectedKeywords = updatedSelected; // Update the local selected keywords map
		await set(selectedRef, Object.fromEntries(updatedSelected)); // Sync changes to Firebase
	};
</script>

<div class="px-4 py-6 bg-gray-800 text-white">
	<div class="max-w-7xl container mx-auto">
		<div class="flex flex-wrap md:flex-nowrap gap-8 gallery">
			<!-- Image Gallery for Displayed Cards -->
			<div class="w-full md:w-3/4 mb-8">
				{#if showImageGrid}
					<!-- Image Grid View -->
					<div key={galleryKey} class="max-w-4xl grid grid-cols-4 gap-4">
						{#each displayedCards as card}
							<div class="relative shadow overflow-hidden">
								<img
									src={card.printings?.[0]?.image_url}
									alt={card.name}
									class="object-cover w-full h-full"
								/>
							</div>
						{/each}
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
					<!-- Default List View -->
					<div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
						{#each displayedCards as card}
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
								<div class="px-2 flex justify-between items-center overflow-hidden">
									<div>
										<p class="text-sm font-bold text-gray-800 truncate ...">
											{card.name}
										</p>
									</div>
									<p
										class={`text-sm font-bold ${
											card.printings?.[0]?.rarity === 'C'
												? 'text-gray-600'
												: card.printings?.[0]?.rarity === 'R'
													? 'text-blue-600'
													: card.printings?.[0]?.rarity === 'M'
														? 'text-red-600'
														: card.printings?.[0]?.rarity === 'L'
															? 'text-yellow-600'
															: 'text-gray-400'
										}`}
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

				<!-- Pitch Bars -->
				{#if Object.keys(pitchStats).length > 0}
					<h3 class="text-lg font-bold mb-2">Pitch Distribution</h3>
					{#each Object.keys(pitchStats).sort((a, b) => a - b) as pitch}
						<button
							class={`w-full block flex items-center mb-2 cursor-pointer ${
								filteredWord === pitch ? 'ring-2 ring-green-400' : ''
							}`}
							on:click={() => toggleFilteredWord(pitch)}
						>
							<div
								class={`h-4 rounded-xl ${
									pitch === '1'
										? 'bg-red-500'
										: pitch === '2'
											? 'bg-yellow-500'
											: pitch === '3'
												? 'bg-blue-500'
												: 'bg-gray-400'
								}`}
								style={`width: ${
									(pitchStats[pitch] / Math.max(...Object.values(pitchStats))) * 100
								}%`}
							></div>
							<span class="ml-2">{`${pitchStats[pitch]}`}</span>
						</button>
					{/each}
				{:else}
					<p class="text-sm text-gray-400">No pitch data available.</p>
				{/if}

				<!-- Keyword Stats -->
				<h3 class="text-lg font-bold mt-4 mb-2">Keyword Stats</h3>
				{#each Array.from(selectedKeywords) as [keyword, count]}
					<button
						class={`inline-block w-full text-left text-sm text-gray-300 cursor-pointer hover:text-green-400 ${
							filteredWord === keyword ? 'text-green-500 font-bold' : ''
						}`}
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
				{#each Object.entries(keywordCounts).sort(([, countA], [, countB]) => countB - countA) as [keyword, count]}
					<label class="flex items-center space-x-2 bg-gray-900 p-2 rounded shadow cursor-pointer">
						<input
							type="checkbox"
							checked={selectedKeywords.has(keyword)}
							on:change={() => toggleKeyword(keyword)}
							disabled={!selectedKeywords.has(keyword) && selectedKeywords.size >= 8}
						/>
						<span class="text-green-400 text-xl font-bold">{keyword}</span>
						<span class="text-gray-300 text-xs">({count})</span>
					</label>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.gallery {
		height: 700px;
	}
</style>
