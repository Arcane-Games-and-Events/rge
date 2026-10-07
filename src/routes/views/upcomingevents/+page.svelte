<script context="module">
	// The bars run from under the heading to the foot of the frame, as the
	// standings' do: 256px down to 1036px, in one column or two.
	const AREA_TOP = 256;
	const AREA_H = 780;
	const AREA_W = 1720;
	const GAP = 20;
	const CARD_MAX = 4;
	// The cards' sizes: one wide card, or two to four tall ones, narrower as
	// there are more.
	const WIDE_CARD = { w: 1240, h: 460 };
	const TALL_CARD_W = { 2: 480, 3: 420, 4: 360 };
	const TALL_CARD_H = 600;
	const CARD_GAP = 28;
	const COLUMN_X = [100, 990];
	// The events follow the heading half a second later than the other
	// overlays' rows do, so the title has the page to itself for a moment.
	const ROWS_START_MS = 1500;
	const ROW_STEP_MS = 90;
	const CARD_STEP_MS = 160;
</script>

<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';
	import { UPCOMING_PATH, normalizeUpcoming, dateParts, circuitColor } from '$lib/upcomingEvents';
	import EventIcon from '$lib/EventIcon.svelte';

	// Upcoming events for a 1920x1080 browser source, in the look of the other
	// overlays: white type on translucent dark bars under the title, each bar
	// edged and tagged in its circuit's colour -- green for St Louis, blue for
	// Los Angeles, purple for New England, as the rest of the design has them.
	// In date order. Up to four events are cards, laid out to suit the count
	// and centred in the space rather than stretched to fill it: one lies
	// across the page, two to four stand side by side. More run as a list of
	// bars that fills the page, down one column up to six and two columns
	// beyond, the bars sharing the height between them.
	let title = '';
	let subtitle = '';
	let items = [];
	let seen = { data: false, fonts: false };
	let play = false;
	let settled = false;
	$: if (!play && Object.values(seen).every(Boolean)) play = true;
	$: if (play && !settled)
		setTimeout(() => (settled = true), ROWS_START_MS + 12 * ROW_STEP_MS + 800);

	onMount(() => {
		const stop = onValue(ref(db, UPCOMING_PATH), (snap) => {
			({ title, subtitle, items } = normalizeUpcoming(snap.val()));
			seen.data = true;
		});
		document.fonts.ready.then(() => (seen.fonts = true));
		return stop;
	});

	$: shown = items.filter((e) => e.name.trim());
	$: asCards = shown.length > 0 && shown.length <= CARD_MAX;

	// Cards: a single event lies across the page as one wide card, the date at
	// its left and the event beside it. Two to four stand side by side, the
	// fewer the wider, each with the date as a band across its top. Either way
	// the cards sit centred in the area with air around them.
	$: wide = shown.length === 1;
	$: cardW = wide ? WIDE_CARD.w : TALL_CARD_W[shown.length] || TALL_CARD_W[4];
	$: cardH = wide ? WIDE_CARD.h : TALL_CARD_H;
	$: rowW = shown.length * cardW + (shown.length - 1) * CARD_GAP;
	$: cardAt = (i) => ({
		x: Math.round(COLUMN_X[0] + (AREA_W - rowW) / 2 + i * (cardW + CARD_GAP)),
		y: Math.round(AREA_TOP + (AREA_H - cardH) / 2)
	});

	// Bars: one column up to six events, two beyond, the height shared between
	// each column's bars so they always reach the foot of the area.
	$: columns = shown.length > 6 ? 2 : 1;
	$: perColumn = Math.ceil(shown.length / columns) || 1;
	$: rowH = Math.floor((AREA_H - GAP * (perColumn - 1)) / perColumn);
	$: colW = columns === 1 ? AREA_W : (AREA_W - GAP * 3) / 2;
	$: slot = (i) => ({
		x: COLUMN_X[Math.floor(i / perColumn)],
		y: AREA_TOP + (i % perColumn) * (rowH + GAP)
	});

	// A card's name wraps freely, and is set smaller only when the name and the
	// location together would not fit the card's body; nothing is cut off.
	function fitCard(node) {
		const base = parseFloat(getComputedStyle(node).fontSize);
		const body = node.closest('.card-body');
		const measure = () => {
			for (let size = base; size >= 28; size -= 2) {
				node.style.fontSize = `${size}px`;
				if (body.scrollHeight <= body.clientHeight + 1) return;
			}
		};
		measure();
		const watch = new ResizeObserver(measure);
		watch.observe(body);
		document.fonts?.addEventListener?.('loadingdone', measure);
		return {
			update: measure,
			destroy() {
				watch.disconnect();
				document.fonts?.removeEventListener?.('loadingdone', measure);
			}
		};
	}

	// A name that would run past its room is set a little smaller; one that
	// would need to go smaller than that breaks onto two lines instead, and
	// shrinks again only if the two lines will not fit the bar. The room is
	// whatever the bar leaves between the date and the day, measured, and
	// measured again whenever it changes -- the day's own type settling in,
	// the bars resizing as events are added -- so the fit is never stale.
	function fit(node) {
		const base = parseFloat(getComputedStyle(node).fontSize);
		const measure = () => {
			const room = node.parentElement.getBoundingClientRect().width;
			const bar = node.closest('.row').getBoundingClientRect().height;
			node.style.whiteSpace = 'nowrap';
			node.style.width = 'max-content';
			node.style.fontSize = `${base}px`;
			const drawn = node.getBoundingClientRect().width;
			if (drawn <= room) return;
			const single = (base * room) / drawn;
			if (single >= base * 0.8) {
				node.style.fontSize = `${Math.floor(single)}px`;
				return;
			}
			node.style.whiteSpace = 'normal';
			node.style.width = `${room}px`;
			for (let size = Math.floor(base * 0.8); size >= 14; size -= 1) {
				node.style.fontSize = `${size}px`;
				// scrollWidth is a whole number and the room is not: a line exactly
				// the room wide reads as a pixel over it.
				if (node.scrollHeight <= bar * 0.6 && node.scrollWidth <= Math.ceil(room)) return;
			}
		};
		measure();
		const watch = new ResizeObserver(measure);
		watch.observe(node.parentElement);
		document.fonts?.addEventListener?.('loadingdone', measure);
		return {
			update: measure,
			destroy() {
				watch.disconnect();
				document.fonts?.removeEventListener?.('loadingdone', measure);
			}
		};
	}
