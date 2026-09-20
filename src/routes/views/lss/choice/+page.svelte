<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../../firebaseClient';
	import { CHOICE_PATH, toChoice, choiceImage } from '$lib/choice';

	// Who chose first or second, for a 1920x1080 browser source. The artwork was
	// supplied as four full-frame overlays -- the words with an arrow toward the seat
	// -- so each is shown as delivered, laid over the scene at its own position,
	// rather than redrawn. Nothing is shown until a choice is set.
	let choice = '';

	onMount(() => {
		onValue(ref(db, CHOICE_PATH), (snap) => (choice = toChoice(snap.val())));
	});

	$: src = choiceImage(choice);
</script>

<div class="stage">
	<!-- A keyed each rather than an if block with a key block inside: that shape
	     compiles without scheduling its intro in Svelte 4. Keyed on the image, so a
	     change of state crossfades one frame into the next instead of swapping. -->
	{#each src ? [src] : [] as image (image)}
		<img src={image} alt="" transition:fade={{ duration: 250 }} />
	{/each}
</div>

<style>
	/* Pinned to the browser source size so the artwork lands on the pixels it was
	   designed for whatever window is around it. */
	.stage {
		position: relative;
		width: 1920px;
		height: 1080px;
		overflow: hidden;
	}

	.stage img {
		position: absolute;
		inset: 0;
		width: 1920px;
		height: 1080px;
		display: block;
	}
</style>
