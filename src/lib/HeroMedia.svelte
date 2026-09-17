<script>
	import { heroImageUrl, heroVideoUrls } from '$lib/heroMedia';

	// One hero plate for the on-air overlays. The still is the backup and is what is on
	// screen by default; the video replaces it only once it is wholly loaded. A video that
	// is missing, slow or broken therefore just leaves the still up, and there is no frame
	// where the plate is blank.
	export let hero = '';
	export let className = '';
	export let width = 1000;

	let videoReady = false;
	let videoFailed = false;

	// The {#key} below rebuilds the elements on a hero change but not this state.
	$: (hero, ((videoReady = false), (videoFailed = false)));

	$: imageSrc = heroImageUrl(hero);
	$: videoSrc = heroVideoUrls(hero)[0] ?? '';

	// Whether every byte is held locally. `canplaythrough` is not the same thing -- it means
	// the browser guesses it can reach the end at the current download rate, which is a
	// guess that can be wrong and would show a stuttering plate on air.
	function fullyBuffered(node) {
		if (!node.duration || !Number.isFinite(node.duration)) return false;
		const ranges = node.buffered;
		if (!ranges.length) return false;
		return ranges.start(0) <= 0.05 && ranges.end(ranges.length - 1) >= node.duration - 0.05;
	}

	// Deliberately no `autoplay` attribute: playback starts here and only here, once the
	// download is complete, so the reveal always begins at the first frame rather than
	// joining the animation part-way through.
	function playWhenLoaded(node) {
		// The property, not just the attribute: muted playback checks the property.
		node.defaultMuted = true;
		node.muted = true;

		let started = false;
		const startIfLoaded = () => {
			if (started || !fullyBuffered(node)) return;
			started = true;
			node.currentTime = 0;
			node.play().catch(() => {});
		};

		// `suspend` is the one that fires when the browser has stopped fetching because it
		// has everything; the others cover the progress of getting there.
		const events = ['loadedmetadata', 'progress', 'canplaythrough', 'suspend'];
		for (const name of events) node.addEventListener(name, startIfLoaded);
		node.load();

		return {
			destroy() {
				for (const name of events) node.removeEventListener(name, startIfLoaded);
				node.pause();
				// Cancels an in-flight download, so a hero changed mid-load does not leave the
				// abandoned video competing with the new one.
				node.removeAttribute('src');
				node.load();
			}
		};
	}
</script>

{#if hero}
	{#key hero}
		<!-- Fixed box: a hero whose still is missing would otherwise collapse to zero height
		     and take the absolutely positioned video with it. 16:9 is where the artwork is
		     heading; the stills are still 2.23:1, so they are contained rather than cropped
		     and anchored to the top, which keeps existing OBS scene positions put. -->
		<div
			class="relative overflow-hidden {className}"
			style="width: {width}px; aspect-ratio: 16 / 9;"
		>
			<img
				src={imageSrc}
				alt={hero}
				class="absolute inset-0 h-full w-full object-contain object-top"
			/>

			{#if videoSrc && !videoFailed}
				<video
					use:playWhenLoaded
					src={videoSrc}
					class="absolute inset-0 h-full w-full object-cover transition-opacity duration-150"
					class:opacity-0={!videoReady}
					loop
					muted
					playsinline
					preload="auto"
					aria-hidden="true"
					tabindex="-1"
					on:playing={() => (videoReady = true)}
					on:error={() => (videoFailed = true)}
				></video>
			{/if}
		</div>
	{/key}
{/if}
