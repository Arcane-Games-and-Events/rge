<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../firebaseClient';
	import { heroImageUrl } from '$lib/heroMedia';
	import { top8Seeding, ordinal, WINS_TO_ADVANCE, LOSSES_TO_DROP } from '$lib/standings';

	// Pairings for a 1920x1080 browser source, in the look of the standings: white
	// type and tan accents on translucent dark bars, eight tables in two columns of
	// four, each a caption over two player bars with the record on a plate. A
	// result turns the winner's edge green and dims the loser; a bye is named as
	// such. Draws are not played.
	const ROOT = 'tournament';

	let currentRound = 1;
	let eventText = '';

	// Which sources have reported at least once. The load sequence waits for all
	// of them, so nothing arrives part-way through it.
	let seen = { round: false, players: false, pairings: false, event: false, history: false };
	let historyMap = {};
	let players = {};
	let pairings = [];
	let unsubPairings = null;

	const isBye = (x) => x === 'BYE';
	const seatOf = (x) => (x === 'BYE' ? 'BYE' : x === 0 || x ? Number(x) : '');

	function attachPairingsListener(round) {
		unsubPairings?.();
		unsubPairings = onValue(ref(db, `${ROOT}/rounds/${round}/pairings`), (snap) => {
			const v = snap.val() || {};
			pairings = Object.values(v)
				.filter(Boolean)
				.map((m) => ({
					table: Number(m?.table) || 0,
					p1: seatOf(m?.p1),
					p2: seatOf(m?.p2),
					winner:
						m?.winner === 'draw' ? 'draw' : m?.winner === 0 || m?.winner ? Number(m.winner) : null
				}))
				.sort((a, b) => a.table - b.table);
			seen.pairings = true;
		});
	}

	onMount(() => {
		const unsubEvent = onValue(ref(db, 'eventText'), (snap) => {
			eventText = snap.val() ?? '';
			seen.event = true;
		});
		const unsub1 = onValue(ref(db, `${ROOT}/currentRound`), (s) => {
			currentRound = s.val() || 1;
			seen.round = true;
			attachPairingsListener(currentRound);
		});
		const unsub2 = onValue(ref(db, `${ROOT}/players`), (snap) => {
			const v = snap.val() || {};
			players = Object.fromEntries(
				Object.entries(v)
					.filter(([, p]) => p)
					.map(([id, p]) => [
						Number(id),
						{
							id: Number(id),
							name: p?.name || '',
							hero: p?.hero || '',
							wins: Number(p?.wins) || 0,
							losses: Number(p?.losses) || 0,
							draws: Number(p?.draws) || 0,
							dropped: !!p?.dropped
						}
					])
			);
			seen.players = true;
		});
		const unsub3 = onValue(ref(db, `${ROOT}/rounds`), () => attachPairingsListener(currentRound));
		const unsubHistory = onValue(ref(db, `${ROOT}/history`), (snap) => {
			historyMap = snap.val() || {};
			seen.history = true;
		});
		return () => {
			unsubEvent?.();
			unsub1?.();
			unsub2?.();
			unsub3?.();
			unsubHistory?.();
			unsubPairings?.();
		};
	});

	/**
	 * What a seat shows: a player, a bye, or nobody yet. The players are passed in
	 * rather than read from the closure so the template's dependency on them is
	 * visible to Svelte: a record recounted after a result then redraws the row,
	 * instead of waiting for the next change to the pairings.
	 */
	function seat(id, roster, seeding) {
		if (id === '') return { empty: true, name: '—', hero: '', record: '' };
		if (isBye(id)) return { bye: true, name: 'Bye', hero: '', record: '' };
		const p = roster[id];
		if (!p) return { empty: true, name: `Player ${id + 1}`, hero: '', record: '' };
		// Once through to the Top 8 a player carries their Top 8 seed instead.
		const top8 = seeding.get(p.id);
		return { ...p, seed: top8 ?? p.id + 1, top8: top8 != null, record: `${p.wins}-${p.losses}` };
	}

	/**
	 * Who has turn selection at a table: the higher seed of the two, which is the
	 * lower number. Nobody, if either seat is empty or a bye.
	 */
	function chooserOf(m) {
		const a = m.p1;
		const b = m.p2;
		if (typeof a !== 'number' || typeof b !== 'number') return null;
		return a < b ? a : b;
	}

	$: top8Seeds = top8Seeding(players, historyMap);

	/** 'advanced', 'out' or '' for a player, from their record. */
	const standing = (p) =>
		!p || p.bye || p.empty
			? ''
			: p.wins >= WINS_TO_ADVANCE
				? 'advanced'
				: p.losses >= LOSSES_TO_DROP
					? 'out'
					: '';

	/**
	 * What was at stake at a table when the round began: a player one loss from
	 * being dropped made it an elimination match, a player one win from the Top 8
	 * made it an advancement match. Records include this table's result once it
	 * is in, so that result is taken back out -- the tag says what the match
	 * meant, not what it has become.
	 */
	function stakes(m, roster) {
		const going = [m.p1, m.p2]
			.filter((id) => typeof id === 'number')
			.map((id) => {
				const p = roster[id];
				if (!p) return null;
				let { wins, losses } = p;
				if (m.winner != null) {
					if (Number(m.winner) === id) wins -= 1;
					else losses -= 1;
				}
				return { wins, losses };
			})
			.filter(Boolean);
		return {
			elimination: going.some((p) => p.losses === LOSSES_TO_DROP - 1),
			advancement: going.some((p) => p.wins === WINS_TO_ADVANCE - 1)
		};
	}

	/** 'won', 'lost' or '' for a seat, given the table's result. */
	function outcome(m, id) {
		if (m.winner == null || id === '') return '';
		if (isBye(id)) return 'lost';
		return Number(m.winner) === Number(id) ? 'won' : 'lost';
	}

	$: tables = [...pairings].sort((a, b) => a.table - b.table);
	$: half = Math.ceil(tables.length / 2);
	$: columns = [tables.slice(0, half), tables.slice(half)];

	// The load sequence waits until every source has reported and every portrait
	// on the page has finished loading -- or three seconds, so one missing image
	// cannot hold it -- then plays once, as on the standings.
	let play = false;
	let settled = false;
	let settledImages = 0;
	let ceiling = null;
	$: dataReady = Object.values(seen).every(Boolean) && tables.length > 0;
	$: expectedImages = tables.reduce(
		(n, m) => n + ['p1', 'p2'].filter((k) => seat(m[k], players, top8Seeds).hero).length,
		0
	);
	$: if (dataReady && !play && !ceiling) ceiling = setTimeout(() => (play = true), 3000);
	$: if (dataReady && settledImages >= expectedImages && !play) play = true;
	$: if (play && ceiling) ceiling = clearTimeout(ceiling) ?? null;
	// Once the last bar has arrived the entrance is taken off the rows, so a
	// result coming in is a plain transition and never replays it.
	$: if (play && !settled)
		setTimeout(() => (settled = true), BARS_START_MS + 16 * BAR_STEP_MS + 700);

	const reveal = (e) => {
		e.currentTarget.classList.add('loaded');
		settledImages += 1;
	};
	const hide = (e) => {
		e.currentTarget.style.visibility = 'hidden';
		settledImages += 1;
	};
	const BARS_START_MS = 1000;
	const BAR_STEP_MS = 55;
