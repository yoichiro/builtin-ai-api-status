# Built-in AI API Status Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vite-based vanilla JS web app that checks Chrome/Edge Built-in AI API availability and triggers model downloads, displayed in a terminal-style dark UI.

**Architecture:** Four source modules (`checker.js`, `ui.js`, `main.js`, `style.css`) with `index.html` as the entry point. `checker.js` owns all API interaction; `ui.js` owns all DOM mutation; `main.js` wires events between them.

**Tech Stack:** Vite 5, Vanilla HTML/CSS/JS (ES Modules), Vitest (unit tests), Firebase Hosting

## Global Constraints

- No framework or UI library — vanilla HTML/CSS/JS only
- ES Module syntax (`import`/`export`) throughout
- Target APIs: `LanguageDetector`, `Translator`, `Summarizer`, `LanguageModel`
- Canonical status values: `'available'`, `'downloadable'`, `'downloading'`, `'unavailable'`, `'unsupported'` (unsupported = browser global missing)
- Default Translator pairs on load: `en→ja`, `ja→en`
- BCP 47 pair validation regex: `/^[a-z]{2,3}(-[A-Z]{2,4})?$/`
- CSS design tokens: `--bg:#0d1117`, `--surface:#161b22`, `--border:#30363d`, `--text:#e6edf3`, `--muted:#484f58`, `--ok:#3fb950`, `--warn:#d29922`, `--info:#58a6ff`, `--err:#f85149`
- Font: `'Courier New', Consolas, monospace` throughout

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `firebase.json`
- Create: `.firebaserc`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm test` commands; Firebase deploy target `dist/`

- [ ] **Step 1: Initialize project and install dev dependencies**

```bash
npm init -y
npm install -D vite vitest jsdom
```

- [ ] **Step 2: Create vite.config.js**

```js
import { defineConfig } from 'vite'

