<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';
	import heroes from '$lib/data/heroes.json';

	// 1) Hydrate from localStorage if available, else default
	let players;
	let matches;
	if (typeof window !== 'undefined') {
		const storedPlayers = JSON.parse(localStorage.getItem('top8Players') || 'null');
		players =
			Array.isArray(storedPlayers) && storedPlayers.length === 8
				? storedPlayers
				: Array(8)
						.fill()
						.map(() => ({ name: '', hero: '' }));

		const storedMatches = JSON.parse(localStorage.getItem('top8Matches') || 'null');
		matches =
			storedMatches &&
			typeof storedMatches === 'object' &&
			['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6'].every((k) => k in storedMatches)
				? storedMatches
				: { m0: null, m1: null, m2: null, m3: null, m4: null, m5: null, m6: null };
	} else {
		// SSR fallback
		players = Array(8)
			.fill()
			.map(() => ({ name: '', hero: '' }));
		matches = { m0: null, m1: null, m2: null, m3: null, m4: null, m5: null, m6: null };
	}

	// unsubscribe holders
	let playersUnsub;
	let matchesUnsub;

	function slugify(str) {
		return str
			.toLowerCase()
			.replace(/["',]/g, '')
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.trim();
	}

	function getHeroImage(hero) {
		if (!hero) return '/heroImages/default.jpg';
		return `/heroImages/${slugify(hero)}.jpg`;
	}

	onMount(() => {
		// subscribe to players
		const playersRef = ref(db, 'top8/players');
		playersUnsub = onValue(playersRef, (snap) => {
			const d = snap.val() || {};
			players = players.map((_, i) => ({
				name: d[i]?.name ?? '',
				hero: d[i]?.hero ?? ''
			}));
			localStorage.setItem('top8Players', JSON.stringify(players));
		});

		// subscribe to matches
		const matchesRef = ref(db, 'top8/matches');
		matchesUnsub = onValue(matchesRef, (snap) => {
			const d = snap.val() || {};
			matches = {
				m0: d.m0 ?? null,
				m1: d.m1 ?? null,
				m2: d.m2 ?? null,
				m3: d.m3 ?? null,
				m4: d.m4 ?? null,
				m5: d.m5 ?? null,
				m6: d.m6 ?? null
			};
			localStorage.setItem('top8Matches', JSON.stringify(matches));
		});
	});

	onDestroy(() => {
		playersUnsub && playersUnsub();
		matchesUnsub && matchesUnsub();
	});

	// bracket structure
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
</script>

<div class="w-full py-8">
	<div class="mx-auto grid grid-cols-1 md:grid-cols-3 gap-x-8">
		<!-- Quarterfinals -->
		<div class="space-y-[45px]">
			{#each viewQuarterSeeds as seeds}
				<div class="space-y-[28px]">
					{#each seeds as seed}
						<div class="flex justify-end gap-x-2">
							<div class="flex flex-col text-right -space-y-1">
								<div class="text-[25px] font-bold text-white">
									({seed + 1}) {players[seed].name || '—'}
								</div>
								<div class="text-[20px] italic font-bold text-[#D9B499]">
									{players[seed].hero || '—'}
								</div>
							</div>
							{#if players[seed].hero}
								<img
									src={getHeroImage(players[seed].hero)}
									alt={players[seed].hero}
									class="w-[70px] h-[70px] rounded-full object-cover object-right"
									on:error={(e) => {
										e.target.src = `/heroImages/${slugify(players[seed].hero)}.png`;
									}}
								/>
							{/if}
						</div>
					{/each}
				</div>
			{/each}
		</div>

		<!-- Semifinals -->
		<div class="space-y-[100px]">
			{#each viewSemiSeeds as seeds}
				<div class="space-y-[36px]">
					{#each seeds as seed}
						<div class="flex justify-end gap-x-2">
							<div class="flex flex-col text-right -space-y-1">
								<div class="text-[25px] font-bold text-white">
									{seed !== null ? `(${seed + 1}) ${players[seed].name}` : '—'}
								</div>
								<div class="text-[20px] italic font-bold text-[#D9B499]">
									{seed !== null ? players[seed].hero : '—'}
								</div>
							</div>
							{#if seed !== null && players[seed].hero}
								<img
									src={getHeroImage(players[seed].hero)}
									alt={players[seed].hero}
									class="w-[70px] h-[70px] rounded-full object-cover object-right"
									on:error={(e) => {
										e.target.src = `/heroImages/${slugify(players[seed].hero)}.png`;
									}}
								/>
							{/if}
						</div>
					{/each}
				</div>
			{/each}
		</div>

		<!-- Final -->
		<div class="space-y-[30px]">
			{#each viewFinalSeeds as seed}
				<div class="flex justify-end gap-x-2">
					<div class="flex flex-col text-right -space-y-1">
						<div class="text-[25px] font-bold text-white">
							{seed !== null ? `(${seed + 1}) ${players[seed].name}` : '—'}
						</div>
						<div class="text-[20px] italic font-bold text-[#D9B499]">
							{seed !== null ? players[seed].hero : '—'}
						</div>
					</div>
					{#if seed !== null && players[seed].hero}
						<img
							src={getHeroImage(players[seed].hero)}
							alt={players[seed].hero}
							class="w-[70px] h-[70px] rounded-full object-cover object-right"
							on:error={(e) => {
								e.target.src = `/heroImages/${slugify(players[seed].hero)}.png`;
							}}
						/>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</div>
