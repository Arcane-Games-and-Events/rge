<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../../firebaseClient';
	import ShrinkText from '$lib/ShrinkText.svelte';
	import 'flag-icons/css/flag-icons.min.css';
	import '$lib/flagOverrides.css';

	// Player info for a 1920x1080 browser source. OBS holds several instances of
	// this page, each cropped to one piece of it -- a name, a hero, a record, a flag
	// -- and places them separately. So every piece is pinned to its own pixels: a
	// piece that is empty, or a stylesheet or font that is late in one instance,
	// leaves everything else exactly where the crops expect it.
	let players = {
		p1: { name: '', record: '', hero: '', flag: '' },
		p2: { name: '', record: '', hero: '', flag: '' }
	};

	let draftInfo = { name: '', pod: '', seat: '' };

	function fetchData() {
		Object.keys(players).forEach((playerId) => {
			onValue(ref(db, `playerInfo/${playerId}`), (snapshot) => {
				const data = snapshot.val();
				if (data) {
					players[playerId] = {
						name: data.name || '',
						record: data.record || '',
						hero: data.hero || '',
						flag: data.flag || ''
					};
				}
			});
		});
	}

	function fetchDraftInfo() {
		onValue(ref(db, 'playerInfo/draft'), (snapshot) => {
			const data = snapshot.val() || {};
			draftInfo.name = data.name || '';
			draftInfo.pod = data.pod || '';
			draftInfo.seat = data.seat || '';
		});
	}

	onMount(() => {
		fetchData();
		fetchDraftInfo();
	});

	// Uppercased in the data rather than with text-transform, because ShrinkText
	// measures the string it is given: a CSS transform would have it sizing the
	// lower-case width and then overrunning once the capitals were drawn.
	const upper = (text) => (text || '').toUpperCase();

	// The block is drawn at twice the size it was first laid out at, about the same
	// centre line. Every position and size below is in the original pixels and
	// scaled on the way out, so the proportions are unchanged.
	const SCALE = 2;
	const px = (n) => n * SCALE;

	// One column centred on the source. The first block has the plain names, P1's
	// against the left edge and P2's against the right, each seat's hero, record and
	// flag centred beneath; the second block has the fitted names, which render at
	// one size and only shrink if they would overrun. The flag sits centred, a little
	// below its row's top.
	const CENTRE = 960;
	const COLUMN = { width: px(288) };
	const FLAG = { width: px(32), height: px(24), inset: px(4) };
	const NAME_BOX = { width: px(288), height: px(40), size: px(28) };
	const TYPE = {
		name: { size: px(24), line: px(32) },
		small: { size: px(14), line: px(20) }
	};

	const seats = [
		{
			id: 'p1',
			edge: 'left',
			plain: { name: 0, hero: 32, record: 52, flag: 72 },
			fitted: { name: 230, hero: 270, record: 290, flag: 310 }
		},
		{
			id: 'p2',
			edge: 'right',
			plain: { name: 103, hero: 135, record: 155, flag: 175 },
			fitted: { name: 341, hero: 381, record: 401, flag: 421 }
		}
	];

	const DRAFT_TOP = 452;

	const vars = [
		`--col-left: ${CENTRE - COLUMN.width / 2}px`,
		`--col-width: ${COLUMN.width}px`,
		`--flag-left: ${CENTRE - FLAG.width / 2}px`,
		`--flag-width: ${FLAG.width}px`,
		`--flag-height: ${FLAG.height}px`,
		`--name-size: ${TYPE.name.size}px`,
		`--name-line: ${TYPE.name.line}px`,
		`--small-size: ${TYPE.small.size}px`,
		`--small-line: ${TYPE.small.line}px`
	].join('; ');
</script>

<div class="stage font-bold text-white" style={vars}>
	{#each seats as seat (seat.id)}
		<!-- Plain names, anchored to the column's outer edge. Not given the column's
		     width: a name wider than its box is start-aligned whatever text-align says,
		     which put a long P2 name's right edge past the column. -->
		<p class="edge {seat.edge} name whitespace-nowrap" style="top: {px(seat.plain.name)}px;">
			{upper(players[seat.id].name)}
		</p>
		<p class="slot small text-center" style="top: {px(seat.plain.hero)}px;">
			{players[seat.id].hero}
		</p>
		<p class="slot small text-center" style="top: {px(seat.plain.record)}px;">
			{players[seat.id].record}
		</p>
		{#if players[seat.id].flag}
			<span
				class="flag fi fi-{players[seat.id].flag}"
				style="top: {px(seat.plain.flag) + FLAG.inset}px;"
				title={players[seat.id].flag.toUpperCase()}
			></span>
		{/if}

		<!-- Fitted names, centred -->
		<div
			class="slot flex justify-center"
			style="top: {px(seat.fitted.name)}px; height: {NAME_BOX.height}px;"
		>
			<ShrinkText
				text={upper(players[seat.id].name)}
				width={NAME_BOX.width}
				height={NAME_BOX.height}
				size={NAME_BOX.size}
			/>
		</div>
		<p class="slot small text-center" style="top: {px(seat.fitted.hero)}px;">
			{players[seat.id].hero}
		</p>
		<p class="slot small text-center" style="top: {px(seat.fitted.record)}px;">
			{players[seat.id].record}
		</p>
		{#if players[seat.id].flag}
			<span
				class="flag fi fi-{players[seat.id].flag}"
				style="top: {px(seat.fitted.flag) + FLAG.inset}px;"
				title={players[seat.id].flag.toUpperCase()}
			></span>
		{/if}
	{/each}

	<p class="slot name text-center" style="top: {px(DRAFT_TOP)}px;">
		{draftInfo.name}
	</p>
</div>

<style>
	/* Pinned to the browser source size so every piece lands on the same pixels
	   whatever window is around it. */
	.stage {
		position: relative;
		width: 1920px;
		height: 1080px;
		overflow: hidden;
	}

	.slot {
		position: absolute;
		left: var(--col-left);
		width: var(--col-width);
		margin: 0;
	}

	/* Anchored by one edge and free to grow away from it: P1 to the right, P2 to the
	   left, so the anchored edge stays put however long the name. */
	.edge {
		position: absolute;
		margin: 0;
	}

	.edge.left {
		left: var(--col-left);
	}

	.edge.right {
		right: calc(1920px - var(--col-left) - var(--col-width));
	}

	/* Type is sized here rather than with the utility classes, so it scales with
	   the geometry and a row is exactly as tall as its line. */
	.name {
		font-size: var(--name-size);
		line-height: var(--name-line);
		height: var(--name-line);
	}

	.small {
		font-size: var(--small-size);
		line-height: var(--small-line);
		height: var(--small-line);
	}

	/* The flag's own stylesheet sizes it from the font and lays it inline; placed and
	   sized outright instead, so a font or stylesheet arriving late cannot move it,
	   and its absence cannot move anything else. */
	.flag {
		position: absolute;
		left: var(--flag-left);
		width: var(--flag-width);
		height: var(--flag-height);
		display: block;
		line-height: var(--flag-height);
	}
</style>
