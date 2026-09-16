<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, set, onValue } from 'firebase/database';
	import { db } from '../firebaseClient';
	import { ACTIVE_PLAYER_PATH, toActivePlayer } from '$lib/activePlayer';

	let active = '';
	let unsub = null;

	const save = async (seat) => {
		active = seat;
		try {
			await set(ref(db, ACTIVE_PLAYER_PATH), seat);
		} catch (err) {
			console.error('Error saving the active player:', err);
		}
	};

	// Shift with a left or right arrow, matching the turn counter's shift with an
	// up or down arrow. Bound on the window so it works without leaving whatever
	// field has focus; plain arrows are left to the card reader and hero pickers.
	function onKeydown(e) {
		if (!e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		e.preventDefault();
		save(e.key === 'ArrowLeft' ? 'p1' : 'p2');
	}

	onMount(() => {
		unsub = onValue(ref(db, ACTIVE_PLAYER_PATH), (snap) => (active = toActivePlayer(snap.val())));
		window.addEventListener('keydown', onKeydown);
	});

	onDestroy(() => {
		unsub?.();
		if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown);
	});
</script>

<div class="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-900 p-1.5">
	<span class="text-[9px] font-semibold uppercase leading-none text-emerald-400">Active</span>

	{#each [{ seat: 'p1', label: 'P1', arrow: '◀' }, { seat: 'p2', label: 'P2', arrow: '▶' }] as option (option.seat)}
		<button
			type="button"
			aria-pressed={active === option.seat}
			on:click={() => save(active === option.seat ? '' : option.seat)}
			class="flex h-8 flex-1 items-center justify-center gap-1 rounded text-xs font-bold transition-colors {active ===
			option.seat
				? 'bg-emerald-600 text-white'
				: 'bg-gray-800 text-gray-400 hover:bg-gray-700'}"
		>
			{#if option.seat === 'p1'}<span>{option.arrow}</span>{/if}
			{option.label}
			{#if option.seat === 'p2'}<span>{option.arrow}</span>{/if}
		</button>
	{/each}

	<button
		type="button"
		aria-label="Clear the active player"
		on:click={() => save('')}
		disabled={!active}
		class="h-8 w-8 flex-none rounded bg-gray-800 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-white disabled:cursor-not-allowed disabled:text-gray-600"
		>✕</button
	>

	<span class="ml-auto hidden text-[10px] text-gray-500 sm:block">
		<kbd class="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 font-mono">Shift</kbd>
		+
		<kbd class="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 font-mono">←→</kbd>
	</span>
</div>
