<script context="module">
	// Measured off the slide: the column's bars, 115px tall, step down the right
	// side from 224px.
	const TOP = 224;
	const STEP = 146;
	// The widest a line may draw, from the text's left edge to short of the frame.
	const LINE_MAX = 392;
</script>

<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { cubicOut, cubicIn } from 'svelte/easing';
	import { db } from '../../../firebaseClient';
	import { TOPICS_PATH, normalizeTopics, emphasisRuns } from '$lib/topics';

	// The show's story list, for a 1920x1080 browser source laid over the hosts'
	// slide: the title and the topics sit in the slide's right-hand column, and
	// each topic wipes on when the booth, or a Companion button, calls for it.
	let title = '';
	let items = ['', '', '', ''];
	let shown = 0;
	let ready = false;

	$: onAir = items
		.slice(0, shown)
		.map((text, i) => ({ i, text }))
		.filter((t) => t.text.trim());
	$: current = onAir.length ? onAir[onAir.length - 1].i : -1;

	onMount(() => {
		const unsubscribe = onValue(ref(db, TOPICS_PATH), (snapshot) => {
			({ title, items, shown } = normalizeTopics(snapshot.val()));
		});
		// The type is drawn only once its face is in. fonts.ready alone is not
		// enough: a face is only fetched once something is set in it, and nothing
		// is yet, so it is asked for by name and waited on, within reason.
		waitForFonts().then(() => (ready = true));
		return unsubscribe;
	});

	async function waitForFonts() {
		const deadline = Date.now() + 4000;
		const faces = [`64px 'Bebas Neue'`, `600 46px 'Space Grotesk'`];
		while (Date.now() < deadline) {
			await Promise.all(faces.map((f) => document.fonts.load(f).catch(() => [])));
			if (faces.every((f) => document.fonts.check(f))) return;
			await new Promise((r) => setTimeout(r, 100));
		}
	}

	// A bar wipes on from the left; its words follow a beat behind. Going off,
	// the same wipe runs backwards and faster.
	function wipe(node, { delay = 0, duration = 650 } = {}) {
		return {
			delay,
			duration,
			easing: cubicOut,
			css: (t) => `clip-path: inset(0 ${(1 - t) * 100}% 0 0);`
		};
	}

	function wipeOut(node, { duration = 380 } = {}) {
		return {
			duration,
			easing: cubicIn,
			css: (t) => `clip-path: inset(0 ${(1 - t) * 100}% 0 0); opacity: ${t};`
		};
	}

	// A line that would run past the column's edge is set smaller, down to a
	// floor; past that it breaks onto two lines and shrinks again until both fit
	// inside the bar. Most topics are untouched.
	function fit(node, { max, floor = 44, lines = 1, height = 100 }) {
		const base = parseFloat(getComputedStyle(node).fontSize);
		const width = () => node.getBoundingClientRect().width;
		const measure = () => {
			node.style.whiteSpace = 'nowrap';
			node.style.width = 'max-content';
			node.style.fontSize = `${base}px`;
			const drawn = width();
			if (drawn <= max) return;
			const single = Math.floor((base * max) / drawn);
			if (lines === 1 || single >= floor) {
				node.style.fontSize = `${single}px`;
				return;
			}
			// Two lines: start just under the floor and step down until the block
			// is inside the bar and no single word runs past the edge.
			node.style.whiteSpace = 'normal';
			node.style.width = `${max}px`;
			for (let size = floor; size >= 20; size -= 2) {
				node.style.fontSize = `${size}px`;
				if (node.scrollHeight <= height && node.scrollWidth <= max) return;
			}
		};
		measure();
		document.fonts?.addEventListener?.('loadingdone', measure);
		return {
			update() {
				measure();
			},
			destroy() {
				document.fonts?.removeEventListener?.('loadingdone', measure);
			}
		};
	}

	function slide(node, { delay = 180, duration = 600 } = {}) {
		return {
			delay,
			duration,
			easing: cubicOut,
			css: (t) => `transform: translateX(${(1 - t) * -36}px); opacity: ${t};`
		};
	}
</script>

<svelte:head>
	<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet" />
