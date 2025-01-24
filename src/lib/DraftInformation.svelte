<script>
	import { onMount } from 'svelte';
	import { ref, set, onValue } from 'firebase/database';
	import { db } from '../firebaseClient';
	import debounce from 'lodash.debounce';

	// We track all 3 fields in a single object
	let players = {
		name: '',
		pod: '',
		seat: ''
	};

	/**
	 * Fetch initial data from Firebase (playerInfo/draft).
	 * We only need one reference, as all fields are siblings at this path.
	 */
	function fetchData() {
		const playerRef = ref(db, 'playerInfo/draft');
		onValue(playerRef, (snapshot) => {
			const data = snapshot.val() || {};
			players.name = data.name || '';
			players.pod = data.pod || '';
			players.seat = data.seat || '';
		});
	}

	/**
	 * Debounced function to update Firebase.
	 * We pass in a path like "playerInfo/draft/name" and a value to store.
	 */
	const updateFirebase = debounce(async (path, value) => {
		try {
			await set(ref(db, path), value);
		} catch (err) {
			console.error(`Error saving ${path} to Firebase:`, err);
		}
	}, 300);

	/**
	 * Handle input changes for any field: name, pod, or seat.
	 * We update our local 'players' object and then push to Firebase.
	 */
	function handleInputChange(field, value) {
		players[field] = value;
		updateFirebase(`playerInfo/draft/${field}`, value);
	}

	onMount(() => {
		fetchData();
	});
</script>

<!-- Component UI -->
<div class="w-full mt-4 sm:mt-0 border border-gray-500 text-white rounded-lg p-4">
	<h2 class="text-lg font-medium leading-6 mb-2">Draft Information</h2>

	<!-- Player Name -->
	<div class="mb-4">
		<label for="name" class="block text-sm font-medium leading-6">Player Name</label>
		<input
			type="text"
			id="name"
			class="mt-2 w-full rounded-md border-0 bg-gray-800 py-2 px-3 shadow-sm
			       ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset
			       focus:ring-indigo-600 sm:text-sm sm:leading-6"
			bind:value={players.name}
			on:input={(e) => handleInputChange('name', e.target.value)}
		/>
	</div>

	<div class="flex gap-4">
		<!-- Pod -->
		<div class="w-1/2 mb-4">
			<label for="pod" class="block text-sm font-medium leading-6">Pod</label>
			<input
				type="text"
				id="pod"
				class="mt-2 w-full rounded-md border-0 bg-gray-800 py-2 px-3 shadow-sm
			       ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset
			       focus:ring-indigo-600 sm:text-sm sm:leading-6"
				bind:value={players.pod}
				on:input={(e) => handleInputChange('pod', e.target.value)}
			/>
		</div>

		<!-- Seat -->
		<div class="w-1/2 mb-4">
			<label for="seat" class="block text-sm font-medium leading-6">Seat</label>
			<input
				type="text"
				id="seat"
				class="mt-2 w-full rounded-md border-0 bg-gray-800 py-2 px-3 shadow-sm
			       ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset
			       focus:ring-indigo-600 sm:text-sm sm:leading-6"
				bind:value={players.seat}
				on:input={(e) => handleInputChange('seat', e.target.value)}
			/>
		</div>
	</div>
</div>
