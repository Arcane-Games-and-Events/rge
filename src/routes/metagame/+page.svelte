<script>
	import { onMount, tick } from 'svelte';
	import { ref, onValue, update, set } from 'firebase/database';
	import { db } from '../../firebaseClient';
	import { heroes, loadHeroes } from '$lib/heroes';

	const PATH = 'metagame';

	let rows = []; // [{ id, name, count }]
	let filter = '';
	let hideZero = false;

	// Quick-tally state
	let quickQuery = '';
	let quickHighlight = 0;
	let quickInputEl;
	let lastAdd = null; // { name, delta }
	let lastAddTimer = null;

	function slugify(name) {
		return (name || '')
			.toLowerCase()
			.replace(/["',]/g, '')
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.trim();
	}

	function seedFromHeroes(existingMap = {}) {
		rows = $heroes
			.map((h) => {
				const id = slugify(h.name);
				const existing = existingMap[id];
				return { id, name: h.name, image: h.image, count: Number(existing?.count ?? 0) };
			})
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	// Latest counts from Firebase, held so rows can be rebuilt when the hero
	// list finishes loading.
	let storedCounts = {};

	onMount(() => {
		loadHeroes();
		const r = ref(db, PATH);
		const unsub = onValue(r, (snap) => {
			storedCounts = snap.val() || {};
		});
		quickInputEl?.focus();
		return () => unsub?.();
	});

	// Rebuild rows once heroes are available, and again whenever counts change.
	$: if ($heroes.length) seedFromHeroes(storedCounts);

	// --- Compact editing helpers ---
	const timers = new Map(); // per-hero debounce

	function queueWrite(r) {
		const key = r.id;
		clearTimeout(timers.get(key));
		const t = setTimeout(() => {
			update(ref(db, `${PATH}/${key}`), { name: r.name, count: Math.max(0, Number(r.count) || 0) });
			timers.delete(key);
		}, 200);
		timers.set(key, t);
	}

	function setCount(idx, val) {
		const n = Math.max(0, parseInt(val || '0', 10) || 0);
		rows[idx].count = n;
		queueWrite(rows[idx]);
	}

	function step(idx, delta) {
		const next = Math.max(0, (rows[idx].count || 0) + delta);
		rows[idx].count = next;
		queueWrite(rows[idx]);
	}

	function flashAdd(name, delta) {
		lastAdd = { name, delta };
		clearTimeout(lastAddTimer);
		lastAddTimer = setTimeout(() => (lastAdd = null), 1500);
	}

	function quickAdd(delta) {
		const match = quickMatches[quickHighlight];
		if (!match) return;
		const idx = rows.findIndex((x) => x.id === match.id);
		if (idx < 0) return;
		// A numeric prefix like "4 katsu" overrides the default delta and Shift modifier.
		const effective = parsedQuick.count != null ? parsedQuick.count : delta;
		if (effective === 0) return;
		step(idx, effective);
		flashAdd(match.name, effective);
		// Keep the query so repeated Enter keeps tallying the same hero.
		// Select the text so the next keystroke replaces it for a new hero.
		quickInputEl?.select();
	}

	function onQuickKey(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			quickAdd(e.shiftKey ? 5 : 1);
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			quickHighlight = Math.min(quickMatches.length - 1, quickHighlight + 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			quickHighlight = Math.max(0, quickHighlight - 1);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			quickQuery = '';
			quickHighlight = 0;
		}
	}

	async function saveAll() {
		const payload = {};
		for (const r of rows)
			payload[r.id] = { name: r.name, count: Math.max(0, Number(r.count) || 0) };
		await update(ref(db, PATH), payload);
	}

	async function resetAll() {
		if (!confirm('Reset all counts to 0?')) return;
		const payload = {};
		for (const r of rows) payload[r.id] = { name: r.name, count: 0 };
		await set(ref(db, PATH), payload);
	}

	// Keyboard niceties for quick entry
	function onKey(e, idx) {
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			step(idx, +1);
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			step(idx, -1);
		} else if (e.key === 'PageUp') {
			e.preventDefault();
			step(idx, +5);
		} else if (e.key === 'PageDown') {
			e.preventDefault();
			step(idx, -5);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			focusNext(idx);
		}
	}

	async function focusNext(idx) {
		await tick();
		const next = document.querySelector(`[data-idx="${idx + 1}"]`);
		if (next) next.focus();
	}

	// Derived: compact list to display
	$: list = rows
		.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()))
		.filter((r) => (hideZero ? r.count > 0 : true));

	$: total = rows.reduce((a, r) => a + (isFinite(r.count) ? r.count : 0), 0);

	// Parse an optional leading numeric prefix: "4 katsu" -> { count: 4, term: "katsu" }.
	$: parsedQuick = (() => {
		const m = quickQuery.match(/^\s*(\d+)\s+(.+?)\s*$/);
		if (m) return { count: parseInt(m[1], 10), term: m[2] };
		return { count: null, term: quickQuery.trim() };
	})();

	// Derived: top matches for the quick-tally bar.
	// Rank: prefix on any word > substring; cap at 6.
	$: quickMatches = (() => {
		const q = parsedQuick.term.toLowerCase();
		if (!q) return [];
		const starts = [];
		const includes = [];
		for (const r of rows) {
			const name = r.name.toLowerCase();
			const words = name.split(/[\s,]+/).filter(Boolean);
			if (name.startsWith(q) || words.some((w) => w.startsWith(q))) starts.push(r);
			else if (name.includes(q)) includes.push(r);
		}
		return [...starts, ...includes].slice(0, 6);
	})();

	$: if (quickHighlight >= quickMatches.length) quickHighlight = 0;
