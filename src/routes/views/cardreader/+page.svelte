<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';

	let imageUrl = ''; // Holds the current image URL
	let tempImageUrl = ''; // Temporarily holds the new image URL during loading
	let showImage = false; // Controls image visibility
	const displayDuration = 20000; // Image display duration (20 seconds)
	let hideTimeout; // Stores the timeout ID for hiding the image

	const fetchCardImage = () => {
		const cardRef = ref(db, 'cardReaderURL');
		onValue(cardRef, (snapshot) => {
			const newImageUrl = snapshot.val();
			console.log('New image URL fetched:', newImageUrl);

			// If the new image URL is different from the current one, update the image
			if (newImageUrl && newImageUrl !== imageUrl) {
				clearTimeout(hideTimeout); // Clear the existing timeout
				showImage = false; // Immediately hide the current image
				tempImageUrl = newImageUrl; // Set the temporary URL for loading
			}
		});
	};

	// Triggered when the new image is fully loaded
	function handleImageLoad() {
		imageUrl = tempImageUrl;
		showImage = true;

		// Set a new timeout to hide the image after the display duration
		hideTimeout = setTimeout(() => {
			showImage = false;
		}, displayDuration);
	}

	onMount(() => {
		fetchCardImage(); // Start listening to the database on component mount
	});
</script>

<div class="card-container mt-4">
	{#if tempImageUrl}
		<img
			src={tempImageUrl}
			alt={tempImageUrl}
			class="card-image w-72 fade-in-out {showImage ? 'show' : ''}"
			on:load={handleImageLoad}
		/>
	{/if}
</div>

<style>
	.fade-in-out {
		transition: opacity 0.3s;
		opacity: 0;
	}
	.fade-in-out.show {
		opacity: 1;
	}
</style>
