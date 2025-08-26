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

<!-- Sticky, minimal header -->
<div class="sticky top-0 z-20 bg-gray-900/90 backdrop-blur px-3 py-2 border-b border-gray-800">
	<div class="flex items-center gap-2">
		<div class="text-white font-semibold text-sm">Metagame Manager</div>
		<div class="ml-auto flex items-center gap-2">
			<input
				class="px-2 py-1 text-sm rounded bg-gray-800 text-white w-48"
				placeholder="Filter heroes…"
				bind:value={filter}
			/>
			<label class="flex items-center gap-1 text-xs text-gray-300 select-none">
				<input type="checkbox" bind:checked={hideZero} class="accent-blue-500" />
				hide zeroes
			</label>
			<button
				class="px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
				on:click={saveAll}
				type="button"
			>
				Save All
			</button>
			<button
				class="px-2 py-1 rounded bg-gray-700 text-white text-xs hover:bg-gray-600"
				on:click={resetAll}
				type="button"
			>
				Reset All
			</button>
			<div class="text-xs text-gray-300 ml-2">
				Total: <span class="text-white font-semibold">{total}</span>
			</div>
		</div>
	</div>
</div>

<!-- Dense grid: more columns, tighter cards -->
<div
	class="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2"
>
	{#each list as r, i (r.id)}
		<div class="flex items-center gap-2 p-2 rounded border border-gray-800 bg-gray-900">
			<img
				src={imgSrc(r.name)}
				alt={r.name}
				class="w-8 h-8 rounded object-cover flex-none"
				loading="lazy"
			/>
			<div class="truncate text-xs text-gray-200 flex-1" title={r.name}>{r.name}</div>

			<div class="flex items-center gap-1">
				<button
					class="px-2 py-1 rounded bg-gray-800 text-white text-xs"
					on:click={() => step(i, -1)}
					type="button"
					aria-label="decrement">−</button
				>

				<input
					class="w-14 px-2 py-1 rounded bg-gray-800 text-white text-right text-sm"
					bind:value={list[i].count}
					on:input={(e) =>
						setCount(
							rows.findIndex((x) => x.id === r.id),
							e.target.value
						)}
					on:keydown={(e) => onKey(e, i)}
					inputmode="numeric"
					data-idx={i}
				/>

				<button
					class="px-2 py-1 rounded bg-gray-800 text-white text-xs"
					on:click={() => step(i, +1)}
					type="button"
					aria-label="increment">+</button
				>
			</div>
		</div>
	{/each}
</div>
