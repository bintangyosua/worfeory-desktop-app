/**
 * Return the pattern given a correct answer and a guess
 * A => Absent; P => Present; C => Correct
 */
export function checkPattern(guess: string, answer: string): string {
	let pattern = 'AAAAA';
	let answerChars = answer.split('');

	// Check for correctly placed characters
	for (let i = 0; i < 5; i++) {
		if (guess[i] === answerChars[i]) {
			pattern = replaceAt(pattern, 'C', i);
			answerChars[i] = '.';
		}
	}

	// Check for other present characters
	for (let i = 0; i < 5; i++) {
		if (pattern[i] !== 'C') {
			const idx = answerChars.indexOf(guess[i]);
			if (idx !== -1) {
				pattern = replaceAt(pattern, 'P', i);
				answerChars[idx] = '.';
			}
		}
	}

	return pattern;
}

function replaceAt(str: string, sub: string, position: number): string {
	return str.slice(0, position) + sub + str.slice(position + 1);
}
