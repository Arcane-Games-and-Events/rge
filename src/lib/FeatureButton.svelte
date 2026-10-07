<script>
	// The bar under a bracket match that sends it to the booth as the feature
	// match, and shows when it is the one on the booth.
	export let featured = false;
	export let disabled = false;
</script>

<button
	type="button"
	aria-pressed={featured}
	{disabled}
	title={featured
		? 'On the booth as the feature match'
		: 'Send both players to the booth: names, heroes and seeds'}
	on:click
	class="w-full border-t border-gray-700 px-2 py-1.5 text-[11px] font-semibold transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 {featured
		? 'bg-amber-500 text-gray-950'
		: 'bg-gray-800/70 text-gray-300 hover:bg-amber-500 hover:text-gray-950'}"
>
	{featured ? '★ Featured on the booth' : '☆ Feature match'}
</button>
