import { invoke } from '@tauri-apps/api/core';

export type TileState = 'empty' | 'absent' | 'present' | 'correct';

export interface TileData {
	letter: string;
	state: TileState;
}

export interface GuessRow {
	tiles: TileData[];
	word: string;
}

export interface SolverSuggestion {
	word: string;
	score: number;
}

/**
 * Wait for Tauri IPC bridge to be available.
 * This handles the case where Vite's dep optimizer triggers a page reload
 * before Tauri re-injects __TAURI_INTERNALS__.
 */
async function waitForTauri(maxWaitMs: number = 5000): Promise<void> {
	const start = Date.now();
	while (!(window as any).__TAURI_INTERNALS__) {
		if (Date.now() - start > maxWaitMs) {
			throw new Error('Tauri IPC bridge not available. Are you running inside Tauri?');
		}
		await new Promise((r) => setTimeout(r, 50));
	}
}

/**
 * Safe invoke that waits for Tauri IPC to be ready first.
 */
async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
	await waitForTauri();
	return await invoke<T>(cmd, args);
}

/**
 * Get the best guess suggestions based on the current remaining wordlist.
 * Calls the Rust backend via Tauri IPC.
 */
export async function getSuggestions(
	remainingWords: string[],
	topN: number = 10
): Promise<SolverSuggestion[]> {
	return await safeInvoke('get_suggestions', {
		remainingWords: remainingWords,
		topN: topN
	});
}

/**
 * Get the top N possible words sorted by frequency.
 */
export async function getTopPossibleWords(
	remainingWords: string[],
	topN: number = 10
): Promise<string[]> {
	return await safeInvoke('get_top_possible_words', {
		remainingWords: remainingWords,
		topN: topN
	});
}

/**
 * Filter down the remaining word list based on a guess and its pattern
 */
export async function applyGuess(
	remainingWords: string[],
	guess: string,
	pattern: string
): Promise<string[]> {
	return await safeInvoke('apply_guess', {
		remainingWords: remainingWords,
		guess: guess,
		pattern: pattern
	});
}

/**
 * Convert tile states to a pattern string (A/P/C)
 */
export function tilesToPattern(tiles: TileData[]): string {
	return tiles
		.map((t) => {
			switch (t.state) {
				case 'correct':
					return 'C';
				case 'present':
					return 'P';
				case 'absent':
					return 'A';
				default:
					return 'A';
			}
		})
		.join('');
}

/**
 * Get the initial wordlist from Rust
 */
export async function getWordlist(): Promise<string[]> {
	return await safeInvoke('get_wordlist');
}

/**
 * Check if a word exists in the wordlist
 */
export async function isValidWord(word: string): Promise<boolean> {
	return await safeInvoke('is_valid_word', { word: word });
}

/**
 * Get wordlist count
 */
export async function getWordlistCount(): Promise<number> {
	return await safeInvoke('get_wordlist_count');
}
