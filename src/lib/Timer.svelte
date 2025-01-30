<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, set, onValue } from 'firebase/database';
	import { db } from '../firebaseClient';

	let displayTime = formatTime(0);
	let isPaused = true;
	let isCountingUp = false;
	let startTime = null;
	let remainingTime = 0;
	let inputTime = 55;
	let timerInterval;

	function formatTime(seconds) {
		const min = Math.floor(seconds / 60)
			.toString()
			.padStart(2, '0');
		const sec = (seconds % 60).toString().padStart(2, '0');
		return `${min}:${sec}`;
	}

	const calculateDisplayTime = () => {
		const now = Date.now();
		const elapsed = Math.floor((now - startTime) / 1000);

		if (isCountingUp) {
			displayTime = formatTime(remainingTime + elapsed);
		} else {
			const timeLeft = Math.max(0, remainingTime - elapsed);
			displayTime = formatTime(timeLeft);
		}
	};

	const startDisplayTimeInterval = () => {
		clearInterval(timerInterval);

		timerInterval = setInterval(() => {
			if (!isPaused) {
				calculateDisplayTime();
				syncDisplayTime(displayTime);
			}
		}, 1000);
	};

	const startTimer = async () => {
		if (!isPaused) return;

		startTime = Date.now();
		isPaused = false;

		await syncState();
		startDisplayTimeInterval();
	};

	const pauseTimer = async () => {
		if (isPaused) return;

		const now = Date.now();
		const elapsed = Math.floor((now - startTime) / 1000);
		remainingTime = isCountingUp ? remainingTime + elapsed : Math.max(0, remainingTime - elapsed);
		isPaused = true;

		clearInterval(timerInterval);

		await syncState();
	};

	const resetTimer = async () => {
		await pauseTimer();
		remainingTime = isCountingUp ? 0 : inputTime * 60;
		displayTime = formatTime(remainingTime);
		await syncDisplayTime(displayTime);
	};

	const setStartingTime = async (minutes) => {
		await resetTimer();
		remainingTime = isCountingUp ? 0 : minutes * 60;
		displayTime = formatTime(remainingTime);
		inputTime = minutes;
		await syncDisplayTime(displayTime);
		await startTimer();
	};

	const syncState = async () => {
		await syncRemainingTime(remainingTime);
		await syncIsPaused(isPaused);
		await syncStartTime(startTime);
		await syncIsCountingUp(isCountingUp);
	};

	const syncDisplayTime = async (time) => set(ref(db, 'timer/displayTime'), time);
	const syncRemainingTime = async (time) => set(ref(db, 'timer/remainingTime'), time);
	const syncIsPaused = async (paused) => set(ref(db, 'timer/isPaused'), paused);
	const syncStartTime = async (time) => set(ref(db, 'timer/startTime'), time);
	const syncIsCountingUp = async (countingUp) => set(ref(db, 'timer/isCountingUp'), countingUp);

	const updateFromDatabase = () => {
		onValue(ref(db, 'timer/startTime'), (snapshot) => {
			startTime = snapshot.val();
			if (startTime) {
				calculateDisplayTime(); // Calculate immediately based on the stored start time
				if (!isPaused) {
					startDisplayTimeInterval();
				}
			}
		});

		onValue(ref(db, 'timer/remainingTime'), (snapshot) => {
			remainingTime = snapshot.val() || remainingTime;
			if (isPaused) {
				displayTime = formatTime(remainingTime);
			}
		});

		onValue(ref(db, 'timer/isPaused'), (snapshot) => {
			isPaused = snapshot.val() !== null ? snapshot.val() : isPaused;

			// If the timer was running before refresh, start the interval
			if (!isPaused && startTime) {
				startDisplayTimeInterval();
			}
		});

		onValue(ref(db, 'timer/isCountingUp'), (snapshot) => {
			isCountingUp = snapshot.val() || false;
		});
	};

	const handleCheckboxChange = async (event) => {
		isCountingUp = event.target.checked;
		await resetTimer();
		await syncIsCountingUp(isCountingUp);
	};

	onMount(() => {
		updateFromDatabase();
	});
	onDestroy(() => clearInterval(timerInterval));
</script>

<div class="w-full mt-4 sm:mt-0 border p-4 border-gray-500 rounded-lg">
	<div class="text-center text-white text-4xl font-bold mb-4">{displayTime}</div>

	<div class="flex justify-around gap-4 mb-6">
		<button
			class="px-4 py-2 w-1/2 text-white rounded {isPaused
				? 'bg-green-500'
				: 'bg-yellow-500'} hover:bg-{isPaused ? 'green' : 'yellow'}-700"
			on:click={isPaused ? startTimer : pauseTimer}
		>
			{isPaused ? 'Start' : 'Pause'}
		</button>
		<button
			class="px-4 py-2 w-1/2 bg-gray-500 text-white rounded hover:bg-gray-700"
			on:click={resetTimer}
		>
			Reset
		</button>
	</div>

	<div class="flex flex-col sm:flex-row justify-center gap-4 mb-6">
		<input
			type="number"
			class="px-4 py-2 border rounded w-full sm:w-1/2"
			bind:value={inputTime}
			min="1"
			placeholder="Enter minutes"
		/>
		<button
			class="px-4 py-2 w-full sm:w-1/2 bg-green-500 text-white rounded hover:bg-green-700"
			on:click={() => setStartingTime(inputTime)}
		>
			Set Time
		</button>
	</div>

	<div class="flex justify-center mb-6">
		<label class="flex items-center space-x-3">
			<input
				type="checkbox"
				class="form-checkbox h-5 w-5 text-blue-600"
				bind:checked={isCountingUp}
				on:change={handleCheckboxChange}
			/>
			<span class="text-white font-medium">Count Up</span>
		</label>
	</div>

	<div class="grid grid-cols-2 gap-4">
		<button
			class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700"
			on:click={() => setStartingTime(55)}>55 min</button
		>
		<button
			class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700"
			on:click={() => setStartingTime(35)}>35 min</button
		>
		<button
			class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700"
			on:click={() => setStartingTime(10)}>10 min</button
		>
		<button
			class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700"
			on:click={() => setStartingTime(5)}>5 min</button
		>
		<button
			class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700"
			on:click={() => setStartingTime(2)}>2 min</button
		>
	</div>
</div>
