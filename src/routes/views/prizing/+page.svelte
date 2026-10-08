<script context="module">
	// The left third runs 100px to 660px across, with the logo's space at its
	// top, 56px to 256px down. The right two thirds runs 700px to 1820px, the
	// column headings on the top line and the bars beneath to the foot.
	const AREA_TOP = 96;
	const AREA_H = 940;
	const GAP = 16;

	// The bars come in slowly and softly, one every fifth of a second.
	const ROWS_START_MS = 1200;
	const ROW_STEP_MS = 200;
</script>

<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';
	import { PRIZING_PATH, eventType, normalizePrizing } from '$lib/prizing';
	import EventIcon from '$lib/EventIcon.svelte';

	// The prizing breakdown for a 1920x1080 browser source, in the look of the
	// other overlays, in a third and two thirds: the left third keeps a space
	// at the top for the logo, which the scene carries, with the title, its tan
	// rule and the event's name beneath; the right two thirds is the table, one
	// translucent dark bar a finish, the bars sharing the height so five rows
	// and seven both fill the column to the foot. Each bar's finish sits in a
	// solid tan block at its left end, dark type on tan as the badges are, and
	// the prize stands large and white on the plate beside it; the winner's
	// block wears the trophy. An Open Series event has a column of AGE Open
	// points; the Players Championship has none.
	let type = 'open';
	let eventName = '';
	let rows = { open: [], championship: [] };
	let seen = { data: false, fonts: false };
	let play = false;
	let settled = false;
	$: if (!play && Object.values(seen).every(Boolean)) play = true;
	$: if (play && !settled)
		setTimeout(() => (settled = true), ROWS_START_MS + 8 * ROW_STEP_MS + 1400);

	$: kind = eventType(type);
	$: title = eventName.trim() || kind.name;
	$: table = (rows[type] || []).filter((r) => r.finish.trim());
	$: rowH = Math.floor((AREA_H - GAP * (table.length - 1)) / Math.max(table.length, 1));
	$: rowY = (i) => AREA_TOP + i * (rowH + GAP);

	// A prize that would run past its cell is set a little smaller; one that
	// would need to go smaller than that breaks onto two lines instead. The
	// cell is measured again whenever it changes size.
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
			for (let size = Math.floor(base * 0.8); size >= 18; size -= 1) {
				node.style.fontSize = `${size}px`;
				if (node.scrollHeight <= bar * 0.8 && node.scrollWidth <= Math.ceil(room)) return;
			}
		};
		measure();
		const watch = new ResizeObserver(measure);
		watch.observe(node.parentElement);
		return { update: measure, destroy: () => watch.disconnect() };
	}

	onMount(() => {
		const stop = onValue(ref(db, PRIZING_PATH), (snap) => {
			({ type, eventName, rows } = normalizePrizing(snap.val()));
			seen.data = true;
		});
		document.fonts.ready.then(() => (seen.fonts = true));
		return stop;
	});
</script>

