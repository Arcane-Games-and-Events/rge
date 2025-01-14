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

	const resetCounters = async () => {
		if (typeof window !== 'undefined' && db) {
			try {
				await set(ref(db, 'lifecounter/p1'), 40);
				await set(ref(db, 'lifecounter/p2'), 40);
				p1Counter = 40;
				p2Counter = 40;
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
					p1Counter = snapshot.val() || 40;
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
					p2Counter = snapshot.val() || 40;
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

<div class="w-full mt-4 sm:mt-0 border-2 border-gray-200 rounded-lg">
	<div class="p-4">
		<p class="my-2 font-bold text-2xl text-gray-900 text-center">Life Counter</p>

		<div class="flex flex-col sm:flex-row justify-around items-center mb-5 space-y-4 sm:space-y-0">
			<div class="text-center">
				<h2 class="text-lg font-semibold text-gray-900 mb-2">Player 1</h2>
				<div class="flex items-center justify-center space-x-2">
					<button
						class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
						on:click={() => updateCounter('p1', -1)}
					>
						-
					</button>
					<span class="text-3xl font-bold text-gray-900"
						>{p1Counter > 9 ? p1Counter : '0' + p1Counter}</span
					>
					<button
						class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
						on:click={() => updateCounter('p1', 1)}
					>
						+
					</button>
				</div>
			</div>

			<div class="text-center">
				<h2 class="text-lg font-semibold text-gray-900 mb-2">Player 2</h2>
				<div class="flex items-center justify-center space-x-2">
					<button
						class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
						on:click={() => updateCounter('p2', -1)}
					>
						-
					</button>
					<span class="text-3xl font-bold text-gray-900"
						>{p2Counter > 9 ? p2Counter : '0' + p2Counter}</span
					>
					<button
						class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
						on:click={() => updateCounter('p2', 1)}
					>
						+
					</button>
				</div>
			</div>
		</div>

		<div class="text-center mt-4">
			<button
				class="px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600"
				on:click={resetCounters}
			>
				Reset Life Totals to 40
			</button>
		</div>

		{#if error}
			<div class="text-red-500 mt-5">{error}</div>
		{/if}
	</div>
</div>