</script>

<div class="p-3 sm:p-4 max-w-6xl mx-auto space-y-3">
	<!-- Quick Tally Bar -->
	<div class="bg-gray-900 border border-gray-800 rounded-lg p-3">
		<div class="flex items-center justify-between mb-2">
			<div class="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Quick Tally</div>
			<div class="text-[10px] text-gray-500 hidden sm:block">
				<kbd class="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 font-mono">Enter</kbd> +1
				<kbd class="ml-1 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 font-mono">Shift+Enter</kbd> +5
				<kbd class="ml-1 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 font-mono">N name</kbd> +N
				<kbd class="ml-1 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 font-mono">↑↓</kbd> pick
				<kbd class="ml-1 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 font-mono">Esc</kbd> clear
			</div>
		</div>
		<div class="relative">
			<input
				bind:this={quickInputEl}
				bind:value={quickQuery}
				on:keydown={onQuickKey}
				placeholder='Type a hero name (e.g. "katsu") or "4 katsu" for +4...'
				class="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 transition-colors focus:border-blue-500 focus:outline-none"
				autocomplete="off"
				spellcheck="false"
			/>
			{#if lastAdd}
				<div class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-green-400">
					+{lastAdd.delta} {lastAdd.name}
				</div>
			{/if}
		</div>

		{#if quickMatches.length > 0}
			<ul class="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1" role="listbox">
				{#each quickMatches as m, i}
					<li
						class="flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer transition-colors {i === quickHighlight ? 'bg-blue-600/30 ring-1 ring-blue-500' : 'hover:bg-gray-800'}"
						role="option"
						aria-selected={i === quickHighlight}
						tabindex="-1"
						on:mouseenter={() => (quickHighlight = i)}
						on:click={() => {
							quickHighlight = i;
							quickAdd(1);
						}}
						on:keydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								quickHighlight = i;
								quickAdd(1);
							}
						}}
					>
						{#if m.image}
							<img src={m.image} alt="" class="h-6 w-6 flex-none rounded object-cover" loading="lazy" />
						{:else}
							<span class="flex h-6 w-6 flex-none items-center justify-center rounded bg-gray-700 text-[10px] font-bold text-gray-400">
								{m.name.charAt(0)}
							</span>
						{/if}
						<span class="flex-1 truncate text-xs text-white">{m.name}</span>
						<span class="font-mono text-xs tabular-nums text-gray-400">{m.count}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<!-- Header Card -->
	<div class="bg-gray-900 border border-gray-800 rounded-lg p-3">
		<div class="flex flex-col sm:flex-row sm:items-center gap-3">
			<!-- Search & Filter -->
			<div class="flex items-center gap-2 flex-1">
				<input
					class="flex-1 max-w-xs rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 transition-colors focus:border-blue-500 focus:outline-none"
					placeholder="Filter heroes..."
					bind:value={filter}
				/>
				<label class="flex cursor-pointer select-none items-center gap-2 text-xs text-gray-400 whitespace-nowrap">
					<input type="checkbox" bind:checked={hideZero} class="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500" />
					Hide 0
				</label>
			</div>

			<!-- Stats & Actions -->
			<div class="flex items-center gap-2 flex-wrap">
				<div class="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-800 text-sm">
					<span class="text-gray-500">Total:</span>
					<span class="font-mono font-bold text-blue-400 tabular-nums">{total}</span>
				</div>
				<div class="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-800 text-sm">
					<span class="text-gray-500">Heroes:</span>
					<span class="font-mono font-bold text-green-400 tabular-nums">{list.filter(r => r.count > 0).length}</span>
				</div>
				<button
					class="px-3 py-1.5 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
					on:click={saveAll}
					type="button"
				>
					Save All
				</button>
				<button
					class="px-3 py-1.5 rounded text-xs bg-gray-800 text-gray-400 hover:bg-red-600 hover:text-white transition-colors"
					on:click={resetAll}
					type="button"
				>
					Reset
				</button>
			</div>
		</div>
	</div>

	<!-- Hero Grid -->
	<div class="bg-gray-900 border border-gray-800 rounded-lg p-3">
		<div class="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-3">Heroes ({list.length})</div>
		<div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
			{#each list as r, i (r.id)}
				<div class="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-800/50 p-2 transition-colors hover:border-gray-700 hover:bg-gray-800 {r.count > 0 ? 'border-l-2 border-l-blue-500' : ''}">
					{#if r.image}
						<img
							src={r.image}
							alt={r.name}
							class="h-8 w-8 flex-none rounded object-cover"
							loading="lazy"
						/>
					{:else}
						<!-- No art on disk for this hero; a placeholder avoids a request that 404s. -->
						<span
							class="flex h-8 w-8 flex-none items-center justify-center rounded bg-gray-700 text-xs font-bold text-gray-400"
							title={r.name}
						>
							{r.name.charAt(0)}
						</span>
					{/if}
					<div class="min-w-0 flex-1">
						<div class="truncate text-xs font-medium text-white" title={r.name}>{r.name}</div>
					</div>

					<div class="flex items-center gap-0.5">
						<button
							class="w-7 h-7 rounded bg-gray-700 text-sm text-white transition-colors hover:bg-red-600"
							on:click={() => step(i, -1)}
							type="button"
							aria-label="decrement"
						>
							-
						</button>

						<input
							class="w-10 h-7 rounded border border-gray-700 bg-gray-900 text-center text-xs font-mono font-bold text-white focus:border-blue-500 focus:outline-none"
							bind:value={list[i].count}
							on:input={(e) => setCount(rows.findIndex((x) => x.id === r.id), e.target.value)}
							on:keydown={(e) => onKey(e, i)}
							inputmode="numeric"
							data-idx={i}
						/>

						<button
							class="w-7 h-7 rounded bg-gray-700 text-sm text-white transition-colors hover:bg-green-600"
							on:click={() => step(i, +1)}
							type="button"
							aria-label="increment"
						>
							+
						</button>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
