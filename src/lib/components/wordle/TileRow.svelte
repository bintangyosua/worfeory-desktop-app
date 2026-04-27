<script lang="ts">
	import Tile from './Tile.svelte';
	import type { TileData, TileState } from '$lib/solver/solver';

	interface Props {
		tiles: TileData[];
		onTileClick?: (index: number) => void;
		animated?: boolean;
	}

	let { tiles, onTileClick, animated = false }: Props = $props();

	const stateOrder: TileState[] = ['empty', 'absent', 'present', 'correct'];

	function cycleState(index: number) {
		if (onTileClick) {
			onTileClick(index);
		}
	}
</script>

<div class="flex gap-1.5">
	{#each tiles as tile, i}
		<Tile
			letter={tile.letter}
			state={tile.state}
			onClick={onTileClick ? () => cycleState(i) : undefined}
			{animated}
		/>
	{/each}
</div>