</script>

<div class="stage text-white" class:play class:settled>
	<header class="heading">
		<h1 class="title">{title || 'Upcoming Events'}</h1>
		{#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
	</header>

	{#if play && asCards}
		<ol class="list">
			{#each shown as e, i (e.id)}
				{@const at = cardAt(i)}
				{@const when = dateParts(e.date)}
				<li
					class="event-card"
					class:wide
					style="left: {at.x}px; top: {at.y}px; width: {cardW}px; height: {cardH}px; --w: {cardW}px; --ch: {cardH}px; --accent: {circuitColor(
						e.circuit
					)}; --delay: {ROWS_START_MS + i * CARD_STEP_MS}ms;"
				>
					<div class="card-date">
						<span class="card-month">{when.month}</span>
						<span class="card-day">{when.day}</span>
						{#if !wide && when.weekday}<span class="card-weekday">{when.weekday}</span>{/if}
					</div>
					<div class="card-body">
						<!-- The mark above the name, in a slot kept whether or not there is
						     one, so the marks sit level across the row and so do the names. -->
						<span class="card-icon">
							{#if e.icon}<EventIcon kind={e.icon} />{/if}
						</span>
						{#key `${e.name}|${cardW}|${cardH}`}
							<span class="card-name" use:fitCard>{e.name}</span>
						{/key}
						{#if e.location}<span class="card-where">{e.location}</span>{/if}
					</div>
					{#if wide}
						<!-- The day and the circuit at the card's right end, as the list has them. -->
						<div class="card-side">
							{#if when.weekday}<span class="card-weekday">{when.weekday}</span>{/if}
							{#if e.circuit}<span class="circuit card-circuit">{e.circuit}</span>{/if}
						</div>
					{:else if e.circuit}
						<span class="circuit card-circuit">{e.circuit}</span>
					{/if}
				</li>
			{/each}
		</ol>
	{:else if play}
		<ol class="list">
			{#each shown as e, i (e.id)}
				{@const at = slot(i)}
				{@const when = dateParts(e.date)}
				<li
					class="row"
					style="left: {at.x}px; top: {at.y}px; width: {colW}px; --h: {rowH}px; --accent: {circuitColor(
						e.circuit
					)}; --delay: {ROWS_START_MS + i * ROW_STEP_MS}ms;"
				>
					<div class="date">
						<span class="month">{when.month}</span>
						<span class="day">{when.day}</span>
					</div>
					{#if e.icon}<span class="row-icon"><EventIcon kind={e.icon} /></span>{/if}
					<div class="what" class:after-icon={!!e.icon}>
						{#key `${e.name}|${rowH}|${colW}`}
							<span class="name" use:fit>{e.name}</span>
						{/key}
						{#if e.location}<span class="where">{e.location}</span>{/if}
					</div>
					<div class="side">
						{#if when.weekday}<span class="weekday">{when.weekday}</span>{/if}
						{#if e.circuit}<span class="circuit">{e.circuit}</span>{/if}
					</div>
				</li>
			{/each}
		</ol>
	{/if}
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
		font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
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

	.list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* A bar: the date plate at its left end, the event in the middle, the day
	   and the circuit at its right. Everything in it is sized from the bar's
	   height, so the type grows with the bars when there are fewer events. */
	.row {
		position: absolute;
		height: var(--h);
		display: grid;
		grid-template-columns: calc(var(--h) * 1.1) auto minmax(0, 1fr) auto;
		align-items: center;
		column-gap: calc(var(--h) * 0.2);
		padding-right: calc(var(--h) * 0.2);
		box-sizing: border-box;
		background: var(--bar);
		border-left: 4px solid var(--accent, var(--tan));
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
		opacity: 0;
		overflow: hidden;
	}

	/* The event's mark, in the circuit's colour, between the date and the words;
	   the words' column is left empty of it when there is none. */
	.row-icon {
		width: clamp(36px, calc(var(--h) * 0.4), 44px);
		height: clamp(36px, calc(var(--h) * 0.4), 44px);
		color: var(--accent, var(--tan));
	}

	.row-icon :global(svg) {
		width: 100%;
		height: 100%;
	}

	.what:not(.after-icon) {
		grid-column: 2 / 4;
	}

	.card-icon {
		flex-shrink: 0;
		align-self: center;
		width: 48px;
		height: 48px;
		color: var(--accent, var(--tan));
	}

	.event-card.wide .card-icon {
		align-self: flex-start;
	}

	.card-icon :global(svg) {
		width: 100%;
		height: 100%;
	}

	.event-card.wide .card-icon {
		width: 56px;
		height: 56px;
	}

	.date {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: calc(var(--h) * 0.02);
		background: color-mix(in srgb, var(--accent, var(--tan)) 14%, transparent);
		box-shadow: inset -1px 0 0 color-mix(in srgb, var(--accent, var(--tan)) 40%, transparent);
	}

	.month {
		font-size: clamp(16px, calc(var(--h) * 0.15), 22px);
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--accent, var(--tan));
	}

	.day {
		font-size: clamp(44px, calc(var(--h) * 0.42), 64px);
		font-weight: 700;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.what {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: calc(var(--h) * 0.04);
	}

	.name {
		font-size: clamp(30px, calc(var(--h) * 0.27), 40px);
		font-weight: 700;
		line-height: 1.05;
		letter-spacing: 0.01em;
		white-space: nowrap;
		width: max-content;
		overflow-wrap: anywhere;
	}

	.where {
		font-size: clamp(20px, calc(var(--h) * 0.15), 24px);
		font-style: italic;
		font-weight: 600;
		color: var(--tan);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.side {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: calc(var(--h) * 0.07);
	}

	.weekday {
		font-size: clamp(16px, calc(var(--h) * 0.14), 20px);
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #fff;
	}

	.circuit {
		height: 30px;
		padding: 0 12px;
		display: inline-flex;
		align-items: center;
		font-size: 14px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		white-space: nowrap;
		color: var(--accent, var(--tan));
		background: color-mix(in srgb, var(--accent, var(--tan)) 16%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, var(--tan)) 60%, transparent);
	}

	/* A card, for four events or fewer: the date as a band across the top in
	   the circuit's tint, the event beneath it, the circuit at the foot. Type is
	   sized from the card's width, so one event stands large and four stand
	   trim. */
	.event-card {
		position: absolute;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		background: var(--bar);
		border-top: 6px solid var(--accent, var(--tan));
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
		opacity: 0;
		overflow: hidden;
	}

	/* The sweep of light the Top 8 plates get once they have slid in, on every
	   card and bar as it lands. */
	.event-card::after,
	.row::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: -40%;
		width: 30%;
		background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.16), transparent);
		transform: skewX(-20deg);
		opacity: 0;
		pointer-events: none;
	}

	.play .event-card::after,
	.play .row::after {
		animation: shine 0.9s ease-out forwards;
		animation-delay: calc(var(--delay, 0ms) + 450ms);
	}

	@keyframes shine {
		0% {
			left: -40%;
			opacity: 0;
		}
		20% {
			opacity: 1;
		}
		100% {
			left: 110%;
			opacity: 0;
		}
	}

	.card-date {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 32px 24px 28px;
		background: color-mix(in srgb, var(--accent, var(--tan)) 12%, transparent);
		box-shadow: inset 0 -1px 0 color-mix(in srgb, var(--accent, var(--tan)) 40%, transparent);
	}

	.card-month {
		font-size: 22px;
		font-weight: 700;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--accent, var(--tan));
	}

	.card-day {
		font-size: 96px;
		font-weight: 700;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.card-weekday {
		margin-top: 8px;
		font-size: 20px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.card-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 14px;
		overflow: hidden;
		padding: 36px 32px 24px;
		text-align: center;
		/* From the top, not centred, so the head line sits at the same height on
		   every card in the row whether or not its name wraps. */
		justify-content: flex-start;
	}

	.card-name {
		min-width: 0;
		font-size: 40px;
		font-weight: 700;
		line-height: 1.1;
		letter-spacing: 0.01em;
		overflow-wrap: anywhere;
	}

	.card-where {
		font-size: 24px;
		font-style: italic;
		font-weight: 600;
		color: var(--tan);
		overflow-wrap: anywhere;
	}

	.card-circuit {
		align-self: center;
		margin-bottom: 32px;
		height: 34px;
		padding: 0 16px;
		font-size: 15px;
	}

	/* One or two events: the card lies across the page, the date a tall panel at
	   its left end and the event set large beside it, everything sized from the
	   card's height. */
	.event-card.wide {
		flex-direction: row;
		align-items: stretch;
		border-top: none;
		border-left: 6px solid var(--accent, var(--tan));
	}

	.event-card.wide .card-date {
		width: 300px;
		flex-shrink: 0;
		justify-content: center;
		padding: 0 24px;
		box-shadow: inset -1px 0 0 color-mix(in srgb, var(--accent, var(--tan)) 40%, transparent);
	}

	.event-card.wide .card-month {
		font-size: 26px;
	}

	.event-card.wide .card-day {
		font-size: 140px;
	}

	.event-card.wide .card-body {
		align-items: flex-start;
		justify-content: center;
		gap: 18px;
		padding: 24px 48px;
		text-align: left;
	}

	.event-card.wide .card-name {
		font-size: 64px;
		line-height: 1.05;
	}

	.event-card.wide .card-where {
		font-size: 30px;
	}

	/* The day of the week and the circuit at the card's right end, set large
	   and ranged right, so the card is held at both ends. */
	.card-side {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		justify-content: center;
		gap: 20px;
		padding-right: 48px;
		flex-shrink: 0;
	}

	.event-card.wide .card-weekday {
		margin: 0;
		font-size: 24px;
		letter-spacing: 0.2em;
	}

	.event-card.wide .card-circuit {
		margin: 0;
		height: 38px;
		padding: 0 18px;
		font-size: 16px;
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

	.play .row {
		animation: slideReveal 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
		animation-delay: var(--delay, 0ms);
	}

	.play .event-card {
		animation: riseIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
		animation-delay: var(--delay, 0ms);
	}

	.settled .event-card {
		animation: none;
		opacity: 1;
		transition:
			left 500ms ease,
			width 500ms ease;
	}

	@keyframes riseIn {
		0% {
			opacity: 0;
			transform: translateY(24px);
		}
		100% {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Once in, a bar that moves or resizes as the list changes glides there. */
	.settled .row {
		animation: none;
		opacity: 1;
		transition:
			left 500ms ease,
			top 500ms ease,
			width 500ms ease,
			height 500ms ease;
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
