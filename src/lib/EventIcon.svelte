<script>
	// The marks an event can carry. The trophy is always gold -- Tailwind's
	// amber-400 -- and the crown takes the current colour, the circuit's where
	// it sits.
	export let kind = '';
	const GOLD = '#fbbf24';
</script>

{#if kind === 'trophy'}
	<svg viewBox="0 0 24 24" fill={GOLD} aria-label="Trophy" role="img">
		<path
			d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V17h3v2H8v-2h3v-2.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3zm0 4H6v1a2 2 0 0 0 2 2V7zm10 0v3a2 2 0 0 0 2-2V7h-2z"
		/>
	</svg>
{:else if kind === 'crown'}
	<svg viewBox="0 0 24 24" fill="currentColor" aria-label="Crown" role="img">
		<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5L3 8zm2 12h14v2H5v-2z" />
	</svg>
{/if}
