<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../firebaseClient';
	import { ROOT, normalizePlayers } from '$lib/tournament';
	import { top8Seeding, ordinal, roundActions, QUARTERFINALS } from '$lib/standings';

	// What the judge has to do in the tournament software, round by round, worked
	// out from the results as they come in: who to drop at the end of a round,
	// who gets a bye at the start of the next, and once the Top 8 is set, how to
	// seed the bracket. The overlays and the tournament page do these things on
	// their own; this is the same logic, written out for the person keeping the
	// official software in step.
	let players = [];
	let historyMap = {};
	let roundsTree = {};
	let currentRound = 1;
	let ready = false;

	onMount(() => {
		const unsub = onValue(ref(db, ROOT), (snap) => {
			const v = snap.val() || {};
			players = normalizePlayers(v.players);
			historyMap = v.history || {};
			roundsTree = v.rounds || {};
			currentRound = Number(v.currentRound) || 1;
			ready = true;
		});
		return unsub;
	});

	const byId = (id) => players.find((p) => p.id === id);
	const name = (id) => byId(id)?.name || `Seat ${id + 1}`;

	$: steps = roundActions(players, historyMap, roundsTree);

	$: seeds = top8Seeding(players, historyMap);
	$: top8 = [...seeds.entries()]
		.sort((a, b) => a[1] - b[1])
		.map(([id, s]) => ({ id, seed: s, name: name(id), hero: byId(id)?.hero || '' }));
	const bySeed = (s) => top8.find((p) => p.seed === s);
</script>

<section
	class="space-y-2 rounded-xl border border-gray-800 bg-gray-900 p-3"
	aria-label="Tournament software"
>
	<div class="flex items-baseline justify-between">
		<h2 class="text-[10px] font-semibold uppercase tracking-wider text-purple-400">
			Tournament software
		</h2>
		{#if ready}
			<span class="text-[10px] text-gray-500">Round {currentRound}</span>
		{/if}
	</div>
	<p class="text-xs text-gray-400">
		What to do in the official software as results come in. Three wins puts a player in the Top 8;
		three losses drops them.
	</p>

	{#if !ready}
		<p class="text-xs text-gray-500">Connecting…</p>
	{:else if !steps.length}
		<p class="text-xs text-gray-500">No rounds yet.</p>
	{:else}
		<ol class="space-y-2">
			{#each steps as step (step.round)}
				<li
					class="rounded-lg border p-2 {step.round === currentRound
						? 'border-purple-500/50 bg-gray-800/60'
						: 'border-gray-800 bg-gray-800/30'}"
				>
					<div class="mb-1 flex items-baseline justify-between">
						<span class="text-xs font-bold text-white">Round {step.round}</span>
						<span class="text-[10px] text-gray-500">
							{#if step.complete}
								results in
							{:else if step.seatedTables}
								{step.openTables} of {step.seatedTables} results still to come
							{:else}
								not seated yet
							{/if}
						</span>
					</div>

					{#if step.complete}
						<div class="space-y-1.5 text-xs">
							{#if step.drops.length}
								<div>
									<span class="font-semibold text-red-400">End of round {step.round} — drop:</span>
									<span class="text-gray-200">{step.drops.map((p) => p.name).join(', ')}</span>
								</div>
							{/if}
							{#if step.through.length}
								<div>
									<span class="font-semibold text-green-400">Into the Top 8:</span>
									<span class="text-gray-200">
										{step.through
											.map(
												(p) =>
													`${p.name}${seeds.has(p.id) ? ` (${ordinal(seeds.get(p.id))} seed)` : ''}`
											)
											.join(', ')}
									</span>
								</div>
							{/if}
							{#if !step.drops.length && !step.through.length}
								<div class="text-gray-500">Nothing to change after this round.</div>
							{/if}
							<!-- Once the eighth seed is in there is no next Swiss round to bye. -->
							{#if step.byesNext.length && top8.length < 8}
								<div>
									<span class="font-semibold text-amber-300"
										>Start of round {step.round + 1} — byes for:</span
									>
									<span class="text-gray-200">{step.byesNext.map((p) => p.name).join(', ')}</span>
								</div>
							{/if}
						</div>
					{:else}
						<p class="text-xs text-gray-500">Actions appear once the round's results are in.</p>
					{/if}
				</li>
			{/each}
		</ol>

		{#if top8.length}
			<div class="rounded-lg border border-green-500/40 bg-green-600/10 p-2">
				<div class="mb-1 flex items-baseline justify-between">
					<span class="text-xs font-bold text-green-300">Top 8 bracket</span>
					<span class="text-[10px] text-gray-500">
						{top8.length} of 8 seeded{top8.length < 8 ? ' so far' : ''}
					</span>
				</div>
				<ol class="mb-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
					{#each top8 as p (p.id)}
						<li class="flex gap-1.5">
							<span class="w-7 flex-none font-mono text-green-400">{ordinal(p.seed)}</span>
							<span class="truncate text-gray-200">{p.name}</span>
						</li>
					{/each}
				</ol>
				{#if top8.length === 8}
					<div class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
						Quarterfinals
					</div>
					<ul class="mt-0.5 space-y-0.5 text-xs text-gray-200">
						{#each QUARTERFINALS as [a, b] (a)}
							<li>
								<span class="font-mono text-green-400">{a}</span>
								{bySeed(a)?.name} <span class="text-gray-500">v</span>
								<span class="font-mono text-green-400">{b}</span>
								{bySeed(b)?.name}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-[11px] text-gray-500">
						The quarterfinals are drawn 1 v 8, 4 v 5, 3 v 6, 2 v 7 once all eight are in.
					</p>
				{/if}
			</div>
		{/if}
	{/if}
</section>
