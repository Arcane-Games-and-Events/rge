<script>
	import { onMount } from 'svelte';
	import { ref, onValue, set } from 'firebase/database';
	import { db } from '../../firebaseClient'; // Adjust the path to your Firebase setup

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
	let eventText = ''; // Event text line

	// Set codes come from /api/cards/sets, which derives them from
	// @flesh-and-blood/cards on the server.
	const loadSets = async () => {
		try {
			const res = await fetch('/api/cards/sets');
			if (!res.ok) throw new Error(`Failed to load sets: ${res.status}`);
			const data = await res.json();
			sets = data.sets || [];
		} catch (err) {
			console.error('Error loading sets:', err);
			sets = [];
		}
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
		const eventTextRef = ref(db, 'eventText'); // Reference for event text

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
		onValue(eventTextRef, (snapshot) => (eventText = snapshot.val() ?? ''));
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

<div class="min-h-screen bg-gray-950">
	<div class="mx-auto max-w-lg px-4 py-8 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8 text-center">
			<h1 class="font-display text-3xl font-bold text-white">Event Presets</h1>
			<p class="mt-2 text-gray-400">Configure commentators and event settings.</p>
		</div>

		<!-- Commentators Section -->
		<div class="space-y-4">
			{#each [{ id: 'commentator1', label: 'Commentator 1', value: commentator1, subtitleId: 'subtitle1', subtitleValue: subtitle1, keyName: 'CommentatorOne' }, { id: 'commentator2', label: 'Commentator 2', value: commentator2, subtitleId: 'subtitle2', subtitleValue: subtitle2, keyName: 'CommentatorTwo' }, { id: 'commentator3', label: 'Commentator 3', value: commentator3, subtitleId: 'subtitle3', subtitleValue: subtitle3, keyName: 'CommentatorThree' }, { id: 'commentator4', label: 'Commentator 4', value: commentator4, subtitleId: 'subtitle4', subtitleValue: subtitle4, keyName: 'CommentatorFour' }] as commentator}
				<div class="rounded-xl border border-gray-800 bg-gray-900/50 p-4 backdrop-blur-sm">
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label for={commentator.id} class="mb-1 block text-sm font-medium text-gray-300">
								{commentator.label}
							</label>
							<input
								id={commentator.id}
								type="text"
								class="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								placeholder="Name"
								bind:value={commentator.value}
								on:input={(e) => updateDatabase(`commentators/${commentator.keyName}/name`, e.target.value)}
							/>
						</div>
						<div>
							<label for={commentator.subtitleId} class="mb-1 block text-sm font-medium text-gray-300">Subtitle</label>
							<input
								id={commentator.subtitleId}
								type="text"
								class="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								placeholder="Title or role"
								bind:value={commentator.subtitleValue}
								on:input={(e) => updateDatabase(`commentators/${commentator.keyName}/subtitle`, e.target.value)}
							/>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Event Settings Section -->
		<div class="mt-8 rounded-xl border border-gray-800 bg-gray-900/50 p-6 backdrop-blur-sm">
			<h2 class="mb-4 font-display text-lg font-semibold text-white">Event Settings</h2>
			<div class="space-y-4">
				<div>
					<label for="format" class="mb-1 block text-sm font-medium text-gray-300">Format</label>
					<input
						id="format"
						type="text"
						class="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						placeholder="e.g., Blitz, Classic Constructed"
						bind:value={format}
						on:input={(e) => updateDatabase('format', e.target.value)}
					/>
				</div>

				<div>
					<label for="set-dropdown" class="mb-1 block text-sm font-medium text-gray-300">Draft Set</label>
					<select
						id="set-dropdown"
						class="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						bind:value={selectedSet}
						on:change={(e) => updateDatabase('draftTool/selectedSet', e.target.value)}
					>
						<option value="" disabled>Select a set</option>
						{#each sets as set}
							<option value={set}>{set}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="event-text" class="mb-1 block text-sm font-medium text-gray-300">Event Text</label>
					<input
						id="event-text"
						type="text"
						class="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						placeholder="e.g., Pro Tour Chicago 2025"
						bind:value={eventText}
						on:input={(e) => updateDatabase('eventText', e.target.value)}
					/>
					<p class="mt-1 text-xs text-gray-500">View at /views/eventtext</p>
				</div>
			</div>
		</div>
	</div>
</div>
