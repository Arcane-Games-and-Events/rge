<script>
	import { onMount } from 'svelte';
	import { ref, onValue, update } from 'firebase/database';
	import { db } from '../../firebaseClient';
	import { TOPICS_PATH, TOPIC_COUNT, normalizeTopics, programmedCount } from '$lib/topics';

	// Program the show's story list here; the overlay at /views/topics draws it,
	// and the buttons below, or a Companion button on the same URLs, step it.
	let title = '';
	let items = Array(TOPIC_COUNT).fill('');
	let shown = 0;
	let origin = '';
	let copied = '';

	$: programmed = programmedCount(items);

	onMount(() => {
		origin = window.location.origin;
		return onValue(ref(db, TOPICS_PATH), (snapshot) => {
			({ title, items, shown } = normalizeTopics(snapshot.val()));
		});
	});

	const save = (fields) => update(ref(db, TOPICS_PATH), fields);
	const saveItem = (i, value) => save({ [`items/${i}`]: value });

	// The buttons go through the same endpoint Companion uses, so what is
	// rehearsed here is exactly what the deck will do.
	async function send(command) {
		await fetch(`/topics/${command}`, { method: 'POST' });
	}

	async function copy(path) {
		await navigator.clipboard.writeText(`${origin}${path}`);
		copied = path;
		setTimeout(() => (copied = ''), 1500);
	}

	const COMMANDS = [
		['next', 'Next topic on'],
		['back', 'Last topic off'],
		['reset', 'All off'],
		['all', 'All on']
	];
</script>

<div class="min-h-screen bg-gray-950 text-white">
	<div class="mx-auto max-w-lg px-4 py-8 sm:px-6">
		<div class="mb-8 text-center">
			<h1 class="font-display text-3xl font-bold">Topics</h1>
			<p class="mt-2 text-gray-400">The story list beside the hosts, one topic at a time.</p>
		</div>

		<!-- On air -->
		<div class="mb-6 rounded-xl border border-amber-500/40 bg-gray-900/60 p-4">
			<div class="mb-3 flex items-baseline justify-between">
				<span class="text-[10px] font-medium uppercase tracking-wider text-amber-400">On air</span>
				<span class="text-sm text-gray-300">
					{#if programmed}
						{shown} of {programmed} showing
					{:else}
						No topics programmed
					{/if}
				</span>
			</div>
			<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
				<button
					type="button"
					class="rounded-lg bg-amber-500 px-3 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-amber-400 disabled:opacity-40"
					disabled={shown >= programmed}
					on:click={() => send('next')}
				>
					Next ›
				</button>
				<button
					type="button"
					class="rounded-lg border border-gray-700 bg-gray-800 px-3 py-3 text-sm font-medium transition-colors hover:border-gray-500 disabled:opacity-40"
					disabled={shown === 0}
					on:click={() => send('back')}
				>
					‹ Back
				</button>
				<button
					type="button"
					class="rounded-lg border border-gray-700 bg-gray-800 px-3 py-3 text-sm font-medium transition-colors hover:border-gray-500 disabled:opacity-40"
					disabled={shown >= programmed}
					on:click={() => send('all')}
				>
					All on
				</button>
				<button
					type="button"
					class="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-3 text-sm font-medium text-red-200 transition-colors hover:border-red-700 disabled:opacity-40"
					disabled={shown === 0}
					on:click={() => send('reset')}
				>
					Reset
				</button>
			</div>
		</div>

		<!-- The words -->
		<div class="space-y-4 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
			<div>
				<label for="topics-title" class="mb-1 block text-sm font-medium text-gray-300">Title</label>
				<input
					id="topics-title"
					type="text"
					class="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					placeholder="Weekend *Stories*"
					bind:value={title}
					on:change={() => save({ title })}
				/>
			</div>
			{#each items as text, i}
				<div>
					<label
						for="topic-{i}"
						class="mb-1 flex items-center gap-2 text-sm font-medium text-gray-300"
					>
						Topic {i + 1}
						{#if i < shown && text.trim()}
							<span
								class="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-300"
								>On air</span
							>
						{/if}
					</label>
					<input
						id="topic-{i}"
						type="text"
						class="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						placeholder={[
							'*Oscilio* on top',
							'Calling *Kansas*',
							"*Usurp's* arrival",
							'AGE *Players Champs*'
						][i]}
						value={text}
						on:change={(e) => saveItem(i, e.currentTarget.value)}
					/>
				</div>
			{/each}
			<p class="text-xs text-gray-500">
				Wrap the words that should read in gold in asterisks: <code class="text-gray-400"
					>*Oscilio* on top</code
				>. Saved when you leave the box.
			</p>
		</div>

		<!-- Companion -->
		<div class="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
			<div class="mb-3 text-[10px] font-medium uppercase tracking-wider text-blue-400">
				Companion buttons
			</div>
			<p class="mb-3 text-xs text-gray-500">
				An HTTP request action, GET or POST, to any of these. The deck's Next button is the first.
			</p>
			<ul class="space-y-2">
				{#each COMMANDS as [command, what] (command)}
					<li class="flex items-center gap-2">
						<code
							class="flex-1 break-all rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-2 text-sm text-gray-300"
							>{origin}/topics/{command}</code
						>
						<span class="hidden w-28 text-xs text-gray-500 sm:block">{what}</span>
						<button
							type="button"
							class="rounded-lg border px-2.5 py-2 text-xs transition-colors {copied ===
							`/topics/${command}`
								? 'border-green-500 bg-green-500/20 text-green-400'
								: 'border-gray-800 bg-gray-800/50 text-gray-400 hover:border-gray-700 hover:text-gray-200'}"
							on:click={() => copy(`/topics/${command}`)}
						>
							{copied === `/topics/${command}` ? 'Copied' : 'Copy'}
						</button>
					</li>
				{/each}
			</ul>
			<p class="mt-3 text-xs text-gray-500">
				Overlay: <a class="text-blue-400 hover:underline" href="/views/topics">/views/topics</a>, a
				1920×1080 browser source over the slide.
			</p>
		</div>
	</div>
</div>
