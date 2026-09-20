<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, set, onValue } from 'firebase/database';
	import debounce from 'lodash.debounce';
	import { db } from '../../firebaseClient';
	import { heroes, loadHeroes } from '$lib/heroes';
	import { FLAG_COUNTRIES } from '$lib/flags';
	import { PRONOUN_OPTIONS } from '$lib/pronouns';
	import { CHOICE_PATH, CHOICES, toChoice } from '$lib/choice';
	import 'flag-icons/css/flag-icons.min.css';
	import '$lib/flagOverrides.css';

	// The judge's page for Table 1, reached from a phone by the QR code on
	// /judge/qr. It edits the same records the booth's Table 1 card does -- the
	// players, their life totals, and who chose to play first or second -- laid
	// out for a thumb rather than a mouse: one column, large targets, life first
	// because that is what changes during a game. The layout leaves the menu bar
	// off this route so nothing else is a tap away.
	const PLAYER_PATH = 'playerInfo';
	const LIFE_PATH = 'lifecounter';

	const seats = [
		{ id: 'p1', label: 'P1', text: 'text-red-400', ring: 'border-red-500/40' },
		{ id: 'p2', label: 'P2', text: 'text-blue-400', ring: 'border-blue-500/40' }
	];

	const blankSeat = () => ({
		name: '',
		record: '',
		hero: '',
		flag: '',
		pronouns: '',
		query: '',
		open: false,
		matches: []
	});

	let players = { p1: blankSeat(), p2: blankSeat() };
	let life = { p1: 20, p2: 20 };
	let choice = '';
	let ready = false;

	// One debounce per field, as on the booth: sharing one would let a second
	// field edited inside the same window swallow the first field's write.
	const writers = new Map();

	function write(path, value) {
		if (!writers.has(path)) {
			writers.set(
				path,
				debounce(async (latest) => {
					try {
						await set(ref(db, path), latest);
					} catch (err) {
						console.error(`Error saving ${path}:`, err);
					}
				}, 300)
			);
		}
		writers.get(path)(value);
	}

	const setField = (seatId, field, value) => {
		players[seatId][field] = value;
		write(`${PLAYER_PATH}/${seatId}/${field}`, value);
	};

	// --- Hero picker -------------------------------------------------------
	// Type a few letters and tap a match. The booth's picker also walks the list
	// with the arrow keys; on a phone there are none, so this one keeps to the tap.
	const MAX_MATCHES = 6;

	const filterHeroes = (seatId) => {
		const q = players[seatId].query.trim().toLowerCase();
		players[seatId].matches = q
			? $heroes.filter((h) => h.name.toLowerCase().includes(q)).slice(0, MAX_MATCHES)
			: [];
		players[seatId].open = players[seatId].matches.length > 0;
	};

	const pickHero = (seatId, hero) => {
		players[seatId].query = hero.name;
		players[seatId].open = false;
		setField(seatId, 'hero', hero.name);
	};

	const clearHero = (seatId) => {
		players[seatId].query = '';
		players[seatId].open = false;
		setField(seatId, 'hero', '');
	};

	const closePickers = (e) => {
		if (e.target.closest('.hero-box')) return;
		for (const seat of seats) players[seat.id].open = false;
	};

	// --- Life totals -------------------------------------------------------
	const saveLife = async (seatId, total) => {
		life[seatId] = Math.max(0, total);
		try {
			await set(ref(db, `${LIFE_PATH}/${seatId}`), life[seatId]);
		} catch (err) {
			console.error('Error saving a life total:', err);
		}
	};

	const adjustLife = (seatId, delta) => saveLife(seatId, life[seatId] + delta);

	const resetLife = (total) => {
		for (const seat of seats) saveLife(seat.id, total);
	};

	// Hold a button to keep counting: one step at once, then, after a beat, a
	// step every 120ms until the finger lifts. Pointer events cover touch and
	// mouse alike; the keyboard gets its single step from keydown.
	let hold = { timeout: null, interval: null };

	function startHold(seatId, delta) {
		stopHold();
		adjustLife(seatId, delta);
		hold.timeout = setTimeout(() => {
			hold.interval = setInterval(() => adjustLife(seatId, delta), 120);
		}, 400);
	}

	function stopHold() {
		clearTimeout(hold.timeout);
		clearInterval(hold.interval);
		hold = { timeout: null, interval: null };
	}

	function holdKey(e, seatId, delta) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		adjustLife(seatId, delta);
	}

	// Tap the total to type one in: a judge correcting a total after a dispute
	// wants to set the number, not tap toward it.
	let editing = null;
	let editValue = '';

	function startEdit(seatId) {
		editing = seatId;
		editValue = String(life[seatId]);
	}

	function finishEdit() {
		if (editing) {
			const next = parseInt(editValue, 10);
			if (!Number.isNaN(next)) saveLife(editing, next);
		}
		editing = null;
	}

	function editKey(e) {
		if (e.key === 'Enter') finishEdit();
		if (e.key === 'Escape') editing = null;
	}

	const focusOnMount = (node) => node.select();

	// --- Who chose ---------------------------------------------------------
	const saveChoice = async (next) => {
		choice = next;
		try {
			await set(ref(db, CHOICE_PATH), next);
		} catch (err) {
			console.error('Error saving the choice:', err);
		}
	};

	const pressChoice = (key) => saveChoice(choice === key ? '' : key);

	const unsubs = [];

	onMount(() => {
		loadHeroes();

		for (const seat of seats) {
			unsubs.push(
				onValue(ref(db, `${PLAYER_PATH}/${seat.id}`), (snap) => {
					const data = snap.val() || {};
					players[seat.id].name = data.name || '';
					players[seat.id].record = data.record || '';
					players[seat.id].hero = data.hero || '';
					players[seat.id].flag = data.flag || '';
					players[seat.id].pronouns = data.pronouns || '';
					if (!players[seat.id].open) players[seat.id].query = data.hero || '';
					ready = true;
				}),
				onValue(ref(db, `${LIFE_PATH}/${seat.id}`), (snap) => {
					if (snap.val() !== null) life[seat.id] = snap.val();
				})
			);
		}
		unsubs.push(onValue(ref(db, CHOICE_PATH), (snap) => (choice = toChoice(snap.val()))));

		document.addEventListener('click', closePickers);
	});

	onDestroy(() => {
		stopHold();
		for (const unsub of unsubs) unsub();
		if (typeof document !== 'undefined') document.removeEventListener('click', closePickers);
	});
