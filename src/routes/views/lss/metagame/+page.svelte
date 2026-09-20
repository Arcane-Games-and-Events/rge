<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../../firebaseClient';
	import { heroImageUrl } from '$lib/heroMedia';
	import { metagameLayout, REF } from '$lib/metagameLayout';
	import ShrinkText from '$lib/ShrinkText.svelte';

	// Metagame breakdown for a 1920x1080 browser source: a centred heading with the
	// player count under it, then rows, one per hero with at least one player --
	// count, share, portrait, name -- each segment joined to the next with a chevron.
	// The scene behind it is composited in OBS.
	//
	// The rows size themselves to the field. Every dimension is a multiple of the row
	// height, and the column count and row height come from metagameLayout, which
	// picks whatever fills the canvas best for five heroes or forty.
	//
	// Reads the same metagame/<slug> = { name, count } the /metagame page edits, and
	// ranks the same way the original overlay does: count descending, zeroes hidden,
	// share taken against every entry so the percentages add to a hundred.
	let entries = [];

	onMount(() => {
		onValue(ref(db, 'metagame'), (snap) => {
			const val = snap.val() || {};
			entries = Object.entries(val).map(([id, v]) => ({
				id,
				name: v?.name ?? '',
				count: Number(v?.count) || 0
			}));
		});
	});

	$: total = entries.reduce((sum, e) => sum + e.count, 0);
	$: rows = entries
		.filter((e) => e.count > 0)
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
		.map((e) => {
			// "Viserai, Between Worlds" reads as the name over its title, as the
			// reference sets it. A name with no comma but an "of" -- Kassai of the Golden
			// Sand -- is split there instead: on one line it shrank to a third of its
			// size to fit the bar, which is unreadable on air. Two-word surnames such as
			// Jarl Vetreidi are left whole; they still fit at a legible size.
			const [name, ...rest] = e.name.split(',');
			let short = name.trim();
			let title = rest.join(',').trim();
			if (!title) {
				const of = short.match(/^(.+?)\s+(of\s+.+)$/i);
				if (of) [, short, title] = of;
			}
			return {
				...e,
				short,
				title,
				pct: total ? Math.round((e.count / total) * 100) : 0
			};
		});

	// The canvas, and the band beneath the heading the rows may occupy.
	const CANVAS = { width: 1920, height: 1080 };
	const AREA = { width: CANVAS.width, top: 200, bottom: CANVAS.height - 24, sideMargin: 27 };

	// The share plate stands clear of the count plate and the portrait, with the
	// scene showing through the gap, as the Top 8 diamond stands clear of its notch.
	// JOIN_GAP is measured straight across the gap at reference size and scales with
	// the row; the chevron edges run `cut` across for half a row of rise, so the
	// horizontal shift that opens the gap is scaled by the edge's length over its rise.
	const JOIN_GAP = 6;
	const joinShift = (rowH) =>
		((JOIN_GAP * Math.hypot(REF.cut, REF.rowH / 2)) / (REF.rowH / 2)) * (rowH / REF.rowH);

	$: layout = metagameLayout(rows.length, { ...AREA, joinShift });
	// One unit is one reference pixel: every width and font is drawn in units of the
	// row's proportional height. The height it actually stands at, and the spacing
	// between rows, come separately -- both may grow to fill the band.
	$: u = layout.baseRowH / REF.rowH;

	// The name bar's usable width once its padding and the chevron are taken out, at
	// reference size. Both lines render at their set size and only shrink when they
	// would overrun, so a name like KASSAI OF THE GOLDEN SAND scales down to fit
	// instead of being clipped by the bar's edge -- the reference only ever had
	// short names.
	const NAME_BOX = { width: 124, height: 26, size: 24 };
	const TITLE_BOX = { width: 124, height: 14, size: 13 };
	const scaled = (box, k) => ({ width: box.width * k, height: box.height * k, size: box.size * k });
	$: nameBox = scaled(NAME_BOX, u);
	$: titleBox = scaled(TITLE_BOX, u);
</script>

<!-- The join gap scales with the row's width unit, not the height it stands at,
     which is what the layout module assumed when it centred the block. -->
