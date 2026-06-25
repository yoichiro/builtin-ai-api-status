# Language Detector Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a modal Playground for trying the Language Detector API (`LanguageDetector`) with live, debounced detection, shown only when its availability is `available`.

**Architecture:** A new pure-logic module `detector.js` wraps the Language Detector API (`createDetector`, `detectLanguages`). The existing `showPlaygroundButton()` is generalized to take a row id so both playgrounds share one button injector and one delegated click handler. A native `<dialog>` in `index.html` holds the UI; `ui.js` gains result-render helpers; `main.js` wires open → debounced input → detect → render → close. Follows the Prompt Playground's logic / DOM / test separation.

**Tech Stack:** Vanilla JS (ES modules), Vite, Vitest + jsdom, native `<dialog>`, `Intl.DisplayNames`, Chrome Language Detector API (`LanguageDetector`).

## Global Constraints

- Code comments in English only.
- Git commit messages: one line, English, conventional-commit style (`feat:`, `refactor:`, `test:`).
- No new runtime dependencies (vanilla JS only).
- Tests use Vitest globals (`describe`/`it`/`expect`/`vi`/`beforeEach`/`afterEach`) — NOT imported; vitest config has `globals: true`.
- Run a single test file with: `npx vitest run <path>`. Run all with: `npm test`.
- The Prompt Playground (already shipped) established the `.playground` / `.playground-*` CSS classes and the `<dialog>` pattern — reuse them; do not restyle them.

---

### Task 1: `detector.js` — `createDetector()` + `detectLanguages()`

**Files:**
- Create: `src/detector.js`
- Test: `src/detector.test.js`

**Interfaces:**
- Consumes: global `LanguageDetector.create(options)` → detector session; `session.detect(text)` → `Array<{ detectedLanguage, confidence }>` sorted by confidence descending.
- Produces:
  - `export async function createDetector(options = {}): Promise<Detector>`
  - `export async function detectLanguages(detector, text, { max = 5 } = {}): Promise<Array<{ language: string, confidence: number }>>`

- [ ] **Step 1: Write the failing test**

Create `src/detector.test.js`:

```js
import { createDetector, detectLanguages } from './detector.js'

describe('createDetector', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the session from LanguageDetector.create()', async () => {
    const session = { detect: async () => [] }
    const create = vi.fn(async () => session)
    vi.stubGlobal('LanguageDetector', { create })
    const detector = await createDetector()
    expect(detector).toBe(session)
    expect(create).toHaveBeenCalled()
  })
})

describe('detectLanguages', () => {
  it('maps detectedLanguage to language and passes confidence through', async () => {
    const detector = {
      detect: async () => [
        { detectedLanguage: 'fr', confidence: 0.82 },
        { detectedLanguage: 'en', confidence: 0.12 },
      ],
    }
    const out = await detectLanguages(detector, 'bonjour')
    expect(out).toEqual([
      { language: 'fr', confidence: 0.82 },
      { language: 'en', confidence: 0.12 },
    ])
  })

  it('returns at most max entries (default 5)', async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ detectedLanguage: `l${i}`, confidence: 1 - i * 0.1 }))
    const detector = { detect: async () => many }
    const out = await detectLanguages(detector, 'x')
    expect(out.length).toBe(5)
    expect(out[0]).toEqual({ language: 'l0', confidence: 1 })
  })

  it('respects a custom max', async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ detectedLanguage: `l${i}`, confidence: 0.5 }))
    const detector = { detect: async () => many }
    const out = await detectLanguages(detector, 'x', { max: 2 })
    expect(out.length).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/detector.test.js`
Expected: FAIL — cannot resolve `./detector.js` / functions not defined.

- [ ] **Step 3: Write minimal implementation**

Create `src/detector.js`:

```js
// Create a detector session. The button only appears when availability is
// 'available', so no model download is expected here.
export async function createDetector(options = {}) {
  return await LanguageDetector.create(options)
}

// Detect languages in text and return the top `max` results normalized to
// { language, confidence }. detector.detect() returns results already sorted
// by confidence in descending order.
export async function detectLanguages(detector, text, { max = 5 } = {}) {
  const results = await detector.detect(text)
  return results.slice(0, max).map(r => ({
    language: r.detectedLanguage,
    confidence: r.confidence,
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/detector.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/detector.js src/detector.test.js
git commit -m "feat: add Language Detector wrapper (createDetector, detectLanguages)"
```

---

### Task 2: Generalize `showPlaygroundButton(rowId)`

**Files:**
- Modify: `src/ui.js` (the existing `showPlaygroundButton` function)
- Modify: `src/ui.test.js` (the existing `showPlaygroundButton` describe block)
- Modify: `src/main.js` (the call site at the LanguageModel check, and the delegated click handler)

