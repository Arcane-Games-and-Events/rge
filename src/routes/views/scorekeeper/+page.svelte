<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';
	import heroes from '$lib/data/heroes.json';

	let players = Array(8)
		.fill()
		.map(() => ({ name: '', hero: '' }));
	let matches = {};

	onMount(() => {
		onValue(ref(db, 'top8/players'), (snap) => {
			const d = snap.val() || {};
			players = players.map((_, i) => ({
				name: d[i]?.name ?? '',
				hero: d[i]?.hero ?? ''
			}));
		});
		onValue(ref(db, 'top8/matches'), (snap) => {
			matches = snap.val() || {};
		});
	});

	const viewQuarterSeeds = [
		[0, 7],
		[5, 2],
		[4, 3],
		[1, 6]
	];
	$: viewSemiSeeds = [
		[matches.m0, matches.m1],
		[matches.m2, matches.m3]
	];
	$: viewFinalSeeds = [matches.m4, matches.m5];

	function slugify(name) {
		return name
			.toLowerCase()
			.replace(/["',]/g, '')
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.trim();
	}
	function heroFilename(name) {
		return name ? `/heroImages/${slugify(name)}.jpg` : '';
	}
</script>

<div class="w-full py-8">
	<div class="mx-auto grid grid-cols-1 md:grid-cols-3 gap-x-8">
		<!-- Quarterfinals -->
		<div class="space-y-[45px]">
			{#each viewQuarterSeeds as seeds}
				<div class="space-y-[28px]">
					{#each seeds as seed}
						<div class="flex justify-end gap-x-2">
							<div class="flex flex-col text-right space-y-[-4px]">
								<div class="text-[25px] font-bold text-white">
									({seed + 1}) {players[seed]?.name || '—'}
								</div>
								<div class="text-[20px] italic font-bold text-[#D9B499]">
									{players[seed]?.hero || '—'}
								</div>
							</div>
							{#if players[seed]?.hero}
								<img
									src={heroFilename(players[seed].hero)}
									alt={players[seed].hero}
									class="w-[70px] h-[70px] rounded-full object-cover object-right flex-shrink-0"
								/>
							{/if}
						</div>
					{/each}
				</div>
			{/each}
		</div>

		<!-- Semifinals -->
		<div class="space-y-[100px]">
			{#each viewSemiSeeds as seeds, si}
				<div class="space-y-[36px]">
					{#each seeds as seed, idx}
						{#key `${si}-${idx}-${seed}`}
							{#if seed != null}
								<div class="flex justify-end gap-x-2">
									<div class="flex flex-col text-right space-y-[-4px]">
										<div class="text-[25px] font-bold text-white">
											({seed + 1}) {players[seed]?.name}
										</div>
										<div class="text-[20px] italic font-bold text-[#D9B499]">
											{players[seed]?.hero}
										</div>
									</div>
									<img
										src={heroFilename(players[seed].hero)}
										alt={players[seed].hero}
										class="w-[70px] h-[70px] rounded-full object-cover object-right flex-shrink-0"
									/>
								</div>
							{:else}
								<div class="h-[70px] w-[70px]"></div>
							{/if}
						{/key}
					{/each}
				</div>
			{/each}
		</div>

		<!-- Final -->
		<div class="space-y-[30px]">
			{#each viewFinalSeeds as seed, fi}
				{#key `final-${fi}-${seed}`}
					{#if seed != null}
						<div class="flex justify-end gap-x-2">
							<div class="flex flex-col text-right space-y-[-4px]">
								<div class="text-[25px] font-bold text-white">
									({seed + 1}) {players[seed]?.name}
								</div>
								<div class="text-[20px] italic font-bold text-[#D9B499]">
									{players[seed]?.hero}
								</div>
							</div>
							<img
								src={heroFilename(players[seed].hero)}
								alt={players[seed].hero}
								class="w-[70px] h-[70px] rounded-full object-cover object-right flex-shrink-0"
							/>
						</div>
					{:else}
						<div class="h-[70px] w-[70px]"></div>
					{/if}
				{/key}
			{/each}
		</div>
	</div>
</div>
