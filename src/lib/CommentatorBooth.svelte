<script>
	import { onMount } from 'svelte';
	import { ref, onValue, set } from 'firebase/database';
	import { db } from '../firebaseClient'; // Adjust the path to your firebase setup

	let leftCommentator = '';
	let leftSubtitle = '';
	let rightCommentator = '';
	let rightSubtitle = '';

	let commentators = []; // Holds the list of valid commentators from the database

	// Function to sync commentator details with the database
	const syncWithDatabase = () => {
		const leftCommentatorRef = ref(db, 'castingBooth/LeftCommentator/name');
		const leftSubtitleRef = ref(db, 'castingBooth/LeftCommentator/subtitle');
		const rightCommentatorRef = ref(db, 'castingBooth/RightCommentator/name');
		const rightSubtitleRef = ref(db, 'castingBooth/RightCommentator/subtitle');

		// Syncing Left Commentator
		onValue(leftCommentatorRef, (snapshot) => {
			const value = snapshot.val();
			if (value !== null) leftCommentator = value;
		});
		onValue(leftSubtitleRef, (snapshot) => {
			const value = snapshot.val();
			if (value !== null) leftSubtitle = value;
		});

		// Syncing Right Commentator
		onValue(rightCommentatorRef, (snapshot) => {
			const value = snapshot.val();
			if (value !== null) rightCommentator = value;
		});
		onValue(rightSubtitleRef, (snapshot) => {
			const value = snapshot.val();
			if (value !== null) rightSubtitle = value;
		});
	};

	// Function to fetch commentators list from the database
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
					.filter((commentator) => commentator.name && commentator.subtitle); // Filter out commentators with empty name or subtitle
			}
		});
	};

	// Function to prefill commentator details
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

<div class="w-full mt-4 sm:mt-0 border border-gray-500 rounded-lg">
	<div class="p-4">
		<h2 class="text-lg font-medium leading-6 text-white mb-2">Casting Booth</h2>

		<div class="rounded-lg border border-red-500 py-2 px-6">
			<div class="mb-1">
				<label for="leftCommentator" class="block text-sm font-medium leading-6 text-white">
					Left Commentator
				</label>
				<input
					id="leftCommentator"
					type="text"
					class="mt-2 w-full rounded-md border-0 bg-gray-800 p-2 text-white shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-red-600 sm:text-sm sm:leading-6"
					bind:value={leftCommentator}
					on:input={(e) => set(ref(db, 'castingBooth/LeftCommentator/name'), e.target.value)}
				/>
			</div>

			<div class="mb-2">
				<label for="leftSubtitle" class="block text-sm font-medium leading-6 text-white">
					Left Subtitle
				</label>
				<input
					id="leftSubtitle"
					type="text"
					class="mt-2 w-full rounded-md border-0 bg-gray-800 p-2 text-white shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-red-600 sm:text-sm sm:leading-6"
					bind:value={leftSubtitle}
					on:input={(e) => set(ref(db, 'castingBooth/LeftCommentator/subtitle'), e.target.value)}
				/>
			</div>
		</div>
		<div class="mt-2 rounded-lg border border-blue-500 py-2 px-6">
			<div class="mb-1">
				<label for="rightCommentator" class="block text-sm font-medium leading-6 text-white">
					Right Commentator
				</label>
				<input
					id="rightCommentator"
					type="text"
					class="mt-2 w-full rounded-md border-0 bg-gray-800 p-2 text-white shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
					bind:value={rightCommentator}
					on:input={(e) => set(ref(db, 'castingBooth/RightCommentator/name'), e.target.value)}
				/>
			</div>

			<div class="mb-2">
				<label for="rightSubtitle" class="block text-sm font-medium leading-6 text-white">
					Right Subtitle
				</label>
				<input
					id="rightSubtitle"
					type="text"
					class="mt-2 w-full rounded-md border-0 bg-gray-800 p-2 text-white shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
					bind:value={rightSubtitle}
					on:input={(e) => set(ref(db, 'castingBooth/RightCommentator/subtitle'), e.target.value)}
				/>
			</div>
		</div>

		<!-- Buttons to prefill commentator details -->
		<div class="my-2">
			<h3 class="text-sm font-medium leading-6 text-white mb-2">Prefill Commentator Details</h3>
			<div class="space-y-2">
				{#each commentators as commentator (commentator.id)}
					<div class="flex space-x-2">
						<button
							class="w-full font-bold px-4 py-2 bg-red-700 text-white rounded hover:bg-red-900"
							on:click={() => prefillCommentator(commentator, 'LeftCommentator')}
						>
							{commentator.name} (Left)
						</button>
						<button
							class="w-full font-bold px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-900"
							on:click={() => prefillCommentator(commentator, 'RightCommentator')}
						>
							{commentator.name} (Right)
						</button>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
