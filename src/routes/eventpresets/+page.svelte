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

<div class="min-h-screen bg-gray-950 text-white">
	<div class="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
		<!-- The heading, as the overlays carry theirs: the title over a tan rule,
		     the line under it in tan. -->
		<header class="mb-8">
			<h1 class="font-display text-4xl font-bold uppercase tracking-wide">Event Presets</h1>
			<div class="mt-3 h-0.5 w-full bg-[#d9b499]"></div>
			<p class="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#d9b499]">
				The event, the desk and the clocks
			</p>
		</header>

		<!-- The event -->
		<section class="panel" aria-label="Event">
			<p class="caption">Event</p>
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="sm:col-span-2">
					<label for="event-text" class="field-label">Event text</label>
					<input
						id="event-text"
						type="text"
						class="field"
						placeholder="e.g., STL Players Champs"
						bind:value={eventText}
						on:input={(e) => updateDatabase('eventText', e.target.value)}
					/>
					<p class="hint">On every overlay's heading, and at /views/eventtext.</p>
				</div>
				<div>
					<label for="format" class="field-label">Format</label>
					<input
						id="format"
						type="text"
						class="field"
						placeholder="e.g., Classic Constructed"
						bind:value={format}
						on:input={(e) => updateDatabase('format', e.target.value)}
					/>
				</div>
				<div>
					<label for="set-dropdown" class="field-label">Draft set</label>
					<select
						id="set-dropdown"
						class="field"
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
		</section>

		<!-- The desk -->
		<section class="panel" aria-label="Commentators">
			<p class="caption">Commentators</p>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each [{ id: 'commentator1', n: '01', value: commentator1, subtitleId: 'subtitle1', subtitleValue: subtitle1, keyName: 'CommentatorOne' }, { id: 'commentator2', n: '02', value: commentator2, subtitleId: 'subtitle2', subtitleValue: subtitle2, keyName: 'CommentatorTwo' }, { id: 'commentator3', n: '03', value: commentator3, subtitleId: 'subtitle3', subtitleValue: subtitle3, keyName: 'CommentatorThree' }, { id: 'commentator4', n: '04', value: commentator4, subtitleId: 'subtitle4', subtitleValue: subtitle4, keyName: 'CommentatorFour' }] as commentator (commentator.id)}
					<div class="seat">
						<span class="seat-no">{commentator.n}</span>
						<div class="min-w-0 flex-1 space-y-2">
							<div>
								<label for={commentator.id} class="field-label">Name</label>
								<input
									id={commentator.id}
									type="text"
									class="field"
									placeholder="Name"
									bind:value={commentator.value}
									on:input={(e) =>
										updateDatabase(`commentators/${commentator.keyName}/name`, e.target.value)}
								/>
							</div>
							<div>
								<label for={commentator.subtitleId} class="field-label">Subtitle</label>
								<input
									id={commentator.subtitleId}
									type="text"
									class="field"
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
		</section>

		<!-- The clocks -->
		<section class="panel" aria-label="Timer presets">
			<div class="mb-1 flex items-baseline justify-between gap-3">
				<p class="caption">Timer presets</p>
				<button type="button" on:click={resetTimerPresets} class="link-btn">Reset</button>
			</div>
			<p class="hint mb-4">The two one-tap lengths behind each clock in the production booth.</p>
			<div class="grid gap-4 sm:grid-cols-2">
				{#each [{ type: 'Round' }, { type: 'Break' }] as t (t.type)}
					<div class="seat stacked">
						<span class="field-label">{t.type}</span>
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
										class="field pr-12 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
										value={timerPresets[t.type][slot]}
										on:change={(e) => saveTimerPreset(t.type, slot, e.target)}
									/>
									<span
										class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold uppercase tracking-wider text-[#d9b499]"
										>min</span
									>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</section>
	</div>
</div>

<style lang="postcss">
	/* The overlays' look, for a page: translucent dark panels with a tan edge,
	   small tan captions, square corners throughout. */
	.panel {
		@apply mb-6 border-l-4 border-[#d9b499] bg-gray-900/60 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)];
	}

	.caption {
		@apply mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d9b499];
	}

	.field-label {
		@apply mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400;
	}

	.field {
		@apply w-full border border-gray-700 bg-gray-950/70 px-3 py-2 text-white placeholder:text-gray-600 transition-colors focus:border-[#d9b499] focus:outline-none focus:ring-1 focus:ring-[#d9b499];
	}

	.hint {
		@apply mt-1 text-xs text-gray-500;
	}

	/* A commentator's seat: the number large and faint at the left, as the
	   bars carry their rank. */
	.seat {
		@apply flex gap-3 bg-white/[0.04] p-3;
	}

	.seat.stacked {
		display: block;
	}

	.seat-no {
		@apply w-9 flex-none pt-5 text-center text-2xl font-black leading-none text-[#d9b499]/60;
	}

	.link-btn {
		@apply text-xs font-semibold uppercase tracking-wider text-gray-400 transition-colors hover:text-white;
	}
</style>