<div class="stage" style="--u: {u}px; --join-shift: {joinShift(layout.baseRowH)}px;">
	<div class="header">
		<div class="heading">Metagame</div>
		<div class="players">{total} {total === 1 ? 'player' : 'players'}</div>
	</div>

	{#if layout.columns}
		<div
			class="list"
			style="left: {layout.left}px; top: {layout.top}px; --rows: {layout.rowsPerColumn}; --row-h: {layout.rowH}px; --row-gap: {layout.rowGap}px; --col-gap: {REF.colGap}px;"
		>
			{#each rows as row (row.id)}
				<div class="row">
					<div class="seg count">
						<div class="txt">{row.count}</div>
					</div>
					<div class="seg pct">
						<div class="txt">
							<span class="share"
								><span class="num">{row.pct}</span><span class="sign">%</span></span
							>
						</div>
					</div>
					<div class="seg portrait">
						{#if row.name}
							<img src={heroImageUrl(row.name)} alt="" />
						{/if}
					</div>
					<div class="seg name">
						<div class="txt">
							<ShrinkText
								text={row.short.toUpperCase()}
								width={nameBox.width}
								height={nameBox.height}
								size={row.title ? nameBox.size : nameBox.size + 2 * u}
							/>
							{#if row.title}
								<ShrinkText
									text={row.title.toUpperCase()}
									width={titleBox.width}
									height={titleBox.height}
									size={titleBox.size}
								/>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	/* Pinned to the browser source size so the heading and every row land on the same
	   pixels whatever window is around them. Every row dimension below is a multiple
	   of --u, one reference pixel, so the rows scale as a piece. */
	.stage {
		position: relative;
		width: 1920px;
		height: 1080px;
		overflow: hidden;
	}

	.header {
		position: absolute;
		top: 28px;
		left: 0;
		width: 100%;
		text-align: center;
	}

	.heading {
		font-size: 100px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.players {
		margin-top: 10px;
		font-size: 36px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	/* Rows fill a column top to bottom and spill into the next. */
	.list {
		position: absolute;
		display: grid;
		grid-auto-flow: column;
		grid-template-rows: repeat(var(--rows), var(--row-h));
		gap: var(--row-gap) var(--col-gap);
	}

	.row {
		display: flex;
		height: var(--row-h);
	}

	.seg {
		position: relative;
		height: 100%;
		overflow: hidden;
		box-sizing: border-box;
	}

	/* A following segment is pulled back over the previous one by the cut depth, so
	   its left-pointing "<" sits exactly in the notch. The share plate is pulled back
	   less on both of its sides, which opens the gap between it and its neighbours. */
	.portrait,
	.pct {
		margin-left: calc(-1 * (20 * var(--u) - var(--join-shift)));
	}

	.name {
		margin-left: calc(-20 * var(--u));
	}

	.txt {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Left-pointing chevrons: the first segment only has the notch on its right, the
	   middle ones a point on the left and a notch on the right, the last a point. */
	.count {
		clip-path: polygon(0 0, 100% 0, calc(100% - 20 * var(--u)) 50%, 100% 100%, 0 100%);
	}

	.pct,
	.portrait {
		clip-path: polygon(
			calc(20 * var(--u)) 0,
			100% 0,
			calc(100% - 20 * var(--u)) 50%,
			100% 100%,
			calc(20 * var(--u)) 100%,
			0 50%
		);
	}

	.name {
		clip-path: polygon(calc(20 * var(--u)) 0, 100% 0, 100% 100%, calc(20 * var(--u)) 100%, 0 50%);
	}

	/* The count plate: pale lavender with dark figures. The LSS layout paints every
	   element white with a rule that matches each one directly, so the dark colour
	   has to out-rank it on the text element itself. */
	.count {
		width: calc(106 * var(--u));
		background: linear-gradient(180deg, #f2e4ff 0%, #d9b8f1 100%);
	}

	.count .txt {
		padding-right: calc(10 * var(--u));
		font-size: calc(46 * var(--u));
		font-weight: 700;
		color: #0e0812 !important;
	}

	/* The share plate is dark with white figures, unlike the count. */
	.pct {
		width: calc(128 * var(--u));
		background: linear-gradient(180deg, #2f1d40 0%, #22132f 100%);
	}

	.pct .txt {
		padding: 0 calc(10 * var(--u));
		font-size: calc(42 * var(--u));
		font-weight: 700;
	}

	/* The sign sits on the digits' baseline, not the row's bottom edge: the rows can
	   stand taller than their proportional height, and anchoring to the edge sent the
	   sign drifting below the number as they did. */
	.share {
		display: inline-flex;
		align-items: baseline;
	}

	.sign {
		font-size: calc(18 * var(--u));
		font-weight: 700;
		margin-left: calc(2 * var(--u));
	}

	.portrait {
		width: calc(172 * var(--u));
		background: #170d20;
	}

	/* The stills are wide frames with the subject to the right, so the crop is taken
	   from the upper right and enlarged to bring the face up to the row height. */
	.portrait img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: right top;
		transform: scale(1.5);
		transform-origin: right top;
	}

	.name {
		width: calc(168 * var(--u));
		background: #33213f;
	}

	.name .txt {
		flex-direction: column;
		gap: calc(2 * var(--u));
		padding: 0 calc(12 * var(--u)) 0 calc(28 * var(--u));
	}
</style>
