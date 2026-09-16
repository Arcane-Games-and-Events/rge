<script>
	// The marker shown beside whichever player holds the turn. Mirrored for the
	// right-hand seat rather than drawn twice.
	export let side = 'left';
	export let size = 64;
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 64 64"
	fill="currentColor"
	aria-hidden="true"
	style={side === 'right' ? 'transform: scaleX(-1)' : ''}
>
	<path d="M12 8 L52 32 L12 56 Z" />
</svg>
