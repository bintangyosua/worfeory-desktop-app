import { checkPattern } from './check-pattern';
import freqMap from '$lib/data/freqmap.json';

const freqMapTyped = freqMap as Record<string, number>;

/**
 * Return the entropy of a guess given a word list of available answers
 * Used to determine an optimized choice of guess
 */
export function entropy(wordlist: string[], guess: string): number {
	let totalProb = 0;
	const probMap: Record<string, number> = {};

	for (const word of wordlist) {
		const pattern = checkPattern(guess, word);
		const freq = freqMapTyped[word] ?? 0;
		if (pattern in probMap) {
			probMap[pattern] += freq;
		} else {
			probMap[pattern] = freq;
		}
		totalProb += freq;
	}

	let result = 0;
	for (const pattern of Object.keys(probMap)) {
		const normalProb = probMap[pattern] / totalProb;
		if (normalProb > 0) {
			result += normalProb * Math.log2(1 / normalProb);
		}
	}

	return result;
}
