<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../../firebaseClient';

	// Both seats in one column, the way the other LSS overlays are laid out, so a
	// scene can crop to whichever player it needs.
	let players = { p1: { pronouns: '' }, p2: { pronouns: '' } };

	onMount(() => {
		Object.keys(players).forEach((playerId) => {
			onValue(ref(db, `playerInfo/${playerId}/pronouns`), (snapshot) => {
				players[playerId] = { pronouns: snapshot.val() || '' };
			});
		});
	});

	// The two seats point away from each other, matching the player info overlay.
	const seats = [
		{ id: 'p1', align: 'align-left' },
		{ id: 'p2', align: 'align-right' }
	];
</script>

<div class="container mx-auto">
	{#each seats as seat (seat.id)}
		<div class="pronoun-slot {seat.align}">
			{#if players[seat.id].pronouns}
				<p class="pronouns">{players[seat.id].pronouns}</p>
			{/if}
		</div>
	{/each}
</div>

<style>
	/* A fixed slot per seat, so an empty one still holds its place and the other
	   does not shift under it in OBS. */
	.pronoun-slot {
		width: 18rem;
		height: 3.5rem;
		margin: 0 auto;
		display: flex;
		align-items: center;
	}

	.align-left {
		justify-content: flex-start;
	}

	.align-right {
		justify-content: flex-end;
	}

	.pronouns {
		font-size: 2rem;
		font-weight: bold;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		line-height: 1;
		white-space: nowrap;
	}
</style>
