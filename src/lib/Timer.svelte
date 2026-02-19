<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, set, onValue, get } from 'firebase/database';
	import { db } from '../firebaseClient';

	// Props
	export let typeOfCounter; // e.g. "Round" or "Break"
	export let roundPresets = []; // minutes for quick-set buttons

	// Local state
	let displayTime = formatTime(0);
	let isPaused = true;
	let isCountingUp = false;
	let startTime = null;
	let remainingTime = 0;
	let inputTime = roundPresets[0] || 0;
	let timerInterval;

	// Compute base path & helper
	$: timerPath = `timers/${typeOfCounter}`;
	const getRef = (field) => ref(db, `${timerPath}/${field}`);

	// Helpers
	function formatTime(seconds) {
		const m = Math.floor(seconds / 60)
			.toString()
			.padStart(2, '0');
		const s = (seconds % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	}

	function calculateDisplayTime() {
		const now = Date.now();
		const elapsed = Math.floor((now - startTime) / 1000);
		if (isCountingUp) {
			displayTime = formatTime(remainingTime + elapsed);
		} else {
			const left = Math.max(0, remainingTime - elapsed);
			displayTime = formatTime(left);
		}
	}

	function startDisplayTimeInterval() {
		clearInterval(timerInterval);
		let lastWrittenTime = '';
		timerInterval = setInterval(() => {
			if (!isPaused) {
				calculateDisplayTime();
				// Only write to DB when the displayed value actually changes
				if (displayTime !== lastWrittenTime) {
					lastWrittenTime = displayTime;
					set(getRef('displayTime'), displayTime);
				}
			}
		}, 200);
	}

	async function startTimer() {
		if (!isPaused) return;
		startTime = Date.now();
		isPaused = false;
		await syncState();
		startDisplayTimeInterval();
	}

	async function pauseTimer() {
		if (isPaused) return;
		const now = Date.now();
		const elapsed = Math.floor((now - startTime) / 1000);
		remainingTime = isCountingUp ? remainingTime + elapsed : Math.max(0, remainingTime - elapsed);
		isPaused = true;
		clearInterval(timerInterval);
		await syncState();
	}

	async function resetTimer() {
		await pauseTimer();
		remainingTime = isCountingUp ? 0 : inputTime * 60;
		displayTime = formatTime(remainingTime);
		await set(getRef('displayTime'), displayTime);
	}

	async function setStartingTime(minutes) {
		await resetTimer();
		remainingTime = isCountingUp ? 0 : minutes * 60;
		inputTime = minutes;
		displayTime = formatTime(remainingTime);
		await set(getRef('displayTime'), displayTime);
		await startTimer();
	}

	async function syncState() {
		await set(getRef('remainingTime'), remainingTime);
		await set(getRef('isPaused'), isPaused);
		await set(getRef('startTime'), startTime);
		await set(getRef('isCountingUp'), isCountingUp);
	}

	function updateFromDatabase() {
		onValue(getRef('startTime'), (snap) => {
			const val = snap.val();
			if (val !== null) {
				startTime = val;
				if (!isPaused) startDisplayTimeInterval();
			}
		});
		onValue(getRef('remainingTime'), (snap) => {
			remainingTime = snap.val() ?? remainingTime;
			if (isPaused) displayTime = formatTime(remainingTime);
		});
		onValue(getRef('isPaused'), (snap) => {
			const val = snap.val();
			if (val !== null) {
				isPaused = val;
				if (!isPaused && startTime) startDisplayTimeInterval();
			}
		});
		onValue(getRef('isCountingUp'), (snap) => {
			isCountingUp = snap.val() ?? isCountingUp;
		});
		onValue(getRef('displayTime'), (snap) => {
			const dt = snap.val();
			if (dt != null) displayTime = dt;
		});
	}

	// Create a fresh timer instance in DB
	async function createInstance() {
		await set(ref(db, timerPath), {
			displayTime: formatTime(0),
			remainingTime: 0,
			isPaused: true,
			startTime: null,
			isCountingUp: false
		});
	}

	// Lifecycle
	onMount(async () => {
		const snapshot = await get(ref(db, timerPath));
		if (!snapshot.exists()) {
			await createInstance();
		}
		updateFromDatabase();
	});

	onDestroy(() => clearInterval(timerInterval));

	function handleCheckboxChange(e) {
		isCountingUp = e.target.checked;
		resetTimer();
		set(getRef('isCountingUp'), isCountingUp);
	}

	// Start signal for players
	let startSignalActive = false;

	async function triggerStartSignal() {
		startSignalActive = true;
		await set(getRef('startSignal'), true);
		// Auto-dismiss after 3 seconds
		setTimeout(async () => {
			startSignalActive = false;
			await set(getRef('startSignal'), false);
		}, 3000);
	}

	// Listen for start signal state
	onValue(getRef('startSignal'), (snap) => {
		startSignalActive = snap.val() ?? false;
	});
</script>

<div class="space-y-4 text-white">
	<div class="text-center">
		<div class="inline-block rounded-lg border border-gray-700 bg-gray-800 px-6 py-4">
			<p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{typeOfCounter}</p>
			<div class="text-5xl font-display font-bold tabular-nums">{displayTime}</div>
		</div>
	</div>

	<div class="flex gap-3">
		<button
			on:click={isPaused ? startTimer : pauseTimer}
			class="flex-1 py-2.5 rounded-lg font-medium transition-all {isPaused ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500' : 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500'}"
		>
			{isPaused ? 'Start' : 'Pause'}
		</button>
		<button on:click={resetTimer} class="flex-1 py-2.5 rounded-lg border border-gray-700 bg-gray-800 font-medium text-gray-300 transition-all hover:border-gray-600 hover:bg-gray-700">
			Reset
		</button>
	</div>

	<div class="flex gap-3">
		<input
			type="number"
			class="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white placeholder:text-gray-500 transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
			bind:value={inputTime}
			min="1"
			placeholder="Minutes"
		/>
		<button
			on:click={() => setStartingTime(inputTime)}
			class="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 font-medium transition-all hover:from-blue-400 hover:to-purple-500"
		>
			Set Time
		</button>
	</div>

	<div class="flex items-center justify-center">
		<label class="flex items-center gap-2 cursor-pointer">
			<input type="checkbox" bind:checked={isCountingUp} on:change={handleCheckboxChange} class="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900" />
			<span class="text-sm text-gray-300">Count Up</span>
		</label>
	</div>

	<div class="grid grid-cols-3 gap-2">
		{#each roundPresets as minutes}
			<button
				class="py-2 rounded-lg border border-gray-700 bg-gray-800 text-sm font-medium text-gray-300 transition-all hover:border-blue-500 hover:text-blue-400"
				on:click={() => setStartingTime(minutes)}
			>
				{minutes} min
			</button>
		{/each}
	</div>

	<!-- Start Signal Button -->
	<button
		on:click={triggerStartSignal}
		disabled={startSignalActive}
		class="w-full py-3 rounded-lg font-bold text-lg transition-all {startSignalActive
			? 'bg-green-500 text-white cursor-not-allowed'
			: 'bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white'}"
	>
		{startSignalActive ? 'Signal Active...' : 'Signal Players to Start'}
	</button>
</div>
