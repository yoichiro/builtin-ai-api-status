const STATUS_MAP = {
  available:      'available',
  downloadable:   'downloadable',
  downloading:    'downloading',
  unavailable:    'unavailable',
  readily:        'available',      // legacy alias
  'after-download': 'downloadable', // legacy alias
  unsupported:    'unavailable',    // legacy alias from old API; distinct from 'unsupported' returned by checkApi() when global is missing
}

export function normalizeStatus(raw) {
  return STATUS_MAP[raw] ?? 'unavailable'
}

export function isApiSupported(globalName) {
  return globalName in self
}

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

const API_LABELS = {
  LanguageDetector: 'Language Detector',
  Summarizer:       'Summarizer',
  LanguageModel:    'Prompt (LanguageModel)',
}

export const API_DOCS = {
  LanguageDetector: 'https://developer.chrome.com/docs/ai/language-detection',
  Translator:       'https://developer.chrome.com/docs/ai/translator-api',
  Summarizer:       'https://developer.chrome.com/docs/ai/summarizer-api',
  LanguageModel:    'https://developer.chrome.com/docs/ai/prompt-api',
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
