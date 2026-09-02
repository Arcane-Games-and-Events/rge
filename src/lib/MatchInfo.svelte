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

<div class="grid grid-cols-2 gap-1.5">
	<label class="flex flex-col gap-1">
		<span class="text-[9px] font-semibold uppercase leading-none text-gray-500">Round Info</span>
		<input
			type="text"
			placeholder="Round"
			class="h-9 min-w-0 rounded border border-gray-700 bg-gray-900 px-2 text-sm text-white placeholder-gray-500 transition-colors focus:border-gray-500 focus:outline-none"
			bind:value={roundInfo}
			on:input={(e) => save('roundInfo', e.target.value)}
		/>
	</label>
	<label class="flex flex-col gap-1">
		<span class="text-[9px] font-semibold uppercase leading-none text-gray-500">Status</span>
		<input
			type="text"
			placeholder="Status"
			class="h-9 min-w-0 rounded border border-gray-700 bg-gray-900 px-2 text-sm text-white placeholder-gray-500 transition-colors focus:border-gray-500 focus:outline-none"
			bind:value={tournamentStatus}
			on:input={(e) => save('tournamentStatus', e.target.value)}
		/>
	</label>
</div>
