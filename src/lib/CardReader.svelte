<script>
	import { onMount } from 'svelte';
	import { ref, set } from 'firebase/database';
	import { db } from '../firebaseClient';
	import debounce from 'lodash.debounce';

	// Card data comes from `@flesh-and-blood/cards` via /api/cards/search, which
	// runs the `@flesh-and-blood/search` engine server-side. The dataset is far
	// too large to ship to the browser, so the endpoint returns trimmed results.
	let selectedCard = null;
	let query = '';
	let error = null;
	let isDropdownOpen = false;
	let filteredCards = [];
	let highlightedIndex = -1;
	let previewImageUrl = '';
	let isSearching = false;

	// Remaining image URLs to try for the selected card, walked on load failure
	let imageFallbacks = [];
	let latestSearchId = 0;

	const pitchBorderColor = (pitch) => {
		switch (pitch) {
			case 1:
				return 'border-l-red-500';
			case 2:
				return 'border-l-yellow-500';
			case 3:
				return 'border-l-blue-500';
			default:
				return 'border-l-gray-500';
		}
	};

	const runSearch = async (text) => {
		const searchId = ++latestSearchId;
		if (text.trim() === '') {
			filteredCards = [];
			isSearching = false;
			return;
		}

		try {
			const response = await fetch(`/api/cards/search?q=${encodeURIComponent(text)}`);
			const data = await response.json();
			// Ignore responses that arrived out of order
			if (searchId !== latestSearchId) return;
			if (!response.ok) throw new Error(data.error || 'Search failed');
			filteredCards = data.results || [];
			highlightedIndex = -1;
			error = null;
		} catch (err) {
			if (searchId !== latestSearchId) return;
			console.error('Error searching cards:', err);
			error = err.message;
			filteredCards = [];
		} finally {
			if (searchId === latestSearchId) isSearching = false;
		}
	};

	const debouncedSearch = debounce(runSearch, 200);

	const updateFilteredCards = () => {
		highlightedIndex = -1;
		isSearching = query.trim() !== '';
		debouncedSearch(query);
	};

	const publishImageUrl = async (cardUrl) => {
		// Add timestamp to force browser to reload image
		const urlWithTimestamp = `${cardUrl}${cardUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
		try {
			await set(ref(db, 'cardReaderURL'), urlWithTimestamp);
			error = null;
		} catch (err) {
			console.error('Error saving image URL to Firebase:', err);
			error = err.message;
		}
	};

	const handleCardChange = async (card) => {
		selectedCard = card;
		query = card.name;
		isDropdownOpen = false;
		if (!card) return;

		const candidates = card.imageUrlCandidates || [];
		previewImageUrl = card.imageUrl || candidates[0] || '';
		imageFallbacks = candidates.filter((url) => url !== previewImageUrl);

		if (previewImageUrl) {
			await publishImageUrl(previewImageUrl);
		}
	};

	const handlePreviewImageError = () => {
		const nextUrl = imageFallbacks.shift();
		if (!nextUrl) {
			error = `No working image found for ${selectedCard?.name ?? 'card'}`;
			return;
		}
		previewImageUrl = nextUrl;
		publishImageUrl(nextUrl);
	};

	const handleClear = async () => {
		query = '';
		filteredCards = [];
		selectedCard = null;
		previewImageUrl = '';
		imageFallbacks = [];
		isDropdownOpen = false;
		error = null;
		try {
			await set(ref(db, 'cardReaderURL'), '');
		} catch (err) {
			console.error('Error clearing card URL:', err);
		}
	};

	const showCard = async () => {
		if (!selectedCard) return;
		const candidates = selectedCard.imageUrlCandidates || [];
		const cardUrl = selectedCard.imageUrl || candidates[0];
		if (!cardUrl) return;
		previewImageUrl = cardUrl;
		imageFallbacks = candidates.filter((url) => url !== cardUrl);
		await publishImageUrl(cardUrl);
	};

	const handleKeyDown = (event) => {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				if (highlightedIndex < filteredCards.length - 1) {
					highlightedIndex += 1;
				}
				break;
			case 'ArrowUp':
				event.preventDefault();
				if (highlightedIndex > 0) {
					highlightedIndex -= 1;
				}
				break;
			case 'Enter':
				event.preventDefault();
				if (highlightedIndex >= 0 && highlightedIndex < filteredCards.length) {
					handleCardChange(filteredCards[highlightedIndex]);
				}
				break;
		}

		if (highlightedIndex !== -1) {
			const option = document.getElementById(`option-${highlightedIndex}`);
			if (option) {
				option.scrollIntoView({ block: 'nearest' });
			}
		}
	};

	const handleClickOutside = (event) => {
		if (!event.target.closest('.combobox')) {
			isDropdownOpen = false;
		}
	};

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => {
			debouncedSearch.cancel();
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<div class="space-y-2 text-white">
	<!-- Search Row -->
	<div class="flex items-center gap-1.5">
		<div class="relative combobox flex-1">
			<input
				type="text"
				placeholder="Search card..."
				class="w-full px-2 py-2 rounded text-sm bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
				role="combobox"
				aria-controls="options"
				aria-expanded={isDropdownOpen}
				on:input={(e) => {
					query = e.target.value;
					updateFilteredCards();
					isDropdownOpen = true;
				}}
				on:focus={() => (isDropdownOpen = true)}
				on:keydown={handleKeyDown}
				bind:value={query}
			/>

			{#if isDropdownOpen && filteredCards.length > 0}
				<ul
					class="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border border-gray-700 bg-gray-800 py-1 shadow-xl"
					id="options"
					role="listbox"
				>
					{#each filteredCards as card, index (card.cardIdentifier)}
						<li
							class="cursor-pointer select-none py-2 px-2 text-sm border-l-2 {pitchBorderColor(
								card.pitch
							)} {highlightedIndex === index ? 'bg-blue-600/50' : 'hover:bg-gray-700'}"
							id={'option-' + index}
							role="option"
							aria-selected={highlightedIndex === index}
							on:mouseenter={() => (highlightedIndex = index)}
						>
							<button
								type="button"
								class="w-full text-left truncate"
								on:click={() => handleCardChange(card)}
							>
								{card.name}
							</button>
						</li>
					{/each}
				</ul>
			{:else if isDropdownOpen && isSearching}
				<div
					class="absolute z-10 mt-1 w-full rounded border border-gray-700 bg-gray-800 py-2 px-2 text-xs text-gray-400 shadow-xl"
				>
					Searching...
				</div>
			{/if}
		</div>
		{#if selectedCard}
			<button
				type="button"
				class="px-3 py-2 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors flex-shrink-0"
				on:click={showCard}
			>
				Show
			</button>
		{/if}
		<button
			type="button"
			class="px-3 py-2 rounded text-xs bg-gray-800 text-gray-400 hover:bg-red-600 hover:text-white transition-colors flex-shrink-0"
			on:click={handleClear}
		>
			Clear
		</button>
	</div>

	<!-- Card Preview -->
	{#if selectedCard && previewImageUrl}
		<div class="flex justify-center pt-2">
			<img
				src={previewImageUrl}
				alt={selectedCard.name}
				class="w-96 sm:w-[28rem] rounded shadow-lg"
				loading="lazy"
				on:error={handlePreviewImageError}
			/>
		</div>
	{/if}

	{#if error}
		<div class="text-xs text-red-400 mt-2">{error}</div>
	{/if}
</div>
