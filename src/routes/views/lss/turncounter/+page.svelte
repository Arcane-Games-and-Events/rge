<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../../firebaseClient';
	import { TURN_COUNTER_PATH, MIN_TURN, toTurn } from '$lib/turnCounter';

	let turn = MIN_TURN;

	onMount(() => {
		onValue(ref(db, TURN_COUNTER_PATH), (snap) => {
			if (snap.val() !== null) turn = toTurn(snap.val());
		});
	});
</script>

<div class="turn-counter">
	<p class="turn-label">Turn</p>
	<p class="turn-number">{turn}</p>
</div>

<style>
	.turn-counter {
		text-align: left;
		padding: 1rem;
	}

	.turn-label {
		font-size: 1.25rem;
		font-weight: bold;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}

	.turn-number {
		font-size: 5rem;
		font-weight: bold;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
</style>
