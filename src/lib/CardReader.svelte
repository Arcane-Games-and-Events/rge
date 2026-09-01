<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import { ref, set } from 'firebase/database';
	import { db } from '../firebaseClient';
	import debounce from 'lodash.debounce';

	// Card data comes from `@flesh-and-blood/cards` via /api/cards/search, which
	// runs the `@flesh-and-blood/search` engine server-side. The dataset is far
	// too large to ship to the browser, so the endpoint returns trimmed results.
	let query = '';
	let results = [];
	let highlight = 0;
	let listOpen = false;
	let isSearching = false;
	let error = null;
	let inputEl;

	// The card currently pushed to the broadcast, tracked separately from the
	// highlighted result so arrowing through the list previews without airing.
	let liveCard = null;
	let previewUrl = '';
	let previewFallbacks = [];
	let previewedId = null;

	let flash = null;
	let flashTimer = null;

	// Repeat and backtracked queries are common when typing fast, so completed
	// searches are kept for the life of the session.
	const cache = new Map();
	let latestSearchId = 0;

	// Arrowing the list previews that card; only the live card is on air.
	$: previewCard = listOpen && results.length > 0 ? results[highlight] : liveCard;
	$: if ((previewCard?.cardIdentifier ?? null) !== previewedId) {
		previewedId = previewCard?.cardIdentifier ?? null;
		previewUrl = previewCard?.imageUrl || '';
		previewFallbacks = (previewCard?.imageUrlCandidates || []).filter((u) => u !== previewUrl);
	}
	$: isLive = !!liveCard && previewCard?.cardIdentifier === liveCard.cardIdentifier;

	const pitchColor = (pitch) => {
		switch (pitch) {
			case 1:
				return 'bg-red-500/20 text-red-300 border-red-500/40';
			case 2:
				return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
			case 3:
				return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
			default:
				return 'bg-gray-600/20 text-gray-400 border-gray-600/40';
		}
	};

	const runSearch = async (text) => {
		const term = text.trim();
		const searchId = ++latestSearchId;

		if (term === '') {
			results = [];
			highlight = 0;
			isSearching = false;
			return;
		}

		if (cache.has(term)) {
			results = cache.get(term);
			highlight = 0;
			isSearching = false;
			return;
		}

		try {
			const response = await fetch(`/api/cards/search?q=${encodeURIComponent(term)}`);
			const data = await response.json();
			// Ignore responses that arrived out of order
			if (searchId !== latestSearchId) return;
			if (!response.ok) throw new Error(data.error || 'Search failed');
			cache.set(term, data.results || []);
			results = data.results || [];
			highlight = 0;
			error = null;
		} catch (err) {
			if (searchId !== latestSearchId) return;
			console.error('Error searching cards:', err);
			error = err.message;
			results = [];
		} finally {
			if (searchId === latestSearchId) isSearching = false;
		}
	};

	const debouncedSearch = debounce(runSearch, 120);

	const onInput = (event) => {
		const value = event.target.value;
		listOpen = true;
		highlight = 0;
		const term = value.trim();
		// Cached terms resolve without waiting on the debounce so fast typing
		// over familiar names stays instant.
		if (cache.has(term)) {
			debouncedSearch.cancel();
			runSearch(value);
			return;
		}
		isSearching = term !== '';
		debouncedSearch(value);
	};

	const flashAired = (name) => {
		flash = name;
		clearTimeout(flashTimer);
		flashTimer = setTimeout(() => (flash = null), 1500);
	};

	const publish = async (url) => {
		// Add timestamp to force browser to reload image
		const urlWithTimestamp = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
		try {
			await set(ref(db, 'cardReaderURL'), urlWithTimestamp);
			error = null;
		} catch (err) {
			console.error('Error saving image URL to Firebase:', err);
			error = err.message;
		}
	};

	const airCard = async (card) => {
		if (!card) return;
		const url = card.imageUrl || (card.imageUrlCandidates || [])[0];
		if (!url) return;

		liveCard = card;
		listOpen = false;
		// Keep the query and select it so repeated Enter re-airs the same card
		// and the next keystroke replaces it for a new one.
		query = card.name;
		await tick();
		inputEl?.select();
		flashAired(card.name);
		await publish(previewUrl || url);
	};

	const airHighlighted = () => {
		const card = listOpen && results.length > 0 ? results[highlight] : liveCard;
		if (card) airCard(card);
	};

	const handlePreviewImageError = () => {
		const nextUrl = previewFallbacks.shift();
		if (!nextUrl) {
			error = `No working image found for ${previewCard?.name ?? 'card'}`;
			return;
		}
		previewUrl = nextUrl;
		if (isLive) publish(nextUrl);
	};

	const handleClear = async () => {
		debouncedSearch.cancel();
		latestSearchId++;
		query = '';
		results = [];
		highlight = 0;
		listOpen = false;
		isSearching = false;
		liveCard = null;
		previewUrl = '';
		previewFallbacks = [];
		error = null;
		inputEl?.focus();
		try {
			await set(ref(db, 'cardReaderURL'), '');
		} catch (err) {
			console.error('Error clearing card URL:', err);
		}
	};

	const handleKeyDown = (event) => {
		const lastIndex = results.length - 1;

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				listOpen = true;
				// Wrap so holding one direction can reach every result.
				highlight = results.length ? (highlight + 1) % results.length : 0;
				break;
			case 'ArrowUp':
				event.preventDefault();
				listOpen = true;
				highlight = results.length ? (highlight - 1 + results.length) % results.length : 0;
				break;
			case 'Home':
				if (!listOpen) return;
				event.preventDefault();
				highlight = 0;
				break;
			case 'End':
				if (!listOpen) return;
				event.preventDefault();
				highlight = Math.max(0, lastIndex);
				break;
			case 'Tab':
				// Tab accepts the highlighted result without leaving the input.
				if (listOpen && results.length > 0) {
					event.preventDefault();
					airHighlighted();
				}
				break;
			case 'Enter':
				event.preventDefault();
				airHighlighted();
				break;
			case 'Escape':
				event.preventDefault();
				if (listOpen) {
					listOpen = false;
				} else {
					query = '';
					results = [];
					highlight = 0;
				}
				break;
			default:
				return;
		}

		if (listOpen && results.length > 0) {
			const option = document.getElementById(`card-option-${highlight}`);
			option?.scrollIntoView({ block: 'nearest' });
		}
	};

	const handleClickOutside = (event) => {
		if (!event.target.closest('.combobox')) {
			listOpen = false;
		}
	};

	onMount(() => {
		inputEl?.focus();
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});

	onDestroy(() => {
		debouncedSearch.cancel();
		clearTimeout(flashTimer);
	});