<div class="stage text-white" class:play class:settled>
	<!-- The left third: the logo's space above, nothing drawn there, and the
	     heading beneath it. -->
	<header class="heading">
		<h1 class="title">Prizing<br />Breakdown</h1>
		<p class="subtitle">{title}</p>
	</header>

	{#if play}
		<div
			class="head"
			class:no-points={!kind.points}
			style="top: {AREA_TOP - 34}px;"
			aria-hidden="true"
		>
			<!-- Only the points are labelled; the finish and the prize say what they
			     are. The empty cells keep the label over its column. -->
			<span></span>
			<span></span>
			{#if kind.points}<span class="points">AGE Open Points</span>{/if}
		</div>
		<ol class="list">
			{#each table as row, i (i)}
				<li
					class="row"
					class:winner={i === 0}
					class:blank={!row.prize.trim()}
					class:no-points={!kind.points}
					style="top: {rowY(i)}px; --h: {rowH}px; --delay: {ROWS_START_MS + i * ROW_STEP_MS}ms;"
				>
					<span class="finish">
						{#if i === 0}<span class="trophy"><EventIcon kind="trophy" /></span>{/if}
						{row.finish}
					</span>
					<span class="prize-cell">
						{#key `${row.prize}|${rowH}|${kind.points}`}
							<span class="prize" use:fit>{row.prize.trim() || '—'}</span>
						{/key}
					</span>
					{#if kind.points}
						<span class="points">
							{#if row.points.trim()}<span class="chip">{row.points} pts</span>{/if}
						</span>
					{/if}
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

	/* In the left third, under the logo's space (56px to 256px down): the
	   heading is set left, centred in the height left beneath the logo. */
	.heading {
		position: absolute;
		left: 100px;
		top: 256px;
		width: 560px;
		height: 780px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		text-align: left;
	}

	.title {
		margin: 0 0 20px;
		padding-bottom: 20px;
		font-size: 80px;
		font-weight: 700;
		line-height: 0.95;
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
		font-size: 30px;
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--tan);
	}

	/* The column headings over the bars, and the bars' columns: the finish, the
	   prize, and the points at the right end. */
	.head,
	.row {
		position: absolute;
		left: 700px;
		width: 1120px;
		display: grid;
		grid-template-columns: 300px minmax(0, 1fr) 220px;
		align-items: center;
		column-gap: 32px;
		padding: 0 32px 0 0;
		box-sizing: border-box;
	}

	/* Without points the prize has the rest of the bar to itself. */
	.head.no-points,
	.row.no-points {
		grid-template-columns: 300px minmax(0, 1fr);
	}

	.prize-cell {
		min-width: 0;
		display: flex;
		align-items: center;
	}

	.prize-cell {
		min-width: 0;
		display: flex;
		align-items: center;
	}

	/* The trophy on the tan block is set dark, as the word beside it is, so it
	   reads against the tan. */
	.trophy {
		display: inline-flex;
		width: clamp(30px, calc(var(--h) * 0.3), 42px);
		height: clamp(30px, calc(var(--h) * 0.3), 42px);
		margin-right: 12px;
	}

	.trophy :global(svg) {
		fill: #0b0f19;
	}

	.trophy :global(svg) {
		width: 100%;
		height: 100%;
	}

	.head {
		height: 24px;
		font-size: 15px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--tan);
		opacity: 0;
	}

	.points {
		text-align: right;
	}

	.list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		height: var(--h);
		background: var(--bar);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
		overflow: hidden;
		opacity: 0;
	}

	/* The sweep of light the other overlays' plates get as they land. */
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

	/* The finish: a solid tan block the full height of the bar, dark type. */
	.finish {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 20px;
		box-sizing: border-box;
		font-size: clamp(26px, calc(var(--h) * 0.26), 36px);
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
		color: #0b0f19;
		background: linear-gradient(135deg, #e6c4a6 0%, var(--tan) 55%, #c49a78 100%);
	}

	.prize {
		display: block;
		font-size: clamp(30px, calc(var(--h) * 0.4), 56px);
		font-weight: 700;
		line-height: 1.1;
		letter-spacing: 0.01em;
		white-space: nowrap;
		overflow-wrap: anywhere;
		color: #fff;
	}

	.row.blank .prize {
		color: rgba(255, 255, 255, 0.35);
		font-weight: 400;
	}

	/* The winner's bar stands out: a plate warmed with tan, the block a shade
	   brighter, and the trophy beside the word. */
	.row.winner {
		background: linear-gradient(90deg, rgba(217, 180, 153, 0.24), var(--bar) 55%);
	}

	.row.winner .finish {
		background: linear-gradient(135deg, #f3dcc6 0%, #e6c4a6 55%, var(--tan) 100%);
	}

	/* The points as a tan-outlined chip, as the overlays tag things. */
	/* The points as a solid tan chip with dark type, as the seed badges are,
	   so they read against whatever is behind the bar. */
	.chip {
		display: inline-flex;
		align-items: center;
		height: clamp(36px, calc(var(--h) * 0.38), 48px);
		padding: 0 18px;
		font-size: clamp(20px, calc(var(--h) * 0.2), 26px);
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-variant-numeric: tabular-nums;
		color: #0b0f19;
		background: var(--tan);
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

	.play .head {
		animation: fadeUp 0.5s ease-out 850ms forwards;
	}

	/* Each bar rises and fades in over a second with a long ease-out, and the
	   light crosses it slowly once it has settled. */
	.play .row {
		animation: riseIn 1.1s cubic-bezier(0.16, 0.7, 0.2, 1) forwards;
		animation-delay: var(--delay, 0ms);
	}

	.play .row::after {
		animation: shine 1.4s ease-in-out forwards;
		animation-delay: calc(var(--delay, 0ms) + 700ms);
	}

	@keyframes riseIn {
		0% {
			opacity: 0;
			transform: translateY(18px);
		}
		100% {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Once in, a bar that moves or resizes as the table changes glides there. */
	.settled .row {
		animation: none;
		opacity: 1;
		transition:
			top 500ms ease,
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
</style>
