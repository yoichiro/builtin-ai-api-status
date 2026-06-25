# Summarizer Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a modal Playground for trying the Summarizer API (`Summarizer`) with type/format/length selects and streaming output, shown only when its availability is `available`.

**Architecture:** A new pure-logic module `summarizer.js` wraps the Summarizer API (`summarize()` — create with options, stream, destroy, cancellable). A native `<dialog>` in `index.html` holds the UI; `ui.js` gains parallel response helpers; `main.js` wires a Run/Stop controller. Reuses the already-generalized `showPlaygroundButton(rowId)`. Follows the Prompt Playground pattern; the Prompt Playground code is not modified.

**Tech Stack:** Vanilla JS (ES modules), Vite, Vitest + jsdom, native `<dialog>`, `AbortController`, Chrome Summarizer API (`Summarizer`).

## Global Constraints

- Code comments in English only.
- Git commit messages: one line, English, conventional-commit style (`feat:`, `test:`).
- No new runtime dependencies (vanilla JS only).
- Tests use Vitest globals (`describe`/`it`/`expect`/`vi`/`beforeEach`/`afterEach`) — NOT imported; vitest config has `globals: true`.
- Run a single test file with: `npx vitest run <path>`. Run all with: `npm test`.
- Reuse the existing `.playground` / `.playground-*` CSS classes and the `<dialog>` pattern; do not modify the Prompt Playground.
- Option values: `type` = tldr | key-points (default) | teaser | headline; `format` = markdown (default) | plain-text; `length` = short | medium (default) | long.

---

### Task 1: `summarizer.js` — `summarize()` streaming wrapper

**Files:**
- Create: `src/summarizer.js`
- Test: `src/summarizer.test.js`

**Interfaces:**
- Consumes: global `Summarizer.create(opts)` → session with `summarizeStreaming(text, opts)` (async-iterable of text deltas) and `destroy()`.
- Produces:
  `export async function summarize({ type, format, length, text, signal, onChunk }): Promise<string>`
  — creates a session with `{type, format, length, signal}`, streams the summary forwarding each delta to `onChunk`, returns the full text, always destroys the session. Throws on genuine failure; resolves with partial text on abort (including abort during create).

- [ ] **Step 1: Write the failing test**

Create `src/summarizer.test.js`:

```js
import { summarize } from './summarizer.js'

function makeSummarizer({ chunks = [], destroy = vi.fn(), throwAfter = null }) {
  return {
    summarizeStreaming: vi.fn(async function* () {
      for (let i = 0; i < chunks.length; i++) {
        if (throwAfter === i) {
          const err = new Error('aborted')
          err.name = 'AbortError'
          throw err
        }
        yield chunks[i]
      }
    }),
    destroy,
  }
}

describe('summarize', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('streams chunks to onChunk and resolves with the full text', async () => {
    const destroy = vi.fn()
    const session = makeSummarizer({ chunks: ['The ', 'article ', 'argues X.'], destroy })
    vi.stubGlobal('Summarizer', { create: vi.fn(async () => session) })
    const onChunk = vi.fn()

    const full = await summarize({
      type: 'key-points', format: 'markdown', length: 'medium',
      text: 'long text', onChunk,
    })

    expect(full).toBe('The article argues X.')
    expect(onChunk.mock.calls.map(c => c[0])).toEqual(['The ', 'article ', 'argues X.'])
    expect(destroy).toHaveBeenCalled()
  })

  it('passes type/format/length to create()', async () => {
    const create = vi.fn(async () => makeSummarizer({ chunks: ['x'] }))
    vi.stubGlobal('Summarizer', { create })
    await summarize({ type: 'tldr', format: 'plain-text', length: 'short', text: 't', onChunk: vi.fn() })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'tldr', format: 'plain-text', length: 'short',
    }))
  })

  it('throws when create() rejects with a non-abort error', async () => {
    vi.stubGlobal('Summarizer', { create: vi.fn(async () => { throw new Error('boom') }) })
    await expect(summarize({ text: 't', onChunk: vi.fn() })).rejects.toThrow('boom')
  })

  it('resolves with partial text and destroys session when aborted mid-stream', async () => {
    const destroy = vi.fn()
    const session = makeSummarizer({ chunks: ['part', 'never'], throwAfter: 1, destroy })
    vi.stubGlobal('Summarizer', { create: vi.fn(async () => session) })
    const controller = new AbortController()
    const onChunk = vi.fn()

    const full = await summarize({ text: 't', signal: controller.signal, onChunk })

    expect(full).toBe('part')
    expect(onChunk).toHaveBeenCalledWith('part')
    expect(destroy).toHaveBeenCalled()
  })

  it('resolves with empty text when aborted during create()', async () => {
    const destroy = vi.fn()
    vi.stubGlobal('Summarizer', {
      create: vi.fn(async () => {
        const err = new Error('aborted')
        err.name = 'AbortError'
        throw err
      }),
    })
    const controller = new AbortController()
    const full = await summarize({ text: 't', signal: controller.signal, onChunk: vi.fn() })
    expect(full).toBe('')
    expect(destroy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/summarizer.test.js`
