<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, set, onValue, get } from 'firebase/database';
	import { db } from '../../firebaseClient';
	import CardReader from '../../lib/CardReader.svelte';
	import PlayerInput from '../../lib/PlayerInput.svelte';
	import CommentatorBooth from '../../lib/CommentatorBooth.svelte';

	// Timer state with internal tracking
	let timers = {
		Round: { display: '00:00', isPaused: true, isCountingUp: false, remainingTime: 0, startTime: null },
		Break: { display: '00:00', isPaused: true, remainingTime: 0, startTime: null }
	};

	// Custom time inputs
	let customTime = { Round: null, Break: null };

	// Life counter state
	let life = { p1: 20, p2: 20 };
	let life2 = { p1: 20, p2: 20 }; // Table 2

	// Presets
	const roundPresets = [55, 35];
	const breakPresets = [10, 5];

	// Timer intervals
	let timerIntervals = { Round: null, Break: null };

	function formatTime(seconds) {
		const m = Math.floor(Math.abs(seconds) / 60).toString().padStart(2, '0');
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

	// Start signal for players
	let startSignalActive = false;

	async function triggerStartSignal() {
		startSignalActive = true;
		await set(ref(db, 'timers/Round/startSignal'), true);
		// Auto-dismiss after 10 seconds
		setTimeout(async () => {
			startSignalActive = false;
			await set(ref(db, 'timers/Round/startSignal'), false);
		}, 10000);
	}

	// Custom signal for players (red overlay, stays until dismissed)
	let customSignalActive = false;
	let customSignalText = '';

	async function triggerCustomSignal() {
		if (!customSignalText.trim()) return;
		customSignalActive = true;
		await set(ref(db, 'timers/Round/customSignal'), {
			active: true,
			text: customSignalText.trim()
		});
	}

	async function dismissCustomSignal() {
		customSignalActive = false;
		await set(ref(db, 'timers/Round/customSignal'), {
			active: false,
			text: ''
		});
	}

	// Table 2 signals (independent from Table 1)
	let startSignal2Active = false;
	let customSignal2Active = false;
	let customSignal2Text = '';

	async function triggerStartSignal2() {
		startSignal2Active = true;
		// Store timestamp so clients can auto-expire after 10 seconds
		await set(ref(db, 'signals/table2/startSignal'), {
			active: true,
			triggeredAt: Date.now()
		});
	}

	async function triggerCustomSignal2() {
		if (!customSignal2Text.trim()) return;
		customSignal2Active = true;
		await set(ref(db, 'signals/table2/customSignal'), {
			active: true,
			text: customSignal2Text.trim()
		});
	}

	async function dismissCustomSignal2() {
		customSignal2Active = false;
		await set(ref(db, 'signals/table2/customSignal'), {
			active: false,
			text: ''
		});
	}

	// Life functions - Table 1
	async function adjustLife(player, delta) {
		life[player] += delta;
		await set(ref(db, `lifecounter/${player}`), life[player]);
	}

	async function resetLife(total) {
		life.p1 = total;
		life.p2 = total;
		await set(ref(db, 'lifecounter/p1'), total);
		await set(ref(db, 'lifecounter/p2'), total);
	}

	// Life functions - Table 2
	async function adjustLife2(player, delta) {
		life2[player] += delta;
		await set(ref(db, `lifecounter2/${player}`), life2[player]);
	}

	async function resetLife2(total) {
		life2.p1 = total;
		life2.p2 = total;
		await set(ref(db, 'lifecounter2/p1'), total);
		await set(ref(db, 'lifecounter2/p2'), total);
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
		['Round', 'Break'].forEach(type => {
			onValue(ref(db, `timers/${type}/isPaused`), snap => {
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
			onValue(ref(db, `timers/${type}/remainingTime`), snap => {
				if (snap.val() !== null) {
					timers[type].remainingTime = snap.val();
					if (timers[type].isPaused) {
						timers[type].display = formatTime(snap.val());
					}
				}
			});
			onValue(ref(db, `timers/${type}/startTime`), snap => {
				if (snap.val() !== null) {
					timers[type].startTime = snap.val();
					if (!timers[type].isPaused) {
						startTimerInterval(type);
					}
				}
			});
		});

		onValue(ref(db, 'timers/Round/isCountingUp'), snap => {
			if (snap.val() !== null) timers.Round.isCountingUp = snap.val();
		});

		onValue(ref(db, 'timers/Round/startSignal'), snap => {
			startSignalActive = snap.val() ?? false;
		});

		onValue(ref(db, 'timers/Round/customSignal'), snap => {
			const data = snap.val();
			if (data) {
				customSignalActive = data.active ?? false;
				customSignalText = data.text ?? '';
			} else {
				customSignalActive = false;
			}
		});

		onValue(ref(db, 'lifecounter/p1'), snap => {
			if (snap.val() !== null) life.p1 = snap.val();
		});
		onValue(ref(db, 'lifecounter/p2'), snap => {
			if (snap.val() !== null) life.p2 = snap.val();
		});

		// Table 2 life counter listeners
		onValue(ref(db, 'lifecounter2/p1'), snap => {
			if (snap.val() !== null) life2.p1 = snap.val();
		});
		onValue(ref(db, 'lifecounter2/p2'), snap => {
			if (snap.val() !== null) life2.p2 = snap.val();
		});

		// Table 2 signal listeners
		onValue(ref(db, 'signals/table2/startSignal'), snap => {
			const data = snap.val();
			if (data && data.active && data.triggeredAt) {
				const elapsed = Date.now() - data.triggeredAt;
				if (elapsed < 10000) {
					startSignal2Active = true;
					// Auto-expire locally after remaining time
					setTimeout(() => {
						startSignal2Active = false;
					}, 10000 - elapsed);
				} else {
					startSignal2Active = false;
				}
			} else {
				startSignal2Active = false;
			}
		});
		onValue(ref(db, 'signals/table2/customSignal'), snap => {
			const data = snap.val();
			if (data) {
				customSignal2Active = data.active ?? false;
				customSignal2Text = data.text ?? '';
			} else {
				customSignal2Active = false;
			}
		});
	});

	onDestroy(() => {
		clearInterval(timerIntervals.Round);
		clearInterval(timerIntervals.Break);
	});
</script>

<div class="p-2 sm:p-4 max-w-6xl mx-auto space-y-2 sm:space-y-3">
	<!-- Timers & Life Row -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
		<!-- Combined Timers Card -->
		<div class="bg-gray-900 border border-gray-800 rounded-lg p-2 sm:p-3">
			<div class="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2">Timers</div>

			<!-- Round Timer Section -->
			<div class="space-y-1.5">
				<div class="flex items-center justify-between">
					<span class="text-[9px] sm:text-[10px] text-blue-400 uppercase font-medium">Round</span>
					<button
						on:click={toggleCountUp}
						class="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium transition-colors {timers.Round.isCountingUp ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}"
					>
						{timers.Round.isCountingUp ? 'Up' : 'Down'}
					</button>
				</div>
				<div class="flex items-center gap-2">
					<div class="text-2xl sm:text-3xl font-mono font-bold tabular-nums tracking-tight flex-shrink-0">
						{timers.Round.display}
					</div>
					<button
						on:click={() => toggleTimer('Round')}
						class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg text-base sm:text-lg font-medium transition-colors ml-auto {timers.Round.isPaused ? 'bg-green-600 hover:bg-green-500' : 'bg-yellow-600 hover:bg-yellow-500'}"
					>
						{timers.Round.isPaused ? '▶' : '⏸'}
					</button>
				</div>
				<div class="flex items-center gap-1">
					{#if !timers.Round.isCountingUp}
						{#each roundPresets as m}
							<button on:click={() => setTimer('Round', m)} class="flex-1 py-1 rounded text-[10px] sm:text-xs font-medium bg-gray-800 hover:bg-blue-600 transition-colors">{m}m</button>
						{/each}
					{:else}
						<button on:click={() => setTimer('Round', 0)} class="flex-1 py-1 rounded text-[10px] sm:text-xs font-medium bg-gray-800 hover:bg-blue-600 transition-colors">Start</button>
					{/if}
					<input
						type="number"
						bind:value={customTime.Round}
						on:keydown={(e) => e.key === 'Enter' && setCustomTimer('Round')}
						placeholder="min"
						class="w-12 py-1 px-1.5 rounded text-[10px] sm:text-xs text-center bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
					/>
				</div>
			</div>

			<!-- Divider -->
			<div class="border-t border-gray-800 my-2"></div>

			<!-- Break Timer Section -->
			<div class="space-y-1.5">
				<span class="text-[9px] sm:text-[10px] text-purple-400 uppercase font-medium">Break</span>
				<div class="flex items-center gap-2">
					<div class="text-2xl sm:text-3xl font-mono font-bold tabular-nums tracking-tight flex-shrink-0">
						{timers.Break.display}
					</div>
					<button
						on:click={() => toggleTimer('Break')}
						class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg text-base sm:text-lg font-medium transition-colors ml-auto {timers.Break.isPaused ? 'bg-green-600 hover:bg-green-500' : 'bg-yellow-600 hover:bg-yellow-500'}"
					>
						{timers.Break.isPaused ? '▶' : '⏸'}
					</button>
				</div>
				<div class="flex items-center gap-1">
					{#each breakPresets as m}
						<button on:click={() => setTimer('Break', m)} class="flex-1 py-1 rounded text-[10px] sm:text-xs font-medium bg-gray-800 hover:bg-purple-600 transition-colors">{m}m</button>
					{/each}
					<input
						type="number"
						bind:value={customTime.Break}
						on:keydown={(e) => e.key === 'Enter' && setCustomTimer('Break')}
						placeholder="min"
						class="w-12 py-1 px-1.5 rounded text-[10px] sm:text-xs text-center bg-gray-800 border border-gray-700 focus:border-purple-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
					/>
				</div>
			</div>
		</div>

		<!-- Life Counter & Signals - Table 1 -->
		<div class="bg-gray-900 border border-gray-800 rounded-lg p-2 sm:p-3 overflow-hidden">
			<div class="flex items-center justify-between mb-2 flex-wrap gap-1">
				<span class="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Table 1</span>
				<div class="flex gap-1">
					<button on:click={() => resetLife(20)} class="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] bg-gray-800 hover:bg-gray-700 transition-colors">20</button>
					<button on:click={() => resetLife(40)} class="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] bg-gray-800 hover:bg-gray-700 transition-colors">40</button>
				</div>
			</div>
			<div class="flex items-center justify-center gap-1 sm:gap-2">
				<!-- P1 -->
				<div class="flex items-center gap-1">
					<button on:click={() => adjustLife('p1', -1)} class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white font-bold text-sm sm:text-base transition-colors flex-shrink-0">-</button>
					<div class="text-center min-w-[2rem] sm:min-w-[2.5rem]">
						<div class="text-xl sm:text-2xl font-mono font-bold tabular-nums">{life.p1}</div>
						<div class="text-[8px] sm:text-[10px] text-red-400 uppercase font-medium">P1</div>
					</div>
					<button on:click={() => adjustLife('p1', 1)} class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white font-bold text-sm sm:text-base transition-colors flex-shrink-0">+</button>
				</div>
				<div class="text-gray-700 text-lg sm:text-xl font-light flex-shrink-0">vs</div>
				<!-- P2 -->
				<div class="flex items-center gap-1">
					<button on:click={() => adjustLife('p2', -1)} class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white font-bold text-sm sm:text-base transition-colors flex-shrink-0">-</button>
					<div class="text-center min-w-[2rem] sm:min-w-[2.5rem]">
						<div class="text-xl sm:text-2xl font-mono font-bold tabular-nums">{life.p2}</div>
						<div class="text-[8px] sm:text-[10px] text-blue-400 uppercase font-medium">P2</div>
					</div>
					<button on:click={() => adjustLife('p2', 1)} class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white font-bold text-sm sm:text-base transition-colors flex-shrink-0">+</button>
				</div>
			</div>

			<!-- Start Signal Button -->
			<button
				on:click={triggerStartSignal}
				disabled={startSignalActive}
				class="w-full mt-2 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all {startSignalActive
					? 'bg-green-500 text-white cursor-not-allowed animate-pulse'
					: 'bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white'}"
			>
				{startSignalActive ? 'Signal Active...' : 'Signal Start'}
			</button>

			<!-- Custom Signal -->
			<div class="mt-2 pt-2 border-t border-gray-800">
				<div class="flex items-center gap-1">
					<input
						type="text"
						bind:value={customSignalText}
						placeholder="Custom message..."
						disabled={customSignalActive}
						class="flex-1 min-w-0 py-1 px-2 rounded text-[10px] sm:text-xs bg-gray-800 border border-gray-700 focus:border-red-500 focus:outline-none disabled:opacity-50"
					/>
					{#if customSignalActive}
						<button
							on:click={dismissCustomSignal}
							class="px-2 py-1 rounded text-[10px] sm:text-xs font-bold bg-red-500 hover:bg-red-400 text-white animate-pulse transition-colors flex-shrink-0"
						>
							Dismiss
						</button>
					{:else}
						<button
							on:click={triggerCustomSignal}
							disabled={!customSignalText.trim()}
							class="px-2 py-1 rounded text-[10px] sm:text-xs font-bold transition-colors flex-shrink-0 {customSignalText.trim() ? 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}"
						>
							Send
						</button>
					{/if}
				</div>
			</div>
		</div>

		<!-- Life Counter & Signals - Table 2 -->
		<div class="bg-gray-900 border border-gray-800 rounded-lg p-2 sm:p-3 overflow-hidden">
			<div class="flex items-center justify-between mb-2 flex-wrap gap-1">
				<span class="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Table 2</span>
				<div class="flex gap-1">
					<button on:click={() => resetLife2(20)} class="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] bg-gray-800 hover:bg-gray-700 transition-colors">20</button>
					<button on:click={() => resetLife2(40)} class="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] bg-gray-800 hover:bg-gray-700 transition-colors">40</button>
				</div>
			</div>
			<div class="flex items-center justify-center gap-1 sm:gap-2">
				<!-- P1 -->
				<div class="flex items-center gap-1">
					<button on:click={() => adjustLife2('p1', -1)} class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white font-bold text-sm sm:text-base transition-colors flex-shrink-0">-</button>
					<div class="text-center min-w-[2rem] sm:min-w-[2.5rem]">
						<div class="text-xl sm:text-2xl font-mono font-bold tabular-nums">{life2.p1}</div>
						<div class="text-[8px] sm:text-[10px] text-red-400 uppercase font-medium">P1</div>
					</div>
					<button on:click={() => adjustLife2('p1', 1)} class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white font-bold text-sm sm:text-base transition-colors flex-shrink-0">+</button>
				</div>
				<div class="text-gray-700 text-lg sm:text-xl font-light flex-shrink-0">vs</div>
				<!-- P2 -->
				<div class="flex items-center gap-1">
					<button on:click={() => adjustLife2('p2', -1)} class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white font-bold text-sm sm:text-base transition-colors flex-shrink-0">-</button>
					<div class="text-center min-w-[2rem] sm:min-w-[2.5rem]">
						<div class="text-xl sm:text-2xl font-mono font-bold tabular-nums">{life2.p2}</div>
						<div class="text-[8px] sm:text-[10px] text-blue-400 uppercase font-medium">P2</div>
					</div>
					<button on:click={() => adjustLife2('p2', 1)} class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white font-bold text-sm sm:text-base transition-colors flex-shrink-0">+</button>
				</div>
			</div>

			<!-- Start Signal Button - Table 2 -->
			<button
				on:click={triggerStartSignal2}
				disabled={startSignal2Active}
				class="w-full mt-2 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all {startSignal2Active
					? 'bg-green-500 text-white cursor-not-allowed animate-pulse'
					: 'bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white'}"
			>
				{startSignal2Active ? 'Signal Active...' : 'Signal Start'}
			</button>

			<!-- Custom Signal - Table 2 -->
			<div class="mt-2 pt-2 border-t border-gray-800">
				<div class="flex items-center gap-1">
					<input
						type="text"
						bind:value={customSignal2Text}
						placeholder="Custom message..."
						disabled={customSignal2Active}
						class="flex-1 min-w-0 py-1 px-2 rounded text-[10px] sm:text-xs bg-gray-800 border border-gray-700 focus:border-orange-500 focus:outline-none disabled:opacity-50"
					/>
					{#if customSignal2Active}
						<button
							on:click={dismissCustomSignal2}
							class="px-2 py-1 rounded text-[10px] sm:text-xs font-bold bg-orange-500 hover:bg-orange-400 text-white animate-pulse transition-colors flex-shrink-0"
						>
							Dismiss
						</button>
					{:else}
						<button
							on:click={triggerCustomSignal2}
							disabled={!customSignal2Text.trim()}
							class="px-2 py-1 rounded text-[10px] sm:text-xs font-bold transition-colors flex-shrink-0 {customSignal2Text.trim() ? 'bg-gradient-to-r from-orange-600 to-amber-700 hover:from-orange-500 hover:to-amber-600 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}"
						>
							Send
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Main Controls Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
		<!-- Card Reader -->
		<div class="bg-gray-900 border border-gray-800 rounded-lg p-3">
			<div class="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-3">Card Reader</div>
			<CardReader />
		</div>

		<!-- Players & Commentators -->
		<div class="space-y-2">
			<PlayerInput />
			<CommentatorBooth />
		</div>
	</div>
</div>