</svelte:head>

<div class="stage" class:ready>
	{#if ready && title}
		<h1 class="title" in:slide={{ delay: 0 }} use:fit={{ max: LINE_MAX }}>
			{#each emphasisRuns(title) as run, i (i)}<span class:gold={run.gold}>{run.text}</span>{/each}
		</h1>
	{/if}

	{#if ready}
		{#each onAir as topic (topic.i)}
			<div
				class="topic"
				class:current={topic.i === current}
				style="top: {TOP + topic.i * STEP}px;"
				in:wipe
				out:wipeOut
			>
				<span class="edge" aria-hidden="true"></span>
				<span class="shine" aria-hidden="true"></span>
				<span class="words" in:slide use:fit={{ max: LINE_MAX, lines: 2 }}>
					{#each emphasisRuns(topic.text) as run, i (i)}<span class:gold={run.gold}>{run.text}</span
						>{/each}
				</span>
			</div>
		{/each}
	{/if}
</div>

<style>
	.stage {
		position: relative;
		width: 1920px;
		height: 1080px;
		overflow: hidden;
		--gold: #e2b45a;
		/* The column starts at the right edge of the slide's white rule; the text
		   keeps its place at 1498px. */
		--col: 1464px;
		--inset: 34px;
		font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
		color: #fff;
	}

	.title {
		position: absolute;
		left: calc(var(--col) + var(--inset));
		top: 70px;
		margin: 0;
		font-family: 'Space Grotesk', 'Inter', ui-sans-serif, system-ui, sans-serif;
		font-size: 46px;
		font-weight: 600;
		line-height: 1;
		letter-spacing: -0.01em;
		white-space: nowrap;
	}

	/* A hairline draws out under the title once it has landed. */
	.title::after {
		content: '';
		position: absolute;
		left: 0;
		bottom: -22px;
		width: 100%;
		height: 2px;
		background: linear-gradient(90deg, var(--gold), rgba(226, 180, 90, 0));
		transform: scaleX(0);
		transform-origin: left;
		animation: rule 700ms cubic-bezier(0.2, 0.7, 0.2, 1) 350ms forwards;
	}

	@keyframes rule {
		to {
			transform: scaleX(1);
		}
	}

	.gold {
		color: var(--gold);
	}

	.topic {
		position: absolute;
		left: var(--col);
		width: calc(1920px - var(--col));
		height: 115px;
		display: flex;
		align-items: center;
		padding-left: var(--inset);
		box-sizing: border-box;
		background: linear-gradient(90deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.1));
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.12),
			inset 0 -1px 0 rgba(0, 0, 0, 0.25);
		overflow: hidden;
		transition: background 500ms ease;
	}

	/* The topic being talked about carries a gold edge; it passes to the next
	   one as it comes on. */
	.edge {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 7px;
		background: var(--gold);
		transform: scaleY(0);
		transform-origin: top;
		transition: transform 350ms cubic-bezier(0.2, 0.7, 0.2, 1);
	}

	.topic.current .edge {
		transform: scaleY(1);
	}

	.topic.current {
		background: linear-gradient(90deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.12));
	}

	/* A glint crosses the bar once, just after it has wiped on. */
	.shine {
		position: absolute;
		top: -20px;
		bottom: -20px;
		left: 0;
		width: 140px;
		background: linear-gradient(
			100deg,
			rgba(255, 255, 255, 0) 0%,
			rgba(255, 255, 255, 0.35) 50%,
			rgba(255, 255, 255, 0) 100%
		);
		transform: translateX(-160px) skewX(-18deg);
		animation: glint 900ms cubic-bezier(0.3, 0.6, 0.3, 1) 420ms forwards;
		pointer-events: none;
	}

	@keyframes glint {
		to {
			transform: translateX(560px) skewX(-18deg);
		}
	}

	.words {
		position: relative;
		display: block;
		font-family: 'Bebas Neue', 'Inter', ui-sans-serif, system-ui, sans-serif;
		font-size: 64px;
		font-weight: 400;
		line-height: 1;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		white-space: nowrap;
		overflow-wrap: anywhere;
		line-height: 0.92;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
	}
</style>
