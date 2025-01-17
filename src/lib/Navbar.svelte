<script>
	let isMobileMenuOpen = false;

	const toggleMobileMenu = () => {
		isMobileMenuOpen = !isMobileMenuOpen;
	};

	const menuItems = [
		// { name: 'Dashboard', href: '/', current: true },
		{ name: 'Views', href: '/views', current: false },
		{ name: 'Production Booth', href: '/productionbooth', current: false },
		{ name: 'Caster View', href: '/casterview', current: false },
		{ name: 'Draft Tool', href: '/drafttool', current: false },
		{ name: 'Event Presets', href: '/eventpresets', current: false }
	];
</script>

<nav class="border-b py-2 max-w-9xl mx-auto bg-gray-800">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex justify-between h-12">
			<div class="flex items-center">
				<a href="/" class="text-2xl font-bold text-white">RGE</a>
				<div class="hidden sm:flex sm:space-x-6 ml-12">
					{#each menuItems as item}
						<a
							href={item.href}
							class="text-white inline-flex items-center border-b-2 px-1 pt-1 text-md tracking-wide border-transparent text-gray-600"
						>
							{item.name}
						</a>
					{/each}
				</div>
			</div>
			<div class="-mr-2 flex items-center sm:hidden">
				<button
					type="button"
					class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
					on:click={toggleMobileMenu}
				>
					<span class="sr-only">Open main menu</span>
					<svg
						class={isMobileMenuOpen ? 'hidden h-6 w-6' : 'block h-6 w-6'}
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
						/>
					</svg>
					<svg
						class={isMobileMenuOpen ? 'block h-6 w-6' : 'hidden h-6 w-6'}
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						aria-hidden="true"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>
	</div>

	{#if isMobileMenuOpen}
		<div class="sm:hidden">
			<div class="space-y-1 pb-3 pt-2">
				{#each menuItems as item}
					<a
						href={item.href}
						class="block border-l-4 py-2 pl-3 pr-4 text-base font-medium {item.current
							? 'border-indigo-500 bg-indigo-50 text-indigo-700'
							: 'border-transparent text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700'}"
					>
						{item.name}
					</a>
				{/each}
			</div>
		</div>
	{/if}
</nav>
