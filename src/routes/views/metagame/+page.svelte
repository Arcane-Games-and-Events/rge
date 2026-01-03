<script>
	import { onMount } from 'svelte';
	import { ref, onValue } from 'firebase/database';
	import { db } from '../../../firebaseClient';

	const PATH = 'metagame';

	let rows = [];
	let total = 0;

	function slugify(name) {
		return (name || '')
			.toLowerCase()
			.replace(/["',]/g, '')
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.trim();
	}

	const IMAGE_EXCEPTIONS = {
		'arakni huntsman': '/heroImages/arakni-huntsman.jpg'
	};

	function imgSrc(name) {
		if (!name) return '/heroImages/default.jpg';
		const normalized = (name || '').toLowerCase().replace(/["',]/g, '').trim();
		if (normalized in IMAGE_EXCEPTIONS) {
			return IMAGE_EXCEPTIONS[normalized];
		}
		return `/heroImages/${slugify(name)}.jpg`;
	}

	function getOptimalColumns(count) {
		if (count === 0) return 1;
		if (count <= 4) return count;
		if (count <= 8) return Math.ceil(count / 2);
		if (count <= 15) return Math.ceil(count / 3);
		if (count <= 24) return Math.ceil(count / 4);
		if (count <= 35) return Math.ceil(count / 5);
		return Math.ceil(count / 6);
	}

	onMount(() => {
		const r = ref(db, PATH);
		const unsub = onValue(r, (snap) => {
			const val = snap.val() || {};
			rows = Object.entries(val).map(([id, v]) => ({
				id,
				name: v?.name || id,
				count: Number(v?.count) || 0
			}));
			total = rows.reduce((a, r) => a + (isFinite(r.count) ? r.count : 0), 0);
		});
		return () => unsub?.();
	});

	$: visible = [...rows].filter((r) => r.count > 0).sort((a, b) => (b.count || 0) - (a.count || 0));
	$: heroCount = visible.length;
	$: columns = getOptimalColumns(heroCount);
	$: rowCount = Math.ceil(heroCount / columns);
</script>

<div class="metagame-container">
	{#if heroCount > 0}
		<div
			class="metagame-grid"
			style="--cols: {columns}; --rows: {rowCount};"
		>
			{#each visible as hero, idx (hero.id)}
				{@const percentage = total > 0 ? Math.round((hero.count / total) * 100) : 0}
				<div class="hero-card" style="--delay: {idx * 80}ms;">
					<!-- Hero Image -->
					<div class="hero-image-wrapper">
						<img
							src={imgSrc(hero.name)}
							alt={hero.name}
							class="hero-image"
							loading="lazy"
							on:error={(e) => {
								const normalized = (hero.name || '').toLowerCase().replace(/["',]/g, '').trim();
								if (normalized in IMAGE_EXCEPTIONS) {
									e.target.src = IMAGE_EXCEPTIONS[normalized].replace(/\.jpg$/i, '.png');
								} else {
									e.target.src = `/heroImages/${slugify(hero.name)}.png`;
								}
							}}
						/>
						<!-- Gradient Overlay -->
						<div class="image-overlay"></div>
					</div>

					<!-- Bottom Info Panel -->
					<div class="info-panel">
						<div class="info-content">
							<span class="hero-name">{hero.name}</span>
							<div class="stats-group">
								<span class="hero-count">{hero.count}</span>
								<span class="hero-percent">{percentage}%</span>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.metagame-container {
		width: 100vw;
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		box-sizing: border-box;
		background: transparent;
	}

	.metagame-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		grid-template-rows: repeat(var(--rows), 1fr);
		gap: 0.6rem;
		width: 100%;
		height: 100%;
		max-width: 1840px;
		max-height: 900px;
		animation: gridFadeIn 0.3s ease-out backwards;
	}

	@keyframes gridFadeIn {
		0% {
			opacity: 0;
		}
		100% {
			opacity: 1;
		}
	}

	.hero-card {
		position: relative;
		display: flex;
		flex-direction: column;
		background: linear-gradient(145deg, #0f1419 0%, #1a1f2e 100%);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 6px;
		overflow: hidden;
		animation: cardSlideReveal 0.6s cubic-bezier(0.22, 1, 0.36, 1) backwards;
		animation-delay: var(--delay, 0ms);
	}

	@keyframes cardSlideReveal {
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

	.hero-card::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			transparent 0%,
			transparent 50%,
			rgba(0, 0, 0, 0.7) 100%
		);
		pointer-events: none;
		z-index: 1;
	}

	.hero-image-wrapper {
		flex: 1;
		min-height: 0;
		position: relative;
		overflow: hidden;
	}

	.hero-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: top right;
		transition: transform 0.3s ease;
	}

	.image-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			0deg,
			rgba(15, 20, 25, 0.95) 0%,
			rgba(15, 20, 25, 0.4) 30%,
			transparent 60%
		);
		pointer-events: none;
	}

	.info-panel {
		position: relative;
		z-index: 5;
		background: transparent;
	}

	.info-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.6rem;
		gap: 0.75rem;
	}

	.hero-name {
		flex: 1;
		min-width: 0;
		font-size: clamp(0.65rem, 1.3vw, 0.9rem);
		font-weight: 700;
		color: #fff;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.stats-group {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
		background: rgba(255, 255, 255, 0.08);
		padding: 0.3rem 0.5rem;
		border-radius: 6px;
	}

	.hero-count {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: clamp(1.2rem, 3vw, 2rem);
		font-weight: 800;
		color: #fff;
		line-height: 1;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
	}

	.hero-percent {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: clamp(0.7rem, 1.4vw, 1rem);
		font-weight: 700;
		color: #93c5fd;
		background: rgba(59, 130, 246, 0.25);
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		border: 1px solid rgba(59, 130, 246, 0.3);
	}

</style>
