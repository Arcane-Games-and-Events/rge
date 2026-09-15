<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient'; // Adjust the path to your firebase setup
	import FitText from '$lib/FitText.svelte';
	import { lssEvent, subscribeLssEvent } from '$lib/lssEvent';

	let leftCommentatorName = '';
	let leftCommentatorSubtitle = '';
	let rightCommentatorName = '';
	let rightCommentatorSubtitle = '';

	// Function to sync the casting booth details with the database
	const syncWithDatabase = () => {
		const leftCommentatorNameRef = ref(db, 'castingBooth/LeftCommentator/name');
		const leftCommentatorSubtitleRef = ref(db, 'castingBooth/LeftCommentator/subtitle');
		const rightCommentatorNameRef = ref(db, 'castingBooth/RightCommentator/name');
		const rightCommentatorSubtitleRef = ref(db, 'castingBooth/RightCommentator/subtitle');

		// Syncing Left Commentator Name
		onValue(leftCommentatorNameRef, (snapshot) => {
			leftCommentatorName = snapshot.val() || '';
		});

		// Syncing Left Commentator Subtitle
		onValue(leftCommentatorSubtitleRef, (snapshot) => {
			leftCommentatorSubtitle = snapshot.val() || '';
		});

		// Syncing Right Commentator Name
		onValue(rightCommentatorNameRef, (snapshot) => {
			rightCommentatorName = snapshot.val() || '';
		});

		// Syncing Right Commentator Subtitle
		onValue(rightCommentatorSubtitleRef, (snapshot) => {
			rightCommentatorSubtitle = snapshot.val() || '';
		});
	};

	onMount(() => {
		syncWithDatabase(); // Fetch and sync data when the component is mounted
		subscribeLssEvent();
	});

	// The LSS look gives each caster's name a fixed footprint: broken after the
	// first word and scaled so it always fills the same area.
	const NAME_BOX = { normal: { width: 288, height: 72 }, large: { width: 288, height: 88 } };
</script>

<h1 class="text-center text-2xl font-bold mb-4">Commentators Booth</h1>

<div class="container mx-auto">
	<div class="w-72 mx-auto text-right font-bold text-white">
		{#if $lssEvent}
			<div class="flex justify-center">
				<FitText
					text={leftCommentatorName}
					align="center"
					breakAtFirstSpace
					width={NAME_BOX.normal.width}
					height={NAME_BOX.normal.height}
				/>
			</div>
		{:else}
			<p class="text-lg tracking-wide">{leftCommentatorName}</p>
		{/if}
		<div class="flex justify-end text-sm">
			<p class="text-color font-light">{leftCommentatorSubtitle}</p>
		</div>
	</div>

	<div class="w-72 mx-auto text-left font-bold text-white mt-4">
		{#if $lssEvent}
			<div class="flex justify-center">
				<FitText
					text={rightCommentatorName}
					align="center"
					breakAtFirstSpace
					width={NAME_BOX.normal.width}
					height={NAME_BOX.normal.height}
				/>
			</div>
		{:else}
			<p class="text-lg tracking-wide">{rightCommentatorName}</p>
		{/if}
		<div class="flex justify-start text-sm">
			<p class="text-color font-light">{rightCommentatorSubtitle}</p>
		</div>
	</div>
</div>

<h1 class="text-center text-2xl font-bold mb-4">Large Commentators Booth</h1>

<div class="container mx-auto">
	<div class="w-72 mx-auto text-right font-bold text-white">
		{#if $lssEvent}
			<div class="flex justify-center">
				<FitText
					text={leftCommentatorName}
					align="center"
					breakAtFirstSpace
					width={NAME_BOX.large.width}
					height={NAME_BOX.large.height}
				/>
			</div>
		{:else}
			<p class="text-xl tracking-wide leading-tight">{leftCommentatorName}</p>
		{/if}
		<div class="flex justify-end text-sm">
			<p class="text-color font-light">{leftCommentatorSubtitle}</p>
		</div>
	</div>

	<div class="w-72 mx-auto text-left font-bold text-white mt-4">
		{#if $lssEvent}
			<div class="flex justify-center">
				<FitText
					text={rightCommentatorName}
					align="center"
					breakAtFirstSpace
					width={NAME_BOX.large.width}
					height={NAME_BOX.large.height}
				/>
			</div>
		{:else}
			<p class="text-xl tracking-wide leading-tight">{rightCommentatorName}</p>
		{/if}
		<div class="flex justify-start text-sm">
			<p class="text-color font-light">{rightCommentatorSubtitle}</p>
		</div>
	</div>
</div>

<style>
	.text-color {
		color: #d8b499;
	}
</style>
