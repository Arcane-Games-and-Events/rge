<script>
	import { onMount } from 'svelte';
	import { ref, onValue, set } from 'firebase/database';
	import { db } from '../../firebaseClient';
	import heroes from '$lib/data/heroes.json';

	// 8 fixed seed slots and their current heroes
	let players = Array(8)
		.fill()
		.map(() => ({ name: '', hero: '' }));
	// match winners stored as m0…m6 → seed index
	let matches = {};

	onMount(() => {
		onValue(ref(db, 'top8/players'), (snap) => {
			const data = snap.val() || {};
			players = players.map((_, i) => ({
				name: data[i]?.name ?? '',
				hero: data[i]?.hero ?? ''
			}));
		});
		onValue(ref(db, 'top8/matches'), (snap) => {
			matches = snap.val() || {};
		});
	});

	// Save a change to a player's name or hero
	function updatePlayer(i, field, val) {
		players[i][field] = val;
		set(ref(db, `top8/players/${i}/${field}`), val);
	}

	// Toggle a winner: clicking the same seed again clears it
	function toggleWinner(matchIdx, seed) {
		const key = `m${matchIdx}`;
		if (matches[key] === seed) {
			set(ref(db, `top8/matches/${key}`), null);
		} else {
			set(ref(db, `top8/matches/${key}`), seed);
		}
	}

	// Quarterfinal pairings: [1v8,4v5,3v6,2v7] → indices [0,7],[3,4],[2,5],[1,6]
	const quarterfinalSeeds = [
		[0, 7],
		[3, 4],
		[2, 5],
		[1, 6]
	];
	// Semifinals derive from QF winners
	$: semifinalSeeds = [
		[matches.m0, matches.m1],
		[matches.m2, matches.m3]
	];
	// Final derives from SF winners
	$: finalSeeds = [matches.m4, matches.m5];

	// Slugify for hero image filenames
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

