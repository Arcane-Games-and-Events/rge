<script>
	import { heroImageUrl, heroVideoUrls } from '$lib/heroMedia';

	// One hero plate for the on-air overlays, in three stages:
	//
	//   1. the JPEG paints, because at ~0.2MB it arrives before anything else;
	//   2. the video appears as soon as its own first frame can be drawn, still paused --
	//      so what you are looking at is the video's own opening frame, not a separate
	//      picture that has to be kept in step with it;
	//   3. playback starts once the whole file is local.
	//
	// Stage 2 is the one that matters. The first frame is renderable after roughly a third
	// of the download (measured: 356ms against 1212ms at 25 Mbit/s, 1.6s against 5.7s at 5),
	// so the plate looks right long before it can move, and the transition into motion is
	// invisible because the frame on screen is already the frame it starts from.
	export let hero = '';
	export let className = '';
	export let width = 1000;

	let frameShown = false;
	let videoFailed = false;
	let attempt = 0;

	// The {#key} below rebuilds the elements on a hero change but not this state.
	$: (hero, ((frameShown = false), (videoFailed = false), (attempt = 0)));

	$: imageSrc = heroImageUrl(hero);
	$: candidates = heroVideoUrls(hero);
	$: videoSrc = candidates[attempt] ?? '';

	// Candidates are ordered best first -- the hero's own film, then the plain-name one
	// shared with its other versions. A 404 on the first is the normal way a titled
	// hero reaches the shared film, so it steps down the list rather than giving up.
	function nextCandidate() {
		if (attempt + 1 < candidates.length) {
			attempt += 1;
			frameShown = false;
		} else {
			videoFailed = true;
		}
	}

	// Whether every byte is held locally. `canplaythrough` is not the same thing -- it means
	// the browser guesses it can reach the end at the current download rate, which is a
	// guess that can be wrong and would show a stuttering plate on air.
	function fullyBuffered(node) {
		if (!node.duration || !Number.isFinite(node.duration)) return false;
		const ranges = node.buffered;
		if (!ranges.length) return false;
		return ranges.start(0) <= 0.05 && ranges.end(ranges.length - 1) >= node.duration - 0.05;
	}

	// Deliberately no `autoplay` attribute: playback starts here and only here.
	function playWhenLoaded(node) {
		// The property, not just the attribute: muted playback checks the property.
		node.defaultMuted = true;
		node.muted = true;

		let started = false;
		let graceTimer = null;

		const start = () => {
			if (started) return;
			started = true;
			clearTimeout(graceTimer);
			node.currentTime = 0;
			node.play().catch(() => {});
		};

		const startIfLoaded = () => {
			if (started) return;
			if (fullyBuffered(node)) {
				start();
				return;
			}
			// `preload` is a hint, not a promise: a browser may stop fetching a video that is
			// paused and never played, leaving the buffer a whisker short of the duration
			// forever. Without this the plate would sit on its first frame and never move.
			// Settling for `canplaythrough` after a grace period gives up the absolute
			// no-stutter guarantee in that one case, which beats never playing at all.
			if (node.readyState >= 4 && graceTimer === null) {
				graceTimer = setTimeout(start, 3000);
			}
		};

		const events = ['loadedmetadata', 'loadeddata', 'progress', 'canplaythrough', 'suspend'];
		for (const name of events) node.addEventListener(name, startIfLoaded);

		// The `loop` attribute is not enough on its own. A source that runs for hours has to
		// survive anything that stops it -- OBS suspending a hidden scene, a decoder hiccup,
		// an `ended` that fires despite `loop`. Throttled, because a play() the browser
		// refuses fires `pause` straight back and an unthrottled handler would spin on it.
		let lastRestart = 0;
		const restart = () => {
			if (!started) return;
			const now = Date.now();
			if (now - lastRestart < 1000) return;
			lastRestart = now;
			if (node.ended || node.currentTime >= node.duration - 0.05) node.currentTime = 0;
			node.play().catch(() => {});
		};
		node.addEventListener('ended', restart);
		node.addEventListener('pause', restart);

		// Final net: nothing above fires if the element simply stops advancing.
		let lastTime = -1;
		const watchdog = setInterval(() => {
			if (!started) return;
			if (node.paused || node.currentTime === lastTime) restart();
			lastTime = node.currentTime;
		}, 3000);

		node.load();

		return {
			destroy() {
				clearInterval(watchdog);
				clearTimeout(graceTimer);
				for (const name of events) node.removeEventListener(name, startIfLoaded);
				node.removeEventListener('ended', restart);
				node.removeEventListener('pause', restart);
				started = false;
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
				<!-- Keyed on the URL as well as the hero: stepping to the next candidate has
				     to build a fresh element, since the action only loads its node once. -->
				{#key videoSrc}
					<video
						use:playWhenLoaded
						src={videoSrc}
						class="absolute inset-0 h-full w-full object-cover transition-opacity duration-150"
						class:opacity-0={!frameShown}
						loop
						muted
						playsinline
						preload="auto"
						aria-hidden="true"
						tabindex="-1"
						on:loadeddata={() => (frameShown = true)}
						on:error={nextCandidate}
					></video>
				{/key}
			{/if}
		</div>
	{/key}
{/if}
