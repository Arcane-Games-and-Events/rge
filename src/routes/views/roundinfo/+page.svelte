<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient'; // Adjust the path to your firebase setup

	let roundInfo = ''; // Holds the round information
	let format = ''; // Holds the format information
	let tournamentStatus = ''; // Holds the tournament status information

	// Function to sync roundInfo, format, and tournamentStatus with the database
	const syncWithDatabase = () => {
		const roundInfoRef = ref(db, 'roundInfo'); // Reference to roundInfo in the database
		const formatRef = ref(db, 'format'); // Reference to format in the database
		const tournamentStatusRef = ref(db, 'tournamentStatus'); // Reference to tournamentStatus in the database

		onValue(roundInfoRef, (snapshot) => {
			const data = snapshot.val();
			if (data !== null) {
				roundInfo = data; // Update roundInfo when it changes in the database
			}
		});

		onValue(formatRef, (snapshot) => {
			const data = snapshot.val();
			if (data !== null) {
				format = data; // Update format when it changes in the database
			}
		});

		onValue(tournamentStatusRef, (snapshot) => {
			const data = snapshot.val();
			if (data !== null) {
				tournamentStatus = data; // Update tournamentStatus when it changes in the database
			}
		});
	};

	onMount(() => {
		syncWithDatabase(); // Sync with the database when the component is mounted
	});
</script>

<div class="mt-4 text-center text-white text-sm font-bold tracking-wide">
	<p class="font-medium">{tournamentStatus}</p>
	<p>{format} | <span class="text-color">{roundInfo}</span></p>
	<p class="">{format}</p>
	<p class="text-color">{roundInfo}</p>
</div>

<style>
	.text-color {
		color: #d8b499;
	}
</style>