<!-- Full‐width background -->
<div class="w-full bg-gray-900">
	<!-- Constrained content -->
	<div class="max-w-4xl mx-auto p-6 space-y-8">
		<h1 class="text-3xl font-bold text-white text-center">🛠 Top 8 Admin</h1>

		<!-- Player inputs: one per row with two columns -->
		<div class="space-y-4">
			{#each players as p, i}
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<!-- Name input -->
					<div>
						<label for="player-name-{i}" class="block text-gray-400 text-sm mb-1">
							Seed {i + 1} – Name
						</label>
						<input
							id="player-name-{i}"
							class="w-full px-3 py-2 bg-gray-800 text-white rounded focus:ring-2 focus:ring-blue-500"
							type="text"
							placeholder="Player Name"
							bind:value={p.name}
							on:change={(e) => updatePlayer(i, 'name', e.target.value)}
						/>
					</div>

					<!-- Hero select -->
					<div>
						<label for="player-hero-{i}" class="block text-gray-400 text-sm mb-1"> Hero </label>
						<select
							id="player-hero-{i}"
							aria-label="Select hero for seed {i + 1}"
							class="w-full px-3 py-2 bg-gray-800 text-white rounded focus:ring-2 focus:ring-blue-500"
							bind:value={p.hero}
							on:change={(e) => updatePlayer(i, 'hero', e.target.value)}
						>
							<option value="">Select Hero</option>
							{#each heroes as h}
								<option value={h.name}>{h.name}</option>
							{/each}
						</select>
					</div>
				</div>
			{/each}
		</div>

		<hr class="border-gray-700" />

		<!-- Bracket: stacked vertical matches -->

		<!-- Quarterfinals -->
		<div class="space-y-4">
			<h2 class="text-xl font-semibold text-blue-400 text-center">Quarterfinals</h2>
			{#each quarterfinalSeeds as seeds, qi}
				<div class="flex bg-gray-800 rounded-md overflow-hidden border border-gray-700">
					{#each seeds as seed, idx}
						<button
							type="button"
							on:click={() => toggleWinner(qi, seed)}
							class="w-1/2 p-3 transition focus:outline-none
								{matches[`m${qi}`] === seed ? 'bg-blue-700' : 'hover:bg-gray-700'}"
						>
							{#if idx === 0}
								<!-- Left competitor -->
								<div class="flex items-center justify-end">
									<div class="text-right pr-3 space-y-1">
										<div class="text-white text-lg font-bold truncate">
											({seed + 1}) {players[seed]?.name || '—'}
										</div>
										<div class="text-gray-300 text-base truncate">
											{players[seed]?.hero || '—'}
										</div>
									</div>
									{#if players[seed]?.hero}
										<img
											src={heroFilename(players[seed].hero)}
											alt={players[seed].hero}
											class="w-12 h-12 rounded-full object-cover object-right ml-2 flex-shrink-0"
										/>
									{/if}
								</div>
							{:else}
								<!-- Right competitor -->
								<div class="flex items-center justify-start">
									{#if players[seed]?.hero}
										<img
											src={heroFilename(players[seed].hero)}
											alt={players[seed].hero}
											class="w-12 h-12 rounded-full object-cover object-right mr-2 flex-shrink-0"
										/>
									{/if}
									<div class="text-left space-y-1">
										<div class="text-white text-lg font-bold truncate">
											({seed + 1}) {players[seed]?.name || '—'}
										</div>
										<div class="text-gray-300 text-base truncate">
											{players[seed]?.hero || '—'}
										</div>
									</div>
								</div>
							{/if}
						</button>
					{/each}
				</div>
			{/each}
		</div>

		<!-- Semifinals -->
		<div class="space-y-4">
			<h2 class="text-xl font-semibold text-blue-400 text-center">Semifinals</h2>
			{#each semifinalSeeds as seeds, si}
				<div class="flex bg-gray-800 rounded-md overflow-hidden border border-gray-700">
					{#each seeds as seed, idx}
						<button
							type="button"
							on:click={() => toggleWinner(si + 4, seed)}
							class="w-1/2 p-3 transition focus:outline-none
								{matches[`m${si + 4}`] === seed ? 'bg-blue-700' : 'hover:bg-gray-700'}"
						>
							{#if idx === 0}
								<div class="flex items-center justify-end">
									<div class="text-right pr-3 space-y-1">
										<div class="text-white text-lg font-bold truncate">
											({seed + 1}) {players[seed]?.name || '—'}
										</div>
										<div class="text-gray-300 text-base truncate">
											{players[seed]?.hero || '—'}
										</div>
									</div>
									{#if players[seed]?.hero}
										<img
											src={heroFilename(players[seed].hero)}
											alt={players[seed].hero}
											class="w-12 h-12 rounded-full object-cover object-right ml-2 flex-shrink-0"
										/>
									{/if}
								</div>
							{:else}
								<div class="flex items-center justify-start">
									{#if players[seed]?.hero}
										<img
											src={heroFilename(players[seed].hero)}
											alt={players[seed].hero}
											class="w-12 h-12 rounded-full object-cover object-right mr-2 flex-shrink-0"
										/>
									{/if}
									<div class="text-left space-y-1">
										<div class="text-white text-lg font-bold truncate">
											({seed + 1}) {players[seed]?.name || '—'}
										</div>
										<div class="text-gray-300 text-base truncate">
											{players[seed]?.hero || '—'}
										</div>
									</div>
								</div>
							{/if}
						</button>
					{/each}
				</div>
			{/each}
		</div>

		<!-- Final -->
		<div class="space-y-4 mx-auto">
			<h2 class="text-xl font-semibold text-blue-400 text-center">Final</h2>
			<div class="flex bg-gray-800 rounded-md overflow-hidden border border-gray-700">
				{#each finalSeeds as seed, idx}
					<button
						type="button"
						on:click={() => toggleWinner(6, seed)}
						class="w-1/2 p-3 transition focus:outline-none
                   {matches.m6 === seed ? 'bg-blue-700' : 'hover:bg-gray-700'}"
					>
						{#if idx === 0}
							<div class="flex items-center justify-end">
								<div class="text-right pr-3 space-y-1">
									<div class="text-white text-lg font-bold truncate">
										({seed + 1}) {players[seed]?.name || '—'}
									</div>
									<div class="text-gray-300 text-base truncate">
										{players[seed]?.hero || '—'}
									</div>
								</div>
								{#if players[seed]?.hero}
									<img
										src={heroFilename(players[seed].hero)}
										alt={players[seed].hero}
										class="w-12 h-12 rounded-full object-cover object-right ml-2 flex-shrink-0"
									/>
								{/if}
							</div>
						{:else}
							<div class="flex items-center justify-start">
								{#if players[seed]?.hero}
									<img
										src={heroFilename(players[seed].hero)}
										alt={players[seed].hero}
										class="w-12 h-12 rounded-full object-cover object-right mr-2 flex-shrink-0"
									/>
								{/if}
								<div class="text-left space-y-1">
									<div class="text-white text-lg font-bold truncate">
										({seed + 1}) {players[seed]?.name || '—'}
									</div>
									<div class="text-gray-300 text-base truncate">
										{players[seed]?.hero || '—'}
									</div>
								</div>
							</div>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	</div>
</div>
