# Language Detector Playground — Design Spec

**Date:** 2026-06-25  
**Status:** Approved

---

## Overview

Add a Playground that lets users try the Language Detector API (`LanguageDetector`)
directly from the status page. When `LanguageDetector` availability is `available`,
an inline `▶ Playground` button appears on its status row. Clicking it opens a modal
dialog with a text input; as the user types, the text is debounced and passed to the
detector, and the top detected languages are rendered with confidence bars.

This feature follows the pattern established by the Prompt Playground
(`docs/superpowers/specs/2026-06-25-prompt-playground-design.md`): logic module +
native `<dialog>` + `ui.js` render helpers + `main.js` wiring, with TDD.

**Scope:**
- Single text input, live (debounced) detection while typing
- Top-N detected languages, each with: confidence bar, language code, human-readable
  name (`Intl.DisplayNames`), confidence percentage
- One reused detector session per dialog opening (created on open, destroyed on close)

**Out of scope (YAGNI):**
- `expectedInputLanguages` or other `create()` options
- Detection history / multiple inputs
- Manual "Detect" button (detection is live)

---

## Architecture

### File Structure

```
builtin-ai-api-status/
├─ index.html              # + <dialog data-ld-playground> (text input + results)
├─ src/
│   ├─ main.js             # + show button, open/input-debounce/close wiring
│   ├─ detector.js         # NEW: createDetector(), detectLanguages() — pure logic
│   ├─ detector.test.js    # NEW: tests for detector.js
│   ├─ ui.js               # generalize showPlaygroundButton(rowId) + detector render helpers
│   ├─ ui.test.js          # + tests (generalized button + detector results)
│   └─ style.css           # + .detector-results / confidence-bar styles
└─ ...
```

### Responsibilities

| File | Responsibility |
|---|---|
| `detector.js` | Language Detector wrapper: `createDetector()`, `detectLanguages()` (detect + Top-N normalization). Pure logic, no DOM. |
| `index.html` | Static `<dialog data-ld-playground>` markup (text input, results area, error area), reusing `.playground*` classes. |
| `ui.js` | Generalized `showPlaygroundButton(rowId)`; `renderDetectorResults`, `clearDetectorResults`, `showDetectorError`. |
| `main.js` | Show button when available; create detector on open; debounce input → detect → render; destroy on close. |
| `style.css` | `.detector-results` rows + confidence-bar styling, consistent with the terminal theme. |

---

## Generalizing the Playground Button (DRY)

The Prompt Playground introduced `showPlaygroundButton()` hardcoded to the
`LanguageModel` row with attribute `data-btn-playground`. Generalize it so both
playgrounds share one injector and one delegated click handler.

```js
// ui.js — generalized
export function showPlaygroundButton(rowId) {
  const row = document.querySelector(`[data-status-list] [data-row-id="${rowId}"]`)
  if (!row) return
  const name = row.querySelector('.status-name')
  if (!name || name.querySelector('.btn-playground')) return
  const btn = document.createElement('button')
  btn.className = 'btn-playground'
  btn.dataset.playgroundFor = rowId          // data-playground-for="LanguageModel" | "LanguageDetector"
  btn.textContent = '▶ Playground'
  name.appendChild(btn)
}
```

- Idempotency guard checks `.btn-playground` within the row (one button per row).
- The existing Prompt button's attribute changes from `data-btn-playground` to
  `data-playground-for="LanguageModel"`. The existing `showPlaygroundButton` tests in
  `ui.test.js` and the delegated click handler in `main.js` are updated accordingly.

`main.js` uses a single delegated handler:

```js
document.querySelector('[data-status-list]')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-playground')
  if (!btn) return
  if (btn.dataset.playgroundFor === 'LanguageModel') openPlayground()
  else if (btn.dataset.playgroundFor === 'LanguageDetector') openDetectorPlayground()
})
```

---

## `detector.js` Interface

```js
// Create a detector session. The button only shows when availability is
// 'available', so no download is expected.
export async function createDetector(options = {}) {
  return await LanguageDetector.create(options)
}

// Detect languages in text, returning the top `max` results normalized to
// { language, confidence }. detector.detect() returns results sorted by
// confidence descending.
export async function detectLanguages(detector, text, { max = 5 } = {}) {
  const results = await detector.detect(text)
  return results.slice(0, max).map(r => ({
    language: r.detectedLanguage,
    confidence: r.confidence,
  }))
}
```

- The detector session is created once per dialog opening and reused across
  keystrokes (efficient); `main.js` owns its lifecycle and destruction.

---

## UI Design

### Modal Layout (Wireframe)

