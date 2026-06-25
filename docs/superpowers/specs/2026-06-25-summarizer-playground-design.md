# Summarizer Playground — Design Spec

**Date:** 2026-06-25  
**Status:** Approved

---

## Overview

Add a Playground that lets users try the Summarizer API (`Summarizer`) directly
from the status page. When `Summarizer` availability is `available`, an inline
`▶ Playground` button appears on its status row. Clicking it opens a modal dialog
with `type` / `format` / `length` selects and a text input; clicking Run streams the
summary into the output area.

This feature follows the Prompt Playground pattern
(`docs/superpowers/specs/2026-06-25-prompt-playground-design.md`): a logic module +
native `<dialog>` + `ui.js` render helpers + `main.js` wiring, with TDD. The inline
button reuses the already-generalized `showPlaygroundButton(rowId)`.

**Scope (standard):**
- `type` / `format` / `length` selects
- Streaming summary output via `summarizeStreaming`
- Single-shot: a fresh summarizer session per Run (options can change between Runs)
- Run/Stop toggle backed by `AbortController`

**Out of scope (YAGNI):**
- `sharedContext` / per-call `context`
- `measureInputUsage` / input quota display
- Non-streaming mode

---

## Architecture

### File Structure

```
builtin-ai-api-status/
├─ index.html              # + <dialog data-sm-playground> (type/format/length selects, input, output)
├─ src/
│   ├─ main.js             # + show button, open/run/stop/close wiring (Run/Stop controller)
│   ├─ summarizer.js       # NEW: summarize() streaming wrapper with cancellation — pure logic
│   ├─ summarizer.test.js  # NEW: tests for summarizer.js
│   ├─ ui.js               # + clearSummary / appendSummary / showSummarizerError
│   ├─ ui.test.js          # + tests for the new ui helpers
│   └─ style.css           # + select styling if needed (reuse existing tokens)
└─ ...
```

### Responsibilities

| File | Responsibility |
|---|---|
| `summarizer.js` | Summarizer wrapper: `summarize()` — create session with options, stream the summary, destroy. Pure logic, no DOM. |
| `index.html` | Static `<dialog data-sm-playground>` markup (selects, text input, output, error), reusing `.playground*` classes. |
| `ui.js` | `clearSummary`, `appendSummary`, `showSummarizerError` (target `[data-sm-response]` / `[data-sm-error]`). |
| `main.js` | Show button when available; open dialog; Run/Stop controller driving `summarize()`; destroy on abort/close. |
| `style.css` | Minimal `<select>` styling consistent with the terminal theme (only if needed). |

The three response helpers are added in parallel to the Prompt Playground's
`clearPlaygroundResponse` / `appendPlaygroundResponse` / `showPlaygroundError`
(no shared runtime routing between the two output areas), so the Prompt Playground
code is not modified — zero regression risk.

---

## `summarizer.js` Interface

```js
// Create a summarizer with the given options, stream the summary of `text`,
// forward each delta to onChunk, then destroy the session. Returns the full
// concatenated summary. Throws on genuine failure; resolves with partial text
// on abort (including abort during create()).
export async function summarize({ type, format, length, text, signal, onChunk }) {
  const opts = { type, format, length }
  if (signal) opts.signal = signal
  let summarizer
  let full = ''
  try {
    summarizer = await Summarizer.create(opts)
    for await (const chunk of summarizer.summarizeStreaming(text, { signal })) {
      full += chunk
      onChunk?.(chunk)
    }
    return full
  } catch (err) {
    if (err?.name === 'AbortError' || signal?.aborted) return full
    throw err
  } finally {
    summarizer?.destroy()
  }
}
```

- **Single-shot:** each Run creates a fresh summarizer and destroys it on completion
  (success, error, or abort). `type` / `format` / `length` are read from the selects
  on each Run, so a new session is created per Run by design.
