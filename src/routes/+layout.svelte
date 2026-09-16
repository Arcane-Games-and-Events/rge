<script>
	import '../app.css';
	import Navbar from '../lib/Navbar.svelte';
	import { page } from '$app/stores';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	injectSpeedInsights();

	// Define routes where the navbar and dark theme should be hidden (OBS views)
	const excludedRoutes = ['/views/'];

	// Reactive variable to determine if we're on an admin/control route (not OBS views)
	let isAdminRoute = true;

	// Reactively determine if the current route is excluded
	$: {
		const currentPath = $page?.url?.pathname || '';
		isAdminRoute = !excludedRoutes.some((route) => currentPath.startsWith(route));
	}
</script>

{#if isAdminRoute}
	<div class="dark-theme min-h-screen bg-gray-950">
		<Navbar />
		<main class="relative">
			<slot />
		</main>
	</div>
{:else}
	<!-- OBS views render without navbar or dark theme -->
	<slot />
{/if}
