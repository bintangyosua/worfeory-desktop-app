// ═══════════════════════════════════════════════════════════════════
// Worfeory Desktop — App Logic (Vanilla JS + Tauri IPC)
// ═══════════════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────────────────
const ROWS = 6;
const COLS = 5;
const STATE_ORDER = ['absent', 'present', 'correct'];
const KB_ROWS = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['Enter','z','x','c','v','b','n','m','⌫']
];
let selectedStarter = 'salet';

let board = [];       // 6 rows of 5 tiles: { letter, state }
let activeRow = 0;
let currentCol = 0;
let remainingWords = [];
let suggestions = [];
let letterStates = {};
let gameMessage = '';
let gameWon = false;
let isCalculating = false;
let recomputeVersion = 0;

// ── Tauri IPC ─────────────────────────────────────────────────────
async function invoke(cmd, args) {
  return window.__TAURI_INTERNALS__.invoke(cmd, args || {});
}

// ── Init ──────────────────────────────────────────────────────────
async function init() {
  try {
    remainingWords = await invoke('get_wordlist');
    const count = await invoke('get_wordlist_count');
    document.getElementById('dictCount').textContent = count.toLocaleString();

    createBoard();
    createKeyboard();
    setupStarterPicker();
    setupEventListeners();
    selectSuggestion(selectedStarter);
    await updateTopPossibleWords();

    document.getElementById('loading').style.display = 'none';
    document.getElementById('main').style.display = 'flex';
    updateRemainingCount();
  } catch (e) {
    console.error('Init failed:', e);
    document.querySelector('.loading-screen p').textContent =
      'Failed to connect to Rust engine: ' + e.message;
  }
}

// ── Board ─────────────────────────────────────────────────────────
function createBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  board = [];

  for (let r = 0; r < ROWS; r++) {
    const row = [];
    const rowEl = document.createElement('div');
    rowEl.className = 'board-row';

    for (let c = 0; c < COLS; c++) {
      const tile = { letter: '', state: 'empty' };
      row.push(tile);

      const tileEl = document.createElement('div');
      tileEl.className = 'tile';
      tileEl.dataset.row = r;
      tileEl.dataset.col = c;
      tileEl.addEventListener('click', () => handleTileClick(r, c));
      rowEl.appendChild(tileEl);
    }

    board.push(row);
    boardEl.appendChild(rowEl);
  }

  updateBoardDisplay();
}

function updateBoardDisplay() {
  const tiles = document.querySelectorAll('.tile');
  tiles.forEach(el => {
    const r = parseInt(el.dataset.row);
    const c = parseInt(el.dataset.col);
    const tile = board[r][c];

    el.textContent = tile.letter;
    el.className = 'tile';

    if (tile.letter) {
      el.classList.add('filled');
    }
    if (tile.state !== 'empty') {
      el.classList.add(tile.state);
    }
    if (r === activeRow && !gameWon) {
      el.classList.add('active-row');
    }

    // Any filled row is clickable to adjust colors
    const rowWord = board[r].map(t => t.letter).join('');
    if (rowWord.length === 5 && !gameWon) {
      el.classList.add('clickable');
    }
  });
}

function handleTileClick(row, col) {
  if (gameWon) return;
  const tile = board[row][col];
  if (!tile.letter) return;

  // Allow clicking on any row that has a fully filled word
  const rowWord = board[row].map(t => t.letter).join('');
  if (rowWord.length !== 5) return;

  const idx = STATE_ORDER.indexOf(tile.state);
  tile.state = STATE_ORDER[(idx + 1) % STATE_ORDER.length];
  updateBoardDisplay();

  // Recompute suggestions from row 0 up to this row
  recomputeFromRow(row);
}

