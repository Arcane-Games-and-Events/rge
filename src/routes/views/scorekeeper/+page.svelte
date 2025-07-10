<script>
	import { onMount } from 'svelte';
	import { ref, onValue, set } from 'firebase/database';
	import { db } from '../../../firebaseClient'; // adjust path to your setup

	// Player info & life totals
	let playerOneName = '';
	let playerTwoName = '';
	let player1Score = 0;
	let player2Score = 0;

	// Round timer display
	let displayTime = '00:00';

	// Helper to pad life totals
	const formatLifeTotal = (total) => total.toString().padStart(2, '0');

	// Update a player's life total in Firebase
	async function updateScore(player, newScore) {
		if (player === 'player1') {
			player1Score = newScore;
			await set(ref(db, 'lifecounter/p1'), newScore);
		} else {
			player2Score = newScore;
			await set(ref(db, 'lifecounter/p2'), newScore);
		}
	}

	onMount(() => {
		// Subscribe to names
		onValue(ref(db, 'playerInfo/p1/name'), (snap) => {
			playerOneName = snap.val() ?? '';
		});
		onValue(ref(db, 'playerInfo/p2/name'), (snap) => {
			playerTwoName = snap.val() ?? '';
		});

		// Subscribe to life totals
		onValue(ref(db, 'lifecounter/p1'), (snap) => {
			const v = snap.val();
			if (v != null) player1Score = v;
		});
		onValue(ref(db, 'lifecounter/p2'), (snap) => {
			const v = snap.val();
			if (v != null) player2Score = v;
		});

		// Subscribe to the round timer's displayTime
		onValue(ref(db, 'timers/Round/displayTime'), (snap) => {
			displayTime = snap.val() ?? '00:00';
		});
	});
</script>

<div class="relative full-height bg-gray-800 text-white rounded-md shadow-md">
	<div class="flex flex-col justify-between h-full">
		<!-- Player 1 panel (upside-down) -->
		<div class="bg-pink-500 rotate-180 origin-center p-4">
			<h2 class="text-2xl font-bold mb-2 text-center">
				P1 · {playerOneName}
			</h2>
			<div class="flex justify-between items-center px-8">
				<button
					on:click={() => updateScore('player1', player1Score - 1)}
					class="text-7xl p-4 font-bold">−</button
				>
				<div class="text-7xl font-bold">
					{formatLifeTotal(player1Score)}
				</div>
				<button
					on:click={() => updateScore('player1', player1Score + 1)}
					class="text-7xl p-4 font-bold">+</button
				>
			</div>
		</div>

		<!-- Center: Round timer -->
		<div class="flex-grow flex items-center justify-center">
			<div class="rotate-90 text-7xl font-bold">
				{displayTime}
			</div>
		</div>

		<!-- Player 2 panel -->
		<div class="bg-blue-500 p-4">
			<h2 class="text-2xl font-bold mb-2 text-center">
				P2 · {playerTwoName}
			</h2>
			<div class="flex justify-between items-center px-8">
				<button
					on:click={() => updateScore('player2', player2Score - 1)}
					class="text-7xl p-4 font-bold">−</button
				>
				<div class="text-7xl font-bold">
					{formatLifeTotal(player2Score)}
				</div>
				<button
					on:click={() => updateScore('player2', player2Score + 1)}
					class="text-7xl p-4 font-bold">+</button
				>
			</div>
		</div>
	</div>
</div>

<style>
	:root {
		/* for mobile-vh hack if needed */
		--vh: 1vh;
	}
	.full-height {
		height: calc(var(--vh) * 85);
	}
</style>
