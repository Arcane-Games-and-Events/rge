<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../../firebaseClient';
	import ShrinkText from '$lib/ShrinkText.svelte';
	import 'flag-icons/css/flag-icons.min.css';
	import '$lib/flagOverrides.css';

	let players = {
		p1: { name: '', record: '', hero: '', flag: '' },
		p2: { name: '', record: '', hero: '', flag: '' }
	};

	let draftInfo = { name: '', pod: '', seat: '' };

	function fetchData() {
		Object.keys(players).forEach((playerId) => {
			onValue(ref(db, `playerInfo/${playerId}`), (snapshot) => {
				const data = snapshot.val();
				if (data) {
					players[playerId] = {
						name: data.name || '',
						record: data.record || '',
						hero: data.hero || '',
						flag: data.flag || ''
					};
				}
			});
		});
	}

	function fetchDraftInfo() {
		onValue(ref(db, 'playerInfo/draft'), (snapshot) => {
			const data = snapshot.val() || {};
			draftInfo.name = data.name || '';
			draftInfo.pod = data.pod || '';
			draftInfo.seat = data.seat || '';
		});
	}

	onMount(() => {
		fetchData();
		fetchDraftInfo();
	});

	// The two seats point away from each other; everything beneath a name is
	// centred under it.
	const seats = [
		{ id: 'p1', align: 'text-left' },
		{ id: 'p2', align: 'text-right' }
	];

	// The centred block keeps a fixed footprint so it can be positioned once in
	// OBS: names render at one size and only shrink if they would overrun.
	const NAME_BOX = { width: 288, height: 40, size: 28 };
</script>

<div class="container mx-auto">
	{#each seats as seat (seat.id)}
		<div class="mx-auto w-72 font-bold text-white {seat.align}">
			<p class="text-2xl whitespace-nowrap">{players[seat.id].name}</p>
			<div class="flex flex-col items-center text-sm">
				<p>{players[seat.id].hero}</p>
				<p>{players[seat.id].record}</p>
			</div>
			{#if players[seat.id].flag}
				<div class="text-center">
					<span
						class="fi fi-{players[seat.id].flag} mt-1 inline-block text-2xl"
						title={players[seat.id].flag.toUpperCase()}
					></span>
				</div>
			{/if}
		</div>
	{/each}

	<!-- Centred names, fixed footprint -->
	<div class="mt-6">
		{#each seats as seat (seat.id)}
			<div class="mx-auto w-72 font-bold text-white">
				<div class="flex justify-center">
					<ShrinkText
						text={players[seat.id].name}
						width={NAME_BOX.width}
						height={NAME_BOX.height}
						size={NAME_BOX.size}
					/>
				</div>
				<div class="flex flex-col items-center text-sm">
					<p>{players[seat.id].hero}</p>
					<p>{players[seat.id].record}</p>
				</div>
				{#if players[seat.id].flag}
					<div class="text-center">
						<span
							class="fi fi-{players[seat.id].flag} mt-1 inline-block text-2xl"
							title={players[seat.id].flag.toUpperCase()}
						></span>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<div class="mx-auto w-72 text-center font-bold text-white">
		<p class="text-2xl">{draftInfo.name}</p>
	</div>
</div>
