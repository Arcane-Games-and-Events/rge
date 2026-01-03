<script>
	const quickLinks = [
		{ name: 'Production Booth', href: '/productionbooth', description: 'Control live graphics and overlays' },
		{ name: 'Tournament', href: '/tournament', description: 'Manage players, rounds, and standings' },
		{ name: 'Draft Picker', href: '/draftpicker', description: 'Browse and filter card database' },
		{ name: 'Caster View', href: '/casterview', description: 'Display cards and player info' },
		{ name: 'Top 8', href: '/graphics', description: 'Configure bracket graphics' },
		{ name: 'Event Presets', href: '/eventpresets', description: 'Save and load event configurations' }
	];
</script>

<div class="min-h-screen bg-gray-950">
	<!-- Hero Section -->
	<div class="relative overflow-hidden">
		<!-- Background gradient decoration -->
		<div class="absolute inset-0 overflow-hidden">
			<div class="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl"></div>
			<div class="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl"></div>
		</div>

		<div class="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
			<div class="text-center">
				<h1 class="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
					<span class="bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
						Realtime Graphics Engine
					</span>
				</h1>
				<p class="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
					Professional tournament management and broadcast graphics for Flesh and Blood events.
				</p>
			</div>
		</div>
	</div>

	<!-- Quick Links Grid -->
	<div class="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
		<h2 class="mb-8 font-display text-2xl font-bold text-white">Quick Access</h2>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each quickLinks as link}
				<a
					href={link.href}
					class="group relative overflow-hidden rounded-xl border border-gray-800 bg-gray-900/50 p-6 backdrop-blur-sm transition-all duration-300 hover:border-gray-700 hover:bg-gray-900/80"
				>
					<div class="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
					<div class="relative">
						<h3 class="font-display text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
							{link.name}
						</h3>
						<p class="mt-2 text-sm text-gray-500">
							{link.description}
						</p>
						<div class="mt-4 flex items-center text-sm font-medium text-blue-400">
							<span>Open</span>
							<svg class="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
							</svg>
						</div>
					</div>
				</a>
			{/each}
		</div>
	</div>
</div>
