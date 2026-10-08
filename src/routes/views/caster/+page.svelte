<script context="module">
	// The camera band is as tall as lets the hand cams (1109x971, scaled) and
	// the two stacked 16:9 frames between them all fill it exactly: 628px.
	// The desk has the 452px beneath.
	const BAND = 628;
	const MARGIN = 20;
	const GAP = 16;
	const HAND_H = BAND - 2 * MARGIN;
	const HAND_W = Math.round((HAND_H * 1109) / 971);
	const HAND_Y = MARGIN;
	const MID_W = 1920 - 2 * MARGIN - 2 * GAP - 2 * HAND_W;
	// Exactly 16:9, the pair centred in the band's height.
	const MID_H = Math.round((MID_W * 9) / 16);
	const MID_Y = Math.round((BAND - (2 * MID_H + GAP)) / 2);
	const MID_X = MARGIN + HAND_W + GAP;
	const FRAMES = [
		{ label: 'P1 hand cam', x: MARGIN, y: HAND_Y, w: HAND_W, h: HAND_H },
		{ label: 'Casters', x: MID_X, y: MID_Y, w: MID_W, h: MID_H },
		{ label: 'Interview', x: MID_X, y: MID_Y + MID_H + GAP, w: MID_W, h: MID_H },
		{ label: 'P2 hand cam', x: MID_X + MID_W + GAP, y: HAND_Y, w: HAND_W, h: HAND_H }
	];
</script>

