<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';

	let eventText = '';

	onMount(() => {
		const eventTextRef = ref(db, 'eventText');
		onValue(eventTextRef, (snapshot) => {
			eventText = snapshot.val() ?? '';
		});
	});
</script>

<div class="event-text-container">
	<p class="event-text">{eventText}</p>
</div>

<style>
	.event-text-container {
		display: flex;
		justify-content: flex-start;
		align-items: flex-start;
		min-height: 100vh;
		padding: 1rem;
	}

	.event-text {
		font-size: 1.25rem;
		font-weight: bold;
		color: #d8b499;
		text-align: left;
	}
</style>
