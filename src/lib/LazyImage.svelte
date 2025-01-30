<script>
	// LazyImage props
	export let src = '';
	export let alt = '';

	// Track whether the image has fully loaded
	let loaded = false;

	function handleLoad() {
		loaded = true;
	}
</script>

<!-- 
  - "loading=lazy" defers loading images outside the viewport.
  - We add "class:loaded={loaded}" so we can fade the image in 
    once the load event fires.
-->
<img {src} {alt} on:load={handleLoad} loading="lazy" class:loaded />

<style>
	/* Start the image off invisible */
	img {
		opacity: 0;
		transition: opacity 0.4s ease; /* fade duration */
		display: block; /* or inline-block, depending on your layout needs */
		width: 100%; /* to fill parent container if desired */
		height: auto;
	}

	/* Once loaded = true, fade in */
	.loaded {
		opacity: 1;
	}
</style>
