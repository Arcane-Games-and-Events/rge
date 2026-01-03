<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';

	let currentUrl = '';
	let pendingUrl = '';
	let showImage = false;
	const displayDuration = 20000;
	const fadeTime = 300;
	let hideTimeout;

	async function showNewCard(url) {
		// If a card is currently showing, fade it out first
		if (showImage) {
			showImage = false;
			await new Promise(r => setTimeout(r, fadeTime));
		}

		// Now set the new URL and wait for it to load
		currentUrl = url;
	}

	onMount(() => {
		if (!db) return;

		const cardRef = ref(db, 'cardReaderURL');
		onValue(cardRef, (snapshot) => {
			const newUrl = snapshot.val();

			clearTimeout(hideTimeout);

			if (newUrl && newUrl !== '') {
				pendingUrl = newUrl;
				showNewCard(newUrl);
			} else {
				// URL cleared - fade out
				showImage = false;
			}
		});
	});

	function handleImageLoad() {
		// Only show if this is still the pending URL (not stale)
		if (currentUrl === pendingUrl) {
			showImage = true;
			hideTimeout = setTimeout(() => {
				showImage = false;
			}, displayDuration);
		}
	}
</script>

<div class="card-container mt-4">
	{#if currentUrl}
		<img
			src={currentUrl}
			alt="Card"
			class="card-image w-72 fade-in-out {showImage ? 'show' : ''}"
			on:load={handleImageLoad}
		/>
	{/if}
</div>

<style>
	.fade-in-out {
		transition: opacity 0.3s ease-in-out;
		opacity: 0;
	}
	.fade-in-out.show {
		opacity: 1;
	}
</style>
