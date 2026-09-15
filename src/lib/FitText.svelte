<script>
	import { onMount, tick } from 'svelte';

	// Text that always occupies the same box: it shrinks when it is long and grows
	// when it is short. The text is drawn into an SVG whose viewBox is set to the
	// text's own measured bounds, so the browser scales it to fill the box for us —
	// no measure-and-retry loop, and it re-fits whenever the words change.
	export let text = '';
	/** 'left', 'center' or 'right' — how the lines sit against each other. */
	export let align = 'left';
	export let width = 288;
	export let height = 80;
	/** Put everything after the first space on a second line. */
	export let breakAtFirstSpace = false;
	export let weight = 700;

	let textEl;
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

	// Re-measure whenever the words change.
	$: (lines, remeasure());

	async function remeasure() {
		await tick();
		measure();
	}

	function measure() {
		if (!textEl) return;
		try {
			const box = textEl.getBBox();
			if (box.width <= 0 || box.height <= 0) return;

			// A name with no space is a single line, and on its own it would scale to
			// the full height and come out at twice the letter size of every other
			// name. Reserving the same number of lines keeps letters a consistent
			// size whatever the name is, with the short one centred in the gap.
			const reserved = Math.max(lines.length, breakAtFirstSpace ? 2 : 1);
			const perLine = box.height / lines.length;
			const height = perLine * reserved;
			const y = box.y - (height - box.height) / 2;

			viewBox = `${box.x} ${y} ${box.width} ${height}`;
			measured = true;
		} catch {
			// getBBox throws if the node is not rendered yet; the next pass will catch it.
		}
	}

	onMount(async () => {
		// Measuring before the webfont arrives would size the box to the fallback,
		// so wait for fonts to settle and measure again.
		try {
			await document.fonts?.ready;
		} catch {
			// no font loading API; the measurement above stands
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
		<text
			bind:this={textEl}
			x="0"
			y="0"
			text-anchor={anchor}
			dominant-baseline="hanging"
			fill="currentColor"
			font-weight={weight}
		>
			{#each lines as line, i (i)}
				<tspan x="0" dy={i === 0 ? '0' : '1.02em'}>{line}</tspan>
			{/each}
		</text>
	</svg>
{/if}
