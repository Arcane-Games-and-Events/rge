<script>
	import { onMount } from 'svelte';
	import { ref, onValue, set } from 'firebase/database';
	import { db } from '../../firebaseClient'; // Adjust the path to your Firebase setup
	import { TIMER_PRESETS_PATH, DEFAULT_TIMER_PRESETS, toTimerPresets } from '$lib/timerPresets';

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

	// The two one-tap lengths behind each timer's buttons in the booth.
	let timerPresets = {
		Round: [...DEFAULT_TIMER_PRESETS.Round],
		Break: [...DEFAULT_TIMER_PRESETS.Break]
	};

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

		// Saved on change rather than on every keystroke, so this echo never lands
		// mid-word and rewrites what is being typed.
		onValue(ref(db, TIMER_PRESETS_PATH), (snapshot) => {
			const stored = snapshot.val() || {};
			timerPresets = {
				Round: toTimerPresets('Round', stored.Round),
				Break: toTimerPresets('Break', stored.Break)
			};
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

	const saveTimerPreset = async (type, slot, field) => {
		// One slot at a time through the same coercion the booth uses, so a blank or
		// silly entry lands back on that slot's default instead of a blank button.
		const pair =
			slot === 0 ? [field.value, timerPresets[type][1]] : [timerPresets[type][0], field.value];
		const [first, second] = toTimerPresets(type, pair);
		timerPresets[type] = [first, second];

		// Written straight onto the field rather than left to the binding: a rejected
		// entry usually coerces back to the value already held, so nothing changes for
		// Svelte to react to and the box would go on showing the text that was refused.
		field.value = slot === 0 ? first : second;

		await updateDatabase(`${TIMER_PRESETS_PATH}/${type}`, timerPresets[type]);
	};

	const resetTimerPresets = async () => {
		timerPresets = {
			Round: [...DEFAULT_TIMER_PRESETS.Round],
			Break: [...DEFAULT_TIMER_PRESETS.Break]
		};
		await updateDatabase(TIMER_PRESETS_PATH, {
			Round: [...DEFAULT_TIMER_PRESETS.Round],
			Break: [...DEFAULT_TIMER_PRESETS.Break]
		});
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
								on:input={(e) =>
									updateDatabase(`commentators/${commentator.keyName}/name`, e.target.value)}
							/>
						</div>
						<div>
							<label
								for={commentator.subtitleId}
								class="mb-1 block text-sm font-medium text-gray-300">Subtitle</label
							>
							<input
								id={commentator.subtitleId}
								type="text"
								class="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								placeholder="Title or role"
								bind:value={commentator.subtitleValue}
								on:input={(e) =>
									updateDatabase(`commentators/${commentator.keyName}/subtitle`, e.target.value)}
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
					<label for="set-dropdown" class="mb-1 block text-sm font-medium text-gray-300"
						>Draft Set</label
					>
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
					<label for="event-text" class="mb-1 block text-sm font-medium text-gray-300"
						>Event Text</label
					>
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

		<!-- Timer Presets Section -->
		<div class="mt-8 rounded-xl border border-gray-800 bg-gray-900/50 p-6 backdrop-blur-sm">
			<div class="mb-1 flex items-baseline justify-between gap-3">
				<h2 class="font-display text-lg font-semibold text-white">Timer Presets</h2>
				<button
					type="button"
					on:click={resetTimerPresets}
					class="rounded-lg border border-gray-700 px-2 py-1 text-xs text-gray-400 transition-colors hover:border-gray-600 hover:text-white"
					>Reset</button
				>
			</div>
			<p class="mb-4 text-sm text-gray-400">
				The two one-tap buttons behind each timer in the production booth.
			</p>

			<div class="space-y-4">
				{#each [{ type: 'Round', accent: 'text-blue-400', focus: 'focus:border-blue-500 focus:ring-blue-500' }, { type: 'Break', accent: 'text-purple-400', focus: 'focus:border-purple-500 focus:ring-purple-500' }] as t (t.type)}
					<div>
						<span class="mb-1 block text-sm font-medium {t.accent}">{t.type}</span>
						<div class="grid grid-cols-2 gap-3">
							{#each [0, 1] as slot (slot)}
								<div class="relative">
									<input
										id="preset-{t.type}-{slot}"
										type="number"
										min="1"
										max="600"
										step="0.5"
										aria-label="{t.type} preset {slot + 1}, minutes"
										class="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 pr-12 text-white transition-colors focus:ring-1 focus:outline-none {t.focus}"
										value={timerPresets[t.type][slot]}
										on:change={(e) => saveTimerPreset(t.type, slot, e.target)}
									/>
									<span
										class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-500"
										>min</span
									>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
