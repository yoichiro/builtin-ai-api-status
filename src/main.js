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

import { loadPairs, savePairs } from './storage.js'

const DEFAULT_PAIRS = [
  { src: 'en', tgt: 'ja' },
  { src: 'ja', tgt: 'en' },
]

const initialPairs = loadPairs() ?? DEFAULT_PAIRS

const state = {
  apis:  [],
  pairs: initialPairs.map(p => ({ ...p, id: `Translator-${p.src}-${p.tgt}`, status: 'unsupported' })),
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
    await handleDownloads(dlApis, dlPairs)
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
  savePairs(state.pairs)
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
