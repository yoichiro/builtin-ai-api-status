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
