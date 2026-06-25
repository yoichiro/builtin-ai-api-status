// Persistence for user-added Translator language pairs.
// Only the {src, tgt} of each pair is stored; status is re-checked on load.

export const STORAGE_KEY = 'translator-pairs'

export function loadPairs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const pairs = parsed
      .filter(p => p && typeof p.src === 'string' && typeof p.tgt === 'string')
      .map(p => ({ src: p.src, tgt: p.tgt }))
    return pairs.length > 0 ? pairs : null
  } catch {
    return null
  }
}

export function savePairs(pairs) {
  try {
    const minimal = pairs.map(p => ({ src: p.src, tgt: p.tgt }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal))
  } catch {
    // Best-effort: ignore quota / private-mode / disabled-storage errors
  }
}
