<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { ref, update } from 'firebase/database';
	import { db } from '../../../firebaseClient';
	import { formatTime } from '$lib/timerDisplay';
	import { parseTimerCommand } from '$lib/timerCommand';

	// Setting a clock by opening a link, for when the booth is not to hand. Whatever
	// the link says is applied the moment the page loads, so the URL is the button.
	let state = 'working';
	let message = '';
	let clock = '';

	const EXAMPLES = [
		['/timer/round/down/55', 'Round counts down from 55 minutes'],
		['/timer/round/up', 'Round counts up from zero'],
		['/timer/round/up/5', 'Round counts up starting at 5 minutes'],
		['/timer/break/10', 'Break counts down from 10 minutes'],
		['/timer/break/down/10', 'The same, said longhand']
	];

	onMount(async () => {
		const command = parseTimerCommand(($page.params.spec || '').split('/'));

		if (!command.ok) {
			state = 'error';
			message = command.error;
			return;
		}

		if (!db) {
			state = 'error';
			message = 'No database connection.';
			return;
		}

		try {
			// One atomic write rather than a field at a time: the booth and the overlays
			// each watch these keys separately, and a half-applied timer would have them
			// briefly counting the wrong thing.
			const fields = {
				remainingTime: command.seconds,
				displayTime: formatTime(command.seconds),
				isPaused: false,
				startTime: Date.now()
			};
			if (command.type === 'Round') fields.isCountingUp = command.countUp;

			await update(ref(db, `timers/${command.type}`), fields);

			state = 'done';
			message = command.summary;
			clock = formatTime(command.seconds);
		} catch (err) {
			state = 'error';
			message = `Could not set the timer: ${err.message}`;
		}
	});
</script>

<svelte:head><title>Set a timer</title></svelte:head>

<div class="wrap">
	{#if state === 'working'}
		<p class="status">Setting…</p>
	{:else if state === 'done'}
		<p class="badge ok">Timer set</p>
		<p class="clock">{clock}</p>
		<p class="status">{message}</p>
		<p class="note">Running now. Close this page — the clock keeps going.</p>
	{:else}
		<p class="badge bad">Not set</p>
		<p class="status">{message}</p>
		<ul class="examples">
			{#each EXAMPLES as [url, what] (url)}
				<li><code>{url}</code><span>{what}</span></li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.wrap {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 1.5rem;
		background: #0b0f14;
		color: #e8eef5;
		font-family: ui-sans-serif, system-ui, sans-serif;
		text-align: center;
	}

	.badge {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		padding: 0.25rem 0.6rem;
		border-radius: 0.25rem;
	}

	.ok {
		background: #065f46;
		color: #d1fae5;
	}

	.bad {
		background: #7f1d1d;
		color: #fee2e2;
	}

	.clock {
		font-size: 4.5rem;
		font-weight: 700;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.status {
		font-size: 1.05rem;
	}

	.note {
		font-size: 0.8rem;
		color: #8fa3b8;
	}

	.examples {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
		text-align: left;
		font-size: 0.85rem;
	}

	.examples li {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: baseline;
	}

	.examples code {
		font-family: ui-monospace, monospace;
		background: #151c25;
		border: 1px solid #243040;
		border-radius: 0.25rem;
		padding: 0.15rem 0.4rem;
		white-space: nowrap;
	}

	.examples span {
		color: #8fa3b8;
	}
</style>
