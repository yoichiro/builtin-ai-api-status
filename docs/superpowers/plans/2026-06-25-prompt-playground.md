# Prompt Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a modal Playground for trying the Prompt API (`LanguageModel`), shown only when its availability is `available`.

**Architecture:** A new pure-logic module `playground.js` wraps the Prompt API (`getParams`, streaming `runPrompt` with cancellation). A native `<dialog>` in `index.html` holds the UI. `ui.js` gains a button-injector and response-render helpers. `main.js` wires the open/run/stop/close flow. Follows the existing logic / DOM / test separation.

**Tech Stack:** Vanilla JS (ES modules), Vite, Vitest + jsdom, native `<dialog>`, `AbortController`, Chrome Prompt API (`LanguageModel`).

## Global Constraints

- Code comments in English only.
- Git commit messages: one line, English, conventional-commit style (`feat:`, `test:`, `style:`).
- No new runtime dependencies (vanilla JS only).
- Reuse existing helpers where possible (`isApiSupported` from `checker.js`).
- Tests are TDD: write the failing test first, watch it fail, then implement.
- Run a single test file with: `npx vitest run <path>`. Run all with: `npm test`.

---

### Task 1: `playground.js` — `getParams()`

**Files:**
- Create: `src/playground.js`
- Test: `src/playground.test.js`

**Interfaces:**
- Consumes: global `LanguageModel.params()` → `{ defaultTopK, maxTopK, defaultTemperature, maxTemperature }`.
- Produces: `export async function getParams(): Promise<{ defaultTemperature, maxTemperature, defaultTopK, maxTopK }>`

- [ ] **Step 1: Write the failing test**

Create `src/playground.test.js`:

```js
import { getParams } from './playground.js'

describe('getParams', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('maps LanguageModel.params() into the prefill shape', async () => {
    vi.stubGlobal('LanguageModel', {
      params: async () => ({
        defaultTemperature: 0.8,
        maxTemperature: 2.0,
        defaultTopK: 3,
        maxTopK: 128,
      }),
    })
    const p = await getParams()
    expect(p).toEqual({
      defaultTemperature: 0.8,
      maxTemperature: 2.0,
      defaultTopK: 3,
      maxTopK: 128,
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/playground.test.js`
Expected: FAIL — cannot resolve `./playground.js` / `getParams is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/playground.js`:

```js
// Recommended values and ranges for prefilling the Playground inputs.
export async function getParams() {
  const p = await LanguageModel.params()
  return {
    defaultTemperature: p.defaultTemperature,
    maxTemperature:     p.maxTemperature,
    defaultTopK:        p.defaultTopK,
    maxTopK:            p.maxTopK,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/playground.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/playground.js src/playground.test.js
git commit -m "feat: add getParams wrapper for Prompt API params"
```

---

### Task 2: `playground.js` — `runPrompt()` streaming + cancellation

**Files:**
- Modify: `src/playground.js`
- Test: `src/playground.test.js`

**Interfaces:**
- Consumes: global `LanguageModel.create(opts)` → session with `promptStreaming(text, opts)` (async-iterable of text deltas) and `destroy()`.
- Produces:
  `export async function runPrompt({ systemPrompt, temperature, topK, prompt, signal, onChunk }): Promise<string>`
  — creates a session, streams the prompt forwarding each delta to `onChunk`, returns the full concatenated text, always destroys the session. Throws on create/stream failure; resolves with partial text on abort.

- [ ] **Step 1: Write the failing test**

Append to `src/playground.test.js`:

