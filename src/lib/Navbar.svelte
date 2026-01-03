<script>
	import { page } from '$app/stores';

	let isMobileMenuOpen = false;
	let isArchiveOpen = false;
	let isMobileArchiveOpen = false;

	const toggleMobileMenu = () => {
		isMobileMenuOpen = !isMobileMenuOpen;
	};

	const menuItems = [
		{ name: 'Views', href: '/views' },
		{ name: 'Production Booth', href: '/productionbooth' },
		{ name: 'Metagame', href: '/metagame' },
		{ name: 'Top 8', href: '/graphics' },
		{ name: 'Event Presets', href: '/eventpresets' }
	];

	const archiveItems = [
		{ name: 'Caster View', href: '/casterview' },
		{ name: 'Draft Picker', href: '/draftpicker' },
		{ name: 'Tournament', href: '/tournament' }
	];

	$: currentPath = $page?.url?.pathname || '';
	$: isArchiveActive = archiveItems.some(item => currentPath === item.href || currentPath.startsWith(item.href + '/'));

	function handleClickOutside(e) {
		if (!e.target.closest('.archive-dropdown')) {
			isArchiveOpen = false;
		}
	}
</script>

<svelte:window on:click={handleClickOutside} />

<nav class="sticky top-0 z-50 border-b border-white/10 bg-gray-900/80 backdrop-blur-xl">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 items-center justify-between">
			<!-- Logo -->
			<div class="flex items-center gap-8">
				<a href="/" class="flex items-center gap-2">
					<span class="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text font-display text-2xl font-bold text-transparent">
						RGE
					</span>
				</a>

				<!-- Desktop Navigation -->
				<div class="hidden lg:flex lg:items-center lg:gap-1">
					{#each menuItems as item}
						<a
							href={item.href}
							class="rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200
								{currentPath === item.href || currentPath.startsWith(item.href + '/')
									? 'bg-white/10 text-white'
									: 'text-gray-400 hover:bg-white/5 hover:text-white'}"
						>
							{item.name}
						</a>
					{/each}

					<!-- Archive Dropdown -->
					<div class="relative archive-dropdown">
						<button
							type="button"
							on:click|stopPropagation={() => isArchiveOpen = !isArchiveOpen}
							class="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200
								{isArchiveActive
									? 'bg-white/10 text-white'
									: 'text-gray-400 hover:bg-white/5 hover:text-white'}"
						>
							Archive
							<svg class="h-4 w-4 transition-transform {isArchiveOpen ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
							</svg>
						</button>
						{#if isArchiveOpen}
							<div class="absolute left-0 top-full mt-1 w-40 rounded-lg border border-white/10 bg-gray-900 py-1 shadow-xl">
								{#each archiveItems as item}
									<a
										href={item.href}
										on:click={() => isArchiveOpen = false}
										class="block px-4 py-2 text-sm transition-colors
											{currentPath === item.href || currentPath.startsWith(item.href + '/')
												? 'bg-white/10 text-white'
												: 'text-gray-400 hover:bg-white/5 hover:text-white'}"
									>
										{item.name}
									</a>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Mobile menu button -->
			<div class="flex lg:hidden">
				<button
					type="button"
					class="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
					on:click={toggleMobileMenu}
					aria-expanded={isMobileMenuOpen}
				>
					<span class="sr-only">Open main menu</span>
					{#if isMobileMenuOpen}
						<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					{:else}
						<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
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
				{#each menuItems as item}
					<a
						href={item.href}
						on:click={() => (isMobileMenuOpen = false)}
						class="block rounded-lg px-3 py-2.5 text-base font-medium transition-all duration-200
							{currentPath === item.href || currentPath.startsWith(item.href + '/')
								? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white'
								: 'text-gray-400 hover:bg-white/5 hover:text-white'}"
					>
						{item.name}
					</a>
				{/each}

				<!-- Mobile Archive Section -->
				<div class="pt-2 border-t border-white/10 mt-2">
					<button
						type="button"
						on:click={() => isMobileArchiveOpen = !isMobileArchiveOpen}
						class="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-base font-medium transition-all duration-200
							{isArchiveActive
								? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white'
								: 'text-gray-400 hover:bg-white/5 hover:text-white'}"
					>
						Archive
						<svg class="h-5 w-5 transition-transform {isMobileArchiveOpen ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
						</svg>
					</button>
					{#if isMobileArchiveOpen}
						<div class="ml-4 mt-1 space-y-1">
							{#each archiveItems as item}
								<a
									href={item.href}
									on:click={() => { isMobileMenuOpen = false; isMobileArchiveOpen = false; }}
									class="block rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200
										{currentPath === item.href || currentPath.startsWith(item.href + '/')
											? 'bg-white/10 text-white'
											: 'text-gray-500 hover:bg-white/5 hover:text-white'}"
								>
									{item.name}
								</a>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</nav>
