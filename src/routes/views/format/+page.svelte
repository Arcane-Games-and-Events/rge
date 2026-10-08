<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';
	import { FORMAT_DEMO_PATH, toStep, walkThrough } from '$lib/formatDemo';
	import { normalizePlayers } from '$lib/tournament';
	import { heroImageUrl } from '$lib/heroMedia';

	// The Swiss format graphic, for a 1920x1080 browser source over a blank
	// scene: the bracket of the supplied artwork drawn again at the same place
	// and in the same colours -- the match boxes with their green, red and gold
	// outlines and paths, the Advance and Eliminated boxes with their player
	// squares, and the Three Wins and Three Losses labels; the titles and the
	// logo are the scene's -- and brought in
	// from left to right, each piece sliding into place as a wave crosses the
	// frame and each line drawing itself along its length.
	let play = false;
	// The walk-through: the tournament's field, stepped from the control page,
	// each player a portrait that slides from its square to the next as the
	// rounds are played and into the Advance or Eliminated boxes at the end.
	let step = 0;
	let players = [];
	let round1 = {};
	let field = false;
	onMount(() => {
		document.fonts.ready.then(() => (play = true));
		const stops = [
			onValue(ref(db, FORMAT_DEMO_PATH), (snap) => (step = toStep(snap.val()?.step))),
			onValue(ref(db, 'tournament/players'), (snap) => {
				players = normalizePlayers(snap.val()).filter((p) => p.name);
				field = true;
			}),
			onValue(ref(db, 'tournament/rounds/1/pairings'), (snap) => (round1 = snap.val() || {}))
		];
		return () => stops.forEach((stop) => stop());
	});
	$: steps = walkThrough(players, round1);
	// Step 0 is the bracket alone; the players come on at step 1 and the
	// rounds play from step 2. When they come on while the bracket is still
	// drawing, they wait for it.
	const BRACKET_MS = 4200;
	let playStart = 0;
	let appearDelay = 0;
	$: if (play && !playStart) playStart = Date.now();
	$: shown = play && step >= 1;
	$: if (shown) appearDelay = Math.max(0, BRACKET_MS - (Date.now() - playStart));

	// The moves: a short pause, then the winners one after another, then a
	// pause, then the losers.
	const PAUSE_MS = 500;
	const BEAT_MS = 90;
	const MOVE_MS = 1000;
	// The losers set off once the last winner is most of the way there, after
	// a short breath, rather than waiting for the move to finish.
	const BREATH_MS = 150;
	const moveDelay = (o, i) => {
		if (!o) return i * BEAT_MS;
		const winnersMostlyDone = o.winners * BEAT_MS + MOVE_MS * 0.6;
		return PAUSE_MS + (o.phase ? winnersMostlyDone + BREATH_MS : 0) + o.rank * BEAT_MS;
	};
	$: placement = step >= 1 ? steps[Math.min(step - 1, steps.length - 1)] || new Map() : new Map();

	// Where a placement is on the frame: a match square, or a square in a
	// result box.
	const SQUARE = 33;
	const END_SQUARE = 36;
	function spot(at) {
		if (at.kind === 'match') {
			const g = GROUPS.find((x) => x.id === at.record);
			if (!g) return null;
			return { x: g.x + (at.side ? SQUARE + 63 : 0), y: g.top + at.row * PITCH, s: SQUARE };
		}
		const e = ENDS.find((x) => x.record === at.record);
		if (!e) return null;
		const span = e.n * END_SQUARE + (e.n - 1) * 17;
		return {
			x: e.x + Math.round((e.w - span) / 2) + at.slot * (END_SQUARE + 17),
			y: e.y + Math.round((e.h - END_SQUARE) / 2),
			s: END_SQUARE
		};
	}

	// A piece's delay is where it sits across the frame; a line's is where it
	// starts, since it draws from there. The wave sets off half a second after
	// the source loads and takes three and a half seconds to cross.
	const HOLD_MS = 500;
	const WAVE_MS = 3500;
	const at = (x) => Math.round(HOLD_MS + (x / 1920) * WAVE_MS);

	// Measured off the artwork. A match is a pair of squares with "vs" between,
	// on a 55px pitch; a group is a record's matches under its label, some
	// outlined in green (the unbeaten path), gold (mixed) or red (winless).
	const PITCH = 55;
	const count = (n) => Array.from({ length: n }, (_, k) => k);
	const GROUPS = [
		{
			id: '0-0',
			x: 253,
			top: 462,
			n: 8,
			label: { x: 317, y: 390 },
			box: [225, 364, 184, 558],
			tone: 'green'
		},
		{
			id: '1-0',
			x: 511,
			top: 408,
			n: 4,
			label: { x: 575, y: 359 },
			box: [483, 336, 184, 295],
			tone: 'green'
		},
		{
			id: '0-1',
			x: 511,
			top: 731,
			n: 4,
			label: { x: 575, y: 685 },
			box: [483, 660, 184, 293],
			tone: 'gold'
		},
		{
			id: '2-0',
			x: 770,
			top: 360,
			n: 2,
			label: { x: 834, y: 323 },
			box: [743, 305, 182, 172],
			tone: 'green'
		},
		{
			id: '1-1',
			x: 770,
			top: 567,
			n: 4,
			label: { x: 834, y: 521 },
			box: [743, 500, 182, 294],
			tone: 'gold'
		},
		{
			id: '0-2',
			x: 770,
			top: 872,
			n: 2,
			label: { x: 834, y: 834 },
			box: [743, 817, 182, 172],
			tone: 'red'
		},
		{
			id: '2-1',
			x: 1027,
			top: 451,
			n: 3,
			label: { x: 1091, y: 400 },
			box: [999, 378, 184, 243],
			tone: 'gold'
		},
		{
			id: '1-2',
			x: 1027,
			top: 725,
			n: 3,
			label: { x: 1091, y: 670 },
			box: [999, 652, 184, 242],
			tone: 'red'
		},
		{
			id: '2-2',
			x: 1271,
			top: 599,
			n: 3,
			label: { x: 1335, y: 546 },
			box: [1243, 522, 184, 242],
			tone: 'red'
		}
	];
	// Where the runs end: a box of player squares, white in green for those
	// through, dark in red for those out.
	// The players through are numbered on in order: 1 and 2 from the unbeaten
	// run, 3 to 5 from the 2-1 group, 6 to 8 from the 2-2 group.
	const ENDS = [
		{ x: 957, y: 305, w: 133, h: 55, n: 2, start: 1, tone: 'green', record: '3-0' },
		{ x: 1216, y: 408, w: 176, h: 56, n: 3, start: 3, tone: 'green', record: '3-1' },
		{ x: 1460, y: 562, w: 176, h: 57, n: 3, start: 6, tone: 'green', record: '3-2' },
		{ x: 958, y: 932, w: 133, h: 56, n: 2, tone: 'red', record: '0-3' },
		{ x: 1216, y: 808, w: 176, h: 55, n: 3, tone: 'red', record: '1-3' },
		{ x: 1458, y: 667, w: 176, h: 55, n: 3, tone: 'red', record: '2-3' }
	];
	// The paths between groups, as the artwork has them: each a line of its
	// own in the colour of the group or box it leads to, and as straight as the
	// layout allows. Where the destination's centre line falls within the
	// group's height the line runs straight across; otherwise it steps once,
	// out, up or down, and in. The lines from 2-0, 1-1 and 0-2 on to the next
	// round meet on one vertical midway between the two rounds, 962px across.
	// The bottom half mirrors the top about the
	// bracket's centre line, 643px down, so each line leaves and arrives at the
	// same spot as its counterpart.
	const LINES = [
		// 0-0: winners to 1-0, losers to 0-1
		{ d: 'M409 484 H483', tone: 'green' },
		{ d: 'M409 802 H483', tone: 'gold' },
		// 1-0: one line from the middle of its right side, forking up to 2-0
		// and down to 1-1
		{ d: 'M667 484 H697', tone: 'green' },
		{ d: 'M697 484 V391 H743', tone: 'green' },
		{ d: 'M697 484 V643 H743', tone: 'gold' },
		// 0-1: the same, forking up to 1-1 and down to 0-2
		{ d: 'M667 802 H697', tone: 'gold' },
		{ d: 'M697 802 V643 H743', tone: 'gold' },
		{ d: 'M697 802 V895 H743', tone: 'red' },
		// 2-0: its own line straight to the Advance box (1 and 2), and one from
		// the middle of its right side on to 2-1
		{ d: 'M925 332 H957', tone: 'green' },
		{ d: 'M925 391 H962 V500 H999', tone: 'gold' },
		// 1-1: the same, forking up to 2-1 and down to 1-2
		{ d: 'M925 643 H962', tone: 'gold' },
		{ d: 'M962 643 V500 H999', tone: 'gold' },
		{ d: 'M962 643 V786 H999', tone: 'red' },
		// 0-2: its own line straight to the Eliminated box, and one from the
		// middle of its right side on to 1-2
		{ d: 'M925 954 H958', tone: 'red' },
		{ d: 'M925 895 H962 V786 H999', tone: 'red' },
		// 2-1: its own line straight to the Advance box (3 to 5), and one from
		// the middle of its right side on to 2-2
		{ d: 'M1183 436 H1216', tone: 'green' },
		{ d: 'M1183 500 H1211 V643 H1243', tone: 'red' },
		// 1-2: its own line straight to the Eliminated box, and one from the
		// middle of its right side on to 2-2
		{ d: 'M1183 850 H1216', tone: 'red' },
		{ d: 'M1183 786 H1211 V643 H1243', tone: 'red' },
		// 2-2: winners through (6 to 8), losers out
		{ d: 'M1427 590 H1460', tone: 'green' },
		{ d: 'M1427 696 H1458', tone: 'red' }
	].map((l) => ({ ...l, wait: 0 }));
	const startX = (d) => Number(/M(\d+)/.exec(d)[1]);
