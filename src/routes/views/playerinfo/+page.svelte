<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';
	import { lssEvent, subscribeLssEvent } from '$lib/lssEvent';

	let players = {
		p1: { name: '', record: '', hero: '' },
		p2: { name: '', record: '', hero: '' }
	};

	let draftInfo = {
		name: '',
		pod: '',
		seat: ''
	};

	function fetchData() {
		Object.keys(players).forEach((playerId) => {
			const playerRef = ref(db, `playerInfo/${playerId}`);
			onValue(playerRef, (snapshot) => {
				const data = snapshot.val();
				if (data) {
					players[playerId] = {
						name: data.name || '',
						record: data.record || '',
						hero: data.hero || ''
					};
				}
			});
		});
	}

	function fetchDraftInfo() {
		const draftRef = ref(db, `playerInfo/draft`);
		onValue(draftRef, (snapshot) => {
			const data = snapshot.val() || {};
			draftInfo.name = data.name || '';
			draftInfo.pod = data.pod || '';
			draftInfo.seat = data.seat || '';
		});
	}
	// onMount(fetchData);
	onMount(() => {
		fetchData();
		fetchDraftInfo();
		subscribeLssEvent();
	});
</script>

<h1 class="text-center text-2xl font-bold mb-4">Views</h1>

<div class="container mx-auto">
	<div class="w-72 mx-auto font-bold text-white {$lssEvent ? 'text-left' : 'text-right'}">
		<p class="text-2xl {$lssEvent ? 'whitespace-nowrap' : ''}">{players.p1.name}</p>
		<div class="flex text-sm {$lssEvent ? 'justify-center' : 'justify-end'}">
			<p class="text-color">{players.p1.hero}</p>
			<p class="ml-1">{players.p1.record}</p>
		</div>
	</div>

	<div class="w-72 mx-auto font-bold text-white {$lssEvent ? 'text-right' : 'text-left'}">
		<p class="text-2xl {$lssEvent ? 'whitespace-nowrap' : ''}">{players.p2.name}</p>
		<div class="flex text-sm {$lssEvent ? 'justify-center' : 'justify-start'}">
			<p class="mr-1">{players.p2.record}</p>
			<p class="text-color">{players.p2.hero}</p>
		</div>
	</div>

	<div class="w-72 mx-auto text-center font-bold text-white">
		<p class="text-2xl">{draftInfo.name}</p>
	</div>

	<div>
		<h1 class="text-center text-2xl font-bold mb-4">Centered Names</h1>
		<div class="w-72 mx-auto text-center font-bold text-white">
			<p class="text-2xl {$lssEvent ? 'whitespace-nowrap' : ''}">{players.p1.name}</p>
			<div class="flex justify-center text-sm">
				<p>{players.p1.record}</p>
				<p class="ml-1 text-color">{players.p1.hero}</p>
			</div>
		</div>

		<div class="w-72 mx-auto text-center font-bold text-white">
			<p class="text-2xl {$lssEvent ? 'whitespace-nowrap' : ''}">{players.p2.name}</p>
			<div class="flex justify-center text-sm">
				<p>{players.p2.record}</p>
				<p class="ml-1 text-color">{players.p2.hero}</p>
			</div>
		</div>
	</div>
</div>

<style>
	.text-color {
		color: #d8b499;
	}
</style>