Expected: FAIL — cannot resolve `./summarizer.js` / `summarize is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/summarizer.js`:

```js
// Create a summarizer with the given options, stream the summary of `text`,
// forward each delta to onChunk, then destroy the session. Returns the full
// concatenated summary. Throws on genuine failure; on abort (including abort
// during create) resolves with whatever text streamed so far.
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/summarizer.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/summarizer.js src/summarizer.test.js
git commit -m "feat: add summarize streaming wrapper with cancellation"
```

---

### Task 2: `ui.js` — Summarizer response render helpers

**Files:**
- Modify: `src/ui.js`
- Test: `src/ui.test.js`

**Interfaces:**
- Consumes: dialog elements `[data-sm-response]` and `[data-sm-error]` (created in Task 3; tests inject their own fixtures).
- Produces:
  - `export function clearSummary(): void` — empties `[data-sm-response]` and hides + clears `[data-sm-error]`.
  - `export function appendSummary(chunk: string): void` — appends text to `[data-sm-response]`.
  - `export function showSummarizerError(message: string): void` — reveals `[data-sm-error]` with the message.

- [ ] **Step 1: Write the failing test**

Append to `src/ui.test.js`:

```js
describe('summarizer response helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div data-sm-response></div>
      <div data-sm-error hidden></div>
    `
  })

  it('appendSummary appends chunks in order', () => {
    appendSummary('The ')
    appendSummary('summary.')
    expect(document.querySelector('[data-sm-response]').textContent).toBe('The summary.')
  })

  it('clearSummary empties the response and hides the error', () => {
    appendSummary('stuff')
    showSummarizerError('boom')
    clearSummary()
    expect(document.querySelector('[data-sm-response]').textContent).toBe('')
    const err = document.querySelector('[data-sm-error]')
    expect(err.hidden).toBe(true)
    expect(err.textContent).toBe('')
  })

  it('showSummarizerError reveals the error message', () => {
    showSummarizerError('Summarization failed')
    const err = document.querySelector('[data-sm-error]')
    expect(err.hidden).toBe(false)
    expect(err.textContent).toBe('Summarization failed')
  })
})
```

Add `clearSummary`, `appendSummary`, `showSummarizerError` to the top import block in `src/ui.test.js` (the existing `import { ... } from './ui.js'`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui.test.js`
Expected: FAIL — the three helpers are not defined.

- [ ] **Step 3: Write minimal implementation**

Append to `src/ui.js`:

