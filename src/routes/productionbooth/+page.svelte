<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, set, onValue, get } from 'firebase/database';
	import { db } from '../../firebaseClient';
	import CardReader from '../../lib/CardReader.svelte';
	import MatchInfo from '../../lib/MatchInfo.svelte';
	import TableCard from '../../lib/TableCard.svelte';
	import CommentatorBooth from '../../lib/CommentatorBooth.svelte';
	import { formatTimerDisplay } from '$lib/timerDisplay';

	// Timer state with internal tracking
	let timers = {
		Round: {
			display: '00:00',
			isPaused: true,
			isCountingUp: false,
			remainingTime: 0,
			startTime: null
		},
		Break: { display: '00:00', isPaused: true, remainingTime: 0, startTime: null }
	};

	// Custom time inputs
	let customTime = { Round: null, Break: null };

	// Presets
	const roundPresets = [55, 35];
	const breakPresets = [10, 5];

	// Timer intervals
	let timerIntervals = { Round: null, Break: null };

	function getCurrentTime(type) {
		const timer = timers[type];
		if (!timer.startTime || timer.isPaused) {
			return timer.remainingTime;
		}

		const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
		const isCountingUp = type === 'Round' && timer.isCountingUp;

		if (isCountingUp) {
			return timer.remainingTime + elapsed;
		} else {
			return Math.max(0, timer.remainingTime - elapsed);
		}
	}

	function updateDisplay(type) {
		const currentTime = getCurrentTime(type);
		timers[type].display = formatTimerDisplay(type, currentTime);
		set(ref(db, `timers/${type}/displayTime`), timers[type].display);
	}

	function startTimerInterval(type) {
		clearInterval(timerIntervals[type]);
		// Immediately update display
		updateDisplay(type);
		// Then start interval
		timerIntervals[type] = setInterval(() => {
			if (!timers[type].isPaused) {
				updateDisplay(type);
			}
		}, 1000);
	}

	async function setTimer(type, minutes) {
		const isCountingUp = type === 'Round' && timers.Round.isCountingUp;
		const seconds = isCountingUp ? 0 : minutes * 60;

		timers[type].remainingTime = seconds;
		timers[type].startTime = Date.now();
		timers[type].isPaused = false;
		timers[type].display = formatTimerDisplay(type, seconds);

		await set(ref(db, `timers/${type}/remainingTime`), seconds);
		await set(ref(db, `timers/${type}/displayTime`), timers[type].display);
		await set(ref(db, `timers/${type}/isPaused`), false);
		await set(ref(db, `timers/${type}/startTime`), timers[type].startTime);
		if (type === 'Round') {
			await set(ref(db, `timers/${type}/isCountingUp`), isCountingUp);
		}

		startTimerInterval(type);
	}

	async function setCustomTimer(type) {
		const value = customTime[type];
		const minutes = typeof value === 'number' ? value : parseFloat(value);
		if (!minutes || isNaN(minutes) || minutes <= 0) return;
		await setTimer(type, minutes);
		customTime[type] = null;
	}

	async function toggleTimer(type) {
		const timer = timers[type];

		if (timer.isPaused) {
			// Resuming - set new start time
			timer.startTime = Date.now();
			timer.isPaused = false;
			await set(ref(db, `timers/${type}/startTime`), timer.startTime);
			await set(ref(db, `timers/${type}/isPaused`), false);
			startTimerInterval(type);
		} else {
			// Pausing - save current remaining time
			const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
			const isCountingUp = type === 'Round' && timer.isCountingUp;

			if (isCountingUp) {
				timer.remainingTime = timer.remainingTime + elapsed;
			} else {
				timer.remainingTime = Math.max(0, timer.remainingTime - elapsed);
			}

			timer.isPaused = true;
			clearInterval(timerIntervals[type]);

			await set(ref(db, `timers/${type}/remainingTime`), timer.remainingTime);
			await set(ref(db, `timers/${type}/isPaused`), true);
		}
	}

	async function resetTimer(type) {
		timers[type].isPaused = true;
		timers[type].remainingTime = 0;
		timers[type].display = '00:00';
		timers[type].startTime = null;

		clearInterval(timerIntervals[type]);

		await set(ref(db, `timers/${type}/isPaused`), true);
		await set(ref(db, `timers/${type}/remainingTime`), 0);
		await set(ref(db, `timers/${type}/displayTime`), '00:00');
	}

	async function toggleCountUp() {
		timers.Round.isCountingUp = !timers.Round.isCountingUp;
		await set(ref(db, 'timers/Round/isCountingUp'), timers.Round.isCountingUp);
		await resetTimer('Round');
	}

	// Sync from Firebase
	onMount(async () => {
		if (!db) return;

		// Initial fetch to restore timer state on page load
		for (const type of ['Round', 'Break']) {
			try {
				const snapshot = await get(ref(db, `timers/${type}`));
				const data = snapshot.val();
				if (data) {
					timers[type].remainingTime = data.remainingTime ?? 0;
					timers[type].startTime = data.startTime ?? null;
					timers[type].isPaused = data.isPaused ?? true;
					if (type === 'Round') {
						timers.Round.isCountingUp = data.isCountingUp ?? false;
					}

					// If timer was running, resume it
					if (!timers[type].isPaused && timers[type].startTime) {
						startTimerInterval(type);
					} else {
						timers[type].display = formatTimerDisplay(type, timers[type].remainingTime);
					}
				}
			} catch (err) {
				console.error(`Error fetching timer ${type}:`, err);
			}
		}

		// Set up real-time listeners for changes from other clients
		['Round', 'Break'].forEach((type) => {
			onValue(ref(db, `timers/${type}/isPaused`), (snap) => {
				if (snap.val() !== null) {
					const wasPaused = timers[type].isPaused;
					timers[type].isPaused = snap.val();

					if (!snap.val() && timers[type].startTime) {
						startTimerInterval(type);
					} else if (snap.val() && !wasPaused) {
						clearInterval(timerIntervals[type]);
						updateDisplay(type);
					}
				}
			});
			onValue(ref(db, `timers/${type}/remainingTime`), (snap) => {
				if (snap.val() !== null) {
					timers[type].remainingTime = snap.val();
					if (timers[type].isPaused) {
						timers[type].display = formatTimerDisplay(type, snap.val());
					}
				}
			});
			onValue(ref(db, `timers/${type}/startTime`), (snap) => {
				if (snap.val() !== null) {
					timers[type].startTime = snap.val();
					if (!timers[type].isPaused) {
						startTimerInterval(type);
					}
				}
			});
		});

		onValue(ref(db, 'timers/Round/isCountingUp'), (snap) => {
			if (snap.val() !== null) timers.Round.isCountingUp = snap.val();
		});
	});

	onDestroy(() => {
		clearInterval(timerIntervals.Round);
		clearInterval(timerIntervals.Break);
	});

	// Below lg the page shows one section at a time so a phone is not a long
	// scroll; from lg up every section is visible and this is ignored.
	const sections = [
		{ id: 'cards', label: 'Cards' },
		{ id: 'tables', label: 'Tables' },
		{ id: 'booth', label: 'Booth' }
	];
	let activeSection = 'cards';
