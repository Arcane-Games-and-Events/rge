<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient'; // Adjust the path to your firebase setup

	let lifeTotalP1 = 0; // Holds the life total for player 1
	let lifeTotalP2 = 0; // Holds the life total for player 2

	const formatLifeTotal = (total) => {
		return total.toString().padStart(2, '0');
	};

	const fetchLifeTotals = () => {
		const lifeTotalP1Ref = ref(db, 'lifecounter/p1'); // Reference to the life total for player 1 in the database
		const lifeTotalP2Ref = ref(db, 'lifecounter/p2'); // Reference to the life total for player 2 in the database

		onValue(lifeTotalP1Ref, (snapshot) => {
			const newLifeTotalP1 = snapshot.val();
			if (newLifeTotalP1 !== null) {
				lifeTotalP1 = formatLifeTotal(newLifeTotalP1); // Update the life total for player 1 when it changes in the database
			}
		});

		onValue(lifeTotalP2Ref, (snapshot) => {
			const newLifeTotalP2 = snapshot.val();
			if (newLifeTotalP2 !== null) {
				lifeTotalP2 = formatLifeTotal(newLifeTotalP2); // Update the life total for player 2 when it changes in the database
			}
		});
	};

	onMount(() => {
		fetchLifeTotals(); // Fetch the life totals when the component is mounted
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