async function recomputeFromRow(upToRow) {
  const thisVersion = ++recomputeVersion;
  isCalculating = true;
  const area = document.getElementById('suggestionsArea');
  area.innerHTML = '<div class="calculating"><div class="spinner"></div>Recalculating...</div>';
  document.getElementById('calcBtn').disabled = true;

  try {
    // Start from the full wordlist and replay all guesses up to upToRow
    let filtered = await invoke('get_wordlist');

    for (let r = 0; r <= upToRow; r++) {
      const word = board[r].map(t => t.letter).join('');
      if (word.length !== 5) break;

      const pattern = board[r].map(t => {
        if (t.state === 'correct') return 'C';
        if (t.state === 'present') return 'P';
        return 'A';
      }).join('');

      filtered = await invoke('apply_guess', {
        remainingWords: filtered, guess: word, pattern
      });
    }

    // Bail if a newer recompute was triggered
    if (thisVersion !== recomputeVersion) return;

    remainingWords = filtered;
    updateRemainingCount();
    await updateTopPossibleWords();

    // Set active row to the next row after the clicked one
    activeRow = upToRow + 1;
    currentCol = 0;

    // Clear all rows after the new active row (when going back)
    for (let r = activeRow + 1; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        board[r][c] = { letter: '', state: 'empty' };
      }
    }

    if (remainingWords.length === 0) {
      suggestions = [];
      renderSuggestions();
      showMessage('No matching words found!', false);
    } else if (activeRow < ROWS) {
      // Calculate suggestions for next row
      suggestions = await invoke('get_suggestions', {
        remainingWords, topN: 10
      });
      renderSuggestions();

      // Auto-fill top suggestion into next row
      if (suggestions.length > 0) {
        selectSuggestion(suggestions[0].word);
      }
    }
  } catch (e) {
    console.error('Recompute failed:', e);
    suggestions = [];
    renderSuggestions();
  }

  isCalculating = false;
  document.getElementById('calcBtn').disabled = false;
  document.getElementById('calcBtn').textContent = '💡 Recalculate';
  updateBoardDisplay();
}

// ── Keyboard ──────────────────────────────────────────────────────
function createKeyboard() {
  const kbEl = document.getElementById('keyboard');
  kbEl.innerHTML = '';

  KB_ROWS.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';

    row.forEach(key => {
      const btn = document.createElement('button');
      btn.className = 'kb-key';
      btn.textContent = key;
      btn.dataset.key = key;

      if (key === 'Enter' || key === '⌫') {
        btn.classList.add('wide');
      }

      btn.addEventListener('click', () => handleKey(key));
      rowEl.appendChild(btn);
    });

    kbEl.appendChild(rowEl);
  });
}

function updateKeyboardDisplay() {
  document.querySelectorAll('.kb-key').forEach(btn => {
    const key = btn.dataset.key.toLowerCase();
    if (key.length === 1 && letterStates[key]) {
      btn.className = 'kb-key ' + letterStates[key];
    }
  });
}

// ── Input Handling ────────────────────────────────────────────────
function handleKey(key) {
  if (gameWon || activeRow >= ROWS) return;

  if (key === '⌫' || key === 'Backspace') {
    if (currentCol > 0) {
      currentCol--;
      board[activeRow][currentCol] = { letter: '', state: 'empty' };
      updateBoardDisplay();
    }
    return;
  }

  if (key === 'Enter') {
    submitGuess();
    return;
  }

  const letter = key.toLowerCase();
  if (/^[a-z]$/.test(letter) && currentCol < COLS) {
    board[activeRow][currentCol] = { letter, state: 'absent' };
    currentCol++;
    updateBoardDisplay();
  }
}

async function submitGuess() {
  const word = board[activeRow].map(t => t.letter).join('');

  if (word.length !== 5) {
    showMessage('Word must be 5 letters!', false);
    return;
  }

  const valid = await invoke('is_valid_word', { word });
  if (!valid) {
    showMessage('Word not in dictionary!', false);
    return;
  }

  const pattern = board[activeRow].map(t => {
    if (t.state === 'correct') return 'C';
    if (t.state === 'present') return 'P';
    return 'A';
  }).join('');

  // Update keyboard letter states from all submitted rows
  letterStates = {};
  for (let r = 0; r <= activeRow; r++) {
    for (let i = 0; i < 5; i++) {
      const letter = board[r][i].letter;
      const tileState = board[r][i].state;
      if (!letter) continue;
      const existing = letterStates[letter];
      if (
        tileState === 'correct' ||
        (tileState === 'present' && existing !== 'correct') ||
        (tileState === 'absent' && !existing)
      ) {
        letterStates[letter] = tileState;
      }
    }
  }
  updateKeyboardDisplay();

  // Check win
  if (pattern === 'CCCCC') {
    gameWon = true;
    showMessage('🎉 Solved!', true);
    return;
  }

  // Use recomputeFromRow which replays all rows from scratch
  await recomputeFromRow(activeRow);
}

// ── Suggestions ───────────────────────────────────────────────────
async function calculateSuggestions() {
  isCalculating = true;
  const area = document.getElementById('suggestionsArea');
  area.innerHTML = '<div class="calculating"><div class="spinner"></div>Calculating best guesses...</div>';
  document.getElementById('calcBtn').disabled = true;

  try {
    suggestions = await invoke('get_suggestions', {
      remainingWords, topN: 10
    });
  } catch {
    suggestions = [];
  }

  isCalculating = false;
  document.getElementById('calcBtn').disabled = false;
  renderSuggestions();

  // Auto-fill top suggestion
  if (suggestions.length > 0) {
    selectSuggestion(suggestions[0].word);
  }
}

