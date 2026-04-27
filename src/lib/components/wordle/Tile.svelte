<script lang="ts">
	import type { TileState } from '$lib/solver/solver';
	import { cn } from '$lib/utils';

	interface Props {
		letter: string;
		state: TileState;
		onClick?: () => void;
		size?: 'sm' | 'md' | 'lg';
		animated?: boolean;
	}

	let { letter, state, onClick, size = 'md', animated = false }: Props = $props();

	const sizeClasses = {
		sm: 'h-10 w-10 text-sm',
		md: 'h-14 w-14 text-xl',
		lg: 'h-16 w-16 text-2xl'
	};

	function getStateClasses(s: TileState): string {
		switch (s) {
			case 'correct':
				return 'bg-emerald-600 text-white border-emerald-600';
			case 'present':
				return 'bg-amber-500 text-white border-amber-500';
			case 'absent':
				return 'bg-muted text-muted-foreground border-muted';
			case 'empty':
			default:
				return 'bg-background text-foreground border-border';
		}
	}
</script>

<button
	class={cn(
		'inline-flex items-center justify-center rounded-md border-2 font-bold uppercase transition-all duration-200 select-none',
		sizeClasses[size],
		getStateClasses(state),
		letter && state === 'empty' && 'border-foreground/30',
		onClick && 'cursor-pointer hover:scale-105 active:scale-95',
		!onClick && 'cursor-default',
		animated && letter && 'animate-pop'
	)}
	onclick={onClick}
	type="button"
	disabled={!onClick}
>
	{letter}
</button>

<style>
	@keyframes pop {
		0% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.12);
		}
		100% {
			transform: scale(1);
		}
	}
	:global(.animate-pop) {
		animation: pop 0.15s ease-in-out;
	}
</style>