- `create()` is inside the `try` and `destroy()` is null-safe, so an abort during
  session creation resolves quietly with `''` (the lesson learned from the Prompt
  Playground's create-time-abort fix, applied up front).

> Note on streaming chunks: `summarizeStreaming()` yields incremental text deltas in
> the current Chrome spec. `summarize` concatenates them and forwards each delta to
> `onChunk` so the UI appends rather than replaces.

---

## UI Design

### Modal Layout (Wireframe)

```
┌─ ▶ Summarizer Playground ──────────────────[ ✕ ]┐
│  type [ key-points ▾ ]   format [ markdown ▾ ]   │
│  length [ medium ▾ ]                             │
│                                                  │
│  Text                                            │
│  [ paste an article to summarize...            ] │
│  [                                             ] │
│                                  [ ▶ Run ]       │
│  ── Summary ───────────────────────────────────  │
│  > streamed summary text appears here…           │
│                                                  │
│  (errors render in red here)                     │
└──────────────────────────────────────────────────┘
```

- Native `<dialog>` opened with `showModal()`; backdrop, `Esc`, focus trap handled by
  the browser. Reuses `.playground` / `.playground-*` classes.
- Three `<select>` controls:
  - `type`: `tldr`, `key-points` (default), `teaser`, `headline`
  - `format`: `markdown` (default), `plain-text`
  - `length`: `short`, `medium` (default), `long`
- While a Run is in flight the `▶ Run` button becomes `⏹ Stop` (backed by an
  `AbortController`); the output appends chunks as they arrive.
- The Run button is `type="button"` (it sits outside the `method="dialog"` form;
  explicit `type` keeps it inert as a submit).

---

## main.js Flow

```js
let smController = null

function setSummarizerRunning(running) {
  const btn = document.querySelector('[data-sm-run]')
  if (btn) btn.textContent = running ? '⏹ Stop' : '▶ Run'
}

function openSummarizerPlayground() {
  const dialog = document.querySelector('[data-sm-playground]')
  if (!dialog) return
  clearSummary()
  dialog.showModal()
}

async function runSummarize() {
  const text = document.querySelector('[data-sm-input]').value.trim()
  if (!text) { showSummarizerError('Enter text to summarize'); return }
  const type = document.querySelector('[data-sm-type]').value
  const format = document.querySelector('[data-sm-format]').value
  const length = document.querySelector('[data-sm-length]').value
  clearSummary()
  smController = new AbortController()
  setSummarizerRunning(true)
  try {
    await summarize({ type, format, length, text, signal: smController.signal, onChunk: appendSummary })
  } catch (err) {
    showSummarizerError(err.message)
  } finally {
    setSummarizerRunning(false)
    smController = null
  }
}
```

Wiring in `init()`:
- Extend the shared delegated `.btn-playground` click handler with
  `else if (btn.dataset.playgroundFor === 'Summarizer') openSummarizerPlayground()`.
- `[data-sm-run]` click → `if (smController) smController.abort(); else runSummarize()`.
- `[data-sm-playground]` `close` → `if (smController) smController.abort()`.

In `runCheck()`, after the existing LanguageModel / LanguageDetector blocks:
```js
if (state.apis.find(a => a.id === 'Summarizer')?.status === 'available') {
  showPlaygroundButton('Summarizer')
}
```

---

## Error Handling & Edge Cases

- **`create()` / `summarize()` failure:** caught in `summarize` (rethrown) and surfaced
  by `runSummarize`'s catch via `showSummarizerError` (red, `status-err` palette). The
  rest of the app stays functional.
- **Abort:** an aborted Run (Stop, `Esc`, `✕`, or abort during create) resolves quietly
  with partial text; the button returns to `▶ Run` and the session is destroyed.
- **Empty / whitespace input:** `runSummarize` shows an inline hint and creates no session.
- **Double-run guard:** while a Run is in flight the button shows `⏹ Stop` and routes to
  `abort()`, preventing overlapping sessions.

---

## Testing (TDD)

### `summarizer.test.js` (new)

Mock `globalThis.Summarizer`:
- `summarize()` calls `onChunk` for each streamed delta and resolves with the full
  concatenated text.
- `summarize()` passes `type` / `format` / `length` to `Summarizer.create()`.
- `summarize()` throws when `create()` / `summarizeStreaming()` rejects with a
  non-abort error.
- `summarize()` resolves with partial text and destroys the session when aborted
  mid-stream.
- `summarize()` resolves with `''` when aborted during `create()` (no session leak).

### `ui.test.js` (additions)

- `appendSummary(chunk)` appends to `[data-sm-response]`.
- `clearSummary()` empties the response and hides + clears `[data-sm-error]`.
- `showSummarizerError(msg)` reveals `[data-sm-error]` with the message.

`main.js` wiring has no unit test (DOM/integration), consistent with the other
playgrounds; verified by build + a manual smoke test.

---

## API Reference Summary

| Call | Purpose |
|---|---|
| `Summarizer.availability()` | Status check (already used by `checker.js`). |
| `Summarizer.create(opts)` | Create a session; `opts` may include `type`, `format`, `length`, `signal`, `monitor`. |
| `summarizer.summarizeStreaming(text, opts)` | Async-iterable / `ReadableStream` of summary text chunks. |
| `summarizer.destroy()` | Release the session. |

### Option Values

| Option | Values (default) |
|---|---|
| `type` | `tldr`, `key-points` (default), `teaser`, `headline` |
| `format` | `markdown` (default), `plain-text` |
| `length` | `short`, `medium` (default), `long` |
