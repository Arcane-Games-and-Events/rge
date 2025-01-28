<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';
	import { fade } from 'svelte/transition';
	import LazyImage from '../../../lib/LazyImage.svelte';

	// --------------------
	// State
	// --------------------
	let packOneCards = [];
	let displayMode = 'list'; // 'list' or 'preview'
	let previewCard = null; // The newly added card to preview
	let previewTimeout = null; // Handle for the 15s timeout
	let isFirstSnapshot = true; // Flag to skip preview on initial load

	// Track previous card IDs to detect new additions
	let prevIDs = new Set();

	// --------------------
	// Utility Functions
	// --------------------
	function pitchColorClass(pitch) {
		switch (pitch) {
			case '1':
				return 'border-red-500';
			case '2':
				return 'border-yellow-500';
			case '3':
				return 'border-blue-500';
			default:
				return 'border-gray-400';
		}
	}

	function rarityColorClass(rarity) {
		switch (rarity) {
			case 'C':
				return 'text-gray-300';
			case 'R':
				return 'text-blue-500';
			case 'M':
				return 'text-red-500';
			case 'L':
				return 'text-yellow-400';
			default:
				return 'text-gray-400';
		}
	}

	// --------------------
	// Firebase Listener
	// --------------------
	function listenToPackOne() {
		const packOneRef = ref(db, 'draftTool/saved_cards/Pack 1');

		onValue(packOneRef, (snapshot) => {
			const data = snapshot.val() || {};
			const updatedCards = Object.entries(data).map(([id, card]) => ({ id, ...card }));

			// Update the main list
			packOneCards = updatedCards;

			// Create a set of current IDs
			const updatedIDs = new Set(updatedCards.map((c) => c.id));

			if (isFirstSnapshot) {
				// On initial load, just display the list without triggering preview
				isFirstSnapshot = false;
				displayMode = 'list';
				previewCard = null;
				prevIDs = updatedIDs;
				return;
			}

			// Identify newly added IDs
			const newlyAdded = [...updatedIDs].filter((id) => !prevIDs.has(id));

			// Update prevIDs for future comparisons
			prevIDs = updatedIDs;

			if (newlyAdded.length > 0) {
				// Select the last newly added card for preview
				const lastNewID = newlyAdded[newlyAdded.length - 1];
				const newCardObj = updatedCards.find((c) => c.id === lastNewID);

				// If currently in 'preview' mode, update the preview to the new card
				if (displayMode === 'preview') {
					// Clear existing timeout
					if (previewTimeout) {
						clearTimeout(previewTimeout);
					}
				} else {
					// Switch to 'preview' mode
					displayMode = 'preview';
				}

				// Set the new preview card
				previewCard = newCardObj;

				// Start/reset the 15-second timer
				if (previewTimeout) {
					clearTimeout(previewTimeout);
				}
				previewTimeout = setTimeout(() => {
					displayMode = 'list';
					previewCard = null;
					previewTimeout = null;
				}, 7000);
			}
			// If no new additions, do nothing (remain in current mode)
		});
	}

	onMount(() => {
		listenToPackOne();
	});

	onDestroy(() => {
		// Clean up the timeout when component is destroyed
		if (previewTimeout) {
			clearTimeout(previewTimeout);
		}
	});
</script>

<!-- 
	A relative container to overlay the 'list' and 'preview' without causing layout shifts.
-->
<div class="relative mx-auto max-w-lg text-white">
	<!-- The LIST (absolute, overlaps the same space as the preview) -->
	{#if displayMode === 'list'}
		<div
			class="absolute w-full center p-4"
			in:fade={{ duration: 500 }}
			out:fade={{ duration: 100 }}
		>
			{#if packOneCards.length > 0}
				{#each packOneCards.reverse() as card}
					<div
						class="flex justify-between items-center border-l-8 py-2 px-4 m-1
						       {pitchColorClass(card.pitch)}"
					>
						<p class="text-white text-2xl">{card.name}</p>
						<p class="text-xl {rarityColorClass(card.printings?.[0]?.rarity)}">
							{card.printings?.[0]?.rarity || 'Unknown'}
						</p>
					</div>
				{/each}
			{:else}{/if}
		</div>
	{/if}

	<!-- The PREVIEW (absolute, overlaps the same space as the list) -->
	{#if displayMode === 'preview'}
		<div class="absolute center p-8" in:fade={{ duration: 500 }} out:fade={{ duration: 100 }}>
			{#if previewCard && previewCard.printings?.[0]?.image_url}
				<div class="">
					<LazyImage src={previewCard.printings[0].image_url} alt={previewCard.name} />
				</div>
			{:else}
				<p></p>
			{/if}
		</div>
	{/if}
</div>