**Interfaces:**
- Produces: `export function showPlaygroundButton(rowId): void` — inserts a `<button class="btn-playground" data-playground-for="<rowId>">▶ Playground</button>` into that row's `.status-name`, idempotently.
- Consumes (main.js): existing `openPlayground()` controller function (unchanged).

This refactor changes the existing Prompt button's attribute from `data-btn-playground` to `class="btn-playground"` + `data-playground-for="LanguageModel"`, so the existing tests and the main.js handler are updated in lockstep.

- [ ] **Step 1: Update the failing tests**

In `src/ui.test.js`, REPLACE the entire existing `describe('showPlaygroundButton', ...)` block with:

```js
describe('showPlaygroundButton', () => {
  beforeEach(setupDOM)

  it('inserts a playground button with data-playground-for into the row', () => {
    renderApiRow('LanguageModel', 'Prompt (LanguageModel)', 'available')
    showPlaygroundButton('LanguageModel')
    const btn = document.querySelector('[data-row-id="LanguageModel"] .btn-playground')
    expect(btn).not.toBeNull()
    expect(btn.dataset.playgroundFor).toBe('LanguageModel')
    expect(btn.textContent).toContain('Playground')
  })

  it('does not duplicate the button on repeated calls', () => {
    renderApiRow('LanguageDetector', 'Language Detector', 'available')
    showPlaygroundButton('LanguageDetector')
    showPlaygroundButton('LanguageDetector')
    const btns = document.querySelectorAll('[data-row-id="LanguageDetector"] .btn-playground')
    expect(btns.length).toBe(1)
  })

  it('does nothing when the row is absent', () => {
    expect(() => showPlaygroundButton('LanguageModel')).not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui.test.js`
Expected: FAIL — old `showPlaygroundButton()` ignores the argument and still emits `data-btn-playground`, so `.btn-playground` / `data-playground-for` assertions fail.

- [ ] **Step 3: Update the implementation**

In `src/ui.js`, REPLACE the existing `showPlaygroundButton` function with:

```js
export function showPlaygroundButton(rowId) {
  const row = document.querySelector(`[data-status-list] [data-row-id="${rowId}"]`)
  if (!row) return
  const name = row.querySelector('.status-name')
  if (!name || name.querySelector('.btn-playground')) return
  const btn = document.createElement('button')
  btn.className = 'btn-playground'
  btn.dataset.playgroundFor = rowId
  btn.textContent = '▶ Playground'
  name.appendChild(btn)
}
```

- [ ] **Step 4: Update the main.js call site and click handler**

In `src/main.js`, change the LanguageModel check (currently `showPlaygroundButton()`):

```js
  if (state.apis.find(a => a.id === 'LanguageModel')?.status === 'available') {
    showPlaygroundButton('LanguageModel')
  }
```

And REPLACE the existing delegated click handler:

```js
  // Open a Playground from its inline button (delegated — buttons are dynamic).
  document.querySelector('[data-status-list]')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-playground')
    if (!btn) return
    if (btn.dataset.playgroundFor === 'LanguageModel') openPlayground()
  })
```

- [ ] **Step 5: Run the full suite and build**

Run: `npm test`
Expected: PASS — 64 tests (60 prior + 4 from Task 1; button tests unchanged in count).

Run: `npm run build`
Expected: build succeeds, `dist/` produced.

- [ ] **Step 6: Commit**

```bash
git add src/ui.js src/ui.test.js src/main.js
git commit -m "refactor: generalize showPlaygroundButton to accept a row id"
```

---

### Task 3: `ui.js` — Language Detector result render helpers

**Files:**
- Modify: `src/ui.js`
- Test: `src/ui.test.js`

**Interfaces:**
- Consumes: dialog elements `[data-ld-results]` and `[data-ld-error]` (created in Task 4; tests inject their own fixtures).
- Produces:
  - `export function renderDetectorResults(results: Array<{ language, confidence }>): void` — repaints `[data-ld-results]` with one `.detector-row` per result (confidence bar `.detector-fill`, code `.detector-code`, name `.detector-name`, percentage `.detector-pct`).
  - `export function clearDetectorResults(): void` — empties results and hides + clears `[data-ld-error]`.
  - `export function showDetectorError(message: string): void` — reveals `[data-ld-error]` with the message.

- [ ] **Step 1: Write the failing test**

Append to `src/ui.test.js`:

