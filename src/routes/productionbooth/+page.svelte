<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, set, onValue, get } from 'firebase/database';
	import { db } from '../../firebaseClient';
	import CardReader from '../../lib/CardReader.svelte';
	import PlayerInput from '../../lib/PlayerInput.svelte';
	import CommentatorBooth from '../../lib/CommentatorBooth.svelte';
	import { startSignalPayload, startSignalRemainingMs } from '$lib/startSignal';

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

	// Table 1 and Table 2 differ only in the Firebase paths they write to and
	// in how their start signal expires, so they share one config and one block
	// of markup. Accent classes are spelled out in full for the CSS purge pass.
	let tables = [
		{
			label: 'Table 1',
			lifePath: 'lifecounter',
			startSignalPath: 'timers/Round/startSignal',
			customSignalPath: 'timers/Round/customSignal',
			inputFocus: 'focus:border-red-500',
			sendClass: 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600',
			dismissClass: 'bg-red-500 hover:bg-red-400',
			life: { p1: 20, p2: 20 },
			startActive: false,
			customActive: false,
			customText: ''
		},
		{
			label: 'Table 2',
			lifePath: 'lifecounter2',
			startSignalPath: 'signals/table2/startSignal',
			customSignalPath: 'signals/table2/customSignal',
			inputFocus: 'focus:border-orange-500',
			sendClass:
				'bg-gradient-to-r from-orange-600 to-amber-700 hover:from-orange-500 hover:to-amber-600',
			dismissClass: 'bg-orange-500 hover:bg-orange-400',
			life: { p1: 20, p2: 20 },
			startActive: false,
			customActive: false,
			customText: ''
		}
	];

	// Presets
	const roundPresets = [55, 35];
	const breakPresets = [10, 5];

	// Timer intervals
	let timerIntervals = { Round: null, Break: null };

	// Pending start-signal expiries, one per table
	let startSignalTimers = [null, null];

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

	// Both tables publish the time the signal fired and let every reader expire
	// it, so closing this page mid-signal cannot leave one stuck on air. The
	// local flag is driven by the listener below rather than set here.
	async function triggerStartSignal(i) {
		await set(ref(db, tables[i].startSignalPath), startSignalPayload());
	}

	// Custom signal: a coloured overlay that stays up until dismissed.
	async function triggerCustomSignal(i) {
		const text = tables[i].customText.trim();
		if (!text) return;
		tables[i].customActive = true;
		await set(ref(db, tables[i].customSignalPath), { active: true, text });
	}

	async function dismissCustomSignal(i) {
		tables[i].customActive = false;
		await set(ref(db, tables[i].customSignalPath), { active: false, text: '' });
	}

	// Life functions
	async function adjustLife(i, player, delta) {
		tables[i].life[player] += delta;
		await set(ref(db, `${tables[i].lifePath}/${player}`), tables[i].life[player]);
	}

	async function resetLife(i, total) {
		tables[i].life.p1 = total;
		tables[i].life.p2 = total;
		await set(ref(db, `${tables[i].lifePath}/p1`), total);
		await set(ref(db, `${tables[i].lifePath}/p2`), total);
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

		tables.forEach((table, i) => {
			onValue(ref(db, table.startSignalPath), (snap) => {
				clearTimeout(startSignalTimers[i]);
				const remaining = startSignalRemainingMs(snap.val());
				tables[i].startActive = remaining > 0;
				if (remaining > 0) {
					startSignalTimers[i] = setTimeout(() => (tables[i].startActive = false), remaining);
				}
			});
			onValue(ref(db, `${table.lifePath}/p1`), (snap) => {
				if (snap.val() !== null) tables[i].life.p1 = snap.val();
			});
			onValue(ref(db, `${table.lifePath}/p2`), (snap) => {
				if (snap.val() !== null) tables[i].life.p2 = snap.val();
			});
			onValue(ref(db, table.customSignalPath), (snap) => {
				const data = snap.val();
				tables[i].customActive = data?.active ?? false;
				if (data?.text !== undefined) tables[i].customText = data.text ?? '';
			});
		});
	});

	onDestroy(() => {
		clearInterval(timerIntervals.Round);
		clearInterval(timerIntervals.Break);
		startSignalTimers.forEach(clearTimeout);
	});
</script>

