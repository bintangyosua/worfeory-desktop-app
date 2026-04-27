<script lang="ts">
	import Board from '$lib/components/wordle/Board.svelte';
	import Keyboard from '$lib/components/wordle/Keyboard.svelte';
	import SuggestionPanel from '$lib/components/wordle/SuggestionPanel.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import * as Card from '$lib/components/ui/card';
	import {
		type GuessRow,
		type TileData,
		type TileState,
		type SolverSuggestion,
		getSuggestions,
		applyGuess,
		tilesToPattern,
		getWordlist,
		isValidWord,
		getTopPossibleWords,
		getWordlistCount
	} from '$lib/solver/solver';
	import { RotateCcw, Lightbulb, Info, Zap } from '@lucide/svelte';
	import { onMount } from 'svelte';

	// Game state
	let guesses = $state<GuessRow[]>(createEmptyBoard());
	let activeRow = $state(0);
	let currentCol = $state(0);
	let remainingWords = $state<string[]>([]);
	let topPossibleWords = $state<string[]>([]);
	let suggestions = $state<SolverSuggestion[]>([]);
	let isCalculating = $state(false);
	let letterStates = $state<Record<string, 'correct' | 'present' | 'absent' | undefined>>({});
	let gameMessage = $state('');
	let gameWon = $state(false);
	let showHelp = $state(false);
	let wordlistCount = $state(0);
	let isLoading = $state(true);

	function createEmptyBoard(): GuessRow[] {
		return Array.from({ length: 6 }, () => ({
			word: '',
			tiles: Array.from({ length: 5 }, () => ({
				letter: '',
				state: 'empty' as TileState
			}))
		}));
	}

	async function updateTopPossibleWords() {
		topPossibleWords = await getTopPossibleWords(remainingWords, 10);
	}

	function handleKey(key: string) {
		if (gameWon || activeRow >= 6) return;

		if (key === '⌫' || key === 'Backspace') {
			if (currentCol > 0) {
				currentCol--;
				guesses[activeRow].tiles[currentCol] = { letter: '', state: 'empty' };
				guesses[activeRow].word = guesses[activeRow].tiles.map((t) => t.letter).join('');
			}
			return;
		}

		if (key === 'Enter') {
			submitGuess();
			return;
		}

		// Regular letter
		const letter = key.toLowerCase();
		if (/^[a-z]$/.test(letter) && currentCol < 5) {
			guesses[activeRow].tiles[currentCol] = { letter, state: 'absent' };
			guesses[activeRow].word = guesses[activeRow].tiles.map((t) => t.letter).join('');
			currentCol++;
		}
	}

	function handleTileClick(row: number, col: number) {
		if (row !== activeRow) return;
		const tile = guesses[row].tiles[col];
		if (!tile.letter) return;

		const stateOrder: TileState[] = ['absent', 'present', 'correct'];
		const currentIndex = stateOrder.indexOf(tile.state as TileState);
		const nextState = stateOrder[(currentIndex + 1) % stateOrder.length];
		guesses[row].tiles[col] = { ...tile, state: nextState };
	}

	async function submitGuess() {
		const row = guesses[activeRow];
		const word = row.tiles.map((t) => t.letter).join('');

		if (word.length !== 5) {
			gameMessage = 'Word must be 5 letters!';
			setTimeout(() => (gameMessage = ''), 2000);
			return;
		}

		const valid = await isValidWord(word);
		if (!valid) {
			gameMessage = 'Word not in dictionary!';
			setTimeout(() => (gameMessage = ''), 2000);
			return;
		}

		const pattern = tilesToPattern(row.tiles);

		// Update keyboard letter states
		for (let i = 0; i < 5; i++) {
			const letter = row.tiles[i].letter;
			const tileState = row.tiles[i].state as 'correct' | 'present' | 'absent';
			const existing = letterStates[letter];
			if (
				tileState === 'correct' ||
				(tileState === 'present' && existing !== 'correct') ||
				(tileState === 'absent' && !existing)
			) {
				letterStates[letter] = tileState;
			}
		}

		// Check win
		if (pattern === 'CCCCC') {
			gameWon = true;
			gameMessage = '🎉 Solved!';
			return;
		}

		// Filter remaining words (via Rust)
		remainingWords = await applyGuess(remainingWords, word, pattern);
		await updateTopPossibleWords();

		if (remainingWords.length === 0) {
			gameMessage = 'No matching words found!';
			return;
		}

		// Move to next row
		activeRow++;
		currentCol = 0;

		if (activeRow >= 6) {
			gameMessage = 'Out of guesses!';
			return;
		}

		// Calculate suggestions (via Rust)
		await calculateSuggestions();
	}

	async function calculateSuggestions() {
		isCalculating = true;
		suggestions = [];

		// Allow UI to update
		await new Promise((resolve) => setTimeout(resolve, 50));

		try {
			suggestions = await getSuggestions(remainingWords, 10);
		} catch {
			suggestions = [];
		}

		isCalculating = false;

		// Auto-fill the top suggestion into the board
		if (suggestions.length > 0) {
			selectSuggestion(suggestions[0].word);
		}
	}

	function selectSuggestion(word: string) {
		if (gameWon || activeRow >= 6) return;

		// Fill in the word
		for (let i = 0; i < 5; i++) {
			guesses[activeRow].tiles[i] = {
				letter: word[i],
				state: 'absent'
			};
		}
		guesses[activeRow].word = word;
		currentCol = 5;
	}

	async function resetGame() {
		guesses = createEmptyBoard();
		activeRow = 0;
		currentCol = 0;
		remainingWords = await getWordlist();
		suggestions = [];
		letterStates = {};
		gameMessage = '';
		gameWon = false;
		await updateTopPossibleWords();
		selectSuggestion('salet');
	}

	async function getInitialSuggestion() {
		await calculateSuggestions();
	}

	onMount(async () => {
		remainingWords = await getWordlist();
		wordlistCount = await getWordlistCount();
		await updateTopPossibleWords();
		selectSuggestion('salet');
		isLoading = false;
	});

	// Handle physical keyboard events
	function handleKeydown(e: KeyboardEvent) {
		if (e.ctrlKey || e.altKey || e.metaKey) return;

		if (e.key === 'Backspace') {
			e.preventDefault();
			handleKey('⌫');
		} else if (e.key === 'Enter') {
			e.preventDefault();
			handleKey('Enter');
		} else if (/^[a-zA-Z]$/.test(e.key)) {
			handleKey(e.key);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Worfeory — Entropy-Based Wordle Solver</title>
	<meta
		name="description"
		content="A desktop Wordle solver that uses information entropy to suggest optimal guesses. Powered by Rust + Tauri."
	/>
</svelte:head>

{#if isLoading}
	<div class="flex min-h-screen items-center justify-center bg-background">
		<div class="flex flex-col items-center gap-4">
			<Zap class="h-8 w-8 animate-pulse text-primary" />
			<p class="text-sm text-muted-foreground">Loading solver...</p>
		</div>
	</div>
{:else}
	<div class="flex min-h-screen flex-col bg-background">
		<!-- Header -->
		<header class="border-b border-border">
			<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
				<div class="flex items-center gap-2">
					<Zap class="h-5 w-5 text-primary" />
					<h1 class="text-lg font-bold tracking-tight">Worfeory</h1>
					<Badge variant="outline" class="text-[10px]">Desktop</Badge>
				</div>
				<div class="flex items-center gap-2">
					<Button variant="ghost" size="sm" onclick={() => (showHelp = !showHelp)}>
						<Info class="mr-1 h-4 w-4" />
						How to use
					</Button>
					<Button variant="outline" size="sm" onclick={resetGame}>
						<RotateCcw class="mr-1 h-4 w-4" />
						Reset
					</Button>
				</div>
			</div>
		</header>

		<!-- Help Banner -->
		{#if showHelp}
			<div class="border-b border-border bg-muted/50">
				<div class="mx-auto max-w-5xl px-4 py-4">
					<Card.Root>
						<Card.Content class="pt-4">
							<div class="grid gap-3 text-sm md:grid-cols-3">
								<div class="flex gap-2">
									<Badge variant="outline" class="shrink-0">1</Badge>
									<p>
										Type a word or click a suggestion, then <strong>click each tile</strong> to set its
										color based on Wordle's feedback.
									</p>
								</div>
								<div class="flex gap-2">
									<Badge variant="outline" class="shrink-0">2</Badge>
									<p>
										Press <strong>Enter</strong> to submit. The solver will filter possible words and suggest
										optimal next guesses.
									</p>
								</div>
								<div class="flex gap-2">
									<Badge variant="outline" class="shrink-0">3</Badge>
									<p>
										Suggestions are ranked by <strong>information entropy</strong> — higher bits means more
										information gained per guess.
									</p>
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				</div>
			</div>
		{/if}

		<!-- Main Content -->
		<main class="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row">
			<!-- Left: Board + Keyboard -->
			<div class="flex flex-1 flex-col items-center gap-5">
				<!-- Message -->
				{#if gameMessage}
					<div class="animate-in duration-200 fade-in slide-in-from-top-1">
						<Badge variant={gameWon ? 'default' : 'destructive'} class="px-4 py-1.5 text-sm">
							{gameMessage}
						</Badge>
					</div>
				{/if}

				<!-- Tile Color Legend -->
				<div class="flex items-center gap-4 text-xs text-muted-foreground">
					<div class="flex items-center gap-1.5">
						<div class="h-4 w-4 rounded-sm bg-emerald-600"></div>
						<span>Correct</span>
					</div>
					<div class="flex items-center gap-1.5">
						<div class="h-4 w-4 rounded-sm bg-amber-500"></div>
						<span>Present</span>
					</div>
					<div class="flex items-center gap-1.5">
						<div class="h-4 w-4 rounded-sm border border-border bg-muted"></div>
						<span>Absent</span>
					</div>
				</div>

				<!-- Board -->
				<Board {guesses} {activeRow} onTileClick={handleTileClick} />

				<Separator />

				<!-- Keyboard -->
				<Keyboard onKey={handleKey} {letterStates} />
			</div>

			<!-- Right: Suggestions -->
			<div class="w-full lg:w-80">
				<div class="sticky top-6 space-y-4">
					<SuggestionPanel
						{suggestions}
						possibleWords={topPossibleWords}
						remainingCount={remainingWords.length}
						onSelectWord={selectSuggestion}
						{isCalculating}
					/>

					<Button
						variant="outline"
						class="w-full"
						onclick={getInitialSuggestion}
						disabled={isCalculating}
					>
						<Lightbulb class="mr-2 h-4 w-4" />
						{suggestions.length > 0 ? 'Recalculate' : 'Get Suggestions'}
					</Button>

					<!-- Starter Words -->
					<Card.Root>
						<Card.Header class="pb-3">
							<Card.Title class="text-base">Starter Words</Card.Title>
							<Card.Description>Optimized openers (~3.42 guesses avg). Click to use.</Card.Description
							>
						</Card.Header>
						<Card.Content class="pb-4">
							<div class="grid grid-cols-3 gap-3 text-center">
								<div>
									<p class="mb-2 text-xs font-medium text-muted-foreground">Fastest Avg</p>
									<div class="space-y-1">
										{#each ['salet', 'reast', 'crate', 'trace', 'slate', 'crane'] as word}
											<button
												class="block w-full rounded-md px-2 py-1 font-mono text-xs font-bold tracking-wider uppercase transition-colors hover:bg-accent hover:text-accent-foreground"
												onclick={() => selectSuggestion(word)}
												type="button"
											>
												{word}
											</button>
										{/each}
									</div>
								</div>
								<div>
									<p class="mb-2 text-xs font-medium text-muted-foreground">Fewest 5+</p>
									<div class="space-y-1">
										{#each ['rance', 'rants', 'rated', 'ronte', 'alter', 'lance'] as word}
											<button
												class="block w-full rounded-md px-2 py-1 font-mono text-xs font-bold tracking-wider uppercase transition-colors hover:bg-accent hover:text-accent-foreground"
												onclick={() => selectSuggestion(word)}
												type="button"
											>
												{word}
											</button>
										{/each}
									</div>
								</div>
								<div>
									<p class="mb-2 text-xs font-medium text-muted-foreground">Hard Mode</p>
									<div class="space-y-1">
										{#each ['salet', 'cramp'] as word}
											<button
												class="block w-full rounded-md px-2 py-1 font-mono text-xs font-bold tracking-wider uppercase transition-colors hover:bg-accent hover:text-accent-foreground"
												onclick={() => selectSuggestion(word)}
												type="button"
											>
												{word}
											</button>
										{/each}
									</div>
								</div>
							</div>
						</Card.Content>
					</Card.Root>

					<!-- Quick Info Card -->
					<Card.Root>
						<Card.Content class="pt-4">
							<div class="space-y-2 text-xs text-muted-foreground">
								<p>
									<strong class="text-foreground">Algorithm:</strong> Information entropy (Shannon)
								</p>
								<p>
									<strong class="text-foreground">Inspired by:</strong> 3Blue1Brown's video on solving Wordle
									using information theory
								</p>
								<p>
									<strong class="text-foreground">Dictionary:</strong>
									{wordlistCount.toLocaleString()} five-letter words
								</p>
								<p>
									<strong class="text-foreground">Engine:</strong> Rust (native) via Tauri
								</p>
							</div>
						</Card.Content>
					</Card.Root>
				</div>
			</div>
		</main>

		<!-- Footer -->
		<footer class="border-t border-border">
			<div class="mx-auto max-w-5xl px-4 py-3">
				<p class="text-center text-xs text-muted-foreground">Created By Minuettaro</p>
			</div>
		</footer>
	</div>
{/if}
