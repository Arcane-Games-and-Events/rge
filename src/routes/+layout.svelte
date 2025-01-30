<script>
	import '../app.css';
	import Navbar from '../lib/Navbar.svelte';
	import { page } from '$app/stores';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	injectSpeedInsights();

	// Define routes where the navbar should be hidden
	const excludedRoutes = ['/views/'];

	// Reactive store to determine if the navbar should be shown
	let showNavbar = true;

	// Reactively determine if the current route is excluded
	$: {
		// Ensure `page` is available and check the current path
		const currentPath = $page?.url?.pathname || '';
		showNavbar = !excludedRoutes.some((route) => currentPath.startsWith(route));
	}
</script>

<!-- Conditionally display the navbar -->
{#if showNavbar}
	<Navbar />
{/if}

<slot />