<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';
	import { formatTime } from '$lib/timerDisplay';
	import { throughRound, recordAfter, LOSSES_TO_DROP } from '$lib/standings';
	import { normalizePlayers } from '$lib/tournament';
	import { heroImageUrl } from '$lib/heroMedia';

	// The casters' confidence monitor, 1920x1080: the top band holds four
	// camera frames -- the players' hand cams at the sides, the casters' and the
	// interview frames stacked in the middle -- drawn as outlines for the
	// cameras to sit in, sized so all four fill the band with nothing wasted,
	// and the band beneath carries what the desk needs at a
	// glance -- Table 1's players with their records, heroes, pronouns and life
	// totals in the middle, the round clock under them, and either side the
	// match history of the player on that side: round by round, who they
	// played and how it went, through the live round.
	const ROOT = 'tournament';
	let players = { p1: {}, p2: {} };
	let life = { p1: null, p2: null };
	let timer = { remainingTime: 0, startTime: null, isPaused: true, isCountingUp: false };
	let clock = '00:00';
	let eventText = '';
	let currentRound = 1;
	let roster = [];
	let roundsTree = {};
	let historyMap = {};

	function tick() {
		const t = timer;
		let s = t.remainingTime || 0;
		if (t.startTime && !t.isPaused) {
			const elapsed = Math.floor((Date.now() - t.startTime) / 1000);
			s = t.isCountingUp ? s + elapsed : Math.max(0, s - elapsed);
		}
		clock = formatTime(s);
	}

	onMount(() => {
		const stops = [
			...['p1', 'p2'].map((seat) =>
				onValue(ref(db, `playerInfo/${seat}`), (snap) => {
					const d = snap.val() || {};
					players[seat] = {
						name: d.name || '',
						hero: d.hero || '',
						record: d.record || '',
						pronouns: d.pronouns || ''
					};
				})
			),
			...['p1', 'p2'].map((seat) =>
				onValue(ref(db, `lifecounter/${seat}`), (snap) => {
					const v = snap.val();
					life[seat] = typeof v === 'number' ? v : v == null ? null : Number(v);
				})
			),
			onValue(ref(db, 'timers/Round'), (snap) => {
				const d = snap.val() || {};
				timer = {
					remainingTime: Number(d.remainingTime) || 0,
					startTime: d.startTime || null,
					isPaused: d.isPaused !== false,
					isCountingUp: !!d.isCountingUp
				};
				tick();
			}),
			onValue(ref(db, 'eventText'), (snap) => (eventText = snap.val() ?? '')),
			onValue(ref(db, `${ROOT}/currentRound`), (snap) => (currentRound = Number(snap.val()) || 1)),
			onValue(ref(db, `${ROOT}/players`), (snap) => (roster = normalizePlayers(snap.val()))),
			onValue(ref(db, `${ROOT}/rounds`), (snap) => (roundsTree = snap.val() || {})),
			onValue(ref(db, `${ROOT}/history`), (snap) => (historyMap = snap.val() || {}))
		];
		const interval = setInterval(tick, 500);
		return () => {
			stops.forEach((stop) => stop());
			clearInterval(interval);
		};
	});

	// The event as it stood through the live round, as the overlays have it.
	$: upTo = throughRound(historyMap, roundsTree, currentRound);
	$: rounds = Object.keys(roundsTree).map(Number).filter(Number.isInteger);
	$: latestRound = rounds.length ? Math.max(...rounds) : 1;
	$: live = roster.map((p) => {
		const r = recordAfter(upTo.historyMap, p.id, currentRound);
		const dropped = p.dropped && (currentRound >= latestRound || r.losses >= LOSSES_TO_DROP);
		return { ...p, wins: r.wins, losses: r.losses, dropped };
	});
	$: byId = Object.fromEntries(live.map((p) => [p.id, p]));

	// Each seat's player in the tournament, found by name, and their matches
	// through the live round: the opponent, the table and the result.
	const key = (name) =>
		String(name || '')
			.trim()
			.toLowerCase();
	const findPlayer = (name, roster) =>
		name.trim() ? roster.find((p) => key(p.name) === key(name)) : undefined;
	$: histories = Object.fromEntries(
		['p1', 'p2'].map((seat) => {
			const me = findPlayer(players[seat].name || '', live);
			if (!me) return [seat, null];
			const rounds = Object.values(upTo.historyMap[me.id] || {})
				.filter((h) => h && Number(h.round) <= currentRound)
				.sort((a, b) => Number(a.round) - Number(b.round))
				.map((h) => {
					const res = String(h.result || '').toUpperCase();
					const bye = res === 'B' || res === 'BYE';
					const opp = h.opponentId === '' || h.opponentId == null ? null : byId[h.opponentId];
					return {
						round: Number(h.round),
						table: h.table,
						bye,
						result: bye ? 'Bye' : res === 'W' ? 'Win' : res === 'L' ? 'Loss' : '',
						won: bye || res === 'W',
						opponent: opp
					};
				});
			return [seat, { me, rounds }];
		})
	);

	// A name that would run past its room is set smaller, never cut off:
	// players' and heroes' names are always shown whole.
	function fit(node) {
		const base = parseFloat(getComputedStyle(node).fontSize);
		// The box is capped at its cell's width, so what does not fit shows as
		// scroll width beyond the client width.
		const measure = () => {
			node.style.fontSize = `${base}px`;
			const room = node.clientWidth;
			const drawn = node.scrollWidth;
			if (drawn > room + 1)
				node.style.fontSize = `${Math.max(12, Math.floor((base * room) / drawn))}px`;
		};
		measure();
		const watch = new ResizeObserver(measure);
		watch.observe(node.parentElement);
		return { update: measure, destroy: () => watch.disconnect() };
	}
</script>

