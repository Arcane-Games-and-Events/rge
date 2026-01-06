<script>
	import { onMount } from 'svelte';
	import { ref, set } from 'firebase/database';
	import { db } from '../firebaseClient';
	import cardsData from '$lib/data/cards.json';
	import { getCardImageUrl, getFallbackImageUrl } from '$lib/cardImageUtils';

	let cards = cardsData;
	let selectedCard = null;
	let query = '';
	let error = null;
	let isDropdownOpen = false;
	let filteredCards = [];
	let highlightedIndex = -1;
	let previewImageUrl = '';

	const pitchBorderColor = (pitch) => {
		switch (pitch) {
			case '1':
				return 'border-l-red-500';
			case '2':
				return 'border-l-yellow-500';
			case '3':
				return 'border-l-blue-500';
			default:
				return 'border-l-gray-500';
		}
	};

	const updateFilteredCards = () => {
		filteredCards =
			query.trim() === ''
				? []
				: cards.filter((card) => card.name.toLowerCase().includes(query.toLowerCase()));
		highlightedIndex = -1;
	};

	const handleCardChange = async (card) => {
		selectedCard = card;
		query = card.name;
		isDropdownOpen = false;
		if (card) {
			const cardUrl = getCardImageUrl(card);
			previewImageUrl = cardUrl || '';
			if (cardUrl) {
				// Add timestamp to force browser to reload image
				const urlWithTimestamp = `${cardUrl}${cardUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
				try {
					await set(ref(db, 'cardReaderURL'), urlWithTimestamp);
				} catch (err) {
					console.error('Error saving image URL to Firebase:', err);
					error = err.message;
				}
			}
		}
	};

	const handlePreviewImageError = () => {
		if (selectedCard) {
			const fallbackUrl = getFallbackImageUrl(selectedCard);
			if (fallbackUrl && fallbackUrl !== previewImageUrl) {
				previewImageUrl = fallbackUrl;
				// Also update Firebase with the fallback URL
				const urlWithTimestamp = `${fallbackUrl}${fallbackUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
				set(ref(db, 'cardReaderURL'), urlWithTimestamp).catch((err) => {
					console.error('Error updating to fallback URL:', err);
				});
			}
		}
	};

	const handleClear = async () => {
		query = '';
		filteredCards = [];
		selectedCard = null;
		previewImageUrl = '';
		isDropdownOpen = false;
		try {
			await set(ref(db, 'cardReaderURL'), '');
		} catch (err) {
			console.error('Error clearing card URL:', err);
		}
	};

	const showCard = async () => {
		if (!selectedCard) return;
		const cardUrl = getCardImageUrl(selectedCard);
		if (!cardUrl) return;
		previewImageUrl = cardUrl;
		// Add timestamp to force browser to reload image
		const urlWithTimestamp = `${cardUrl}${cardUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
		try {
			await set(ref(db, 'cardReaderURL'), urlWithTimestamp);
		} catch (err) {
			console.error('Error showing card:', err);
			error = err.message;
		}
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
					{#each filteredCards.slice(0, 15) as card, index}
						<li
							class="cursor-pointer select-none py-2 px-2 text-sm border-l-2 {pitchBorderColor(card.pitch)} {highlightedIndex === index ? 'bg-blue-600/50' : 'hover:bg-gray-700'}"
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
