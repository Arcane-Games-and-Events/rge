<script>
	import { createEventDispatcher, tick } from 'svelte';
	import { heroes } from '$lib/heroes';

	// A hero field for a list of players: type a few letters, pick a match. The
	// hero list has over a hundred and fifty names, which is too many for a
	// dropdown to be found in quickly, so this filters as you type and offers the
	// closest eight. Dispatches `change` with the chosen name, or '' when cleared.
	export let value = '';
	export let placeholder = 'Hero';
	export let label = 'Hero';
	export let id = '';

	const dispatch = createEventDispatcher();
	const MAX_MATCHES = 8;

	let query = '';
	let editing = false;
	let open = false;
	let matches = [];
	let highlighted = 0;
	let input;

	// The field shows the stored value until the producer starts typing in it.
	$: if (!editing) query = value;

	function filter() {
		const q = query.trim().toLowerCase();
		matches = q
			? $heroes.filter((h) => h.name.toLowerCase().includes(q)).slice(0, MAX_MATCHES)
			: [];
		open = matches.length > 0;
		highlighted = 0;
	}

	function pick(hero) {
		editing = false;
		open = false;
		query = hero.name;
		if (hero.name !== value) dispatch('change', hero.name);
	}

	function clear() {
		editing = false;
		open = false;
		query = '';
		if (value) dispatch('change', '');
		input?.focus();
	}

	// Leaving the field: an emptied field clears the hero, anything else that was
	// not picked from the list is discarded, so a half-typed name never sticks.
	async function blur() {
		await tick();
		setTimeout(() => {
			if (!editing) return;
			if (query.trim() === '' && value) dispatch('change', '');
			editing = false;
			open = false;
		}, 150);
	}

	function keydown(e) {
		if (e.key === 'ArrowDown' && open) {
			e.preventDefault();
			highlighted = (highlighted + 1) % matches.length;
		} else if (e.key === 'ArrowUp' && open) {
			e.preventDefault();
			highlighted = (highlighted - 1 + matches.length) % matches.length;
		} else if (e.key === 'Enter' && open) {
			e.preventDefault();
			pick(matches[highlighted]);
		} else if (e.key === 'Escape') {
			editing = false;
			open = false;
		}
	}
</script>

<div class="relative">
	<input
		bind:this={input}
		type="text"
		{id}
		{placeholder}
		aria-label={label}
		role="combobox"
		aria-expanded={open}
		aria-controls="{id}-list"
		autocomplete="off"
		bind:value={query}
		on:focus={() => (editing = true)}
		on:input={() => {
			editing = true;
			filter();
		}}
		on:keydown={keydown}
		on:blur={blur}
		class="h-8 w-full rounded border border-gray-700 bg-gray-900 px-2 pr-7 text-xs text-white placeholder-gray-500 transition-colors focus:border-blue-500 focus:outline-none"
	/>
	{#if query}
		<button
			type="button"
			aria-label="Clear {label}"
			tabindex="-1"
			on:mousedown|preventDefault={clear}
			class="absolute right-0 top-0 h-8 w-7 text-xs text-gray-500 hover:text-white">✕</button
		>
	{/if}
	{#if open}
		<ul
			id="{id}-list"
			role="listbox"
			class="absolute left-0 z-30 mt-1 w-full min-w-56 overflow-hidden rounded border border-gray-700 bg-gray-900 shadow-xl"
		>
			{#each matches as hero, i (hero.name)}
				<li role="option" aria-selected={i === highlighted}>
					<button
						type="button"
						on:mousedown|preventDefault={() => pick(hero)}
						on:mouseenter={() => (highlighted = i)}
						class="flex h-8 w-full items-center gap-2 px-2 text-left text-xs text-gray-200 {i ===
						highlighted
							? 'bg-blue-600/40'
							: ''}"
					>
						{#if hero.image}
							<img src={hero.image} alt="" class="h-5 w-5 flex-none rounded object-cover" />
						{:else}
							<span
								class="flex h-5 w-5 flex-none items-center justify-center rounded bg-gray-700 text-[9px] font-bold text-gray-400"
								>{hero.name.charAt(0)}</span
							>
						{/if}
						<span class="truncate">{hero.name}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