</script>

<div class="min-h-screen bg-gray-950 text-white">
	<main class="mx-auto max-w-[110rem] p-1.5">
		<!-- Two columns: the card search owns the left one, everything else
		     stacks in the right. On a phone the grid collapses and the right
		     column comes first, so the clocks are not below the card search. -->
		<div
			class="grid gap-1.5 md:grid-cols-[17rem_minmax(0,1fr)] lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]"
		>
			<!-- LEFT: card search, nothing else -->
			<aside
				class="{activeSection === 'cards'
					? 'block'
					: 'hidden'} order-2 md:order-1 md:sticky md:top-1.5 md:block md:self-start"
			>
				<div class="rounded-lg border border-gray-800 bg-gray-900 p-2">
					<CardReader />
				</div>
			</aside>

			<!-- RIGHT: timers, round info/status, tables, commentators -->
			<div class="order-1 min-w-0 space-y-1.5 md:order-2">
				<!-- Timer row -->
				<div class="grid grid-cols-2 gap-1.5">
					{#each [{ type: 'Round', presets: roundPresets, accent: 'text-blue-400', hover: 'hover:bg-blue-600', focus: 'focus:border-blue-500' }, { type: 'Break', presets: breakPresets, accent: 'text-purple-400', hover: 'hover:bg-purple-600', focus: 'focus:border-purple-500' }] as t (t.type)}
						<div
							class="flex flex-wrap items-center gap-1 rounded-lg border border-gray-800 bg-gray-900 p-1.5"
						>
							<span class="text-[9px] font-semibold uppercase leading-none {t.accent}">
								{t.type}
							</span>
							<span
								class="font-mono text-2xl font-bold tabular-nums leading-none sm:text-3xl {timers[
									t.type
								].isPaused
									? 'text-gray-400'
									: 'text-white'}"
							>
								{timers[t.type].display}
							</span>
							<button
								type="button"
								on:click={() => toggleTimer(t.type)}
								aria-label="{timers[t.type].isPaused ? 'Start' : 'Pause'} {t.type} timer"
								class="h-8 w-8 flex-none rounded text-sm font-medium transition-colors {timers[
									t.type
								].isPaused
									? 'bg-green-600 hover:bg-green-500'
									: 'bg-yellow-600 hover:bg-yellow-500'}"
							>
								{timers[t.type].isPaused ? '▶' : '⏸'}
							</button>
							<button
								type="button"
								on:click={() => resetTimer(t.type)}
								aria-label="Reset {t.type} timer"
								class="h-8 w-8 flex-none rounded bg-gray-800 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
								>↺</button
							>

							<div class="flex flex-1 items-center gap-1">
								{#if t.type === 'Round'}
									<button
										type="button"
										on:click={toggleCountUp}
										aria-label="Round counts {timers.Round.isCountingUp ? 'up' : 'down'}"
										class="h-8 flex-none rounded px-1.5 text-[10px] font-medium transition-colors {timers
											.Round.isCountingUp
											? 'bg-blue-600 text-white'
											: 'bg-gray-800 text-gray-400 hover:bg-gray-700'}"
									>
										{timers.Round.isCountingUp ? 'Up' : 'Dn'}
									</button>
								{/if}
								{#if t.type === 'Round' && timers.Round.isCountingUp}
									<button
										type="button"
										on:click={() => setTimer('Round', 0)}
										class="h-8 max-w-20 flex-1 rounded bg-gray-800 text-[11px] font-medium transition-colors {t.hover}"
										>Start</button
									>
								{:else}
									{#each t.presets as m (m)}
										<button
											type="button"
											on:click={() => setTimer(t.type, m)}
											class="h-8 max-w-20 flex-1 rounded bg-gray-800 text-[11px] font-medium transition-colors {t.hover}"
											>{m}m</button
										>
									{/each}
								{/if}
								<input
									type="number"
									bind:value={customTime[t.type]}
									on:keydown={(e) => e.key === 'Enter' && setCustomTimer(t.type)}
									placeholder="min"
									aria-label="Custom {t.type} minutes"
									class="h-8 w-11 flex-none rounded border border-gray-700 bg-gray-800 px-0.5 text-center text-[11px] [appearance:textfield] focus:outline-none {t.focus} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
								/>
							</div>
						</div>
					{/each}
				</div>

				<!-- Round info / status row -->
				<div class="rounded-lg border border-gray-800 bg-gray-900 p-1.5">
					<MatchInfo />
				</div>

				<!-- Section switcher, small screens only -->
				<nav class="grid grid-cols-3 gap-1 md:hidden" aria-label="Sections">
					{#each sections as section (section.id)}
						<button
							type="button"
							aria-current={activeSection === section.id}
							on:click={() => (activeSection = section.id)}
							class="h-8 rounded text-[11px] font-medium transition-colors {activeSection ===
							section.id
								? 'bg-blue-600 text-white'
								: 'bg-gray-900 text-gray-400 hover:bg-gray-800'}"
						>
							{section.label}
						</button>
					{/each}
				</nav>

				<!-- Tables -->
				<div class="{activeSection === 'tables' ? 'block' : 'hidden'} space-y-1.5 md:block">
					<TableCard index={1} />
					<TableCard index={2} />
				</div>

				<!-- Commentators -->
				<div class="{activeSection === 'booth' ? 'block' : 'hidden'} md:block">
					<div class="rounded-lg border border-gray-800 bg-gray-900 p-2">
						<CommentatorBooth />
					</div>
				</div>
			</div>
		</div>
	</main>
</div>