</script>

<svelte:head>
	<link
		href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="stage" class:play>
	<!-- The lines and outlines, each drawn along its length. -->
	<svg class="lines" viewBox="0 0 1920 1080" aria-hidden="true">
		{#each GROUPS as g (g.id)}
			{#if g.box}
				<rect
					class="frame {g.tone}"
					x={g.box[0] + 2}
					y={g.box[1] + 2}
					width={g.box[2] - 4}
					height={g.box[3] - 4}
					pathLength="1"
					style="--delay: {at(g.box[0])}ms;"
				/>
			{/if}
		{/each}
		{#each LINES as l, i (i)}
			<path
				class="line {l.tone}"
				d={l.d}
				pathLength="1"
				style="--delay: {at(startX(l.d)) + 350 + l.wait}ms;"
			/>
		{/each}
	</svg>

	<!-- The groups: a record over its matches. -->
	{#each GROUPS as g (g.id)}
		<div
			class="piece record"
			style="left: {g.label.x}px; top: {g.label.y}px; --delay: {at(g.label.x)}ms;"
		>
			{g.id}
		</div>
		{#each count(g.n) as i (i)}
			<div
				class="piece match"
				style="left: {g.x}px; top: {g.top + i * PITCH}px; --delay: {at(g.x) + i * 40}ms;"
			>
				<span class="sq"></span><span class="vs">VS</span><span class="sq"></span>
			</div>
		{/each}
	{/each}

	<!-- Where the runs end. -->
	{#each ENDS as e, i (i)}
		<div
			class="piece end {e.tone}"
			style="left: {e.x}px; top: {e.y}px; width: {e.w}px; height: {e.h}px; --delay: {at(e.x) +
				300}ms;"
		>
			{#each count(e.n) as k (k)}<span class="player">{e.tone === 'green' ? e.start + k : ''}</span
				>{/each}
		</div>
	{/each}

	<!-- The players, each on their square, sliding to the next as the rounds go:
	     the round's winners first, table by table, then its losers. -->
	{#if field && shown}
		<!-- Taken back to blank, the players fade away together rather than vanishing. -->
		<div class="heroes" out:fade={{ duration: 900 }}>
			{#each players as p, i (p.id)}
				{@const at = placement.get(p.id)}
				{@const s = at && spot(at)}
				{#if s}
					<div
						class="hero in"
						style:--appear="{appearDelay + i * 60}ms"
						style="left: {s.x}px; top: {s.y}px; width: {s.s}px; height: {s.s}px; transition-delay: {moveDelay(
							at.order,
							i
						)}ms;"
						title={p.name}
					>
						{#if p.hero}<img src={heroImageUrl(p.hero)} alt={p.name} />{/if}
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- The rule of it, each word and box where the artwork has it. -->
	<div class="piece rule-text" style="left: 1172px; top: 296px; --delay: {at(1300)}ms;">
		Three Wins:
	</div>
	<div
		class="piece rule-box green"
		style="left: 1456px; top: 296px; width: 255px; --delay: {at(1456)}ms;"
	>
		Advance
	</div>
	<div class="piece rule-text" style="left: 1153px; top: 932px; --delay: {at(1300)}ms;">
		Three Losses:
	</div>
	<div
		class="piece rule-box red"
		style="left: 1483px; top: 932px; width: 316px; --delay: {at(1483)}ms;"
	>
		Eliminated
	</div>
</div>

<style>
	.stage {
		position: relative;
		width: 1920px;
		height: 1080px;
		overflow: hidden;
		/* Tailwind's green-600, red-800 and yellow-600, with green-900 for the
		   numerals and red-900 for the squares in the red boxes. */
		--green: #16a34a;
		--green-dark: #14532d;
		--red: #991b1b;
		--red-dark: #7f1d1d;
		--tan: #ca8a04;
		font-family: 'Oswald', 'Inter', ui-sans-serif, system-ui, sans-serif;
		font-style: italic;
		color: #fff;
	}

	.piece {
		position: absolute;
		opacity: 0;
	}

	/* The bracket */
	.lines {
		position: absolute;
		inset: 0;
		width: 1920px;
		height: 1080px;
		pointer-events: none;
	}

	.frame,
	.line {
		fill: none;
		stroke-width: 4;
		stroke-linejoin: miter;
		stroke-linecap: butt;
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
	}

	.green {
		stroke: var(--green);
	}

	.red {
		stroke: var(--red);
	}

	.gold {
		stroke: var(--tan);
	}

	.record {
		transform: translateX(-50%);
		font-size: 27px;
		font-weight: 600;
		letter-spacing: 0.02em;
		line-height: 1;
		white-space: nowrap;
	}

	.match {
		display: flex;
		align-items: center;
		gap: 0;
		height: 33px;
	}

	.sq {
		width: 33px;
		height: 33px;
		background: rgba(130, 132, 134, 0.45);
	}

	.vs {
		width: 63px;
		text-align: center;
		font-size: 17px;
		font-weight: 600;
		letter-spacing: 0.06em;
		color: #fff;
	}

	/* The ends of the runs: a box of player squares. */
	.end {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 17px;
	}

	.end.green {
		background: var(--green);
	}

	.end.red {
		background: var(--red);
	}

	/* The player squares, numbered: white with the number in green through to
	   the Top 8, dark with the number in red for those out. */
	.player {
		width: 36px;
		height: 36px;
		box-sizing: border-box;
		/* The italic numeral leans right, so it is held left of centre. */
		padding-right: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f0fff4;
		color: var(--green-dark);
		font-size: 24px;
		font-weight: 700;
		line-height: 36px;
		text-align: center;
	}

	.end.red .player {
		background: var(--red-dark);
	}

	/* The rule of it, at the right. */
	.rule-text {
		height: 68px;
		display: flex;
		align-items: center;
		font-size: 44px;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		line-height: 1;
		white-space: nowrap;
	}

	.rule-box {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 68px;
		font-size: 44px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #fff;
	}

	.rule-box.green {
		background: var(--green);
	}

	.rule-box.red {
		background: var(--red);
	}

	/* A player: a portrait in a square, cropped from the still's top right as
	   the overlays crop it. It fades in once the bracket is drawn, and slides to
	   its next square when the round is played, one player a beat after the
	   last. */
	.heroes {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.hero {
		position: absolute;
		box-sizing: border-box;
		overflow: hidden;
		background: #111;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5);
		opacity: 0;
		transition:
			left 1s cubic-bezier(0.22, 1, 0.36, 1),
			top 1s cubic-bezier(0.22, 1, 0.36, 1),
			width 1s ease,
			height 1s ease;
	}

	/* The players come on one after another when called for, waiting for the
	   bracket to finish drawing if it has not; the moves after that follow the
	   step at once. */
	.hero.in {
		animation: heroIn 0.6s ease var(--appear, 0ms) forwards;
	}

	@keyframes heroIn {
		to {
			opacity: 1;
		}
	}

	.hero img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: right top;
		transform: scale(1.35);
		transform-origin: right top;
	}

	/* The load: each piece slides in from the left and fades up as the wave
	   reaches it; each line draws along its length. */
	.play .piece {
		animation: land 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
		animation-delay: var(--delay, 0ms);
	}

	.play .record {
		animation-name: landCentred;
	}

	.play .frame {
		animation: draw 1.3s ease-out forwards;
		animation-delay: var(--delay, 0ms);
	}

	.play .line {
		animation: draw 0.8s ease-out forwards;
		animation-delay: var(--delay, 0ms);
	}

	@keyframes land {
		0% {
			opacity: 0;
			transform: translateX(-26px);
		}
		100% {
			opacity: 1;
			transform: translateX(0);
		}
	}

	@keyframes landCentred {
		0% {
			opacity: 0;
			transform: translateX(calc(-50% - 26px));
		}
		100% {
			opacity: 1;
			transform: translateX(-50%);
		}
	}

	@keyframes draw {
		to {
			stroke-dashoffset: 0;
		}
	}
</style>
