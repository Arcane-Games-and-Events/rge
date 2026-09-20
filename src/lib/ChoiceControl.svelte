<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, set, onValue } from 'firebase/database';
	import { db } from '../firebaseClient';
	import { CHOICE_PATH, CHOICES, toChoice } from '$lib/choice';

	// Who won the roll and what they chose. Four states and a clear, laid out the
	// way the active-player control is: P1's two on the left, P2's on the right, so
	// the buttons sit on the same side as the seat they describe. Pressing the
	// current state again clears it, as the winner toggles do on the bracket page.
	let choice = '';
	let unsub = null;

	const save = async (next) => {
		choice = next;
		try {
			await set(ref(db, CHOICE_PATH), next);
		} catch (err) {
			console.error('Error saving the choice:', err);
		}
	};

	const press = (key) => save(choice === key ? '' : key);

	onMount(() => {
		unsub = onValue(ref(db, CHOICE_PATH), (snap) => (choice = toChoice(snap.val())));
	});

	onDestroy(() => unsub?.());

	const SEATS = [
		{ seat: 'p1', label: 'P1', arrow: '◀', keys: ['p1-first', 'p1-second'] },
		{ seat: 'p2', label: 'P2', arrow: '▶', keys: ['p2-first', 'p2-second'] }
	];
</script>

<div class="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-gray-900 p-1.5">
	<span class="text-[9px] font-semibold uppercase leading-none text-amber-400">Chose</span>

	{#each SEATS as side (side.seat)}
		<div class="flex flex-1 items-center gap-1">
			{#if side.seat === 'p1'}<span class="text-xs text-gray-500">{side.arrow}</span>{/if}
			<span class="text-[10px] font-bold text-gray-400">{side.label}</span>
			{#each side.keys as key (key)}
				<button
					type="button"
					aria-pressed={choice === key}
					aria-label={CHOICES[key].label}
					on:click={() => press(key)}
					class="h-8 flex-1 rounded text-[11px] font-medium capitalize transition-colors {choice ===
					key
						? 'bg-amber-600 text-white'
						: 'bg-gray-800 text-gray-400 hover:bg-gray-700'}"
				>
					{CHOICES[key].order}
				</button>
			{/each}
			{#if side.seat === 'p2'}<span class="text-xs text-gray-500">{side.arrow}</span>{/if}
		</div>
	{/each}

	<button
		type="button"
		aria-label="Clear the choice"
		on:click={() => save('')}
		disabled={!choice}
		class="h-8 w-8 flex-none rounded bg-gray-800 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-white disabled:cursor-not-allowed disabled:text-gray-600"
		>✕</button
	>
</div>
