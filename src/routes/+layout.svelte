<script>
	import '../app.css';
	import Navbar from '../lib/Navbar.svelte';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

	injectSpeedInsights();

	let showNavbar = false;

	// const excludedRoutes = ['/views'];
	const excludedRoutes = [''];

	$: {
		const currentPath = get(page).url.pathname;
		showNavbar = !excludedRoutes.includes(currentPath);
	}
</script>

{#if showNavbar}
	<Navbar />
{/if}

<slot />
