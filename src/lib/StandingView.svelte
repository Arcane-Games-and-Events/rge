<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../firebaseClient';
	import {
		computeStandings as rank,
		top8Seeding,
		orderWithTop8,
		ordinal,
		WINS_TO_ADVANCE,
		LOSSES_TO_DROP
	} from '$lib/standings';
	import { heroImageUrl } from '$lib/heroMedia';

	const ROOT = 'tournament';

	let currentRound = 1;
	let eventText = '';

	// Which sources have reported at least once. The load sequence waits for all
	// of them, so nothing arrives part-way through it.
	let seen = { round: false, players: false, rounds: false, history: false, event: false };
	let players = [];
	let roundsTree = {};
	let historyMap = {};
	let standings = [];

	function normalizePlayers(map) {
		const ids = Object.keys(map || {})
			.map(Number)
			.filter(Number.isInteger);
		const maxId = Math.max(-1, ...ids);
		const arr = Array.from({ length: Math.max(maxId + 1, 0) }, (_, id) => ({
			id,
			name: '',
			hero: '',
			wins: 0,
			losses: 0,
			draws: 0,
			dropped: false
		}));
		for (const [k, v] of Object.entries(map || {})) {
			const id = Number(k);
			if (!Number.isInteger(id)) continue;
			arr[id] = {
				id,
				name: v?.name || '',
				hero: v?.hero || '',
				wins: Number(v?.wins) || 0,
				losses: Number(v?.losses) || 0,
				draws: Number(v?.draws) || 0,
				dropped: !!v?.dropped
			};
		}
		return arr;
	}

	// The arithmetic lives in $lib/standings, shared with the management page's
	// preview, so the producer sees the same order this draws.
	const computeStandings = () => {
		standings = rank(players, { roundsTree, historyMap, currentRound });
	};

	onMount(() => {
		const unsubEvent = onValue(ref(db, 'eventText'), (snap) => {
			eventText = snap.val() ?? '';
			seen.event = true;
		});
		const unsubRound = onValue(ref(db, `${ROOT}/currentRound`), (s) => {
			currentRound = s.val() || 1;
			seen.round = true;
			computeStandings();
		});
		const unsubPlayers = onValue(ref(db, `${ROOT}/players`), (s) => {
			players = normalizePlayers(s.val());
			seen.players = true;
			computeStandings();
		});
		const unsubRounds = onValue(ref(db, `${ROOT}/rounds`), (s) => {
			roundsTree = s.val() || {};
			seen.rounds = true;
			computeStandings();
		});
		const unsubHistory = onValue(ref(db, `${ROOT}/history`), (s) => {
			historyMap = s.val() || {};
			seen.history = true;
			computeStandings();
		});
		return () => {
			unsubEvent?.();
			unsubRound?.();
			unsubPlayers?.();
			unsubRounds?.();
			unsubHistory?.();
		};
	});

	// Standings for a 1920x1080 browser source, as a table in the look of the other
	// overlays under /views: white type and tan accents on translucent dark bars,
	// no plate behind the page. Sixteen places in two columns of eight, each row
	// the rank, portrait, name over hero, and the W - L, a bye counted as a win;
	// draws are not played. A player with no name is left out rather than shown
	// as a blank.
	const wld = (s) => `${s.record.wins + (s.record.byes || 0)}-${s.record.losses}`;

	// A player's standing in the event, said quietly: three wins locks a place in
	// the Top 8, three losses puts them out. The record and the bar's edge take
	// the colour; nothing else changes.
	const status = (s) =>
		s.record.wins + (s.record.byes || 0) >= WINS_TO_ADVANCE
			? 'advanced'
			: s.record.losses >= LOSSES_TO_DROP
				? 'out'
				: '';

	// The Top 8 seeds of the players already through, shown beside their names;
	// they head the table in seed order, with everyone else beneath by record.
	$: top8Seeds = top8Seeding(players, historyMap);
	$: placed = orderWithTop8(standings, top8Seeds)
		.filter((s) => s.name)
		.slice(0, 16);

	// Every row lives in one list and is placed by its rank -- the first eight
	// down the left column, the rest down the right -- so a change of rank is one
	// slide to the new spot, even from one column to the other. Pitch is the row
	// and the gap between rows.
	const COLUMN_X = [100, 990];
	const ROWS_TOP = 302;
	const PITCH = 90;
	const slotFor = (i) => ({ x: COLUMN_X[i < 8 ? 0 : 1], y: ROWS_TOP + (i % 8) * PITCH });

	// The load sequence waits until every source has reported and every portrait
	// on the page has finished loading -- or three seconds, so one missing image
	// cannot hold it -- then plays as one piece: the title wipes in, the rule
	// draws across, the subtitle and column headings fade up, and the bars
	// cascade down the left column and then the right. Later changes only move
	// rows; the sequence never replays.
	let play = false;
	let settled = false;
	let settledImages = 0;
	let ceiling = null;
	$: dataReady = Object.values(seen).every(Boolean) && placed.length > 0;
	$: expectedImages = placed.filter((s) => s.hero).length;
	$: if (dataReady && !play && !ceiling) ceiling = setTimeout(() => (play = true), 3000);
	$: if (dataReady && settledImages >= expectedImages && !play) play = true;
	$: if (play && ceiling) ceiling = clearTimeout(ceiling) ?? null;
	// Once the last bar has arrived the entrance is taken off the rows, so that
	// later changes -- a result, a drop, a new rank -- are plain transitions and
	// never replay it.
	$: if (play && !settled)
		setTimeout(() => (settled = true), ROWS_START_MS + 16 * ROW_STEP_MS + 700);
	const ROWS_START_MS = 1000;
	const ROW_STEP_MS = 55;

	// Portraits are revealed once decoded, so a row never shows a half-drawn image,
	// and each one that settles, either way, is counted toward the start.
	const reveal = (e) => {
		e.currentTarget.classList.add('loaded');
		settledImages += 1;
	};
	const hide = (e) => {
		e.currentTarget.style.visibility = 'hidden';
		settledImages += 1;
	};
