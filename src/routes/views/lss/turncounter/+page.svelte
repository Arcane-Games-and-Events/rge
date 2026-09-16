<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../../firebaseClient';
	import { TURN_COUNTER_PATH, MIN_TURN, toTurn } from '$lib/turnCounter';

	let turn = MIN_TURN;

	onMount(() => {
		onValue(ref(db, TURN_COUNTER_PATH), (snap) => {
			if (snap.val() !== null) turn = toTurn(snap.val());
		});
	});

	// The outgoing number leaves while the incoming one is already arriving, so
	// the slot never goes blank -- the two opacities never sum below about 0.5.
	// The short delay keeps the two digits from sitting on top of each other at
	// full strength, which reads as a smudge rather than a change.
	const OUT_MS = 200;
	const IN_MS = 200;
	const IN_DELAY_MS = 100;
</script>

<div class="turn-counter">
	<p class="turn-label">Turn</p>
	<p class="turn-number">
		{#key turn}
			<span
				class="digits"
				in:fade={{ duration: IN_MS, delay: IN_DELAY_MS }}
				out:fade={{ duration: OUT_MS }}>{turn}</span
			>
		{/key}
	</p>
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

	/* Fixed box with the digits stacked inside it: during a change both numbers
	   are in the DOM at once, and in normal flow the second would push the first
	   around. */
	.turn-number {
		position: relative;
		height: 5rem;
		font-size: 5rem;
		font-weight: bold;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.digits {
		position: absolute;
		left: 0;
		top: 0;
	}
</style>
