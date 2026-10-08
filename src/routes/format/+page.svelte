<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../firebaseClient';
	import { FORMAT_DEMO_PATH, LAST_STEP, describeStep, toStep, walkThrough } from '$lib/formatDemo';
	import { normalizePlayers } from '$lib/tournament';
	import { heroImageUrl } from '$lib/heroMedia';

	// Step the Swiss format walk-through on the overlay at /views/format:
	// the field from the tournament page, played through five made-up rounds,
	// moving from record to record and into the Top 8 or out.
	let step = 0;
	let players = [];
	let round1 = {};
	let origin = '';
	let copied = '';

	onMount(() => {
		origin = window.location.origin;
		const stops = [
			onValue(ref(db, FORMAT_DEMO_PATH), (snap) => (step = toStep(snap.val()?.step))),
			onValue(ref(db, 'tournament/players'), (snap) => (players = normalizePlayers(snap.val()))),
			onValue(ref(db, 'tournament/rounds/1/pairings'), (snap) => (round1 = snap.val() || {}))
		];
		return () => stops.forEach((stop) => stop());
	});

	$: field = players.filter((p) => p.name);
	$: steps = walkThrough(field, round1);
	$: placement = step >= 1 ? steps[step - 1] || new Map() : new Map();
	$: label = describeStep(step);

	// The buttons go through the same endpoint a Stream Deck or Companion
	// button uses, so what is rehearsed here is exactly what the deck does.
	const go = (command) => fetch(`/format/${command}`, { method: 'POST' });
	async function copy(path) {
		await navigator.clipboard.writeText(`${origin}${path}`);
		copied = path;
		setTimeout(() => (copied = ''), 1500);
	}
	const COMMANDS = [
		['next', 'The next round plays'],
		['back', 'The last round is taken back'],
		['reset', 'Back to round 1 seated']
	];
	const where = (p) => {
		const at = placement.get(p.id);
		if (!at) return step === 0 ? 'off' : '—';
		return at.kind === 'end'
			? `${at.record} · ${at.record.startsWith('3') ? 'through' : 'out'}`
			: `${at.record} · match ${at.row + 1}`;
	};
</script>

<div class="min-h-screen bg-gray-950 text-white">
	<div class="mx-auto max-w-3xl px-4 py-10 sm:px-6">
		<header class="mb-8">
			<h1 class="font-display text-4xl font-bold uppercase tracking-wide">Format</h1>
			<div class="mt-3 h-0.5 w-full bg-[#d9b499]"></div>
			<p class="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#d9b499]">
				The Swiss walk-through, on /views/format
			</p>
		</header>

		<section class="mb-6 border-l-4 border-[#d9b499] bg-gray-900/60 p-5" aria-label="Step">
			<p class="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d9b499]">
				Step {step} of {LAST_STEP}
			</p>
			<p class="mb-4 text-xl font-semibold">{label}</p>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					class="border border-gray-700 bg-gray-800 px-4 py-3 text-sm font-semibold uppercase tracking-wider transition-colors hover:border-gray-500 disabled:opacity-40"
					disabled={step === 0}
					on:click={() => go('back')}
				>
					‹ Back
				</button>
				<button
					type="button"
					class="bg-[#d9b499] px-5 py-3 text-sm font-bold uppercase tracking-wider text-gray-950 transition-colors hover:bg-[#e6c4a6] disabled:opacity-40"
					disabled={step >= LAST_STEP}
					on:click={() => go('next')}
				>
					{step === 0 ? 'Bring the players on ›' : 'Advance round ›'}
				</button>
				<button
					type="button"
					class="border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-red-200 transition-colors hover:border-red-700 disabled:opacity-40"
					disabled={step === 0}
					on:click={() => go('reset')}
				>
					Reset
				</button>
			</div>
			<p class="mt-4 text-xs text-gray-500">
				Round 1 is seated as the tournament page pairs it, with its real results where they are in;
				the rounds after are decided by a seeded coin, so they look random but play the same every
				time. Players and heroes come from the tournament page.
			</p>
		</section>

		<section class="mb-6 border-l-4 border-[#d9b499] bg-gray-900/60 p-5" aria-label="Stream Deck">
			<p class="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d9b499]">
				Stream Deck · Companion
			</p>
			<p class="mb-3 text-xs text-gray-500">
				An HTTP request action, GET or POST, to any of these. /format/3 goes straight to after round
				3 (step 4).
			</p>
			<ul class="space-y-2">
				{#each COMMANDS as [command, what] (command)}
					<li class="flex items-center gap-2">
						<code
							class="flex-1 break-all border border-gray-800 bg-gray-950/60 px-3 py-2 text-sm text-gray-300"
							>{origin}/format/{command}</code
						>
						<span class="hidden w-40 text-xs text-gray-500 sm:block">{what}</span>
						<button
							type="button"
							class="border px-2.5 py-2 text-xs transition-colors {copied === `/format/${command}`
								? 'border-green-500 bg-green-500/20 text-green-400'
								: 'border-gray-800 bg-gray-950/60 text-gray-400 hover:border-[#d9b499] hover:text-white'}"
							on:click={() => copy(`/format/${command}`)}
						>
							{copied === `/format/${command}` ? 'Copied' : 'Copy'}
						</button>
					</li>
				{/each}
			</ul>
		</section>

		<section class="border-l-4 border-[#d9b499] bg-gray-900/60 p-5" aria-label="Field">
			<p class="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d9b499]">
				The field · {field.length} players
			</p>
			{#if !field.length}
				<p class="text-sm text-gray-500">Enter players on the tournament page to see them here.</p>
			{:else}
				<ol class="grid gap-1 sm:grid-cols-2">
					{#each field as p (p.id)}
						<li class="flex items-center gap-3 bg-white/[0.04] px-3 py-2 text-sm">
							<span class="w-5 text-right font-mono text-xs text-gray-500">{p.id + 1}</span>
							<span class="h-7 w-7 flex-none overflow-hidden bg-gray-800">
								{#if p.hero}<img
										src={heroImageUrl(p.hero)}
										alt=""
										class="h-full w-full object-cover object-right-top"
									/>{/if}
							</span>
							<span class="min-w-0 flex-1 truncate font-medium">{p.name}</span>
							<span class="text-xs text-gray-400">{where(p)}</span>
						</li>
					{/each}
				</ol>
			{/if}
		</section>
	</div>
</div>
