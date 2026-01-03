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

	// === IMAGE HELPERS ===
	const normalize = (s = '') => s.toLowerCase().replace(/["',]/g, '').trim();

	// Exceptions map
	const IMAGE_EXCEPTIONS = {
		'arakni huntsman': '/heroImages/arakni-huntsman.jpg'
	};

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
		const key = normalize(hero);
		if (key in IMAGE_EXCEPTIONS) return IMAGE_EXCEPTIONS[key];
		return `/heroImages/${slugify(hero)}.jpg`;
	}

	function heroImgError(e, hero) {
		const key = normalize(hero);
		if (key in IMAGE_EXCEPTIONS) {
			e.target.src = IMAGE_EXCEPTIONS[key].replace(/\.jpg$/i, '.png');
		} else {
			e.target.src = `/heroImages/${slugify(hero)}.png`;
		}
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
			{#each viewQuarterSeeds as seeds, matchIdx}
				<div class="space-y-[28px]">
					{#each seeds as seed, playerIdx}
						{@const delay = (matchIdx * 2 + playerIdx) * 100}
						<div class="player-row flex justify-end gap-x-2 h-[70px]" style="--delay: {delay}ms;">
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
									loading="lazy"
									src={getHeroImage(players[seed].hero)}
									alt={players[seed].hero}
									class="w-[70px] h-[70px] rounded-full object-cover object-right"
									on:error={(e) => heroImgError(e, players[seed].hero)}
								/>
							{/if}
						</div>
					{/each}
				</div>
			{/each}
		</div>

		<!-- Semifinals (fade-in winners) -->
		<div class="space-y-[100px]">
			{#each viewSemiSeeds as seeds, matchIdx}
				<div class="space-y-[36px]">
					{#each seeds as seed, playerIdx}
						{@const delay = 800 + (matchIdx * 2 + playerIdx) * 100}
						<div
							class="player-row flex justify-end gap-x-2 h-[70px] transition-opacity duration-500"
							class:opacity-0={seed === null}
							class:opacity-100={seed !== null}
							style="--delay: {delay}ms;"
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
									loading="lazy"
									src={getHeroImage(players[seed].hero)}
									alt={players[seed].hero}
									class="w-[70px] h-[70px] rounded-full object-cover object-right"
									on:error={(e) => heroImgError(e, players[seed].hero)}
								/>
							{/if}
						</div>
					{/each}
				</div>
			{/each}
		</div>

		<!-- Final (fade-in winners) -->
		<div class="space-y-[30px]">
			{#each viewFinalSeeds as seed, idx}
				{@const delay = 1200 + idx * 100}
				<div
					class="player-row flex justify-end gap-x-2 h-[70px] transition-opacity duration-500"
					class:opacity-0={seed === null}
					class:opacity-100={seed !== null}
					style="--delay: {delay}ms;"
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
							loading="lazy"
							src={getHeroImage(players[seed].hero)}
							alt={players[seed].hero}
							class="w-[70px] h-[70px] rounded-full object-cover object-right"
							on:error={(e) => heroImgError(e, players[seed].hero)}
						/>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.player-row {
		animation: slideReveal 0.6s cubic-bezier(0.22, 1, 0.36, 1) backwards;
		animation-delay: var(--delay, 0ms);
	}

	@keyframes slideReveal {
		0% {
			opacity: 0;
			transform: translateX(-30px);
			clip-path: inset(0 100% 0 0);
		}
		100% {
			opacity: 1;
			transform: translateX(0);
			clip-path: inset(0 0 0 0);
		}
	}
</style>
