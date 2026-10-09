<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../firebaseClient';
	import {
		SPONSOR_PATH,
		PANELS,
		LAST_STEP,
		describeStep,
		toStep,
		SPONSOR,
		BUNDLES,
		dollars
	} from '$lib/sponsorCopy';

	// Step the copy on the sponsor overlay at /views/sponsor: the bundle
	// pricing first, then the singles message.
	let step = 0;
	let origin = '';
	let copied = '';

	onMount(() => {
		origin = window.location.origin;
		return onValue(ref(db, SPONSOR_PATH), (snap) => (step = toStep(snap.val()?.step)));
	});

	// The buttons go through the same endpoint a Stream Deck or Companion
	// button uses, so what is rehearsed here is exactly what the deck does.
	const go = (command) => fetch(`/sponsor/${command}`, { method: 'POST' });
	async function copy(path) {
		await navigator.clipboard.writeText(`${origin}${path}`);
		copied = path;
		setTimeout(() => (copied = ''), 1500);
	}
	const COMMANDS = [
		['next', 'The next panel of copy'],
		['back', 'The last panel again'],
		['reset', 'Back to the bundle pricing']
	];
</script>

<div class="min-h-screen bg-gray-950 text-white">
	<div class="mx-auto max-w-3xl px-4 py-10 sm:px-6">
		<header class="mb-8">
			<h1 class="font-display text-4xl font-bold uppercase tracking-wide">Sponsor</h1>
			<div class="mt-3 h-0.5 w-full bg-[#d9b499]"></div>
			<p class="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#d9b499]">
				{SPONSOR.name}, on /views/sponsor
			</p>
		</header>

		<section class="mb-6 border-l-4 border-[#d9b499] bg-gray-900/60 p-5" aria-label="Step">
			<p class="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d9b499]">
				Panel {step + 1} of {PANELS.length}
			</p>
			<p class="mb-4 text-xl font-semibold">{describeStep(step)}</p>
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
					Next ›
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
				The overlay loads on the bundle pricing. Next brings the singles message in over it; Back
				and Reset return to the pricing.
			</p>
		</section>

		<section class="mb-6 border-l-4 border-[#d9b499] bg-gray-900/60 p-5" aria-label="Stream Deck">
			<p class="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d9b499]">
				Stream Deck · Companion
			</p>
			<p class="mb-3 text-xs text-gray-500">
				An HTTP request action, GET or POST, to any of these. /sponsor/1 goes straight to the
				singles message.
			</p>
			<ul class="space-y-2">
				{#each COMMANDS as [command, what] (command)}
					<li class="flex items-center gap-2">
						<code
							class="flex-1 break-all border border-gray-800 bg-gray-950/60 px-3 py-2 text-sm text-gray-300"
							>{origin}/sponsor/{command}</code
						>
						<span class="hidden w-40 text-xs text-gray-500 sm:block">{what}</span>
						<button
							type="button"
							class="border px-2.5 py-2 text-xs transition-colors {copied === `/sponsor/${command}`
								? 'border-green-500 bg-green-500/20 text-green-400'
								: 'border-gray-800 bg-gray-950/60 text-gray-400 hover:border-[#d9b499] hover:text-white'}"
							on:click={() => copy(`/sponsor/${command}`)}
						>
							{copied === `/sponsor/${command}` ? 'Copied' : 'Copy'}
						</button>
					</li>
				{/each}
			</ul>
		</section>

		<section class="border-l-4 border-[#d9b499] bg-gray-900/60 p-5" aria-label="Copy">
			<p class="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d9b499]">The copy</p>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each PANELS as panel, i (panel.kind)}
					<div
						class="border p-4 text-sm {i === step
							? 'border-[#d9b499] bg-white/[0.04]'
							: 'border-gray-800 bg-gray-950/40 text-gray-400'}"
					>
						<p class="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d9b499]">
							{i + 1} · {panel.label}
						</p>
						{#if panel.kind === 'pricing'}
							<p class="font-semibold">{SPONSOR.tagline}</p>
							<p>{SPONSOR.product} · {SPONSOR.pitch}</p>
							<ul class="mt-2 space-y-0.5 text-xs">
								{#each BUNDLES as b (b.code)}
									<li>
										{b.finish}: {b.rows.map((r) => `${r.label} ${dollars(r.price)}`).join(' · ')}
									</li>
								{/each}
							</ul>
							<p class="mt-2 text-xs">{SPONSOR.note}</p>
						{:else}
							<p class="font-semibold">{panel.title}</p>
							{#each panel.body as line}<p>{line.replaceAll('*', '')}</p>{/each}
						{/if}
					</div>
				{/each}
			</div>
			<p class="mt-3 text-xs text-gray-500">The words themselves are in src/lib/sponsorCopy.js.</p>
		</section>
	</div>
</div>
