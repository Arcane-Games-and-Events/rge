<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../../../firebaseClient';

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
		'arakni huntsman': '/heroImages/arakni-huntsman.webp'
	};

	function getHeroImage(heroName) {
		if (!heroName) return '/heroImages/default.webp';
		const normalized = heroName.toLowerCase().replace(/["',]/g, '').trim();
		if (normalized in IMAGE_EXCEPTIONS) {
			return IMAGE_EXCEPTIONS[normalized];
		}
		return `/heroImages/${slugify(heroName)}.webp`;
	}

	onMount(() => {
		const playerRef = ref(db, 'playerInfo2/p1');
		onValue(playerRef, (snapshot) => {
			const data = snapshot.val();
			hero = data?.hero || '';
		});
	});
</script>

{#if hero}
	{#key hero}
		<img
			class="scale-x-[-1]"
			src={getHeroImage(hero)}
			alt={hero}
			width="1000"
		/>
	{/key}
{/if}