```js
export function clearSummary() {
  const res = document.querySelector('[data-sm-response]')
  if (res) res.textContent = ''
  const err = document.querySelector('[data-sm-error]')
  if (err) { err.hidden = true; err.textContent = '' }
}

export function appendSummary(chunk) {
  const res = document.querySelector('[data-sm-response]')
  if (res) res.textContent += chunk
}

export function showSummarizerError(message) {
  const err = document.querySelector('[data-sm-error]')
  if (!err) return
  err.hidden = false
  err.textContent = message
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui.js src/ui.test.js
git commit -m "feat: add Summarizer response render helpers"
```

---

### Task 3: `index.html` dialog markup + `style.css` select styling

**Files:**
- Modify: `index.html` (add a third `<dialog>` after the Language Detector `</dialog>`, still inside `.app`)
- Modify: `src/style.css` (append `.playground-select` styles)

No automated test — verified by build and Task 4's manual check.

- [ ] **Step 1: Add the dialog markup**

In `index.html`, the Language Detector dialog `<dialog class="playground" data-ld-playground>...</dialog>` sits before the `</div>` that closes `.app`. Insert this block IMMEDIATELY AFTER that dialog's closing `</dialog>` and BEFORE the `.app` closing `</div>`:

```html
    <dialog class="playground" data-sm-playground>
      <form method="dialog" class="playground-head">
        <span class="playground-title">▶ Summarizer Playground</span>
        <button class="playground-close" data-sm-close aria-label="Close">✕</button>
      </form>

      <div class="playground-params">
        <label>type
          <select class="playground-select" data-sm-type>
            <option value="tldr">tldr</option>
            <option value="key-points" selected>key-points</option>
            <option value="teaser">teaser</option>
            <option value="headline">headline</option>
          </select>
        </label>
        <label>format
          <select class="playground-select" data-sm-format>
            <option value="markdown" selected>markdown</option>
            <option value="plain-text">plain-text</option>
          </select>
        </label>
        <label>length
          <select class="playground-select" data-sm-length>
            <option value="short">short</option>
            <option value="medium" selected>medium</option>
            <option value="long">long</option>
          </select>
        </label>
      </div>

      <label class="playground-label">Text</label>
      <textarea class="playground-input" data-sm-input rows="5" placeholder="Paste an article to summarize..."></textarea>

      <div class="playground-actions">
        <button class="btn btn-primary" type="button" data-sm-run>▶ Run</button>
      </div>

      <div class="section-label">── Summary ──</div>
      <div class="playground-response" data-sm-response></div>
      <div class="pair-error" data-sm-error hidden></div>
    </dialog>
```

- [ ] **Step 2: Add the styles**

Append to `src/style.css`:

```css
/* Summarizer option selects */
.playground-params { flex-wrap: wrap; }
.playground-select {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 15px;
  border-radius: 3px;
  padding: 4px 8px;
  margin-left: 6px;
}
.playground-select:focus { outline: none; border-color: var(--info); }
```

- [ ] **Step 3: Verify the build succeeds**

Run: `npm run build`
Expected: build completes with no errors; `dist/` is produced.

- [ ] **Step 4: Commit**

```bash
git add index.html src/style.css
git commit -m "feat: add Summarizer Playground dialog markup and styles"
```

---

### Task 4: `main.js` — wire open / run / stop / close

**Files:**
- Modify: `src/main.js`

No automated test (DOM / integration). Verified by the full suite staying green + a successful build.

**Interfaces:**
- Consumes: `summarize` from `summarizer.js`; `clearSummary`, `appendSummary`, `showSummarizerError` from `ui.js`; the shared delegated `.btn-playground` click handler; dialog data attributes from Task 3.
- Produces: no exports; adds a Summarizer controller, listeners in `init()`, and a `showPlaygroundButton('Summarizer')` call in `runCheck()`.

- [ ] **Step 1: Extend the imports**

In `src/main.js`, add after the existing `import { createDetector, detectLanguages } from './detector.js'` line:

```js
import { summarize } from './summarizer.js'
```

