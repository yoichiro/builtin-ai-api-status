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

const BCP47_RE = /^[a-z]{2,3}(-[A-Z][a-z]{2,3})?$/

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
