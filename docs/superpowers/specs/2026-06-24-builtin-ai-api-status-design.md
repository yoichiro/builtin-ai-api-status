# Built-in AI API Status Checker — Design Spec

**Date:** 2026-06-24  
**Status:** Approved

---

## Overview

A web app that checks the availability of Chrome/Edge Built-in AI APIs and triggers model downloads to bring each API's status to `available`. Targets both developers and general users.

**Target APIs:**
- `LanguageDetector` (Language Detector API)
- `Translator` (Translator API)
- `Summarizer` (Summarizer API)
- `LanguageModel` (Prompt API)

---

## Architecture

### File Structure

```
builtin-ai-api-status/
├─ index.html           # Entry point (structure only)
├─ src/
│   ├─ main.js          # Initialization + event listener registration
│   ├─ checker.js       # availability() / create() calls, Promise management
│   ├─ ui.js            # Log output, progress bar updates, button state
│   └─ style.css        # Terminal-style dark theme, CSS variables
├─ vite.config.js
├─ firebase.json        # Hosting config (public: dist)
└─ .firebaserc
```

### Data Flow

```
Page load
  → checker.js: run availability() for all APIs in parallel
  → ui.js: output status to log in real time
  → [Download All] click (user activation satisfied)
  → checker.js: call create() for each downloadable API
  → downloadprogress events → ui.js: update progress bars
```

---

## Tech Stack

- **Vite** — dev server (localhost:5173), HMR, build to `dist/`
- **Vanilla HTML/CSS/JS** — no framework dependency
- **Firebase Hosting** — static hosting from `dist/`

### Vite Config

```js
// vite.config.js
export default {
  build: { outDir: 'dist' }
}
```

### Firebase Hosting Config

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

### Development Commands

```bash
npm run dev      # Vite dev server
npm run build    # Build to dist/
firebase deploy  # Deploy to Firebase Hosting
```

---

## UI Design

### Style

Terminal-style dark theme. Monospace font throughout. Semantic color coding for status states. Accessible to general users via plain-language log messages alongside technical status values.

### CSS Design Tokens

```css
:root {
  --bg:        #0d1117;
  --surface:   #161b22;
  --border:    #30363d;
  --text:      #e6edf3;
  --muted:     #484f58;
  --ok:        #3fb950;   /* available */
  --warn:      #d29922;   /* downloadable */
  --info:      #58a6ff;   /* downloading */
  --err:       #f85149;   /* unavailable */
  --font-mono: 'Courier New', Consolas, monospace;
}
```

### Layout (Wireframe)

```
┌─────────────────────────────────────────────────┐
│  built-in-ai-api-status          Chrome 148      │  Header
│  ブラウザのAI機能が使えるか確認・ダウンロードします       │
├─────────────────────────────────────────────────┤
│  [▶ Check Status]   [↓ Download All] (disabled) │  Controls
├─────────────────────────────────────────────────┤
│  ── STATUS ──────────────────────────────────── │
│  19:24:01  [OK]   LanguageDetector  available    │
│  19:24:01  [DL]   Translator        downloadable │
│  19:24:02  [···]  Summarizer        downloading  │
│            ████████░░░░░  60%  1.2GB/2.0GB       │
│  19:24:02  [ERR]  LanguageModel     unavailable  │
├─────────────────────────────────────────────────┤
│  ── TRANSLATOR PAIRS ─────────────────────────  │
│  en→ja [downloadable]   ja→en [available]        │
│  [+ Add pair]  en  →  ja                        │
├─────────────────────────────────────────────────┤
│  ── LOG ──────────────────────────────────────  │
│  ✓ LanguageDetector: ready, no download needed  │
│  ⚡ Translator en→ja: model download required   │
│  ↓ Summarizer: downloading... 60% (1.2/2.0 GB)  │
│  ✗ LanguageModel: device not supported          │
└─────────────────────────────────────────────────┘
```

### Status Color Mapping

| Status | Tag | Color |
|---|---|---|
| `available` | `[OK]` | `#3fb950` green |
| `downloadable` | `[DL]` | `#d29922` yellow |
| `downloading` | `[···]` | `#58a6ff` blue (animated) |
| `unavailable` | `[ERR]` | `#f85149` red |
| API not supported in browser | `[N/A]` | `#484f58` grey |

### [Download All] Button States

| Condition | State |
|---|---|
| No `downloadable` APIs | Disabled (grey) |
| Downloading in progress | Shows `Downloading...`, disabled |
| All downloads complete | Shows `✓ Done` |

---

## Module Responsibilities

| File | Responsibility |
|---|---|
| `main.js` | App initialization, event listener registration, module coordination |
| `checker.js` | `availability()` / `create()` calls, download progress event handling |
| `ui.js` | Log row rendering, progress bar updates, button state management |
| `style.css` | Terminal theme, CSS variables, semantic color system |

---

## Translator Language Pairs

- Users can freely add language pairs (source → target) via a form
- Pairs are checked individually via `Translator.availability({ sourceLanguage, targetLanguage })`
- Each pair is displayed with its own status tag
- Default pairs on load: `en→ja`, `ja→en`

---

## Error Handling & Edge Cases

### Unsupported Browser / API

```js
if (!('LanguageDetector' in self)) {
  // Display [N/A] in grey + log "Not supported in this browser"
}
```

Each API is checked individually. Unsupported APIs are greyed out; the rest display normally.

### User Activation Requirement

`create()` requires user activation for `downloadable` APIs. The `[Download All]` button click itself satisfies this requirement. A log message explains: "Click Download All to start downloading."

### Already Downloading on Page Load

If `availability()` returns `"downloading"` at load time, call `create()` immediately to attach a `downloadprogress` monitor and display the progress bar.

### Translator Pair Input Validation

- Reject empty strings
- Reject identical source and target (`en→en`)
- Reject duplicate pairs already in the list
- Basic BCP 47 format check: `/^[a-z]{2,3}(-[A-Z]{2,4})?$/`

### `create()` Failure

- Display `[ERR] Download failed: <error message>` in red in the log
- Re-enable `[Download All]` button for retry

---

## API Reference Summary

| API | Global Object | Stable Since |
|---|---|---|
| Language Detector | `LanguageDetector` | Chrome 138 |
| Translator | `Translator` | Chrome 138 |
| Summarizer | `Summarizer` | Chrome 138 |
| Prompt | `LanguageModel` | Chrome 148 (web) |

### `availability()` Return Values

| Value | Meaning |
|---|---|
| `"available"` | Ready to use immediately |
| `"downloadable"` | Model needs download (user activation required) |
| `"downloading"` | Download in progress |
| `"unavailable"` | Not supported on this device |

> Note: Older API docs may show `"after-download"`, `"readily"`, or `"unsupported"`. Handle these as aliases for safety:
> - `"readily"` → treat as `"available"`
> - `"after-download"` → treat as `"downloadable"`
> - `"unsupported"` → treat as `"unavailable"`