export default defineConfig({
  build: { outDir: 'dist' },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 3: Update package.json scripts and set module type**

Edit `package.json` — replace the `"scripts"` block and add `"type"`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Create firebase.json**

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

- [ ] **Step 5: Create .firebaserc**

```json
{
  "projects": {
    "default": "YOUR_FIREBASE_PROJECT_ID"
  }
}
```

Replace `YOUR_FIREBASE_PROJECT_ID` with the actual project ID from Firebase console.

- [ ] **Step 6: Verify Vite is installed correctly**

```bash
npm run build
```

Expected: build fails with "Could not resolve entry module 'index.html'" — this confirms Vite is installed but `index.html` doesn't exist yet. That's correct at this stage.

- [ ] **Step 7: Commit**

```bash
git init
git add package.json package-lock.json vite.config.js firebase.json .firebaserc
git commit -m "chore: scaffold Vite project with Vitest and Firebase config"
```

---

### Task 2: CSS Design System

**Files:**
- Create: `src/style.css`

**Interfaces:**
- Produces: CSS custom properties and class names consumed by all HTML/JS:
  - Status classes: `status-ok`, `status-warn`, `status-info`, `status-err`, `status-na`
  - Layout classes: `app`, `app-header`, `controls`, `section`, `status-list`, `status-row`, `progress-row`, `pair-list`, `pair-form`, `log-list`, `log-entry`
  - Button modifier classes: `btn-primary`, `btn-done`
  - Log type classes: `log-ok`, `log-warn`, `log-info`, `log-err`, `log-muted`

- [ ] **Step 1: Create src/style.css**

```css
/* Design tokens */
:root {
  --bg:        #0d1117;
  --surface:   #161b22;
  --border:    #30363d;
  --text:      #e6edf3;
  --muted:     #484f58;
  --ok:        #3fb950;
  --warn:      #d29922;
  --info:      #58a6ff;
  --err:       #f85149;
  --font-mono: 'Courier New', Consolas, monospace;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  min-height: 100vh;
  padding: 24px;
}

/* Layout */
.app {
  max-width: 780px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

/* Header */
.app-header {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}
.app-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}
.app-title span { color: var(--info); }
.app-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
}
.app-chrome-ver {
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
}

/* Controls bar */
.controls {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.btn {
  padding: 5px 14px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.btn:hover:not(:disabled) {
  border-color: var(--info);
  color: var(--info);
}
.btn:disabled {
  color: var(--muted);
  border-color: var(--border);
  cursor: not-allowed;
}
.btn-primary {
  border-color: var(--info);
  color: var(--info);
}
.btn-primary:hover:not(:disabled) {
  background: var(--info);
  color: var(--bg);
}
.btn-done {
  border-color: var(--ok);
  color: var(--ok);
}

/* Section */
.section { margin-bottom: 24px; }
.section-label {
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}

/* Status rows */
.status-list,
.pair-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-row {
  display: grid;
  grid-template-columns: 64px 40px 200px 1fr;
  align-items: baseline;
  gap: 8px;
  padding: 4px 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-size: 12px;
}
.status-row.is-na { opacity: 0.4; }
.status-ts  { color: var(--muted); font-size: 10px; font-variant-numeric: tabular-nums; }
.status-tag { font-weight: 700; font-size: 11px; }
.status-name { color: var(--text); }
.status-val  { color: var(--muted); }

.status-ok   .status-tag, .status-ok   .status-val { color: var(--ok); }
.status-warn .status-tag, .status-warn .status-val { color: var(--warn); }
.status-info .status-tag, .status-info .status-val { color: var(--info); }
.status-err  .status-tag, .status-err  .status-val { color: var(--err); }
.status-na   .status-tag, .status-na   .status-val { color: var(--muted); }

/* Downloading animation */
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}
.status-info .status-tag { animation: blink 1.2s ease-in-out infinite; }

/* Progress bar */
.progress-row {
  display: grid;
  grid-template-columns: 64px 40px 1fr 72px;
  align-items: center;
  gap: 8px;
  padding: 2px 8px;
}
.progress-bar {
  height: 3px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--info);
  border-radius: 2px;
  transition: width 0.3s ease;
}
.progress-label {
  color: var(--info);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

/* Translator pairs */
.pair-form {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}
.pair-input {
  width: 64px;
  padding: 4px 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 12px;
  border-radius: 3px;
  text-align: center;
}
.pair-input:focus {
  outline: none;
  border-color: var(--info);
}
.pair-arrow { color: var(--muted); }
.pair-error {
  color: var(--err);
  font-size: 11px;
  margin-top: 6px;
}

/* Log */
.log-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 200px;
  overflow-y: auto;
}
.log-entry {
  font-size: 11px;
  padding: 2px 0;
  display: flex;
  gap: 6px;
  color: var(--muted);
}
.log-entry .log-icon { flex-shrink: 0; }
.log-ok   { color: var(--ok); }
.log-warn { color: var(--warn); }
.log-info { color: var(--info); }
.log-err  { color: var(--err); }
```

- [ ] **Step 2: Commit**

```bash
git add src/style.css
git commit -m "feat: add terminal-style CSS design system"
```

---

### Task 3: HTML Structure

**Files:**
- Create: `index.html`

**Interfaces:**
- Produces: DOM skeleton with `data-*` attribute hooks consumed by `ui.js` and `main.js`:
  - `[data-chrome-ver]` — browser version text
  - `[data-btn-check]` — Check Status button
  - `[data-btn-download]` — Download All button
  - `[data-status-list]` — API status rows container
  - `[data-pair-list]` — Translator pair rows container
  - `[data-pair-src]`, `[data-pair-tgt]` — pair language inputs
  - `[data-btn-add-pair]` — Add pair button
  - `[data-pair-error]` — validation error message
  - `[data-log]` — log entries container

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Built-in AI API Status</title>
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <div class="app">

    <header class="app-header">
      <div class="app-title">built-in-ai-api-<span>status</span></div>
      <div class="app-subtitle">ブラウザの組み込みAI機能が使えるか確認・ダウンロードします</div>
      <div class="app-chrome-ver" data-chrome-ver>checking browser...</div>
    </header>

    <div class="controls">
      <button class="btn btn-primary" data-btn-check>▶ Check Status</button>
      <button class="btn" data-btn-download disabled>↓ Download All</button>
    </div>

    <section class="section">
      <div class="section-label">── Status ──</div>
      <div class="status-list" data-status-list></div>
    </section>

    <section class="section">
      <div class="section-label">── Translator Pairs ──</div>
      <div class="pair-list" data-pair-list></div>
      <div class="pair-form">
        <input class="pair-input" data-pair-src placeholder="en" maxlength="10" />
        <span class="pair-arrow">→</span>
        <input class="pair-input" data-pair-tgt placeholder="ja" maxlength="10" />
        <button class="btn" data-btn-add-pair>+ Add</button>
      </div>
      <div class="pair-error" data-pair-error hidden></div>
    </section>

    <section class="section">
      <div class="section-label">── Log ──</div>
      <div class="log-list" data-log></div>
    </section>

  </div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create a temporary src/main.js to verify the page renders**

```js
// src/main.js — temporary stub
console.log('app loaded')
```

- [ ] **Step 3: Start dev server and verify the HTML renders**

```bash
npm run dev
```

Open `http://localhost:5173`. Expected: dark terminal-themed page with header, two buttons, three section labels, and empty content areas. Console shows "app loaded". No JS errors.

- [ ] **Step 4: Commit**

```bash
git add index.html src/main.js
git commit -m "feat: add HTML structure with data-attribute hooks"
```

---

### Task 4: checker.js — Status Normalization & API Detection

**Files:**
- Create: `src/checker.js`
- Create: `src/checker.test.js`

**Interfaces:**
- Produces:
  - `normalizeStatus(raw: string): 'available'|'downloadable'|'downloading'|'unavailable'`
  - `isApiSupported(globalName: string): boolean`

- [ ] **Step 1: Write failing tests**

Create `src/checker.test.js`:

```js
import { normalizeStatus, isApiSupported } from './checker.js'

describe('normalizeStatus', () => {
  it('passes through canonical values unchanged', () => {
    expect(normalizeStatus('available')).toBe('available')
    expect(normalizeStatus('downloadable')).toBe('downloadable')
    expect(normalizeStatus('downloading')).toBe('downloading')
    expect(normalizeStatus('unavailable')).toBe('unavailable')
  })

  it('maps legacy "readily" to "available"', () => {
    expect(normalizeStatus('readily')).toBe('available')
  })

  it('maps legacy "after-download" to "downloadable"', () => {
    expect(normalizeStatus('after-download')).toBe('downloadable')
  })

  it('maps legacy "unsupported" to "unavailable"', () => {
    expect(normalizeStatus('unsupported')).toBe('unavailable')
  })

  it('maps unknown values to "unavailable"', () => {
    expect(normalizeStatus('something-new')).toBe('unavailable')
  })
})

describe('isApiSupported', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns true when the global exists on self', () => {
    vi.stubGlobal('LanguageDetector', {})
    expect(isApiSupported('LanguageDetector')).toBe(true)
  })

  it('returns false when the global is missing', () => {
    expect(isApiSupported('LanguageDetector')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — "Cannot find module './checker.js'"

- [ ] **Step 3: Implement normalizeStatus and isApiSupported**

Create `src/checker.js`:

```js
const STATUS_MAP = {
  available:      'available',
  downloadable:   'downloadable',
  downloading:    'downloading',
  unavailable:    'unavailable',
  readily:        'available',
  'after-download': 'downloadable',
  unsupported:    'unavailable',
}

export function normalizeStatus(raw) {
  return STATUS_MAP[raw] ?? 'unavailable'
}

export function isApiSupported(globalName) {
  return globalName in self
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — 7 passing tests

- [ ] **Step 5: Commit**

```bash
git add src/checker.js src/checker.test.js
git commit -m "feat: add normalizeStatus and isApiSupported to checker"
```

---

### Task 5: checker.js — Translator Pair Validation

**Files:**
- Modify: `src/checker.js`
- Modify: `src/checker.test.js`

**Interfaces:**
- Consumes: `src/checker.js` (existing exports)
- Produces:
  - `validatePair(src: string, tgt: string, existingPairs: Array<{src: string, tgt: string}>): { valid: boolean, error?: string }`

- [ ] **Step 1: Write failing tests**

Update the import at the top of `src/checker.test.js` to include `validatePair`, then append the new test suite:

```js
// Update existing import line to:
import { normalizeStatus, isApiSupported, validatePair } from './checker.js'
```

Append below the existing tests:

```js
describe('validatePair', () => {
  const existing = [{ src: 'en', tgt: 'ja' }]

  it('accepts a valid new pair', () => {
    expect(validatePair('ja', 'en', existing)).toEqual({ valid: true })
  })

  it('rejects empty source', () => {
    expect(validatePair('', 'en', [])).toEqual({ valid: false, error: 'Source language is required' })
  })

  it('rejects empty target', () => {
    expect(validatePair('en', '', [])).toEqual({ valid: false, error: 'Target language is required' })
  })

  it('rejects same source and target', () => {
    expect(validatePair('en', 'en', [])).toEqual({ valid: false, error: 'Source and target must differ' })
  })

  it('rejects duplicate pair', () => {
    expect(validatePair('en', 'ja', existing)).toEqual({ valid: false, error: 'Pair en→ja already added' })
  })

  it('rejects invalid BCP 47 source', () => {
    expect(validatePair('EN', 'ja', [])).toEqual({ valid: false, error: 'Invalid language code: EN' })
  })

  it('rejects invalid BCP 47 target', () => {
    expect(validatePair('en', 'J', [])).toEqual({ valid: false, error: 'Invalid language code: J' })
  })

  it('accepts valid BCP 47 with region subtag', () => {
    expect(validatePair('zh', 'zh-Hant', [])).toEqual({ valid: true })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — "validatePair is not a function"

- [ ] **Step 3: Implement validatePair**

Append to `src/checker.js`:

```js
const BCP47_RE = /^[a-z]{2,3}(-[A-Z]{2,4})?$/

export function validatePair(src, tgt, existingPairs) {
  if (!src) return { valid: false, error: 'Source language is required' }
  if (!tgt) return { valid: false, error: 'Target language is required' }
  if (!BCP47_RE.test(src)) return { valid: false, error: `Invalid language code: ${src}` }
  if (!BCP47_RE.test(tgt)) return { valid: false, error: `Invalid language code: ${tgt}` }
  if (src === tgt) return { valid: false, error: 'Source and target must differ' }
  if (existingPairs.some(p => p.src === src && p.tgt === tgt))
    return { valid: false, error: `Pair ${src}→${tgt} already added` }
  return { valid: true }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — 15 passing tests

- [ ] **Step 5: Commit**

```bash
git add src/checker.js src/checker.test.js
git commit -m "feat: add validatePair to checker"
```

---

### Task 6: checker.js — API Availability Checking

**Files:**
- Modify: `src/checker.js`
- Modify: `src/checker.test.js`

**Interfaces:**
- Consumes: `normalizeStatus`, `isApiSupported`
- Produces:
  - `checkApi(globalName: string, options?: object): Promise<{ id: string, label: string, status: string }>`
  - `checkTranslatorPair(src: string, tgt: string): Promise<{ id: string, src: string, tgt: string, status: string }>`
  - `checkAllApis(translatorPairs: Array<{src: string, tgt: string}>): Promise<{ apis: Array<{id, label, status}>, pairs: Array<{id, src, tgt, status}> }>`

- [ ] **Step 1: Write failing tests**

Update the import at the top of `src/checker.test.js` to include the new functions, then append the new test suites:

```js
// Update existing import line to:
import { normalizeStatus, isApiSupported, validatePair, checkApi, checkTranslatorPair, checkAllApis } from './checker.js'
```

Append below the existing tests:

```js
describe('checkApi', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns unsupported when global is missing', async () => {
    const result = await checkApi('LanguageDetector')
    expect(result).toEqual({ id: 'LanguageDetector', label: 'Language Detector', status: 'unsupported' })
  })

  it('returns normalized status when global exists', async () => {
    vi.stubGlobal('Summarizer', { availability: async () => 'readily' })
    const result = await checkApi('Summarizer')
    expect(result.status).toBe('available')
  })

  it('returns unavailable when availability() throws', async () => {
    vi.stubGlobal('LanguageModel', { availability: async () => { throw new Error('fail') } })
    const result = await checkApi('LanguageModel')
    expect(result.status).toBe('unavailable')
  })
})

describe('checkTranslatorPair', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns unsupported when Translator global is missing', async () => {
    const result = await checkTranslatorPair('en', 'ja')
    expect(result).toEqual({ id: 'Translator-en-ja', src: 'en', tgt: 'ja', status: 'unsupported' })
  })

  it('returns normalized status for a valid pair', async () => {
    vi.stubGlobal('Translator', {
      availability: async () => 'downloadable',
    })
    const result = await checkTranslatorPair('en', 'ja')
    expect(result.status).toBe('downloadable')
  })

  it('returns unavailable when availability() throws', async () => {
    vi.stubGlobal('Translator', {
      availability: async () => { throw new Error('fail') },
    })
    const result = await checkTranslatorPair('en', 'ja')
    expect(result.status).toBe('unavailable')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — "checkApi is not a function"

- [ ] **Step 3: Implement checkApi, checkTranslatorPair, checkAllApis**

Append to `src/checker.js`:

```js
const API_LABELS = {
  LanguageDetector: 'Language Detector',
  Summarizer:       'Summarizer',
  LanguageModel:    'Prompt (LanguageModel)',
}

export async function checkApi(globalName, options = {}) {
  if (!isApiSupported(globalName)) {
    return { id: globalName, label: API_LABELS[globalName] ?? globalName, status: 'unsupported' }
  }
  try {
    const raw = await self[globalName].availability(options)
    return { id: globalName, label: API_LABELS[globalName] ?? globalName, status: normalizeStatus(raw) }
  } catch {
    return { id: globalName, label: API_LABELS[globalName] ?? globalName, status: 'unavailable' }
  }
}

export async function checkTranslatorPair(src, tgt) {
  const id = `Translator-${src}-${tgt}`
  if (!isApiSupported('Translator')) {
    return { id, src, tgt, status: 'unsupported' }
  }
  try {
    const raw = await Translator.availability({ sourceLanguage: src, targetLanguage: tgt })
    return { id, src, tgt, status: normalizeStatus(raw) }
  } catch {
    return { id, src, tgt, status: 'unavailable' }
  }
}

export async function checkAllApis(translatorPairs) {
  const results = await Promise.all([
    checkApi('LanguageDetector'),
    checkApi('Summarizer'),
    checkApi('LanguageModel'),
    ...translatorPairs.map(p => checkTranslatorPair(p.src, p.tgt)),
  ])
  return {
    apis:  results.slice(0, 3),
    pairs: results.slice(3),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — all tests passing

- [ ] **Step 5: Commit**

```bash
git add src/checker.js src/checker.test.js
git commit -m "feat: add checkApi, checkTranslatorPair, checkAllApis to checker"
```

---

### Task 7: ui.js — Log & Status Rendering

**Files:**
- Create: `src/ui.js`
- Create: `src/ui.test.js`

**Interfaces:**
- Produces:
  - `getTimestamp(): string` — `HH:MM:SS`
  - `appendLog(message: string, type: 'ok'|'warn'|'info'|'err'|'muted'): void`
  - `renderApiRow(id: string, label: string, status: string): void`
  - `renderPairRow(id: string, src: string, tgt: string, status: string): void`
  - `renderProgress(id: string, loaded: number, total: number): void`
  - `setDownloadAllButton(state: 'idle'|'downloading'|'done'): void`
  - `showPairError(message: string): void`
  - `clearPairError(): void`

- [ ] **Step 1: Write failing tests**

Create `src/ui.test.js`:

```js
import {
  getTimestamp, appendLog, renderApiRow, renderPairRow,
  renderProgress, setDownloadAllButton, showPairError, clearPairError,
} from './ui.js'

function setupDOM() {
  document.body.innerHTML = `
    <div data-status-list></div>
    <div data-pair-list></div>
    <div data-log></div>
    <button data-btn-download disabled>↓ Download All</button>
    <div class="pair-error" data-pair-error hidden></div>
  `
}

describe('getTimestamp', () => {
  it('returns HH:MM:SS format', () => {
    expect(getTimestamp()).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })
})

describe('appendLog', () => {
  beforeEach(setupDOM)

  it('appends a log entry to the log container', () => {
    appendLog('test message', 'ok')
    const entry = document.querySelector('[data-log] .log-entry')
    expect(entry).not.toBeNull()
    expect(entry.textContent).toContain('test message')
  })

  it('applies the correct class for type "err"', () => {
    appendLog('error msg', 'err')
    const entry = document.querySelector('[data-log] .log-entry')
    expect(entry.classList.contains('log-err')).toBe(true)
  })
})

describe('renderApiRow', () => {
  beforeEach(setupDOM)

  it('creates a new row for a new id', () => {
    renderApiRow('LanguageDetector', 'Language Detector', 'available')
    expect(document.querySelector('[data-status-list] [data-row-id="LanguageDetector"]')).not.toBeNull()
  })

  it('updates existing row without duplicating', () => {
    renderApiRow('Summarizer', 'Summarizer', 'downloadable')
    renderApiRow('Summarizer', 'Summarizer', 'available')
    const rows = document.querySelectorAll('[data-status-list] [data-row-id="Summarizer"]')
    expect(rows.length).toBe(1)
    expect(rows[0].classList.contains('status-ok')).toBe(true)
  })

  it('marks unsupported rows with is-na class', () => {
    renderApiRow('LanguageModel', 'Prompt', 'unsupported')
    const row = document.querySelector('[data-row-id="LanguageModel"]')
    expect(row.classList.contains('is-na')).toBe(true)
  })
})

describe('renderProgress', () => {
  beforeEach(setupDOM)

  it('creates a progress row below the api row', () => {
    renderApiRow('Summarizer', 'Summarizer', 'downloading')
    renderProgress('Summarizer', 0.6, 2.0)
    expect(document.querySelector('[data-progress-id="Summarizer"]')).not.toBeNull()
  })

  it('sets progress fill width correctly', () => {
    renderApiRow('Summarizer', 'Summarizer', 'downloading')
    renderProgress('Summarizer', 1.2, 2.0)
    const fill = document.querySelector('[data-progress-id="Summarizer"] .progress-fill')
    expect(fill.style.width).toBe('60%')
  })
})

describe('setDownloadAllButton', () => {
  beforeEach(setupDOM)

  it('disables button and shows Downloading when state is downloading', () => {
    setDownloadAllButton('downloading')
    const btn = document.querySelector('[data-btn-download]')
    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toContain('Downloading')
  })

  it('adds btn-done class when state is done', () => {
    setDownloadAllButton('done')
    const btn = document.querySelector('[data-btn-download]')
    expect(btn.classList.contains('btn-done')).toBe(true)
  })

  it('enables button when state is idle', () => {
    setDownloadAllButton('idle')
    const btn = document.querySelector('[data-btn-download]')
    expect(btn.disabled).toBe(false)
  })
})

describe('showPairError / clearPairError', () => {
  beforeEach(setupDOM)

  it('shows error message', () => {
    showPairError('Source language is required')
    const el = document.querySelector('[data-pair-error]')
    expect(el.hidden).toBe(false)
    expect(el.textContent).toBe('Source language is required')
  })

  it('clears error', () => {
    showPairError('err')
    clearPairError()
    expect(document.querySelector('[data-pair-error]').hidden).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — "Cannot find module './ui.js'"

- [ ] **Step 3: Implement ui.js**

Create `src/ui.js`:

```js
const STATUS_META = {
  available:    { cls: 'status-ok',   tag: '[OK]  ', icon: '✓' },
  downloadable: { cls: 'status-warn', tag: '[DL]  ', icon: '⚡' },
  downloading:  { cls: 'status-info', tag: '[···] ', icon: '↓' },
  unavailable:  { cls: 'status-err',  tag: '[ERR] ', icon: '✗' },
  unsupported:  { cls: 'status-na',   tag: '[N/A] ', icon: '–' },
}

const LOG_ICONS = { ok: '✓', warn: '⚡', info: '↓', err: '✗', muted: '·' }

export function getTimestamp() {
  const d = new Date()
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':')
}

export function appendLog(message, type = 'muted') {
  const log = document.querySelector('[data-log]')
  if (!log) return
  const entry = document.createElement('div')
  entry.className = `log-entry log-${type}`
  const icon = LOG_ICONS[type] ?? '·'
  entry.innerHTML = `<span class="log-icon">${icon}</span><span>${message}</span>`
  log.appendChild(entry)
  log.scrollTop = log.scrollHeight
}

function buildRow(id, cols) {
  const row = document.createElement('div')
  row.dataset.rowId = id
  row.innerHTML = cols
  return row
}

function rowCols(label, status) {
  const meta = STATUS_META[status] ?? STATUS_META.unsupported
  return `
    <span class="status-ts">${getTimestamp()}</span>
    <span class="status-tag">${meta.tag}</span>
    <span class="status-name">${label}</span>
    <span class="status-val">${status}</span>
  `
}

function applyRowClass(row, status) {
  const meta = STATUS_META[status] ?? STATUS_META.unsupported
  row.className = `status-row ${meta.cls}${status === 'unsupported' ? ' is-na' : ''}`
}

export function renderApiRow(id, label, status) {
  const container = document.querySelector('[data-status-list]')
  if (!container) return
  let row = container.querySelector(`[data-row-id="${id}"]`)
  if (!row) { row = buildRow(id, ''); container.appendChild(row) }
  applyRowClass(row, status)
  row.innerHTML = rowCols(label, status)
}

export function renderPairRow(id, src, tgt, status) {
  const container = document.querySelector('[data-pair-list]')
  if (!container) return
  let row = container.querySelector(`[data-row-id="${id}"]`)
  if (!row) { row = buildRow(id, ''); container.appendChild(row) }
  applyRowClass(row, status)
  row.innerHTML = rowCols(`${src}→${tgt}`, status)
}

export function renderProgress(id, loaded, total) {
  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0
  let prog = document.querySelector(`[data-progress-id="${id}"]`)
  if (!prog) {
    prog = document.createElement('div')
    prog.dataset.progressId = id
    prog.className = 'progress-row'
    prog.innerHTML = `
      <span></span><span></span>
      <div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div>
      <span class="progress-label">0%</span>
    `
    const statusList = document.querySelector('[data-status-list]')
    const pairList   = document.querySelector('[data-pair-list]')
    const row = statusList?.querySelector(`[data-row-id="${id}"]`)
            ?? pairList?.querySelector(`[data-row-id="${id}"]`)
    if (row) row.after(prog)
  }
  prog.querySelector('.progress-fill').style.width = `${pct}%`
  prog.querySelector('.progress-label').textContent = `${pct}%`
}

export function setDownloadAllButton(state) {
  const btn = document.querySelector('[data-btn-download]')
  if (!btn) return
  btn.classList.remove('btn-done')
  if (state === 'idle') {
    btn.disabled = false
    btn.textContent = '↓ Download All'
  } else if (state === 'downloading') {
    btn.disabled = true
    btn.textContent = '↓ Downloading...'
  } else if (state === 'done') {
    btn.disabled = true
    btn.textContent = '✓ Done'
    btn.classList.add('btn-done')
  }
}

export function showPairError(message) {
  const el = document.querySelector('[data-pair-error]')
  if (!el) return
  el.hidden = false
  el.textContent = message
}

export function clearPairError() {
  const el = document.querySelector('[data-pair-error]')
  if (!el) return
  el.hidden = true
  el.textContent = ''
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — all tests passing

- [ ] **Step 5: Commit**

```bash
git add src/ui.js src/ui.test.js
git commit -m "feat: add UI rendering functions in ui.js"
```

---

### Task 8: checker.js — Download Triggering

**Files:**
- Modify: `src/checker.js`
- Modify: `src/checker.test.js`

**Interfaces:**
- Consumes: `isApiSupported`
- Produces:
  - `triggerDownload(id: string, globalName: string, options: object, onProgress: (id: string, loaded: number, total: number, errMsg?: string) => void): Promise<void>`
  - `triggerAllDownloads(apis: Array<{id: string, status: string}>, pairs: Array<{id: string, src: string, tgt: string, status: string}>, onProgress: Function): Promise<void>`

- [ ] **Step 1: Write failing tests**

Update the import at the top of `src/checker.test.js` to include the new functions, then append the new test suites:

```js
// Update existing import line to:
import {
  normalizeStatus, isApiSupported, validatePair,
  checkApi, checkTranslatorPair, checkAllApis,
  triggerDownload, triggerAllDownloads,
} from './checker.js'
```

Append below the existing tests:

```js
describe('triggerDownload', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('calls create() and fires onProgress via downloadprogress event', async () => {
    const onProgress = vi.fn()
    vi.stubGlobal('Summarizer', {
      create: vi.fn(({ monitor }) => {
        const m = {
          addEventListener: (evt, cb) => {
            if (evt === 'downloadprogress') cb({ loaded: 0.5, total: 1.0 })
          },
        }
        monitor(m)
        return Promise.resolve({})
      }),
    })
    await triggerDownload('Summarizer', 'Summarizer', {}, onProgress)
    expect(Summarizer.create).toHaveBeenCalled()
    expect(onProgress).toHaveBeenCalledWith('Summarizer', 0.5, 1.0)
  })

  it('calls onProgress with error message when create() rejects', async () => {
    const onProgress = vi.fn()
    vi.stubGlobal('LanguageModel', {
      create: vi.fn(() => Promise.reject(new Error('not supported'))),
    })
    await triggerDownload('LanguageModel', 'LanguageModel', {}, onProgress)
    expect(onProgress).toHaveBeenCalledWith('LanguageModel', -1, -1, 'not supported')
  })

  it('does nothing when global is missing', async () => {
    const onProgress = vi.fn()
    await triggerDownload('LanguageDetector', 'LanguageDetector', {}, onProgress)
    expect(onProgress).not.toHaveBeenCalled()
  })
})

describe('triggerAllDownloads', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('triggers downloads only for downloadable and downloading APIs', async () => {
    const onProgress = vi.fn()
    vi.stubGlobal('Summarizer', {
      create: vi.fn(({ monitor }) => {
        monitor({ addEventListener: () => {} })
        return Promise.resolve({})
      }),
    })
    const apis = [
      { id: 'LanguageDetector', status: 'available' },
      { id: 'Summarizer',       status: 'downloadable' },
    ]
    await triggerAllDownloads(apis, [], onProgress)
    expect(Summarizer.create).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — "triggerDownload is not a function"

- [ ] **Step 3: Implement triggerDownload and triggerAllDownloads**

Append to `src/checker.js`:

```js
export async function triggerDownload(id, globalName, options, onProgress) {
  if (!isApiSupported(globalName)) return
  try {
    await self[globalName].create({
      ...options,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          onProgress(id, e.loaded, e.total)
        })
      },
    })
  } catch (err) {
    onProgress(id, -1, -1, err.message)
  }
}

export async function triggerAllDownloads(apis, pairs, onProgress) {
  const tasks = []

  for (const api of apis) {
    if (api.status !== 'downloadable' && api.status !== 'downloading') continue
    tasks.push(triggerDownload(api.id, api.id, {}, onProgress))
  }

  for (const pair of pairs) {
    if (pair.status !== 'downloadable' && pair.status !== 'downloading') continue
    tasks.push(
      triggerDownload(
        pair.id,
        'Translator',
        { sourceLanguage: pair.src, targetLanguage: pair.tgt },
        onProgress,
      ),
    )
  }

  await Promise.all(tasks)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — all tests passing

- [ ] **Step 5: Commit**

```bash
git add src/checker.js src/checker.test.js
git commit -m "feat: add triggerDownload and triggerAllDownloads to checker"
```

---

### Task 9: main.js — App Initialization & Event Wiring

**Files:**
- Modify: `src/main.js` (replace the stub created in Task 3)

**Interfaces:**
- Consumes:
  - From `checker.js`: `checkAllApis`, `triggerAllDownloads`, `validatePair`, `checkTranslatorPair`
  - From `ui.js`: `renderApiRow`, `renderPairRow`, `renderProgress`, `appendLog`, `setDownloadAllButton`, `showPairError`, `clearPairError`

No unit tests — verify manually via dev server.

- [ ] **Step 1: Replace src/main.js with the full implementation**

```js
import {
  checkAllApis,
  triggerAllDownloads,
  validatePair,
  checkTranslatorPair,
} from './checker.js'

import {
  renderApiRow,
  renderPairRow,
  renderProgress,
  appendLog,
  setDownloadAllButton,
  showPairError,
  clearPairError,
} from './ui.js'

const DEFAULT_PAIRS = [
  { src: 'en', tgt: 'ja' },
  { src: 'ja', tgt: 'en' },
]

const state = {
  apis:  [],
  pairs: DEFAULT_PAIRS.map(p => ({ ...p, id: `Translator-${p.src}-${p.tgt}`, status: 'unsupported' })),
}

const LOG_FOR_STATUS = {
  available:    (label) => ({ msg: `${label}: ready, no download needed`,                         type: 'ok' }),
  downloadable: (label) => ({ msg: `${label}: model download required — click Download All`,       type: 'warn' }),
  downloading:  (label) => ({ msg: `${label}: download already in progress`,                      type: 'info' }),
  unavailable:  (label) => ({ msg: `${label}: not supported on this device`,                      type: 'err' }),
  unsupported:  (label) => ({ msg: `${label}: not available in this browser`,                     type: 'muted' }),
}

function logForStatus(label, status) {
  return (LOG_FOR_STATUS[status] ?? LOG_FOR_STATUS.unsupported)(label)
}

function detectChromeVersion() {
  const m = navigator.userAgent.match(/Chrome\/(\d+)/)
  const el = document.querySelector('[data-chrome-ver]')
  if (!el) return
  el.textContent = m ? `Chrome ${m[1]}` : navigator.userAgent.slice(0, 50)
}

function onProgress(id, loaded, total, errMsg) {
  if (errMsg) {
    appendLog(`Download failed: ${id} — ${errMsg}`, 'err')
    const api = state.apis.find(a => a.id === id)
    if (api) renderApiRow(api.id, api.label, 'unavailable')
    else {
      const pair = state.pairs.find(p => p.id === id)
      if (pair) renderPairRow(pair.id, pair.src, pair.tgt, 'unavailable')
    }
    return
  }
  renderProgress(id, loaded, total)
  if (loaded >= total && total > 0) {
    const api = state.apis.find(a => a.id === id)
    if (api) { api.status = 'available'; renderApiRow(api.id, api.label, 'available') }
    else {
      const pair = state.pairs.find(p => p.id === id)
      if (pair) { pair.status = 'available'; renderPairRow(pair.id, pair.src, pair.tgt, 'available') }
    }
    appendLog(`${id}: download complete`, 'ok')
  }
}

async function handleDownloads(downloadableApis, downloadablePairs) {
  setDownloadAllButton('downloading')
  appendLog('Starting downloads...', 'info')
  await triggerAllDownloads(downloadableApis, downloadablePairs, onProgress)
  setDownloadAllButton('done')
  appendLog('All downloads complete', 'ok')
}

async function runCheck() {
  const btnCheck = document.querySelector('[data-btn-check]')
  if (btnCheck) { btnCheck.disabled = true; btnCheck.textContent = '▶ Checking...' }

  const { apis, pairs } = await checkAllApis(
    state.pairs.map(p => ({ src: p.src, tgt: p.tgt }))
  )
  state.apis = apis
  state.pairs = pairs

  for (const api of state.apis) {
    renderApiRow(api.id, api.label, api.status)
    const { msg, type } = logForStatus(api.label, api.status)
    appendLog(msg, type)
  }

  for (const pair of state.pairs) {
    renderPairRow(pair.id, pair.src, pair.tgt, pair.status)
    const { msg, type } = logForStatus(`Translator ${pair.src}→${pair.tgt}`, pair.status)
    appendLog(msg, type)
  }

  const hasDownloadable = [...state.apis, ...state.pairs].some(x => x.status === 'downloadable')
  if (hasDownloadable) setDownloadAllButton('idle')

  const alreadyDownloading = [...state.apis, ...state.pairs].filter(x => x.status === 'downloading')
  if (alreadyDownloading.length > 0) {
    setDownloadAllButton('downloading')
    const dlApis  = alreadyDownloading.filter(x => 'label' in x)
    const dlPairs = alreadyDownloading.filter(x => 'src' in x)
    handleDownloads(dlApis, dlPairs)
  }

  if (btnCheck) { btnCheck.disabled = false; btnCheck.textContent = '▶ Check Status' }
}

async function addPair(src, tgt) {
  const existingPairs = state.pairs.map(p => ({ src: p.src, tgt: p.tgt }))
  const validation = validatePair(src, tgt, existingPairs)
  if (!validation.valid) { showPairError(validation.error); return }
  clearPairError()

  const result = await checkTranslatorPair(src, tgt)
  state.pairs.push(result)
  renderPairRow(result.id, result.src, result.tgt, result.status)
  const { msg, type } = logForStatus(`Translator ${src}→${tgt}`, result.status)
  appendLog(msg, type)

  if (result.status === 'downloadable') setDownloadAllButton('idle')

  document.querySelector('[data-pair-src]').value = ''
  document.querySelector('[data-pair-tgt]').value = ''
}

function init() {
  detectChromeVersion()

  document.querySelector('[data-btn-check]')?.addEventListener('click', runCheck)

  document.querySelector('[data-btn-download]')?.addEventListener('click', () => {
    const dlApis  = state.apis.filter(a => a.status === 'downloadable')
    const dlPairs = state.pairs.filter(p => p.status === 'downloadable')
    handleDownloads(dlApis, dlPairs)
  })

  document.querySelector('[data-btn-add-pair]')?.addEventListener('click', () => {
    const src = document.querySelector('[data-pair-src]').value.trim()
    const tgt = document.querySelector('[data-pair-tgt]').value.trim()
    addPair(src, tgt)
  })

  document.querySelector('[data-pair-src]')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.querySelector('[data-pair-tgt]')?.focus()
  })

  document.querySelector('[data-pair-tgt]')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.querySelector('[data-btn-add-pair]')?.click()
  })

  runCheck()
}

document.addEventListener('DOMContentLoaded', init)
```

- [ ] **Step 2: Run full test suite to confirm nothing broke**

```bash
npm test
```

Expected: PASS — all tests still passing (main.js has no unit tests)

- [ ] **Step 3: Start dev server and manually verify**

```bash
npm run dev
```

Open `http://localhost:5173` in Chrome 138+.

Manual verification checklist:
1. Chrome version shown in header (e.g. "Chrome 148")
2. On load, status check runs automatically — 4 API rows + 2 Translator pair rows appear
3. Each row has correct color and status tag
4. A log entry appears for each API
5. `[Download All]` is enabled when at least one API shows `downloadable`
6. Adding `en → zh` via the form adds a new pair row with status
7. Adding `en → en` shows "Source and target must differ" error
8. Adding `EN → ja` shows "Invalid language code: EN" error
9. Adding `en → ja` a second time shows "Pair en→ja already added" error
10. Pressing Enter in source input moves focus to target; pressing Enter in target clicks Add
11. `[Download All]` click triggers downloads and shows progress bar for each downloading API

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat: add main.js with app initialization and event wiring"
```

---

### Task 10: Build & Firebase Deploy

**Files:** No new source files

- [ ] **Step 1: Run full test suite and production build**

```bash
npm test && npm run build
```

Expected: all tests pass; `dist/` directory created with `index.html` and `assets/` containing bundled JS and CSS.

- [ ] **Step 2: Preview the production build locally**

```bash
npm run preview
```

Open `http://localhost:4173` in Chrome. Run through the full manual checklist from Task 9 Step 3 with the production build.

- [ ] **Step 3: Log in to Firebase and select project**

```bash
firebase login
firebase use --add
```

Select the Firebase project when prompted. This updates `.firebaserc` with your project ID.

- [ ] **Step 4: Deploy to Firebase Hosting**

```bash
firebase deploy
```

Expected output:
```
✔  Deploy complete!
Hosting URL: https://YOUR_PROJECT_ID.web.app
```

- [ ] **Step 5: Verify the live deployment in Chrome**

Open the Firebase Hosting URL. Confirm all functionality works identically to the local preview.

- [ ] **Step 6: Commit .firebaserc if updated**

```bash
git add .firebaserc
git commit -m "chore: set Firebase project ID"
```
