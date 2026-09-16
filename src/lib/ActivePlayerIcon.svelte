<script>
	// Marks whichever player holds the turn: a chevron aimed at them with a
	// diamond at its open side. Traced from the supplied artwork: an 82 x 124 box
	// with the apex at the left and the diamond centred on the apex's height.
	//
	// The stroke is 10 units, not the 14 the artwork spans horizontally — a 45
	// degree stroke covers width / cos(45) across a row, so measuring a diagonal
	// by its rows overstates it by about a span. The arms are cut square rather
	// than rounded, which is what gives the tips their taper.
	//
	// Drawn pointing left and mirrored for the right-hand seat, so there is only
	// one shape to maintain.
	export let side = 'left';
	export let size = 64;

	$: height = Math.round((size * 124) / 82);
</script>

<svg
	width={size}
	{height}
	viewBox="0 0 82 124"
	fill="none"
	aria-hidden="true"
	style={side === 'right' ? 'transform: scaleX(-1)' : ''}
>
	<path
		d="M64 4 L7 62 L64 120"
		stroke="currentColor"
		stroke-width="10"
		stroke-linecap="butt"
		stroke-linejoin="round"
	/>
	<path d="M61 43 L79 61 L61 79 L43 61 Z" fill="currentColor" />
</svg>
