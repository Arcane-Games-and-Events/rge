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

	// Hero options sorted
	const heroOptions = heroes
		.map((h) => h?.name?.trim())
		.filter(Boolean)
		.sort((a, b) => a.localeCompare(b));
</script>

<div class="min-h-screen bg-gray-950">
	<div class="p-3 sm:p-4 max-w-4xl mx-auto space-y-3">
		<!-- Player Setup Card -->
		<div class="bg-gray-900 border border-gray-800 rounded-lg p-3">
			<div class="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2">Player Setup</div>
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-1">
				{#each players as p, i}
					<div class="flex items-center gap-1.5 rounded border border-gray-800 bg-gray-800/50 px-2 py-1.5 {p.name ? 'border-l-2 border-l-blue-500' : ''}">
						<span class="text-[10px] font-mono text-gray-500 flex-shrink-0">{i + 1}</span>
						<div class="flex-1 min-w-0 space-y-0.5">
							<input
								class="w-full rounded border border-gray-700 bg-gray-900 px-1.5 py-0.5 text-[11px] text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
								type="text"
								placeholder="Name"
								bind:value={p.name}
								on:change={(e) => updatePlayer(i, 'name', e.target.value)}
							/>
							<select
								class="w-full rounded border border-gray-700 bg-gray-900 px-1.5 py-0.5 text-[11px] text-white focus:border-blue-500 focus:outline-none"
								bind:value={p.hero}
								on:change={(e) => updatePlayer(i, 'hero', e.target.value)}
							>
								<option value="">Hero</option>
								{#each heroOptions as h}<option value={h}>{h}</option>{/each}
							</select>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Bracket Section -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
			<!-- Quarterfinals -->
			<div class="bg-gray-900 border border-gray-800 rounded-lg p-3">
				<div class="text-[10px] text-blue-400 uppercase tracking-wider font-medium mb-3">Quarterfinals</div>
				<div class="space-y-2">
					{#each quarterfinalSeeds as seeds, qi}
						<div class="rounded-lg border border-gray-800 overflow-hidden {matches[`m${qi}`] !== undefined && matches[`m${qi}`] !== null ? 'border-l-2 border-l-green-500' : ''}">
							{#each seeds as seed, idx}
								<button
									type="button"
									on:click={() => toggleWinner(qi, seed)}
									class="w-full p-2 flex items-center gap-2 transition-colors focus:outline-none {matches[`m${qi}`] === seed ? 'bg-green-600/30' : 'bg-gray-800/50 hover:bg-gray-800'} {idx === 0 ? '' : 'border-t border-gray-700'}"
								>
									<img
										src={heroFilename(players[seed]?.hero)}
										alt={players[seed]?.hero}
										class="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-gray-700"
										loading="lazy"
									/>
									<div class="flex-1 min-w-0 text-left">
										<div class="text-xs font-medium text-white truncate">
											({seed + 1}) {players[seed]?.name || '—'}
										</div>
										<div class="text-[10px] text-gray-400 truncate">
											{players[seed]?.hero || '—'}
										</div>
									</div>
									{#if matches[`m${qi}`] === seed}
										<span class="text-green-400 text-xs font-medium flex-shrink-0">W</span>
									{/if}
								</button>
							{/each}
						</div>
					{/each}
				</div>
			</div>

			<!-- Semifinals -->
			<div class="bg-gray-900 border border-gray-800 rounded-lg p-3">
				<div class="text-[10px] text-purple-400 uppercase tracking-wider font-medium mb-3">Semifinals</div>
				<div class="space-y-2">
					{#each semifinalSeeds as seeds, si}
						<div class="rounded-lg border border-gray-800 overflow-hidden {matches[`m${si + 4}`] !== undefined && matches[`m${si + 4}`] !== null ? 'border-l-2 border-l-green-500' : ''}">
							{#each seeds as seed, idx}
								{#if seed !== undefined && seed !== null}
									<button
										type="button"
										on:click={() => toggleWinner(si + 4, seed)}
										class="w-full p-2 flex items-center gap-2 transition-colors focus:outline-none {matches[`m${si + 4}`] === seed ? 'bg-green-600/30' : 'bg-gray-800/50 hover:bg-gray-800'} {idx === 0 ? '' : 'border-t border-gray-700'}"
									>
										<img
											src={heroFilename(players[seed]?.hero)}
											alt={players[seed]?.hero}
											class="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-gray-700"
											loading="lazy"
										/>
										<div class="flex-1 min-w-0 text-left">
											<div class="text-xs font-medium text-white truncate">
												({seed + 1}) {players[seed]?.name || '—'}
											</div>
											<div class="text-[10px] text-gray-400 truncate">
												{players[seed]?.hero || '—'}
											</div>
										</div>
										{#if matches[`m${si + 4}`] === seed}
											<span class="text-green-400 text-xs font-medium flex-shrink-0">W</span>
										{/if}
									</button>
								{:else}
									<div class="w-full p-2 flex items-center gap-2 bg-gray-800/30 {idx === 0 ? '' : 'border-t border-gray-700'}">
										<div class="w-8 h-8 rounded-full bg-gray-700 flex-shrink-0"></div>
										<div class="text-xs text-gray-600 italic">Awaiting QF winner</div>
									</div>
								{/if}
							{/each}
						</div>
					{/each}
				</div>
			</div>

			<!-- Final -->
			<div class="bg-gray-900 border border-gray-800 rounded-lg p-3">
				<div class="text-[10px] text-amber-400 uppercase tracking-wider font-medium mb-3">Final</div>
				<div class="space-y-2">
					<div class="rounded-lg border border-gray-800 overflow-hidden {matches.m6 !== undefined && matches.m6 !== null ? 'border-l-2 border-l-amber-500' : ''}">
						{#each finalSeeds as seed, idx}
							{#if seed !== undefined && seed !== null}
								<button
									type="button"
									on:click={() => toggleWinner(6, seed)}
									class="w-full p-2 flex items-center gap-2 transition-colors focus:outline-none {matches.m6 === seed ? 'bg-amber-600/30' : 'bg-gray-800/50 hover:bg-gray-800'} {idx === 0 ? '' : 'border-t border-gray-700'}"
								>
									<img
										src={heroFilename(players[seed]?.hero)}
										alt={players[seed]?.hero}
										class="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-gray-700"
										loading="lazy"
									/>
									<div class="flex-1 min-w-0 text-left">
										<div class="text-xs font-medium text-white truncate">
											({seed + 1}) {players[seed]?.name || '—'}
										</div>
										<div class="text-[10px] text-gray-400 truncate">
											{players[seed]?.hero || '—'}
										</div>
									</div>
									{#if matches.m6 === seed}
										<span class="text-amber-400 text-xs font-medium flex-shrink-0">Champion</span>
									{/if}
								</button>
							{:else}
								<div class="w-full p-2 flex items-center gap-2 bg-gray-800/30 {idx === 0 ? '' : 'border-t border-gray-700'}">
									<div class="w-8 h-8 rounded-full bg-gray-700 flex-shrink-0"></div>
									<div class="text-xs text-gray-600 italic">Awaiting SF winner</div>
								</div>
							{/if}
						{/each}
					</div>
				</div>

				<!-- Champion Display -->
				{#if matches.m6 !== undefined && matches.m6 !== null}
					<div class="mt-3 p-3 rounded-lg bg-gradient-to-r from-amber-600/20 to-amber-500/10 border border-amber-500/30">
						<div class="text-[10px] text-amber-400 uppercase tracking-wider font-medium mb-2">Champion</div>
						<div class="flex items-center gap-3">
							<img
								src={heroFilename(players[matches.m6]?.hero)}
								alt={players[matches.m6]?.hero}
								class="w-12 h-12 rounded-full object-cover border-2 border-amber-500"
								loading="lazy"
							/>
							<div>
								<div class="text-sm font-bold text-white">{players[matches.m6]?.name || '—'}</div>
								<div class="text-xs text-amber-300">{players[matches.m6]?.hero || '—'}</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
