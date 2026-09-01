<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import { ref, set } from 'firebase/database';
	import { db } from '../firebaseClient';
	import debounce from 'lodash.debounce';
	import { buildImageUrl, getImageUrlCandidates } from '$lib/fabCardImage';

	// Card data comes from `@flesh-and-blood/cards` via /api/cards/search, which
	// runs the `@flesh-and-blood/search` engine server-side. The dataset is far
	// too large to ship to the browser, so the endpoint returns trimmed results.
	let query = '';
	let results = [];
	let groupIndex = 0;
	let variantIndex = 0;
	let listOpen = false;
	let isSearching = false;
	let error = null;
	let inputEl;

	// The card currently pushed to the broadcast, tracked separately from the
	// highlighted result so moving through the list previews without airing.
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

	const MAX_GROUPS = 12;

	// One row per card name: the pitch variants of a name sit side by side on
	// that row rather than taking a row each. Up/down walks names, left/right
	// walks the pitches of the current name.
	$: groups = (() => {
		const byName = new Map();
		for (const card of results) {
			if (!byName.has(card.name)) byName.set(card.name, []);
			byName.get(card.name).push(card);
		}
		return [...byName.entries()].slice(0, MAX_GROUPS).map(([name, variants]) => ({
			name,
			// Pitchless printings (tokens) sort after the pitched ones.
			variants: [...variants].sort((a, b) => (a.pitch ?? 99) - (b.pitch ?? 99))
		}));
	})();

	$: if (groupIndex >= groups.length) groupIndex = 0;
	$: if (variantIndex >= (groups[groupIndex]?.variants.length ?? 1)) variantIndex = 0;

	$: selectedCard = groups[groupIndex]?.variants[variantIndex] ?? null;

	// Moving through the list previews that card; only the live card is on air.
	$: previewCard = listOpen && selectedCard ? selectedCard : liveCard;
	$: if ((previewCard?.cardIdentifier ?? null) !== previewedId) {
		previewedId = previewCard?.cardIdentifier ?? null;
		const candidates = previewCard
			? getImageUrlCandidates(previewCard.image, previewCard.images)
			: [];
		previewUrl = candidates[0] || '';
		previewFallbacks = candidates.slice(1);
	}
	$: isLive = !!liveCard && previewCard?.cardIdentifier === liveCard.cardIdentifier;

	const pitchColor = (pitch, active) => {
		const base = {
			1: 'bg-red-500/20 text-red-300 border-red-500/50',
			2: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
			3: 'bg-blue-500/20 text-blue-300 border-blue-500/50'
		};
		const chip = base[pitch] || 'bg-gray-600/20 text-gray-400 border-gray-600/50';
		return active ? `${chip} ring-1 ring-white/70` : chip;
	};

	const runSearch = async (text) => {
		const term = text.trim();
		const searchId = ++latestSearchId;

		if (term === '') {
			results = [];
			groupIndex = 0;
			variantIndex = 0;
			isSearching = false;
			return;
		}

		if (cache.has(term)) {
			results = cache.get(term);
			groupIndex = 0;
			variantIndex = 0;
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
			groupIndex = 0;
			variantIndex = 0;
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
		groupIndex = 0;
		variantIndex = 0;
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
		const url = buildImageUrl(card.image) || getImageUrlCandidates(card.image, card.images)[0];
		if (!url) return;

		// Air whatever is on screen for this card, so a fallback walked to during
		// preview is what goes out rather than the broken primary.
		const airUrl =
			previewCard?.cardIdentifier === card.cardIdentifier && previewUrl ? previewUrl : url;

		liveCard = card;
		listOpen = false;
		// Keep the query and select it so repeated Enter re-airs the same card
		// and the next keystroke replaces it for a new one.
		query = card.name;
		await tick();
		inputEl?.select();
		flashAired(card.pitch ? `${card.name} (${card.pitch})` : card.name);
		await publish(airUrl);
	};

	const airSelected = () => airCard(listOpen && selectedCard ? selectedCard : liveCard);

	// Clicking a pitch chip both moves the selection there and airs it.
	const pickVariant = (gIndex, vIndex) => {
		groupIndex = gIndex;
		variantIndex = vIndex;
		airCard(groups[gIndex]?.variants[vIndex]);
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
		groupIndex = 0;
		variantIndex = 0;
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
		const variantCount = groups[groupIndex]?.variants.length ?? 0;

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				listOpen = true;
				// Wrap so holding one direction can reach every result.
				groupIndex = groups.length ? (groupIndex + 1) % groups.length : 0;
				variantIndex = 0;
				break;
			case 'ArrowUp':
				event.preventDefault();
				listOpen = true;
				groupIndex = groups.length ? (groupIndex - 1 + groups.length) % groups.length : 0;
				variantIndex = 0;
				break;
			case 'ArrowRight':
				// Only claim the key when there is another pitch to move to,
				// otherwise leave the caret alone.
				if (!listOpen || variantCount < 2) return;
				event.preventDefault();
				variantIndex = (variantIndex + 1) % variantCount;
				break;
			case 'ArrowLeft':
				if (!listOpen || variantCount < 2) return;
				event.preventDefault();
				variantIndex = (variantIndex - 1 + variantCount) % variantCount;
				break;
			case 'Home':
				if (!listOpen) return;
				event.preventDefault();
				groupIndex = 0;
				variantIndex = 0;
				break;
			case 'End':
				if (!listOpen) return;
				event.preventDefault();
				groupIndex = Math.max(0, groups.length - 1);
				variantIndex = 0;
				break;
			case 'Tab':
				// Tab accepts the highlighted result without leaving the input.
				if (listOpen && selectedCard) {
					event.preventDefault();
					airSelected();
				}
				break;
			case 'Enter':
				event.preventDefault();
				airSelected();
				break;
			case 'Escape':
				event.preventDefault();
				if (listOpen) {
					listOpen = false;
				} else {
					query = '';
					results = [];
					groupIndex = 0;
					variantIndex = 0;
				}
				break;
			default:
				return;
		}

		if (listOpen && groups.length > 0) {
			document.getElementById(`card-option-${groupIndex}`)?.scrollIntoView({ block: 'nearest' });
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
			<kbd class="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 font-mono">↑↓</kbd> card
			<kbd class="ml-1 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 font-mono">←→</kbd>
			pitch
			<kbd class="ml-1 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 font-mono"
				>Enter</kbd
			>
			air
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
				aria-activedescendant={listOpen && groups.length ? `card-option-${groupIndex}` : undefined}
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

	<!-- Results: one row per card name, pitches inline -->
	{#if listOpen && groups.length > 0}
		<ul
			class="max-h-64 overflow-auto rounded border border-gray-700 bg-gray-800/50 py-1"
			id="card-options"
			role="listbox"
		>
			{#each groups as group, gIndex (group.name)}
				<li
					id={'card-option-' + gIndex}
					role="option"
					aria-selected={groupIndex === gIndex}
					aria-label={group.name}
					class="flex items-center gap-2 px-2 py-1.5 {groupIndex === gIndex
						? 'bg-blue-600/40 ring-1 ring-inset ring-blue-500'
						: 'hover:bg-gray-700/60'}"
					on:mouseenter={() => (groupIndex = gIndex)}
				>
					<button
						type="button"
						class="flex-1 truncate text-left text-sm"
						on:click={() => pickVariant(gIndex, 0)}
					>
						{group.name}
					</button>

					<span class="flex flex-none items-center gap-1">
						{#each group.variants as variant, vIndex (variant.cardIdentifier)}
							<button
								type="button"
								title={variant.pitch ? `Pitch ${variant.pitch}` : variant.typeText}
								aria-label={variant.pitch ? `${group.name} pitch ${variant.pitch}` : group.name}
								class="w-6 rounded border text-center text-[11px] font-mono leading-5 transition-colors {pitchColor(
									variant.pitch,
									groupIndex === gIndex && variantIndex === vIndex
								)}"
								on:mouseenter={() => {
									groupIndex = gIndex;
									variantIndex = vIndex;
								}}
								on:click|stopPropagation={() => pickVariant(gIndex, vIndex)}
							>
								{variant.pitch ?? '–'}
							</button>
						{/each}
					</span>

					{#if group.variants.some((v) => v.cardIdentifier === liveCard?.cardIdentifier)}
						<span class="flex-none text-[9px] font-bold text-green-400">LIVE</span>
					{/if}
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
				<span class="truncate text-gray-400">
					{previewCard.name}{previewCard.pitch ? ` (${previewCard.pitch})` : ''}
				</span>
			</div>
			<img
				src={previewUrl}
				alt={previewCard.name}
				class="w-full max-w-[26rem] rounded shadow-lg {isLive ? '' : 'opacity-70'}"
				on:error={handlePreviewImageError}
			/>
		</div>
	{/if}

	{#if error}
		<div class="text-xs text-red-400 mt-2">{error}</div>
	{/if}
</div>
