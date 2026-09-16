<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, set, onValue } from 'firebase/database';
	import { db } from '../firebaseClient';
	import { TURN_COUNTER_PATH, MIN_TURN, toTurn } from '$lib/turnCounter';

	let turn = MIN_TURN;
	let unsub = null;

	const save = async (next) => {
		turn = Math.max(MIN_TURN, next);
		try {
			await set(ref(db, TURN_COUNTER_PATH), turn);
		} catch (err) {
			console.error('Error saving the turn counter:', err);
		}
	};

	const step = (delta) => save(turn + delta);
	const reset = () => save(MIN_TURN);

	// Shift with an arrow key works anywhere on the page, so the count can be
	// nudged without leaving whatever field is focused. Plain arrows are left
	// alone: the card reader and the hero pickers use them.
	function onKeydown(e) {
		if (!e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
		if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
		e.preventDefault();
		step(e.key === 'ArrowUp' ? 1 : -1);
	}

	onMount(() => {
		unsub = onValue(ref(db, TURN_COUNTER_PATH), (snap) => {
			if (snap.val() !== null) turn = toTurn(snap.val());
		});
		window.addEventListener('keydown', onKeydown);
	});

	onDestroy(() => {
		unsub?.();
		if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown);
	});
</script>

<div class="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-900 p-1.5">
	<span class="text-[9px] font-semibold uppercase leading-none text-amber-400">Turn</span>

	<button
		type="button"
		aria-label="Previous turn"
		on:click={() => step(-1)}
		disabled={turn <= MIN_TURN}
		class="h-8 w-8 flex-none rounded bg-gray-800 text-lg font-bold leading-none text-gray-300 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-600"
		>−</button
	>

	<span class="min-w-[2.5rem] text-center font-mono text-2xl font-bold tabular-nums leading-none">
		{turn}
	</span>

	<button
		type="button"
		aria-label="Next turn"
		on:click={() => step(1)}
		class="h-8 w-8 flex-none rounded bg-amber-600/30 text-lg font-bold leading-none text-amber-300 transition-colors hover:bg-amber-600 hover:text-white"
		>+</button
	>

	<button
		type="button"
		aria-label="Reset the turn counter"
		on:click={reset}
		class="h-8 w-8 flex-none rounded bg-gray-800 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
		>↺</button
	>

	<span class="ml-auto hidden text-[10px] text-gray-500 sm:block">
		<kbd class="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 font-mono">Shift</kbd>
		+
		<kbd class="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 font-mono">↑↓</kbd>
	</span>
</div>