```js
describe('detector result helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div data-ld-results></div>
      <div data-ld-error hidden></div>
    `
  })

  it('renders one row per result with code and percentage', () => {
    renderDetectorResults([
      { language: 'fr', confidence: 0.82 },
      { language: 'en', confidence: 0.09 },
    ])
    const rows = document.querySelectorAll('[data-ld-results] .detector-row')
    expect(rows.length).toBe(2)
    expect(rows[0].textContent).toContain('fr')
    expect(rows[0].textContent).toContain('82%')
  })

  it('sizes the confidence bar fill to the percentage', () => {
    renderDetectorResults([{ language: 'fr', confidence: 0.82 }])
    const fill = document.querySelector('[data-ld-results] .detector-fill')
    expect(fill).not.toBeNull()
    expect(fill.style.width).toBe('82%')
  })

  it('clearDetectorResults empties results and hides the error', () => {
    renderDetectorResults([{ language: 'fr', confidence: 0.82 }])
    showDetectorError('boom')
    clearDetectorResults()
    expect(document.querySelector('[data-ld-results]').textContent).toBe('')
    const err = document.querySelector('[data-ld-error]')
    expect(err.hidden).toBe(true)
    expect(err.textContent).toBe('')
  })

  it('showDetectorError reveals the error message', () => {
    showDetectorError('Detection failed')
    const err = document.querySelector('[data-ld-error]')
    expect(err.hidden).toBe(false)
    expect(err.textContent).toBe('Detection failed')
  })
})
```

Add `renderDetectorResults`, `clearDetectorResults`, `showDetectorError` to the top import block in `src/ui.test.js` (the existing `import { ... } from './ui.js'`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui.test.js`
Expected: FAIL — the three helpers are not defined.

- [ ] **Step 3: Write minimal implementation**

Append to `src/ui.js`:

```js
const LANGUAGE_NAMES = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' })
  } catch {
    return null
  }
})()

function languageName(code) {
  if (code === 'und') return 'Unknown'
  try {
    return LANGUAGE_NAMES?.of(code) ?? code
  } catch {
    return code
  }
}

export function renderDetectorResults(results) {
  const container = document.querySelector('[data-ld-results]')
  if (!container) return
  container.innerHTML = ''
  for (const { language, confidence } of results) {
    const pct = Math.round(confidence * 100)
    const row = document.createElement('div')
    row.className = 'detector-row'
    row.innerHTML = `
      <div class="detector-bar"><div class="detector-fill" style="width:${pct}%"></div></div>
      <span class="detector-code">${language}</span>
      <span class="detector-name">${languageName(language)}</span>
      <span class="detector-pct">${pct}%</span>
    `
    container.appendChild(row)
  }
}

export function clearDetectorResults() {
  const res = document.querySelector('[data-ld-results]')
  if (res) res.innerHTML = ''
  const err = document.querySelector('[data-ld-error]')
  if (err) { err.hidden = true; err.textContent = '' }
}

export function showDetectorError(message) {
  const err = document.querySelector('[data-ld-error]')
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
git commit -m "feat: add Language Detector result render helpers"
```

---

### Task 4: `index.html` dialog markup + `style.css` styling

**Files:**
- Modify: `index.html` (add a second `<dialog>` after the existing Prompt Playground `</dialog>`, still inside `.app`)
- Modify: `src/style.css` (append detector result styles)

No automated test — verified by build and Task 5's manual check.

- [ ] **Step 1: Add the dialog markup**

In `index.html`, the Prompt Playground `<dialog ... data-playground>...</dialog>` already sits before the `</div>` that closes `.app`. Insert this block IMMEDIATELY AFTER that Prompt dialog's closing `</dialog>` and BEFORE the `.app` closing `</div>`:

```html
    <dialog class="playground" data-ld-playground>
      <form method="dialog" class="playground-head">
        <span class="playground-title">▶ Language Detector Playground</span>
        <button class="playground-close" data-ld-close aria-label="Close">✕</button>
      </form>

      <label class="playground-label">Text</label>
      <textarea class="playground-input" data-ld-input rows="4" placeholder="Type text to detect its language..."></textarea>

      <div class="section-label">── Detected languages ──</div>
      <div class="detector-results" data-ld-results></div>
      <div class="pair-error" data-ld-error hidden></div>
    </dialog>
```

- [ ] **Step 2: Add the styles**

Append to `src/style.css`:

