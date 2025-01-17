<script>
	import { onMount } from 'svelte';
	import { ref, onValue, set } from 'firebase/database';
	import { db } from '../../../firebaseClient'; // Adjust the path to your Firebase setup

	let playerOneName = '';
	let playerTwoName = '';
	let player1Score = 0;
	let player2Score = 0;
	let displayTime = '55:00'; // Default time

	// Function to format the time as MM:SS
	const formatTime = (seconds) => {
		const min = Math.floor(seconds / 60)
			.toString()
			.padStart(2, '0');
		const sec = (seconds % 60).toString().padStart(2, '0');
		return `${min}:${sec}`;
	};

	// Function to calculate the current display time based on timer state
	const calculateTime = (startTime, isPaused, isCountingUp, lastElapsed) => {
		if (isPaused) {
			return formatTime(lastElapsed);
		} else {
			const elapsed = Math.floor((Date.now() - startTime) / 1000);
			const totalElapsed = isCountingUp
				? lastElapsed + elapsed
				: Math.max(0, lastElapsed - elapsed);
			return formatTime(totalElapsed);
		}
	};

	// Function to sync and update the display time
	const syncTimeWithDatabase = () => {
		const startTimeRef = ref(db, 'timer/startTime');
		const isPausedRef = ref(db, 'timer/isPaused');
		const isCountingUpRef = ref(db, 'timer/isCountingUp');
		const lastElapsedRef = ref(db, 'timer/remainingTime');

		let startTime,
			isPaused,
			isCountingUp,
			lastElapsed = 0;

		const updateDisplayTime = () => {
			displayTime = calculateTime(startTime, isPaused, isCountingUp, lastElapsed);
		};

		onValue(startTimeRef, (snapshot) => {
			startTime = snapshot.val();
			if (startTime !== null) updateDisplayTime();
		});

		onValue(isPausedRef, (snapshot) => {
			isPaused = snapshot.val();
			if (startTime !== null) updateDisplayTime();
		});

		onValue(isCountingUpRef, (snapshot) => {
			isCountingUp = snapshot.val();
			if (startTime !== null) updateDisplayTime();
		});

		onValue(lastElapsedRef, (snapshot) => {
			lastElapsed = snapshot.val();
			if (startTime !== null) updateDisplayTime();
		});

		// Continuously update the display time every second if not paused
		setInterval(() => {
			if (!isPaused) {
				updateDisplayTime();
			}
		}, 1000);
	};

	onMount(() => {
		// Initialize Firebase Realtime Database references
		const playerOneNameRef = ref(db, 'playerInfo/p1/name');
		const playerTwoNameRef = ref(db, 'playerInfo/p2/name');
		const player1ScoreRef = ref(db, 'lifecounter/p1');
		const player2ScoreRef = ref(db, 'lifecounter/p2');

		onValue(player1ScoreRef, (snapshot) => {
			const score = snapshot.val();
			if (score !== null) player1Score = score;
		});

		onValue(player2ScoreRef, (snapshot) => {
			const score = snapshot.val();
			if (score !== null) player2Score = score;
		});

		onValue(playerOneNameRef, (snapshot) => {
			const name = snapshot.val();
			if (name !== null) playerOneName = name;
		});

		onValue(playerTwoNameRef, (snapshot) => {
			const name = snapshot.val();
			if (name !== null) playerTwoName = name;
		});

		// Sync time with the database
		syncTimeWithDatabase();
	});

	// Function to update the score for a player
	async function updateScore(player, newScore) {
		if (player === 'player1') {
			player1Score = newScore;
			await set(ref(db, 'lifecounter/p1'), newScore);
		} else if (player === 'player2') {
			player2Score = newScore;
			await set(ref(db, 'lifecounter/p2'), newScore);
		}
	}
</script>

<div class="relative full-height bg-gray-800 text-white rounded-md shadow-md">
	<div class="flex flex-col justify-between h-full">
		<div class="bg-pink-500 rotate-180 overflow-hidden origin-center p-4">
			<h2 class="text-2xl font-bold mb-2 text-center">P1 · {playerOneName}</h2>
			<div class="flex justify-between items-center px-8">
				<button
					on:click={() => updateScore('player1', player1Score - 1)}
					class="text-7xl p-4 font-bold"
				>
					-
				</button>
				<div class="text-7xl font-bold">{player1Score}</div>
				<button
					on:click={() => updateScore('player1', player1Score + 1)}
					class="text-7xl p-4 font-bold"
				>
					+
				</button>
			</div>
		</div>

		<div class="flex-grow flex items-center justify-center">
			<div class="rotate-90 text-7xl font-bold">
				{displayTime}
			</div>
		</div>

		<div class="bg-blue-500 p-4">
			<h2 class="text-2xl font-bold mb-2 text-center">P2 · {playerTwoName}</h2>
			<div class="flex justify-between items-center px-8">
				<button
					on:click={() => updateScore('player2', player2Score - 1)}
					class="text-7xl p-4 font-bold"
				>
					-
				</button>
				<div class="text-7xl font-bold">{player2Score}</div>
				<button
					on:click={() => updateScore('player2', player2Score + 1)}
					class="text-7xl p-4 font-bold"
				>
					+
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	:root {
		--vh: 1vh; /* Fallback if JavaScript fails */
	}

	.full-height {
		height: calc(var(--vh) * 80);
	}
</style>
