<script context="module">
	// The gap between the name plates' tan edges runs 768px to 1154px across and
	// 900px to 1012px down; the two tags stack through the middle of it, centred
	// on the column.
	const TOP = 913;
	const STEP = 48;
</script>

<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { ref, onValue } from 'firebase/database';
	import { fly } from 'svelte/transition';
	import { cubicOut, cubicIn } from 'svelte/easing';
	import { db } from '../../../firebaseClient';
	import { CHOICE_PATH, CHOICES, toChoice } from '$lib/choice';
	import { firstPlayer } from '$lib/pregame';

	// Who won the roll and who plays first, for a 1920x1080 browser source over
	// the match-up scene: two small tags centred in the gap between the name
	// plates, under the VS, each with an arrow toward the seat it is about. The
	// plates already carry the names, so the tags do not, and a name of any
	// length changes nothing here. Each player's pronouns are a small tab hung
	// under their name plate, in the plate's own dark with its tan edge carried
	// on down. Nothing is shown until a choice is set,
	// and nothing for the first three seconds after the source loads, so the
	// scene has settled before the tags come in.
	const HOLD_MS = 3000;
	let choice = '';
	let held = true;
	let pronouns = { p1: '', p2: '' };

	// ?preview=p1-first shows a state at once without touching what is stored,
	// so the tags can be lined up in OBS before a match. ?delay=3 changes the
	// hold, in seconds.
	$: preview = toChoice($page.url.searchParams.get('preview'));
	$: state = preview ? CHOICES[preview] : held ? undefined : CHOICES[choice];
	$: lines = state
		? [
				{ key: 'chose', label: 'Turn choice', seat: state.seat },
				{ key: 'first', label: 'Plays first', seat: firstPlayer(state.seat, state.order) }
			]
		: [];
	$: pronounTags =
		preview || !held
			? ['p1', 'p2']
					.filter((seat) => pronouns[seat].trim())
					.map((seat) => ({ seat, text: pronouns[seat].trim() }))
			: [];

	// A tag slides in from the side it points to and is wiped on as it comes,
	// as the Top 8 plates are, and is wiped off the same way. `centred` keeps
	// the centring translate the choice tags are placed with.
	const clip = (side, t) =>
		`clip-path: inset(0 ${side === 'left' ? (1 - t) * 100 : 0}% 0 ${side === 'right' ? (1 - t) * 100 : 0}%);`;

	function wipe(node, { side, delay = 0, duration = 600, centred = false }) {
		return {
			delay,
			duration,
			easing: cubicOut,
			css: (t) =>
				clip(side, t) +
				`opacity: ${t}; transform: translateX(${(side === 'left' ? -1 : 1) * (1 - t) * 30}px)${centred ? ' translateX(-50%)' : ''};`
		};
	}

	function wipeOut(node, { side, duration = 280, centred = false }) {
		return {
			duration,
			easing: cubicIn,
			css: (t) => clip(side, t) + `opacity: ${t};${centred ? ' transform: translateX(-50%);' : ''}`
		};
	}

	onMount(() => {
		const delay = Number($page.url.searchParams.get('delay'));
		const timer = setTimeout(
			() => (held = false),
			Number.isFinite(delay) && $page.url.searchParams.has('delay') ? delay * 1000 : HOLD_MS
		);
		const stops = [
			onValue(ref(db, CHOICE_PATH), (snap) => (choice = toChoice(snap.val()))),
			onValue(ref(db, 'playerInfo/p1/pronouns'), (snap) => (pronouns.p1 = snap.val() || '')),
			onValue(ref(db, 'playerInfo/p2/pronouns'), (snap) => (pronouns.p2 = snap.val() || ''))
		];
		return () => {
			clearTimeout(timer);
			stops.forEach((stop) => stop());
		};
	});
</script>

<div class="stage text-white">
	{#each lines as line, i (line.key)}
		<div
			class="tag {line.seat}"
			style="top: {TOP + i * STEP}px; --d: {i * 160}ms;"
			in:wipe={{ side: line.seat === 'p1' ? 'left' : 'right', delay: i * 160, centred: true }}
			out:wipeOut={{ side: line.seat === 'p1' ? 'left' : 'right', centred: true }}
		>
			<span class="arrow" aria-hidden="true">{line.seat === 'p1' ? '◀' : '▶'}</span>
			<span class="label">{line.label}</span>
		</div>
	{/each}

	{#each pronounTags as tag (tag.seat)}
		<div
			class="pronouns {tag.seat}"
			in:fly={{ y: 10, delay: 360, duration: 500, easing: cubicOut }}
			out:fly={{ y: 10, duration: 240 }}
		>
			<span>{tag.text}</span>
		</div>
	{/each}
</div>

<style>
	/* Pinned to the browser source size so the tags land between the name
	   plates whatever window is around it. */
	.stage {
		position: relative;
		width: 1920px;
		height: 1080px;
		overflow: hidden;
		--tan: #d9b499;
		font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
	}

	.tag {
		position: absolute;
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

	/* The sweep of light the Top 8 plates get once they have slid in. */
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

	/* Centred on the gap, the arrow on the side of the seat it points to. */
	.tag.p1,
	.tag.p2 {
		left: 961px;
		transform: translateX(-50%);
	}

	.tag.p2 {
		flex-direction: row-reverse;
	}

	.arrow,
	.label {
		position: relative;
	}

	.arrow {
		font-size: 16px;
		line-height: 1;
	}

	/* The pronouns, a tab under each name plate: the plates end at 1012px, and
	   their 10px tan edges sit at 757px and 1154px. The tab is the plate's dark
	   with the same edge carried on down its inner side, and the words in the
	   hero line's tan. */
	.pronouns {
		position: absolute;
		top: 1016px;
		height: 30px;
		display: flex;
		align-items: center;
		padding: 0 14px;
		font-size: 15px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		white-space: nowrap;
		color: var(--tan);
		background: rgba(10, 12, 16, 0.82);
	}

	.pronouns.p1 {
		right: calc(1920px - 767px);
		border-right: 10px solid var(--tan);
	}

	.pronouns.p2 {
		left: 1154px;
		border-left: 10px solid var(--tan);
	}
</style>
