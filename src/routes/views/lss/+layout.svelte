<script>
	// Every overlay under /views/lss shares one look: the Tiller face and white
	// text. The original overlays under /views are untouched.

	// The faces the overlays use, fetched as the page opens rather than when the
	// first name renders. A browser source loads cold, and the data usually beats
	// a lazily requested font, which put the fallback face on air for a moment.
	const faces = ['Regular', 'Medium', 'Demi', 'Bold'];
</script>

<svelte:head>
	{#each faces as face (face)}
		<link
			rel="preload"
			href="/fonts/tiller/Tiller-{face}.woff2"
			as="font"
			type="font/woff2"
			crossorigin="anonymous"
		/>
	{/each}
</svelte:head>

<div class="lss-view">
	<slot />
</div>
