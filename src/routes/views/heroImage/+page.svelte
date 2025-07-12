<script context="module">
	// Turn off SSR so we only run this in the browser
	export const ssr = false;
</script>

<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, onValue, off } from 'firebase/database';
	import { db } from '../../../firebaseClient';

	// 1) Hydrate from localStorage or fall back to defaults
	let players;
	if (typeof window !== 'undefined') {
		const cached = JSON.parse(localStorage.getItem('simplePlayers') || 'null');
		players = cached && cached.p1 && cached.p2 ? cached : { p1: { hero: '' }, p2: { hero: '' } };
	} else {
		players = { p1: { hero: '' }, p2: { hero: '' } };
	}

	// 2) Keep track of our unsubscribers so we can clean up
	const unsubscribers = [];

	// 3) Standard slug→filename logic
	function slugify(name) {
		return name
			.toLowerCase()
			.replace(/["',]/g, '')
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.trim();
	}
	function getHeroImage(hero) {
		return hero ? `/heroImages/${slugify(hero)}.jpg` : '/heroImages/default.jpg';
	}

	onMount(() => {
		// Subscribe p1 & p2
		for (const id of ['p1', 'p2']) {
			const r = ref(db, `playerInfo/${id}`);
			const u = onValue(r, (snap) => {
				const hero = snap.val()?.hero || '';
				// Update local state & cache
				players[id].hero = hero;
				localStorage.setItem('simplePlayers', JSON.stringify(players));
			});
			unsubscribers.push(() => off(r, 'value', u));
		}
	});

	onDestroy(() => {
		unsubscribers.forEach((fn) => fn());
	});
</script>

<!-- Player 1: always in DOM, flips on change but no removal/add -->
<img
	loading="eager"
	src={getHeroImage(players.p1.hero)}
	alt={players.p1.hero}
	class="hero-img scale-x-[-1]"
	on:error={(e) => {
		// if .jpg missing, fall back to default
		e.target.src = '/heroImages/default.jpg';
	}}
/>

<!-- Player 2 -->
<img
	loading="eager"
	src={getHeroImage(players.p2.hero)}
	alt={players.p2.hero}
	class="hero-img mt-4"
	on:error={(e) => {
		e.target.src = '/heroImages/default.jpg';
	}}
/>

<style>
	/* no changes to your styling */
	.hero-img {
		width: 1000px;
	}
</style>