</script>

<svelte:head>
	<title>Judge · Table 1</title>
</svelte:head>

<!-- Generous room under the last card, plus the phone's own bottom inset, so it
     never sits against the screen edge or under the home bar. -->
<div
	class="mx-auto max-w-md space-y-3 p-3 text-white"
	style="padding-bottom: calc(6rem + env(safe-area-inset-bottom, 0px));"
>
	<header class="flex items-baseline justify-between px-1">
		<h1 class="text-base font-bold">Table 1</h1>
		<span class="text-[10px] font-semibold uppercase tracking-wider text-purple-400">Judge</span>
	</header>

	<!-- Life -->
	<section class="rounded-xl border border-gray-800 bg-gray-900 p-2" aria-label="Life totals">
		<div class="grid grid-cols-2 gap-2">
			{#each seats as seat (seat.id)}
				<div class="space-y-2 rounded-lg border {seat.ring} bg-gray-800/40 p-2">
					<div class="flex items-baseline gap-1.5">
						<span class="text-[10px] font-bold uppercase {seat.text}">{seat.label}</span>
						<span class="min-w-0 truncate text-xs text-gray-300">
							{players[seat.id].name || '—'}
						</span>
					</div>

					{#if editing === seat.id}
						<input
							type="number"
							inputmode="numeric"
							aria-label="{seat.label} life total"
							bind:value={editValue}
							use:focusOnMount
							on:blur={finishEdit}
							on:keydown={editKey}
							class="h-16 w-full rounded border border-purple-500 bg-gray-900 text-center font-mono text-4xl font-bold tabular-nums text-white focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
						/>
					{:else}
						<button
							type="button"
							aria-label="{seat.label} life total {life[seat.id]}, tap to type"
							on:click={() => startEdit(seat.id)}
							class="h-16 w-full rounded bg-gray-900/70 font-mono text-5xl font-bold tabular-nums leading-none text-white"
						>
							{life[seat.id]}
						</button>
					{/if}

					<div class="grid grid-cols-2 gap-2">
						{#each [{ delta: -1, sign: '−', tone: 'bg-red-600/25 text-red-300 active:bg-red-600' }, { delta: 1, sign: '+', tone: 'bg-green-600/25 text-green-300 active:bg-green-600' }] as step (step.delta)}
							<button
								type="button"
								aria-label="{seat.label} life {step.delta < 0 ? 'down' : 'up'}"
								on:pointerdown|preventDefault={() => startHold(seat.id, step.delta)}
								on:pointerup={stopHold}
								on:pointercancel={stopHold}
								on:pointerleave={stopHold}
								on:keydown={(e) => holdKey(e, seat.id, step.delta)}
								on:contextmenu|preventDefault
								class="hold h-14 rounded text-3xl font-bold leading-none active:text-white {step.tone}"
							>
								{step.sign}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<div class="mt-2 grid grid-cols-2 gap-2">
			{#each [20, 40] as total (total)}
				<button
					type="button"
					on:click={() => resetLife(total)}
					class="h-11 rounded bg-gray-800 text-sm font-medium text-gray-300 active:bg-gray-700"
				>
					Reset both to {total}
				</button>
			{/each}
		</div>
	</section>

	<!-- Who chose -->
	<section class="rounded-xl border border-gray-800 bg-gray-900 p-2" aria-label="Who chose">
		<div class="mb-2 flex items-center justify-between px-1">
			<span class="text-[10px] font-semibold uppercase tracking-wider text-amber-400">Chose</span>
			<button
				type="button"
				on:click={() => saveChoice('')}
				disabled={!choice}
				class="h-8 rounded px-3 text-xs text-gray-400 active:bg-gray-700 disabled:text-gray-700"
			>
				Clear
			</button>
		</div>
		<div class="grid grid-cols-2 gap-2">
			{#each seats as seat (seat.id)}
				<div class="space-y-2">
					<div class="text-center text-[10px] font-bold uppercase {seat.text}">{seat.label}</div>
					{#each ['first', 'second'] as order (order)}
						{@const key = `${seat.id}-${order}`}
						<button
							type="button"
							aria-pressed={choice === key}
							aria-label={CHOICES[key].label}
							on:click={() => pressChoice(key)}
							class="h-12 w-full rounded text-sm font-semibold capitalize transition-colors {choice ===
							key
								? 'bg-amber-600 text-white'
								: 'bg-gray-800 text-gray-300 active:bg-gray-700'}"
						>
							{order}
						</button>
					{/each}
				</div>
			{/each}
		</div>
	</section>

	<!-- Players -->
	{#each seats as seat (seat.id)}
		<section
			class="space-y-2 rounded-xl border border-gray-800 bg-gray-900 p-2"
			aria-label="{seat.label} details"
		>
			<div class="px-1 text-[10px] font-bold uppercase tracking-wider {seat.text}">
				{seat.label}
			</div>

			<div class="flex gap-2">
				<input
					type="text"
					placeholder="Name"
					aria-label="{seat.label} name"
					autocomplete="off"
					autocapitalize="words"
					bind:value={players[seat.id].name}
					on:input={(e) => setField(seat.id, 'name', e.target.value)}
					class="h-12 min-w-0 flex-1 rounded border border-gray-700 bg-gray-800 px-3 text-base text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
				/>
				<input
					type="text"
					placeholder="0-0"
					aria-label="{seat.label} record"
					autocomplete="off"
					bind:value={players[seat.id].record}
					on:input={(e) => setField(seat.id, 'record', e.target.value)}
					class="h-12 w-20 flex-none rounded border border-gray-700 bg-gray-800 px-1 text-center font-mono text-base text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
				/>
			</div>

			<div class="hero-box relative">
				<input
					type="text"
					placeholder="Hero"
					aria-label="{seat.label} hero"
					role="combobox"
					aria-controls="judge-{seat.id}-heroes"
					aria-expanded={players[seat.id].open}
					autocomplete="off"
					bind:value={players[seat.id].query}
					on:input={() => filterHeroes(seat.id)}
					on:focus={() => filterHeroes(seat.id)}
					class="h-12 w-full rounded border border-gray-700 bg-gray-800 px-3 pr-10 text-base text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
				/>
				{#if players[seat.id].query}
					<button
						type="button"
						aria-label="Clear {seat.label} hero"
						on:click={() => clearHero(seat.id)}
						class="absolute right-0 top-0 h-12 w-10 text-gray-500 active:text-white">✕</button
					>
				{/if}
				{#if players[seat.id].open}
					<ul
						id="judge-{seat.id}-heroes"
						role="listbox"
						class="absolute z-20 mt-1 w-full overflow-hidden rounded border border-gray-700 bg-gray-900 shadow-xl"
					>
						{#each players[seat.id].matches as hero (hero.name)}
							<li role="option" aria-selected={hero.name === players[seat.id].hero}>
								<button
									type="button"
									on:click={() => pickHero(seat.id, hero)}
									class="flex h-12 w-full items-center gap-2 px-3 text-left text-sm text-gray-200 active:bg-purple-600/40"
								>
									{#if hero.image}
										<img src={hero.image} alt="" class="h-7 w-7 flex-none rounded object-cover" />
									{:else}
										<span
											class="flex h-7 w-7 flex-none items-center justify-center rounded bg-gray-700 text-[10px] font-bold text-gray-400"
										>
											{hero.name.charAt(0)}
										</span>
									{/if}
									<span class="truncate">{hero.name}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="flex gap-2">
				<label
					class="flex h-12 min-w-0 flex-1 items-center gap-2 rounded border border-gray-700 bg-gray-800 px-3"
				>
					<span class="flex h-5 w-7 flex-none items-center justify-center">
						{#if players[seat.id].flag}
							<span class="fi fi-{players[seat.id].flag}" style="font-size:18px"></span>
						{:else}
							<span class="text-xs text-gray-600">⚑</span>
						{/if}
					</span>
					<select
						aria-label="{seat.label} flag"
						bind:value={players[seat.id].flag}
						on:change={(e) => setField(seat.id, 'flag', e.target.value)}
						class="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-gray-200 focus:ring-0"
					>
						<option value="">No flag</option>
						{#each FLAG_COUNTRIES as country (country.code)}
							<option value={country.code}>{country.name}</option>
						{/each}
					</select>
				</label>
				<select
					aria-label="{seat.label} pronouns"
					bind:value={players[seat.id].pronouns}
					on:change={(e) => setField(seat.id, 'pronouns', e.target.value)}
					class="h-12 w-28 flex-none rounded border border-gray-700 bg-gray-800 px-2 text-sm text-gray-200 focus:border-purple-500 focus:ring-0"
				>
					<option value="">Pronouns</option>
					{#each PRONOUN_OPTIONS as option (option)}
						<option value={option}>{option}</option>
					{/each}
				</select>
			</div>
		</section>
	{/each}

	{#if !ready}
		<p class="text-center text-xs text-gray-500">Connecting…</p>
	{/if}
</div>

<style>
	/* A held button must not select text or raise the long-press menu, and a
	   double tap must not zoom. */
	.hold {
		touch-action: manipulation;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
</style>
