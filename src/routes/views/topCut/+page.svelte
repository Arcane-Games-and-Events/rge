<script>
	import { onMount, onDestroy } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { FEATURE_PATH } from '$lib/featureMatch';
	import { db } from '../../../firebaseClient';
	import ShrinkText from '$lib/ShrinkText.svelte';

	// Hydrate from localStorage or defaults
	let players, matches;
	if (typeof window !== 'undefined') {
		const sp = JSON.parse(localStorage.getItem('top8Players') || 'null');
		players =
			Array.isArray(sp) && sp.length === 8
				? sp
				: Array(8)
						.fill()
						.map(() => ({ name: '', hero: '' }));

		const sm = JSON.parse(localStorage.getItem('top8Matches') || 'null');
		matches =
			sm &&
			typeof sm === 'object' &&
			['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6'].every((k) => k in sm)
				? sm
				: { m0: null, m1: null, m2: null, m3: null, m4: null, m5: null, m6: null };
	} else {
		players = Array(8)
			.fill()
			.map(() => ({ name: '', hero: '' }));
		matches = { m0: null, m1: null, m2: null, m3: null, m4: null, m5: null, m6: null };
	}

	let playersUnsub, matchesUnsub, eventUnsub, featureUnsub;
	// The match on the booth as the feature match, marked by a label standing up
	// the left of its two plates, as the pairings mark their table.
	let feature = null;
	let eventText = '';
	let imagesReady = false;
	let preloadedImages = new Map();

	// Two-phase rendering: track DOM image loads
	let domImagesLoaded = 0;
	let displayReady = false;
	let expectedImageCount = 0;

	// === IMAGE HELPERS ===
	const normalize = (s = '') => s.toLowerCase().replace(/["',]/g, '').trim();

	// Exceptions map
	const IMAGE_EXCEPTIONS = {
		'arakni huntsman': '/heroImages/arakni-huntsman.jpg'
	};

	function slugify(str) {
		return str
			.toLowerCase()
			.replace(/["',]/g, '')
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.trim();
	}

	function getHeroImage(hero) {
		if (!hero) return '/heroImages/default.jpg';
		const key = normalize(hero);
		if (key in IMAGE_EXCEPTIONS) return IMAGE_EXCEPTIONS[key];
		return `/heroImages/${slugify(hero)}.jpg`;
	}

	// Get preloaded image or fallback
	function getPreloadedImage(hero) {
		if (!hero) return '/heroImages/default.jpg';
		return preloadedImages.get(hero) || getHeroImage(hero);
	}

	// Preload a single image
	function preloadImage(hero) {
		return new Promise((resolve) => {
			if (!hero) {
				resolve(null);
				return;
			}

			const src = getHeroImage(hero);
			const img = new Image();

			img.onload = () => {
				preloadedImages.set(hero, src);
				resolve(src);
			};

			img.onerror = () => {
				preloadedImages.set(hero, src);
				resolve(src);
			};

			img.src = src;
		});
	}

	// The bracket holds for a second and a half once its portraits are in
	// before it draws, so the scene has settled under it.
	const HOLD_MS = 1500;
	let revealTimer = null;
	function reveal() {
		clearTimeout(revealTimer);
		revealTimer = setTimeout(() => (displayReady = true), HOLD_MS);
	}

	// Preload all player hero images
	async function preloadAllImages(playerList) {
		const heroesToLoad = playerList.map((p) => p.hero).filter((h) => h && h.trim());

		// Count how many images will be in the DOM (quarterfinals always show 8)
		const qfImageCount = playerList.filter((p) => p.hero && p.hero.trim()).length;
		resetDisplayState(qfImageCount);

		if (heroesToLoad.length === 0) {
			imagesReady = true;
			reveal();
			return;
		}

		imagesReady = false;
		const promises = heroesToLoad.map((hero) => preloadImage(hero));
		await Promise.all(promises);
		imagesReady = true;
	}

	// Handle when a DOM <img> element finishes loading/decoding
	function handleDomImageLoad() {
		domImagesLoaded++;
		if (domImagesLoaded >= expectedImageCount && expectedImageCount > 0) {
			// All DOM images ready: draw after the hold
			reveal();
		}
	}

	// Reset display state when data changes
	function resetDisplayState(count) {
		domImagesLoaded = 0;
		displayReady = false;
		expectedImageCount = count;
	}

	onMount(() => {
		playersUnsub = onValue(ref(db, 'top8/players'), async (snap) => {
			const d = snap.val() || {};
			players = players.map((_, i) => ({
				name: d[i]?.name ?? '',
				hero: d[i]?.hero ?? ''
			}));
			localStorage.setItem('top8Players', JSON.stringify(players));

			// Preload all hero images
			await preloadAllImages(players);
		});

		eventUnsub = onValue(ref(db, 'eventText'), (snap) => (eventText = snap.val() ?? ''));
		featureUnsub = onValue(ref(db, FEATURE_PATH), (snap) => (feature = snap.val()));
		matchesUnsub = onValue(ref(db, 'top8/matches'), (snap) => {
			const d = snap.val() || {};
			matches = {
				m0: d.m0 ?? null,
				m1: d.m1 ?? null,
				m2: d.m2 ?? null,
				m3: d.m3 ?? null,
				m4: d.m4 ?? null,
				m5: d.m5 ?? null,
				m6: d.m6 ?? null
			};
			localStorage.setItem('top8Matches', JSON.stringify(matches));
		});
	});

	onDestroy(() => {
		playersUnsub && playersUnsub();
		matchesUnsub && matchesUnsub();
		eventUnsub && eventUnsub();
		featureUnsub && featureUnsub();
	});

	// === BRACKET ORDER ===
	const viewQuarterSeeds = [
		[0, 7], // 1 vs 8
		[3, 4], // 4 vs 5
		[2, 5], // 3 vs 6
		[1, 6] // 2 vs 7
	];

	// Semis: winners of QF0 vs QF1, QF2 vs QF3
	$: viewSemiSeeds = [
		[matches.m0, matches.m1],
		[matches.m2, matches.m3]
	];
	// Final: winners of those semis
	$: viewFinalSeeds = [matches.m4, matches.m5];

	// === CELLS ===
	// The scene behind this source draws the bracket itself: fourteen dark plates
	// and the lines between them. These are the plates' positions on the 1920x1080
	// frame, measured off that scene and then nudged 3px left to match OBS, so
	// each player lands inside their plate.
	const CELL_H = 88;
	// What a name may take of the cell: the width less the edge, the padding, the
	// portrait and the gap beside it. A longer name shrinks to fit rather than clips.
	// The portrait is a square the full height of the cell at its right end,
	// standing clear of the plate by a gap. The text stops short of the gap.
	const SQUARE = CELL_H;
	const GAP = 8;
	const TEXT_LEFT = 20;
	const BADGE_W = 34 + 12;
	const NAME_INSET = 4 + TEXT_LEFT + BADGE_W + SQUARE + GAP + 14;

	// How a cell stands once its match is decided: the winner's edge turns green
	// and the loser dims, as on the pairings; the champion is marked in tan.
	const outcome = (winner, seed) =>
		winner == null || seed == null ? '' : Number(winner) === Number(seed) ? 'won' : 'lost';
	const NAME = { height: 32, size: 27 };
	const HERO = { height: 22, size: 18 };
	const QF = { left: 103, width: 454, tops: [87, 185, 299, 397, 511, 609, 723, 821] };
	const SF = { left: 676, width: 470, tops: [284, 389, 554, 658] };
	const FINAL = { left: 1213, width: 470, tops: [409, 509] };
	// The event's name and the title, under the final, where the scene had them.
	const CAPTION = { left: 1224, top: 636 };

	// Where the featured match's two plates are, from its key: m0-m3 are the
	// quarterfinals, m4-m5 the semifinals, m6 the final.
	function featureBox(marker) {
		if (marker?.kind !== 'top8') return null;
		const n = Number(String(marker.match).replace(/^m/, ''));
		if (!Number.isInteger(n) || n < 0 || n > 6) return null;
		const [col, pair] = n <= 3 ? [QF, n] : n <= 5 ? [SF, n - 4] : [FINAL, 0];
		const top = col.tops[pair * 2];
		return { left: col.left, top, height: col.tops[pair * 2 + 1] + CELL_H - top };
	}
	$: featured = featureBox(feature);
</script>

{#if imagesReady}
	<div class="stage" class:ready={displayReady}>
		<!-- Quarterfinals -->
		{#each viewQuarterSeeds as seeds, matchIdx}
			{#each seeds as seed, playerIdx}
				{@const i = matchIdx * 2 + playerIdx}
				{@const COL = QF}
				<div
					class="player-row {outcome(matches[`m${matchIdx}`], seed)}"
					class:animate={displayReady}
					style="--delay: {i * 80}ms; left: {QF.left}px; top: {QF.tops[i]}px; width: {QF.width}px;"
				>
					<div class="plate"></div>
					<div class="content">
						{#if players[seed].hero}
							<div class="art">
								<img
									src={getPreloadedImage(players[seed].hero)}
									alt={players[seed].hero}
									on:load={handleDomImageLoad}
									on:error={handleDomImageLoad}
								/>
							</div>
						{/if}
						<div class="seed">{seed + 1}</div>
						<div class="who">
							<div class="name">
								<ShrinkText
									text={players[seed].name || '—'}
									width={COL.width - NAME_INSET}
									height={NAME.height}
									size={NAME.size}
									align="left"
								/>
							</div>
							<div class="hero">
								<ShrinkText
									text={players[seed].hero || '—'}
									width={COL.width - NAME_INSET}
									height={HERO.height}
									size={HERO.size}
									align="left"
								/>
							</div>
						</div>
					</div>
				</div>
			{/each}
		{/each}

		<!-- Semifinals (fade-in winners) -->
		{#each viewSemiSeeds as seeds, matchIdx}
			{#each seeds as seed, playerIdx}
				{@const i = matchIdx * 2 + playerIdx}
				{@const COL = SF}
				<div
					class="player-row {outcome(matches[`m${4 + matchIdx}`], seed)}"
					class:animate={displayReady}
					style="--delay: {640 + i * 80}ms; left: {SF.left}px; top: {SF.tops[
						i
					]}px; width: {SF.width}px;"
				>
					<div class="plate"></div>
					{#key seed}
						<div class="content" class:arrive={seed !== null}>
							{#if seed !== null}<div class="flash"></div>{/if}
							{#if seed !== null}
								<div class="art">
									<img src={getPreloadedImage(players[seed].hero)} alt={players[seed].hero} />
								</div>
								<div class="seed">{seed + 1}</div>
								<div class="who">
									<div class="name">
										<ShrinkText
											text={players[seed].name}
											width={COL.width - NAME_INSET}
											height={NAME.height}
											size={NAME.size}
											align="left"
										/>
									</div>
									<div class="hero">
										<ShrinkText
											text={players[seed].hero}
											width={COL.width - NAME_INSET}
											height={HERO.height}
											size={HERO.size}
											align="left"
										/>
									</div>
								</div>
							{/if}
						</div>
					{/key}
				</div>
			{/each}
		{/each}

		<!-- The feature match: a quiet label standing up the left side of its
		     two plates, with a hairline against them. -->
		{#if featured && displayReady}
			<span
				class="feature-label"
				style="left: {featured.left - 36}px; top: {featured.top}px; height: {featured.height}px;"
				aria-label="Feature match">Feature</span
			>
		{/if}

		<!-- Event and title -->
		<div
			class="caption"
			class:animate={displayReady}
			style="left: {CAPTION.left}px; top: {CAPTION.top}px;"
		>
			{#if eventText}<p class="event">{eventText}</p>{/if}
			<h1 class="title"><b>Top 8</b> Bracket</h1>
		</div>

		<!-- Final (fade-in winners) -->
		{#each viewFinalSeeds as seed, idx}
			{@const COL = FINAL}
			<div
				class="player-row {outcome(matches.m6, seed)} {outcome(matches.m6, seed) === 'won'
					? 'champion'
					: ''}"
				class:animate={displayReady}
				style="--delay: {960 + idx * 80}ms; left: {FINAL.left}px; top: {FINAL.tops[
					idx
				]}px; width: {FINAL.width}px;"
			>
				<div class="plate"></div>
				{#key seed}
					<div class="content" class:arrive={seed !== null}>
						<span class="halo" aria-hidden="true"></span>
						<span class="halo late" aria-hidden="true"></span>
						{#if seed !== null}<div class="flash"></div>{/if}
						{#if seed !== null}
							<div class="art">
								<img src={getPreloadedImage(players[seed].hero)} alt={players[seed].hero} />
							</div>
							<div class="seed">{seed + 1}</div>
							<div class="who">
								<div class="name">
									<ShrinkText
										text={players[seed].name}
										width={COL.width - NAME_INSET}
										height={NAME.height}
										size={NAME.size}
										align="left"
									/>
								</div>
								<div class="hero">
									<ShrinkText
										text={players[seed].hero}
										width={COL.width - NAME_INSET}
										height={HERO.height}
										size={HERO.size}
										align="left"
									/>
								</div>
							</div>
						{/if}
					</div>
				{/key}
			</div>
		{/each}
	</div>
{/if}

<style>
	/* Pinned to the browser source size so each player lands in the plate the
	   scene draws for them. Hidden until every portrait is ready. */
	.stage {
		position: relative;
		width: 1920px;
		height: 1080px;
		overflow: hidden;
		opacity: 0;
		visibility: hidden;
	}

	.stage.ready {
		opacity: 1;
		visibility: visible;
	}

	/* Each cell is the bar the other overlays use -- a translucent dark plate with
	   the tan edge -- with the portrait a separate square at its right end, the
	   scene showing through the gap between. The plate is always there; in the
	   later rounds only the contents wait for a winner. */
	.feature-label {
		position: absolute;
		width: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: #d9b499;
		border-left: 2px solid rgba(217, 180, 153, 0.7);
		opacity: 0;
		animation: featureIn 400ms ease 900ms forwards;
	}

	@keyframes featureIn {
		to {
			opacity: 1;
		}
	}

	.player-row {
		position: absolute;
		height: 88px;
		box-sizing: border-box;
		/* No animation until ready */
		opacity: 0;
		transform: translateX(-30px);
		--square: 88px;
		--gap: 8px;
	}

	/* The plate stops a gap short of the square: a shallow gradient with a
	   hairline of light along its top, and a sweep of light across it once it has
	   slid in. */
	.plate {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		right: calc(var(--square) + var(--gap));
		overflow: hidden;
		background: linear-gradient(90deg, rgba(17, 24, 39, 0.72), rgba(17, 24, 39, 0.5));
		border-left: 4px solid #d9b499;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
		transition:
			border-color 400ms ease,
			box-shadow 400ms ease,
			opacity 400ms ease;
	}

	.plate::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: -40%;
		width: 30%;
		background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.14), transparent);
		transform: skewX(-20deg);
		opacity: 0;
	}

	.player-row.animate .plate::after {
		animation: shine 0.9s ease-out forwards;
		animation-delay: calc(var(--delay, 0ms) + 350ms);
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

	/* The seed, in a tan-outlined square at the left, as the rank is on the
	   standings. */
	.seed {
		position: absolute;
		left: 20px;
		top: calc((100% - 34px) / 2);
		width: 34px;
		height: 34px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(217, 180, 153, 0.7);
		font-size: 17px;
		font-weight: 700;
		color: #d9b499;
		font-variant-numeric: tabular-nums;
	}

	/* Once the match is decided. */
	.won .plate {
		border-left-color: #4ade80;
		box-shadow:
			inset 0 1px 0 rgba(74, 222, 128, 0.25),
			inset 0 0 40px rgba(74, 222, 128, 0.08);
	}

	.lost .plate,
	.lost .content {
		opacity: 0.45;
	}

	/* The champion's cell is lit in gold end to end: the plate warms from its
	   edge, a gold line and glow run around plate and portrait alike, and a gold
	   tag sits on the top edge naming the result. */
	.plate::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, rgba(240, 200, 74, 0.3), transparent 55%);
		opacity: 0;
		transition: opacity 600ms ease;
	}

	.champion .plate::before {
		opacity: 1;
	}

	.champion .plate {
		border-left-color: #f0c84a;
		box-shadow:
			inset 0 1px 0 rgba(240, 200, 74, 0.6),
			0 0 0 1px rgba(240, 200, 74, 0.6),
			0 0 32px rgba(240, 200, 74, 0.45);
	}

	.champion .art {
		box-shadow:
			inset 0 0 0 1px rgba(240, 200, 74, 0.9),
			0 0 0 1px rgba(240, 200, 74, 0.6),
			0 0 32px rgba(240, 200, 74, 0.45);
	}

	.champion .seed {
		background: linear-gradient(180deg, #f7d978, #d9a72a);
		border-color: #f0c84a;
		color: #0b0f19;
	}

	/* The coronation. Set apart from a winner merely arriving: the cell pops and
	   settles, the glow flares gold and decays to its resting state, two rings
	   ripple outward, a gold light sweeps the plate and the tag drops in. */
	.champion .content,
	.champion .content.arrive {
		animation: championPop 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.champion .plate {
		animation: championFlare 2.2s ease-out both;
	}

	.champion .plate::after {
		background: linear-gradient(100deg, transparent, rgba(247, 217, 120, 0.45), transparent);
		animation: shineAgain 1s ease-out 250ms both;
	}

	.halo {
		position: absolute;
		inset: 0;
		pointer-events: none;
		border: 2px solid #f0c84a;
		opacity: 0;
	}

	.champion .halo {
		animation: halo 1.4s ease-out 150ms both;
	}

	.champion .halo.late {
		animation-delay: 550ms;
	}

	@keyframes championPop {
		0% {
			transform: scale(1);
		}
		35% {
			transform: scale(1.06);
		}
		100% {
			transform: scale(1);
		}
	}

	@keyframes championFlare {
		0% {
			box-shadow:
				inset 0 1px 0 rgba(247, 217, 120, 0.9),
				0 0 0 2px rgba(247, 217, 120, 0.9),
				0 0 90px rgba(240, 200, 74, 0.95);
		}
		100% {
			box-shadow:
				inset 0 1px 0 rgba(240, 200, 74, 0.6),
				0 0 0 1px rgba(240, 200, 74, 0.6),
				0 0 32px rgba(240, 200, 74, 0.45);
		}
	}

	@keyframes shineAgain {
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

	@keyframes halo {
		0% {
			opacity: 0.9;
			transform: scale(1);
		}
		100% {
			opacity: 0;
			transform: scale(1.35, 1.9);
		}
	}

	@keyframes tagFade {
		0% {
			opacity: 0;
		}
		100% {
			opacity: 1;
		}
	}

	.champion .content::before {
		animation: tagFade 0.8s ease-out 400ms both;
		content: 'AGE Champion';
		position: absolute;
		top: -11px;
		left: 16px;
		height: 22px;
		padding: 0 12px;
		display: flex;
		align-items: center;
		background: linear-gradient(180deg, #f7d978, #d9a72a);
		color: #0b0f19;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
	}

	.player-row.animate {
		animation: slideReveal 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
		animation-delay: var(--delay, 0ms);
	}

	.content {
		position: relative;
		height: 100%;
		transition: opacity 400ms ease;
	}

	/* A winner arriving in a later round: the contents wipe in from the left
	   while the portrait settles from slightly enlarged, and a flash of tan
	   blooms across the plate with a sweep of light after it. Keyed to the seed,
	   so a corrected result plays it again. */
	.content.arrive {
		animation: advance 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.content.arrive .art {
		animation: settle 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.flash {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		right: calc(var(--square) + var(--gap));
		overflow: hidden;
		pointer-events: none;
	}

	.flash::before {
		content: '';
		position: absolute;
		inset: 0;
		background: rgba(217, 180, 153, 0.5);
		animation: flash 0.9s ease-out both;
	}

	.flash::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: -40%;
		width: 30%;
		background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.2), transparent);
		transform: skewX(-20deg);
		animation: shine 0.9s ease-out 120ms both;
	}

	@keyframes advance {
		0% {
			opacity: 0;
			transform: translateX(-24px);
			clip-path: inset(0 100% 0 0);
		}
		100% {
			opacity: 1;
			transform: translateX(0);
			clip-path: inset(-160px);
		}
	}

	@keyframes settle {
		0% {
			opacity: 0;
			transform: scale(1.25);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes flash {
		0% {
			opacity: 0;
		}
		15% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	/* The portrait: a square at the right, cropped from the still's upper right
	   and enlarged, where these stills keep the face. */
	.art {
		position: absolute;
		right: 0;
		top: 0;
		width: var(--square);
		height: 100%;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.08);
		box-shadow: inset 0 0 0 1px rgba(217, 180, 153, 0.45);
		transition: opacity 400ms ease;
	}

	.art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: right top;
		transform: scale(1.35);
		transform-origin: right top;
	}

	.who {
		position: absolute;
		left: 66px;
		right: calc(var(--square) + var(--gap) + 14px);
		top: 0;
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 8px;
		min-width: 0;
		line-height: 1;
		text-align: left;
	}

	.name {
		color: #fff;
		display: flex;
	}

	.opacity-0 {
		opacity: 0;
	}

	.caption {
		position: absolute;
		opacity: 0;
	}

	.caption.animate {
		animation: fadeUp 0.6s ease-out 1100ms forwards;
	}

	.event {
		margin: 0 0 6px;
		font-size: 30px;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: #d9b499;
	}

	.title {
		margin: 0;
		font-size: 72px;
		font-weight: 400;
		line-height: 1;
		color: #fff;
		white-space: nowrap;
	}

	.title b {
		font-weight: 700;
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

	/* The hero, in italic tan; the whole name always, shrinking to fit as the
	   player's name does. */
	.hero {
		display: flex;
		font-style: italic;
		color: #d9b499;
	}

	/* The wipe ends on a clip far outside the cell rather than at its edge, so the
	   champion's tag, the glow and the rings that ripple out past the cell are not
	   cut off by the clip the animation leaves in place. */
	@keyframes slideReveal {
		0% {
			opacity: 0;
			transform: translateX(-30px);
			clip-path: inset(-160px 100% -160px -160px);
		}
		100% {
			opacity: 1;
			transform: translateX(0);
			clip-path: inset(-160px);
		}
	}
</style>
