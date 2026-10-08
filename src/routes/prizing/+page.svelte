<script>
	import { onMount } from 'svelte';
	import { ref, onValue, update, set } from 'firebase/database';
	import { db } from '../../firebaseClient';
	import {
		PRIZING_PATH,
		EVENT_TYPES,
		DEFAULT_ROWS,
		eventType,
		normalizePrizing
	} from '$lib/prizing';

	// Set the prizing here; the overlay at /views/prizing draws it. The kind of
	// event decides the columns: Open Series events have AGE Open points, the
	// Players Championship does not.
	let type = 'open';
	let eventName = '';
	let rows = { open: [], championship: [] };
	let origin = '';

	$: current = eventType(type);
	$: table = rows[type] || [];

	onMount(() => {
		origin = window.location.origin;
		return onValue(ref(db, PRIZING_PATH), (snap) => {
			({ type, eventName, rows } = normalizePrizing(snap.val()));
		});
	});

	const save = (fields) => update(ref(db, PRIZING_PATH), fields);
	const saveCell = (i, field, value) => save({ [`rows/${type}/${i}/${field}`]: value });
	const saveRows = (list) => set(ref(db, `${PRIZING_PATH}/rows/${type}`), list);

	const addRow = () => saveRows([...table, { finish: '', prize: '', points: '' }]);
	const removeRow = (i) => saveRows(table.filter((_, k) => k !== i));
	const moveRow = (i, dir) => {
		const list = [...table];
		const j = i + dir;
		if (j < 0 || j >= list.length) return;
		[list[i], list[j]] = [list[j], list[i]];
		return saveRows(list);
	};
	const resetRows = () => {
		if (!confirm(`Put the ${current.label} table back to the reference values?`)) return;
		return saveRows(DEFAULT_ROWS[type].map((r) => ({ ...r })));
	};
</script>

<div class="min-h-screen bg-gray-950 text-white">
	<div class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
		<div class="mb-8 text-center">
			<h1 class="font-display text-3xl font-bold">Prizing</h1>
			<p class="mt-2 text-gray-400">The prizing breakdown, for the overlay.</p>
		</div>

		<!-- Which event -->
		<div class="mb-6 border border-gray-800 bg-gray-900/50 p-4">
			<span class="mb-2 block text-sm font-medium text-gray-300">Event</span>
			<div class="flex flex-wrap gap-2" role="group" aria-label="Kind of event">
				{#each EVENT_TYPES as t (t.kind)}
					<button
						type="button"
						aria-pressed={type === t.kind}
						on:click={() => save({ type: t.kind })}
						class="border px-4 py-2 text-sm font-medium transition-colors {type === t.kind
							? 'border-amber-500 bg-amber-500/20 text-amber-200'
							: 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'}"
					>
						{t.label}
					</button>
				{/each}
			</div>
			<div class="mt-4">
				<label for="prizing-name" class="mb-1 block text-sm font-medium text-gray-300"
					>Event name on the graphic</label
				>
				<input
					id="prizing-name"
					type="text"
					class="w-full border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					placeholder={current.name}
					bind:value={eventName}
					on:change={() => save({ eventName })}
				/>
				<p class="mt-1 text-xs text-gray-500">
					Left blank, the graphic says "{current.name}".
					{current.points ? 'This kind shows AGE Open points.' : 'This kind has no points column.'}
				</p>
			</div>
		</div>

		<!-- The table -->
		<div class="border border-gray-800 bg-gray-900/50 p-4">
			<div class="mb-3 flex items-baseline justify-between">
				<span class="text-[10px] font-medium uppercase tracking-wider text-blue-400"
					>{current.label} table</span
				>
				<button type="button" class="text-xs text-gray-400 hover:text-white" on:click={resetRows}>
					Reset to reference values
				</button>
			</div>
			<div
				class="mb-1 grid gap-2 text-[11px] font-medium uppercase tracking-wider text-gray-500 {current.points
					? 'grid-cols-[1fr_1.4fr_5rem_auto]'
					: 'grid-cols-[1fr_1.4fr_auto]'}"
			>
				<span>Finish</span><span>Prizing</span>{#if current.points}<span>Points</span>{/if}<span
				></span>
			</div>
			<div class="space-y-2">
				{#each table as row, i (i)}
					<div
						class="grid items-center gap-2 {current.points
							? 'grid-cols-[1fr_1.4fr_5rem_auto]'
							: 'grid-cols-[1fr_1.4fr_auto]'}"
					>
						<input
							type="text"
							aria-label="Finish, row {i + 1}"
							class="min-w-0 border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
							placeholder="3rd-4th"
							value={row.finish}
							on:change={(e) => saveCell(i, 'finish', e.currentTarget.value)}
						/>
						<input
							type="text"
							aria-label="Prizing, row {i + 1}"
							class="min-w-0 border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
							placeholder="$100"
							value={row.prize}
							on:change={(e) => saveCell(i, 'prize', e.currentTarget.value)}
						/>
						{#if current.points}
							<input
								type="text"
								aria-label="Points, row {i + 1}"
								class="min-w-0 border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
								placeholder="20"
								value={row.points}
								on:change={(e) => saveCell(i, 'points', e.currentTarget.value)}
							/>
						{/if}
						<div class="flex gap-1">
							<button
								type="button"
								aria-label="Move row {i + 1} up"
								class="h-9 w-8 border border-gray-700 bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30"
								disabled={i === 0}
								on:click={() => moveRow(i, -1)}>↑</button
							>
							<button
								type="button"
								aria-label="Move row {i + 1} down"
								class="h-9 w-8 border border-gray-700 bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30"
								disabled={i === table.length - 1}
								on:click={() => moveRow(i, 1)}>↓</button
							>
							<button
								type="button"
								aria-label="Remove row {i + 1}"
								class="h-9 w-8 border border-red-900/60 bg-red-950/40 text-red-200 hover:border-red-700"
								on:click={() => removeRow(i)}>✕</button
							>
						</div>
					</div>
				{/each}
			</div>
			<button
				type="button"
				class="mt-3 w-full border border-dashed border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
				on:click={addRow}
			>
				+ Add a row
			</button>
			<p class="mt-3 text-xs text-gray-500">
				Saved when you leave a box. A blank prize shows as a dash. Overlay:
				<a class="text-blue-400 hover:underline" href="/views/prizing">{origin}/views/prizing</a>, a
				1920×1080 browser source over the prizing scene.
			</p>
		</div>
	</div>
</div>
