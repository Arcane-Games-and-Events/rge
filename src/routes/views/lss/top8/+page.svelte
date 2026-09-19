<script>
	import { onMount } from 'svelte';
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

	$: rounds = [
		{
			label: 'Quarters',
			x: 23,
			labelY: 23,
			matches: QUARTER_SEEDS.map((seeds, i) => ({
				key: `m${i}`,
				seeds,
				y: [87 + i * 250, 202 + i * 250]
			}))
		},
		{
			label: 'Semis',
			x: 702,
			labelY: 148,
			matches: [
				{ key: 'm4', seeds: [matches.m0, matches.m1], y: [212, 327] },
				{ key: 'm5', seeds: [matches.m2, matches.m3], y: [712, 827] }
			]
		},
		{
			label: 'Finals',
			x: 1370,
			labelY: 398,
			matches: [{ key: 'm6', seeds: [matches.m4, matches.m5], y: [462, 577] }]
		}
	];

	// A seat recedes once its match has a winner that is not it. An unplayed match
	// leaves both at full strength rather than guessing at one.
	const decided = (key, seed) =>
		matches[key] !== undefined && matches[key] !== null && matches[key] !== seed;

	// Seats are resolved in the markup rather than through this helper: Svelte tracks
	// the dependencies it can see in an expression, and `players` read inside a
	// function body is not one of them, so the quarters kept showing the old values
	// until something else forced the block to rebuild.

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
	// Sized so the turned square spans the tile's full height: its top and bottom
	// points then sit exactly on the bar's two notch corners.
	const DIAMOND = TILE_H / Math.SQRT2;
	const DIAMOND_RIGHT = 6;
	const DIAMOND_HALF = (DIAMOND * Math.SQRT2) / 2;
	const DIAMOND_CENTRE = DIAMOND_RIGHT + DIAMOND / 2;
	// Clear space between the bar's edge and the diamond, measured straight across
	// the gap. The edges run at 45 degrees, so opening a gap of g means moving the
	// notch g * sqrt(2) along the horizontal.
	const NOTCH_GAP = 2;
	const NOTCH_SHIFT = NOTCH_GAP * Math.SQRT2;
	const NOTCH_CORNER = DIAMOND_CENTRE + NOTCH_SHIFT;
	const NOTCH_TIP = DIAMOND_CENTRE + DIAMOND_HALF + NOTCH_SHIFT;
	const notchClip = `polygon(0 0, calc(100% - ${NOTCH_CORNER}px) 0, calc(100% - ${NOTCH_TIP}px) 50%, calc(100% - ${NOTCH_CORNER}px) 100%, 0 100%)`;

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
			{#each match.seeds as seed, i (i)}
				{@const seat = seed === undefined || seed === null ? null : players[seed]}
				<div
					class="tile"
					class:dim={decided(match.key, seed)}
					style="left: {round.x}px; top: {match.y[i]}px;"
				>
					<div class="placement">
						{#if seat}
							{@const o = ordinal(seed + 1)}
							<span class="rank"
								><span class="num">{o.n}</span><span class="suffix">{o.suffix}</span></span
							>
							{#if seat.flag}
								<span class="fi fi-{seat.flag} flag"></span>
							{/if}
						{/if}
					</div>

					<div class="who" style="clip-path: {notchClip};">
						{#if seat}
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
						{/if}
					</div>

					<!-- Rotated square: the frame turns, the art turns back, so the portrait
					     reads upright inside a diamond. -->
					<div
						class="diamond"
						style="width: {DIAMOND}px; height: {DIAMOND}px; right: {DIAMOND_RIGHT}px; margin-top: {-DIAMOND /
							2}px;"
					>
						<div class="diamond-inner">
							{#if seat && seat.hero}
								<img src={heroImageUrl(seat.hero)} alt="" />
							{/if}
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
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #24132f !important;
		background: linear-gradient(180deg, #efe4f8, #d9c4ec);
		border: 3px solid #2a1636;
		border-radius: 6px;
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

	/* Losers recede rather than vanish: the bracket still reads as a whole. */
	.dim {
		opacity: 0.35;
	}

	/* Lavender block carrying the finishing position and the flag, dark text on light
	   so it reads as a separate plate rather than part of the name bar. */
	.placement {
		flex: none;
		width: 85px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 5px;
		color: #24132f !important;
		background: linear-gradient(180deg, #efe4f8, #cfb6e6);
		border-radius: 6px;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5);
		box-sizing: border-box;
		z-index: 1;
	}

	.rank {
		display: flex;
		align-items: baseline;
		line-height: 1;
	}

	/* Set on the children as well as the block: the layout's blanket rule matches
	   every element directly, and a matched rule beats an inherited one however dark
	   the parent is. */
	.num {
		font-size: 36px;
		line-height: 1;
		color: #24132f !important;
	}

	.suffix {
		font-size: 16px;
		margin-left: 2px;
		color: #24132f !important;
	}

	.flag {
		width: 34px !important;
		height: 23px !important;
		line-height: 23px !important;
	}

	/* Name over hero, with room kept clear on the right for the diamond. */
	/* The name bar runs darkest at the left and warms toward the portrait. Its right
	   edge is notched to the diamond's shape -- the clip-path is set inline from the
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
		background: linear-gradient(95deg, #2e1a3f 0%, #4a2657 48%, #7c4080 100%);
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
