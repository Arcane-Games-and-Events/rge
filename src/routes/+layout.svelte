<script>
	import '../app.css';
	import Navbar from '../lib/Navbar.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { lssEvent, subscribeLssEvent, usesLssFont } from '$lib/lssEvent';

	injectSpeedInsights();

	// Define routes where the navbar and dark theme should be hidden (OBS views)
	const excludedRoutes = ['/views/'];

	// Reactive variable to determine if we're on an admin/control route (not OBS views)
	let isAdminRoute = true;

	// Reactively determine if the current route is excluded
	$: currentPath = $page?.url?.pathname || '';
	$: isAdminRoute = !excludedRoutes.some((route) => currentPath.startsWith(route));

	onMount(subscribeLssEvent);

	// The classes go on <body> rather than a wrapper element: the views are
	// positioned precisely for OBS and should not gain a node in their tree.
	$: if (browser) {
		const lssOn = !isAdminRoute && $lssEvent;
		document.body.classList.toggle('lss-event', lssOn);
		document.body.classList.toggle('lss-event-font', lssOn && usesLssFont(currentPath));
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
