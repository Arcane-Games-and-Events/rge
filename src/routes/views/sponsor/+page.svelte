<script>
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { page } from '$app/stores';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';
	import {
		SPONSOR,
		BUNDLES,
		CONTACTS,
		PANELS,
		SPONSOR_PATH,
		dollars,
		runs,
		toStep
	} from '$lib/sponsorCopy';

	// Which panel of copy is up: the pricing first, then the singles message,
	// stepped from /sponsor or a Stream Deck through /sponsor/next.
	let step = 0;
	onMount(() => onValue(ref(db, SPONSOR_PATH), (snap) => (step = toStep(snap.val()?.step))));
	$: panel = PANELS[step];

	// The marks for each way of reaching the shop, drawn inline.
	const ICONS = {
		email: {
			box: '0 0 24 24',
			d: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z'
		},
		bluesky: {
			box: '0 0 568 501',
			d: 'M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.21C491.866-1.611 568-28.906 568 57.947c0 17.346-9.945 145.713-15.778 166.555-20.275 72.453-94.155 90.933-159.875 79.748C507.222 323.8 536.444 388.56 473.333 453.32c-119.86 122.992-172.272-30.859-185.702-70.281-2.462-7.227-3.614-10.608-3.631-7.733-.017-2.875-1.169.506-3.631 7.733-13.43 39.422-65.842 193.273-185.702 70.281-63.111-64.76-33.89-129.52 80.986-149.071-65.72 11.185-139.6-7.295-159.875-79.748C9.945 203.659 0 75.291 0 57.946 0-28.906 76.135-1.612 123.121 33.664Z'
		},
		x: {
			box: '0 0 24 24',
			d: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'
		}
	};

	// A 1920×1080 stage laid over the sponsor's artwork, set as the other
	// overlays are. The copy sits in the dark street scene under the shop's
	// ribbon, left of the hero, and above the contact strip. With ?bg the
	// artwork is drawn underneath for lining up in a browser; on air the
	// artwork is its own source and this stays transparent.
	$: withArt = $page.url.searchParams.has('bg');

	// The half-second hold the other overlays take before they move, and a
	// full second on top for the stinger to clear.
	const HOLD_MS = 1500;
	// Uzuri sets off half a second after the rest; the same figure is the
	// --hero-at custom property in the styles.
	const HERO_AT_MS = 500;
	let play = false;
	let strikeBlur;
	onMount(() => {
		let blurTimer;
		const t = setTimeout(() => {
			play = true;
			// The motion blur is an SVG filter, so its run is started here in
			// step with the lunge; it sits in the document's own timeline.
			blurTimer = setTimeout(() => {
				const svg = strikeBlur?.ownerSVGElement;
				if (svg) {
					window.__strikeStart = svg.getCurrentTime();
					strikeBlur.beginElement();
				}
			}, HERO_AT_MS);
		}, HOLD_MS);
		return () => {
			clearTimeout(t);
			clearTimeout(blurTimer);
		};
	});

	// The bars come first, column by column, a beat apart; the rest of the
	// pricing panel follows them.
	const delay = (bi, ri) => 100 + (bi * 2 + ri) * 140;
</script>

<svelte:head>
	<title>Sponsor Copy</title>
</svelte:head>