</script>

<div class="stage text-white" class:play class:settled>
	<header class="heading">
		<h1 class="title">Standings</h1>
		<p class="subtitle">
			{#if eventText}<span class="event">{eventText}</span><span class="dot">·</span>{/if}Round {currentRound}
		</p>
	</header>

	{#each COLUMN_X as x (x)}
		<div class="row head" style="left: {x}px;" aria-hidden="true">
			<span></span><span></span><span></span><span></span>
			<span class="wld">W - L</span>
		</div>
	{/each}

	<ol class="list">
		{#each placed as s, i (s.id)}
			{@const at = slotFor(i)}
			<li class="slot" style="transform: translate({at.x}px, {at.y}px);">
				<div
					class="row {status(s)}"
					class:dropped={s.dropped}
					style="--delay: {ROWS_START_MS + i * ROW_STEP_MS}ms;"
				>
					<span class="rank">{s.rank}</span>
					<span class="portrait">
						{#if s.hero}
							<img src={heroImageUrl(s.hero)} alt="" on:load={reveal} on:error={hide} />
						{/if}
					</span>
					<span class="who">
						<span class="name">{s.name}</span>
						<span class="hero">{s.hero || '—'}</span>
					</span>
					{#if top8Seeds.has(s.id)}
						<span class="seed top8"
							><span class="label">Top 8</span>{ordinal(top8Seeds.get(s.id))}</span
						>
					{:else}
						<span></span>
					{/if}
					{#if s.dropped}
						<span class="wld status">Dropped</span>
					{:else}
						<span class="wld">{wld(s)}</span>
					{/if}
				</div>
			</li>
		{/each}
	</ol>
</div>

<style>
	/* Pinned to the browser source size so every row lands on the same pixels
	   whatever window is around it. */
	.stage {
		position: relative;
		width: 1920px;
		height: 1080px;
		overflow: hidden;
		--tan: #d9b499;
		--bar: rgba(17, 24, 39, 0.6);
	}

	.heading {
		position: absolute;
		left: 100px;
		top: 56px;
		width: 1720px;
	}

	.title {
		margin: 0 0 20px;
		padding-bottom: 20px;
		font-size: 80px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		position: relative;
		opacity: 0;
	}

	/* The rule under the title is its own element so it can draw from the left. */
	.title::after {
		content: '';
		position: absolute;
		left: 0;
		bottom: 0;
		width: 100%;
		height: 2px;
		background: var(--tan);
		transform: scaleX(0);
		transform-origin: left;
	}

	/* The event's name, a dot, then the round, on one line. */
	.subtitle {
		margin: 0;
		opacity: 0;
		white-space: nowrap;
		font-size: 30px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--tan);
	}

	.event {
		color: #fff;
	}

	.dot {
		margin: 0 18px;
	}

	/* The two column headings sit above the rows; the rows themselves are placed
	   by rank, each in a slot that slides to wherever its rank moves it. */
	.row.head {
		position: absolute;
		top: 256px;
		width: 830px;
	}

	.list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.slot {
		position: absolute;
		left: 0;
		top: 0;
		width: 830px;
		transition: transform 600ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.row {
		display: grid;
		grid-template-columns: 92px 80px minmax(0, 1fr) auto 190px;
		align-items: center;
		column-gap: 20px;
		height: 80px;
		padding-right: 12px;
		box-sizing: border-box;
		background: var(--bar);
		border-left: 4px solid var(--tan);
	}

	.row.head {
		height: 34px;
		margin-bottom: 12px;
		background: none;
		border-left-color: transparent;
		opacity: 0;
		font-size: 17px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--tan);
	}

	.row.head .wld {
		background: none;
		font-size: 17px;
		height: auto;
	}

	.list .row {
		opacity: 0;
		transform: translateX(-30px);
		transition: opacity 400ms ease;
	}

	/* Nothing moves until the data is in; then everything runs off one clock. */
	.play .title {
		animation: wipeIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
	}

	.play .title::after {
		animation: drawRule 0.8s cubic-bezier(0.22, 1, 0.36, 1) 350ms forwards;
	}

	.play .subtitle {
		animation: fadeUp 0.5s ease-out 650ms forwards;
	}

	.play .row.head {
		animation: fadeUp 0.5s ease-out 800ms forwards;
	}

	.play .list .row {
		animation: slideReveal 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
		animation-delay: var(--delay, 0ms);
	}

	/* After the entrance, rows just are: visible, in place, dimmed if dropped. */
	.settled .list .row {
		animation: none;
		opacity: 1;
		transform: none;
		clip-path: none;
	}

	.settled .list .row.dropped {
		opacity: 0.55;
	}

	@keyframes wipeIn {
		0% {
			opacity: 0;
			transform: translateX(-40px);
			clip-path: inset(0 100% 0 0);
		}
		100% {
			opacity: 1;
			transform: translateX(0);
			clip-path: inset(0 0 0 0);
		}
	}

	@keyframes drawRule {
		to {
			transform: scaleX(1);
		}
	}

	@keyframes fadeUp {
		0% {
			opacity: 0;
			transform: translateY(10px);
		}
		100% {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* The rank's cell runs from the bar's edge to the portrait, so the number sits
	   the same distance from each. */
	.rank {
		margin-right: -20px;
		font-size: 32px;
		font-weight: 700;
		line-height: 1;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	/* The portrait: a square the full height of the bar, cropped from the still's
	   upper right and enlarged, where these stills keep the face, with a hairline
	   of tan around it -- as on the metagame and the bracket. */
	.portrait {
		width: 80px;
		height: 80px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.08);
		box-shadow: inset 0 0 0 1px rgba(217, 180, 153, 0.45);
	}

	.portrait img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: right top;
		transform: scale(1.35);
		transform-origin: right top;
		opacity: 0;
		transition: opacity 250ms ease;
	}

	.portrait img:global(.loaded) {
		opacity: 1;
	}

	.who {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
		line-height: 1;
	}

	.name {
		font-size: 27px;
		font-weight: 700;
		letter-spacing: 0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.hero {
		font-size: 18px;
		font-style: italic;
		font-weight: 700;
		color: var(--tan);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.wld {
		height: 56px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 32px;
		font-weight: 700;
		letter-spacing: 0.1em;
		font-variant-numeric: tabular-nums;
		background: rgba(255, 255, 255, 0.1);
	}

	/* The Top 8 seed, said in full: a green badge reading TOP 8 over the seed, as
	   on the pairings. */
	.seed.top8 {
		height: 44px;
		padding: 0 14px;
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		border: 1px solid #4ade80;
		color: #4ade80;
		font-size: 16px;
		font-weight: 700;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.seed.top8 .label {
		font-size: 9px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	/* Advanced: green record and edge. Out: red record and edge, the bar a
	   little dimmer. Both fade in as the result lands. */
	.list .row {
		transition:
			opacity 400ms ease,
			border-color 400ms ease;
	}

	.list .row .wld {
		transition: color 400ms ease;
	}

	.row.advanced {
		border-left-color: #4ade80;
	}

	.row.advanced .wld {
		color: #4ade80;
	}

	.row.out {
		border-left-color: #f87171;
	}

	.row.out .wld {
		color: #f87171;
	}

	.settled .list .row.out {
		opacity: 0.7;
	}

	.wld.status {
		font-size: 20px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #f87171;
	}

	.play:not(.settled) .list .row.dropped {
		animation-name: slideRevealDim;
	}

	@keyframes slideReveal {
		0% {
			opacity: 0;
			transform: translateX(-30px);
			clip-path: inset(0 100% 0 0);
		}
		100% {
			opacity: 1;
			transform: translateX(0);
			clip-path: inset(0 0 0 0);
		}
	}

	@keyframes slideRevealDim {
		0% {
			opacity: 0;
			transform: translateX(-30px);
			clip-path: inset(0 100% 0 0);
		}
		100% {
			opacity: 0.55;
			transform: translateX(0);
			clip-path: inset(0 0 0 0);
		}
	}
</style>
