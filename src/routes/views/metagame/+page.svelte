<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';
	import { heroImageUrl } from '$lib/heroMedia';
	import ShrinkText from '$lib/ShrinkText.svelte';

	// Metagame breakdown for a 1920x1080 browser source, in the look of the
	// standings and pairings: white type and tan accents on translucent dark bars.
	// One bar per hero with at least one player -- how many play it, portrait,
	// name, and the share -- ranked by count. The field decides the
	// layout: as many columns as it takes for the bars to stay readable, and the
	// bars then grow to fill the frame top to bottom however many there are.
	let entries = [];
	let eventText = '';
	let seen = { metagame: false, event: false };

	onMount(() => {
		const unsubMeta = onValue(ref(db, 'metagame'), (snap) => {
			const val = snap.val() || {};
			entries = Object.entries(val).map(([id, v]) => ({
				id,
				name: v?.name ?? '',
				count: Number(v?.count) || 0
			}));
			seen.metagame = true;
		});
		const unsubEvent = onValue(ref(db, 'eventText'), (snap) => {
			eventText = snap.val() ?? '';
			seen.event = true;
		});
		return () => {
			unsubMeta?.();
			unsubEvent?.();
		};
	});

	$: total = entries.reduce((sum, e) => sum + e.count, 0);
	$: rows = entries
		.filter((e) => e.count > 0)
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
		.map((e, i) => ({
			...e,
			rank: i + 1,
			pct: total ? Math.round((e.count / total) * 100) : 0
		}));

	// --- layout ---------------------------------------------------------------
	// The band under the heading, and the bar the standings use at full size.
	const BAND = { top: 302, bottom: 1020, left: 100, right: 1820, colGap: 60 };
	const FULL = { rowH: 80, gap: 10 };

	// Two columns at least, as the standings have, and the fewest that keep the
	// bars at least MIN_ROW_H tall -- four at most. The bars then stretch to fill
	// the band exactly, with what is drawn in them scaling up to a limit so a
	// small field is generous rather than absurd.
	const MIN_ROW_H = 60;
	const MAX_SCALE = 1.5;
	const MAX_WIDEN = 1.15;
	// The bar's fixed parts at full size: rank cell, portrait, the gaps between
	// the five cells, the two plates and the right padding.
	const RANK_W = 76;
	const GAP_W = 16;
	const SHARE_W = 150;
	const PAD_R = 12;

	function layoutFor(count) {
		const bandH = BAND.bottom - BAND.top;
		const options = [];
		for (let columns = 2; columns <= 4; columns++) {
			const rowsPerColumn = Math.ceil(count / columns) || 1;
			const gap = Math.round(
				Math.min(15, Math.max(7, FULL.gap * (bandH / rowsPerColumn / FULL.rowH)))
			);
			const rowH = Math.floor((bandH - (rowsPerColumn - 1) * gap) / rowsPerColumn);
			options.push({ columns, rowsPerColumn, rowH, gap });
		}
		const chosen =
			options.find((o) => o.rowH >= MIN_ROW_H) ??
			options.reduce((best, o) => (o.rowH > best.rowH ? o : best));
		const width = (BAND.right - BAND.left - (chosen.columns - 1) * BAND.colGap) / chosen.columns;
		const scale = Math.min(MAX_SCALE, chosen.rowH / FULL.rowH);
		// Widths grow less than the type does, so a tall bar keeps room for the name.
		const widen = Math.min(MAX_WIDEN, scale);
		// The portrait is a square the full height of the bar.
		const nameW = width - (RANK_W + 3 * GAP_W) * widen - chosen.rowH - SHARE_W - PAD_R;
		return { ...chosen, width, scale, widen, nameW };
	}

	$: layout = layoutFor(rows.length);

	// One size for every name: the largest at which the longest name in the field
	// fits its box, estimated from its length, so the table reads at one size
	// rather than each bar at its own. The shrink-to-fit text underneath still
	// catches a name the estimate gets wrong.
	const AVG_GLYPH = 0.6;
	$: longest = rows.reduce((n, r) => Math.max(n, r.name.length), 0);
	$: nameSize = Math.min(27 * layout.scale, longest ? layout.nameW / (longest * AVG_GLYPH) : 0);
	$: slotFor = (i) => ({
		x: BAND.left + Math.floor(i / layout.rowsPerColumn) * (layout.width + BAND.colGap),
		y: BAND.top + (i % layout.rowsPerColumn) * (layout.rowH + layout.gap)
	});
	$: columnsX = Array.from(
		{ length: layout.columns },
		(_, c) => BAND.left + c * (layout.width + BAND.colGap)
	);

	// --- load sequence ----------------------------------------------------------
	// Waits until every source has reported and every portrait has loaded -- or
	// three seconds -- then plays once; after that every change is a transition.
	let play = false;
	let settled = false;
	let settledImages = 0;
	let ceiling = null;
	const ROWS_START_MS = 1000;
	const ROW_STEP_MS = 55;
	$: dataReady = Object.values(seen).every(Boolean) && rows.length > 0;
	$: expectedImages = rows.filter((r) => r.name).length;
	$: if (dataReady && !play && !ceiling) ceiling = setTimeout(() => (play = true), 3000);
	$: if (dataReady && settledImages >= expectedImages && !play) play = true;
	$: if (play && ceiling) ceiling = clearTimeout(ceiling) ?? null;
	$: if (play && !settled)
		setTimeout(() => (settled = true), ROWS_START_MS + rows.length * ROW_STEP_MS + 700);

	const reveal = (e) => {
		e.currentTarget.classList.add('loaded');
		settledImages += 1;
	};
	const hide = (e) => {
		e.currentTarget.style.visibility = 'hidden';
		settledImages += 1;
	};