```css
/* Language Detector results */
.detector-results {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.detector-row {
  display: grid;
  grid-template-columns: 1fr 48px max-content 56px;
  align-items: center;
  gap: 10px;
  font-size: 15px;
}
.detector-bar {
  height: 8px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}
.detector-fill {
  height: 100%;
  background: var(--ok);
  border-radius: 2px;
  transition: width 0.2s ease;
}
.detector-code { color: var(--info); font-weight: 700; }
.detector-name { color: var(--text); white-space: nowrap; }
.detector-pct {
  color: var(--muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: Verify the build succeeds**

Run: `npm run build`
Expected: build completes with no errors; `dist/` is produced.

- [ ] **Step 4: Commit**

```bash
git add index.html src/style.css
git commit -m "feat: add Language Detector Playground dialog markup and styles"
```

---

### Task 5: `main.js` — wire open / debounced detect / close

**Files:**
- Modify: `src/main.js`

No automated test (DOM / integration / debounce). Verified by the full suite staying green + a successful build.

**Interfaces:**
- Consumes: `createDetector`, `detectLanguages` from `detector.js`; `renderDetectorResults`, `clearDetectorResults`, `showDetectorError` from `ui.js`; the generalized delegated click handler from Task 2; dialog data attributes from Task 4.
- Produces: no exports; adds a detector controller, listeners in `init()`, and a `showPlaygroundButton('LanguageDetector')` call in `runCheck()`.

- [ ] **Step 1: Extend the imports**

In `src/main.js`, add after the existing `import { getParams, runPrompt } from './playground.js'` line:

```js
import { createDetector, detectLanguages } from './detector.js'
```

Extend the existing `./ui.js` import block to also import the three detector helpers (add these names to the destructured list):

```js
  renderDetectorResults,
  clearDetectorResults,
  showDetectorError,
```

- [ ] **Step 2: Add the detector controller block**

Add this block above `function init()` in `src/main.js` (after the existing Prompt Playground controller functions):

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

- [ ] **Step 3: Route the delegated click handler to the detector**

In `src/main.js`, REPLACE the delegated click handler (from Task 2) so it also opens the detector playground:

```js
  // Open a Playground from its inline button (delegated — buttons are dynamic).
  document.querySelector('[data-status-list]')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-playground')
    if (!btn) return
    if (btn.dataset.playgroundFor === 'LanguageModel') openPlayground()
    else if (btn.dataset.playgroundFor === 'LanguageDetector') openDetectorPlayground()
  })
```

- [ ] **Step 4: Wire the detector input + close listeners**

In `src/main.js`, add these inside `init()`, after the existing Prompt dialog `close` listener (the one that aborts `pgController`):

```js
  // Language Detector: debounce input → detect → render.
  document.querySelector('[data-ld-input]')?.addEventListener('input', onDetectorInput)

  // Closing the detector dialog cancels pending detection and frees the session.
  document.querySelector('[data-ld-playground]')?.addEventListener('close', () => {
    clearTimeout(ldDebounceId)
    ldDetector?.destroy()
    ldDetector = null
  })
```

- [ ] **Step 5: Show the button when LanguageDetector is available**

In `runCheck()`, immediately after the existing LanguageModel block (`if (state.apis.find(a => a.id === 'LanguageModel')...) { showPlaygroundButton('LanguageModel') }`), add:

```js
  if (state.apis.find(a => a.id === 'LanguageDetector')?.status === 'available') {
    showPlaygroundButton('LanguageDetector')
  }
```

- [ ] **Step 6: Verify the full suite + build**

Run: `npm test`
Expected: PASS — 68 tests (64 after Task 2 + 4 detector ui helpers from Task 3).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Manual verification in the dev server**

Run: `npm run dev`
Then in Chrome (with the Language Detector API available, status `available`):
- Confirm `▶ Playground` appears on the Language Detector row.
- Click it → modal opens with an empty text box and no results.
- Type text (e.g. "Bonjour le monde") → after a short pause, detected languages appear with bars, codes, names, and percentages.
- Clear the text → results disappear.
- Press `Esc` / `✕` → modal closes.
- Confirm the Prompt Playground button still opens its own dialog (regression check on the generalized button).

- [ ] **Step 8: Commit**

```bash
git add src/main.js
git commit -m "feat: wire Language Detector Playground open/detect/close flow"
```

---

## Notes for the Implementer

- **`detect()` ordering:** the Language Detector API returns results already sorted by
  confidence descending, so `detectLanguages` does not re-sort — it only slices and maps.
- **`Intl.DisplayNames`:** used for human-readable names. It is constructed once at module
  load and guarded with try/catch; unknown codes fall back to the raw code, and `und` maps
  to "Unknown". Node (vitest/jsdom) supports `Intl.DisplayNames`, so the render tests run
  fine, but they assert the code + percentage + bar width (not the localized name text) to
  avoid ICU-version variance.
- **Generalized button (Task 2) is a refactor with a behavior-preserving contract:** the
  Prompt Playground must keep working. Task 5's manual check includes a regression check
  that the Prompt button still opens its dialog.
- **Session reuse:** the detector session is created once per dialog opening and reused for
  every keystroke; it is destroyed on `close`. Do not create a session per detect call.
- **Button injection vs re-render:** `renderApiRow` rewrites a row's innerHTML, wiping an
  injected button, so `showPlaygroundButton(rowId)` is called after `runCheck()` renders —
  never before. Its `.btn-playground` guard keeps re-checks idempotent.
