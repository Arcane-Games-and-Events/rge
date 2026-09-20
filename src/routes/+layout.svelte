<script>
	import '../app.css';
	import Navbar from '../lib/Navbar.svelte';
	import { page } from '$app/stores';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	injectSpeedInsights();

	// OBS views render bare: no navbar, no dark theme. The judge page keeps the
	// theme but drops the navbar, since it is opened on a judge's phone from a QR
	// code and should offer nothing beyond its own controls.
	const viewRoutes = ['/views/'];
	const bareRoutes = ['/judge'];

	$: currentPath = $page?.url?.pathname || '';
	$: isView = viewRoutes.some((route) => currentPath.startsWith(route));
	$: showNav = !isView && !bareRoutes.includes(currentPath);
</script>

{#if !isView}
	<div class="dark-theme min-h-screen bg-gray-950">
		{#if showNav}<Navbar />{/if}
		<main class="relative">
			<slot />
		</main>
	</div>
{:else}
	<!-- OBS views render without navbar or dark theme -->
	<slot />
{/if}
