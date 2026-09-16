<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../../firebaseClient';
	import FitText from '$lib/FitText.svelte';

	let leftCommentatorName = '';
	let leftCommentatorSubtitle = '';
	let rightCommentatorName = '';
	let rightCommentatorSubtitle = '';

	const syncWithDatabase = () => {
		onValue(
			ref(db, 'castingBooth/LeftCommentator/name'),
			(s) => (leftCommentatorName = s.val() || '')
		);
		onValue(
			ref(db, 'castingBooth/LeftCommentator/subtitle'),
			(s) => (leftCommentatorSubtitle = s.val() || '')
		);
		onValue(
			ref(db, 'castingBooth/RightCommentator/name'),
			(s) => (rightCommentatorName = s.val() || '')
		);
		onValue(
			ref(db, 'castingBooth/RightCommentator/subtitle'),
			(s) => (rightCommentatorSubtitle = s.val() || '')
		);
	};

	onMount(syncWithDatabase);

	// Each name keeps a fixed footprint: broken after the first word, both lines
	// matched to the same width, and scaled so it always fills the same area.
	const NAME_BOX = { normal: { width: 288, height: 150 }, large: { width: 288, height: 180 } };
</script>

<h1 class="mb-4 text-center text-2xl font-bold">Commentators Booth</h1>

<div class="container mx-auto">
	<div class="mx-auto w-72 text-center font-bold text-white">
		<div class="flex justify-center">
			<FitText
				text={leftCommentatorName}
				align="center"
				breakAtFirstSpace
				width={NAME_BOX.normal.width}
				height={NAME_BOX.normal.height}
			/>
		</div>
		<div class="flex justify-center text-sm">
			<p class="font-light">{leftCommentatorSubtitle}</p>
		</div>
	</div>

	<div class="mx-auto mt-4 w-72 text-center font-bold text-white">
		<div class="flex justify-center">
			<FitText
				text={rightCommentatorName}
				align="center"
				breakAtFirstSpace
				width={NAME_BOX.normal.width}
				height={NAME_BOX.normal.height}
			/>
		</div>
		<div class="flex justify-center text-sm">
			<p class="font-light">{rightCommentatorSubtitle}</p>
		</div>
	</div>
</div>

<h1 class="mb-4 text-center text-2xl font-bold">Large Commentators Booth</h1>

<div class="container mx-auto">
	<div class="mx-auto w-72 text-center font-bold text-white">
		<div class="flex justify-center">
			<FitText
				text={leftCommentatorName}
				align="center"
				breakAtFirstSpace
				width={NAME_BOX.large.width}
				height={NAME_BOX.large.height}
			/>
		</div>
		<div class="flex justify-center text-sm">
			<p class="font-light">{leftCommentatorSubtitle}</p>
		</div>
	</div>

	<div class="mx-auto mt-4 w-72 text-center font-bold text-white">
		<div class="flex justify-center">
			<FitText
				text={rightCommentatorName}
				align="center"
				breakAtFirstSpace
				width={NAME_BOX.large.width}
				height={NAME_BOX.large.height}
			/>
		</div>
		<div class="flex justify-center text-sm">
			<p class="font-light">{rightCommentatorSubtitle}</p>
		</div>
	</div>
</div>