```js
import { runPrompt } from './playground.js'

function makeSession({ chunks = [], destroy = vi.fn(), throwAfter = null }) {
  return {
    promptStreaming: vi.fn(async function* () {
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

describe('runPrompt', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('streams chunks to onChunk and resolves with the full text', async () => {
    const destroy = vi.fn()
    const session = makeSession({ chunks: ['Hello', ', ', 'world'], destroy })
    vi.stubGlobal('LanguageModel', { create: vi.fn(async () => session) })
    const onChunk = vi.fn()

    const full = await runPrompt({
      systemPrompt: 'You are helpful.',
      temperature: 0.8,
      topK: 3,
      prompt: 'hi',
      onChunk,
    })

    expect(full).toBe('Hello, world')
    expect(onChunk.mock.calls.map(c => c[0])).toEqual(['Hello', ', ', 'world'])
    expect(destroy).toHaveBeenCalled()
  })

  it('passes systemPrompt and params to create()', async () => {
    const create = vi.fn(async () => makeSession({ chunks: ['x'] }))
    vi.stubGlobal('LanguageModel', { create })
    await runPrompt({ systemPrompt: 'sys', temperature: 1.2, topK: 5, prompt: 'p', onChunk: vi.fn() })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      temperature: 1.2,
      topK: 5,
      initialPrompts: [{ role: 'system', content: 'sys' }],
    }))
  })

  it('throws when create() rejects', async () => {
    vi.stubGlobal('LanguageModel', { create: vi.fn(async () => { throw new Error('boom') }) })
    await expect(runPrompt({ prompt: 'p', onChunk: vi.fn() })).rejects.toThrow('boom')
  })

  it('resolves with partial text and destroys session when aborted', async () => {
    const destroy = vi.fn()
    const session = makeSession({ chunks: ['part', 'never'], throwAfter: 1, destroy })
    vi.stubGlobal('LanguageModel', { create: vi.fn(async () => session) })
    const controller = new AbortController()
    const onChunk = vi.fn()

    const full = await runPrompt({ prompt: 'p', signal: controller.signal, onChunk })

    expect(full).toBe('part')
    expect(onChunk).toHaveBeenCalledWith('part')
    expect(destroy).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/playground.test.js`
Expected: FAIL — `runPrompt is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/playground.js`:

```js
// Create a session, stream a prompt, forward deltas to onChunk, then destroy.
// Returns the full concatenated text. Throws on failure; on abort resolves
// with whatever text streamed so far.
export async function runPrompt({ systemPrompt, temperature, topK, prompt, signal, onChunk }) {
  const opts = {}
  if (signal) opts.signal = signal
  // temperature and topK must be set together or not at all.
  if (temperature != null && topK != null) {
    opts.temperature = temperature
    opts.topK = topK
  }
  if (systemPrompt) {
    opts.initialPrompts = [{ role: 'system', content: systemPrompt }]
  }

  const session = await LanguageModel.create(opts)
  let full = ''
  try {
    for await (const chunk of session.promptStreaming(prompt, { signal })) {
      full += chunk
      onChunk?.(chunk)
    }
    return full
  } catch (err) {
    if (err?.name === 'AbortError' || signal?.aborted) return full
    throw err
  } finally {
    session.destroy()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/playground.test.js`
Expected: PASS (all 5 tests in the file).

- [ ] **Step 5: Commit**

```bash
git add src/playground.js src/playground.test.js
git commit -m "feat: add runPrompt streaming wrapper with cancellation"
```

---

### Task 3: `ui.js` — `showPlaygroundButton()`

**Files:**
- Modify: `src/ui.js`
- Test: `src/ui.test.js`

**Interfaces:**
- Consumes: an existing `[data-status-list] [data-row-id="LanguageModel"]` row containing a `.status-name` span (produced by `renderApiRow`).
- Produces: `export function showPlaygroundButton(): void` — inserts a `<button data-btn-playground>` into the LanguageModel row's `.status-name`, idempotently.

- [ ] **Step 1: Write the failing test**

Append to `src/ui.test.js` (note `renderApiRow` is already imported there):

```js
describe('showPlaygroundButton', () => {
  beforeEach(setupDOM)

  it('inserts a playground button into the LanguageModel row', () => {
    renderApiRow('LanguageModel', 'Prompt (LanguageModel)', 'available')
    showPlaygroundButton()
    const btn = document.querySelector('[data-row-id="LanguageModel"] [data-btn-playground]')
    expect(btn).not.toBeNull()
    expect(btn.textContent).toContain('Playground')
  })

  it('does not duplicate the button on repeated calls', () => {
    renderApiRow('LanguageModel', 'Prompt (LanguageModel)', 'available')
    showPlaygroundButton()
    showPlaygroundButton()
    const btns = document.querySelectorAll('[data-row-id="LanguageModel"] [data-btn-playground]')
    expect(btns.length).toBe(1)
  })

  it('does nothing when the LanguageModel row is absent', () => {
    expect(() => showPlaygroundButton()).not.toThrow()
  })
})
```

