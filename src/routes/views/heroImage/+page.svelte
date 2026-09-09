<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';
	import HeroMedia from '$lib/HeroMedia.svelte';

	let players = {
		p1: { hero: '' },
		p2: { hero: '' }
	};

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

<HeroMedia hero={players.p1.hero} className="scale-x-[-1]" />
<HeroMedia hero={players.p2.hero} className="mt-4" />
