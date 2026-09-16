<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../../firebaseClient';
	import ActivePlayerIcon from '$lib/ActivePlayerIcon.svelte';
	import { ACTIVE_PLAYER_PATH, toActivePlayer } from '$lib/activePlayer';

	let active = '';

	onMount(() => {
		onValue(ref(db, ACTIVE_PLAYER_PATH), (snap) => (active = toActivePlayer(snap.val())));
	});

	// A fixed slot per seat so the marker appears in the same place every time and
	// the other side does not shift when one is empty.
	const seats = [
		{ id: 'p1', side: 'left', align: 'align-left' },
		{ id: 'p2', side: 'right', align: 'align-right' }
	];

	// Each seat fades independently, so passing the turn cross-fades: the old
	// marker leaves while the new one arrives. Slow enough to read as a
	// deliberate hand-off on camera, short enough not to lag the play.
	const FADE_MS = 300;
</script>

<div class="container mx-auto pt-12">
	{#each seats as seat (seat.id)}
		<div class="marker-slot {seat.align}">
			{#if active === seat.id}
				<!-- The transition needs a DOM element of its own; it cannot go on a component. -->
				<div class="marker" transition:fade={{ duration: FADE_MS }}>
					<ActivePlayerIcon side={seat.side} size={64} />
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.marker-slot {
		width: 18rem;
		height: 5rem;
		margin: 0 auto;
		display: flex;
		align-items: center;
	}

	.marker {
		display: flex;
	}

	.align-left {
		justify-content: flex-start;
	}

	.align-right {
		justify-content: flex-end;
	}
</style>
