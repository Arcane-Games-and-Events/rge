<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';

	let players = {
		p1: { hero: '' },
		p2: { hero: '' }
	};

	function slugify(heroName) {
		return heroName
			.toLowerCase()
			.replace(/["',]/g, '')
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.trim();
	}

	// Default to .jpg, fall back to .png using on:error in <img>
	function getHeroImage(heroName) {
		if (!heroName) return '/heroImages/default.jpg';
		const slug = slugify(heroName);
		return `/heroImages/${slug}.jpg`;
	}

	function fetchData() {
		Object.keys(players).forEach((playerId) => {
			const playerRef = ref(db, `playerInfo/${playerId}`);
			onValue(playerRef, (snapshot) => {
				const data = snapshot.val();
				if (data) {
					players[playerId] = {
						hero: data.hero || ''
					};
				}
			});
		});
	}

	onMount(() => {
		fetchData();
	});
</script>

{#if players.p1.hero}
	<img
		class="scale-x-[-1]"
		src={getHeroImage(players.p1.hero)}
		alt={players.p1.hero}
		width="1000"
		on:error={(e) => {
			const slug = slugify(players.p1.hero);
			e.target.src = `/heroImages/${slug}.png`;
		}}
	/>
{/if}

{#if players.p2.hero}
	<img
		class="mt-4"
		src={getHeroImage(players.p2.hero)}
		alt={players.p2.hero}
		width="1000"
		on:error={(e) => {
			const slug = slugify(players.p2.hero);
			e.target.src = `/heroImages/${slug}.png`;
		}}
	/>
{/if}
