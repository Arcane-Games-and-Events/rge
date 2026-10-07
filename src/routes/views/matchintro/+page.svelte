<script context="module">
	// The choice tags, as a pair, sit on the plates' centre line: the plates run
	// 905px to 1025px, the pair of 38px tags with 10px between them 922px to 1008px.
	const TAG_TOP = 922;
	const TAG_STEP = 48;
</script>

<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { ref, onValue } from 'firebase/database';
	import { cubicOut, cubicIn } from 'svelte/easing';
	import 'flag-icons/css/flag-icons.min.css';
	import '$lib/flagOverrides.css';
	import { db } from '../../../firebaseClient';
	import { CHOICE_PATH, CHOICES, toChoice } from '$lib/choice';
	import { firstPlayer } from '$lib/pregame';

	// The match intro, for a 1920x1080 browser source over the VS scene, which
	// is blank below the hero portraits. This draws that band in the look of the
	// other overlays: a name plate for each player running from the VS column
	// out to the screen's edge, with the name, hero, record and pronouns, and
	// the turn choice in the gap between the plates. The plates come in together
	// two seconds after the source loads, and the choice tags a second after them.
	const PLATES_MS = 2000;
	const HOLD_MS = 1000;
	const SEATS = ['p1', 'p2'];

	let players = {
		p1: { name: '', hero: '', record: '', pronouns: '', flag: '' },
		p2: { name: '', hero: '', record: '', pronouns: '', flag: '' }
	};
	let choice = '';
	let held = true;

	// Nothing is drawn until every source has reported, the fonts are in and the
	// two seconds are up, so the whole intro lands in one movement.
	let seen = { p1: false, p2: false, choice: false, fonts: false, time: false };
	let play = false;
	$: if (!play && Object.values(seen).every(Boolean)) play = true;

	// The hold runs from the moment the plates start in, not from page load.
	let holdTimer;
	$: if (play && held && !holdTimer) holdTimer = setTimeout(() => (held = false), holdMs);
	let holdMs = HOLD_MS;

	// ?preview=p1-first shows a choice at once; ?delay=5 changes the hold, in
	// seconds.
	$: preview = toChoice($page.url.searchParams.get('preview'));
	$: state = preview ? CHOICES[preview] : held ? undefined : CHOICES[choice];
	$: lines =
		play && state
			? [
					{ key: 'chose', label: 'Turn choice', seat: state.seat },
					{ key: 'first', label: 'Plays first', seat: firstPlayer(state.seat, state.order) }
				]
			: [];

	onMount(() => {
		const delay = Number($page.url.searchParams.get('delay'));
		if ($page.url.searchParams.has('delay') && Number.isFinite(delay)) holdMs = delay * 1000;
		const platesTimer = setTimeout(() => (seen.time = true), PLATES_MS);
		const stops = SEATS.map((seat) =>
			onValue(ref(db, `playerInfo/${seat}`), (snap) => {
				const d = snap.val() || {};
				players[seat] = {
					name: d.name || '',
					hero: d.hero || '',
					record: d.record || '',
					pronouns: d.pronouns || '',
					flag: d.flag || ''
				};
				seen[seat] = true;
			})
		);
		stops.push(
			onValue(ref(db, CHOICE_PATH), (snap) => {
				choice = toChoice(snap.val());
				seen.choice = true;
			})
		);
		document.fonts.ready.then(() => (seen.fonts = true));
		return () => {
			clearTimeout(platesTimer);
			clearTimeout(holdTimer);
			stops.forEach((stop) => stop());
		};
	});

	// A name or hero that would run past its room is set smaller; the line
	// keeps its natural width otherwise, so what follows it sits right beside
	// the words and not at the end of a fixed box.
	function fit(node, max) {
		const base = parseFloat(getComputedStyle(node).fontSize);
		const measure = () => {
			node.style.fontSize = `${base}px`;
			const drawn = node.getBoundingClientRect().width;
			if (drawn > max) node.style.fontSize = `${Math.floor((base * max) / drawn)}px`;
		};
		measure();
		document.fonts?.addEventListener?.('loadingdone', measure);
		return {
			update: measure,
			destroy: () => document.fonts?.removeEventListener?.('loadingdone', measure)
		};
	}

	// The choice tags wipe on from the side they point to, with the Top 8
	// plates' sweep of light after, and wipe off the same way.
	const clip = (side, t) =>
		`clip-path: inset(0 ${side === 'left' ? (1 - t) * 100 : 0}% 0 ${side === 'right' ? (1 - t) * 100 : 0}%);`;

	function wipe(node, { side, delay = 0, duration = 600 }) {
		return {
			delay,
			duration,
			easing: cubicOut,
			css: (t) =>
				clip(side, t) +
				`opacity: ${t}; transform: translateX(${(side === 'left' ? -1 : 1) * (1 - t) * 30}px) translateX(-50%);`
		};
	}

	function wipeOut(node, { side, duration = 280 }) {
		return {
			duration,
			easing: cubicIn,
			css: (t) => clip(side, t) + `opacity: ${t}; transform: translateX(-50%);`
		};
	}
</script>

