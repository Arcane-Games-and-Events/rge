<script>
	import { onMount } from 'svelte';
	import { ref, onValue, set } from 'firebase/database';
	import { db } from '../../firebaseClient'; // Adjust the path to your Firebase setup
	import cardData from '$lib/data/cards.json'; // Import the cards JSON data

	let commentator1 = '';
	let subtitle1 = '';
	let commentator2 = '';
	let subtitle2 = '';
	let commentator3 = '';
	let subtitle3 = '';
	let commentator4 = '';
	let subtitle4 = '';
	let format = ''; // Format input
	let sets = []; // Available sets
	let selectedSet = ''; // Selected set

	// Load sets from cards.json
	const loadSets = () => {
		const uniqueSets = new Set();

		// Loop through each card and extract set_id from printings
		cardData.forEach((card) => {
			card.printings.forEach((printing) => {
				if (printing.set_id) uniqueSets.add(printing.set_id);
			});
		});

		sets = Array.from(uniqueSets).sort(); // Sort alphabetically for user convenience
	};

	const syncWithDatabase = () => {
		const commentator1NameRef = ref(db, 'commentators/CommentatorOne/name');
		const commentator1SubtitleRef = ref(db, 'commentators/CommentatorOne/subtitle');
		const commentator2NameRef = ref(db, 'commentators/CommentatorTwo/name');
		const commentator2SubtitleRef = ref(db, 'commentators/CommentatorTwo/subtitle');
		const commentator3NameRef = ref(db, 'commentators/CommentatorThree/name');
		const commentator3SubtitleRef = ref(db, 'commentators/CommentatorThree/subtitle');
		const commentator4NameRef = ref(db, 'commentators/CommentatorFour/name');
		const commentator4SubtitleRef = ref(db, 'commentators/CommentatorFour/subtitle');
		const formatRef = ref(db, 'format'); // Reference for format
		const selectedSetRef = ref(db, 'draftTool/selectedSet'); // Reference for the selected set

		onValue(commentator1NameRef, (snapshot) => (commentator1 = snapshot.val() ?? ''));
		onValue(commentator1SubtitleRef, (snapshot) => (subtitle1 = snapshot.val() ?? ''));
		onValue(commentator2NameRef, (snapshot) => (commentator2 = snapshot.val() ?? ''));
		onValue(commentator2SubtitleRef, (snapshot) => (subtitle2 = snapshot.val() ?? ''));
		onValue(commentator3NameRef, (snapshot) => (commentator3 = snapshot.val() ?? ''));
		onValue(commentator3SubtitleRef, (snapshot) => (subtitle3 = snapshot.val() ?? ''));
		onValue(commentator4NameRef, (snapshot) => (commentator4 = snapshot.val() ?? ''));
		onValue(commentator4SubtitleRef, (snapshot) => (subtitle4 = snapshot.val() ?? ''));
		onValue(formatRef, (snapshot) => (format = snapshot.val() ?? ''));
		onValue(selectedSetRef, (snapshot) => (selectedSet = snapshot.val() ?? ''));
	};

	const updateDatabase = async (key, value) => {
		try {
			const refPath = ref(db, key);
			await set(refPath, value);
		} catch (err) {
			console.error(`Error updating ${key} in database:`, err);
		}
	};

	onMount(() => {
		loadSets(); // Load available sets
		syncWithDatabase();
	});
</script>

<div class="p-6 border-2 border-gray-200 rounded-lg max-w-lg mx-auto mt-4 mb-32 space-y-6">
	<p class="text-xl">Event Presets</p>
	{#each [{ id: 'commentator1', label: 'Commentator 1', value: commentator1, subtitleId: 'subtitle1', subtitleValue: subtitle1, keyName: 'CommentatorOne' }, { id: 'commentator2', label: 'Commentator 2', value: commentator2, subtitleId: 'subtitle2', subtitleValue: subtitle2, keyName: 'CommentatorTwo' }, { id: 'commentator3', label: 'Commentator 3', value: commentator3, subtitleId: 'subtitle3', subtitleValue: subtitle3, keyName: 'CommentatorThree' }, { id: 'commentator4', label: 'Commentator 4', value: commentator4, subtitleId: 'subtitle4', subtitleValue: subtitle4, keyName: 'CommentatorFour' }] as commentator}
		<div class="grid grid-cols-1 gap-4">
			<div>
				<label for={commentator.id} class="block text-sm font-medium text-gray-700">
					{commentator.label}
				</label>
				<input
					id={commentator.id}
					type="text"
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
					bind:value={commentator.value}
					on:input={(e) =>
						updateDatabase(`commentators/${commentator.keyName}/name`, e.target.value)}
				/>
			</div>
			<div>
				<label for={commentator.subtitleId} class="block text-sm font-medium text-gray-700">
					Subtitle
				</label>
				<input
					id={commentator.subtitleId}
					type="text"
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
					bind:value={commentator.subtitleValue}
					on:input={(e) =>
						updateDatabase(`commentators/${commentator.keyName}/subtitle`, e.target.value)}
				/>
			</div>
		</div>
	{/each}

	<div class="grid grid-cols-1 gap-4">
		<div>
			<label for="format" class="block text-sm font-medium text-gray-700">Format</label>
			<input
				id="format"
				type="text"
				class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
				bind:value={format}
				on:input={(e) => updateDatabase('format', e.target.value)}
			/>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-4">
		<div>
			<label for="set-dropdown" class="block text-sm font-medium text-gray-700"
				>Available Sets</label
			>
			<select
				id="set-dropdown"
				class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
				bind:value={selectedSet}
				on:change={(e) => updateDatabase('draftTool/selectedSet', e.target.value)}
			>
				<option value="" disabled>Select a set</option>
				{#each sets as set}
					<option value={set}>{set}</option>
				{/each}
			</select>
		</div>
	</div>
</div>