<div class="mx-auto max-w-[110rem] p-2 sm:p-3">
	<!-- Card reader holds the left column on its own; every other control
	     stacks in the right column so the card preview never moves. -->
	<div
		class="grid gap-2 sm:gap-3 lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[26rem_minmax(0,1fr)]"
	>
		<!-- LEFT: Card Reader -->
		<aside class="lg:sticky lg:top-3 lg:self-start">
			<div class="rounded-lg border border-gray-800 bg-gray-900 p-3">
				<div class="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
					Card Reader
				</div>
				<CardReader />
			</div>
		</aside>

		<!-- RIGHT: everything else -->
		<div class="min-w-0 space-y-2 sm:space-y-3">
			<div class="grid gap-2 sm:gap-3 md:grid-cols-2 2xl:grid-cols-3">
				<!-- Timers -->
				<div class="rounded-lg border border-gray-800 bg-gray-900 p-2.5">
					<div class="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
						Timers
					</div>

					<!-- Round -->
					<div class="space-y-1.5">
						<div class="flex items-center justify-between">
							<span class="text-[10px] font-medium uppercase text-blue-400">Round</span>
							<button
								on:click={toggleCountUp}
								class="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors {timers.Round
									.isCountingUp
									? 'bg-blue-600 text-white'
									: 'bg-gray-800 text-gray-400 hover:bg-gray-700'}"
							>
								{timers.Round.isCountingUp ? 'Up' : 'Down'}
							</button>
						</div>
						<div class="flex items-center gap-2">
							<div
								class="flex-shrink-0 font-mono text-3xl font-bold tabular-nums tracking-tight {timers
									.Round.isPaused
									? 'text-gray-400'
									: 'text-white'}"
							>
								{timers.Round.display}
							</div>
							<button
								on:click={() => toggleTimer('Round')}
								class="ml-auto h-9 w-9 rounded-lg text-lg font-medium transition-colors {timers
									.Round.isPaused
									? 'bg-green-600 hover:bg-green-500'
									: 'bg-yellow-600 hover:bg-yellow-500'}"
							>
								{timers.Round.isPaused ? '▶' : '⏸'}
							</button>
							<button
								on:click={() => resetTimer('Round')}
								title="Reset round timer"
								class="h-9 w-9 rounded-lg bg-gray-800 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
							>
								↺
							</button>
						</div>
						<div class="flex items-center gap-1">
							{#if !timers.Round.isCountingUp}
								{#each roundPresets as m}
									<button
										on:click={() => setTimer('Round', m)}
										class="flex-1 rounded bg-gray-800 py-1 text-xs font-medium transition-colors hover:bg-blue-600"
										>{m}m</button
									>
								{/each}
							{:else}
								<button
									on:click={() => setTimer('Round', 0)}
									class="flex-1 rounded bg-gray-800 py-1 text-xs font-medium transition-colors hover:bg-blue-600"
									>Start</button
								>
							{/if}
							<input
								type="number"
								bind:value={customTime.Round}
								on:keydown={(e) => e.key === 'Enter' && setCustomTimer('Round')}
								placeholder="min"
								class="w-12 rounded border border-gray-700 bg-gray-800 px-1.5 py-1 text-center text-xs [appearance:textfield] focus:border-blue-500 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
							/>
						</div>
					</div>

					<div class="my-2 border-t border-gray-800"></div>

					<!-- Break -->
					<div class="space-y-1.5">
						<span class="text-[10px] font-medium uppercase text-purple-400">Break</span>
						<div class="flex items-center gap-2">
							<div
								class="flex-shrink-0 font-mono text-3xl font-bold tabular-nums tracking-tight {timers
									.Break.isPaused
									? 'text-gray-400'
									: 'text-white'}"
							>
								{timers.Break.display}
							</div>
							<button
								on:click={() => toggleTimer('Break')}
								class="ml-auto h-9 w-9 rounded-lg text-lg font-medium transition-colors {timers
									.Break.isPaused
									? 'bg-green-600 hover:bg-green-500'
									: 'bg-yellow-600 hover:bg-yellow-500'}"
							>
								{timers.Break.isPaused ? '▶' : '⏸'}
							</button>
							<button
								on:click={() => resetTimer('Break')}
								title="Reset break timer"
								class="h-9 w-9 rounded-lg bg-gray-800 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
							>
								↺
							</button>
						</div>
						<div class="flex items-center gap-1">
							{#each breakPresets as m}
								<button
									on:click={() => setTimer('Break', m)}
									class="flex-1 rounded bg-gray-800 py-1 text-xs font-medium transition-colors hover:bg-purple-600"
									>{m}m</button
								>
							{/each}
							<input
								type="number"
								bind:value={customTime.Break}
								on:keydown={(e) => e.key === 'Enter' && setCustomTimer('Break')}
								placeholder="min"
								class="w-12 rounded border border-gray-700 bg-gray-800 px-1.5 py-1 text-center text-xs [appearance:textfield] focus:border-purple-500 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
							/>
						</div>
					</div>
				</div>

				<!-- Tables: life counters and signals -->
				{#each tables as table, i (table.label)}
					<div class="overflow-hidden rounded-lg border border-gray-800 bg-gray-900 p-2.5">
						<div class="mb-2 flex flex-wrap items-center justify-between gap-1">
							<span class="text-[10px] font-medium uppercase tracking-wider text-gray-500">
								{table.label}
							</span>
							<div class="flex gap-1">
								<button
									on:click={() => resetLife(i, 20)}
									class="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] transition-colors hover:bg-gray-700"
									>20</button
								>
								<button
									on:click={() => resetLife(i, 40)}
									class="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] transition-colors hover:bg-gray-700"
									>40</button
								>
							</div>
						</div>

						<div class="flex items-center justify-center gap-1 sm:gap-2">
							{#each [{ key: 'p1', label: 'P1', accent: 'text-red-400' }, { key: 'p2', label: 'P2', accent: 'text-blue-400' }] as seat, seatIndex}
								{#if seatIndex === 1}
									<div class="flex-shrink-0 text-lg font-light text-gray-700">vs</div>
								{/if}
								<div class="flex items-center gap-1">
									<button
										on:click={() => adjustLife(i, seat.key, -1)}
										class="h-8 w-8 flex-shrink-0 rounded-lg bg-red-600/20 text-base font-bold text-red-400 transition-colors hover:bg-red-600 hover:text-white"
										>-</button
									>
									<div class="min-w-[2.5rem] text-center">
										<div class="font-mono text-2xl font-bold tabular-nums">
											{table.life[seat.key]}
										</div>
										<div class="text-[10px] font-medium uppercase {seat.accent}">{seat.label}</div>
									</div>
									<button
										on:click={() => adjustLife(i, seat.key, 1)}
										class="h-8 w-8 flex-shrink-0 rounded-lg bg-green-600/20 text-base font-bold text-green-400 transition-colors hover:bg-green-600 hover:text-white"
										>+</button
									>
								</div>
							{/each}
						</div>

						<button
							on:click={() => triggerStartSignal(i)}
							disabled={table.startActive}
							class="mt-2 w-full rounded-lg py-1.5 text-sm font-bold transition-all {table.startActive
								? 'animate-pulse cursor-not-allowed bg-green-500 text-white'
								: 'bg-gradient-to-r from-green-600 to-emerald-700 text-white hover:from-green-500 hover:to-emerald-600'}"
						>
							{table.startActive ? 'Signal Active...' : 'Signal Start'}
						</button>

						<div class="mt-2 border-t border-gray-800 pt-2">
							<div class="flex items-center gap-1">
								<input
									type="text"
									bind:value={table.customText}
									on:keydown={(e) => e.key === 'Enter' && triggerCustomSignal(i)}
									placeholder="Custom message..."
									disabled={table.customActive}
									class="min-w-0 flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs focus:outline-none disabled:opacity-50 {table.inputFocus}"
								/>
								{#if table.customActive}
									<button
										on:click={() => dismissCustomSignal(i)}
										class="flex-shrink-0 animate-pulse rounded px-2 py-1 text-xs font-bold text-white transition-colors {table.dismissClass}"
									>
										Dismiss
									</button>
								{:else}
									<button
										on:click={() => triggerCustomSignal(i)}
										disabled={!table.customText.trim()}
										class="flex-shrink-0 rounded px-2 py-1 text-xs font-bold transition-colors {table.customText.trim()
											? `${table.sendClass} text-white`
											: 'cursor-not-allowed bg-gray-800 text-gray-500'}"
									>
										Send
									</button>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Players & Commentators -->
			<div class="grid gap-2 sm:gap-3 xl:grid-cols-2">
				<div class="rounded-lg border border-gray-800 bg-gray-900 p-2.5">
					<PlayerInput />
				</div>
				<div class="rounded-lg border border-gray-800 bg-gray-900 p-2.5">
					<CommentatorBooth />
				</div>
			</div>
		</div>
	</div>
</div>
