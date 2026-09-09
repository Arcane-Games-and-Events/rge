<script>
	import { heroImageUrl, heroVideoUrls } from '$lib/heroMedia';

	// One hero plate for the on-air overlays: the still renders immediately and a video,
	// where one exists, fades in over it once it is genuinely playing. A video that is
	// missing, slow or broken therefore just leaves the still on screen, and there is no
	// frame where the plate is blank.
	export let hero = '';
	export let className = '';
	export let width = 1000;

	let videoPlaying = false;
	let videoFailed = false;

	// The {#key} below rebuilds the elements on a hero change but not this state.
	$: (hero, ((videoPlaying = false), (videoFailed = false)));

	$: imageSrc = heroImageUrl(hero);
	$: videoSrc = heroVideoUrls(hero)[0] ?? '';

	// OBS's embedded Chromium does not reliably start a freshly created <video> from the
	// autoplay attribute alone, and it keeps fetching one that has been discarded. Both
	// are handled here rather than in markup.
	function playInObs(node) {
		// The property, not just the attribute: autoplay checks the property.
		node.defaultMuted = true;
		node.muted = true;
		node.load();

		const tryPlay = () => node.play().catch(() => {});
		node.addEventListener('canplay', tryPlay);
		tryPlay();

		return {
			destroy() {
				node.removeEventListener('canplay', tryPlay);
				node.pause();
				// Cancels an in-flight download, so a hero changed mid-load does not leave
				// the abandoned video competing with the new one.
				node.removeAttribute('src');
				node.load();
			}
		};
	}
</script>

{#if hero}
	{#key hero}
		<!-- Fixed box: a hero whose still is missing would otherwise collapse to zero
		     height and take the absolutely positioned video with it. -->
		<div
			class="relative overflow-hidden {className}"
			style="width: {width}px; aspect-ratio: 1200 / 538;"
		>
			<img src={imageSrc} alt={hero} class="absolute inset-0 h-full w-full object-cover" />

			{#if videoSrc && !videoFailed}
				<video
					use:playInObs
					src={videoSrc}
					class="absolute inset-0 h-full w-full object-cover transition-opacity duration-150"
					class:opacity-0={!videoPlaying}
					autoplay
					loop
					muted
					playsinline
					preload="auto"
					aria-hidden="true"
					tabindex="-1"
					on:playing={() => (videoPlaying = true)}
					on:error={() => (videoFailed = true)}
				></video>
			{/if}
		</div>
	{/key}
{/if}
