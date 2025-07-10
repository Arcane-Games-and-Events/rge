<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';

	// Two display strings, one for each timer
	let displayRound = '00:00';
	let displayBreak = '00:00';

	// Hold unsubscribe functions so we can detach on destroy
	let roundUnsub;
	let breakUnsub;

	onMount(() => {
		// Subscribe to Round timer displayTime
		const roundRef = ref(db, 'timers/Round/displayTime');
		roundUnsub = onValue(roundRef, (snap) => {
			displayRound = snap.val() ?? '00:00';
		});

		// Subscribe to Break timer displayTime
		const breakRef = ref(db, 'timers/Break/displayTime');
		breakUnsub = onValue(breakRef, (snap) => {
			displayBreak = snap.val() ?? '00:00';
		});
	});

	onDestroy(() => {
		// Detach Firebase listeners
		roundUnsub && roundUnsub();
		breakUnsub && breakUnsub();
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
