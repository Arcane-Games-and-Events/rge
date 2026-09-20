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
	const VIEW_STYLE = '<style>html,body{margin:0;overflow:hidden;background:transparent}</style>';
	const bareRoutes = ['/judge'];

	$: currentPath = $page?.url?.pathname || '';
	$: isView = viewRoutes.some((route) => currentPath.startsWith(route));
	$: showNav = !isView && !bareRoutes.includes(currentPath);
</script>

<svelte:head>
	{#if isView}
		<!-- What OBS's default custom CSS injects into a browser source, declared by the
		     page itself, in the server-rendered head so it holds from the first paint. On
		     a refresh of every source at once that injection can lose the race, and a
		     view left with a scrollbar sits 15px off until the source is reloaded on its
		     own. A literal string because a style element in the markup would be taken
		     for the component's own, scoped, stylesheet. -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html VIEW_STYLE}
	{/if}
</svelte:head>

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
