# Prompt Playground — Design Spec

**Date:** 2026-06-25  
**Status:** Approved

---

## Overview

Add a Playground that lets users try the Prompt API (`LanguageModel`) directly
from the status page. When `LanguageModel` availability is `available`, an
inline `[▶ Playground]` button appears on its status row. Clicking it opens a
modal dialog where the user can set a system prompt, adjust `temperature` /
`topK`, enter a prompt, and see a streamed response.

**Scope (standard):**
- System prompt input
- `temperature` / `topK` adjustment (prefilled from `LanguageModel.params()`)
- Streaming response output
- Single-shot requests (a fresh session per Run; no multi-turn conversation)

**Out of scope (YAGNI):**
- Multi-turn chat / conversation history
- Multimodal (image / audio) inputs
- Structured output (JSON schema)

---

## Architecture

### File Structure

```
builtin-ai-api-status/
├─ index.html              # + <dialog> markup for the playground (initially closed)
├─ src/
│   ├─ main.js             # + show button when available, wire open/run/stop/close
│   ├─ checker.js          # (reuse isApiSupported)
│   ├─ playground.js       # NEW: Prompt API wrapper (pure logic, testable)
│   ├─ playground.test.js  # NEW: tests for playground.js
│   ├─ ui.js               # + showPlaygroundButton + response render helpers
│   ├─ ui.test.js          # + tests for the new ui helpers
│   └─ style.css           # + dialog / panel styles (existing 8-bit palette)
└─ ...
```

### Responsibilities

| File | Responsibility |
|---|---|
| `playground.js` | Prompt API wrapper: `getParams()`, `runPrompt()` with streaming + cancellation. Pure logic, no DOM. |
| `index.html` | Static `<dialog>` markup (system prompt, params, prompt, Run/Stop, response area). |
| `ui.js` | Insert the Playground button into the `available` row; render/append/clear the streamed response and errors. |
| `main.js` | Show button after check, open dialog (prefill params), wire Run/Stop/close, drive streaming via `onChunk`. |
| `style.css` | `<dialog>` overlay + panel styling, consistent with the terminal theme. |

---

## `playground.js` Interface

```js
// Recommended values and ranges for the UI to prefill.
export async function getParams()
//   → { defaultTemperature, maxTemperature, defaultTopK, maxTopK }
//   Delegates to LanguageModel.params().

// Create a session, run a streaming prompt, then destroy the session.
export async function runPrompt({ systemPrompt, temperature, topK, prompt, signal, onChunk })
//   1. session = await LanguageModel.create({ temperature, topK,
//        initialPrompts: systemPrompt ? [{ role: 'system', content: systemPrompt }] : undefined,
//        signal })
//   2. for await (const chunk of session.promptStreaming(prompt, { signal })) onChunk(chunk)
//   3. session.destroy() in a finally block
//   → resolves with the full concatenated text
//   → throws on create/prompt failure; aborts cleanly when signal fires
```

- **Single-shot:** each Run creates a fresh session and destroys it on completion
  (success, error, or abort). No conversation state is retained.
- The dialog stays open between Runs, so the user can iterate freely.
- Browser support is checked via the existing `isApiSupported('LanguageModel')`;
  the button is only shown when status is `available`, so the wrapper assumes the
  global exists.

> Note on streaming chunks: `promptStreaming()` yields incremental text deltas
> in the current spec. `runPrompt` concatenates them and forwards each delta to
> `onChunk` so the UI appends rather than replaces.

---

## UI Design

### Modal Layout (Wireframe)

```
┌─ Prompt Playground ───────────────────[ ✕ ]┐
│  System prompt                              │
│  [ You are a helpful assistant.           ] │
│                                             │
│  Temperature [ 0.8 ]      Top-K [ 3 ]       │
│                                             │
│  Prompt                                     │
│  [                                        ] │
│  [                                        ] │
│                              [ ▶ Run ]      │
│  ── Response ─────────────────────────────  │
│  > streamed response text appears here…     │
│                                             │
│  (errors render in red here)                │
└─────────────────────────────────────────────┘
```

- Native `<dialog>` opened with `showModal()` — the browser handles backdrop
  dimming, `Esc` to close, and focus trapping.
- `Temperature` / `Top-K` inputs are prefilled from `getParams()` when the dialog
  opens.
- While a Run is in flight, the `▶ Run` button becomes `⏹ Stop` (backed by an
  `AbortController`); the response area appends chunks as they arrive.
- Styling reuses the existing terminal palette and monospace font.

---

## main.js Flow

1. After `runCheck()` completes, if the `LanguageModel` row status is
   `available`, call `ui.showPlaygroundButton()` to insert the inline button.
2. Button click → `getParams()` → prefill `temperature` / `topK` →
   `dialog.showModal()`.
3. Run click → collect `systemPrompt`, `temperature`, `topK`, `prompt` →
   create an `AbortController` → call `runPrompt({ ..., signal, onChunk })`,
   appending each chunk to the response area. Toggle the button to `⏹ Stop`.
4. Stop click → `controller.abort()`.
5. `✕` / `Esc` → close the dialog; if a Run is in flight, abort it first.

---

## Error Handling & Edge Cases

- **`create()` / `prompt()` failure:** catch in `runPrompt`, surface the message
  in the dialog's response area in red (`status-err` palette). The rest of the app
  stays functional.
- **Abort:** an aborted Run resolves quietly (no error text); the button returns
  to `▶ Run` and the session is destroyed.
- **Double-click guard:** the Run button is disabled while a Run is in flight
  (it shows `⏹ Stop`), preventing overlapping sessions.
- **Empty prompt:** Run is a no-op (or shows a brief inline hint); no session is
  created.

---

## Testing (TDD)

### `playground.test.js` (new)

Mock `globalThis.LanguageModel`:
- `getParams()` returns the values from `LanguageModel.params()`.
- `runPrompt()` calls `onChunk` for each streamed delta and resolves with the
  full concatenated text.
- `runPrompt()` throws when `create()` / `promptStreaming()` rejects.
- `runPrompt()` aborts cleanly when the `signal` fires, and always calls
  `session.destroy()`.

### `ui.test.js` (additions)

- `showPlaygroundButton()` inserts the button into the `LanguageModel` row only.
- Response render helpers append chunks and clear correctly; error helper renders
  red text.

---

## API Reference Summary

| Call | Purpose |
|---|---|
| `LanguageModel.availability()` | Status check (already used by `checker.js`). |
| `LanguageModel.params()` | `{ defaultTopK, maxTopK, defaultTemperature, maxTemperature }`. |
| `LanguageModel.create(opts)` | Create a session; `opts` may include `temperature`, `topK`, `initialPrompts`, `signal`, `monitor`. |
| `session.promptStreaming(text, opts)` | Async-iterable / `ReadableStream` of text chunks. |
| `session.destroy()` | Release the session. |