</script>

<div
	class="stage text-white"
	class:play
	class:settled
	style="--row-h: {layout.rowH}px; --col-w: {layout.width}px; --s: {layout.scale}; --w: {layout.widen};"
>
	<header class="heading">
		<h1 class="title">Metagame</h1>
		<p class="subtitle">
			{#if eventText}<span class="event">{eventText}</span><span class="dot">·</span>{/if}{total}
			{total === 1 ? 'player' : 'players'}<span class="dot">·</span>{rows.length}
			{rows.length === 1 ? 'hero' : 'heroes'}
		</p>
	</header>

	{#each columnsX as x (x)}
		<div class="row head" style="left: {x}px;" aria-hidden="true">
			<span class="plate">Players</span><span></span><span></span>
			<span class="plate">Share</span>
		</div>
	{/each}

	<ol class="list">
		{#each rows as row, i (row.id)}
			{@const at = slotFor(i)}
			<li class="slot" style="transform: translate({at.x}px, {at.y}px);">
				<div class="row" style="--delay: {ROWS_START_MS + i * ROW_STEP_MS}ms;">
					<span class="rank">{row.count}</span>
					<span class="portrait">
						{#if row.name}
							<img src={heroImageUrl(row.name)} alt="" on:load={reveal} on:error={hide} />
						{/if}
					</span>
					<!-- The whole name, always: it renders at size and only shrinks when the
					     bar is too narrow for it. -->
					<span class="name">
						<ShrinkText
							text={row.name}
							width={layout.nameW}
							height={layout.rowH}
							size={nameSize}
							align="left"
						/>
					</span>
					<span class="plate">{row.pct}%</span>
				</div>
			</li>
		{/each}
	</ol>
</div>

<style>
	/* Pinned to the browser source size so every bar lands on the same pixels
	   whatever window is around it. Everything in a bar is drawn in units of --s,
	   the bar's height over the standings' 80px, so a crowded field scales down
	   as a piece. */
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

	.row.head {
		position: absolute;
		top: 256px;
		width: var(--col-w);
		height: 34px;
		background: none;
		border-left-color: transparent;
		opacity: 0;
		font-size: 17px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--tan);
	}

	.row.head .plate {
		background: none;
		font-size: 17px;
		height: auto;
		padding: 0;
	}

	.row.head .plate:first-child {
		margin-right: calc(-16px * var(--w));
		text-align: center;
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
		width: var(--col-w);
		transition: transform 600ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.row {
		display: grid;
		grid-template-columns: calc(76px * var(--w)) var(--row-h) minmax(0, 1fr) 150px;
		align-items: center;
		column-gap: calc(16px * var(--w));
		height: var(--row-h);
		padding-right: 12px;
		box-sizing: border-box;
		background: var(--bar);
		border-left: 4px solid var(--tan);
	}

	.list .row {
		opacity: 0;
		transform: translateX(-30px);
	}

	/* The rank's cell runs from the bar's edge to the portrait, so the number sits
	   the same distance from each. */
	.rank {
		margin-right: calc(-16px * var(--w));
		font-size: calc(32px * var(--s));
		font-weight: 700;
		line-height: 1;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	/* The portrait: a square the full height of the bar, cropped from the still's
	   upper right and enlarged, where these stills keep the face, with a hairline
	   of tan around it. */
	.portrait {
		width: var(--row-h);
		height: var(--row-h);
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

	.name {
		min-width: 0;
		display: flex;
		align-items: center;
	}

	.plate {
		height: calc(56px * var(--w));
		padding: 0 12px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: calc(32px * var(--s));
		font-weight: 700;
		letter-spacing: 0.04em;
		font-variant-numeric: tabular-nums;
		background: rgba(255, 255, 255, 0.1);
	}

	/* The share runs to four characters, so it is set a little smaller and
	   tighter than the count, on a wider plate. */
	.plate:last-child {
		font-size: calc(29px * var(--s));
		letter-spacing: 0.01em;
	}

	/* Nothing moves until the data is in; then everything runs off one clock, and
	   once the last bar has arrived the entrance is taken off the rows. */
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

	.settled .list .row {
		animation: none;
		opacity: 1;
		transform: none;
		clip-path: none;
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
</style>
