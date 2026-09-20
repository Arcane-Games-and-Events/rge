<script>
	import { onMount } from 'svelte';

	// A QR code for the judge's page, to show a judge at the desk or print and
	// tape to Table 1. Built in the browser from the address this page was opened
	// at, so it points wherever the site is running -- the deployed site, or a dev
	// server on the venue's network. The library only loads on the client; it has
	// a server build the page has no use for.
	let url = '';
	let src = '';
	let copied = false;

	onMount(async () => {
		url = `${window.location.origin}/judge`;
		const { default: QRCode } = await import('qrcode');
		// Rendered at 1024px so it stays sharp printed at card size.
		src = await QRCode.toDataURL(url, {
			width: 1024,
			margin: 1,
			errorCorrectionLevel: 'M',
			color: { dark: '#000000', light: '#ffffff' }
		});
	});

	async function copy() {
		await navigator.clipboard.writeText(url);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<svelte:head>
	<title>Judge QR</title>
</svelte:head>

<div class="mx-auto max-w-md space-y-4 p-4 text-white sm:p-6">
	<div class="text-center">
		<h1 class="text-xl font-bold">Judge page</h1>
		<p class="mt-1 text-xs text-gray-500">
			Scan to open Table 1's judge page on a phone: life totals, who chose, player details.
		</p>
	</div>

	<div class="print-card mx-auto w-full max-w-xs rounded-xl bg-white p-4">
		{#if src}
			<img class="qr" {src} alt="QR code for {url}" />
		{:else}
			<div class="aspect-square w-full animate-pulse rounded bg-gray-200"></div>
		{/if}
		<p class="mt-3 text-center font-mono text-sm text-gray-800">{url}</p>
	</div>

	<div class="no-print flex gap-2">
		<a
			href="/judge"
			class="flex h-11 flex-1 items-center justify-center rounded-lg border border-gray-700 bg-gray-900 text-sm font-medium text-white hover:bg-gray-800"
		>
			Open judge page
		</a>
		<button
			type="button"
			on:click={copy}
			class="h-11 flex-1 rounded-lg border text-sm font-medium transition-colors {copied
				? 'border-green-500 bg-green-500/20 text-green-400'
				: 'border-gray-700 bg-gray-900 text-white hover:bg-gray-800'}"
		>
			{copied ? 'Copied' : 'Copy link'}
		</button>
		<button
			type="button"
			on:click={() => window.print()}
			class="h-11 flex-1 rounded-lg border border-gray-700 bg-gray-900 text-sm font-medium text-white hover:bg-gray-800"
		>
			Print
		</button>
	</div>
</div>

<style>
	.qr {
		display: block;
		width: 100%;
		height: auto;
		image-rendering: pixelated;
	}

	/* Printed, the page is just the card: black code on white paper. */
	@media print {
		.no-print {
			display: none;
		}
		:global(body) {
			background: #fff !important;
		}
		:global(nav) {
			display: none !important;
		}
		.print-card {
			max-width: 70mm;
		}
	}
</style>
