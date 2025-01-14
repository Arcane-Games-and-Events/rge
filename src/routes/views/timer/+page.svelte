<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';

	let displayTime = '00:00'; // Holds the current time string

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

	const formatTime = (seconds) => {
		const min = Math.floor(seconds / 60)
			.toString()
			.padStart(2, '0');
		const sec = (seconds % 60).toString().padStart(2, '0');
		return `${min}:${sec}`;
	};

	const fetchTime = () => {
		const startTimeRef = ref(db, 'timer/startTime');
		const isPausedRef = ref(db, 'timer/isPaused');
		const isCountingUpRef = ref(db, 'timer/isCountingUp');
		const lastElapsedRef = ref(db, 'timer/remainingTime');

		let startTime,
			isPaused,
			isCountingUp,
			lastElapsed = 0;

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

		const updateDisplayTime = () => {
			displayTime = calculateTime(startTime, isPaused, isCountingUp, lastElapsed);
		};

		// Keep recalculating the time every second if not paused
		setInterval(() => {
			if (!isPaused) {
				updateDisplayTime();
			}
		}, 1000);
	};

	onMount(() => {
		fetchTime(); // Fetch and calculate the time when the component is mounted
	});
</script>

<div class="mt-4">
	<p class="text-8xl text-center text-white font-bold">{displayTime}</p>
</div>