</script>

<div class="stage text-white" class:play class:settled>
	<header class="heading">
		<h1 class="title">Pairings</h1>
		<p class="subtitle">
			{#if eventText}<span class="event">{eventText}</span><span class="dot">·</span>{/if}Round {currentRound}
		</p>
	</header>

	{#each columns as column, c (c)}
		<div class="column" style="left: {c === 0 ? 100 : 990}px;">
			{#each column as m, i (m.table)}
				{@const at = stakes(m, players)}
				<section class="table" aria-label="Table {m.table}">
					<p class="caption" style="--delay: {BARS_START_MS + (c * half + i) * 2 * BAR_STEP_MS}ms;">
						Table {m.table}
						{#if at.elimination}<span class="stake elimination">Elimination</span>{/if}
						{#if at.advancement}<span class="stake advancement">Top 8 on the line</span>{/if}
					</p>
					{#each ['p1', 'p2'] as key, k (key)}
						{@const s = seat(m[key], players, top8Seeds)}
						{@const result = outcome(m, m[key])}
						{@const chooser = chooserOf(m) === m[key]}
						<div
							class="row {result} {standing(s)}"
							class:bye={s.bye}
							class:chooser
							class:dropped={s.dropped}
							style="--delay: {BARS_START_MS + ((c * half + i) * 2 + k) * BAR_STEP_MS}ms;"
						>
							<span class="portrait">
								{#if s.hero}
									<img src={heroImageUrl(s.hero)} alt="" on:load={reveal} on:error={hide} />
								{/if}
							</span>
							{#if s.top8}
								<span class="seed top8"><span class="label">Top 8</span>{ordinal(s.seed)}</span>
							{:else}
								<span class="seed">{s.seed ?? ''}</span>
							{/if}
							<span class="who">
								<span class="name">{s.name}</span>
								{#if !s.bye && !s.empty}
									<span class="hero">{s.hero || '—'}</span>
								{/if}
							</span>
							<!-- Before the result, the tag marks who has the turn choice; after, the result. -->
							<span
								class="tag"
								class:shown={(!!result && !s.bye) || chooser}
								class:choice={!result && chooser}
							>
								{result === 'won'
									? 'Win'
									: result === 'lost'
										? 'Loss'
										: chooser
											? 'Turn choice'
											: ''}
							</span>
							{#if s.dropped}
								<span class="wld status">Dropped</span>
							{:else if s.record}
								<span class="wld">{s.record}</span>
							{:else}
								<span class="wld blank"></span>
							{/if}
						</div>
					{/each}
				</section>
			{/each}
		</div>
	{/each}
</div>

<style>
	/* Pinned to the browser source size so every bar lands on the same pixels
	   whatever window is around it. */
	.stage {
		position: relative;
		width: 1920px;
		height: 1080px;
		overflow: hidden;
		--tan: #d9b499;
		--bar: rgba(17, 24, 39, 0.6);
		--won: #4ade80;
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

	/* Four tables a column: a caption and two bars of 72px, 180px a table with 20px
	   between, from 256px down to 1036px. The columns stand 60px apart. */
	.column {
		position: absolute;
		top: 256px;
		width: 830px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.table {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.caption {
		margin: 0;
		height: 24px;
		line-height: 24px;
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 17px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #fff;
		opacity: 0;
	}

	/* What is at stake, beside the table number: red for an elimination match,
	   green for a Top 8 place on the line. */
	.stake {
		height: 20px;
		padding: 0 8px;
		display: inline-flex;
		align-items: center;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.stake.elimination {
		color: #fca5a5;
		background: rgba(248, 113, 113, 0.18);
		box-shadow: inset 0 0 0 1px rgba(248, 113, 113, 0.45);
	}

	.stake.advancement {
		color: #86efac;
		background: rgba(74, 222, 128, 0.16);
		box-shadow: inset 0 0 0 1px rgba(74, 222, 128, 0.45);
	}

	/* A player already through to the Top 8 has a green record and carries their
	   Top 8 seed in a green badge; one already out, a red record -- as on the
	   standings. */
	.row.advanced .wld {
		color: #4ade80;
	}

	/* The Top 8 seed is said in full: a green badge reading TOP 8 over the seed. */
	.seed.top8 {
		flex-direction: column;
		gap: 3px;
		height: 44px;
		padding: 0 14px;
		border-color: #4ade80;
		color: #4ade80;
		line-height: 1;
	}

	.seed.top8 .label {
		font-size: 9px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	/* The turn-choice fill is for original seeds only: a Top 8 badge stays green
	   and outlined whoever chooses, so the fill cannot be read as part of the
	   seeding. */
	.chooser .seed.top8 {
		background: none;
		border-color: #4ade80;
		color: #4ade80;
	}

	.row.out .wld {
		color: #f87171;
	}

	.row {
		position: relative;
		display: grid;
		grid-template-columns: 72px auto minmax(0, 1fr) 112px 190px;
		align-items: center;
		column-gap: 16px;
		height: 72px;
		padding: 0 12px 0 0;
		box-sizing: border-box;
		background: var(--bar);
		border-left: 4px solid var(--tan);
		opacity: 0;
		transform: translateX(-30px);
		transition:
			border-color 400ms ease,
			opacity 400ms ease;
	}

	/* The result is said three ways, each of them fading in rather than snapping:
	   the edge, a tag, and a tint across the bar for the winner, with the loser
	   dimmed. The tint is an overlay so it can fade. */
	.row::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: linear-gradient(90deg, rgba(74, 222, 128, 0.22), transparent 60%);
		opacity: 0;
		transition: opacity 400ms ease;
	}

	.row.won::before {
		opacity: 1;
	}

	.row.won {
		border-left-color: var(--won);
	}

	.row.lost {
		border-left-color: #6b7280;
	}

	.row > * {
		position: relative;
	}

	.tag {
		height: 34px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 17px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		opacity: 0;
		transition:
			opacity 400ms ease,
			background-color 400ms ease,
			color 400ms ease;
	}

	.tag.shown {
		opacity: 1;
	}

	.won .tag {
		color: #0b0f19;
		background: var(--won);
	}

	.lost .tag {
		color: #fca5a5;
		background: rgba(248, 113, 113, 0.18);
	}

	/* The portrait: a square the full height of the bar at its left, cropped from
	   the still's upper right and enlarged, where these stills keep the face, with
	   a hairline of tan around it -- as on the standings. */
	.portrait {
		width: 72px;
		height: 72px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.08);
		box-shadow: inset 0 0 0 1px rgba(217, 180, 153, 0.45);
	}

	.bye .portrait {
		background: none;
		box-shadow: none;
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

	/* The seed, in a tan-outlined square between the portrait and the name, as
	   on the bracket. */
	.seed {
		min-width: 34px;
		height: 34px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(217, 180, 153, 0.7);
		font-size: 16px;
		font-weight: 700;
		color: var(--tan);
		font-variant-numeric: tabular-nums;
	}

	.bye .seed,
	.seed:empty {
		border-color: transparent;
	}

	/* The player with turn selection: a solid tan seed, and a tan tag until the
	   result replaces it. */
	.chooser .seed {
		background: var(--tan);
		border-color: var(--tan);
		color: #0b0f19;
	}

	.tag.choice {
		color: var(--tan);
		background: rgba(217, 180, 153, 0.14);
		box-shadow: inset 0 0 0 1px rgba(217, 180, 153, 0.55);
		font-size: 12px;
		letter-spacing: 0.1em;
		white-space: nowrap;
	}

	.bye .name {
		color: var(--tan);
		letter-spacing: 0.12em;
		text-transform: uppercase;
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
		transition: color 400ms ease;
		height: 52px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 30px;
		font-weight: 700;
		letter-spacing: 0.1em;
		font-variant-numeric: tabular-nums;
		background: rgba(255, 255, 255, 0.1);
	}

	.wld.blank {
		background: none;
	}

	.wld.status {
		font-size: 20px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #f87171;
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

	.play .caption {
		animation: fadeUp 0.5s ease-out 800ms forwards;
	}

	.play .row {
		animation: slideReveal 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
		animation-delay: var(--delay, 0ms);
	}

	/* A loser or a dropped player arrives dimmed; after the entrance the dimming
	   is a transition like everything else. */
	.play:not(.settled) .row.lost,
	.play:not(.settled) .row.dropped {
		animation-name: slideRevealDim;
	}

	.settled .row {
		animation: none;
		opacity: 1;
		transform: none;
		clip-path: none;
	}

	.settled .row.lost,
	.settled .row.dropped {
		opacity: 0.45;
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
			opacity: 0.45;
			transform: translateX(0);
			clip-path: inset(0 0 0 0);
		}
	}
</style>
