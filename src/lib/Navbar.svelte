<script>
	import { page } from '$app/stores';

	// The pages in the order they are worked: the views, the booth, the
	// tournament and the Top 8 up front, then the overlays' control pages in
	// one folder and the management pages in another.
	const menuItems = [
		{ name: 'Views', href: '/views' },
		{ name: 'Production Booth', href: '/productionbooth' },
		{ name: 'Tournament', href: '/tournament' },
		{ name: 'Top 8', href: '/graphics' }
	];

	const groups = [
		{
			name: 'Overlays',
			items: [
				{ name: 'Topics', href: '/topics' },
				{ name: 'Events', href: '/events' },
				{ name: 'Prizing', href: '/prizing' },
				{ name: 'Metagame', href: '/metagame' },
				{ name: 'Format', href: '/format' }
			]
		},
		{
			name: 'Management',
			items: [
				{ name: 'Judge QR', href: '/judge/qr' },
				{ name: 'Event Presets', href: '/eventpresets' },
				{ name: 'Caster View', href: '/casterview' },
				{ name: 'Draft Picker', href: '/draftpicker' }
			]
		}
	];

	let isMobileMenuOpen = false;
	// Which folder is open, on the desktop bar and in the mobile menu.
	let openGroup = null;
	let mobileOpenGroup = null;

	$: currentPath = $page?.url?.pathname || '';
	// The path is passed in rather than read from the closure, so the template
	// re-checks as the page changes instead of keeping the first answer.
	const isActive = (path, href) => path === href || path.startsWith(href + '/');
	const groupActive = (path, group) => group.items.some((item) => isActive(path, item.href));

	function handleClickOutside(e) {
		if (!e.target.closest('.nav-group')) openGroup = null;
	}
</script>

<svelte:window on:click={handleClickOutside} />

<nav class="sticky top-0 z-50 border-b border-[#d9b499]/40 bg-gray-900/80 backdrop-blur-xl">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 items-center justify-between">
			<!-- Logo -->
			<div class="flex items-center gap-8">
				<!-- The mark: the letters dark on a tan block, as the overlays' badges are. -->
				<a href="/" class="flex items-center gap-2" aria-label="RGE home">
					<span
						class="flex h-8 items-center bg-[#d9b499] px-2 font-display text-base font-black tracking-[0.12em] text-gray-950"
					>
						RGE
					</span>
				</a>

				<!-- Desktop Navigation -->
				<div class="hidden lg:flex lg:items-center lg:gap-1">
					{#each menuItems as item (item.href)}
						<a
							href={item.href}
							class="border-b-2 px-3 py-2 text-sm font-semibold uppercase tracking-wider transition-colors
								{isActive(currentPath, item.href)
								? 'border-[#d9b499] text-white'
								: 'border-transparent text-gray-400 hover:text-white'}"
						>
							{item.name}
						</a>
					{/each}

					{#each groups as group (group.name)}
						<div class="nav-group relative">
							<button
								type="button"
								aria-expanded={openGroup === group.name}
								on:click|stopPropagation={() =>
									(openGroup = openGroup === group.name ? null : group.name)}
								class="flex items-center gap-1 border-b-2 px-3 py-2 text-sm font-semibold uppercase tracking-wider transition-colors
									{groupActive(currentPath, group)
									? 'border-[#d9b499] text-white'
									: 'border-transparent text-gray-400 hover:text-white'}"
							>
								{group.name}
								<svg
									class="h-4 w-4 transition-transform {openGroup === group.name
										? 'rotate-180'
										: ''}"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M19.5 8.25l-7.5 7.5-7.5-7.5"
									/>
								</svg>
							</button>
							{#if openGroup === group.name}
								<div
									class="absolute left-0 top-full mt-1 w-48 border-l-4 border-[#d9b499] bg-gray-900 py-1 shadow-xl"
								>
									{#each group.items as item (item.href)}
										<a
											href={item.href}
											on:click={() => (openGroup = null)}
											class="block px-4 py-2 text-sm font-medium transition-colors
												{isActive(currentPath, item.href)
												? 'bg-white/10 text-[#d9b499]'
												: 'text-gray-300 hover:bg-white/5 hover:text-white'}"
										>
											{item.name}
										</a>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<!-- Mobile menu button -->
			<div class="flex lg:hidden">
				<button
					type="button"
					class="inline-flex items-center justify-center p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#d9b499] focus:ring-offset-2 focus:ring-offset-gray-900"
					on:click={() => (isMobileMenuOpen = !isMobileMenuOpen)}
					aria-expanded={isMobileMenuOpen}
				>
					<span class="sr-only">Open main menu</span>
					{#if isMobileMenuOpen}
						<svg
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					{:else}
						<svg
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
							/>
						</svg>
					{/if}
				</button>
			</div>
		</div>
	</div>

	<!-- Mobile menu -->
	{#if isMobileMenuOpen}
		<div class="border-t border-white/10 bg-gray-900/95 backdrop-blur-xl lg:hidden">
			<div class="space-y-1 px-4 py-3">
				{#each menuItems as item (item.href)}
					<a
						href={item.href}
						on:click={() => (isMobileMenuOpen = false)}
						class="block border-l-4 px-3 py-2.5 text-base font-semibold uppercase tracking-wider transition-colors
							{isActive(currentPath, item.href)
							? 'border-[#d9b499] bg-white/5 text-white'
							: 'border-transparent text-gray-400 hover:text-white'}"
					>
						{item.name}
					</a>
				{/each}

				{#each groups as group (group.name)}
					<div class="mt-2 border-t border-white/10 pt-2">
						<button
							type="button"
							aria-expanded={mobileOpenGroup === group.name}
							on:click={() =>
								(mobileOpenGroup = mobileOpenGroup === group.name ? null : group.name)}
							class="flex w-full items-center justify-between border-l-4 px-3 py-2.5 text-base font-semibold uppercase tracking-wider transition-colors
								{groupActive(currentPath, group)
								? 'border-[#d9b499] bg-white/5 text-white'
								: 'border-transparent text-gray-400 hover:text-white'}"
						>
							{group.name}
							<svg
								class="h-5 w-5 transition-transform {mobileOpenGroup === group.name
									? 'rotate-180'
									: ''}"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M19.5 8.25l-7.5 7.5-7.5-7.5"
								/>
							</svg>
						</button>
						{#if mobileOpenGroup === group.name}
							<div class="ml-4 mt-1 space-y-1">
								{#each group.items as item (item.href)}
									<a
										href={item.href}
										on:click={() => {
											isMobileMenuOpen = false;
											mobileOpenGroup = null;
										}}
										class="block px-3 py-2 text-sm font-medium transition-colors
											{isActive(currentPath, item.href)
											? 'bg-white/10 text-[#d9b499]'
											: 'text-gray-400 hover:bg-white/5 hover:text-white'}"
									>
										{item.name}
									</a>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</nav>
