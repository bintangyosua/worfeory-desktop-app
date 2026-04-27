import { checkPattern } from './check-pattern';

/**
 * Filter the wordlist to only words that match the given pattern for the guess
 */
export function filterWordlist(wordlist: string[], guess: string, pattern: string): string[] {
	return wordlist.filter((word) => pattern === checkPattern(guess, word));
}
