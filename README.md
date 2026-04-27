# Worfeory

An entropy-based Wordle solver built as a native desktop application using [Tauri v2](https://v2.tauri.app/), with a Rust backend and a vanilla HTML/CSS/JS frontend.

The solver evaluates all possible guesses by computing [Shannon entropy](https://en.wikipedia.org/wiki/Entropy_(information_theory)) over the remaining candidate set, then ranks them by expected information gain. Inspired by [3Blue1Brown's Wordle video](https://www.youtube.com/watch?v=v68zYyaEmEA).

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Development](#development)
- [Production Build](#production-build)
- [Project Structure](#project-structure)
- [Architecture](#architecture)

---

## Prerequisites

Ensure the following are installed before proceeding.

| Tool       | Version   | Notes                                                      |
| ---------- | --------- | ---------------------------------------------------------- |
| **Rust**   | >= 1.77   | Install via [rustup](https://rustup.rs/)                   |
| **Node.js**| >= 18     | LTS recommended                                            |
| **pnpm**   | >= 8      | `npm install -g pnpm`                                      |

### Platform-specific dependencies

**Windows**

- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) — select "Desktop development with C++" workload.
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) — ships with Windows 10 (1803+) and Windows 11 by default.

**macOS**

- Xcode Command Line Tools: `xcode-select --install`

**Linux**

- System libraries required by Tauri. See [Tauri prerequisites for Linux](https://v2.tauri.app/start/prerequisites/#linux).

---

## Getting Started

Clone the repository and install Node dependencies:

```bash
git clone https://github.com/bintangyosua/worfeory-desktop-app.git
cd worfeory-desktop-app
pnpm install
```

---

## Development

Run the application in development mode with hot-reload:

```bash
pnpm tauri dev
```

This will:

1. Compile the Rust backend (first run takes a few minutes due to dependency compilation).
2. Serve the frontend from `ui/`.
3. Open the native application window.

Subsequent runs are faster since Cargo caches compiled dependencies.

### Frontend only

If you only need to iterate on the UI without launching the full Tauri shell:

```bash
pnpm dev
```

> Note: Tauri IPC commands (`window.__TAURI_INTERNALS__`) will not be available in browser-only mode. The UI will show a connection error.

---

## Production Build

Generate a distributable binary:

```bash
pnpm tauri build
```

Build artifacts are output to:

```
src-tauri/target/release/bundle/
```

| Platform | Output                                |
| -------- | ------------------------------------- |
| Windows  | `.msi` installer and `.exe` binary    |
| macOS    | `.dmg` and `.app` bundle              |
| Linux    | `.deb`, `.AppImage`, `.rpm`           |

### Build configuration

Bundle settings (icon paths, targets, app metadata) are defined in:

```
src-tauri/tauri.conf.json
```

To restrict build targets to a specific format:

```jsonc
// tauri.conf.json
{
  "bundle": {
    "targets": ["msi"]  // or "dmg", "deb", "appimage", etc.
  }
}
```

---

## Project Structure

```
worfeory-desktop-app/
├── ui/                          # Frontend (served directly by Tauri)
│   ├── index.html               # Entry point
│   ├── app.js                   # Application logic, Tauri IPC calls
│   └── style.css                # Stylesheet
│
├── src-tauri/                   # Tauri + Rust backend
│   ├── tauri.conf.json          # Tauri configuration
│   ├── Cargo.toml               # Rust dependencies
│   ├── src/
│   │   ├── main.rs              # Application entry point
│   │   ├── lib.rs               # Tauri command handler registration
│   │   └── solver.rs            # Entropy solver logic
│   ├── icons/                   # Application icons
│   └── capabilities/            # Tauri v2 permission definitions
│
├── src/lib/data/                # Embedded data (compiled into binary)
│   ├── wordlist.json            # ~12,900 five-letter words
│   └── freqmap.json             # Word frequency map
│
├── package.json
└── pnpm-lock.yaml
```

---

## Architecture

### Backend (Rust)

The solver engine runs natively via Tauri IPC. All heavy computation happens in Rust — no network calls involved.

**Exposed commands** (defined in `src-tauri/src/solver.rs`):

| Command                | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `get_wordlist`         | Returns the full word list                               |
| `get_wordlist_count`   | Returns the total word count                             |
| `get_suggestions`      | Ranks all words by entropy against the remaining set     |
| `apply_guess`          | Filters the word list given a guess and its pattern      |
| `get_top_possible_words` | Returns top candidates sorted by word frequency        |
| `is_valid_word`        | Checks whether a word exists in the dictionary           |

The word list and frequency map are embedded at compile time via `include_str!` — no external files are needed at runtime.

### Frontend

A single-page vanilla HTML/CSS/JS application located in `ui/`. Communicates with the Rust backend through `window.__TAURI_INTERNALS__.invoke()`.

The Tauri configuration points directly to this directory:

```jsonc
// tauri.conf.json
{
  "build": {
    "frontendDist": "../ui"
  }
}
```

No build step is required for the frontend. Files are served as-is.

---

## License

This project does not currently specify a license.