function renderSuggestions() {
  const area = document.getElementById('suggestionsArea');

  if (suggestions.length === 0) {
    area.innerHTML = '<p class="muted">No suggestions available yet.</p>';
    return;
  }

  area.innerHTML = '';
  suggestions.forEach((s, i) => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.innerHTML = `
      <span class="suggestion-rank">${i + 1}</span>
      <span class="suggestion-word">${s.word}</span>
      <span class="suggestion-score">${s.score.toFixed(3)} bits</span>
    `;
    item.addEventListener('click', () => selectSuggestion(s.word));
    area.appendChild(item);
  });
}

function selectSuggestion(word) {
  if (gameWon || activeRow >= ROWS) return;

  for (let i = 0; i < 5; i++) {
    board[activeRow][i] = { letter: word[i], state: 'absent' };
  }
  currentCol = 5;
  updateBoardDisplay();
}

// ── Possible Words ────────────────────────────────────────────────
async function updateTopPossibleWords() {
  try {
    const words = await invoke('get_top_possible_words', {
      remainingWords, topN: 10
    });

    const container = document.getElementById('possibleWords');
    if (words.length === 0) {
      container.innerHTML = '<p class="muted">No words left.</p>';
      return;
    }

    container.innerHTML = '';
    words.forEach(w => {
      const span = document.createElement('span');
      span.className = 'possible-word';
      span.textContent = w;
      container.appendChild(span);
    });
  } catch (e) {
    console.error('Failed to get possible words:', e);
  }
}

// ── UI Helpers ────────────────────────────────────────────────────
function updateRemainingCount() {
  document.getElementById('remainingCount').textContent =
    `${remainingWords.length.toLocaleString()} words left`;
}

function showMessage(msg, success) {
  const el = document.getElementById('gameMessage');
  el.style.display = 'block';
  el.innerHTML = `<span class="msg-badge ${success ? 'success' : 'error'}">${msg}</span>`;

  if (!success && !gameWon) {
    setTimeout(() => { el.style.display = 'none'; }, 2500);
  }
}

async function resetGame() {
  board = [];
  activeRow = 0;
  currentCol = 0;
  suggestions = [];
  letterStates = {};
  gameWon = false;
  document.getElementById('gameMessage').style.display = 'none';

  remainingWords = await invoke('get_wordlist');
  createBoard();
  createKeyboard();
  selectSuggestion(selectedStarter);
  await updateTopPossibleWords();
  updateRemainingCount();

  const area = document.getElementById('suggestionsArea');
  area.innerHTML = '<p class="muted">Enter a word and set tile colors to get suggestions.</p>';
  document.getElementById('calcBtn').textContent = '💡 Get Suggestions';
}

// ── Starter Picker ────────────────────────────────────────────────
function setupStarterPicker() {
  const options = document.querySelectorAll('.starter-option');
  options.forEach(btn => {
    btn.addEventListener('click', () => {
      const word = btn.dataset.word;
      selectedStarter = word;

      // Update active state
      options.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Fill the board if on a clean row
      selectSuggestion(word);
    });
  });
}

// ── Event Listeners ───────────────────────────────────────────────
function setupEventListeners() {
  document.getElementById('helpBtn').addEventListener('click', () => {
    const banner = document.getElementById('helpBanner');
    banner.style.display = banner.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('resetBtn').addEventListener('click', resetGame);

  document.getElementById('calcBtn').addEventListener('click', async () => {
    if (!isCalculating) {
      await calculateSuggestions();
      document.getElementById('calcBtn').textContent = '💡 Recalculate';
    }
  });

  // Physical keyboard
  document.addEventListener('keydown', (e) => {
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
  });
}

// ── Boot ──────────────────────────────────────────────────────────
// Wait for Tauri IPC to be ready, then init
(function boot() {
  if (window.__TAURI_INTERNALS__) {
    init();
  } else {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.__TAURI_INTERNALS__) {
        clearInterval(interval);
        init();
      } else if (attempts > 100) {
        clearInterval(interval);
        document.querySelector('.loading-screen p').textContent =
          'Tauri runtime not detected. Please run inside Tauri.';
      }
    }, 50);
  }
})();
