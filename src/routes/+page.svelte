<script>
	// The front page, in the overlays' look: the title over a tan rule, then
	// the pages in the groups the navbar uses, each a square panel with a tan
	// edge.
	const groups = [
		{
			name: 'The show',
			items: [
				{
					name: 'Production Booth',
					href: '/productionbooth',
					description: 'Clocks, tables, the desk and the card search'
				},
				{
					name: 'Tournament',
					href: '/tournament',
					description: 'The field, the pairings, results and standings'
				},
				{
					name: 'Top 8',
					href: '/graphics',
					description: 'The bracket, and the feature match from it'
				},
				{ name: 'Views', href: '/views', description: 'Every browser source, with its URL for OBS' }
			]
		},
		{
			name: 'Overlays',
			items: [
				{ name: 'Topics', href: '/topics', description: 'The story list, stepped from Companion' },
				{ name: 'Events', href: '/events', description: 'What is coming up, by circuit' },
				{
					name: 'Prizing',
					href: '/prizing',
					description: 'The prizing breakdown by kind of event'
				},
				{ name: 'Metagame', href: '/metagame', description: 'The heroes in the field' }
			]
		},
		{
			name: 'Management',
			items: [
				{ name: 'Judge QR', href: '/judge/qr', description: "The judge's page, from a phone" },
				{
					name: 'Event Presets',
					href: '/eventpresets',
					description: 'The event, the desk and the clocks'
				},
				{ name: 'Caster View', href: '/casterview', description: 'Cards and players for the desk' },
				{
					name: 'Draft Picker',
					href: '/draftpicker',
					description: 'Browse and filter the card database'
				}
			]
		}
	];
</script>

<div class="min-h-screen bg-gray-950 text-white">
	<div class="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
		<header class="mb-12">
			<p class="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#d9b499]">RGE</p>
			<h1 class="font-display text-4xl font-bold uppercase tracking-wide sm:text-5xl lg:text-6xl">
				Realtime Graphics Engine
			</h1>
			<div class="mt-5 h-0.5 w-full bg-[#d9b499]"></div>
			<p class="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#d9b499]">
				Tournament management and broadcast graphics for Flesh and Blood
			</p>
		</header>

		{#each groups as group (group.name)}
			<section class="mb-10" aria-label={group.name}>
				<h2 class="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d9b499]">
					{group.name}
				</h2>
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{#each group.items as link (link.href)}
						<a
							href={link.href}
							class="group flex flex-col border-l-4 border-[#d9b499] bg-gray-900/60 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-gray-900"
						>
							<h3 class="font-display text-lg font-semibold">{link.name}</h3>
							<p class="mt-2 flex-1 text-sm text-gray-400">{link.description}</p>
							<span
								class="mt-4 flex items-center text-xs font-bold uppercase tracking-[0.16em] text-[#d9b499]"
							>
								Open
								<svg
									class="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2.5"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
								</svg>
							</span>
						</a>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</div>
