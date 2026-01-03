<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../../firebaseClient';

	let hero = '';

	function slugify(heroName) {
		return heroName
			.toLowerCase()
			.replace(/["',]/g, '')
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.trim();
	}

	const IMAGE_EXCEPTIONS = {
		'arakni huntsman': '/heroImages/arakni-huntsman.jpg'
	};

	function getHeroImage(heroName) {
		if (!heroName) return '/heroImages/default.jpg';
		const normalized = heroName.toLowerCase().replace(/["',]/g, '').trim();
		if (normalized in IMAGE_EXCEPTIONS) {
			return IMAGE_EXCEPTIONS[normalized];
		}
		return `/heroImages/${slugify(heroName)}.jpg`;
	}

	onMount(() => {
		const playerRef = ref(db, 'playerInfo/p2');
		onValue(playerRef, (snapshot) => {
			const data = snapshot.val();
			hero = data?.hero || '';
		});
	});
</script>

{#if hero}
	<img
		src={getHeroImage(hero)}
		alt={hero}
		width="1000"
		on:error={(e) => {
			const normalized = hero.toLowerCase().replace(/["',]/g, '').trim();
			if (normalized in IMAGE_EXCEPTIONS) {
				e.target.src = IMAGE_EXCEPTIONS[normalized].replace(/\.jpg$/i, '.png');
			} else {
				e.target.src = `/heroImages/${slugify(hero)}.png`;
			}
		}}
	/>
{/if}
