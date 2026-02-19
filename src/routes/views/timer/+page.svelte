<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';

	// Timer state for independent calculation
	let timers = {
		Round: { remainingTime: 0, startTime: null, isPaused: true, isCountingUp: false },
		Break: { remainingTime: 0, startTime: null, isPaused: true }
	};

	// Display strings
	let displayRound = '00:00';
	let displayBreak = '00:00';

	// Interval for updating display
	let updateInterval;

	// Unsubscribe functions
	let unsubscribers = [];

	function formatTime(seconds) {
		const m = Math.floor(Math.abs(seconds) / 60).toString().padStart(2, '0');
		const s = (Math.abs(seconds) % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	}

	function getCurrentTime(type) {
		const timer = timers[type];
		if (!timer.startTime || timer.isPaused) {
			return timer.remainingTime;
		}

		const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
		const isCountingUp = type === 'Round' && timer.isCountingUp;

		if (isCountingUp) {
			return timer.remainingTime + elapsed;
		} else {
			return Math.max(0, timer.remainingTime - elapsed);
		}
	}

	function updateDisplays() {
		displayRound = formatTime(getCurrentTime('Round'));
		displayBreak = formatTime(getCurrentTime('Break'));
	}

	onMount(() => {
		// Subscribe to Round timer data
		unsubscribers.push(
			onValue(ref(db, 'timers/Round/remainingTime'), (snap) => {
				timers.Round.remainingTime = snap.val() ?? 0;
				updateDisplays();
			})
		);
		unsubscribers.push(
			onValue(ref(db, 'timers/Round/startTime'), (snap) => {
				timers.Round.startTime = snap.val() ?? null;
				updateDisplays();
			})
		);
		unsubscribers.push(
			onValue(ref(db, 'timers/Round/isPaused'), (snap) => {
				timers.Round.isPaused = snap.val() ?? true;
				updateDisplays();
			})
		);
		unsubscribers.push(
			onValue(ref(db, 'timers/Round/isCountingUp'), (snap) => {
				timers.Round.isCountingUp = snap.val() ?? false;
				updateDisplays();
			})
		);

		// Subscribe to Break timer data
		unsubscribers.push(
			onValue(ref(db, 'timers/Break/remainingTime'), (snap) => {
				timers.Break.remainingTime = snap.val() ?? 0;
				updateDisplays();
			})
		);
		unsubscribers.push(
			onValue(ref(db, 'timers/Break/startTime'), (snap) => {
				timers.Break.startTime = snap.val() ?? null;
				updateDisplays();
			})
		);
		unsubscribers.push(
			onValue(ref(db, 'timers/Break/isPaused'), (snap) => {
				timers.Break.isPaused = snap.val() ?? true;
				updateDisplays();
			})
		);

		// Update frequently to avoid skipping displayed seconds due to setInterval drift
		updateInterval = setInterval(updateDisplays, 200);
	});

	onDestroy(() => {
		// Clear interval
		clearInterval(updateInterval);
		// Detach Firebase listeners
		unsubscribers.forEach(unsub => unsub && unsub());
	});
</script>

<div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-8">
	<!-- Round timer -->
	<div>
		<p class="text-8xl text-center text-white font-bold">
			{displayRound}
		</p>
	</div>

	<!-- Break timer -->
	<div>
		<p class="text-8xl text-center text-white font-bold">
			{displayBreak}
		</p>
	</div>
</div>
