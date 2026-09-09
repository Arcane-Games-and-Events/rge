<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../../firebaseClient';
	import HeroMedia from '$lib/HeroMedia.svelte';

	let hero = '';

	onMount(() => {
		const playerRef = ref(db, 'playerInfo/p1');
		onValue(playerRef, (snapshot) => {
			const data = snapshot.val();
			hero = data?.hero || '';
		});
	});
</script>

<HeroMedia {hero} className="scale-x-[-1]" />
