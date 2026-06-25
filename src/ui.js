import { API_DOCS } from './checker.js'

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

function docLinkHtml(docUrl) {
  if (!docUrl) return ''
  return ` <a class="doc-link" href="${docUrl}" target="_blank" rel="noopener" title="Open documentation">[docs ↗]</a>`
}

function rowCols(label, status, docUrl) {
  const meta = STATUS_META[status] ?? STATUS_META.unsupported
  return `
    <span class="status-ts">${getTimestamp()}</span>
    <span class="status-tag">${meta.tag}</span>
    <span class="status-name">${label}${docLinkHtml(docUrl)}</span>
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
  row.innerHTML = rowCols(label, status, API_DOCS[id])
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