<div class="stage" class:art={withArt} class:play>
	<!-- Uzuri, where she stood in the artwork, drawn here so she can come out
	     of the dark on her own: first her silhouette, then a blade's glint
	     crossing her, and she is there. -->
	<!-- A sideways blur for the lunge: she is a streak the whole way in and
	     snaps sharp the moment she lands. CSS blur is round, so this is an
	     SVG one that only runs along x. -->
	<svg class="defs" width="0" height="0" aria-hidden="true">
		<defs>
			<!-- Roughens the smoke's soft shapes into wisps, and keeps the
			     roughness slowly shifting so the smoke never holds a shape. -->
			<filter id="smoke-wisp" x="-30%" y="-30%" width="160%" height="160%">
				<feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="3" seed="7">
					<animate
						attributeName="baseFrequency"
						values="0.011;0.0135;0.011"
						dur="22s"
						repeatCount="indefinite"
					/>
				</feTurbulence>
				<feDisplacementMap
					in="SourceGraphic"
					scale="110"
					xChannelSelector="R"
					yChannelSelector="G"
				/>
			</filter>
			<filter
				id="strike-blur"
				x="-100%"
				y="-10%"
				width="300%"
				height="120%"
				color-interpolation-filters="sRGB"
			>
				<feGaussianBlur stdDeviation="0 0">
					<animate
						bind:this={strikeBlur}
						attributeName="stdDeviation"
						values="120 0; 120 0; 0 0; 0 0"
						keyTimes="0; 0.4; 0.5; 1"
						dur="0.55s"
						fill="freeze"
						begin="indefinite"
					/>
				</feGaussianBlur>
			</filter>
		</defs>
	</svg>

	<!-- Smoke rising from behind her shoulders once she has landed: wisps
	     that lift off each shoulder, thin and fade, over and over, with a
	     faint haze hanging behind her. -->
	<div class="smoke" aria-hidden="true">
		<span class="haze"></span>
		<span class="wisp l1"></span>
		<span class="wisp l2"></span>
		<span class="wisp r1"></span>
		<span class="wisp r2"></span>
	</div>

	<div class="hero" aria-hidden="true">
		<img class="trail far" src="/uzuri-switchblade.png" alt="" />
		<img class="trail near" src="/uzuri-switchblade.png" alt="" />
		<img class="hero-art" src="/uzuri-switchblade.png" alt="" />
		<div class="glint"></div>
	</div>

	<!-- Three cuts in the air as she lands, each across the last, drawn in a
	     flash and gone, with a burst of light where they cross. -->
	<div class="slashes" aria-hidden="true">
		<div class="burst"></div>
		<div class="slash one"></div>
		<div class="slash two"></div>
		<div class="slash three"></div>
	</div>

	<!-- The shop's mark, where it sat in the artwork, in first ahead of the
	     copy beneath it. -->
	<img class="logo" src="/hammurabi-logo.png" alt={SPONSOR.name} />

	<div class="copy">
		<!-- The panels swap in place: the one leaving slides off to the left
		     as the next one plays in with the overlay's own entrances. -->
		{#key step}
			<div
				class="panel"
				class:pricing={panel.kind === 'pricing'}
				class:message={panel.kind === 'message'}
				out:fly|local={{ x: -40, duration: 350 }}
			>
				{#if panel.kind === 'pricing'}
					<h1 class="title">{SPONSOR.tagline}</h1>
					<p class="subtitle">
						<span class="product">{SPONSOR.product}</span>
						<span class="pitch">{SPONSOR.pitch}</span>
					</p>

					<div class="bundles">
						{#each BUNDLES as b, bi}
							<div class="bundle">
								<div class="head">{b.finish}</div>
								{#each b.rows as r, ri}
									<div class="row" style="--delay: {delay(bi, ri)}ms;">
										<span class="finish">{r.label}</span>
										<span class="price">{dollars(r.price)}</span>
									</div>
								{/each}
							</div>
						{/each}
					</div>

					<p class="note">{SPONSOR.note}</p>
				{:else}
					<h1 class="title message-title">{panel.title}</h1>
					<p class="body">
						{#each panel.body as line, i}
							<span class="line" style="--delay: {650 + i * 150}ms;">
								{#each runs(line) as r}<span class:em={r.em}>{r.text}</span>{/each}
							</span>
						{/each}
					</p>
				{/if}
			</div>
		{/key}
	</div>

	<!-- Where to find the shop, along the foot of the frame on a plate as the
	     other overlays set them: a tan mark for each, the handle beside it. -->
	<footer class="contacts" aria-label="Contact {SPONSOR.name}">
		{#each CONTACTS as c, i}
			<div class="contact" style="--delay: {2150 + i * 150}ms;">
				<span class="mark">
					<svg viewBox={ICONS[c.kind].box} aria-hidden="true"><path d={ICONS[c.kind].d} /></svg>
				</span>
				<span class="text">
					<span class="kind">{c.label}</span>
					<span class="value">{c.value}</span>
				</span>
			</div>
		{/each}
	</footer>
</div>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		background: transparent;
		overflow: hidden;
	}

	/* Pinned to the browser source size so everything lands on the same
	   pixels whatever window is around it. */
	.stage {
		position: relative;
		width: 1920px;
		height: 1080px;
		overflow: hidden;
		/* Uzuri's cue: half a second after the rest of the overlay sets off. */
		--hero-at: 500ms;
		--tan: #d9b499;
		--bar: rgba(17, 24, 39, 0.6);
		font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
		color: #fff;
	}

	.stage.art {
		background: url('/hammurabi-overlay.png') 0 0 / 1920px 1080px no-repeat;
	}

	/* The logo at its own size, centred over the copy, with room between it
	   and the tagline. */
	.logo {
		position: absolute;
		left: 286px;
		top: 99px;
		width: 500px;
		height: 370px;
		opacity: 0;
		transform: translateY(-16px) scale(0.94);
		transform-origin: 50% 100%;
	}

	.play .logo {
		animation: logoIn 0.8s cubic-bezier(0.22, 1, 0.36, 1) 700ms forwards;
	}

	@keyframes logoIn {
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* Flush with the left edge of the shop's ribbon, in the room between it
	   and the contact strip. */
	.copy {
		position: absolute;
		left: 166px;
		top: 516px;
		width: 740px;
	}

	.panel {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
	}

	/* The singles message has the whole block to itself, so it is set large
	   and centred in the height the pricing takes: the question as the title
	   over two lines, and the body in tan beneath, line by line. */
	.panel.message {
		height: 440px;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.title.message-title {
		white-space: normal;
		margin-bottom: 30px;
		padding-bottom: 28px;
		font-size: 72px;
		line-height: 1.02;
	}

	.body {
		margin: 0;
		text-align: center;
		font-size: 36px;
		font-weight: 600;
		line-height: 1.3;
		letter-spacing: 0.02em;
		color: #fff;
	}

	.body .em {
		color: var(--tan);
	}

	.body .line {
		display: block;
		opacity: 0;
	}

	.play .body .line {
		animation: fadeUp 0.5s ease-out var(--delay) forwards;
	}

	.title {
		margin: 0 0 20px;
		padding-bottom: 18px;
		font-size: 54px;
		font-weight: 700;
		line-height: 0.95;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		white-space: nowrap;
		text-align: center;
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

	/* The set on one line, the shop's pitch under it in tan. */
	.subtitle {
		margin: 0 0 34px;
		line-height: 1.2;
		text-transform: uppercase;
		text-align: center;
		opacity: 0;
	}

	.product {
		display: block;
		font-size: 26px;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: #fff;
	}

	.pitch {
		display: block;
		margin-top: 8px;
		font-size: 20px;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--tan);
	}

	/* The hero's box is the cutout at its own size, where it matched the
	   artwork. The glint is a thin streak of light clipped to her shape. */
	.hero {
		position: absolute;
		left: 928px;
		top: 57px;
		width: 992px;
		height: 1023px;
		transform-origin: 50% 100%;
	}

	/* Once she has landed she keeps breathing: a slow rise and fall through
	   the chest, and a slower shift of her weight. The two run on their own
	   properties so they layer rather than fight. */
	.play .hero {
		animation:
			breathe 4.6s ease-in-out calc(var(--hero-at) + 700ms) infinite,
			sway 11s ease-in-out calc(var(--hero-at) + 700ms) infinite;
	}

	@keyframes breathe {
		0%,
		100% {
			scale: 1 1;
		}
		50% {
			scale: 1.003 1.007;
		}
	}

	@keyframes sway {
		0%,
		100% {
			translate: 0 0;
			rotate: 0deg;
		}
		30% {
			translate: 2px 0;
			rotate: 0.12deg;
		}
		70% {
			translate: -1.5px 0.5px;
			rotate: -0.1deg;
		}
	}

	.hero-art,
	.trail {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		opacity: 0;
		transform: translateX(420px) scale(1.04);
		transform-origin: 50% 100%;
	}

	.hero-art {
		filter: url(#strike-blur);
	}

	.defs {
		position: absolute;
	}

	/* The smoke sits behind her upper body. The wisps start at her shoulders
	   and rise past her head and out to the sides; being behind her, they only
	   show where they clear her outline. The SVG filter roughens them. */
	.smoke {
		position: absolute;
		left: 900px;
		top: 0;
		width: 1020px;
		height: 760px;
		filter: url(#smoke-wisp);
		pointer-events: none;
		opacity: 0;
	}

	.play .smoke {
		animation: smokeIn 2s ease-out calc(var(--hero-at) + 400ms) forwards;
	}

	.haze,
	.wisp {
		position: absolute;
		border-radius: 50%;
	}

	.haze {
		left: 60px;
		top: 160px;
		width: 900px;
		height: 420px;
		background: radial-gradient(
			ellipse at center,
			rgba(200, 204, 214, 0.26),
			rgba(200, 204, 214, 0.1) 45%,
			transparent 70%
		);
	}

	.play .haze {
		animation: hazeDrift 14s ease-in-out infinite;
	}

	.wisp {
		width: 380px;
		height: 260px;
		background: radial-gradient(
			ellipse at center,
			rgba(200, 204, 214, 0.5),
			rgba(200, 204, 214, 0.2) 42%,
			transparent 68%
		);
		opacity: 0;
		transform-origin: 50% 100%;
	}

	/* Left shoulder, about 1080 across and 330 down the frame; right shoulder
	   about 1760 across and 300 down. */
	.wisp.l1 {
		left: -10px;
		top: 200px;
		--dx: -60px;
	}

	.wisp.l2 {
		left: 60px;
		top: 230px;
		--dx: 30px;
	}

	.wisp.r1 {
		left: 670px;
		top: 170px;
		--dx: 70px;
	}

	.wisp.r2 {
		left: 600px;
		top: 210px;
		--dx: -20px;
	}

	.play .wisp {
		animation: rise 7s ease-out infinite;
	}

	.play .wisp.l2 {
		animation-duration: 8.5s;
		animation-delay: 2.6s;
	}

	.play .wisp.r1 {
		animation-duration: 7.6s;
		animation-delay: 1.3s;
	}

	.play .wisp.r2 {
		animation-duration: 9s;
		animation-delay: 4.1s;
	}

	@keyframes smokeIn {
		to {
			opacity: 1;
		}
	}

	@keyframes rise {
		0% {
			opacity: 0;
			transform: translate(0, 0) scale(0.7);
		}
		18% {
			opacity: 0.55;
		}
		100% {
			opacity: 0;
			transform: translate(var(--dx), -300px) scale(1.5);
		}
	}

	@keyframes hazeDrift {
		0%,
		100% {
			translate: 0 0;
			scale: 1;
		}
		50% {
			translate: 30px -20px;
			scale: 1.08 1.05;
		}
	}

	/* The cuts are centred on her, long thin blades of light with tapered
	   ends, each drawn from the right, the way her arm would carry it. */
	.slashes {
		position: absolute;
		left: 1400px;
		top: 560px;
		width: 0;
		height: 0;
	}

	.slash {
		position: absolute;
		left: -520px;
		top: -4px;
		width: 1040px;
		height: 8px;
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(255, 255, 255, 0.9) 18%,
			#fff 50%,
			rgba(255, 255, 255, 0.9) 82%,
			transparent 100%
		);
		box-shadow:
			0 0 14px rgba(255, 255, 255, 0.85),
			0 0 36px rgba(217, 180, 153, 0.7);
		transform-origin: 100% 50%;
		opacity: 0;
		transform: rotate(var(--angle)) scaleX(0);
	}

	.slash.one {
		--angle: -34deg;
	}

	.slash.two {
		--angle: 26deg;
	}

	/* The third is a shorter, steeper dagger stroke, drawn from above. */
	.slash.three {
		--angle: 72deg;
		left: -400px;
		width: 800px;
		transform-origin: 0 50%;
	}

	.burst {
		position: absolute;
		left: -140px;
		top: -140px;
		width: 280px;
		height: 280px;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			rgba(255, 255, 255, 0.9),
			rgba(217, 180, 153, 0.4) 35%,
			transparent 70%
		);
		opacity: 0;
		transform: scale(0.3);
	}

	.play .slash.one {
		animation: slash 0.42s cubic-bezier(0.2, 0.8, 0.2, 1) calc(var(--hero-at) + 245ms) forwards;
	}

	.play .slash.two {
		animation: slash 0.42s cubic-bezier(0.2, 0.8, 0.2, 1) calc(var(--hero-at) + 345ms) forwards;
	}

	.play .slash.three {
		animation: slash 0.38s cubic-bezier(0.2, 0.8, 0.2, 1) calc(var(--hero-at) + 435ms) forwards;
	}

	.play .burst {
		animation: burst 0.5s ease-out calc(var(--hero-at) + 335ms) forwards;
	}

	@keyframes slash {
		0% {
			opacity: 1;
			transform: rotate(var(--angle)) scaleX(0) scaleY(1);
		}
		30% {
			opacity: 1;
			transform: rotate(var(--angle)) scaleX(1) scaleY(1);
		}
		100% {
			opacity: 0;
			transform: rotate(var(--angle)) scaleX(1) scaleY(0.2);
		}
	}

	@keyframes burst {
		0% {
			opacity: 0;
			transform: scale(0.3);
		}
		25% {
			opacity: 1;
			transform: scale(1);
		}
		100% {
			opacity: 0;
			transform: scale(1.5);
		}
	}

	/* Two ghosts of her a few frames behind, smeared, that the lunge leaves
	   in the air and that are gone by the time she lands. */
	.trail {
		filter: brightness(0.55) blur(14px);
	}

	.trail.far {
		filter: brightness(0.4) blur(24px);
	}

	/* A blade's glint: a thin streak of light that crosses her and nothing
	   else. The box is masked to her shape and the streak moves inside it, so
	   the shadow she arrives as can keep its soft edges. */
	.glint {
		position: absolute;
		inset: 0;
		background: linear-gradient(
				105deg,
				transparent 35%,
				rgba(255, 255, 255, 0.55) 48%,
				rgba(255, 255, 255, 0.95) 50%,
				rgba(255, 255, 255, 0.55) 52%,
				transparent 65%
			)
			no-repeat;
		background-size: 50% 100%;
		background-position: -100% 0;
		-webkit-mask: url('/uzuri-switchblade.png') 0 0 / 100% 100% no-repeat;
		mask: url('/uzuri-switchblade.png') 0 0 / 100% 100% no-repeat;
		opacity: 0;
		pointer-events: none;
		mix-blend-mode: screen;
	}

	/* The lunge: in fast from the right, a hair past her mark, then settling
	   onto it. The glint is the cut, at the moment she lands. */
	.play .hero-art {
		animation: lunge 0.55s cubic-bezier(0.25, 0.1, 0.15, 1) var(--hero-at) forwards;
	}

	.play .trail.near {
		animation:
			lunge 0.55s cubic-bezier(0.25, 0.1, 0.15, 1) calc(var(--hero-at) + 50ms) forwards,
			trailOut 0.22s ease-out calc(var(--hero-at) + 270ms) forwards;
	}

	.play .trail.far {
		animation:
			lunge 0.55s cubic-bezier(0.25, 0.1, 0.15, 1) calc(var(--hero-at) + 100ms) forwards,
			trailOut 0.22s ease-out calc(var(--hero-at) + 300ms) forwards;
	}

	.play .glint {
		animation: glint 0.28s cubic-bezier(0.4, 0, 0.2, 1) calc(var(--hero-at) + 235ms) forwards;
	}

	@keyframes lunge {
		0% {
			opacity: 0;
			transform: translateX(420px) scale(1.04);
		}
		10% {
			opacity: 1;
		}
		45% {
			transform: translateX(-18px) scale(1);
			animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
		}
		100% {
			opacity: 1;
			transform: translateX(0) scale(1);
		}
	}

	@keyframes trailOut {
		to {
			opacity: 0;
		}
	}

	@keyframes glint {
		0% {
			background-position: -100% 0;
			opacity: 0;
		}
		15% {
			opacity: 1;
		}
		85% {
			opacity: 1;
		}
		100% {
			background-position: 200% 0;
			opacity: 0;
		}
	}

	.bundles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		column-gap: 32px;
	}

	.head {
		height: 24px;
		margin-bottom: 12px;
		font-size: 15px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--tan);
		opacity: 0;
	}

	/* A bar as the prizing table sets them: the tan block carries the kind of
	   bundle, the price has the rest of the bar. */
	.row {
		position: relative;
		display: flex;
		align-items: center;
		height: 72px;
		margin-bottom: 12px;
		background: var(--bar);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
		overflow: hidden;
		opacity: 0;
	}

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

	.finish {
		height: 100%;
		display: flex;
		align-items: center;
		padding: 0 16px;
		box-sizing: border-box;
		font-size: 17px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
		color: #0b0f19;
		background: linear-gradient(135deg, #e6c4a6 0%, var(--tan) 55%, #c49a78 100%);
	}

	.price {
		flex: 1;
		padding: 0 18px;
		text-align: right;
		font-size: 34px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0.01em;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.note {
		margin: 22px 0 0;
		text-align: center;
		font-size: 18px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--tan);
		opacity: 0;
	}

	/* The contact plate covers the foot of the frame, from where Uzuri is cut
	   off down to the bottom edge, with the tan rule along its top. */
	.contacts {
		position: absolute;
		left: 0;
		top: 988px;
		width: 1920px;
		height: 92px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 120px;
		/* Solid enough that she and the street do not read through it. */
		background: rgba(17, 24, 39, 0.92);
		box-shadow: inset 0 2px 0 var(--tan);
		overflow: hidden;
		opacity: 0;
	}

	.contacts::after {
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

	.contact {
		display: flex;
		align-items: center;
		gap: 16px;
		opacity: 0;
	}

	.mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 46px;
		height: 46px;
		background: linear-gradient(135deg, #e6c4a6 0%, var(--tan) 55%, #c49a78 100%);
		flex: none;
	}

	.mark svg {
		width: 24px;
		height: 24px;
		fill: #0b0f19;
	}

	.text {
		display: flex;
		flex-direction: column;
		line-height: 1.1;
	}

	.kind {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--tan);
		margin-bottom: 4px;
	}

	.value {
		font-size: 26px;
		font-weight: 600;
		letter-spacing: 0.01em;
		white-space: nowrap;
	}

	/* Nothing moves until the hold is up; then everything runs off one clock. */
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
		animation: fadeUp 0.5s ease-out forwards;
	}

	/* On the pricing panel the bars lead and the words follow them. */
	.play .pricing .title {
		animation-delay: 700ms;
	}

	.play .pricing .title::after {
		animation-delay: 1050ms;
	}

	.play .pricing .subtitle {
		animation-delay: 1350ms;
	}

	.play .row {
		animation: riseIn 1.1s cubic-bezier(0.16, 0.7, 0.2, 1) forwards;
		animation-delay: var(--delay, 0ms);
	}

	.play .row::after {
		animation: shine 1.4s ease-in-out forwards;
		animation-delay: calc(var(--delay, 0ms) + 700ms);
	}

	.play .note {
		animation: fadeUp 0.5s ease-out 1550ms forwards;
	}

	.play .contacts {
		animation: riseIn 1.1s cubic-bezier(0.16, 0.7, 0.2, 1) 1900ms forwards;
	}

	.play .contacts::after {
		animation: shine 1.4s ease-in-out 2600ms forwards;
	}

	.play .contact {
		animation: fadeUp 0.5s ease-out var(--delay) forwards;
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
