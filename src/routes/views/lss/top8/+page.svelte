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

	const seatOf = (seed) => (seed === undefined || seed === null ? null : players[seed]);

	// Fixed boxes so every tile lines up whatever the names are: both lines render at
	// their set size and only an unusually long one is scaled down inside its box.
	const NAME_BOX = { width: 260, height: 34, size: 30 };
	const HERO_BOX = { width: 260, height: 20, size: 17 };

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
				{@const seat = seatOf(seed)}
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

					<div class="who">
						{#if seat}
							<!-- Shrunk to fit rather than clipped: a long name must still be
							     readable, and an ellipsis in the middle of someone's surname
							     is not something to put on air. -->
							<ShrinkText
								text={(seat.name || '').toUpperCase()}
								width={NAME_BOX.width}
								height={NAME_BOX.height}
								size={NAME_BOX.size}
							/>
							<ShrinkText
								text={(seat.hero || '').toUpperCase()}
								width={HERO_BOX.width}
								height={HERO_BOX.height}
								size={HERO_BOX.size}
								weight={400}
							/>
						{/if}
					</div>

					<!-- Rotated square: the frame turns, the art turns back, so the portrait
					     reads upright inside a diamond. -->
					<div class="diamond">
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

	.label {
		position: absolute;
		height: 54px;
		padding: 0 18px;
		display: flex;
		align-items: center;
		font-size: 32px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		background: rgba(10, 8, 18, 0.72);
		border: 2px solid rgba(255, 255, 255, 0.85);
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

	/* The lighter block carrying the finishing position and the flag. */
	.placement {
		flex: none;
		width: 85px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		background: rgba(196, 170, 226, 0.22);
		border: 1px solid rgba(255, 255, 255, 0.22);
		box-sizing: border-box;
	}

	.rank {
		display: flex;
		align-items: baseline;
		line-height: 1;
	}

	.num {
		font-size: 34px;
	}

	.suffix {
		font-size: 16px;
		margin-left: 2px;
	}

	.flag {
		width: 34px !important;
		height: 23px !important;
		line-height: 23px !important;
	}

	/* Name over hero, with room kept clear on the right for the diamond. */
	.who {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 4px;
		padding: 0 110px 0 16px;
		background: rgba(10, 8, 18, 0.72);
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-left: none;
		box-sizing: border-box;
	}

	.diamond {
		position: absolute;
		right: 6px;
		top: 50%;
		width: 74px;
		height: 74px;
		margin-top: -37px;
		transform: rotate(45deg);
		overflow: hidden;
		border: 2px solid rgba(255, 255, 255, 0.85);
		background: #000;
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
	}
</style>
