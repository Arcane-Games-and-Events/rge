<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../../firebaseClient';
	import { heroImageUrl } from '$lib/heroMedia';
	import ShrinkText from '$lib/ShrinkText.svelte';
	import 'flag-icons/css/flag-icons.min.css';
	import '$lib/flagOverrides.css';

	// Top 8 bracket for a 1920x1080 browser source, reading the same top8/players and
	// top8/matches the /graphics page edits. The geometry follows the reference
	// overlay: columns at x 23 / 702 / 1370, tiles 472x105, the hero portrait a 105px
	// diamond sitting over the right-hand end. The background is left transparent so
	// the scene behind it shows through.
	let players = Array(8)
		.fill()
		.map(() => ({ name: '', hero: '', flag: '' }));
	let matches = {};

	onMount(() => {
		onValue(ref(db, 'top8/players'), (snap) => {
			const data = snap.val() || {};
			players = players.map((_, i) => ({
				name: data[i]?.name ?? '',
				hero: data[i]?.hero ?? '',
				flag: data[i]?.flag ?? ''
			}));
		});
		onValue(ref(db, 'top8/matches'), (snap) => (matches = snap.val() || {}));
	});

	// 1v8, 4v5, 3v6, 2v7 -- the pairings the editor already writes against.
	const QUARTER_SEEDS = [
		[0, 7],
		[3, 4],
		[2, 5],
		[1, 6]
	];

	// Each seat is resolved here rather than with {@const} in the markup, for two
	// reasons. It makes `players` a visible dependency of `rounds`, so the tiles
	// refresh when a player is edited. And Svelte 4 drops the intro/outro methods
	// from any block that has an {@const} as a direct child, so with one sitting
	// between the {#if} and the {#key}, the winner's fade-in was never scheduled.
	const seatFor = (seed) => (seed === undefined || seed === null ? null : players[seed]);
	const seats = (pair) => pair.map((seed, i) => ({ i, seed, seat: seatFor(seed) }));

	// `players &&` puts the store in the reactive statement's own expression;
	// seatFor reads it from inside a function body, which Svelte cannot see.
	$: rounds = players && [
		{
			label: 'Quarters',
			x: 23,
			labelY: 23,
			advances: true,
			matches: QUARTER_SEEDS.map((pair, i) => ({
				key: `m${i}`,
				seats: seats(pair),
				y: [87 + i * 250, 202 + i * 250]
			}))
		},
		{
			label: 'Semis',
			x: 702,
			labelY: 148,
			advances: true,
			matches: [
				{ key: 'm4', seats: seats([matches.m0, matches.m1]), y: [212, 327] },
				{ key: 'm5', seats: seats([matches.m2, matches.m3]), y: [712, 827] }
			]
		},
		{
			label: 'Finals',
			x: 1370,
			labelY: 398,
			matches: [{ key: 'm6', seats: seats([matches.m4, matches.m5]), y: [462, 577] }]
		}
	];

	// A seat recedes once its match has a winner that is not it. An unplayed match
	// leaves both at full strength rather than guessing at one.
	const decided = (key, seed) =>
		matches[key] !== undefined && matches[key] !== null && matches[key] !== seed;

	// Fixed boxes so every tile lines up whatever the names are: both lines render at
	// their set size and only an unusually long one is scaled down inside its box.
	// Sized to the space the bar actually leaves once its padding and the portrait are
	// accounted for. Any wider and a long name runs under the angled right edge, which
	// clips it -- the very thing the shrink-to-fit is there to prevent.
	const NAME_BOX = { width: 250, height: 34, size: 30 };
	const HERO_BOX = { width: 250, height: 20, size: 17 };

	// The portrait and the notch cut for it come from the same numbers. The diamond is
	// a square turned 45 degrees, so its half-width is side / sqrt(2), and a notch that
	// wraps it needs its two edges at exactly that slope, meeting the diamond's own
	// corners. Its centre sits DIAMOND_RIGHT + side/2 in from the tile's right edge.
	const TILE_H = 105;
	const TILE_W = 472;

	// The chevron beside each pair that points the winner at the next round: 48x68,
	// centred on the pair. The reference stood it 45px clear of the tiles; it sits
	// tighter here, and since the diamond overhangs the tile by 9px the clearance
	// from the portrait's point is 9px less than the gap says.
	const ARROW = { w: 48, h: 68, gap: 20 };
	// Sized so the turned square spans the tile's full height: its top and bottom
	// points then sit exactly on the bar's two notch corners.
	const DIAMOND = TILE_H / Math.SQRT2;
	const DIAMOND_RIGHT = 6;
	const DIAMOND_HALF = (DIAMOND * Math.SQRT2) / 2;
	const DIAMOND_CENTRE = DIAMOND_RIGHT + DIAMOND / 2;
	// Clear space between the bar's edge and the diamond, measured straight across
	// the gap. The edges run at 45 degrees, so opening a gap of g means moving the
	// notch g * sqrt(2) along the horizontal.
	const NOTCH_GAP = 10;
	const NOTCH_SHIFT = NOTCH_GAP * Math.SQRT2;
	const NOTCH_CORNER = DIAMOND_CENTRE + NOTCH_SHIFT;
	const NOTCH_TIP = DIAMOND_CENTRE + DIAMOND_HALF + NOTCH_SHIFT;
	const notchClip = `polygon(0 0, calc(100% - ${NOTCH_CORNER}px) 0, calc(100% - ${NOTCH_TIP}px) 50%, calc(100% - ${NOTCH_CORNER}px) 100%, 0 100%)`;

	// How a winner arrives in the next round's box. Long enough to read as an
	// entrance rather than a flicker, short enough that the bracket never looks
	// behind the operator. The loser's box dims on its own, faster, so the eye
	// goes from the fade-down to the fade-up.
	const ARRIVE_MS = 650;

	// The arrival. A winner comes through a portal: they start small, blurred and
	// blown-out bright with a colour fringe -- magenta one side, cyan the other, the
	// way light splits at a rift -- and warp up to size as it clears. Run in reverse
	// on the way out, so a cleared or re-picked winner is pulled back through.
	//
	// `scale` is off for the portrait: it carries a resting transform of its own that
	// frames the face, and a transition that writes transform overrides it for the
	// duration, then hands back -- so the image sat small and popped to size at the
	// end. Without it the portrait materialises through the blur and the fringe
	// inside its frame, and the plates carry the scale.
	function portalIn(node, { duration = ARRIVE_MS, delay = 0, scale = true } = {}) {
		const opacity = +getComputedStyle(node).opacity;
		return {
			duration,
			delay,
			easing: cubicOut,
			css: (t, u) =>
				`opacity: ${t * opacity};` +
				(scale ? `transform: scale(${0.55 + 0.45 * t}) rotate(${-4 * u}deg);` : '') +
				`filter: blur(${12 * u}px) brightness(${1 + 1.6 * u}) saturate(${1 + 2.5 * u})` +
				` drop-shadow(${-9 * u}px 0 rgba(255, 0, 200, ${0.8 * u}))` +
				` drop-shadow(${9 * u}px 0 rgba(0, 220, 255, ${0.8 * u}));`
		};
	}

	// 1ST, 2ND, 3RD, 4TH -- the placement reads as a finishing position rather than an
	// index, which is what the seed number means to anyone watching.
	function ordinal(n) {
		const tens = n % 100;
		if (tens >= 11 && tens <= 13) return { n, suffix: 'TH' };
		return { n, suffix: ['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH' };
	}
</script>

<div class="stage">
	{#each rounds as round (round.label)}
		<div class="label" style="left: {round.x}px; top: {round.labelY}px;">{round.label}</div>

		{#each round.matches as match (match.key)}
			{#if round.advances}
				<!-- Two strokes closing to a point: the pair on the left, the winner's
				     destination on the right. -->
				<svg
					class="arrow"
					width={ARROW.w}
					height={ARROW.h}
					viewBox="0 0 {ARROW.w} {ARROW.h}"
					style="left: {round.x + TILE_W + ARROW.gap}px; top: {(match.y[0] + match.y[1] + TILE_H) /
						2 -
						ARROW.h / 2}px;"
					aria-hidden="true"
				>
					<polyline
						points="4,4 {ARROW.w - 4},{ARROW.h / 2} 4,{ARROW.h - 4}"
						fill="none"
						stroke="#ffffff"
						stroke-width="5"
						stroke-linecap="square"
						stroke-linejoin="miter"
					/>
				</svg>
			{/if}
			{#each match.seats as { i, seed, seat } (i)}
				<div
					class="tile"
					class:dim={decided(match.key, seed)}
					style="left: {round.x}px; top: {match.y[i]}px;"
				>
					<!-- The rift the winner arrives through: a rotating ring of violet and
					     hellfire that opens from a point behind the tile, spins out past its
					     edges and dies. One shot, mounted with the winner and gone with them. -->
					{#each seat ? [seed] : [] as key (key)}
						<div class="rift" out:fade={{ duration: 120 }}></div>
					{/each}
					<div class="placement">
						<!-- A keyed each around the fading element, rather than an if block with a
						     key block inside it. With the key block between the if and the element,
						     the compiled block was rebuilt on change without ever scheduling its
						     intro, so the winner snapped in. A keyed each mounts with an intro,
						     unmounts with an outro, and a changed key does both -- a winner re-picked
						     to a different seat arrives the same way a first winner does. -->
						{#each seat ? [seed] : [] as key (key)}
							<div class="arrive" transition:portalIn>
								<span class="rank"
									><span class="num">{ordinal(seed + 1).n}</span><span class="suffix"
										>{ordinal(seed + 1).suffix}</span
									></span
								>
								{#if seat.flag}
									<span class="fi fi-{seat.flag} flag"></span>
								{/if}
							</div>
						{/each}
					</div>

					<div class="who" style="clip-path: {notchClip};">
						{#each seat ? [seed] : [] as key (key)}
							<div class="arrive" transition:portalIn>
								<!-- Shrunk to fit rather than clipped: a long name must still be
								     readable, and an ellipsis in the middle of someone's surname
								     is not something to put on air. -->
								<ShrinkText
									text={(seat.name || '').toUpperCase()}
									width={NAME_BOX.width}
									height={NAME_BOX.height}
									size={NAME_BOX.size}
									align="left"
								/>
								<ShrinkText
									text={(seat.hero || '').toUpperCase()}
									width={HERO_BOX.width}
									height={HERO_BOX.height}
									size={HERO_BOX.size}
									weight={400}
									align="left"
								/>
							</div>
						{/each}
					</div>

					<!-- Rotated square: the frame turns, the art turns back, so the portrait
					     reads upright inside a diamond. -->
					<div
						class="diamond"
						style="width: {DIAMOND}px; height: {DIAMOND}px; right: {DIAMOND_RIGHT}px; margin-top: {-DIAMOND /
							2}px;"
					>
						<div class="diamond-inner">
							{#each seat && seat.hero ? [seed] : [] as key (key)}
								<img src={heroImageUrl(seat.hero)} alt="" transition:portalIn={{ scale: false }} />
							{/each}
						</div>
					</div>
				</div>
			{/each}
		{/each}
	{/each}
</div>

<style>
	/* Pinned to the browser source size rather than the viewport, so every tile lands
	   on the same pixel whatever window happens to be around it. */
	.stage {
		position: relative;
		width: 1920px;
		height: 1080px;
		overflow: hidden;
	}

	/* The round labels are dark on lavender, which means out-specifying the blanket
	   white the LSS layout sets on every element under it. */
	.label {
		position: absolute;
		height: 54px;
		padding: 0 20px;
		display: flex;
		align-items: center;
		font-size: 32px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #24132f !important;
		background: linear-gradient(180deg, #f6ecff 0%, #ecd6fe 50%, #dcc0f4 100%);
		border: 3px solid #2a1636;
	}

	.arrow {
		position: absolute;
		overflow: visible;
	}

	.tile {
		position: absolute;
		width: 472px;
		height: 105px;
		display: flex;
		align-items: stretch;
		box-sizing: border-box;
		transition: opacity 260ms ease;
	}

	/* The plates sit above the rift, which spins out from beneath them. */
	.placement,
	.who {
		position: relative;
		z-index: 1;
	}

	/* The rift: a void at the centre, and two rings of dark purple spun out around
	   it -- the outer streaked and turning one way, a thinner inner ring the other,
	   both dilating with the whole as it opens and dies. */
	.rift {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 140px;
		height: 140px;
		margin: -70px 0 0 -70px;
		border-radius: 50%;
		pointer-events: none;
		z-index: 0;
		background: radial-gradient(
			circle,
			rgba(12, 3, 26, 0.95) 0%,
			rgba(38, 10, 70, 0.7) 22%,
			rgba(60, 18, 105, 0.25) 40%,
			rgba(60, 18, 105, 0) 52%
		);
		/* Linear timing with the shape drawn into the keyframes, so the opacity can
		   have its own long, gentle tail while the scale settles early. */
		animation: rift-open 1400ms linear both;
	}

	/* Both rings are blurred and feathered: the masks ramp in and out over a wide
	   band rather than a few percent, so nothing in the rift has a hard edge and it
	   reads as smoke and vapour rather than drawn circles. */
	.rift::before,
	.rift::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
	}

	/* Outer ring: broad, broken into dark streaks, a turn and a half clockwise. */
	.rift::before {
		background: conic-gradient(
			from 0deg,
			rgba(40, 10, 75, 0) 0deg,
			rgba(96, 40, 160, 0.9) 50deg,
			rgba(28, 7, 55, 0.95) 95deg,
			rgba(130, 70, 205, 0.8) 140deg,
			rgba(20, 5, 42, 0.15) 190deg,
			rgba(72, 26, 128, 0.9) 245deg,
			rgba(28, 7, 55, 0.95) 295deg,
			rgba(110, 55, 185, 0.75) 335deg,
			rgba(40, 10, 75, 0) 360deg
		);
		-webkit-mask: radial-gradient(circle, transparent 30%, #000 50%, #000 58%, transparent 84%);
		mask: radial-gradient(circle, transparent 30%, #000 50%, #000 58%, transparent 84%);
		filter: blur(8px);
		animation: rift-spin 1400ms cubic-bezier(0.3, 0.6, 0.2, 1) both;
	}

	/* Inner ring: thin, brighter at its edges, two full turns the other way. */
	.rift::after {
		background: conic-gradient(
			from 90deg,
			rgba(60, 20, 110, 0) 0deg,
			rgba(160, 100, 235, 0.9) 50deg,
			rgba(50, 15, 95, 0.95) 110deg,
			rgba(60, 20, 110, 0) 160deg,
			rgba(140, 80, 220, 0.9) 230deg,
			rgba(50, 15, 95, 0.95) 300deg,
			rgba(60, 20, 110, 0) 360deg
		);
		-webkit-mask: radial-gradient(circle, transparent 18%, #000 32%, #000 38%, transparent 56%);
		mask: radial-gradient(circle, transparent 18%, #000 32%, #000 38%, transparent 56%);
		filter: blur(6px);
		animation: rift-spin-back 1400ms cubic-bezier(0.3, 0.6, 0.2, 1) 60ms both;
	}

	@keyframes rift-open {
		0% {
			transform: scale(0.12);
			opacity: 0;
		}
		12% {
			opacity: 1;
		}
		35% {
			transform: scale(1.3);
			opacity: 0.95;
		}
		55% {
			transform: scale(1.55);
			opacity: 0.7;
		}
		75% {
			transform: scale(1.68);
			opacity: 0.35;
		}
		90% {
			transform: scale(1.74);
			opacity: 0.1;
		}
		100% {
			transform: scale(1.76);
			opacity: 0;
		}
	}

	@keyframes rift-spin {
		to {
			transform: rotate(540deg);
		}
	}

	@keyframes rift-spin-back {
		to {
			transform: rotate(-720deg);
		}
	}

	/* Losers recede rather than vanish: the bracket still reads as a whole. */
	.dim {
		opacity: 0.35;
	}

	/* Lavender block carrying the finishing position and the flag, dark text on light
	   so it reads as a separate plate rather than part of the name bar. */
	.placement {
		flex: none;
		width: 85px;
		/* The name bar overlaps this plate's right edge by 8px and paints over it, so
		   the plate a viewer sees is 77 wide. Centring on the full 85 put the seed and
		   flag 4px right of where they read as centred. */
		padding-right: 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: #24132f !important;
		background: linear-gradient(180deg, #f6ecff 0%, #ecd6fe 50%, #dcc0f4 100%);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5);
		box-sizing: border-box;
		z-index: 1;
	}

	/* The fading wrapper takes over the layout its parent box used to do. */
	.placement .arrive {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.who .arrive {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	/* Digit and suffix are centred together, as one word -- 1ST, 2ND -- with the
	   suffix sitting on the digit's baseline. */
	.rank {
		display: flex;
		align-items: baseline;
		justify-content: center;
	}

	/* Set on the children as well as the block: the layout's blanket rule matches
	   every element directly, and a matched rule beats an inherited one however dark
	   the parent is. */
	/* Line box tightened to the digit's ink: at line-height 1 the face leaves a
	   third of the box empty beneath the glyph, so centring the box set the digit
	   visibly high. */
	.num {
		font-size: 36px;
		font-weight: 700;
		line-height: 0.78;
		color: #24132f !important;
	}

	.suffix {
		margin-left: 2px;
		font-size: 16px;
		font-weight: 700;
		line-height: 0.8;
		color: #24132f !important;
	}

	.flag {
		width: 36px !important;
		height: 27px !important;
		line-height: 27px !important;
	}

	/* Name over hero, with room kept clear on the right for the diamond. */
	/* The name bar holds #3A274E across its left half and lifts toward the portrait,
	   as the reference does. Its right edge is notched to the diamond's shape -- the clip-path is set inline from the
	   same numbers that place the portrait, so the two edges run parallel with a
	   constant gap between them. */
	.who {
		flex: 1;
		min-width: 0;
		margin-left: -8px;
		padding: 0 118px 0 24px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 3px;
		background: linear-gradient(95deg, #3a274e 0%, #3a274e 42%, #6e4a8a 100%);
		box-sizing: border-box;
	}

	/* Size and position come from the script, alongside the notch cut for it. */
	.diamond {
		position: absolute;
		top: 50%;
		transform: rotate(45deg);
		overflow: hidden;
		border: 3px solid #e4d5f2;
		background: #140b1c;
		z-index: 2;
	}

	.diamond-inner {
		width: 100%;
		height: 100%;
		transform: rotate(-45deg) scale(1.42);
	}

	.diamond-inner img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		/* The stills are 16:9 frames whose subject sits to the right, so the square crop
		   is taken from that edge. That alone is not enough: a diamond is widest across
		   its middle, so anything against the right edge falls into the clipped corner.
		   The image is pulled left to carry that content into the centre of the shape,
		   and pushed down so the framing sits in the upper right of the source. It is
		   scaled up by more than it is moved, so no gap opens behind it. */
		object-position: right center;
		transform: scale(1.45) translate(-8%, 8%);
	}
</style>