Add `showPlaygroundButton` to the import block at the top of `src/ui.test.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui.test.js`
Expected: FAIL — `showPlaygroundButton is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/ui.js`:

```js
export function showPlaygroundButton() {
  const row = document.querySelector('[data-status-list] [data-row-id="LanguageModel"]')
  if (!row) return
  const name = row.querySelector('.status-name')
  if (!name || name.querySelector('[data-btn-playground]')) return
  const btn = document.createElement('button')
  btn.dataset.btnPlayground = ''
  btn.className = 'btn-playground'
  btn.textContent = '▶ Playground'
  name.appendChild(btn)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui.js src/ui.test.js
git commit -m "feat: add showPlaygroundButton to inject inline Playground button"
```

---

### Task 4: `ui.js` — Playground response render helpers

**Files:**
- Modify: `src/ui.js`
- Test: `src/ui.test.js`

**Interfaces:**
- Consumes: dialog elements `[data-pg-response]` and `[data-pg-error]` (created in Task 5; tests inject their own fixtures).
- Produces:
  - `export function clearPlaygroundResponse(): void` — empties response text and hides the error element.
  - `export function appendPlaygroundResponse(chunk: string): void` — appends text to the response element.
  - `export function showPlaygroundError(message: string): void` — shows the error element with `message`.

- [ ] **Step 1: Write the failing test**

Append to `src/ui.test.js`:

```js
describe('playground response helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div data-pg-response></div>
      <div data-pg-error hidden></div>
    `
  })

  it('appendPlaygroundResponse appends chunks in order', () => {
    appendPlaygroundResponse('Hello')
    appendPlaygroundResponse(', world')
    expect(document.querySelector('[data-pg-response]').textContent).toBe('Hello, world')
  })

  it('clearPlaygroundResponse empties the response and hides the error', () => {
    appendPlaygroundResponse('stuff')
    showPlaygroundError('boom')
    clearPlaygroundResponse()
    expect(document.querySelector('[data-pg-response]').textContent).toBe('')
    const err = document.querySelector('[data-pg-error]')
    expect(err.hidden).toBe(true)
    expect(err.textContent).toBe('')
  })

  it('showPlaygroundError reveals the error message', () => {
    showPlaygroundError('Something failed')
    const err = document.querySelector('[data-pg-error]')
    expect(err.hidden).toBe(false)
    expect(err.textContent).toBe('Something failed')
  })
})
```

Add `clearPlaygroundResponse`, `appendPlaygroundResponse`, `showPlaygroundError` to the import block at the top of `src/ui.test.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui.test.js`
Expected: FAIL — helper functions are not defined.

- [ ] **Step 3: Write minimal implementation**

Append to `src/ui.js`:

```js
export function clearPlaygroundResponse() {
  const res = document.querySelector('[data-pg-response]')
  if (res) res.textContent = ''
  const err = document.querySelector('[data-pg-error]')
  if (err) { err.hidden = true; err.textContent = '' }
}

export function appendPlaygroundResponse(chunk) {
  const res = document.querySelector('[data-pg-response]')
  if (res) res.textContent += chunk
}

