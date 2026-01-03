<script>
	import { db } from '../firebaseClient';
	import { ref, onValue, set } from 'firebase/database';

	let p1Counter = 40;
	let p2Counter = 40;
	let error = null;

	const updateCounter = async (player, delta) => {
		if (typeof window !== 'undefined' && db) {
			const counterRef = ref(db, `lifecounter/${player}`);
			try {
				if (player === 'p1') {
					await set(counterRef, p1Counter + delta);
				} else if (player === 'p2') {
					await set(counterRef, p2Counter + delta);
				}
			} catch (err) {
				console.error(`Update counter error:`, err);
				error = err.message;
			}
		}
	};

	const resetCounters = async (lifeTotal) => {
		if (typeof window !== 'undefined' && db) {
			try {
				await set(ref(db, 'lifecounter/p1'), lifeTotal);
				await set(ref(db, 'lifecounter/p2'), lifeTotal);
				p1Counter = lifeTotal;
				p2Counter = lifeTotal;
			} catch (err) {
				console.error(`Reset counter error:`, err);
				error = err.message;
			}
		}
	};

	const fetchCounters = () => {
		if (typeof window !== 'undefined' && db) {
			const p1Ref = ref(db, 'lifecounter/p1');
			onValue(
				p1Ref,
				(snapshot) => {
					const value = snapshot.val();
					p1Counter = value !== null ? value : 40;
				},
				(err) => {
					console.error('Error fetching p1 counter:', err);
					error = err.message;
				}
			);

			const p2Ref = ref(db, 'lifecounter/p2');
			onValue(
				p2Ref,
				(snapshot) => {
					const value = snapshot.val();
					p2Counter = value !== null ? value : 40;
				},
				(err) => {
					console.error('Error fetching p2 counter:', err);
					error = err.message;
				}
			);
		}
	};

	fetchCounters();
</script>

<div class="space-y-6 text-white">
	<div class="grid grid-cols-2 gap-4">
		<!-- Player 1 -->
		<div class="rounded-lg border border-gray-700 bg-gray-800/50 p-4 text-center">
			<h3 class="text-sm font-medium text-gray-400 mb-3">Player 1</h3>
			<div class="flex items-center justify-center gap-3">
				<button
					class="h-10 w-10 rounded-lg bg-red-500/20 text-red-400 font-bold text-xl transition-all hover:bg-red-500 hover:text-white"
					on:click={() => updateCounter('p1', -1)}
				>
					-
				</button>
				<span class="text-4xl font-display font-bold w-16">{p1Counter}</span>
				<button
					class="h-10 w-10 rounded-lg bg-blue-500/20 text-blue-400 font-bold text-xl transition-all hover:bg-blue-500 hover:text-white"
					on:click={() => updateCounter('p1', 1)}
				>
					+
				</button>
			</div>
		</div>

		<!-- Player 2 -->
		<div class="rounded-lg border border-gray-700 bg-gray-800/50 p-4 text-center">
			<h3 class="text-sm font-medium text-gray-400 mb-3">Player 2</h3>
			<div class="flex items-center justify-center gap-3">
				<button
					class="h-10 w-10 rounded-lg bg-red-500/20 text-red-400 font-bold text-xl transition-all hover:bg-red-500 hover:text-white"
					on:click={() => updateCounter('p2', -1)}
				>
					-
				</button>
				<span class="text-4xl font-display font-bold w-16">{p2Counter}</span>
				<button
					class="h-10 w-10 rounded-lg bg-blue-500/20 text-blue-400 font-bold text-xl transition-all hover:bg-blue-500 hover:text-white"
					on:click={() => updateCounter('p2', 1)}
				>
					+
				</button>
			</div>
		</div>
	</div>

	<div class="flex justify-center gap-3">
		<button
			class="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-all hover:border-green-500 hover:text-green-400"
			on:click={() => resetCounters(40)}
		>
			Reset to 40
		</button>
		<button
			class="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-all hover:border-green-500 hover:text-green-400"
			on:click={() => resetCounters(20)}
		>
			Reset to 20
		</button>
	</div>

	{#if error}
		<div class="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</div>
	{/if}
</div>
