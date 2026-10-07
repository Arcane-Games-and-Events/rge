<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, onValue, set, push } from 'firebase/database';
	import { db } from '../../../firebaseClient';
	import { startSignalRemainingMs } from '$lib/startSignal';
	import { pregamePath, firstPlayer } from '$lib/pregame';
	import { PRONOUN_OPTIONS } from '$lib/pronouns';
	import { CHOICE_PATH } from '$lib/choice';
	import { ACTIVE_PLAYER_PATH } from '$lib/activePlayer';
	import { heroImageUrl } from '$lib/heroMedia';

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
	let viewportWidth = 0;

	// For editing life totals directly
	let editingPlayer = null;
	let editValue = '';

	// Orientation: 'right' = phone on right of play area (rotate clockwise), 'left' = phone on left (rotate counter-clockwise)
	let orientation = 'right';
	// Which seat's panel is at the top of the screen. Together with the text
	// direction this is everything about how the tablet lies on the mat, and both
	// are kept on the device so a reload does not undo the set-up.
	let seatsSwapped = false;
	let showSetup = false;
	let playerOneHero = '';
	let playerTwoHero = '';
	// The panels' size, for the art: it is turned with the text, so it is drawn
	// as wide as the panel is tall and as tall as the panel is wide.
	let panelW = 0;
	let panelH = 0;
	// The strip's height: each panel reaches under half of it, so the hero art
	// runs all the way to the white line through the middle.
	let stripH = 0;
	$: underStrip = Math.round(stripH / 2);
	const LAYOUT_KEY = 'scorekeeperLayout';
	function saveLayout() {
		try {
			localStorage.setItem(LAYOUT_KEY, JSON.stringify({ orientation, seatsSwapped }));
		} catch {
			// nothing to do: the layout just will not persist
		}
	}

	// Start signal overlay
	let showStartSignal = false;
	let startSignalTimer = null;

	// Custom signal overlay (red, stays until dismissed)
	let showCustomSignal = false;
	let customSignalText = '';

	// The pregame form, opened from the booth: the players set their pronouns,
	// who won the roll and what they chose, then wait for the green flash. The
	// form stays up, on its "wait" screen once submitted, until the booth closes
	// it or the start signal fires.
	const PREGAME_PATH = pregamePath(1);
	let pregame = { active: false, submitted: false };
	let form = { p1: '', p2: '', roll: '', order: '' };
	let saving = false;
	$: goesFirst = firstPlayer(form.roll, form.order);
	$: formReady = !!goesFirst;

	async function submitPregame() {
		if (!formReady || saving) return;
		saving = true;
		try {
			await Promise.all([
				set(ref(db, 'playerInfo/p1/pronouns'), form.p1),
				set(ref(db, 'playerInfo/p2/pronouns'), form.p2),
				set(ref(db, CHOICE_PATH), `${form.roll}-${form.order}`),
				set(ref(db, ACTIVE_PLAYER_PATH), goesFirst),
				set(ref(db, `${PREGAME_PATH}/submitted`), true)
			]);
		} finally {
			saving = false;
		}
	}

	function toggleOrientation() {
		orientation = orientation === 'right' ? 'left' : 'right';
		saveLayout();
	}

	function swapSeats() {
		seatsSwapped = !seatsSwapped;
		saveLayout();
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

	// Life changes are gathered and committed after a pause, so a run of taps
	// lands as one change. The total on screen holds while they tap, with the
	// change building beneath it; when the taps stop the total moves, the chunk
	// goes into the game's history, and the change is spelled out beneath --
	// where they were, where they are, what the chunk did. The overlays update
	// once, when it settles.
	const COMMIT_DELAY_MS = 2000;
	const SUMMARY_MS = 4000;
	const HISTORY_PATH = 'lifecounter/history';
	let pending = { player1: 0, player2: 0 };
	let commitTimer = { player1: null, player2: null };
	let lastChange = { player1: null, player2: null };
	let summaryTimer = { player1: null, player2: null };
	$: shown = { player1: player1Score, player2: player2Score };

	const lifePath = (player) => (player === 'player1' ? 'lifecounter/p1' : 'lifecounter/p2');
	const stored = (player) => (player === 'player1' ? player1Score : player2Score);

	// Writes a settled change: the new total, and the chunk into the history.
	async function commit(player, from, to) {
		to = Math.max(0, to);
		if (to === from) return;
		if (player === 'player1') player1Score = to;
		else player2Score = to;
		await set(ref(db, lifePath(player)), to);
		await push(ref(db, HISTORY_PATH), {
			player: player === 'player1' ? 'p1' : 'p2',
			from,
			to,
			delta: to - from,
			at: Date.now()
		});
		lastChange = { ...lastChange, [player]: { from, to, delta: to - from } };
		clearTimeout(summaryTimer[player]);
		summaryTimer[player] = setTimeout(
			() => (lastChange = { ...lastChange, [player]: null }),
			SUMMARY_MS
		);
	}

	function commitPending(player) {
		const delta = pending[player];
		pending = { ...pending, [player]: 0 };
		const from = stored(player);
		commit(player, from, from + delta);
	}

	// Adjust score by delta: shown at once, written when the taps stop.
	function adjustScore(player, delta) {
		pending = { ...pending, [player]: pending[player] + delta };
		lastChange = { ...lastChange, [player]: null };
		clearTimeout(commitTimer[player]);
		commitTimer[player] = setTimeout(() => commitPending(player), COMMIT_DELAY_MS);
	}

	// The history of settled chunks and the panel that shows it: one column per
	// player, read top down like a scoresheet, the starting total at the head.
	let history = [];
	let showHistory = false;
	// The log is passed in so the columns recompute whenever it changes.
	const column = (log, player) => {
		const own = log.filter((e) => e.player === player).sort((a, b) => a.at - b.at);
		return own.length
			? [
					{ id: 'start', total: own[0].from },
					...own.map((e) => ({ id: e.id, total: e.to, delta: e.delta }))
				]
			: [];
	};
	$: columns = { p1: column(history, 'p1'), p2: column(history, 'p2') };

	// The panel's columns sit on the same sides as the players' panels on screen.
	// The sheet is turned with the text: its left edge is the device's top when
	// the text runs clockwise and its bottom when counterclockwise, and which
	// seat is at the top depends on the seat swap.
	$: topSeat = seatsSwapped ? 'p2' : 'p1';
	$: historySeats = (
		orientation === 'right'
			? [topSeat, topSeat === 'p1' ? 'p2' : 'p1']
			: [topSeat === 'p1' ? 'p2' : 'p1', topSeat]
	).map((id) => ({
		id,
		name: id === 'p1' ? playerOneName || 'Player 1' : playerTwoName || 'Player 2',
		now: id === 'p1' ? player1Score : player2Score
	}));

	// Start editing a life total
	function startEdit(player) {
		editingPlayer = player;
		editValue = shown[player].toString();
	}

	// Confirm the edit: a typed total settles at once, as one chunk.
	function confirmEdit() {
		if (editingPlayer) {
			const newValue = parseInt(editValue, 10);
			if (!isNaN(newValue)) {
				const player = editingPlayer;
				clearTimeout(commitTimer[player]);
				pending = { ...pending, [player]: 0 };
				commit(player, stored(player), newValue);
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
		viewportWidth = window.innerWidth;
		try {
			const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null');
			if (saved) {
				orientation = saved.orientation === 'left' ? 'left' : 'right';
				seatsSwapped = !!saved.seatsSwapped;
			}
		} catch {
			// no saved layout, or none readable: the defaults stand
		}

		// Subscribe to names
		onValue(ref(db, 'playerInfo/p1/hero'), (snap) => (playerOneHero = snap.val() ?? ''));
		onValue(ref(db, 'playerInfo/p2/hero'), (snap) => (playerTwoHero = snap.val() ?? ''));
		onValue(ref(db, 'playerInfo/p1/name'), (snap) => {
			playerOneName = snap.val() ?? '';
		});
		onValue(ref(db, 'playerInfo/p2/name'), (snap) => {
			playerTwoName = snap.val() ?? '';
		});

		// Subscribe to life totals
		onValue(ref(db, 'lifecounter/p1'), (snap) => {
			const v = snap.val();
			if (v != null) player1Score = v;
		});
		onValue(ref(db, 'lifecounter/p2'), (snap) => {
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

		// Subscribe to start signal. The signal expires from its own timestamp,
		// so a booth that closed mid-signal cannot pin it on air.
		onValue(ref(db, 'timers/Round/startSignal'), (snap) => {
			clearTimeout(startSignalTimer);
			const remaining = startSignalRemainingMs(snap.val());
			showStartSignal = remaining > 0;
			if (remaining > 0) {
				startSignalTimer = setTimeout(() => (showStartSignal = false), remaining);
			}
		});

		// The game's life history, newest first.
		onValue(ref(db, HISTORY_PATH), (snap) => {
			const v = snap.val() || {};
			history = Object.entries(v).map(([id, e]) => ({ id, ...e }));
		});

		// The pregame form, with the players' current pronouns filled in.
		onValue(ref(db, PREGAME_PATH), (snap) => {
			const data = snap.val() || {};
			const opening = !!data.active && !pregame.active;
			pregame = { active: !!data.active, submitted: !!data.submitted };
			if (opening) form = { ...form, roll: '', order: '' };
		});
		onValue(ref(db, 'playerInfo/p1/pronouns'), (snap) => (form.p1 = snap.val() ?? ''));
		onValue(ref(db, 'playerInfo/p2/pronouns'), (snap) => (form.p2 = snap.val() ?? ''));

		// Subscribe to custom signal
		onValue(ref(db, 'timers/Round/customSignal'), (snap) => {
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

<svelte:window
	on:resize={() => {
		viewportHeight = window.innerHeight;
		viewportWidth = window.innerWidth;
	}}
/>

<div class="scorekeeper-container" style="height: {viewportHeight}px;">
	<!-- Player 1 Panel (top) -->
	<div
		class="player-panel p1-panel"
		class:swapped={seatsSwapped}
		style="--under-strip: {underStrip}px;"
		bind:clientWidth={panelW}
		bind:clientHeight={panelH}
	>
		{#if playerOneHero}
			<!-- The hero's art, faint behind the seat and turned the same way as the
			     text, so both heroes stand the way the players read. -->
			<img
				class="panel-art {rotationClass}"
				style="width: {panelH + 4}px; height: {panelW + 4}px;"
				src={heroImageUrl(playerOneHero)}
				alt=""
			/>
		{/if}
		<div class="player-content {rotationClass}">
			<!-- Player name -->
			<div class="player-name-section">
				{#if playerOneHero}
					<img class="player-hero" src={heroImageUrl(playerOneHero)} alt="" />
				{/if}
				<div class="player-line">
					<span class="player-label">P1</span>
					<span class="player-who">
						<span class="player-name">{playerOneName || 'Player 1'}</span>
						{#if playerOneHero}<span class="player-hero-name">{playerOneHero}</span>{/if}
					</span>
				</div>
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
						{shown.player1}
					</button>
				{/if}
				<!-- While tapping, how far the total has moved; once settled, the change
				     in full, from where it started. -->
				{#if pending.player1}
					<div class="life-note pending">{pending.player1 > 0 ? '+' : ''}{pending.player1}</div>
				{:else if lastChange.player1}
					<div class="life-note settled" class:gain={lastChange.player1.delta > 0}>
						{lastChange.player1.from} → {lastChange.player1.to}
						<span>({lastChange.player1.delta > 0 ? '+' : ''}{lastChange.player1.delta})</span>
					</div>
				{:else}
					<div class="life-note">&nbsp;</div>
				{/if}
			</div>

			<!-- 2x2 Button Grid -->
			<div class="button-grid">
				<button
					class="life-btn minus big"
					on:mousedown={() => startHold('player1', -1)}
					on:mouseup={stopHold}
					on:mouseleave={stopHold}
					on:touchstart|preventDefault={() => startHold('player1', -1)}
					on:touchend={stopHold}
					aria-label="Player 1 minus 1"
				>
					−
				</button>
				<button
					class="life-btn plus big"
					on:mousedown={() => startHold('player1', 1)}
					on:mouseup={stopHold}
					on:mouseleave={stopHold}
					on:touchstart|preventDefault={() => startHold('player1', 1)}
					on:touchend={stopHold}
					aria-label="Player 1 plus 1"
				>
					+
				</button>
				<button
					class="life-btn minus small"
					on:mousedown={() => startHold('player1', -5)}
					on:mouseup={stopHold}
					on:mouseleave={stopHold}
					on:touchstart|preventDefault={() => startHold('player1', -5)}
					on:touchend={stopHold}
					aria-label="Player 1 minus 5"
				>
					−5
				</button>
				<button
					class="life-btn plus small"
					on:mousedown={() => startHold('player1', 5)}
					on:mouseup={stopHold}
					on:mouseleave={stopHold}
					on:touchstart|preventDefault={() => startHold('player1', 5)}
					on:touchend={stopHold}
					aria-label="Player 1 plus 5"
				>
					+5
				</button>
			</div>
		</div>
	</div>

	<!-- Center Timer Strip -->
	<div
		class="timer-strip {orientation === 'right' ? 'buttons-end' : 'buttons-start'}"
		bind:clientHeight={stripH}
	>
		<div class="timer-centre">
			<div class="timer-display {rotationClass}">
				{displayTime}
			</div>
		</div>
		<div class="strip-buttons" class:reversed={orientation === 'right'}>
			<button
				class="strip-btn setup {rotationClass}"
				on:click={() => (showSetup = true)}
				title="Line up the tablet"
				aria-label="Line up the tablet"
			>
				<svg
					class="flip-icon"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<rect x="4" y="3" width="16" height="18" rx="2" />
					<path d="M8 8h8M8 12h8M8 16h5" />
				</svg>
				<span class="strip-btn-label">Set up</span>
			</button>
			<button
				class="strip-btn turn {rotationClass}"
				on:click={toggleOrientation}
				title="Flip text orientation"
				aria-label="Flip text orientation"
			>
				<svg
					class="flip-icon"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
				</svg>
				<span class="strip-btn-label">Rotate</span>
			</button>
			<button
				class="strip-btn history {rotationClass}"
				on:click={() => (showHistory = !showHistory)}
				title="Life total history"
				aria-label="Life total history"
				aria-pressed={showHistory}
			>
				<svg
					class="flip-icon"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="9" />
					<path d="M12 7v5l3 2" />
				</svg>
				<span class="strip-btn-label">History</span>
			</button>
		</div>
	</div>

	<!-- Player 2 Panel (bottom) -->
	<div
		class="player-panel p2-panel"
		class:swapped={seatsSwapped}
		style="--under-strip: {underStrip}px;"
	>
		{#if playerTwoHero}
			<img
				class="panel-art {rotationClass}"
				style="width: {panelH + 4}px; height: {panelW + 4}px;"
				src={heroImageUrl(playerTwoHero)}
				alt=""
			/>
		{/if}
		<div class="player-content {rotationClass}">
			<!-- Player name -->
			<div class="player-name-section">
				{#if playerTwoHero}
					<img class="player-hero" src={heroImageUrl(playerTwoHero)} alt="" />
				{/if}
				<div class="player-line">
					<span class="player-label">P2</span>
					<span class="player-who">
						<span class="player-name">{playerTwoName || 'Player 2'}</span>
						{#if playerTwoHero}<span class="player-hero-name">{playerTwoHero}</span>{/if}
					</span>
				</div>
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
						{shown.player2}
					</button>
				{/if}
				<!-- While tapping, how far the total has moved; once settled, the change
				     in full, from where it started. -->
				{#if pending.player2}
					<div class="life-note pending">{pending.player2 > 0 ? '+' : ''}{pending.player2}</div>
				{:else if lastChange.player2}
					<div class="life-note settled" class:gain={lastChange.player2.delta > 0}>
						{lastChange.player2.from} → {lastChange.player2.to}
						<span>({lastChange.player2.delta > 0 ? '+' : ''}{lastChange.player2.delta})</span>
					</div>
				{:else}
					<div class="life-note">&nbsp;</div>
				{/if}
			</div>

			<!-- 2x2 Button Grid -->
			<div class="button-grid">
				<button
					class="life-btn minus big"
					on:mousedown={() => startHold('player2', -1)}
					on:mouseup={stopHold}
					on:mouseleave={stopHold}
					on:touchstart|preventDefault={() => startHold('player2', -1)}
					on:touchend={stopHold}
					aria-label="Player 2 minus 1"
				>
					−
				</button>
				<button
					class="life-btn plus big"
					on:mousedown={() => startHold('player2', 1)}
					on:mouseup={stopHold}
					on:mouseleave={stopHold}
					on:touchstart|preventDefault={() => startHold('player2', 1)}
					on:touchend={stopHold}
					aria-label="Player 2 plus 1"
				>
					+
				</button>
				<button
					class="life-btn minus small"
					on:mousedown={() => startHold('player2', -5)}
					on:mouseup={stopHold}
					on:mouseleave={stopHold}
					on:touchstart|preventDefault={() => startHold('player2', -5)}
					on:touchend={stopHold}
					aria-label="Player 2 minus 5"
				>
					−5
				</button>
				<button
					class="life-btn plus small"
					on:mousedown={() => startHold('player2', 5)}
					on:mouseup={stopHold}
					on:mouseleave={stopHold}
					on:touchstart|preventDefault={() => startHold('player2', 5)}
					on:touchend={stopHold}
					aria-label="Player 2 plus 5"
				>
					+5
				</button>
			</div>
		</div>
	</div>

	<!-- Lining the tablet up: the real panels stay visible behind, and change as
	     the two controls are used, so staff see the result as they set it. -->
	{#if showSetup}
		{@const leftSeat = seatsSwapped ? 'p2' : 'p1'}
		{@const leftName = leftSeat.toUpperCase()}
		{@const rightName = leftSeat === 'p1' ? 'P2' : 'P1'}
		<div class="setup-overlay">
			<div
				class="setup-card {rotationClass}"
				style="width: {viewportHeight - 40}px; height: {viewportWidth - 24}px;"
			>
				<div class="setup-title">Line up the tablet</div>
				<div class="setup-body">
					<!-- The set-up from the top down: camera, tablet, mat and players. The
				     picture reads with the sheet's text, and follows the seat swap. -->
					<div class="setup-diagram-wrap">
						<svg
							class="setup-diagram"
							viewBox="0 0 240 300"
							aria-label="From the top: the overhead camera, the tablet beneath it turned on its side, then the mat with {leftName} on the left and {rightName} on the right"
						>
							<!-- the overhead camera, looking down on the tablet -->
							<text
								x="120"
								y="10"
								text-anchor="middle"
								font-size="8"
								letter-spacing="2"
								fill="#d9b499">OVERHEAD CAMERA</text
							>
							<rect x="109" y="15" width="22" height="14" rx="3" fill="#e5e7eb" />
							<rect x="111" y="12" width="8" height="4" rx="1" fill="#e5e7eb" />
							<circle cx="121" cy="22" r="4" fill="#0b1220" />
							<circle cx="121" cy="22" r="1.8" fill="#d9b499" />
							<polygon points="115,30 127,30 150,68 90,68" fill="rgba(217,180,153,0.18)" />
							<!-- the tablet, a portrait device turned a quarter counterclockwise, a seat at each end -->
							<g transform="rotate(-90 120 94)">
								<rect
									x="96"
									y="52"
									width="48"
									height="84"
									rx="6"
									fill="#0b1220"
									stroke="#e5e7eb"
									stroke-width="2"
								/>
								<rect
									x="100"
									y="56"
									width="40"
									height="34"
									rx="3"
									fill={leftSeat === 'p1' ? 'rgba(220,38,38,0.45)' : 'rgba(37,99,235,0.5)'}
								/>
								<rect
									x="100"
									y="98"
									width="40"
									height="34"
									rx="3"
									fill={leftSeat === 'p1' ? 'rgba(37,99,235,0.5)' : 'rgba(220,38,38,0.45)'}
								/>
								<rect x="100" y="91" width="40" height="6" fill="#1f2937" />
								<text
									x="120"
									y="77"
									text-anchor="middle"
									font-size="11"
									font-weight="800"
									fill="white">{leftName}</text
								>
								<text
									x="120"
									y="119"
									text-anchor="middle"
									font-size="11"
									font-weight="800"
									fill="white">{rightName}</text
								>
							</g>
							<text
								x="120"
								y="131"
								text-anchor="middle"
								font-size="7"
								letter-spacing="1.5"
								fill="#d9b499">PORTRAIT · LOCK ROTATION</text
							>
							<!-- the mat beneath, square, with a player on each side -->
							<rect
								x="60"
								y="152"
								width="120"
								height="120"
								rx="8"
								fill="rgba(217,180,153,0.18)"
								stroke="rgba(217,180,153,0.7)"
								stroke-width="1.5"
							/>
							<text
								x="120"
								y="216"
								text-anchor="middle"
								font-size="9"
								letter-spacing="2"
								fill="#d9b499">PLAY MAT</text
							>
							<text
								x="30"
								y="216"
								text-anchor="middle"
								font-size="12"
								font-weight="800"
								fill="white">{leftName}</text
							>
							<path
								d="M40 212 l12 0 m-5 -5 l5 5 l-5 5"
								fill="none"
								stroke="#d9b499"
								stroke-width="2"
							/>
							<text
								x="210"
								y="216"
								text-anchor="middle"
								font-size="12"
								font-weight="800"
								fill="white">{rightName}</text
							>
							<path
								d="M200 212 l-12 0 m5 -5 l-5 5 l5 5"
								fill="none"
								stroke="#d9b499"
								stroke-width="2"
							/>
						</svg>
					</div>

					<ol class="setup-steps">
						<li>
							Hold the tablet or phone <strong>in portrait</strong> (tall), flat beside the mat, between
							the players.
						</li>
						<li>
							Each panel should face its player: <strong>P1</strong> on the P1 panel's side,
							<strong>P2</strong>
							on the other. Not so? <strong>Swap seats</strong>.
						</li>
						<li>If the names read upside down to the players, <strong>Rotate text</strong>.</li>
						<li><strong>Lock the screen's rotation</strong> so it cannot switch to landscape.</li>
					</ol>
				</div>
				<div class="setup-actions">
					<button type="button" class="setup-btn" on:click={swapSeats}>⇅ Swap seats</button>
					<button type="button" class="setup-btn" on:click={toggleOrientation}>↻ Rotate text</button
					>
				</div>
				<button type="button" class="pregame-done setup-done" on:click={() => (showSetup = false)}>
					Done
				</button>
			</div>
		</div>
	{/if}

	<!-- Life total history: every settled chunk this game, newest first -->
	{#if showHistory}
		<div class="pregame-overlay" role="dialog" aria-label="Life total history">
			<div
				class="pregame-card {rotationClass}"
				style="width: {viewportHeight - 40}px; height: {viewportWidth - 24}px;"
			>
				<div class="history-head">
					<div class="pregame-title">Life history</div>
					<button type="button" class="history-close" on:click={() => (showHistory = false)}>
						<span aria-hidden="true">✕</span> Close
					</button>
				</div>
				{#if !history.length}
					<p class="pregame-instruction">No changes yet this game.</p>
				{:else}
					<div class="history-columns">
						{#each historySeats as seat (seat.id)}
							{@const rows = columns[seat.id]}
							<div class="history-column">
								<div class="history-who">
									<span class="history-name">{seat.name}</span>
									<span class="history-now">{seat.now}</span>
								</div>
								{#if !rows.length}
									<p class="history-empty">No changes yet</p>
								{:else}
									<ol class="history-list">
										{#each rows as e, i (e.id)}
											<li
												class="history-row"
												class:gain={e.delta > 0}
												class:latest={i === rows.length - 1}
											>
												{#if e.delta == null}
													<span class="history-tag">Start</span>
													<span class="history-total">{e.total}</span>
												{:else}
													<span class="history-delta"
														>{e.delta > 0 ? '+' : '−'}{Math.abs(e.delta)}</span
													>
													<span class="history-arrow">→</span>
													<span class="history-total">{e.total}</span>
												{/if}
											</li>
										{/each}
									</ol>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Pregame form, sent from the booth -->
	{#if pregame.active && !showStartSignal}
		<div class="pregame-overlay">
			<!-- Sized from the measured viewport: as wide as the screen is tall, as
			     tall as it is wide, since it is read turned on its side. -->
			<div
				class="pregame-card {rotationClass}"
				style="width: {viewportHeight - 40}px; height: {viewportWidth - 24}px;"
			>
				{#if pregame.submitted}
					<div class="pregame-wait">
						<div class="pregame-check">✓</div>
						<div class="pregame-title">All set</div>
						<p class="pregame-instruction">
							{(goesFirst === 'p1' ? playerOneName : playerTwoName) ||
								(goesFirst === 'p1' ? 'Player 1' : 'Player 2')}
							plays first. Wait for the green screen flash to begin.
						</p>
					</div>
				{:else}
					{@const p1 = playerOneName || 'Player 1'}
					{@const p2 = playerTwoName || 'Player 2'}
					<div class="pregame-head">
						<div class="pregame-title">Before you start</div>
						<div class="pregame-sub">Two quick things, then wait for the green flash.</div>
					</div>

					<div class="pregame-grid">
						<!-- Step 1: pronouns, one block per player -->
						<section class="pregame-step">
							<div class="pregame-step-title"><span class="pregame-num">1</span> Pronouns</div>
							{#each [{ id: 'p1', name: p1 }, { id: 'p2', name: p2 }] as seat (seat.id)}
								<div class="pregame-field">
									<div class="pregame-label">{seat.name}</div>
									<div class="pregame-options">
										{#each PRONOUN_OPTIONS as option (option)}
											<button
												type="button"
												class="pregame-option"
												class:selected={form[seat.id] === option}
												on:click={() => (form[seat.id] = form[seat.id] === option ? '' : option)}
											>
												{option}
											</button>
										{/each}
									</div>
								</div>
							{/each}
						</section>

						<!-- Step 2: the roll, then the choice -->
						<section class="pregame-step">
							<div class="pregame-step-title"><span class="pregame-num">2</span> The roll</div>
							<div class="pregame-field">
								<div class="pregame-label">Who won the roll?</div>
								<div class="pregame-options">
									<button
										type="button"
										class="pregame-option"
										class:selected={form.roll === 'p1'}
										on:click={() => (form.roll = 'p1')}>{p1}</button
									>
									<button
										type="button"
										class="pregame-option"
										class:selected={form.roll === 'p2'}
										on:click={() => (form.roll = 'p2')}>{p2}</button
									>
								</div>
							</div>
							<div class="pregame-field" class:dim={!form.roll}>
								<div class="pregame-label">
									{form.roll
										? `${form.roll === 'p1' ? p1 : p2} chose to play…`
										: 'They chose to play…'}
								</div>
								<div class="pregame-options">
									<button
										type="button"
										class="pregame-option"
										class:selected={form.order === 'first'}
										disabled={!form.roll}
										on:click={() => (form.order = 'first')}>First</button
									>
									<button
										type="button"
										class="pregame-option"
										class:selected={form.order === 'second'}
										disabled={!form.roll}
										on:click={() => (form.order = 'second')}>Second</button
									>
								</div>
							</div>
						</section>
					</div>

					<div class="pregame-foot">
						<div class="pregame-summary" class:ready={!!goesFirst}>
							{#if goesFirst}
								<strong>{goesFirst === 'p1' ? p1 : p2}</strong> plays first
							{:else}
								Pick the roll winner and their choice
							{/if}
						</div>
						<button
							type="button"
							class="pregame-done"
							disabled={!formReady || saving}
							on:click={submitPregame}
						>
							{saving ? 'Saving…' : 'Done'}
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

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
		font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
		overflow: hidden;
		touch-action: manipulation;
		user-select: none;
	}

	.player-panel {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 0;
		min-height: 0;
		overflow: hidden;
	}

	/* Each panel runs on under its half of the strip, up to the white line, so
	   the hero art meets it; the padding keeps the numbers out from under the
	   clock. */
	.p1-panel,
	.p2-panel.swapped {
		margin-bottom: calc(-1 * var(--under-strip, 0px));
		padding-bottom: var(--under-strip, 0px);
	}

	.p2-panel,
	.p1-panel.swapped {
		margin-top: calc(-1 * var(--under-strip, 0px));
		padding-top: var(--under-strip, 0px);
	}

	.p1-panel.swapped {
		margin-bottom: 0;
		padding-bottom: 0;
	}

	.p2-panel.swapped {
		margin-top: 0;
		padding-top: 0;
	}

	/* The hero behind the seat: large, faint and darkened toward the strip so
	   the numbers stay crisp over it. */
	.panel-art {
		position: absolute;
		left: 50%;
		top: 50%;
		max-width: none;
		object-fit: cover;
		object-position: right top;
		opacity: 0.28;
		filter: saturate(0.85);
		pointer-events: none;
	}

	/* Centred, then turned: the rotation classes only rotate, so the centring
	   translate is carried here. */
	.panel-art.rotate-90 {
		transform: translate(-50%, -50%) rotate(90deg);
	}

	.panel-art.-rotate-90 {
		transform: translate(-50%, -50%) rotate(-90deg);
	}

	.player-panel::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: linear-gradient(180deg, rgba(3, 7, 18, 0.15), rgba(3, 7, 18, 0.75));
	}

	.p2-panel::after,
	.p1-panel.swapped::after {
		background: linear-gradient(0deg, rgba(3, 7, 18, 0.15), rgba(3, 7, 18, 0.75));
	}

	.p2-panel.swapped::after {
		background: linear-gradient(180deg, rgba(3, 7, 18, 0.15), rgba(3, 7, 18, 0.75));
	}

	.player-content {
		position: relative;
		z-index: 1;
	}

	/* Each seat is a translucent dark panel with its own thin edge of colour -- the
	   red and blue the booth uses for P1 and P2 -- rather than a wash of it. */
	.p1-panel {
		order: 1;
		background: rgba(17, 24, 39, 0.6);
	}

	.p2-panel {
		order: 3;
		background: rgba(17, 24, 39, 0.6);
	}

	/* Seats swapped: P2's panel at the top. */
	.p1-panel.swapped {
		order: 3;
	}

	.p2-panel.swapped {
		order: 1;
	}

	.timer-strip {
		order: 2;
	}

	/* The clock holds the centre of the strip whatever sits at the ends; the
	   buttons sit at the far end and cross over when the text is turned. */
	/* The centring wrapper is wider than the turned clock looks; it must not take
	   the taps meant for the buttons beside it. */
	.timer-centre {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		z-index: 1;
		pointer-events: none;
	}

	/* The buttons read set-up, rotate, history in the players' reading direction
	   whichever way the text is turned: the row runs the other way when the
	   text does, since the buttons turn one by one and the row does not. */
	.strip-buttons {
		display: flex;
		align-items: center;
		gap: 8px;
		position: relative;
	}

	.strip-buttons.reversed {
		flex-direction: row-reverse;
	}

	.timer-strip.buttons-end {
		justify-content: flex-end;
	}

	.timer-strip.buttons-start {
		justify-content: flex-start;
	}

	/* The hero, a square the height of the name line, as on the overlays. */
	.player-hero {
		width: clamp(48px, 12vw, 72px);
		height: clamp(48px, 12vw, 72px);
		object-fit: cover;
		object-position: right top;
		box-shadow: inset 0 0 0 1px rgba(217, 180, 153, 0.45);
		flex-shrink: 0;
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

	/* The big − and + on top, the −5 and +5 beneath: the pair they use most is
	   the pair that is largest, and minus is always left of plus. */
	.button-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: auto auto;
		gap: 0.6rem;
		flex-shrink: 0;
	}

	.player-name-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		flex-shrink: 0;
		min-width: 0;
	}

	.player-line {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		min-width: 0;
	}

	.player-who {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		line-height: 1.1;
	}

	.player-hero-name {
		font-size: clamp(0.75rem, 3vw, 0.95rem);
		font-style: italic;
		font-weight: 700;
		color: #d9b499;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.player-label {
		font-size: clamp(0.7rem, 2.5vw, 0.85rem);
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		padding: 0.2rem 0.5rem;
		border: 1px solid rgba(217, 180, 153, 0.6);
		color: #d9b499;
	}

	.player-name {
		font-size: clamp(1rem, 4vw, 1.5rem);
		font-weight: 700;
		color: white;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.life-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(17, 24, 39, 0.75);
		backdrop-filter: blur(6px);
		border-radius: 14px;
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
		transition:
			transform 0.1s ease,
			background 0.15s ease;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}

	.life-btn.big {
		width: clamp(76px, 20vw, 110px);
		height: clamp(64px, 16vw, 84px);
		font-size: clamp(2rem, 7vw, 3rem);
		line-height: 1;
	}

	.life-btn.small {
		width: clamp(76px, 20vw, 110px);
		height: clamp(40px, 10vw, 52px);
		font-size: clamp(1.1rem, 3.5vw, 1.4rem);
		color: #d1d5db;
	}

	/* Minus leans red, plus leans green, so the pair reads without thinking. */
	.life-btn.minus {
		background: rgba(248, 113, 113, 0.16);
		border-color: rgba(248, 113, 113, 0.45);
	}

	.life-btn.plus {
		background: rgba(74, 222, 128, 0.14);
		border-color: rgba(74, 222, 128, 0.45);
	}

	.life-btn:active {
		transform: scale(0.94);
	}

	.life-btn.minus:active {
		background: rgba(248, 113, 113, 0.35);
	}

	.life-btn.plus:active {
		background: rgba(74, 222, 128, 0.3);
	}

	.life-total-wrapper {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-width: 0;
	}

	.life-note {
		min-height: 1.9em;
		margin-top: 0.35rem;
		margin-bottom: clamp(0.6rem, 2.5vw, 1.1rem);
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
		padding: 0 0.7em;
		border-radius: 999px;
		font-variant-numeric: tabular-nums;
		font-size: clamp(1rem, 4vw, 1.4rem);
		font-weight: 800;
		color: #9ca3af;
		transition: opacity 300ms ease;
	}

	.life-note.pending {
		color: #fbbf24;
		background: rgba(251, 191, 36, 0.14);
		box-shadow: inset 0 0 0 1px rgba(251, 191, 36, 0.4);
	}

	.life-note.settled {
		color: white;
		background: rgba(248, 113, 113, 0.16);
		box-shadow: inset 0 0 0 1px rgba(248, 113, 113, 0.45);
	}

	.life-note.settled span {
		color: #f87171;
	}

	.life-note.settled.gain {
		background: rgba(74, 222, 128, 0.14);
		box-shadow: inset 0 0 0 1px rgba(74, 222, 128, 0.45);
	}

	.life-note.settled.gain span {
		color: #4ade80;
	}

	.life-note.settled span {
		opacity: 0.8;
	}

	.life-total {
		font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
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
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		min-height: clamp(84px, 14vw, 104px);
		gap: 8px;
		background: transparent;
		padding: 12px 8px;
		flex-shrink: 0;
	}

	/* One white line splitting the screen in two, through the middle of the strip. */
	.timer-strip::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 2px;
		background: rgba(255, 255, 255, 0.9);
		transform: translateY(-50%);
	}

	.timer-strip.justify-start {
		justify-content: flex-start;
	}

	.timer-strip.justify-end {
		justify-content: flex-end;
	}

	/* The round clock: the largest thing in the strip, bright on dark, so it can be
	   read from either seat without leaning in. */
	.timer-display {
		font-variant-numeric: tabular-nums;
		font-size: clamp(2rem, 8vw, 3.2rem);
		font-weight: 800;
		color: #ffffff;
		letter-spacing: 0.06em;
		background: rgba(17, 24, 39, 0.95);
		border: 2px solid rgba(217, 180, 153, 0.7);
		box-shadow: 0 0 18px rgba(217, 180, 153, 0.25);
		line-height: 1;
		padding: clamp(0.5rem, 1.6vw, 0.9rem) clamp(1rem, 3vw, 1.6rem);
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.1),
			0 2px 4px rgba(0, 0, 0, 0.3);
		transition: transform 0.3s ease;
	}

	/* The strip's three controls, each labelled and in its own colour, sized so
	   all three sit beside the centred clock on a phone: history purple, set-up
	   amber for the person laying the table, turn in slate. */
	.strip-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		/* As big as the screen allows: three of them beside the clock on a phone,
		   and a good deal larger on a tablet. */
		width: clamp(48px, 12vw, 72px);
		height: clamp(54px, 12vw, 72px);
		padding: 6px 4px;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 10px;
		color: white;
		cursor: pointer;
		transition: transform 0.3s ease;
		-webkit-tap-highlight-color: transparent;
		flex-shrink: 0;
	}

	.strip-btn.history {
		background: linear-gradient(180deg, #7c3aed 0%, #5b21b6 100%);
		box-shadow: 0 0 14px rgba(124, 58, 237, 0.45);
	}

	.strip-btn.history[aria-pressed='true'] {
		background: linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%);
	}

	.strip-btn.setup {
		background: linear-gradient(180deg, #f59e0b 0%, #b45309 100%);
		box-shadow: 0 0 14px rgba(245, 158, 11, 0.45);
		color: #1c1917;
	}

	.strip-btn.turn {
		background: linear-gradient(180deg, #475569 0%, #1e293b 100%);
		box-shadow: 0 0 14px rgba(148, 163, 184, 0.25);
	}

	.strip-btn-label {
		font-size: clamp(0.55rem, 1.6vw, 0.75rem);
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.flip-icon {
		width: clamp(20px, 3vw, 28px);
		height: clamp(20px, 3vw, 28px);
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
	/* The pregame form fills the screen and is read from the side like the rest,
	   so it is laid out for the rotated viewport: as wide as the screen is tall. */
	.pregame-overlay {
		position: absolute;
		inset: 0;
		z-index: 90;
		background: rgba(3, 7, 18, 0.96);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
	}

	.pregame-card {
		flex: none;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 8px;
		transition: transform 0.3s ease;
	}

	/* The four questions in two columns: pronouns on the left, the roll and the
	   choice on the right. */
	.pregame-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px 20px;
	}

	.pregame-head {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.pregame-title {
		font-size: 1.35rem;
		font-weight: 800;
		letter-spacing: 0.02em;
	}

	.pregame-sub,
	.pregame-instruction {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.35;
		color: #9ca3af;
	}

	/* The two steps side by side, each a numbered card. */
	.pregame-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		min-height: 0;
	}

	.pregame-step {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
		border-radius: 12px;
		background: #111827;
		border: 1px solid #1f2937;
	}

	.pregame-step-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.95rem;
		font-weight: 800;
	}

	.pregame-num {
		width: 22px;
		height: 22px;
		border-radius: 9999px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: #7c3aed;
		font-size: 0.8rem;
		font-weight: 800;
	}

	.pregame-field {
		display: flex;
		flex-direction: column;
		gap: 5px;
		transition: opacity 200ms ease;
	}

	.pregame-field.dim {
		opacity: 0.45;
	}

	.pregame-label {
		font-size: 0.8rem;
		font-weight: 700;
		color: #d1d5db;
	}

	.pregame-options {
		display: flex;
		gap: 6px;
	}

	.pregame-option {
		flex: 1;
		min-height: 40px;
		padding: 0 8px;
		border-radius: 8px;
		border: 1px solid #374151;
		background: #0b1220;
		color: #e5e7eb;
		font-size: 0.9rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		-webkit-tap-highlight-color: transparent;
	}

	.pregame-option:disabled {
		opacity: 0.6;
	}

	.pregame-option.selected {
		border-color: #a78bfa;
		background: #6d28d9;
		color: white;
		box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.35);
	}

	.pregame-foot {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.pregame-summary {
		flex: 1;
		min-height: 1.4em;
		font-size: 0.95rem;
		color: #9ca3af;
	}

	.pregame-summary.ready {
		color: white;
		font-size: 1.05rem;
	}

	.pregame-done {
		flex: none;
		min-width: 150px;
		min-height: 48px;
		border-radius: 10px;
		border: 0;
		background: linear-gradient(135deg, #22c55e, #15803d);
		color: white;
		font-size: 1.05rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.pregame-done:disabled {
		background: #1f2937;
		color: #6b7280;
	}

	/* The life history panel: a title and a big Close, then one column per
	   player read top down like a scoresheet. */
	.history-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	/* Big, bright and apart from the data, so it is found and hit first time. */
	.history-close {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 52px;
		min-width: 130px;
		padding: 0 20px;
		border-radius: 10px;
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: linear-gradient(180deg, #7c3aed 0%, #5b21b6 100%);
		color: white;
		font-size: 1rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		box-shadow: 0 0 16px rgba(124, 58, 237, 0.45);
		-webkit-tap-highlight-color: transparent;
	}

	.history-close span {
		font-size: 1.1rem;
	}

	.history-columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		min-height: 0;
	}

	.history-column {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-height: 0;
	}

	/* The player and where they stand now, over their changes. */
	.history-who {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		padding-bottom: 6px;
		border-bottom: 1px solid #374151;
	}

	.history-name {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-weight: 800;
	}

	.history-now {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 1.4rem;
		font-weight: 800;
	}

	.history-empty {
		margin: 0;
		font-size: 0.85rem;
		color: #6b7280;
	}

	.history-list {
		margin: 0;
		padding: 0;
		list-style: none;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	/* Each change reads left to right: what happened, then where it left them.
	   The most recent is lit. */
	.history-row {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		border-radius: 8px;
		background: #111827;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	}

	.history-row.latest {
		background: #1f2937;
		box-shadow: inset 0 0 0 1px rgba(167, 139, 250, 0.6);
	}

	.history-tag {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #9ca3af;
	}

	.history-delta {
		text-align: right;
		font-size: 1.1rem;
		font-weight: 800;
		color: #f87171;
	}

	.history-row.gain .history-delta {
		color: #4ade80;
	}

	.history-arrow {
		color: #6b7280;
	}

	.history-total {
		font-size: 1.2rem;
		font-weight: 800;
	}

	.history-row .history-tag + .history-total {
		grid-column: 3;
	}

	/* Set-up: a translucent sheet with the controls, the panels visible behind. */
	.setup-overlay {
		position: absolute;
		inset: 0;
		z-index: 95;
		background: rgba(3, 7, 18, 0.72);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
	}

	.setup-card {
		flex: none;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 10px;
		padding: 14px 16px;
		border-radius: 14px;
		background: #111827;
		border: 1px solid rgba(217, 180, 153, 0.45);
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
		transition: transform 0.3s ease;
	}

	.setup-title {
		font-size: 1.3rem;
		font-weight: 800;
	}

	/* The picture beside the steps, so the sheet stays short enough for a phone. */
	.setup-body {
		display: grid;
		grid-template-columns: 170px minmax(0, 1fr);
		gap: 14px;
		align-items: center;
	}

	.setup-diagram-wrap {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 190px;
	}

	.setup-diagram {
		width: 160px;
		height: 190px;
		transition: transform 0.3s ease;
	}

	.setup-steps {
		margin: 0;
		padding-left: 1.2em;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 0.9rem;
		line-height: 1.35;
		color: #d1d5db;
	}

	.setup-steps strong {
		color: white;
	}

	.setup-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.setup-btn {
		min-height: 52px;
		border-radius: 10px;
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: linear-gradient(180deg, #7c3aed 0%, #5b21b6 100%);
		color: white;
		font-size: 1rem;
		font-weight: 800;
	}

	.setup-done {
		min-height: 48px;
	}

	.pregame-wait {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 24px 0;
		text-align: center;
	}

	.pregame-check {
		width: 72px;
		height: 72px;
		border-radius: 9999px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #15803d;
		font-size: 2.5rem;
		font-weight: 900;
	}

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
