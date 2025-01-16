<script>
	import LifeCounter from '../../lib/LifeCounter.svelte';
	import CardReader from '../../lib/CardReader.svelte';
	import PlayerInput from '../../lib/PlayerInput.svelte';
	import Timer from '../../lib/Timer.svelte';
	import CommentatorBooth from '../../lib/CommentatorBooth.svelte';
</script>

<div class="bg-gray-800 grid grid-cols-1 sm:grid-cols-3 gap-4 p-4">
	<div class="flex flex-col space-y-4">
		<CardReader />
	</div>
	<div class="flex flex-col space-y-4">
		<PlayerInput />
		<CommentatorBooth />
	</div>
	<div class="flex flex-col space-y-4">
		<LifeCounter />
		<Timer />
	</div>
</div>
