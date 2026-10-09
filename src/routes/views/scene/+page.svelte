<script context="module">
	// Three 16:9 camera frames across the top, the match area large at the
	// left and the casters' and interview frames stacked beside it, sized so
	// the stack is exactly as tall as the match frame: 1252x704 and two of
	// 612x344 with the gap between. The desk has the 340px beneath.
	const MARGIN = 20;
	const GAP = 16;
	const MATCH_W = 1252;
	const MATCH_H = Math.round((MATCH_W * 9) / 16);
	const SIDE_W = 1920 - 2 * MARGIN - GAP - MATCH_W;
	const SIDE_H = Math.round((MATCH_H - GAP) / 2);
	const SIDE_X = MARGIN + MATCH_W + GAP;
	const FRAMES = [
		{ label: 'Match area', x: MARGIN, y: MARGIN, w: MATCH_W, h: MATCH_H, main: true },
		{ label: 'Casters', x: SIDE_X, y: MARGIN, w: SIDE_W, h: SIDE_H },
		{ label: 'Interview', x: SIDE_X, y: MARGIN + SIDE_H + GAP, w: SIDE_W, h: SIDE_H }
	];
	const DESK_Y = MARGIN + MATCH_H + GAP;
</script>

<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';
	import { formatTime } from '$lib/timerDisplay';
	import { heroImageUrl } from '$lib/heroMedia';

	// The scene monitor, 1920x1080, a sibling of the casters' confidence view:
	// three camera frames drawn as outlines for the cameras to sit in, the
	// match area taking most of the width, and under them the table -- the
	// two seats with their records, heroes, pronouns and life totals, and the
	// round clock between them.
	let players = { p1: {}, p2: {} };
	let life = { p1: null, p2: null };
	let timer = { remainingTime: 0, startTime: null, isPaused: true, isCountingUp: false };
	let clock = '00:00';
	let eventText = '';
	let currentRound = 1;

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
			onValue(
				ref(db, 'tournament/currentRound'),
				(snap) => (currentRound = Number(snap.val()) || 1)
			)
		];
		const interval = setInterval(tick, 500);
		return () => {
			stops.forEach((stop) => stop());
			clearInterval(interval);
		};
	});
</script>

<svelte:head>
	<title>Scene</title>
</svelte:head>

<div class="stage text-white">
	<!-- The camera frames: outlines and labels only, the cameras show through. -->
	{#each FRAMES as f (f.label)}
		<div
			class="frame"
			class:main={f.main}
			style="left: {f.x}px; top: {f.y}px; width: {f.w}px; height: {f.h}px;"
			aria-label="{f.label} camera frame"
		>
			<span class="frame-label">{f.label}</span>
		</div>
	{/each}

	<div class="desk" style="top: {DESK_Y}px; height: {1080 - DESK_Y}px;">
		<section class="match" aria-label="Table 1">
			<p class="caption">
				Table 1{#if eventText}<span class="dot">·</span><span class="event">{eventText}</span
					>{/if}<span class="dot">·</span>Round {currentRound}
			</p>
			<!-- The two seats either side of the clock, each with their life total large. -->
			<div class="table">
				{#each ['p1', 'p2'] as key, i (key)}
					<div class="player {key}">
						{#if players[key].hero}<img
								class="card-art"
								src={heroImageUrl(players[key].hero)}
								alt=""
							/>{/if}
						<div class="player-top">
							<span class="who">
								<span class="seat">P{i + 1}</span>
								{#if players[key].pronouns}<span class="pronouns">{players[key].pronouns}</span
									>{/if}
								<span class="name">{players[key].name || '—'}</span>
								<span class="hero">{players[key].hero || '—'}</span>
							</span>
						</div>
						<div class="player-foot">
							{#if players[key].record}<span class="badge">{players[key].record}</span>{/if}
							<span class="life">
								<span class="life-label">Life</span>
								<span class="life-total">{life[key] ?? '—'}</span>
							</span>
						</div>
					</div>
					{#if i === 0}
						<div class="clock" class:paused={timer.isPaused}>
							<span class="clock-label"
								>{timer.isPaused ? 'Round clock · paused' : 'Round clock'}</span
							>
							<span class="time">{clock}</span>
						</div>
					{/if}
				{/each}
			</div>
		</section>
	</div>
</div>

<style>
	/* A camera's frame: a tan outline with its name in the corner, nothing
	   inside. The match area's is a touch heavier, as the one that matters. */
	.frame {
		position: absolute;
		box-sizing: border-box;
		border: 2px solid rgba(217, 180, 153, 0.7);
	}

	.frame.main {
		border-width: 3px;
		border-color: rgba(217, 180, 153, 0.9);
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

	/* The match area's label sits in its bottom right corner, out of the way
	   of the players' side of the shot. */
	.frame.main .frame-label {
		left: auto;
		top: auto;
		right: 0;
		bottom: 30px;
		font-size: 15px;
		padding: 5px 12px;
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

	/* The desk under the cameras, on a dark ground so it reads whatever is
	   behind. */
	.desk {
		position: absolute;
		left: 0;
		width: 1920px;
		box-sizing: border-box;
		padding: 16px 20px 18px;
		background: #0b0f19;
		border-top: 2px solid var(--tan);
	}

	section {
		height: 100%;
		min-width: 0;
		box-sizing: border-box;
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

	/* Table 1 across the desk: P1's card, the clock, P2's card. */
	.table {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr 420px 1fr;
		gap: 12px;
	}

	.player {
		position: relative;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 8px;
		padding: 10px 14px;
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

	/* Names wrap onto more lines rather than shrinking or being cut short. */
	.name {
		font-size: 30px;
		font-weight: 700;
		line-height: 1.1;
		overflow-wrap: anywhere;
	}

	.pronouns {
		align-self: flex-start;
		margin-bottom: 2px;
		padding: 2px 7px;
		font-size: 14px;
		font-weight: 700;
		letter-spacing: 0.02em;
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
		font-size: 64px;
		font-weight: 800;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.hero {
		font-size: 17px;
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

	/* The clock between the seats, large, dimmed when paused. */
	.clock {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 10px;
		background: rgba(255, 255, 255, 0.04);
		box-shadow: inset 0 0 0 1px rgba(217, 180, 153, 0.35);
	}

	.clock-label {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--tan);
	}

	.time {
		font-size: 96px;
		font-weight: 800;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.02em;
	}

	.clock.paused .time {
		color: rgba(255, 255, 255, 0.55);
	}
</style>
