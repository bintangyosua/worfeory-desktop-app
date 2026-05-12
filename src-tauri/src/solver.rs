use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::LazyLock;

// Embed the JSON data directly into the binary
static WORDLIST_RAW: &str = include_str!("../../src/lib/data/wordlist.json");
static FREQMAP_RAW: &str = include_str!("../../src/lib/data/freqmap.json");

static WORDLIST: LazyLock<Vec<String>> = LazyLock::new(|| {
    serde_json::from_str(WORDLIST_RAW).expect("Failed to parse wordlist.json")
});

static FREQMAP: LazyLock<HashMap<String, f64>> = LazyLock::new(|| {
    serde_json::from_str(FREQMAP_RAW).expect("Failed to parse freqmap.json")
});

#[derive(Serialize, Deserialize, Clone)]
pub struct SolverSuggestion {
    pub word: String,
    pub score: f64,
}

/// Return the pattern given a correct answer and a guess
/// A => Absent; P => Present; C => Correct
fn check_pattern(guess: &str, answer: &str) -> [u8; 5] {
    let guess_bytes = guess.as_bytes();
    let answer_bytes = answer.as_bytes();
    let mut pattern = [b'A'; 5];
    let mut answer_chars = [0u8; 5];
    answer_chars.copy_from_slice(&answer_bytes[..5]);

    // Check for correctly placed characters
    for i in 0..5 {
        if guess_bytes[i] == answer_chars[i] {
            pattern[i] = b'C';
            answer_chars[i] = b'.';
        }
    }

    // Check for present characters
    for i in 0..5 {
        if pattern[i] != b'C' {
            if let Some(idx) = answer_chars.iter().position(|&c| c == guess_bytes[i]) {
                pattern[i] = b'P';
                answer_chars[idx] = b'.';
            }
        }
    }

    pattern
}

/// Return the entropy of a guess given a word list of available answers
fn entropy(wordlist: &[String], guess: &str) -> f64 {
    let mut total_prob: f64 = 0.0;
    let mut prob_map: HashMap<[u8; 5], f64> = HashMap::new();

    for word in wordlist {
        let pattern = check_pattern(guess, word);
        let freq = FREQMAP.get(word.as_str()).copied().unwrap_or(0.0);
        *prob_map.entry(pattern).or_insert(0.0) += freq;
        total_prob += freq;
    }

    if total_prob == 0.0 {
        return 0.0;
    }

    let mut result: f64 = 0.0;
    for &prob in prob_map.values() {
        let normal_prob = prob / total_prob;
        if normal_prob > 0.0 {
            result += normal_prob * (1.0 / normal_prob).log2();
        }
    }

    result
}

/// Filter the wordlist to only words that match the given pattern for the guess
fn filter_wordlist(wordlist: &[String], guess: &str, pattern: &str) -> Vec<String> {
    let pattern_bytes: [u8; 5] = pattern.as_bytes()[..5].try_into().unwrap();
    wordlist
        .iter()
        .filter(|word| check_pattern(guess, word) == pattern_bytes)
        .cloned()
        .collect()
}

// ─── Tauri Commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_wordlist() -> Vec<String> {
    WORDLIST.clone()
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GuessHistory {
    pub guess: String,
    pub pattern: String,
}

#[tauri::command]
pub fn get_suggestions(remaining_words: Vec<String>, history: Vec<GuessHistory>, mode: String, top_n: usize) -> Vec<SolverSuggestion> {
    if remaining_words.is_empty() {
        return vec![];
    }
    if remaining_words.len() == 1 {
        return vec![SolverSuggestion {
            word: remaining_words[0].clone(),
            score: 0.0,
        }];
    }
    if remaining_words.len() == 2 {
        return vec![
            SolverSuggestion {
                word: remaining_words[0].clone(),
                score: 0.0,
            },
            SolverSuggestion {
                word: remaining_words[1].clone(),
                score: 0.0,
            },
        ];
    }

    let candidates_pool: Vec<String> = match mode.as_str() {
        "rookie" => WORDLIST.clone(),
        "veteran" => {
            let mut history_parsed = Vec::new();
            for h in history {
                let guess_bytes: [u8; 5] = h.guess.as_bytes()[..5].try_into().unwrap();
                let mut pat_bytes = [0u8; 5];
                let p = h.pattern.as_bytes();
                for i in 0..5 {
                    pat_bytes[i] = match p[i] {
                        b'C' => 2,
                        b'P' => 1,
                        _ => 0,
                    };
                }
                history_parsed.push((guess_bytes, pat_bytes));
            }
            
            WORDLIST.iter()
                .filter(|&word| {
                    let w_bytes = word.as_bytes();
                    for (guess, pattern) in &history_parsed {
                        for i in 0..5 {
                            if pattern[i] == 2 {
                                if w_bytes[i] != guess[i] {
                                    return false;
                                }
                            } else if pattern[i] == 1 {
                                if !w_bytes.contains(&guess[i]) {
                                    return false;
                                }
                            }
                        }
                    }
                    true
                })
                .cloned()
                .collect()
        },
        "legend" => remaining_words.clone(),
        _ => WORDLIST.clone(),
    };

    let mut scored: Vec<SolverSuggestion> = candidates_pool
        .iter()
        .map(|word| {
            let score = entropy(&remaining_words, word);
            SolverSuggestion {
                word: word.clone(),
                score,
            }
        })
        .collect();

    // Sort by score descending
    scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

    scored.truncate(top_n);
    scored
}

#[tauri::command]
pub fn apply_guess(remaining_words: Vec<String>, guess: String, pattern: String) -> Vec<String> {
    filter_wordlist(&remaining_words, &guess, &pattern)
}

#[tauri::command]
pub fn get_top_possible_words(remaining_words: Vec<String>, top_n: usize) -> Vec<String> {
    let mut words = remaining_words;
    words.sort_by(|a, b| {
        let freq_b = FREQMAP.get(b.as_str()).copied().unwrap_or(0.0);
        let freq_a = FREQMAP.get(a.as_str()).copied().unwrap_or(0.0);
        freq_b
            .partial_cmp(&freq_a)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    words.truncate(top_n);
    words
}

#[tauri::command]
pub fn is_valid_word(word: String) -> bool {
    WORDLIST.contains(&word.to_lowercase())
}

#[tauri::command]
pub fn get_wordlist_count() -> usize {
    WORDLIST.len()
}
