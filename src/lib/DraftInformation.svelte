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

<div class="space-y-2 text-white">
	<!-- Player Name -->
	<input
		type="text"
		id="name"
		class="w-full rounded border border-gray-700 bg-gray-800 px-2 py-2 text-sm placeholder:text-gray-500 transition-colors focus:border-blue-500 focus:outline-none"
		placeholder="Player name"
		bind:value={players.name}
		on:input={(e) => handleInputChange('name', e.target.value)}
	/>

	<div class="grid grid-cols-2 gap-1.5">
		<!-- Pod -->
		<input
			type="text"
			id="pod"
			class="w-full rounded border border-gray-700 bg-gray-800 px-2 py-2 text-sm placeholder:text-gray-500 transition-colors focus:border-blue-500 focus:outline-none"
			placeholder="Pod #"
			bind:value={players.pod}
			on:input={(e) => handleInputChange('pod', e.target.value)}
		/>

		<!-- Seat -->
		<input
			type="text"
			id="seat"
			class="w-full rounded border border-gray-700 bg-gray-800 px-2 py-2 text-sm placeholder:text-gray-500 transition-colors focus:border-blue-500 focus:outline-none"
			placeholder="Seat #"
			bind:value={players.seat}
			on:input={(e) => handleInputChange('seat', e.target.value)}
		/>
	</div>
</div>