export function showPlaygroundError(message) {
  const err = document.querySelector('[data-pg-error]')
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
git commit -m "feat: add Playground response render helpers"
```

---

### Task 5: `index.html` dialog markup + `style.css` styling

**Files:**
- Modify: `index.html` (add `<dialog>` before the closing `</div>` of `.app`, i.e. after the `<footer>`)
- Modify: `src/style.css` (append Playground styles)

No automated test — verified manually in Task 6.

- [ ] **Step 1: Add the dialog markup**

In `index.html`, insert this block immediately after the `</footer>` line and before `</div>` (the `.app` close):

```html
    <dialog class="playground" data-playground>
      <form method="dialog" class="playground-head">
        <span class="playground-title">▶ Prompt Playground</span>
        <button class="playground-close" data-pg-close aria-label="Close">✕</button>
      </form>

      <label class="playground-label">System prompt</label>
      <textarea class="playground-input" data-pg-system rows="2" placeholder="You are a helpful assistant."></textarea>

      <div class="playground-params">
        <label>Temperature <input type="number" step="0.1" min="0" class="playground-num" data-pg-temp /></label>
        <label>Top-K <input type="number" step="1" min="1" class="playground-num" data-pg-topk /></label>
      </div>

      <label class="playground-label">Prompt</label>
      <textarea class="playground-input" data-pg-prompt rows="4" placeholder="Ask anything..."></textarea>

      <div class="playground-actions">
        <button class="btn btn-primary" data-pg-run>▶ Run</button>
      </div>

      <div class="section-label">── Response ──</div>
      <div class="playground-response" data-pg-response></div>
      <div class="pair-error" data-pg-error hidden></div>
    </dialog>
```

- [ ] **Step 2: Add the styles**

Append to `src/style.css`:

```css
/* Inline Playground button (on the LanguageModel status row) */
.btn-playground {
  margin-left: 10px;
  padding: 1px 8px;
  background: transparent;
  border: 1px solid var(--ok);
  color: var(--ok);
  font-family: var(--font-mono);
  font-size: 12px;
  border-radius: 3px;
  cursor: pointer;
}
.btn-playground:hover { background: var(--ok); color: var(--bg); }

/* Playground modal */
.playground {
  width: min(680px, 92vw);
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 20px;
  font-family: var(--font-mono);
}
.playground::backdrop { background: rgba(0, 0, 0, 0.7); }
.playground-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
  padding-bottom: 10px;
  margin-bottom: 14px;
}
.playground-title { font-size: 18px; font-weight: 700; color: var(--info); }
.playground-close {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 14px;
  border-radius: 3px;
  cursor: pointer;
  padding: 2px 8px;
}
.playground-close:hover { border-color: var(--err); color: var(--err); }
.playground-label {
  display: block;
  font-size: 13px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 10px 0 4px;
}
.playground-input {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 16px;
  border-radius: 3px;
  padding: 8px 10px;
  resize: vertical;
}
.playground-input:focus { outline: none; border-color: var(--info); }
.playground-params {
  display: flex;
  gap: 20px;
  margin: 10px 0;
  font-size: 14px;
  color: var(--muted);
}
.playground-num {
  width: 70px;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 15px;
  border-radius: 3px;
  padding: 4px 8px;
  text-align: center;
}
.playground-num:focus { outline: none; border-color: var(--info); }
.playground-actions {
  display: flex;
  justify-content: flex-end;
  margin: 14px 0;
}
.playground-response {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 10px 12px;
  min-height: 80px;
  max-height: 280px;
  overflow-y: auto;
  font-size: 16px;
  white-space: pre-wrap;
  word-break: break-word;
}
```

- [ ] **Step 3: Verify the build succeeds**

Run: `npm run build`
Expected: build completes with no errors; `dist/` is produced.

- [ ] **Step 4: Commit**

```bash
git add index.html src/style.css
git commit -m "feat: add Prompt Playground dialog markup and styles"
```

---

### Task 6: `main.js` — wire open / run / stop / close

**Files:**
- Modify: `src/main.js`

No automated test (DOM wiring / integration). Verified by running the dev server.

**Interfaces:**
- Consumes: `getParams`, `runPrompt` from `playground.js`; `showPlaygroundButton`, `clearPlaygroundResponse`, `appendPlaygroundResponse`, `showPlaygroundError` from `ui.js`; dialog data attributes from Task 5.
- Produces: no exports; sets up event wiring inside `init()` and shows the button at the end of `runCheck()`.

- [ ] **Step 1: Extend the imports**

In `src/main.js`, change the `./checker.js`/`./ui.js` import blocks and add the playground import.

Add after the existing `import { loadPairs, savePairs } from './storage.js'` line:

```js
import { getParams, runPrompt } from './playground.js'
```

Extend the `./ui.js` import block to also import the new helpers:

```js
import {
  renderApiRow,
  renderPairRow,
  renderProgress,
  appendLog,
  setDownloadAllButton,
  showPairError,
  clearPairError,
  showPlaygroundButton,
  clearPlaygroundResponse,
  appendPlaygroundResponse,
  showPlaygroundError,
} from './ui.js'
```

- [ ] **Step 2: Add the Playground controller logic**

Add this block above `function init()` in `src/main.js`:

```js
let pgController = null