<div class="stage text-white" class:play>
	{#each SEATS as seat (seat)}
		{@const p = players[seat]}
		<!-- The plate: from the screen's edge in to the column, the tan edge on
		     the column's side, everything about the player set toward it. -->
		<div class="plate {seat}">
			<div class="plate-body">
				<!-- The name nearest the column, then the flag, then the pronouns at
				     the outer end; the plate for P1 runs its rows the other way. -->
				<div class="row name-row">
					{#key p.name}<span class="name" use:fit={440}>{p.name}</span>{/key}
					{#if p.flag}
						<span class="flag fi fi-{p.flag}" title={p.flag.toUpperCase()}></span>
					{/if}
					{#if p.pronouns}<span class="pronouns">{p.pronouns}</span>{/if}
				</div>
				<!-- The hero in italic tan with the record beside it on the column's
				     side, as the plates had it. -->
				<div class="row hero-row">
					{#key p.hero}<span class="hero" use:fit={400}>{p.hero}</span>{/key}
					{#if p.record}<span class="record">{p.record}</span>{/if}
				</div>
			</div>
		</div>
	{/each}

	{#each lines as line, i (line.key)}
		<div
			class="tag {line.seat}"
			style="top: {TAG_TOP + i * TAG_STEP}px; --d: {i * 160}ms;"
			in:wipe={{ side: line.seat === 'p1' ? 'left' : 'right', delay: i * 160 }}
			out:wipeOut={{ side: line.seat === 'p1' ? 'left' : 'right' }}
		>
			<span class="arrow" aria-hidden="true">{line.seat === 'p1' ? '◀' : '▶'}</span>
			<span class="label">{line.label}</span>
		</div>
	{/each}
</div>

<style>
	/* Pinned to the browser source size so everything lands on the same pixels
	   whatever window is around it. The VS column runs 758px to 1162px; the
	   plates are set against it, mirrored about the centre, under the scene's
	   own portraits, which end at 883px. */
	.stage {
		position: relative;
		width: 1920px;
		height: 1080px;
		overflow: hidden;
		--tan: #d9b499;
		--plate-top: 905px;
		--plate-height: 120px;
		font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
	}

	.plate {
		position: absolute;
		top: var(--plate-top);
		height: var(--plate-height);
		overflow: hidden;
		background: linear-gradient(90deg, rgba(17, 24, 39, 0.5), rgba(17, 24, 39, 0.74));
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
		opacity: 0;
	}

	.plate.p1 {
		left: 0;
		width: 758px;
		border-right: 8px solid var(--tan);
	}

	.plate.p2 {
		left: 1162px;
		width: 758px;
		border-left: 8px solid var(--tan);
		background: linear-gradient(270deg, rgba(17, 24, 39, 0.5), rgba(17, 24, 39, 0.74));
	}

	/* The sweep of light across the plate once it has slid in. */
	.plate::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: -40%;
		width: 30%;
		background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.2), transparent);
		transform: skewX(-20deg);
		opacity: 0;
	}

	.plate-body {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 690px;
		padding: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2px;
	}

	.plate.p1 .plate-body {
		right: 30px;
		align-items: flex-end;
	}

	.plate.p2 .plate-body {
		left: 30px;
		align-items: flex-start;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		opacity: 0;
	}

	/* The name's row sits on a baseline, so the pronouns stand on the same line
	   as the name's foot. */
	.name-row {
		align-items: baseline;
		gap: 8px;
	}

	.plate.p1 .row {
		flex-direction: row-reverse;
	}

	.name {
		font-size: 44px;
		font-weight: 700;
		line-height: 52px;
		white-space: nowrap;
	}

	.hero {
		font-size: 24px;
		font-weight: 600;
		line-height: 30px;
		font-style: italic;
		color: var(--tan);
		white-space: nowrap;
	}

	.flag {
		width: 38px;
		height: 28px;
		flex-shrink: 0;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
	}

	/* The record, white and bold beside the hero as before, on the column's
	   side: first in the row, which P1's reversed row puts at its right end. */
	.record {
		order: -1;
		font-size: 24px;
		font-weight: 700;
		font-style: normal;
		color: #fff;
		white-space: nowrap;
	}

	/* The pronouns after the name at its outer end: small, plain and quiet. */
	.pronouns {
		font-size: 18px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.55);
		white-space: nowrap;
	}

	/* The turn choice: two tags centred in the gap, each with an arrow toward
	   the seat it is about. */
	.tag {
		position: absolute;
		left: 960px;
		transform: translateX(-50%);
		height: 38px;
		padding: 0 16px;
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 18px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		white-space: nowrap;
		color: var(--tan);
		background: rgba(10, 12, 16, 0.78);
		box-shadow: inset 0 0 0 1px rgba(217, 180, 153, 0.55);
		overflow: hidden;
	}

	.tag.p2 {
		flex-direction: row-reverse;
	}

	.tag::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: -40%;
		width: 30%;
		background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.2), transparent);
		transform: skewX(-20deg);
		opacity: 0;
		animation: shine 0.9s ease-out calc(var(--d) + 350ms) forwards;
		pointer-events: none;
	}

	.arrow,
	.label {
		position: relative;
	}

	.arrow {
		font-size: 16px;
		line-height: 1;
	}

	/* The load: the plates run out from the column to the edges, the two lines
	   of each plate rise in turn, and light sweeps the plates. */
	.play .plate.p1 {
		animation: revealLeft 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0ms both;
	}

	.play .plate.p2 {
		animation: revealRight 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0ms both;
	}

	.play .plate::after {
		animation: shine 0.9s ease-out 450ms forwards;
	}

	.play .row {
		animation: fadeUp 0.5s ease-out both;
	}

	.play .name-row {
		animation-delay: 320ms;
	}

	.play .hero-row {
		animation-delay: 440ms;
	}

	@keyframes revealLeft {
		0% {
			opacity: 0;
			transform: translateX(30px);
			clip-path: inset(0 0 0 100%);
		}
		100% {
			opacity: 1;
			transform: translateX(0);
			clip-path: inset(0);
		}
	}

	@keyframes revealRight {
		0% {
			opacity: 0;
			transform: translateX(-30px);
			clip-path: inset(0 100% 0 0);
		}
		100% {
			opacity: 1;
			transform: translateX(0);
			clip-path: inset(0);
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
</style>
