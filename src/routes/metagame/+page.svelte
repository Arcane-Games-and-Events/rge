<script>
	import { onMount, tick } from 'svelte';
	import { ref, onValue, update, set } from 'firebase/database';
	import { db } from '../../firebaseClient';
	import heroes from '$lib/data/heroes.json';

	const PATH = 'metagame';

	let rows = []; // [{ id, name, count }]
	let filter = '';
	let hideZero = false;

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
		rows = heroes
			.map((h) => {
				const id = slugify(h.name);
				const existing = existingMap[id];
				return { id, name: h.name, count: Number(existing?.count ?? 0) };
			})
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	onMount(() => {
		const r = ref(db, PATH);
		const unsub = onValue(r, (snap) => {
			const val = snap.val() || {};
			seedFromHeroes(val);
		});
		return () => unsub?.();
	});

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

	function imgSrc(name) {
		return `/heroImages/${slugify(name)}.jpg`;
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
</script>

<div class="p-3 sm:p-4 max-w-6xl mx-auto space-y-3">
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
					<img
						src={imgSrc(r.name)}
						alt={r.name}
						class="h-8 w-8 flex-none rounded object-cover"
						loading="lazy"
					/>
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