function setPlaygroundRunning(running) {
  const btn = document.querySelector('[data-pg-run]')
  if (btn) btn.textContent = running ? '⏹ Stop' : '▶ Run'
}

async function openPlayground() {
  const dialog = document.querySelector('[data-playground]')
  if (!dialog) return
  try {
    const p = await getParams()
    document.querySelector('[data-pg-temp]').value = p.defaultTemperature
    document.querySelector('[data-pg-topk]').value = p.defaultTopK
  } catch {
    // Leave inputs at their current values if params() is unavailable.
  }
  clearPlaygroundResponse()
  dialog.showModal()
}

async function runPlayground() {
  const systemPrompt = document.querySelector('[data-pg-system]').value.trim()
  const prompt = document.querySelector('[data-pg-prompt]').value.trim()
  if (!prompt) { showPlaygroundError('Enter a prompt first'); return }

  const tempVal = parseFloat(document.querySelector('[data-pg-temp]').value)
  const topKVal = parseInt(document.querySelector('[data-pg-topk]').value, 10)

  clearPlaygroundResponse()
  pgController = new AbortController()
  setPlaygroundRunning(true)
  try {
    await runPrompt({
      systemPrompt,
      temperature: Number.isNaN(tempVal) ? null : tempVal,
      topK: Number.isNaN(topKVal) ? null : topKVal,
      prompt,
      signal: pgController.signal,
      onChunk: appendPlaygroundResponse,
    })
  } catch (err) {
    showPlaygroundError(err.message)
  } finally {
    setPlaygroundRunning(false)
    pgController = null
  }
}
```

- [ ] **Step 3: Wire the events in `init()`**

Add these inside `init()`, after the existing `[data-pair-tgt]` keydown listener and before the final `runCheck()` call:

```js
  // Open the Playground from the inline button (delegated — button is dynamic).
  document.querySelector('[data-status-list]')?.addEventListener('click', (e) => {
    if (e.target.closest('[data-btn-playground]')) openPlayground()
  })

  // Run button doubles as Stop while a request is in flight.
  document.querySelector('[data-pg-run]')?.addEventListener('click', () => {
    if (pgController) pgController.abort()
    else runPlayground()
  })

  // Closing the dialog (✕ or Esc) aborts any in-flight request.
  document.querySelector('[data-playground]')?.addEventListener('close', () => {
    if (pgController) pgController.abort()
  })
```

- [ ] **Step 4: Show the button when LanguageModel is available**

In `runCheck()`, immediately after the `for (const api of state.apis) { ... }` loop, add:

```js
  if (state.apis.find(a => a.id === 'LanguageModel')?.status === 'available') {
    showPlaygroundButton()
  }
```

- [ ] **Step 5: Verify the full test suite still passes**

Run: `npm test`
Expected: PASS — all existing and new tests green.

- [ ] **Step 6: Manual verification in the dev server**

Run: `npm run dev`
Then in Chrome (with Prompt API available, status `available`):
- Confirm `▶ Playground` appears on the Prompt (LanguageModel) row.
- Click it → modal opens with Temperature / Top-K prefilled.
- Enter a prompt, click `▶ Run` → response streams in; button shows `⏹ Stop`.
- Click `⏹ Stop` mid-stream → streaming halts, button returns to `▶ Run`.
- Press `Esc` / `✕` → modal closes.
- Force an error (e.g. empty prompt) → inline red error shows.

- [ ] **Step 7: Commit**

```bash
git add src/main.js
git commit -m "feat: wire Prompt Playground open/run/stop/close flow"
```

---

## Notes for the Implementer

- **Prompt API streaming semantics:** `session.promptStreaming()` yields incremental
  text deltas in the current Chrome spec. `runPrompt` concatenates them; the UI appends
  (never replaces). If a Chrome build returns cumulative chunks instead, the response
  would visibly duplicate — flag it rather than papering over it.
- **temperature + topK pairing:** the Prompt API requires both or neither. The UI always
  prefills both, and `runPrompt` only sets them when both are non-null.
- **Button injection vs. re-render:** `renderApiRow` rewrites the row's `innerHTML`, which
  would wipe an injected button. `showPlaygroundButton()` is therefore called *after*
  `runCheck()` finishes rendering — never before. If a future change re-renders rows after
  showing the button, re-call `showPlaygroundButton()`.
