<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../../firebaseClient';
	import { heroes, loadHeroes } from '$lib/heroes';
	import { heroCardUrl } from '$lib/heroCard';

	// Hero cards for both seats, sized for a 1920x1080 browser source: the art is
	// 798x1080, so two sit side by side against the outer edges with the gap between
	// them. A seat showing nothing leaves the other exactly where it was.
	let players = { p1: '', p2: '' };

	// Whether a hero is young cannot be read off the name -- 28 young heroes carry a
	// subtitle and 8 adults do not -- so it comes from the card data via /api/heroes.
	$: youngNames = new Set($heroes.filter((h) => h.young).map((h) => h.name));

	const cardFor = (hero) => (hero && youngNames.has(hero) ? heroCardUrl(hero) : '');

	$: cards = { p1: cardFor(players.p1), p2: cardFor(players.p2) };

	onMount(() => {
		loadHeroes();
		for (const seat of ['p1', 'p2']) {
			onValue(ref(db, `playerInfo/${seat}/hero`), (snap) => {
				players[seat] = snap.val() || '';
			});
		}
	});

	const SEATS = [
		{ id: 'p1', side: 'left' },
		{ id: 'p2', side: 'right' }
	];
</script>

<div class="stage">
	{#each SEATS as seat (seat.id)}
		<div class="slot {seat.side}">
			{#if cards[seat.id]}
				<!-- Keyed on the URL so a hero change swaps the art rather than leaving the
				     old image up while the new one decodes. -->
				{#key cards[seat.id]}
					<img
						src={cards[seat.id]}
						alt=""
						transition:fade={{ duration: 220 }}
						on:error={(e) => (e.currentTarget.style.visibility = 'hidden')}
					/>
				{/key}
			{/if}
		</div>
	{/each}
</div>

<style>
	/* Fixed to the browser source size rather than the viewport, so the art lands on
	   the same pixels whatever the window around it happens to be. */
	.stage {
		position: relative;
		width: 1920px;
		height: 1080px;
		overflow: hidden;
	}

	.slot {
		position: absolute;
		top: 0;
		width: 798px;
		height: 1080px;
	}

	.left {
		left: 0;
	}

	.right {
		right: 0;
	}

	.slot img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
</style>
