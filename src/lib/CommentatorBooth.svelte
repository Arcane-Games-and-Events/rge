<script>
	import { onMount } from 'svelte';
	import { ref, onValue, set } from 'firebase/database';
	import { db } from '../firebaseClient';

	let leftCommentator = '';
	let leftSubtitle = '';
	let rightCommentator = '';
	let rightSubtitle = '';

	let commentators = [];

	const syncWithDatabase = () => {
		const leftCommentatorRef = ref(db, 'castingBooth/LeftCommentator/name');
		const leftSubtitleRef = ref(db, 'castingBooth/LeftCommentator/subtitle');
		const rightCommentatorRef = ref(db, 'castingBooth/RightCommentator/name');
		const rightSubtitleRef = ref(db, 'castingBooth/RightCommentator/subtitle');

		onValue(leftCommentatorRef, (snapshot) => {
			const value = snapshot.val();
			if (value !== null) leftCommentator = value;
		});
		onValue(leftSubtitleRef, (snapshot) => {
			const value = snapshot.val();
			if (value !== null) leftSubtitle = value;
		});
		onValue(rightCommentatorRef, (snapshot) => {
			const value = snapshot.val();
			if (value !== null) rightCommentator = value;
		});
		onValue(rightSubtitleRef, (snapshot) => {
			const value = snapshot.val();
			if (value !== null) rightSubtitle = value;
		});
	};

	const fetchCommentators = () => {
		const commentatorsRef = ref(db, 'commentators');
		onValue(commentatorsRef, (snapshot) => {
			const data = snapshot.val();
			if (data) {
				commentators = Object.keys(data)
					.map((key) => ({
						id: key,
						...data[key]
					}))
					.filter((commentator) => commentator.name && commentator.subtitle);
			}
		});
	};

	const prefillCommentator = async (commentator, position) => {
		try {
			const basePath = `castingBooth/${position}`;
			await set(ref(db, `${basePath}/name`), commentator.name);
			await set(ref(db, `${basePath}/subtitle`), commentator.subtitle);

			if (position === 'LeftCommentator') {
				leftCommentator = commentator.name;
				leftSubtitle = commentator.subtitle;
			} else if (position === 'RightCommentator') {
				rightCommentator = commentator.name;
				rightSubtitle = commentator.subtitle;
			}
		} catch (err) {
			console.error(`Error prefilling ${position} details:`, err);
		}
	};

	onMount(() => {
		syncWithDatabase();
		fetchCommentators();
	});
</script>

<div class="space-y-2 text-white">
	<!-- Commentators Section -->
	<div class="rounded border border-teal-500/30 bg-gray-800/30 p-2">
		<div class="text-[10px] text-teal-400 uppercase tracking-wider font-medium mb-2">
			Commentators
		</div>
		<div class="grid grid-cols-2 gap-2">
			<!-- Left Commentator -->
			<div class="space-y-1">
				<div class="text-[9px] text-red-400 uppercase font-medium">Left</div>
				<input
					type="text"
					placeholder="Name"
					class="h-9 w-full rounded border border-gray-700 bg-gray-900 px-2 text-sm text-white placeholder-gray-500 transition-colors focus:border-teal-500 focus:outline-none"
					bind:value={leftCommentator}
					on:input={(e) => set(ref(db, 'castingBooth/LeftCommentator/name'), e.target.value)}
				/>
				<input
					type="text"
					placeholder="Subtitle"
					class="h-9 w-full rounded border border-gray-700 bg-gray-900 px-2 text-sm text-white placeholder-gray-500 transition-colors focus:border-teal-500 focus:outline-none"
					bind:value={leftSubtitle}
					on:input={(e) => set(ref(db, 'castingBooth/LeftCommentator/subtitle'), e.target.value)}
				/>
				{#if commentators.length > 0}
					<div class="flex flex-wrap gap-1 pt-1">
						{#each commentators as commentator (commentator.id)}
							<button
								class="h-8 rounded bg-gray-800 px-2 text-[11px] text-gray-400 transition-colors hover:bg-red-600 hover:text-white"
								on:click={() => prefillCommentator(commentator, 'LeftCommentator')}
								title="Set as Left"
							>
								{commentator.name}
							</button>
						{/each}
					</div>
				{/if}
			</div>
			<!-- Right Commentator -->
			<div class="space-y-1">
				<div class="text-[9px] text-blue-400 uppercase font-medium">Right</div>
				<input
					type="text"
					placeholder="Name"
					class="h-9 w-full rounded border border-gray-700 bg-gray-900 px-2 text-sm text-white placeholder-gray-500 transition-colors focus:border-teal-500 focus:outline-none"
					bind:value={rightCommentator}
					on:input={(e) => set(ref(db, 'castingBooth/RightCommentator/name'), e.target.value)}
				/>
				<input
					type="text"
					placeholder="Subtitle"
					class="h-9 w-full rounded border border-gray-700 bg-gray-900 px-2 text-sm text-white placeholder-gray-500 transition-colors focus:border-teal-500 focus:outline-none"
					bind:value={rightSubtitle}
					on:input={(e) => set(ref(db, 'castingBooth/RightCommentator/subtitle'), e.target.value)}
				/>
				{#if commentators.length > 0}
					<div class="flex flex-wrap gap-1 pt-1">
						{#each commentators as commentator (commentator.id)}
							<button
								class="h-8 rounded bg-gray-800 px-2 text-[11px] text-gray-400 transition-colors hover:bg-blue-600 hover:text-white"
								on:click={() => prefillCommentator(commentator, 'RightCommentator')}
								title="Set as Right"
							>
								{commentator.name}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
