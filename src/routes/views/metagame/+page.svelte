<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';

	const PATH = 'metagame';

	let rows = [];
	let total = 0;

	function slugify(name) {
		return (name || '')
			.toLowerCase()
			.replace(/["',]/g, '')
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.trim();
	}
	function imgSrc(name) {
		return `/heroImages/${slugify(name)}.jpg`;
	}

	onMount(() => {
		const r = ref(db, PATH);
		const unsub = onValue(r, (snap) => {
			const val = snap.val() || {};
			rows = Object.entries(val).map(([id, v]) => ({
				id,
				name: v?.name || id,
				count: Number(v?.count) || 0
			}));
			total = rows.reduce((a, r) => a + (isFinite(r.count) ? r.count : 0), 0);
		});
		return () => unsub?.();
	});

	// Only show heroes with count > 0
	$: visible = [...rows].filter((r) => r.count > 0).sort((a, b) => (b.count || 0) - (a.count || 0));
	$: uniqueCount = visible.length;

	// Columns by rule
	$: colKey =
		uniqueCount <= 12
			? '4'
			: uniqueCount <= 15
				? '5'
				: uniqueCount <= 24
					? '6'
					: uniqueCount <= 32
						? '8'
						: uniqueCount <= 48
							? '12'
							: '12';

	const COLS_CLASSES = {
		'4': 'lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4',
		'5': 'lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5',
		'6': 'lg:grid-cols-6 xl:grid-cols-6 2xl:grid-cols-6',
		'8': 'lg:grid-cols-8 xl:grid-cols-8 2xl:grid-cols-8',
		'12': 'lg:grid-cols-12 xl:grid-cols-12 2xl:grid-cols-12'
	};
</script>

<div class="space-y-3 my-10">
	<div class="flex flex-wrap gap-6 text-gray-300 text-lg">
		<div>Unique Heroes: <span class="font-semibold text-white">{uniqueCount}</span></div>
		<div>Total Players: <span class="font-semibold text-white">{total}</span></div>
	</div>

	<div class={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 ${COLS_CLASSES[colKey]} gap-4`}>
		{#each visible as r (r.id)}
			<div class="relative group rounded-lg overflow-hidden">
				<!-- Count badge -->
				<div
					class="rounded-xl absolute bottom-10 left-2 z-10 px-3 py-2 bg-black/70 backdrop-blur text-yellow-400 text-4xl font-bold"
				>
					{r.count}
					{#if total > 0}
						<span class="text-white text-sm">({Math.round((r.count / total) * 100)}%)</span>
					{/if}
				</div>

				<!-- Image wrapper: taller if >24 heroes -->
				<div class={`w-full bg-gray-950 flex items-center justify-center`}>
					<img
						src={imgSrc(r.name)}
						alt={r.name}
						class="max-h-full w-auto object-contain"
						loading="lazy"
					/>
				</div>

				<!-- Label -->
				<div
					class={`px-2 py-2 text-center ${uniqueCount > 24 ? 'text-xs' : 'text-sm'} text-white bg-gray-800`}
				>
					{r.name}
				</div>
			</div>
		{/each}
	</div>
</div>
