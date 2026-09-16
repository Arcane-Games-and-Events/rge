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

	const seats = ['p1', 'p2'];
</script>

<div class="container mx-auto">
	{#each seats as seat (seat)}
		<div class="pronoun-slot">
			{#if players[seat].pronouns}
				<p class="pronouns">{players[seat].pronouns}</p>
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
		justify-content: center;
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
