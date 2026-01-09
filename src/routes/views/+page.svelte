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
		<!-- Header -->
		<div class="text-center py-4">
			<h1 class="text-xl font-bold text-white">OBS Browser Sources</h1>
			<p class="text-xs text-gray-500 mt-1">Click link to preview, or copy URL for OBS</p>
		</div>

		<!-- Score Keeper - Featured -->
		<div class="bg-gradient-to-r from-red-600/20 to-amber-600/20 border border-red-500/50 rounded-lg p-4">
			<div class="text-[10px] text-red-400 uppercase tracking-wider font-medium mb-3">Featured View</div>
			<div class="flex items-center gap-2">
				<a
					class="flex-1 rounded-lg border-2 border-red-500/50 bg-gray-900/80 px-4 py-4 text-center text-base font-medium text-white transition-colors hover:border-red-400 hover:bg-gray-900"
					href="/views/scorekeeper"
				>
					Score Keeper
				</a>
				<button
					type="button"
					on:click={() => copyUrl('/views/scorekeeper')}
					class="px-3 py-4 rounded-lg border-2 transition-colors {copiedUrl === '/views/scorekeeper' ? 'border-green-500 bg-green-500/20 text-green-400' : 'border-red-500/50 bg-gray-900/80 text-gray-400 hover:border-red-400 hover:text-gray-300'}"
					title="Copy URL"
				>
					{#if copiedUrl === '/views/scorekeeper'}
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
					{:else}
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
						</svg>
					{/if}
				</button>
			</div>
		</div>

		<!-- Match Coverage Card -->
		<div class="bg-gray-900 border border-gray-800 rounded-lg p-4">
			<div class="text-[10px] text-blue-400 uppercase tracking-wider font-medium mb-3">Match Coverage</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
				{#each [
					{ href: '/views/castingbooth', label: 'Casting Booth' },
					{ href: '/views/roundinfo', label: 'Round Info' },
					{ href: '/views/playerinfo', label: 'Player Info' },
					{ href: '/views/lifecounter', label: 'Life Counter' },
					{ href: '/views/timer', label: 'Timer' },
					{ href: '/views/cardreader', label: 'Card Reader' },
					{ href: '/views/eventtext', label: 'Event Text' }
				] as item}
					<div class="flex items-center gap-1">
						<a
							class="flex-1 rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-2.5 text-sm text-gray-300 transition-colors hover:border-blue-500 hover:bg-gray-800 hover:text-white"
							href={item.href}
						>
							{item.label}
						</a>
						<button
							type="button"
							on:click={() => copyUrl(item.href)}
							class="px-2.5 py-2.5 rounded-lg border transition-colors {copiedUrl === item.href ? 'border-green-500 bg-green-500/20 text-green-400' : 'border-gray-800 bg-gray-800/50 text-gray-500 hover:border-gray-700 hover:text-gray-300'}"
							title="Copy URL"
						>
							{#if copiedUrl === item.href}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
								</svg>
							{/if}
						</button>
					</div>
				{/each}
			</div>
		</div>

		<!-- Table 2 Card -->
		<div class="bg-gray-900 border border-gray-800 rounded-lg p-4">
			<div class="text-[10px] text-orange-400 uppercase tracking-wider font-medium mb-3">Table 2</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
				{#each [
					{ href: '/views/scorekeeper2', label: 'Score Keeper (Table 2)' },
					{ href: '/views/lifecounter2', label: 'Life Counter (Table 2)' },
					{ href: '/views/playerinfo2', label: 'Player Info (Table 2)' },
					{ href: '/views/heroImage/table2/left', label: 'Hero Image Left (T2-P1)' },
					{ href: '/views/heroImage/table2/right', label: 'Hero Image Right (T2-P2)' }
				] as item}
					<div class="flex items-center gap-1">
						<a
							class="flex-1 rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-2.5 text-sm text-gray-300 transition-colors hover:border-orange-500 hover:bg-gray-800 hover:text-white"
							href={item.href}
						>
							{item.label}
						</a>
						<button
							type="button"
							on:click={() => copyUrl(item.href)}
							class="px-2.5 py-2.5 rounded-lg border transition-colors {copiedUrl === item.href ? 'border-green-500 bg-green-500/20 text-green-400' : 'border-gray-800 bg-gray-800/50 text-gray-500 hover:border-gray-700 hover:text-gray-300'}"
							title="Copy URL"
						>
							{#if copiedUrl === item.href}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
								</svg>
							{/if}
						</button>
					</div>
				{/each}
			</div>
		</div>

		<!-- Hero Images Card -->
		<div class="bg-gray-900 border border-gray-800 rounded-lg p-4">
			<div class="text-[10px] text-purple-400 uppercase tracking-wider font-medium mb-3">Hero Images</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
				<div class="flex items-center gap-1">
					<a
						class="flex-1 rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-2.5 text-sm text-gray-300 transition-colors hover:border-purple-500 hover:bg-gray-800 hover:text-white"
						href="/views/heroImage/left"
					>
						<span class="text-[10px] text-red-400 uppercase mr-1.5">P1</span>
						Hero Image (Left)
					</a>
					<button
						type="button"
						on:click={() => copyUrl('/views/heroImage/left')}
						class="px-2.5 py-2.5 rounded-lg border transition-colors {copiedUrl === '/views/heroImage/left' ? 'border-green-500 bg-green-500/20 text-green-400' : 'border-gray-800 bg-gray-800/50 text-gray-500 hover:border-gray-700 hover:text-gray-300'}"
						title="Copy URL"
					>
						{#if copiedUrl === '/views/heroImage/left'}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
							</svg>
						{/if}
					</button>
				</div>
				<div class="flex items-center gap-1">
					<a
						class="flex-1 rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-2.5 text-sm text-gray-300 transition-colors hover:border-purple-500 hover:bg-gray-800 hover:text-white"
						href="/views/heroImage/right"
					>
						<span class="text-[10px] text-blue-400 uppercase mr-1.5">P2</span>
						Hero Image (Right)
					</a>
					<button
						type="button"
						on:click={() => copyUrl('/views/heroImage/right')}
						class="px-2.5 py-2.5 rounded-lg border transition-colors {copiedUrl === '/views/heroImage/right' ? 'border-green-500 bg-green-500/20 text-green-400' : 'border-gray-800 bg-gray-800/50 text-gray-500 hover:border-gray-700 hover:text-gray-300'}"
						title="Copy URL"
					>
						{#if copiedUrl === '/views/heroImage/right'}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
							</svg>
						{/if}
					</button>
				</div>
			</div>
		</div>

		<!-- Tournament Card -->
		<div class="bg-gray-900 border border-gray-800 rounded-lg p-4">
			<div class="text-[10px] text-green-400 uppercase tracking-wider font-medium mb-3">Tournament</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
				{#each [
					{ href: '/views/tournamentround', label: 'Pairings' },
					{ href: '/views/tournamentstandings', label: 'Standings' },
					{ href: '/views/metagame', label: 'Metagame' },
					{ href: '/views/topCut', label: 'Top 8 Bracket' }
				] as item}
					<div class="flex items-center gap-1">
						<a
							class="flex-1 rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-2.5 text-sm text-gray-300 transition-colors hover:border-green-500 hover:bg-gray-800 hover:text-white"
							href={item.href}
						>
							{item.label}
						</a>
						<button
							type="button"
							on:click={() => copyUrl(item.href)}
							class="px-2.5 py-2.5 rounded-lg border transition-colors {copiedUrl === item.href ? 'border-green-500 bg-green-500/20 text-green-400' : 'border-gray-800 bg-gray-800/50 text-gray-500 hover:border-gray-700 hover:text-gray-300'}"
							title="Copy URL"
						>
							{#if copiedUrl === item.href}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
								</svg>
							{/if}
						</button>
					</div>
				{/each}
			</div>
		</div>

		<!-- Draft Coverage Card -->
		<div class="bg-gray-900 border border-gray-800 rounded-lg p-4">
			<div class="text-[10px] text-amber-400 uppercase tracking-wider font-medium mb-3">Draft Coverage</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
				{#each [
					{ href: '/views/pack1', label: 'Pack 1' },
					{ href: '/views/pack2', label: 'Pack 2' },
					{ href: '/views/pack3', label: 'Pack 3' },
					{ href: '/views/draftoverview', label: 'Overview' }
				] as item}
					<div class="flex items-center gap-1">
						<a
							class="flex-1 rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-2.5 text-sm text-gray-300 transition-colors hover:border-amber-500 hover:bg-gray-800 hover:text-white"
							href={item.href}
						>
							{item.label}
						</a>
						<button
							type="button"
							on:click={() => copyUrl(item.href)}
							class="px-2.5 py-2.5 rounded-lg border transition-colors {copiedUrl === item.href ? 'border-green-500 bg-green-500/20 text-green-400' : 'border-gray-800 bg-gray-800/50 text-gray-500 hover:border-gray-700 hover:text-gray-300'}"
							title="Copy URL"
						>
							{#if copiedUrl === item.href}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
								</svg>
							{/if}
						</button>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
