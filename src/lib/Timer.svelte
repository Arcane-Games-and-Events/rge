<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, set, onValue } from 'firebase/database';
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
		timerInterval = setInterval(() => {
			if (!isPaused) {
				calculateDisplayTime();
				set(getRef('displayTime'), displayTime);
			}
		}, 1000);
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
		await createInstance();
		updateFromDatabase();
	});
	onDestroy(() => clearInterval(timerInterval));

	function handleCheckboxChange(e) {
		isCountingUp = e.target.checked;
		resetTimer();
		set(getRef('isCountingUp'), isCountingUp);
	}
</script>

<div class="w-full border p-4 rounded-lg bg-gray-800 text-white">
	<p class="text-center text-2xl font-semibold">{typeOfCounter}</p>
	<div class="my-4 text-center text-5xl font-mono">{displayTime}</div>

	<div class="flex space-x-4 mb-4">
		<button
			on:click={isPaused ? startTimer : pauseTimer}
			class="flex-1 py-2 rounded
        {isPaused ? 'bg-green-500 hover:bg-green-600' : 'bg-yellow-500 hover:bg-yellow-600'}"
		>
			{isPaused ? 'Start' : 'Pause'}
		</button>
		<button on:click={resetTimer} class="flex-1 py-2 bg-gray-600 hover:bg-gray-700 rounded">
			Reset
		</button>
	</div>

	<div class="flex flex-col sm:flex-row gap-4 mb-4">
		<input
			type="number"
			class="flex-1 p-2 rounded text-black"
			bind:value={inputTime}
			min="1"
			placeholder="Minutes"
		/>
		<button
			on:click={() => setStartingTime(inputTime)}
			class="flex-1 py-2 bg-blue-500 hover:bg-blue-600 rounded"
		>
			Set Time
		</button>
	</div>

	<div class="flex items-center justify-center mb-4">
		<label class="flex items-center space-x-2">
			<input type="checkbox" bind:checked={isCountingUp} on:change={handleCheckboxChange} />
			<span>Count Up</span>
		</label>
	</div>

	<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
		{#each roundPresets as minutes}
			<button
				class="py-2 bg-indigo-500 hover:bg-indigo-600 rounded"
				on:click={() => setStartingTime(minutes)}
			>
				{minutes} min
			</button>
		{/each}
	</div>
</div>
