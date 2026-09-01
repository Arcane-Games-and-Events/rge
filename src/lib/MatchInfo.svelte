<script>
	import { onMount } from 'svelte';
	import { ref, set, onValue } from 'firebase/database';
	import { db } from '../firebaseClient';
	import debounce from 'lodash.debounce';

	// Round and status lines shared by both tables' graphics.
	let roundInfo = '';
	let tournamentStatus = '';

	const save = debounce(async (path, value) => {
		try {
			await set(ref(db, path), value);
		} catch (err) {
			console.error(`Error saving ${path}:`, err);
		}
	}, 300);

	onMount(() => {
		onValue(ref(db, 'roundInfo'), (snap) => (roundInfo = snap.val() ?? ''));
		onValue(ref(db, 'tournamentStatus'), (snap) => (tournamentStatus = snap.val() ?? ''));
	});
</script>

<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
	<input
		type="text"
		placeholder="Round"
		aria-label="Round"
		class="min-h-11 w-full rounded-lg border border-gray-700 bg-gray-900 px-2.5 text-sm text-white placeholder-gray-500 transition-colors focus:border-gray-500 focus:outline-none"
		bind:value={roundInfo}
		on:input={(e) => save('roundInfo', e.target.value)}
	/>
	<input
		type="text"
		placeholder="Status"
		aria-label="Tournament status"
		class="min-h-11 w-full rounded-lg border border-gray-700 bg-gray-900 px-2.5 text-sm text-white placeholder-gray-500 transition-colors focus:border-gray-500 focus:outline-none"
		bind:value={tournamentStatus}
		on:input={(e) => save('tournamentStatus', e.target.value)}
	/>
</div>
