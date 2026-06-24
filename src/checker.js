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
