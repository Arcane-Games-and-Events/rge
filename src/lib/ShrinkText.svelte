<script>
	import { onMount, tick } from 'svelte';

	// One line of text in a box of fixed size. It renders at a set font size and
	// only shrinks when it would otherwise overrun the box, so most names look
	// identical and only an unusually long one is scaled down. The box never
	// changes size, which is what makes the overlay predictable to position in OBS.
	export let text = '';
	export let width = 288;
	export let height = 40;
	/** Font size in px when the text fits, which is most of the time. */
	export let size = 28;
	export let weight = 700;
	/** 'center' keeps the line centred in the box; 'left' starts it at the left edge. */
	export let align = 'center';

	$: anchor = align === 'left' ? 'start' : 'middle';
	// The viewBox is what scales an overlong line down, so the alignment has to be
	// applied to it as well as to the text: leaving it centred would pull a shrunken
	// line back towards the middle of the box.
	$: fit = align === 'left' ? 'xMinYMid meet' : 'xMidYMid meet';

	let textEl;
	let contentWidth = width;
	let measured = false;

	// Widening the viewBox past the box is what scales the text down; leaving it
	// equal to the box renders at exactly `size`.
	$: viewBox = `0 0 ${contentWidth} ${height}`;

	$: (text, size, remeasure());

	async function remeasure() {
		contentWidth = width;
		await tick();
		measure();
	}

	function measure() {
		if (!textEl) return;
		try {
			const drawn = textEl.getComputedTextLength();
			if (!drawn) return;
			contentWidth = Math.max(width, drawn);
			measured = true;
		} catch {
			// getComputedTextLength throws before the node is rendered; the next pass
			// will pick it up.
		}
	}

	onMount(async () => {
		// Measuring before the webfont lands would size against the fallback face.
		try {
			await document.fonts?.ready;
		} catch {
			// no font loading API; the measurement above stands
		}
		measure();
	});
</script>

{#if text}
	<svg
		{viewBox}
		preserveAspectRatio={fit}
		style="width:{width}px;height:{height}px;overflow:visible"
		class:opacity-0={!measured}
		aria-label={text}
		role="img"
	>
		<text
			bind:this={textEl}
			x={align === 'left' ? 0 : contentWidth / 2}
			y={height / 2}
			text-anchor={anchor}
			dominant-baseline="central"
			font-size={size}
			font-weight={weight}
			fill="currentColor">{text}</text
		>
	</svg>
{/if}
