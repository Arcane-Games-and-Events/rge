<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';
	import { formatTimerDisplay } from '$lib/timerDisplay';

	let displayRound = '00:00';
	let displayBreak = '00:00';

	// Timer state for fallback (when admin page isn't open)
	let timers = {
		Round: {
			remainingTime: 0,
			startTime: null,
			isPaused: true,
			isCountingUp: false,
			lastFbUpdate: 0
		},
		Break: { remainingTime: 0, startTime: null, isPaused: true, lastFbUpdate: 0 }
	};

	let animFrame;
	let unsubscribers = [];

	function getFallbackTime(type) {
		const timer = timers[type];
		if (!timer.startTime || timer.isPaused) return timer.remainingTime;
		const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
		if (type === 'Round' && timer.isCountingUp) return timer.remainingTime + elapsed;
		return Math.max(0, timer.remainingTime - elapsed);
	}

	// If no Firebase displayTime update in 3 seconds while timer is running,
	// fall back to independent computation
	function checkFallback() {
		const now = Date.now();
		if (!timers.Round.isPaused && now - timers.Round.lastFbUpdate > 3000) {
			displayRound = formatTimerDisplay('Round', getFallbackTime('Round'));
		}
		if (!timers.Break.isPaused && now - timers.Break.lastFbUpdate > 3000) {
			displayBreak = formatTimerDisplay('Break', getFallbackTime('Break'));
		}
	}

	onMount(() => {
		// Primary: displayTime from Firebase (written by Timer.svelte admin)
		unsubscribers.push(
			onValue(ref(db, 'timers/Round/displayTime'), (snap) => {
				displayRound = snap.val() ?? '00:00';
				timers.Round.lastFbUpdate = Date.now();
			})
		);
		unsubscribers.push(
			onValue(ref(db, 'timers/Break/displayTime'), (snap) => {
				displayBreak = snap.val() ?? '00:00';
				timers.Break.lastFbUpdate = Date.now();
			})
		);

		// Fallback state: subscribe to timer fields for independent computation
		unsubscribers.push(
			onValue(ref(db, 'timers/Round/remainingTime'), (snap) => {
				timers.Round.remainingTime = snap.val() ?? 0;
			})
		);
		unsubscribers.push(
			onValue(ref(db, 'timers/Round/startTime'), (snap) => {
				timers.Round.startTime = snap.val() ?? null;
			})
		);
		unsubscribers.push(
			onValue(ref(db, 'timers/Round/isPaused'), (snap) => {
				timers.Round.isPaused = snap.val() ?? true;
			})
		);
		unsubscribers.push(
			onValue(ref(db, 'timers/Round/isCountingUp'), (snap) => {
				timers.Round.isCountingUp = snap.val() ?? false;
			})
		);
		unsubscribers.push(
			onValue(ref(db, 'timers/Break/remainingTime'), (snap) => {
				timers.Break.remainingTime = snap.val() ?? 0;
			})
		);
		unsubscribers.push(
			onValue(ref(db, 'timers/Break/startTime'), (snap) => {
				timers.Break.startTime = snap.val() ?? null;
			})
		);
		unsubscribers.push(
			onValue(ref(db, 'timers/Break/isPaused'), (snap) => {
				timers.Break.isPaused = snap.val() ?? true;
			})
		);

		// Periodically check if we need to fall back to independent computation
		function tick() {
			checkFallback();
			animFrame = requestAnimationFrame(tick);
		}
		animFrame = requestAnimationFrame(tick);
	});

	onDestroy(() => {
		if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(animFrame);
		unsubscribers.forEach((unsub) => unsub && unsub());
	});
</script>

<div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-8">
	<!-- Round timer -->
	<div>
		<p class="text-8xl text-left text-white font-bold tabular-nums">
			{displayRound}
		</p>
	</div>

	<!-- Break timer -->
	<div>
		<p class="text-8xl text-left text-white font-bold tabular-nums">
			{displayBreak}
		</p>
	</div>
</div>
