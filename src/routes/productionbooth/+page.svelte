<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, set, onValue, get } from 'firebase/database';
	import { db } from '../../firebaseClient';
	import CardReader from '../../lib/CardReader.svelte';
	import MatchInfo from '../../lib/MatchInfo.svelte';
	import TableCard from '../../lib/TableCard.svelte';
	import CommentatorBooth from '../../lib/CommentatorBooth.svelte';

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

	function formatTime(seconds) {
		const m = Math.floor(Math.abs(seconds) / 60)
			.toString()
			.padStart(2, '0');
		const s = (Math.abs(seconds) % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	}

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
		timers[type].display = formatTime(currentTime);
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
		timers[type].display = formatTime(seconds);

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
						timers[type].display = formatTime(timers[type].remainingTime);
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
						timers[type].display = formatTime(snap.val());
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
		{ id: 'timers', label: 'Timers' },
		{ id: 'booth', label: 'Booth' }
	];
	let activeSection = 'cards';
</script>

<div class="min-h-screen bg-gray-950 text-white">
	<!-- Clocks stay pinned: an operator needs them regardless of what else is open -->
	<header class="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/95 backdrop-blur">
		<div class="mx-auto max-w-[110rem] px-2 py-2 sm:px-3">
			<div class="flex items-center gap-2">
				{#each [{ type: 'Round', accent: 'text-blue-400' }, { type: 'Break', accent: 'text-purple-400' }] as clock (clock.type)}
					<div class="flex flex-1 items-center gap-2 rounded-lg bg-gray-900 px-2 py-1.5">
						<div class="min-w-0">
							<div class="text-[9px] font-medium uppercase leading-none {clock.accent}">
								{clock.type}
							</div>
							<div
								class="font-mono text-xl font-bold tabular-nums leading-tight sm:text-2xl {timers[
									clock.type
								].isPaused
									? 'text-gray-400'
									: 'text-white'}"
							>
								{timers[clock.type].display}
							</div>
						</div>
						<button
							type="button"
							on:click={() => toggleTimer(clock.type)}
							aria-label="{timers[clock.type].isPaused ? 'Start' : 'Pause'} {clock.type} timer"
							class="ml-auto h-10 w-10 flex-none rounded-lg text-base font-medium transition-colors {timers[
								clock.type
							].isPaused
								? 'bg-green-600 hover:bg-green-500'
								: 'bg-yellow-600 hover:bg-yellow-500'}"
						>
							{timers[clock.type].isPaused ? '▶' : '⏸'}
						</button>
					</div>
				{/each}
			</div>

			<!-- Section switcher, small screens only -->
			<nav class="mt-2 grid grid-cols-4 gap-1 lg:hidden" aria-label="Sections">
				{#each sections as section (section.id)}
					<button
						type="button"
						aria-current={activeSection === section.id}
						on:click={() => (activeSection = section.id)}
						class="min-h-10 rounded-lg text-xs font-medium transition-colors {activeSection ===
						section.id
							? 'bg-blue-600 text-white'
							: 'bg-gray-900 text-gray-400 hover:bg-gray-800'}"
					>
						{section.label}
					</button>
				{/each}
			</nav>
		</div>
	</header>

	<main class="mx-auto max-w-[110rem] p-2 sm:p-3">
		<div class="grid gap-3 xl:grid-cols-[24rem_minmax(0,1fr)]">
			<!-- Card reader: its own column once there is room, pinned while the rest scrolls -->
			<aside
				class="{activeSection === 'cards'
					? 'block'
					: 'hidden'} lg:block xl:sticky xl:top-[5.5rem] xl:self-start"
			>
				<div class="rounded-xl border border-gray-800 bg-gray-900 p-3">
					<h2 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
						Card Reader
					</h2>
					<CardReader />
				</div>
			</aside>

			<div class="min-w-0 space-y-3">
				<!-- Tables: each card holds its own players, life and signals -->
				<div class="{activeSection === 'tables' ? 'block' : 'hidden'} space-y-3 lg:block">
					<div class="rounded-xl border border-gray-800 bg-gray-900 p-3">
						<h2 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
							Match Info
						</h2>
						<MatchInfo />
					</div>
					<div class="grid gap-3 2xl:grid-cols-2">
						<TableCard index={1} />
						<TableCard index={2} />
					</div>
				</div>

				<!-- Timer presets and mode; the clocks themselves live in the header -->
				<div class="{activeSection === 'timers' ? 'block' : 'hidden'} lg:block">
					<div class="rounded-xl border border-gray-800 bg-gray-900 p-3">
						<div class="mb-3 flex items-center justify-between">
							<h2 class="text-xs font-semibold uppercase tracking-wider text-gray-500">Timers</h2>
							<button
								type="button"
								on:click={toggleCountUp}
								class="min-h-10 rounded-lg px-2.5 text-[11px] font-medium transition-colors {timers
									.Round.isCountingUp
									? 'bg-blue-600 text-white'
									: 'bg-gray-800 text-gray-400 hover:bg-gray-700'}"
							>
								Round: {timers.Round.isCountingUp ? 'Counting up' : 'Counting down'}
							</button>
						</div>

						<div class="grid gap-3 sm:grid-cols-2">
							{#each [{ type: 'Round', presets: roundPresets, hover: 'hover:bg-blue-600', accent: 'text-blue-400' }, { type: 'Break', presets: breakPresets, hover: 'hover:bg-purple-600', accent: 'text-purple-400' }] as t (t.type)}
								<div class="space-y-1.5 rounded-lg bg-gray-800/40 p-2">
									<div class="text-[10px] font-semibold uppercase {t.accent}">{t.type}</div>
									<div class="flex flex-wrap items-center gap-1.5">
										{#if t.type === 'Round' && timers.Round.isCountingUp}
											<button
												type="button"
												on:click={() => setTimer('Round', 0)}
												class="min-h-11 flex-1 rounded-lg bg-gray-800 text-sm font-medium transition-colors {t.hover}"
												>Start</button
											>
										{:else}
											{#each t.presets as m (m)}
												<button
													type="button"
													on:click={() => setTimer(t.type, m)}
													class="min-h-11 flex-1 rounded-lg bg-gray-800 text-sm font-medium transition-colors {t.hover}"
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
											class="min-h-11 w-16 rounded-lg border border-gray-700 bg-gray-800 px-1.5 text-center text-sm [appearance:textfield] focus:border-blue-500 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
										/>
										<button
											type="button"
											on:click={() => resetTimer(t.type)}
											aria-label="Reset {t.type} timer"
											class="min-h-11 w-11 flex-none rounded-lg bg-gray-800 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
											>↺</button
										>
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>

				<!-- Commentators -->
				<div class="{activeSection === 'booth' ? 'block' : 'hidden'} lg:block">
					<div class="rounded-xl border border-gray-800 bg-gray-900 p-3">
						<CommentatorBooth />
					</div>
				</div>
			</div>
		</div>
	</main>
</div>
