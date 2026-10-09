<script>
	let copiedUrl = '';

	async function copyUrl(path) {
		const url = `${window.location.origin}${path}`;
		await navigator.clipboard.writeText(url);
		copiedUrl = path;
		setTimeout(() => {
			copiedUrl = '';
		}, 1500);
	}
</script>

<div class="min-h-screen bg-gray-950 text-white">
	<div class="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
		<!-- Header, as the overlays carry theirs -->
		<header class="py-4">
			<h1 class="font-display text-3xl font-bold uppercase tracking-wide">Browser Sources</h1>
			<div class="mt-3 h-0.5 w-full bg-[#d9b499]"></div>
			<p class="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#d9b499]">
				Open a view to preview it · copy its URL for OBS
			</p>
		</header>

		<!-- Score Keeper - Featured -->
		<div
			class="border-l-4 border-[#d9b499] bg-[#d9b499]/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
		>
			<div class="text-[10px] text-[#d9b499] uppercase tracking-[0.18em] font-semibold mb-3">
				Featured view
			</div>
			<div class="flex items-center gap-2">
				<a
					class="flex-1 border border-[#d9b499]/60 bg-gray-950/70 px-4 py-4 text-center text-base font-semibold uppercase tracking-wider text-white transition-colors hover:border-[#d9b499] hover:bg-gray-900"
					href="/views/scorekeeper"
				>
					Score Keeper
				</a>
				<button
					type="button"
					on:click={() => copyUrl('/views/scorekeeper')}
					class="px-3 py-4 border transition-colors {copiedUrl === '/views/scorekeeper'
						? 'border-green-500 bg-green-500/20 text-green-400'
						: 'border-[#d9b499]/60 bg-gray-950/70 text-gray-400 hover:border-[#d9b499] hover:text-white'}"
					title="Copy URL"
				>
					{#if copiedUrl === '/views/scorekeeper'}
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							/>
						</svg>
					{:else}
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
							/>
						</svg>
					{/if}
				</button>
			</div>
		</div>

		<!-- LSS Event Card -->
		<div
			class="border-l-4 border-teal-500/70 bg-gray-900/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
		>
			<div class="flex items-baseline justify-between mb-3">
				<div class="text-[10px] text-teal-400 uppercase tracking-[0.18em] font-semibold">
					LSS Event
				</div>
				<div class="text-[10px] text-gray-500">Tiller font, white text</div>
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
				{#each [{ href: '/views/lss/castingbooth', label: 'Casting Booth' }, { href: '/views/lss/roundinfo', label: 'Round Info' }, { href: '/views/lss/playerinfo', label: 'Player Info' }, { href: '/views/lss/lifecounter', label: 'Life Counter' }, { href: '/views/lss/timer', label: 'Timer' }, { href: '/views/lss/eventtext', label: 'Event Text' }, { href: '/views/lss/turncounter', label: 'Turn Counter' }, { href: '/views/lss/pronouns', label: 'Pronouns' }, { href: '/views/lss/activeplayer', label: 'Active Player' }, { href: '/views/lss/herocard', label: 'Hero Card' }, { href: '/views/lss/top8', label: 'Top 8' }, { href: '/views/lss/metagame', label: 'Metagame' }, { href: '/views/lss/choice', label: 'Chose First / Second' }] as item}
					<div class="flex items-center gap-1">
						<a
							class="flex-1 border border-gray-800 bg-gray-950/60 px-3 py-2.5 text-sm text-gray-300 transition-colors hover:border-teal-500 hover:bg-gray-900 hover:text-white"
							href={item.href}
						>
							{item.label}
						</a>
						<button
							type="button"
							on:click={() => copyUrl(item.href)}
							class="px-2.5 py-2.5 border transition-colors {copiedUrl === item.href
								? 'border-green-500 bg-green-500/20 text-green-400'
								: 'border-gray-800 bg-gray-950/60 text-gray-500 hover:border-[#d9b499] hover:text-white'}"
							title="Copy URL"
						>
							{#if copiedUrl === item.href}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/>
								</svg>
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
									/>
								</svg>
							{/if}
						</button>
					</div>
				{/each}
			</div>
		</div>

		<!-- Match Coverage Card -->
		<div
			class="border-l-4 border-[#d9b499] bg-gray-900/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
		>
			<div class="text-[10px] text-[#d9b499] uppercase tracking-[0.18em] font-semibold mb-3">
				Match Coverage
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
				{#each [{ href: '/views/castingbooth', label: 'Casting Booth' }, { href: '/views/roundinfo', label: 'Round Info' }, { href: '/views/playerinfo', label: 'Player Info' }, { href: '/views/lifecounter', label: 'Life Counter' }, { href: '/views/timer', label: 'Timer' }, { href: '/views/cardreader', label: 'Card Reader' }, { href: '/views/eventtext', label: 'Event Text' }, { href: '/views/topics', label: 'Topics' }, { href: '/views/choice', label: 'Turn Choice' }, { href: '/views/matchintro', label: 'Match Intro' }, { href: '/views/upcomingevents', label: 'Upcoming Events' }, { href: '/views/prizing', label: 'Prizing' }, { href: '/views/caster', label: 'Caster Confidence' }] as item}
					<div class="flex items-center gap-1">
						<a
							class="flex-1 border border-gray-800 bg-gray-950/60 px-3 py-2.5 text-sm text-gray-300 transition-colors hover:border-[#d9b499] hover:bg-gray-900 hover:text-white"
							href={item.href}
						>
							{item.label}
						</a>
						<button
							type="button"
							on:click={() => copyUrl(item.href)}
							class="px-2.5 py-2.5 border transition-colors {copiedUrl === item.href
								? 'border-green-500 bg-green-500/20 text-green-400'
								: 'border-gray-800 bg-gray-950/60 text-gray-500 hover:border-[#d9b499] hover:text-white'}"
							title="Copy URL"
						>
							{#if copiedUrl === item.href}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/>
								</svg>
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
									/>
								</svg>
							{/if}
						</button>
					</div>
				{/each}
			</div>
		</div>

		<!-- Table 2 Card -->
		<div
			class="border-l-4 border-[#d9b499] bg-gray-900/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
		>
			<div class="text-[10px] text-[#d9b499] uppercase tracking-[0.18em] font-semibold mb-3">
				Table 2
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
				{#each [{ href: '/views/scorekeeper2', label: 'Score Keeper (Table 2)' }, { href: '/views/lifecounter2', label: 'Life Counter (Table 2)' }, { href: '/views/playerinfo2', label: 'Player Info (Table 2)' }, { href: '/views/heroImage/table2/left', label: 'Hero Image Left (T2-P1)' }, { href: '/views/heroImage/table2/right', label: 'Hero Image Right (T2-P2)' }] as item}
					<div class="flex items-center gap-1">
						<a
							class="flex-1 border border-gray-800 bg-gray-950/60 px-3 py-2.5 text-sm text-gray-300 transition-colors hover:border-[#d9b499] hover:bg-gray-900 hover:text-white"
							href={item.href}
						>
							{item.label}
						</a>
						<button
							type="button"
							on:click={() => copyUrl(item.href)}
							class="px-2.5 py-2.5 border transition-colors {copiedUrl === item.href
								? 'border-green-500 bg-green-500/20 text-green-400'
								: 'border-gray-800 bg-gray-950/60 text-gray-500 hover:border-[#d9b499] hover:text-white'}"
							title="Copy URL"
						>
							{#if copiedUrl === item.href}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/>
								</svg>
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
									/>
								</svg>
							{/if}
						</button>
					</div>
				{/each}
			</div>
		</div>

		<!-- Hero Images Card -->
		<div
			class="border-l-4 border-[#d9b499] bg-gray-900/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
		>
			<div class="text-[10px] text-[#d9b499] uppercase tracking-[0.18em] font-semibold mb-3">
				Hero Images
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
				<div class="flex items-center gap-1">
					<a
						class="flex-1 border border-gray-800 bg-gray-950/60 px-3 py-2.5 text-sm text-gray-300 transition-colors hover:border-[#d9b499] hover:bg-gray-900 hover:text-white"
						href="/views/heroImage/left"
					>
						<span class="text-[10px] text-red-400 uppercase mr-1.5">P1</span>
						Hero Image (Left)
					</a>
					<button
						type="button"
						on:click={() => copyUrl('/views/heroImage/left')}
						class="px-2.5 py-2.5 border transition-colors {copiedUrl === '/views/heroImage/left'
							? 'border-green-500 bg-green-500/20 text-green-400'
							: 'border-gray-800 bg-gray-950/60 text-gray-500 hover:border-[#d9b499] hover:text-white'}"
						title="Copy URL"
					>
						{#if copiedUrl === '/views/heroImage/left'}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 13l4 4L19 7"
								/>
							</svg>
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
								/>
							</svg>
						{/if}
					</button>
				</div>
				<div class="flex items-center gap-1">
					<a
						class="flex-1 border border-gray-800 bg-gray-950/60 px-3 py-2.5 text-sm text-gray-300 transition-colors hover:border-[#d9b499] hover:bg-gray-900 hover:text-white"
						href="/views/heroImage/right"
					>
						<span class="text-[10px] text-blue-400 uppercase mr-1.5">P2</span>
						Hero Image (Right)
					</a>
					<button
						type="button"
						on:click={() => copyUrl('/views/heroImage/right')}
						class="px-2.5 py-2.5 border transition-colors {copiedUrl === '/views/heroImage/right'
							? 'border-green-500 bg-green-500/20 text-green-400'
							: 'border-gray-800 bg-gray-950/60 text-gray-500 hover:border-[#d9b499] hover:text-white'}"
						title="Copy URL"
					>
						{#if copiedUrl === '/views/heroImage/right'}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 13l4 4L19 7"
								/>
							</svg>
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
								/>
							</svg>
						{/if}
					</button>
				</div>
			</div>
		</div>

		<!-- Tournament Card -->
		<div
			class="border-l-4 border-[#d9b499] bg-gray-900/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
		>
			<div class="text-[10px] text-[#d9b499] uppercase tracking-[0.18em] font-semibold mb-3">
				Tournament
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
				{#each [{ href: '/views/tournamentround', label: 'Pairings' }, { href: '/views/tournamentstandings', label: 'Standings' }, { href: '/views/metagame', label: 'Metagame' }, { href: '/views/topCut', label: 'Top 8 Bracket' }, { href: '/views/format', label: 'Swiss Format' }, { href: '/views/sponsor', label: 'Sponsor Copy' }] as item}
					<div class="flex items-center gap-1">
						<a
							class="flex-1 border border-gray-800 bg-gray-950/60 px-3 py-2.5 text-sm text-gray-300 transition-colors hover:border-[#d9b499] hover:bg-gray-900 hover:text-white"
							href={item.href}
						>
							{item.label}
						</a>
						<button
							type="button"
							on:click={() => copyUrl(item.href)}
							class="px-2.5 py-2.5 border transition-colors {copiedUrl === item.href
								? 'border-green-500 bg-green-500/20 text-green-400'
								: 'border-gray-800 bg-gray-950/60 text-gray-500 hover:border-[#d9b499] hover:text-white'}"
							title="Copy URL"
						>
							{#if copiedUrl === item.href}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/>
								</svg>
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
									/>
								</svg>
							{/if}
						</button>
					</div>
				{/each}
			</div>
		</div>

		<!-- Draft Coverage Card -->
		<div
			class="border-l-4 border-[#d9b499] bg-gray-900/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
		>
			<div class="text-[10px] text-[#d9b499] uppercase tracking-[0.18em] font-semibold mb-3">
				Draft Coverage
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
				{#each [{ href: '/views/pack1', label: 'Pack 1' }, { href: '/views/pack2', label: 'Pack 2' }, { href: '/views/pack3', label: 'Pack 3' }, { href: '/views/draftoverview', label: 'Overview' }] as item}
					<div class="flex items-center gap-1">
						<a
							class="flex-1 border border-gray-800 bg-gray-950/60 px-3 py-2.5 text-sm text-gray-300 transition-colors hover:border-[#d9b499] hover:bg-gray-900 hover:text-white"
							href={item.href}
						>
							{item.label}
						</a>
						<button
							type="button"
							on:click={() => copyUrl(item.href)}
							class="px-2.5 py-2.5 border transition-colors {copiedUrl === item.href
								? 'border-green-500 bg-green-500/20 text-green-400'
								: 'border-gray-800 bg-gray-950/60 text-gray-500 hover:border-[#d9b499] hover:text-white'}"
							title="Copy URL"
						>
							{#if copiedUrl === item.href}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/>
								</svg>
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
									/>
								</svg>
							{/if}
						</button>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
