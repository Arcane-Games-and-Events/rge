<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, onValue, set } from 'firebase/database';
	import { db } from '../../../firebaseClient';
	import { startSignalRemainingMs } from '$lib/startSignal';

	let playerOneName = '';
	let playerTwoName = '';
	let player1Score = 0;
	let player2Score = 0;

	// Timer state from Firebase
	let timerStartTime = null;
	let timerRemainingTime = 0;
	let timerIsPaused = true;
	let timerIsCountingUp = false;
	let displayTime = '00:00';
	let timerInterval = null;

	// For mobile viewport height fix
	let viewportHeight = 0;

	// For editing life totals directly
	let editingPlayer = null;
	let editValue = '';

	// Orientation: 'right' = phone on right of play area (rotate clockwise), 'left' = phone on left (rotate counter-clockwise)
	let orientation = 'right';

	// Start signal overlay
	let showStartSignal = false;
	let startSignalTimer = null;

	// Custom signal overlay (red, stays until dismissed)
	let showCustomSignal = false;
	let customSignalText = '';

	function toggleOrientation() {
		orientation = orientation === 'right' ? 'left' : 'right';
	}

	// Timer calculation (runs independently of production booth)
	function formatTime(seconds) {
		const m = Math.floor(seconds / 60)
			.toString()
			.padStart(2, '0');
		const s = (seconds % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	}

	function calculateDisplayTime() {
		if (timerIsPaused) {
			displayTime = formatTime(timerRemainingTime);
		} else if (timerStartTime) {
			const now = Date.now();
			const elapsed = Math.floor((now - timerStartTime) / 1000);
			if (timerIsCountingUp) {
				displayTime = formatTime(timerRemainingTime + elapsed);
			} else {
				const left = Math.max(0, timerRemainingTime - elapsed);
				displayTime = formatTime(left);
			}
		}
	}

	function startTimerInterval() {
		if (timerInterval) clearInterval(timerInterval);
		timerInterval = setInterval(calculateDisplayTime, 1000);
		calculateDisplayTime();
	}

	// Update a player's life total in Firebase (Table 2)
	async function updateScore(player, newScore) {
		const clampedScore = Math.max(0, newScore);
		if (player === 'player1') {
			player1Score = clampedScore;
			await set(ref(db, 'lifecounter2/p1'), clampedScore);
		} else {
			player2Score = clampedScore;
			await set(ref(db, 'lifecounter2/p2'), clampedScore);
		}
	}

	// Adjust score by delta
	function adjustScore(player, delta) {
		const current = player === 'player1' ? player1Score : player2Score;
		updateScore(player, current + delta);
	}

	// Start editing a life total
	function startEdit(player) {
		editingPlayer = player;
		editValue = player === 'player1' ? player1Score.toString() : player2Score.toString();
	}

	// Confirm the edit
	function confirmEdit() {
		if (editingPlayer) {
			const newValue = parseInt(editValue, 10);
			if (!isNaN(newValue)) {
				updateScore(editingPlayer, newValue);
			}
		}
		editingPlayer = null;
		editValue = '';
	}

	// Cancel editing
	function cancelEdit() {
		editingPlayer = null;
		editValue = '';
	}

	// Handle keyboard events in edit mode
	function handleEditKeydown(e) {
		if (e.key === 'Enter') {
			confirmEdit();
		} else if (e.key === 'Escape') {
			cancelEdit();
		}
	}

	// Hold to repeat functionality
	let holdInterval = null;

	function startHold(player, delta) {
		adjustScore(player, delta);
		holdInterval = setInterval(() => {
			adjustScore(player, delta);
		}, 150);
	}

	function stopHold() {
		if (holdInterval) {
			clearInterval(holdInterval);
			holdInterval = null;
		}
	}

	onMount(() => {
		viewportHeight = window.innerHeight;

		// Subscribe to names (Table 2)
		onValue(ref(db, 'playerInfo2/p1/name'), (snap) => {
			playerOneName = snap.val() ?? '';
		});
		onValue(ref(db, 'playerInfo2/p2/name'), (snap) => {
			playerTwoName = snap.val() ?? '';
		});

		// Subscribe to life totals (Table 2)
		onValue(ref(db, 'lifecounter2/p1'), (snap) => {
			const v = snap.val();
			if (v != null) player1Score = v;
		});
		onValue(ref(db, 'lifecounter2/p2'), (snap) => {
			const v = snap.val();
			if (v != null) player2Score = v;
		});

		// Subscribe to timer state (calculate display time locally)
		onValue(ref(db, 'timers/Round/startTime'), (snap) => {
			timerStartTime = snap.val();
			calculateDisplayTime();
		});
		onValue(ref(db, 'timers/Round/remainingTime'), (snap) => {
			timerRemainingTime = snap.val() ?? 0;
			calculateDisplayTime();
		});
		onValue(ref(db, 'timers/Round/isPaused'), (snap) => {
			timerIsPaused = snap.val() ?? true;
			calculateDisplayTime();
		});
		onValue(ref(db, 'timers/Round/isCountingUp'), (snap) => {
			timerIsCountingUp = snap.val() ?? false;
			calculateDisplayTime();
		});

		// Subscribe to start signal (Table 2). The signal expires from its own
		// timestamp, so a booth that closed mid-signal cannot pin it on air.
		onValue(ref(db, 'signals/table2/startSignal'), (snap) => {
			clearTimeout(startSignalTimer);
			const remaining = startSignalRemainingMs(snap.val());
			showStartSignal = remaining > 0;
			if (remaining > 0) {
				startSignalTimer = setTimeout(() => (showStartSignal = false), remaining);
			}
		});

		// Subscribe to custom signal (Table 2)
		onValue(ref(db, 'signals/table2/customSignal'), (snap) => {
			const data = snap.val();
			if (data) {
				showCustomSignal = data.active ?? false;
				customSignalText = data.text ?? '';
			} else {
				showCustomSignal = false;
				customSignalText = '';
			}
		});

		// Start local timer interval
		startTimerInterval();
	});

	onDestroy(() => {
		stopHold();
		if (timerInterval) clearInterval(timerInterval);
	});

	$: rotationClass = orientation === 'right' ? 'rotate-90' : '-rotate-90';
</script>

<svelte:window on:resize={() => (viewportHeight = window.innerHeight)} />

<div class="scorekeeper-container" style="height: {viewportHeight}px;">
	<!-- Player 1 Panel (top) -->
	<div class="player-panel p1-panel">
		<div class="player-content {rotationClass}">
			<!-- Player name -->
			<div class="player-name-section">
				<span class="player-label">P1</span>
				<span class="player-name">{playerOneName || 'Player 1'}</span>
			</div>

			<!-- Life Total -->
			<div class="life-total-wrapper">
				{#if editingPlayer === 'player1'}
					<input
						type="number"
						class="life-input"
						bind:value={editValue}
						on:keydown={handleEditKeydown}
						on:blur={confirmEdit}
						autofocus
					/>
				{:else}
					<button class="life-total" on:click={() => startEdit('player1')}>
						{player1Score}
					</button>
				{/if}
			</div>

			<!-- 2x2 Button Grid -->
			<div class="button-grid">
				<button
					class="life-btn"
					on:mousedown={() => startHold('player1', -5)}
					on:mouseup={stopHold}
					on:mouseleave={stopHold}
					on:touchstart|preventDefault={() => startHold('player1', -5)}
					on:touchend={stopHold}
				>
					-5
				</button>
				<button
					class="life-btn"
					on:mousedown={() => startHold('player1', 5)}
					on:mouseup={stopHold}
					on:mouseleave={stopHold}
					on:touchstart|preventDefault={() => startHold('player1', 5)}
					on:touchend={stopHold}
				>
					+5
				</button>
				<button
					class="life-btn"
					on:mousedown={() => startHold('player1', -1)}
					on:mouseup={stopHold}
					on:mouseleave={stopHold}
					on:touchstart|preventDefault={() => startHold('player1', -1)}
					on:touchend={stopHold}
				>
					−
				</button>
				<button
					class="life-btn"
					on:mousedown={() => startHold('player1', 1)}
					on:mouseup={stopHold}
					on:mouseleave={stopHold}
					on:touchstart|preventDefault={() => startHold('player1', 1)}
					on:touchend={stopHold}
				>
					+
				</button>
			</div>
		</div>
	</div>

	<!-- Center Timer Strip -->
	<div class="timer-strip {orientation === 'right' ? 'justify-end' : 'justify-start'}">
		<div class="timer-display {rotationClass}">
			{displayTime}
		</div>
		<button
			class="flip-btn {rotationClass}"
			on:click={toggleOrientation}
			title="Flip text orientation"
		>
			<svg class="flip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
			</svg>
		</button>
	</div>

	<!-- Player 2 Panel (bottom) -->
	<div class="player-panel p2-panel">
		<div class="player-content {rotationClass}">
			<!-- Player name -->
			<div class="player-name-section">
				<span class="player-label">P2</span>
				<span class="player-name">{playerTwoName || 'Player 2'}</span>
			</div>

			<!-- Life Total -->
			<div class="life-total-wrapper">
				{#if editingPlayer === 'player2'}
					<input
						type="number"
						class="life-input"
						bind:value={editValue}
						on:keydown={handleEditKeydown}
						on:blur={confirmEdit}
						autofocus
					/>
				{:else}
					<button class="life-total" on:click={() => startEdit('player2')}>
						{player2Score}
					</button>
				{/if}
			</div>

			<!-- 2x2 Button Grid -->
			<div class="button-grid">
				<button
					class="life-btn"
					on:mousedown={() => startHold('player2', -5)}
					on:mouseup={stopHold}
					on:mouseleave={stopHold}
					on:touchstart|preventDefault={() => startHold('player2', -5)}
					on:touchend={stopHold}
				>
					-5
				</button>
				<button
					class="life-btn"
					on:mousedown={() => startHold('player2', 5)}
					on:mouseup={stopHold}
					on:mouseleave={stopHold}
					on:touchstart|preventDefault={() => startHold('player2', 5)}
					on:touchend={stopHold}
				>
					+5
				</button>
				<button
					class="life-btn"
					on:mousedown={() => startHold('player2', -1)}
					on:mouseup={stopHold}
					on:mouseleave={stopHold}
					on:touchstart|preventDefault={() => startHold('player2', -1)}
					on:touchend={stopHold}
				>
					−
				</button>
				<button
					class="life-btn"
					on:mousedown={() => startHold('player2', 1)}
					on:mouseup={stopHold}
					on:mouseleave={stopHold}
					on:touchstart|preventDefault={() => startHold('player2', 1)}
					on:touchend={stopHold}
				>
					+
				</button>
			</div>
		</div>
	</div>

	<!-- Start Signal Overlay -->
	{#if showStartSignal}
		<div class="start-signal-overlay">
			<div class="start-signal-content {rotationClass}">
				<div class="start-signal-text">YOU MAY START</div>
			</div>
		</div>
	{/if}

	<!-- Custom Signal Overlay (Red) -->
	{#if showCustomSignal}
		<div class="custom-signal-overlay">
			<div class="custom-signal-content {rotationClass}">
				<div class="custom-signal-text">{customSignalText}</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.scorekeeper-container {
		position: relative;
		width: 100vw;
		display: flex;
		flex-direction: column;
		background: #030712;
		overflow: hidden;
		touch-action: manipulation;
		user-select: none;
	}

	.player-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 0;
		min-height: 0;
		overflow: hidden;
	}

	.p1-panel {
		background: linear-gradient(180deg, #450a0a 0%, #1c0a0a 100%);
		border-bottom: 2px solid #dc2626;
	}

	.p2-panel {
		background: linear-gradient(0deg, #0a1a45 0%, #0a0a1c 100%);
		border-top: 2px solid #2563eb;
	}

	.player-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		width: 100%;
		padding: 0.5rem;
		gap: 0.5rem;
		transition: transform 0.3s ease;
	}

	.button-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr 1fr;
		gap: 1rem;
		flex-shrink: 0;
	}

	.player-name-section {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.player-label {
		font-size: clamp(0.7rem, 2.5vw, 0.9rem);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.15);
		color: rgba(255, 255, 255, 0.8);
	}

	.player-name {
		font-size: clamp(1rem, 4vw, 1.5rem);
		font-weight: 600;
		color: white;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.life-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		color: white;
		border: 3px solid rgba(255, 255, 255, 0.25);
		background: rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		transition: all 0.15s ease;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		width: clamp(70px, 18vw, 100px);
		height: clamp(70px, 18vw, 100px);
		font-size: clamp(1.5rem, 5vw, 2.5rem);
	}

	.life-btn:active {
		transform: scale(0.95);
		background: rgba(255, 255, 255, 0.2);
	}

	.p1-panel .life-btn:hover {
		border-color: #ef4444;
		background: rgba(239, 68, 68, 0.2);
	}

	.p2-panel .life-btn:hover {
		border-color: #3b82f6;
		background: rgba(59, 130, 246, 0.2);
	}

	.life-total-wrapper {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
	}

	.life-total {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: clamp(5rem, 18vw, 9rem);
		font-weight: 800;
		color: white;
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0;
		text-align: center;
		text-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
		transition: transform 0.3s ease;
		-webkit-tap-highlight-color: transparent;
		line-height: 1;
	}

	.life-input {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: clamp(4rem, 14vw, 7rem);
		font-weight: 800;
		color: white;
		background: rgba(255, 255, 255, 0.1);
		border: 3px solid rgba(255, 255, 255, 0.3);
		border-radius: 12px;
		padding: 0.25rem 0.5rem;
		width: clamp(120px, 40vw, 200px);
		text-align: center;
		outline: none;
		line-height: 1;
		transition: transform 0.3s ease;
	}

	.life-input:focus {
		border-color: rgba(255, 255, 255, 0.6);
	}

	/* Hide number input spinners */
	.life-input::-webkit-outer-spin-button,
	.life-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.life-input[type='number'] {
		-moz-appearance: textfield;
	}

	.timer-strip {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: linear-gradient(180deg, #374151 0%, #1f2937 50%, #111827 100%);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		padding: 0.5rem;
		flex-shrink: 0;
	}

	.timer-strip.justify-start {
		justify-content: flex-start;
	}

	.timer-strip.justify-end {
		justify-content: flex-end;
	}

	.timer-display {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: clamp(1.5rem, 6vw, 2.5rem);
		font-weight: 700;
		color: #ffffff;
		letter-spacing: 0.05em;
		background: linear-gradient(180deg, #4b5563 0%, #374151 100%);
		padding: 0.5rem 1rem;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.1),
			0 2px 4px rgba(0, 0, 0, 0.3);
		transition: transform 0.3s ease;
	}

	.flip-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		background: linear-gradient(180deg, #4b5563 0%, #374151 100%);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 8px;
		color: #9ca3af;
		cursor: pointer;
		transition: all 0.3s ease;
		-webkit-tap-highlight-color: transparent;
		flex-shrink: 0;
	}

	.flip-btn:hover {
		background: linear-gradient(180deg, #6b7280 0%, #4b5563 100%);
		color: #e5e7eb;
	}

	.flip-btn:active {
		transform: rotate(90deg) scale(0.95);
	}

	.flip-icon {
		width: 20px;
		height: 20px;
	}

	/* Rotation classes */
	.rotate-90 {
		transform: rotate(90deg);
	}

	.-rotate-90 {
		transform: rotate(-90deg);
	}

	.rotate-180 {
		transform: rotate(180deg);
	}

	/* Start Signal Overlay */
	.start-signal-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		animation: pulseGreen 0.5s ease-in-out infinite alternate;
	}

	@keyframes pulseGreen {
		0% {
			background: linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%);
		}
		100% {
			background: linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%);
		}
	}

	.start-signal-content {
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.3s ease;
	}

	.start-signal-text {
		font-size: clamp(3rem, 12vw, 6rem);
		font-weight: 900;
		color: white;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		text-shadow:
			0 4px 20px rgba(0, 0, 0, 0.4),
			0 0 40px rgba(255, 255, 255, 0.3);
		text-align: center;
		animation: bounceText 0.5s ease-in-out infinite alternate;
	}

	@keyframes bounceText {
		0% {
			transform: scale(1);
		}
		100% {
			transform: scale(1.05);
		}
	}

	/* Custom Signal Overlay (Red) */
	.custom-signal-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		animation: pulseRed 0.5s ease-in-out infinite alternate;
	}

	@keyframes pulseRed {
		0% {
			background: linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%);
		}
		100% {
			background: linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%);
		}
	}

	.custom-signal-content {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		transition: transform 0.3s ease;
	}

	.custom-signal-text {
		font-size: clamp(2.5rem, 10vw, 5rem);
		font-weight: 900;
		color: white;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		text-shadow:
			0 4px 20px rgba(0, 0, 0, 0.4),
			0 0 40px rgba(255, 255, 255, 0.3);
		text-align: center;
		max-width: 80vh;
		word-wrap: break-word;
		animation: bounceText 0.5s ease-in-out infinite alternate;
	}
</style>
