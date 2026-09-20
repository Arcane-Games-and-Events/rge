<script>
	import { onMount, onDestroy, tick } from 'svelte';

	// Text that always occupies the same box: it shrinks when it is long and grows
	// when it is short. The lines are drawn into an SVG whose viewBox is set to the
	// text's own measured bounds, so the browser does the scaling for us — one pass
	// rather than a measure-and-retry loop, and it re-fits whenever the words change.
	export let text = '';
	/** 'left', 'center' or 'right' — how the lines sit against each other. */
	export let align = 'left';
	export let width = 288;
	export let height = 80;
	/** Put everything after the first space on a second line. */
	export let breakAtFirstSpace = false;
	/** Give each line its own size so every line comes out the same width. */
	export let equaliseLineWidths = true;
	export let weight = 700;

	// Internal drawing unit. The viewBox scaling makes the absolute value
	// irrelevant; it only needs to be large enough to measure precisely.
	const BASE = 100;
	const LINE_GAP = 1.02;

	let groupEl;
	let lineEls = [];
	let sizes = [];
	let viewBox = '0 0 1 1';
	let measured = false;

	const splitFirstSpace = (value) => {
		const trimmed = (value || '').trim();
		const at = trimmed.indexOf(' ');
		if (at === -1) return [trimmed];
		return [trimmed.slice(0, at), trimmed.slice(at + 1).trim()];
	};

	$: lines = (breakAtFirstSpace ? splitFirstSpace(text) : [(text || '').trim()]).filter(Boolean);
	$: anchor = align === 'right' ? 'end' : align === 'center' ? 'middle' : 'start';
	// Anchor the scaled result to the same edge the text is aligned to, so the
	// block does not drift as names change length.
	$: fit =
		align === 'right' ? 'xMaxYMid meet' : align === 'center' ? 'xMidYMid meet' : 'xMinYMid meet';

	// Each line starts where the previous one ends, which depends on that line's
	// own size once the widths have been equalised.
	$: tops = sizes.map((_, i) => sizes.slice(0, i).reduce((sum, s) => sum + s * LINE_GAP, 0));

	$: (lines, reflow());

	// tick() promises Svelte has written to the DOM, not that the browser has laid
	// it out, and getBBox reads layout. Measuring straight after a tick could read
	// the previous name's geometry, which is why a name changed live came out at
	// the wrong size while a reload was always right: the reload had a second
	// measurement from onMount once fonts were ready, and an update had none.
	//
	// Rather than guess how many frames are enough, measure repeatedly until the
	// answer stops moving.
	const nextFrame = () =>
		typeof requestAnimationFrame === 'undefined'
			? Promise.resolve()
			: new Promise((resolve) => requestAnimationFrame(resolve));

	// A name can change again mid-reflow; only the newest run may write a result.
	let reflowId = 0;

	async function reflow() {
		const id = ++reflowId;

		sizes = lines.map(() => BASE);
		await tick();
		await nextFrame();
		if (id !== reflowId) return;

		equalise();
		await tick();

		let previous = null;
		for (let attempt = 0; attempt < 4; attempt++) {
			await nextFrame();
			if (id !== reflowId) return;
			measure();
			if (viewBox === previous) break;
			previous = viewBox;
		}
	}

	// Scale each line so they all come out the same width: a long first name
	// shrinks to match a short surname, and a short one grows. Width scales
	// linearly with font size, so a single pass lands exactly.
	function equalise() {
		if (!equaliseLineWidths || lines.length < 2) return;
		const measuredWidths = lines.map((_, i) => lineEls[i]?.getComputedTextLength?.() ?? 0);
		if (measuredWidths.some((w) => !w)) return;

		// getComputedTextLength reports the width at whatever size the line is
		// currently drawn at, so normalise back to BASE first. Without this a second
		// pass measures already-equalised lines, finds them equal, and undoes itself.
		const natural = measuredWidths.map((w, i) => w * (BASE / (sizes[i] || BASE)));
		const target = Math.max(...natural);
		sizes = natural.map((w) => BASE * (target / w));
	}

	function measure() {
		if (!groupEl) return;
		try {
			const box = groupEl.getBBox();
			if (box.width <= 0 || box.height <= 0) return;

			// A name with no space is a single line, and on its own it would scale to
			// the full height and come out at twice the letter size of every other
			// name. Reserving the same number of lines keeps letters a consistent
			// size whatever the name is, with the short one centred in the gap.
			const reserved = Math.max(lines.length, breakAtFirstSpace ? 2 : 1);
			const perLine = box.height / lines.length;
			const boxHeight = perLine * reserved;
			const y = box.y - (boxHeight - box.height) / 2;

			viewBox = `${box.x} ${y} ${box.width} ${boxHeight}`;
			measured = true;
		} catch {
			// getBBox throws if the node is not rendered yet; the next pass will catch it.
		}
	}

	// A cold load can measure before the face has even been requested: with no
	// text on the page yet, fonts.ready resolves at once, the name then arrives
	// and renders in the fallback face, and Tiller swaps in under a measurement
	// taken against the wrong glyphs. The next refresh has the font cached and
	// comes out right, which is how it showed up in OBS. So whenever a face
	// finishes loading, reflow again. Redo the whole reflow rather than just
	// re-measuring: the line sizes are derived from glyph widths, so they need
	// recomputing against the real face too.
	const onFontsLoaded = () => reflow();

	onMount(async () => {
		document.fonts?.addEventListener?.('loadingdone', onFontsLoaded);
		try {
			await document.fonts?.ready;
		} catch {
			// no font loading API; the pass above stands
		}
		await reflow();
	});

	onDestroy(() => {
		if (typeof document !== 'undefined')
			document.fonts?.removeEventListener?.('loadingdone', onFontsLoaded);
	});
</script>

{#if lines.length}
	<svg
		{viewBox}
		preserveAspectRatio={fit}
		style="width:{width}px;height:{height}px;overflow:visible"
		class:opacity-0={!measured}
		aria-label={text}
		role="img"
	>
		<g bind:this={groupEl} fill="currentColor" font-weight={weight}>
			{#each lines as line, i (i)}
				<text
					bind:this={lineEls[i]}
					x="0"
					y={tops[i] ?? 0}
					font-size={sizes[i] ?? BASE}
					text-anchor={anchor}
					dominant-baseline="hanging">{line}</text
				>
			{/each}
		</g>
	</svg>
{/if}