Extend the existing `./ui.js` import block to also import the three Summarizer helpers (add these names to the destructured list):

```js
  clearSummary,
  appendSummary,
  showSummarizerError,
```

- [ ] **Step 2: Add the Summarizer controller block**

Add this block above `function init()` in `src/main.js` (after the existing Language Detector controller functions):

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

- [ ] **Step 3: Route the delegated click handler to the summarizer**

In `src/main.js`, the delegated click handler currently ends with the LanguageDetector branch. REPLACE the handler so it also opens the summarizer:

```js
  document.querySelector('[data-status-list]')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-playground')
    if (!btn) return
    if (btn.dataset.playgroundFor === 'LanguageModel') openPlayground()
    else if (btn.dataset.playgroundFor === 'LanguageDetector') openDetectorPlayground()
    else if (btn.dataset.playgroundFor === 'Summarizer') openSummarizerPlayground()
  })
```

- [ ] **Step 4: Wire the Run/Stop + close listeners**

In `src/main.js`, add these inside `init()`, after the existing Language Detector `[data-ld-playground]` close listener:

```js
  // Summarizer Run button doubles as Stop while a request is in flight.
  document.querySelector('[data-sm-run]')?.addEventListener('click', () => {
    if (smController) smController.abort()
    else runSummarize()
  })

  // Closing the Summarizer dialog (✕ or Esc) aborts any in-flight request.
  document.querySelector('[data-sm-playground]')?.addEventListener('close', () => {
    if (smController) smController.abort()
  })
```

- [ ] **Step 5: Show the button when Summarizer is available**

In `runCheck()`, immediately after the existing LanguageDetector block, add:

```js
  if (state.apis.find(a => a.id === 'Summarizer')?.status === 'available') {
    showPlaygroundButton('Summarizer')
  }
```

- [ ] **Step 6: Verify the full suite + build**

Run: `npm test`
Expected: PASS — 76 tests (73 after Task 1 + 3 Summarizer ui helpers from Task 2).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Manual verification in the dev server**

Run: `npm run dev`
Then in Chrome (with the Summarizer API available, status `available`):
- Confirm `▶ Playground` appears on the Summarizer row.
- Click it → modal opens with type/format/length selects (defaults key-points / markdown / medium) and an empty output.
- Paste text, click `▶ Run` → summary streams in; button shows `⏹ Stop`.
- Click `⏹ Stop` mid-stream → streaming halts, button returns to `▶ Run`.
- Change a select (e.g. type → headline) and Run again → a fresh summary reflects the option.
- Press `Esc` / `✕` → modal closes.
- Empty input + Run → inline red error.
- Confirm the Prompt and Language Detector buttons still open their own dialogs (regression check on the shared button/handler).

- [ ] **Step 8: Commit**

```bash
git add src/main.js
git commit -m "feat: wire Summarizer Playground open/run/stop/close flow"
```

---

## Notes for the Implementer

- **Streaming semantics:** `summarizeStreaming()` yields incremental text deltas in the
  current Chrome spec. `summarize` concatenates them; the UI appends (never replaces).
- **Create-time abort:** `create()` is inside the `try` and `destroy()` is null-safe, so an
  abort during session creation resolves quietly with `''` (this was a fix discovered in the
  Prompt Playground; it is built in here from the start).
- **Single-shot:** a fresh summarizer is created per Run because `type`/`format`/`length` are
  read from the selects each time; it is destroyed in the `finally` block.
- **No prefill:** unlike the Prompt Playground (which prefills temperature/topK from
  `params()`), the selects carry their defaults via `selected` attributes in the HTML, so
  `openSummarizerPlayground` only clears the previous output before `showModal()`.
- **Shared button (no Prompt changes):** the button is the already-generalized
  `showPlaygroundButton('Summarizer')`; only the delegated handler gains one `else if`. The
  Prompt and Language Detector paths are untouched — Task 4's manual check includes a
  regression check that their buttons still open.
```