```
┌─ ▶ Language Detector Playground ─────────────[ ✕ ]┐
│  Text                                              │
│  [ Bonjour le monde, comment ça va ?             ] │
│                                                    │
│  ── Detected languages ──────────────────────────  │
│  ████████░░  fr  French       82%                  │
│  ██░░░░░░░░  en  English        9%                  │
│  █░░░░░░░░░  es  Spanish        4%                  │
│                                                    │
│  (errors render in red here)                       │
└────────────────────────────────────────────────────┘
```

- Native `<dialog>` opened with `showModal()`; backdrop, `Esc`, focus trap handled by
  the browser. Reuses `.playground` / `.playground-*` classes from the Prompt Playground.
- On each `input` event the text is debounced (~250 ms), then `detectLanguages()` runs
  and `renderDetectorResults()` repaints. Empty input clears the results.
- Each result row: a confidence bar (width = confidence%), the language code, the
  human-readable name via `Intl.DisplayNames(['en'], { type: 'language' })` (falling
  back to the raw code; `und` → "Unknown"), and the rounded percentage.
- No parameter inputs (Language Detector `create()` takes none in scope).

---

## main.js Flow

```js
let ldDetector = null
let ldDebounceId = null

async function openDetectorPlayground() {
  const dialog = document.querySelector('[data-ld-playground]')
  if (!dialog) return
  document.querySelector('[data-ld-input]').value = ''
  clearDetectorResults()
  try {
    ldDetector = await createDetector()
  } catch (err) {
    showDetectorError(err.message)
  }
  dialog.showModal()
}

async function runDetect() {
  const text = document.querySelector('[data-ld-input]').value.trim()
  if (!text) { clearDetectorResults(); return }
  if (!ldDetector) return
  try {
    renderDetectorResults(await detectLanguages(ldDetector, text, { max: 5 }))
  } catch (err) {
    showDetectorError(err.message)
  }
}

function onDetectorInput() {
  clearTimeout(ldDebounceId)
  ldDebounceId = setTimeout(runDetect, 250)
}
```

Wiring in `init()`:
- `[data-ld-input]` `input` → `onDetectorInput`.
- `[data-ld-playground]` `close` → `clearTimeout(ldDebounceId); ldDetector?.destroy(); ldDetector = null`.
- The shared `.btn-playground` delegated handler (above) routes to `openDetectorPlayground()`.

In `runCheck()`, after the api-render loop (alongside the existing LanguageModel check):
```js
if (state.apis.find(a => a.id === 'LanguageDetector')?.status === 'available') {
  showPlaygroundButton('LanguageDetector')
}
```
and update the existing call to `showPlaygroundButton('LanguageModel')`.

---

## Error Handling & Edge Cases

- **`createDetector()` failure:** catch in `openDetectorPlayground`, show the message
  via `showDetectorError` (red, `status-err` palette). The dialog still opens.
- **`detect()` failure:** catch in `runDetect`, surface via `showDetectorError`.
- **Empty / whitespace input:** `clearDetectorResults()`, no detection, no error.
- **Detector not yet ready (`ldDetector` null):** `runDetect` is a no-op.
- **`und` / unknown language code:** rendered as "Unknown"; unknown codes fall back to
  the raw code string.
- **Close while a debounce is pending:** the pending timeout is cleared on `close`.

---

## Testing (TDD)

### `detector.test.js` (new)

Mock `globalThis.LanguageDetector`:
- `createDetector()` returns the session from `LanguageDetector.create()`.
- `detectLanguages(detector, text)` maps `detectedLanguage` → `language`, passes through
  `confidence`, and returns at most `max` entries (default 5), preserving order.

### `ui.test.js` (additions)

- `showPlaygroundButton('LanguageModel')` inserts a `.btn-playground` with
  `data-playground-for="LanguageModel"` into that row; idempotent; no-op when row absent.
  (Updated from the old `data-btn-playground` assertions.)
- `renderDetectorResults([...])` renders one row per result with the language code, the
  confidence percentage, and a confidence bar; `clearDetectorResults()` empties results
  and hides the error; `showDetectorError(msg)` reveals the error element.

`main.js` debounce/lifecycle wiring has no unit test (DOM/integration), consistent with
the Prompt Playground; verified by build + a manual smoke test.

---

## API Reference Summary

| Call | Purpose |
|---|---|
| `LanguageDetector.availability()` | Status check (already used by `checker.js`). |
| `LanguageDetector.create(options)` | Create a detector session. |
| `detector.detect(text)` | Returns `Array<{ detectedLanguage, confidence }>` sorted by confidence desc. |
| `detector.destroy()` | Release the detector. |
| `Intl.DisplayNames(['en'], { type: 'language' }).of(code)` | Human-readable language name for a BCP-47 code. |