</script>

<div class="space-y-2 text-white">
	<!-- Keyboard hints -->
	<div class="flex items-center justify-between gap-2">
		<div class="text-[10px] text-gray-500 hidden sm:flex flex-wrap items-center gap-1">
			<kbd class="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 font-mono">Enter</kbd>
			air
			<kbd class="ml-1 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 font-mono">↑↓</kbd>
			pick
			<kbd class="ml-1 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 font-mono">Esc</kbd> clear
		</div>
		{#if flash}
			<div class="text-[10px] font-medium text-green-400 whitespace-nowrap">On air: {flash}</div>
		{/if}
	</div>

	<!-- Search Row -->
	<div class="flex items-center gap-1.5">
		<div class="relative combobox flex-1">
			<input
				bind:this={inputEl}
				type="text"
				placeholder="Search card... (try pitch:1 or class:brute)"
				class="w-full px-2 py-2.5 rounded text-sm bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
				role="combobox"
				aria-controls="card-options"
				aria-expanded={listOpen}
				aria-activedescendant={listOpen && results.length ? `card-option-${highlight}` : undefined}
				autocomplete="off"
				spellcheck="false"
				on:input={onInput}
				on:focus={() => (listOpen = true)}
				on:keydown={handleKeyDown}
				bind:value={query}
			/>
			{#if isSearching}
				<div
					class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-gray-500"
				>
					…
				</div>
			{/if}
		</div>
		<button
			type="button"
			class="px-3 py-2.5 rounded text-xs bg-gray-800 text-gray-400 hover:bg-red-600 hover:text-white transition-colors flex-shrink-0"
			on:click={handleClear}
		>
			Clear
		</button>
	</div>

	<!-- Results -->
	{#if listOpen && results.length > 0}
		<ul
			class="max-h-64 overflow-auto rounded border border-gray-700 bg-gray-800/50 py-1"
			id="card-options"
			role="listbox"
		>
			{#each results as card, index (card.cardIdentifier)}
				<li
					id={'card-option-' + index}
					role="option"
					aria-selected={highlight === index}
					class="cursor-pointer select-none {highlight === index
						? 'bg-blue-600/40 ring-1 ring-inset ring-blue-500'
						: 'hover:bg-gray-700/60'}"
					on:mouseenter={() => (highlight = index)}
				>
					<button
						type="button"
						class="flex w-full items-center gap-2 px-2 py-1.5 text-left"
						on:click={() => airCard(card)}
					>
						<span
							class="flex-none w-5 text-center rounded border text-[10px] font-mono leading-4 {pitchColor(
								card.pitch
							)}"
						>
							{card.pitch ?? '–'}
						</span>
						<span class="flex-1 truncate text-sm">{card.name}</span>
						{#if liveCard?.cardIdentifier === card.cardIdentifier}
							<span class="flex-none text-[9px] font-bold text-green-400">LIVE</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{:else if listOpen && isSearching}
		<div class="rounded border border-gray-700 bg-gray-800/50 py-2 px-2 text-xs text-gray-500">
			Searching…
		</div>
	{:else if listOpen && query.trim() && !isSearching}
		<div class="rounded border border-gray-700 bg-gray-800/50 py-2 px-2 text-xs text-gray-500">
			No cards found
		</div>
	{/if}

	<!-- Card Preview -->
	{#if previewCard && previewUrl}
		<div class="flex flex-col items-center gap-1 pt-1">
			<div class="flex items-center gap-1.5 text-[10px] font-medium">
				{#if isLive}
					<span
						class="rounded bg-green-500/20 px-1.5 py-0.5 text-green-400 border border-green-500/40"
					>
						ON AIR
					</span>
				{:else}
					<span
						class="rounded bg-gray-700/50 px-1.5 py-0.5 text-gray-400 border border-gray-600/40"
					>
						PREVIEW · Enter to air
					</span>
				{/if}
				<span class="text-gray-400 truncate">{previewCard.name}</span>
			</div>
			<img
				src={previewUrl}
				alt={previewCard.name}
				class="w-96 sm:w-[28rem] rounded shadow-lg {isLive ? '' : 'opacity-70'}"
				on:error={handlePreviewImageError}
			/>
		</div>
	{/if}

	{#if error}
		<div class="text-xs text-red-400 mt-2">{error}</div>
	{/if}
</div>
