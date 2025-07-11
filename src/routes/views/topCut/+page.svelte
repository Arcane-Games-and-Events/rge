<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';
	import heroes from '$lib/data/heroes.json';

	// Hydrate from localStorage or defaults
	let players, matches;
	if (typeof window !== 'undefined') {
		const sp = JSON.parse(localStorage.getItem('top8Players') || 'null');
		players =
			Array.isArray(sp) && sp.length === 8
				? sp
				: Array(8)
						.fill()
						.map(() => ({ name: '', hero: '' }));

		const sm = JSON.parse(localStorage.getItem('top8Matches') || 'null');
		matches =
			sm &&
			typeof sm === 'object' &&
			['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6'].every((k) => k in sm)
				? sm
				: { m0: null, m1: null, m2: null, m3: null, m4: null, m5: null, m6: null };
	} else {
		players = Array(8)
			.fill()
			.map(() => ({ name: '', hero: '' }));
		matches = { m0: null, m1: null, m2: null, m3: null, m4: null, m5: null, m6: null };
	}

	let playersUnsub, matchesUnsub;

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
		playersUnsub = onValue(ref(db, 'top8/players'), (snap) => {
			const d = snap.val() || {};
			players = players.map((_, i) => ({
				name: d[i]?.name ?? '',
				hero: d[i]?.hero ?? ''
			}));
			localStorage.setItem('top8Players', JSON.stringify(players));
		});

		matchesUnsub = onValue(ref(db, 'top8/matches'), (snap) => {
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

	// === BRACKET ORDER ===
	const viewQuarterSeeds = [
		[0, 7], // 1 vs 8
		[3, 4], // 4 vs 5
		[2, 5], // 3 vs 6
		[1, 6] // 2 vs 7
	];

	// Semis: winners of QF0 vs QF1, QF2 vs QF3
	$: viewSemiSeeds = [
		[matches.m0, matches.m1],
		[matches.m2, matches.m3]
	];
	// Final: winners of those semis
	$: viewFinalSeeds = [matches.m4, matches.m5];
</script>

<div class="w-full py-8">
	<div class="mx-auto grid grid-cols-1 md:grid-cols-3 gap-x-8">
		<!-- Quarterfinals -->
		<div class="space-y-[45px]">
			{#each viewQuarterSeeds as seeds}
				<div class="space-y-[28px]">
					{#each seeds as seed}
						<div class="flex justify-end gap-x-2 items-center h-[70px]">
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
								/>
							{/if}
						</div>
					{/each}
				</div>
			{/each}
		</div>

		<!-- Semifinals (fade-in winners) -->
		<div class="space-y-[100px]">
			{#each viewSemiSeeds as seeds}
				<div class="space-y-[36px]">
					{#each seeds as seed}
						<div
							class="flex justify-end gap-x-2 items-center h-[70px] transition-opacity duration-500"
							class:opacity-0={seed === null}
							class:opacity-100={seed !== null}
						>
							{#if seed !== null}
								<div class="flex flex-col text-right -space-y-1">
									<div class="text-[25px] font-bold text-white">
										({seed + 1}) {players[seed].name}
									</div>
									<div class="text-[20px] italic font-bold text-[#D9B499]">
										{players[seed].hero}
									</div>
								</div>
								<img
									src={getHeroImage(players[seed].hero)}
									alt={players[seed].hero}
									class="w-[70px] h-[70px] rounded-full object-cover object-right"
								/>
							{/if}
						</div>
					{/each}
				</div>
			{/each}
		</div>

		<!-- Final (fade-in winners) -->
		<div class="space-y-[30px]">
			{#each viewFinalSeeds as seed}
				<div
					class="flex justify-end gap-x-2 items-center h-[70px] transition-opacity duration-500"
					class:opacity-0={seed === null}
					class:opacity-100={seed !== null}
				>
					{#if seed !== null}
						<div class="flex flex-col text-right -space-y-1">
							<div class="text-[25px] font-bold text-white">
								({seed + 1}) {players[seed].name}
							</div>
							<div class="text-[20px] italic font-bold text-[#D9B499]">
								{players[seed].hero}
							</div>
						</div>
						<img
							src={getHeroImage(players[seed].hero)}
							alt={players[seed].hero}
							class="w-[70px] h-[70px] rounded-full object-cover object-right"
						/>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</div>
