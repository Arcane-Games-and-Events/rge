<script>
	import { onMount } from 'svelte';
	import { ref, onValue, set } from 'firebase/database';
	import { db } from '../../firebaseClient'; // Adjust the path to your firebase setup

	let commentator1 = '';
	let subtitle1 = '';
	let commentator2 = '';
	let subtitle2 = '';
	let commentator3 = '';
	let subtitle3 = '';
	let commentator4 = '';
	let subtitle4 = '';
	let format = ''; // New format input

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

		// Syncing Commentator 1
		onValue(commentator1NameRef, (snapshot) => {
			const value = snapshot.val();
			if (value !== null) commentator1 = value;
		});
		onValue(commentator1SubtitleRef, (snapshot) => {
			const value = snapshot.val();
			if (value !== null) subtitle1 = value;
		});

		// Syncing Commentator 2
		onValue(commentator2NameRef, (snapshot) => {
			const value = snapshot.val();
			if (value !== null) commentator2 = value;
		});
		onValue(commentator2SubtitleRef, (snapshot) => {
			const value = snapshot.val();
			if (value !== null) subtitle2 = value;
		});

		// Syncing Commentator 3
		onValue(commentator3NameRef, (snapshot) => {
			const value = snapshot.val();
			if (value !== null) commentator3 = value;
		});
		onValue(commentator3SubtitleRef, (snapshot) => {
			const value = snapshot.val();
			if (value !== null) subtitle3 = value;
		});

		// Syncing Commentator 4
		onValue(commentator4NameRef, (snapshot) => {
			const value = snapshot.val();
			if (value !== null) commentator4 = value;
		});
		onValue(commentator4SubtitleRef, (snapshot) => {
			const value = snapshot.val();
			if (value !== null) subtitle4 = value;
		});

		// Syncing Format
		onValue(formatRef, (snapshot) => {
			const value = snapshot.val();
			if (value !== null) format = value;
		});
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
		syncWithDatabase();
	});
</script>

<div class="p-6 border-2 border-gray-200 rounded-lg max-w-lg mx-auto mt-4 mb-32 space-y-6">
	<p class="text-xl">Event Presets</p>
	{#each [{ id: 'commentator1', label: 'Commentator 1', value: commentator1, subtitleId: 'subtitle1', subtitleValue: subtitle1, keyName: 'CommentatorOne' }, { id: 'commentator2', label: 'Commentator 2', value: commentator2, subtitleId: 'subtitle2', subtitleValue: subtitle2, keyName: 'CommentatorTwo' }, { id: 'commentator3', label: 'Commentator 3', value: commentator3, subtitleId: 'subtitle3', subtitleValue: subtitle3, keyName: 'CommentatorThree' }, { id: 'commentator4', label: 'Commentator 4', value: commentator4, subtitleId: 'subtitle4', subtitleValue: subtitle4, keyName: 'CommentatorFour' }] as commentator}
		<div class="grid grid-cols-1 gap-4">
			<div>
				<label for={commentator.id} class="block text-sm font-medium text-gray-700"
					>{commentator.label}</label
				>
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
				<label for={commentator.subtitleId} class="block text-sm font-medium text-gray-700"
					>Subtitle</label
				>
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
</div>
