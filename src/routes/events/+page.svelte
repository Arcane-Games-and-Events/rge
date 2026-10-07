<script>
	import { onMount } from 'svelte';
	import { ref, onValue, update, push, set } from 'firebase/database';
	import { db } from '../../firebaseClient';
	import {
		UPCOMING_PATH,
		CIRCUITS,
		ICONS,
		circuitColor,
		normalizeUpcoming,
		dateParts
	} from '$lib/upcomingEvents';
	import EventIcon from '$lib/EventIcon.svelte';

	// Program the upcoming events here; the overlay at /views/upcomingevents
	// draws them in date order, however many there are.
	let title = '';
	let subtitle = '';
	let items = [];
	let origin = '';

	onMount(() => {
		origin = window.location.origin;
		return onValue(ref(db, UPCOMING_PATH), (snap) => {
			({ title, subtitle, items } = normalizeUpcoming(snap.val()));
		});
	});

	const save = (fields) => update(ref(db, UPCOMING_PATH), fields);
	const saveField = (id, field, value) => save({ [`items/${id}/${field}`]: value });

	async function addEvent() {
		await push(ref(db, `${UPCOMING_PATH}/items`), {
			date: '',
			name: '',
			location: '',
			circuit: CIRCUITS[0].name,
			icon: '',
			order: Date.now()
		});
	}

	async function removeEvent(item) {
		if (item.name && !confirm(`Remove ${item.name}?`)) return;
		await set(ref(db, `${UPCOMING_PATH}/items/${item.id}`), null);
	}
</script>

<div class="min-h-screen bg-gray-950 text-white">
	<div class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
		<div class="mb-8 text-center">
			<h1 class="font-display text-3xl font-bold">Upcoming Events</h1>
			<p class="mt-2 text-gray-400">What is coming up, for the overlay.</p>
		</div>

		<!-- Heading -->
		<div class="mb-6 grid gap-4 border border-gray-800 bg-gray-900/50 p-4 sm:grid-cols-2">
			<div>
				<label for="events-title" class="mb-1 block text-sm font-medium text-gray-300">Title</label>
				<input
					id="events-title"
					type="text"
					class="w-full border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					placeholder="Upcoming Events"
					bind:value={title}
					on:change={() => save({ title })}
				/>
			</div>
			<div>
				<label for="events-subtitle" class="mb-1 block text-sm font-medium text-gray-300"
					>Line under it</label
				>
				<input
					id="events-subtitle"
					type="text"
					class="w-full border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					placeholder="AGE Open Series"
					bind:value={subtitle}
					on:change={() => save({ subtitle })}
				/>
			</div>
		</div>

		<!-- Events -->
		<div class="space-y-3">
			{#each items as item (item.id)}
				{@const when = dateParts(item.date)}
				<div
					class="border border-gray-800 bg-gray-900/50 p-4"
					style="border-left: 3px solid {circuitColor(item.circuit)};"
				>
					<div class="grid gap-3 sm:grid-cols-[10rem_1fr_auto]">
						<div>
							<label for="date-{item.id}" class="mb-1 block text-xs font-medium text-gray-400"
								>Date</label
							>
							<input
								id="date-{item.id}"
								type="date"
								class="w-full border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
								value={item.date}
								on:change={(e) => saveField(item.id, 'date', e.currentTarget.value)}
							/>
							{#if when.weekday}
								<p class="mt-1 text-[11px] text-gray-500">
									{when.weekday} · {when.month}
									{when.day}
								</p>
							{/if}
						</div>
						<div>
							<label for="name-{item.id}" class="mb-1 block text-xs font-medium text-gray-400"
								>Event</label
							>
							<input
								id="name-{item.id}"
								type="text"
								class="w-full border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
								placeholder="Players Championship"
								value={item.name}
								on:change={(e) => saveField(item.id, 'name', e.currentTarget.value)}
							/>
						</div>
						<div class="flex items-end">
							<button
								type="button"
								class="border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200 transition-colors hover:border-red-700"
								on:click={() => removeEvent(item)}
							>
								Remove
							</button>
						</div>
					</div>
					<div class="mt-3 grid gap-3 sm:grid-cols-2">
						<div>
							<label for="location-{item.id}" class="mb-1 block text-xs font-medium text-gray-400"
								>Location</label
							>
							<input
								id="location-{item.id}"
								type="text"
								class="w-full border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
								placeholder="Arcane Games and Events, St. Charles"
								value={item.location}
								on:change={(e) => saveField(item.id, 'location', e.currentTarget.value)}
							/>
						</div>
						<div>
							<label for="circuit-{item.id}" class="mb-1 block text-xs font-medium text-gray-400"
								>Circuit</label
							>
							<div class="flex items-center gap-2">
								<span
									class="h-6 w-1.5 flex-shrink-0"
									style="background: {circuitColor(item.circuit)};"
									aria-hidden="true"
								></span>
								<select
									id="circuit-{item.id}"
									class="w-full border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
									value={item.circuit}
									on:change={(e) => saveField(item.id, 'circuit', e.currentTarget.value)}
								>
									{#each CIRCUITS as c (c.name)}
										<option value={c.name}>{c.name}</option>
									{/each}
								</select>
							</div>
						</div>
					</div>
					<!-- The mark the event carries on the overlay, if any -->
					<div class="mt-3">
						<span class="mb-1 block text-xs font-medium text-gray-400">Icon</span>
						<div class="flex gap-2" role="group" aria-label="Icon for {item.name || 'this event'}">
							{#each ICONS as icon (icon.kind)}
								<button
									type="button"
									aria-pressed={item.icon === icon.kind}
									on:click={() => saveField(item.id, 'icon', icon.kind)}
									class="flex h-9 items-center gap-2 border px-3 text-sm transition-colors {item.icon ===
									icon.kind
										? 'border-amber-500 bg-amber-500/20 text-amber-200'
										: 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'}"
								>
									{#if icon.kind}<span class="h-4 w-4"><EventIcon kind={icon.kind} /></span>{/if}
									{icon.label}
								</button>
							{/each}
						</div>
					</div>
				</div>
			{/each}

			<button
				type="button"
				class="w-full border border-dashed border-gray-700 px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
				on:click={addEvent}
			>
				+ Add an event
			</button>
		</div>

		<p class="mt-6 text-xs text-gray-500">
			Saved when you leave a box. The overlay sorts by date and sizes its cards to the count:
			<a class="text-blue-400 hover:underline" href="/views/upcomingevents"
				>{origin}/views/upcomingevents</a
			>, a 1920×1080 browser source.
		</p>
	</div>
</div>
