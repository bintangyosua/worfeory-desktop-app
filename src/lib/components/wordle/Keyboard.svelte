<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		onKey: (key: string) => void;
		letterStates: Record<string, 'correct' | 'present' | 'absent' | undefined>;
	}

	let { onKey, letterStates }: Props = $props();

	const rows = [
		['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
		['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
		['Enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫']
	];

	function getKeyClass(key: string): string {
		const k = key.toLowerCase();
		const state = letterStates[k];
		switch (state) {
			case 'correct':
				return 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700';
			case 'present':
				return 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600';
			case 'absent':
				return 'bg-muted text-muted-foreground border-muted hover:bg-muted/80';
			default:
				return 'bg-secondary text-secondary-foreground border-secondary hover:bg-secondary/80';
		}
	}
</script>

<div class="flex flex-col items-center gap-1.5">
	{#each rows as row}
		<div class="flex gap-1">
			{#each row as key}
				<button
					class={cn(
						'inline-flex items-center justify-center rounded-md border font-semibold uppercase transition-all duration-150 select-none',
						key.length > 1 ? 'h-12 px-3 text-xs' : 'h-12 w-9 text-sm',
						getKeyClass(key),
						'cursor-pointer active:scale-95'
					)}
					onclick={() => onKey(key)}
					type="button"
				>
					{key}
				</button>
			{/each}
		</div>
	{/each}
</div>
