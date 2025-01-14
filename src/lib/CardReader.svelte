<script>
	import { onMount } from 'svelte';
	import { ref, set } from 'firebase/database';
	import { db } from '../firebaseClient';
	import cardsData from '$lib/data/cards.json';

	let cards = cardsData;
	let selectedCard = null;
	let query = '';
	let error = null;
	let isDropdownOpen = false;
	let filteredCards = [];
	let highlightedIndex = -1;

	const pitchBorderColor = (pitch) => {
		switch (pitch) {
			case '1':
				return 'border-red-500';
			case '2':
				return 'border-yellow-500';
			case '3':
				return 'border-blue-500';
			default:
				return 'border-gray-500';
		}
	};

	const updateFilteredCards = () => {
		filteredCards =
			query.trim() === ''
				? []
				: cards.filter((card) => card.name.toLowerCase().includes(query.toLowerCase()));
		highlightedIndex = -1; // Reset the highlighted index whenever the filtered cards are updated
	};

	const handleCardChange = async (card) => {
		selectedCard = card;
		isDropdownOpen = false;
		if (card) {
			const cardUrl = card.printings[0].image_url;
			try {
				await set(ref(db, 'cardReaderURL'), cardUrl);
			} catch (err) {
				console.error('Error saving image URL to Firebase:', err);
				error = err.message;
			}
		} else {
			console.log('No card selected');
		}
	};

	const handleClear = () => {
		query = '';
		filteredCards = [];
		selectedCard = null;
		isDropdownOpen = false;
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
			default:
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

<div class="w-full mt-4 sm:mt-0 p-4 border-2 border-gray-200 rounded-lg">
	<div class="mb-4">
		<label for="combobox" class="block text-sm font-medium leading-6 text-gray-900"
			>Select a Card</label
		>
		<div class="relative mt-2 combobox">
			<input
				id="combobox"
				type="text"
				class="w-full rounded-md border-0 bg-white py-3 pl-3 pr-12 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
				role="combobox"
				aria-controls="options"
				aria-expanded={isDropdownOpen.toString()}
				on:input={(e) => {
					query = e.target.value;
					updateFilteredCards();
					isDropdownOpen = true;
				}}
				on:focus={() => (isDropdownOpen = true)}
				on:keydown={handleKeyDown}
				bind:value={query}
			/>
			<button
				type="button"
				class="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none"
				on:click={() => (isDropdownOpen = !isDropdownOpen)}
			>
				<svg
					class="h-5 w-5 text-gray-400"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>

			{#if isDropdownOpen && filteredCards.length > 0}
				<ul
					class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
					id="options"
					role="listbox"
				>
					{#each filteredCards.slice(0, 20) as card, index}
						<li
							class="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 border-l-8 {pitchBorderColor(
								card.pitch
							)} {highlightedIndex === index ? 'bg-indigo-600 text-white' : ''}"
							id={'option-' + index}
							role="option"
							aria-selected="true"
							tabindex="-1"
						>
							<button
								type="button"
								class="w-full text-left flex items-center"
								on:click={() => handleCardChange(card)}
								on:keydown={(event) => handleKeyDown(event, card)}
							>
								<div class="w-2 h-full mr-2 {pitchBorderColor(card.pitch)}"></div>
								<div class="flex-grow">
									<span class="block truncate">{card.name}</span>
								</div>
								{#if selectedCard && selectedCard.unique_id === card.unique_id}
									<span class="absolute inset-y-0 right-0 flex items-center pr-4 text-indigo-600">
										<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
											<path
												fill-rule="evenodd"
												d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
												clip-rule="evenodd"
											/>
										</svg>
									</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
		<button
			type="button"
			class="w-full mt-2 pt-3 pb-2 rounded bg-red-200 text-red-900"
			on:click={handleClear}
		>
			Clear
		</button>

		{#if selectedCard}
			<div class="mt-6">
				<img
					src={selectedCard.printings[0].image_url}
					alt={selectedCard.name}
					class="block w-full mx-auto rounded-md shadow-md"
					loading="lazy"
				/>
			</div>
		{/if}
		{#if error}
			<div class="text-red-500 mt-5">{error}</div>
		{/if}
	</div>
</div>
