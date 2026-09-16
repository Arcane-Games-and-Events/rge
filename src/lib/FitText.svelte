<script>
	import { onMount, tick } from 'svelte';

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
	export let weight = 700;

	/**
	 * Size of the first line relative to the last, so a first name sits smaller
	 * over a larger surname.
	 *
	 * Matching the two widths instead was the obvious reading of the reference
	 * graphic, but it ties each line's size to how many letters the word has: a
	 * short word over a long one came out enormous ("Jo" over "Konstantinopoulos"
	 * at eight times the size), and a surname longer than the first name inverted
	 * the look by making the first name the larger of the two. A fixed ratio always
	 * reads the same way round, whatever the name.
	 */
	export let firstLineScale = 0.65;

	// Internal drawing unit. The viewBox scaling makes the absolute value
	// irrelevant; it only needs to be large enough to measure precisely.
	const BASE = 100;
	const LINE_GAP = 1.02;

	let groupEl;
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

	// The last line is the reference size; anything above it sits smaller.
	$: sizes = lines.map((_, i) => (i === lines.length - 1 ? BASE : BASE * firstLineScale));

	// Each line starts where the previous one ends, which depends on that line's
	// own size.
	$: tops = sizes.map((_, i) => sizes.slice(0, i).reduce((sum, s) => sum + s * LINE_GAP, 0));

	$: (lines, sizes, remeasure());

	async function remeasure() {
		await tick();
		measure();
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

	onMount(async () => {
		// Measuring before the webfont arrives would size everything to the
		// fallback face, so wait for fonts to settle and run it again.
		try {
			await document.fonts?.ready;
		} catch {
			// no font loading API; the pass above stands
		}
		measure();
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
