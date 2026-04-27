<script lang="ts">
	import TileRow from './TileRow.svelte';
	import type { GuessRow, TileState } from '$lib/solver/solver';

	interface Props {
		guesses: GuessRow[];
		activeRow: number;
		onTileClick?: (row: number, col: number) => void;
	}

	let { guesses, activeRow, onTileClick }: Props = $props();
</script>

<div class="flex flex-col items-center gap-1.5">
	{#each guesses as guess, rowIndex}
		<TileRow
			tiles={guess.tiles}
			onTileClick={rowIndex === activeRow && onTileClick
				? (col) => onTileClick?.(rowIndex, col)
				: undefined}
			animated={rowIndex === activeRow}
		/>
	{/each}
</div>