<div class="stage text-white">
	<!-- The camera frames: outlines and labels only, the cameras show through. -->
	{#each FRAMES as f (f.label)}
		<div
			class="frame"
			style="left: {f.x}px; top: {f.y}px; width: {f.w}px; height: {f.h}px;"
			aria-label="{f.label} camera frame"
		>
			<span class="frame-label">{f.label}</span>
		</div>
	{/each}

	<div class="desk">
		<!-- Table 1 and the clock -->
		<section class="match" aria-label="Table 1">
			<p class="caption">
				Table 1{#if eventText}<span class="dot">·</span><span class="event">{eventText}</span
					>{/if}<span class="dot">·</span>Round {currentRound}
			</p>
			<!-- The two seats side by side, each with their life total large. -->
			<div class="players">
				{#each ['p1', 'p2'] as key, i (key)}
					{@const p = players[key]}
					<div class="player {key}">
						{#if p.hero}<img class="card-art" src={heroImageUrl(p.hero)} alt="" />{/if}
						<div class="player-top">
							<span class="who">
								<span class="seat">P{i + 1}</span>
								{#if p.pronouns}<span class="pronouns">{p.pronouns}</span>{/if}
								<span class="name">{p.name || '—'}</span>
								<span class="hero">{p.hero || '—'}</span>
							</span>
						</div>
						<div class="player-foot">
							{#if p.record}<span class="badge">{p.record}</span>{/if}
							<span class="life">
								<span class="life-label">Life</span>
								<span class="life-total">{life[key] ?? '—'}</span>
							</span>
						</div>
					</div>
				{/each}
			</div>
			<div class="clock" class:paused={timer.isPaused}>
				<span class="clock-label">{timer.isPaused ? 'Round clock · paused' : 'Round clock'}</span>
				<span class="time">{clock}</span>
			</div>
		</section>

		<!-- Each player's matches so far, on their side -->
		{#each ['p1', 'p2'] as seat, i (seat)}
			{@const h = histories[seat]}
			<section class="history {seat}" aria-label="P{i + 1} match history">
				<p class="caption">
					P{i + 1} · {players[seat].name || '—'}{#if h}<span class="dot">·</span>{h.me.wins}-{h.me
							.losses}{/if}
				</p>
				{#if !h}
					<p class="empty">
						{players[seat].name ? 'Not in the tournament field' : 'No player on this seat'}
					</p>
				{:else if !h.rounds.length}
					<p class="empty">No matches yet</p>
				{:else}
					<ol class="list">
						{#each h.rounds as r (r.round)}
							<li class="line" class:win={r.won} class:loss={!r.won && r.result === 'Loss'}>
								<span class="rank">R{r.round}</span>
								<span class="portrait">
									{#if r.opponent?.hero}<img
											src={heroImageUrl(r.opponent.hero)}
											alt=""
											loading="lazy"
										/>{/if}
								</span>
								{#if r.bye}
									<span class="pname">Bye</span>
								{:else}
									{#key r.opponent?.name}
										<span class="pname" use:fit
											>{r.opponent?.name || '—'}<small>{r.opponent?.hero || ''}</small></span
										>
									{/key}
								{/if}
								<span class="table">{r.table ? `T${r.table}` : ''}</span>
								<span class="result">{r.result}</span>
							</li>
						{/each}
					</ol>
				{/if}
			</section>
		{/each}
	</div>
</div>

<style>
	/* A camera's frame: a tan outline with its name in the corner, nothing
	   inside. */
	.frame {
		position: absolute;
		box-sizing: border-box;
		border: 2px solid rgba(217, 180, 153, 0.7);
	}

	.frame-label {
		position: absolute;
		left: 0;
		top: 0;
		padding: 4px 10px;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #0b0f19;
		background: rgba(217, 180, 153, 0.9);
	}

	.stage {
		position: relative;
		width: 1920px;
		height: 1080px;
		overflow: hidden;
		--tan: #d9b499;
		--bar: rgba(17, 24, 39, 0.75);
		font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
	}

	/* The desk under the cameras: three panels across, on a dark ground so
	   the desk can read it whatever is behind. */
	.desk {
		position: absolute;
		left: 0;
		top: 628px;
		width: 1920px;
		height: 452px;
		box-sizing: border-box;
		padding: 16px 20px 18px;
		display: grid;
		grid-template-columns: 1fr 540px 1fr;
		gap: 16px;
		background: #0b0f19;
		border-top: 2px solid var(--tan);
	}

	/* Across the desk: P1's matches at the left, Table 1 in the middle, P2's
	   at the right. */
	.history.p1 {
		order: 1;
	}

	.match {
		order: 2;
	}

	.history.p2 {
		order: 3;
	}

	.empty {
		margin: 8px 0 0;
		font-size: 16px;
		color: rgba(255, 255, 255, 0.5);
	}

	section {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px 16px;
		background: var(--bar);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
	}

	.caption {
		margin: 0 0 4px;
		font-size: 14px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--tan);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.caption .event {
		color: #fff;
	}

	.dot {
		margin: 0 10px;
	}

	/* Table 1: the two seats as columns, each a card -- portrait, seat and
	   pronouns, name, hero, then the record and the life total. */
	.players {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.player {
		position: relative;
		min-width: 0;
		display: flex;
		flex-direction: column;
		/* The words sit at the foot of the card, the art showing above them. */
		justify-content: flex-end;
		gap: 8px;
		padding: 10px 12px;
		background: rgba(255, 255, 255, 0.04);
		border-left: 4px solid #dc2626;
		overflow: hidden;
	}

	/* The hero's art behind the card, faint, cropped from the still's top
	   right; the text sits over it. */
	.card-art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: right top;
		opacity: 0.22;
		pointer-events: none;
	}

	.player > :not(.card-art) {
		position: relative;
	}

	.player.p2 {
		border-left-color: #2563eb;
	}

	.player-top {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		min-width: 0;
	}

	.seat {
		font-size: 14px;
		font-weight: 800;
		letter-spacing: 0.1em;
		color: #fff;
	}

	.who {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	/* On the cards the names wrap onto more lines rather than shrinking or
	   being cut short. */
	.name {
		font-size: 24px;
		font-weight: 700;
		line-height: 1.1;
		overflow-wrap: anywhere;
	}

	/* The pronouns as a small solid tan chip, dark type, so they read over the
	   art. */
	.pronouns {
		align-self: flex-start;
		margin-bottom: 2px;
		padding: 2px 7px;
		font-size: 14px;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-transform: none;
		color: #0b0f19;
		background: var(--tan);
		white-space: nowrap;
	}

	.player-foot {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 8px;
	}

	.life {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.life-label {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--tan);
	}

	.life-total {
		font-size: 56px;
		font-weight: 800;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.hero {
		font-size: 15px;
		font-style: italic;
		font-weight: 600;
		line-height: 1.2;
		color: var(--tan);
		overflow-wrap: anywhere;
	}

	.badge {
		padding: 3px 8px;
		font-size: 16px;
		font-weight: 800;
		letter-spacing: 0.06em;
		color: #0b0f19;
		background: var(--tan);
		white-space: nowrap;
	}

	/* The clock, large, red while it runs under five minutes, dimmed paused. */
	.clock {
		margin-top: auto;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		padding: 6px 10px 0;
		border-top: 1px solid rgba(217, 180, 153, 0.35);
	}

	.clock-label {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--tan);
	}

	.time {
		font-size: 56px;
		font-weight: 800;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.02em;
	}

	.clock.paused .time {
		color: rgba(255, 255, 255, 0.55);
	}

	/* The compact lists: a line a match. */
	.list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.line {
		display: grid;
		grid-template-columns: 36px 36px minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 10px;
		height: 44px;
		padding: 0 12px;
		background: rgba(255, 255, 255, 0.04);
		font-size: 19px;
		font-weight: 600;
		border-left: 3px solid rgba(255, 255, 255, 0.12);
	}

	.line.win {
		border-left-color: #4ade80;
	}

	.line.loss {
		border-left-color: #f87171;
	}

	/* The opponent's hero, a small square cropped from the still's top right
	   as the overlays crop it. */
	.portrait {
		width: 36px;
		height: 36px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.06);
		box-shadow: inset 0 0 0 1px rgba(217, 180, 153, 0.35);
	}

	.portrait img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: right top;
		transform: scale(1.35);
		transform-origin: right top;
	}

	.rank {
		font-size: 14px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.55);
		font-variant-numeric: tabular-nums;
	}

	.pname {
		min-width: 0;
		white-space: nowrap;
		width: max-content;
		max-width: 100%;
		overflow: hidden;
	}

	.pname small {
		margin-left: 8px;
		font-size: 14px;
		font-style: italic;
		font-weight: 600;
		color: var(--tan);
	}

	.table {
		font-size: 14px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.5);
	}

	/* The result: green for a win or a bye, red for a loss. */
	.result {
		min-width: 56px;
		text-align: center;
		padding: 3px 8px;
		font-size: 14px;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #0b0f19;
		background: rgba(255, 255, 255, 0.5);
	}

	.line.win .result {
		background: #4ade80;
	}

	.line.loss .result {
		background: #f87171;
	}
</style>
