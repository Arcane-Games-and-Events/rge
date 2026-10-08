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
			await new Promise((r) => setTimeout(r, fadeTime));
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

	function handleImageError() {
		// Hide the image if it fails to load
		showImage = false;
		console.error('Failed to load card image:', currentUrl);
	}
</script>

<!--
	The card fills the browser source, whatever size it is given, keeping its
	own proportion. Size the source in OBS to the box the card should occupy
	on the scene, at 1:1 with no transform scaling, and the browser downsamples
	the largest art the card host serves straight to that box in one pass.
-->
<div class="stage">
	{#if currentUrl}
		<img
			src={currentUrl}
			alt="Card"
			class="card-image"
			class:show={showImage}
			decoding="async"
			on:load={handleImageLoad}
			on:error={handleImageError}
		/>
	{/if}
</div>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		height: 100%;
		overflow: hidden;
		background: transparent;
	}

	.stage {
		position: fixed;
		inset: 0;
	}

	.card-image {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: center;
		image-rendering: auto;
		transition: opacity 0.3s ease-in-out;
		opacity: 0;
	}

	.card-image.show {
		opacity: 1;
	}
</style>
