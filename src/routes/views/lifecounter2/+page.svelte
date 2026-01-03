<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';

	let lifeTotalP1 = 0;
	let lifeTotalP2 = 0;

	const formatLifeTotal = (total) => {
		return total.toString().padStart(2, '0');
	};

	const fetchLifeTotals = () => {
		const lifeTotalP1Ref = ref(db, 'lifecounter2/p1');
		const lifeTotalP2Ref = ref(db, 'lifecounter2/p2');

		onValue(lifeTotalP1Ref, (snapshot) => {
			const newLifeTotalP1 = snapshot.val();
			if (newLifeTotalP1 !== null) {
				lifeTotalP1 = formatLifeTotal(newLifeTotalP1);
			}
		});

		onValue(lifeTotalP2Ref, (snapshot) => {
			const newLifeTotalP2 = snapshot.val();
			if (newLifeTotalP2 !== null) {
				lifeTotalP2 = formatLifeTotal(newLifeTotalP2);
			}
		});
	};

	onMount(() => {
		fetchLifeTotals();
	});
</script>

<div class="life-counter-container">
	<div class="player-life">
		<p class="text-xl font-semibold">Player 1 Life Total:</p>
		<p class="text-6xl text-center text-white font-bold">{lifeTotalP1}</p>
	</div>
	<div class="player-life">
		<p class="text-xl font-semibold">Player 2 Life Total:</p>
		<p class="text-6xl text-center text-white font-bold">{lifeTotalP2}</p>
	</div>
</div>

<style>
	.life-counter-container {
		text-align: center;
		margin-top: 20px;
		display: flex;
		justify-content: space-around;
	}
	.player-life {
		margin: 10px;
	}
</style>
