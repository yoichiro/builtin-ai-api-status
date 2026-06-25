import { loadPairs, savePairs, STORAGE_KEY } from './storage.js'

describe('savePairs / loadPairs', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('round-trips saved pairs', () => {
    savePairs([{ src: 'en', tgt: 'ja' }, { src: 'fr', tgt: 'de' }])
    expect(loadPairs()).toEqual([{ src: 'en', tgt: 'ja' }, { src: 'fr', tgt: 'de' }])
  })

  it('persists only src/tgt, stripping id and status', () => {
    savePairs([{ id: 'Translator-en-ja', src: 'en', tgt: 'ja', status: 'available' }])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual([{ src: 'en', tgt: 'ja' }])
  })

  it('returns null when nothing is stored', () => {
    expect(loadPairs()).toBeNull()
  })

  it('returns null when stored value is corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')
    expect(loadPairs()).toBeNull()
  })

  it('returns null when stored value is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ src: 'en', tgt: 'ja' }))
    expect(loadPairs()).toBeNull()
  })

  it('filters out malformed entries', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { src: 'en', tgt: 'ja' },
      { src: 'en' },
      null,
      { src: 1, tgt: 2 },
      { src: 'fr', tgt: 'de' },
    ]))
    expect(loadPairs()).toEqual([{ src: 'en', tgt: 'ja' }, { src: 'fr', tgt: 'de' }])
  })

  it('returns null when an empty array is stored', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
    expect(loadPairs()).toBeNull()
  })

  it('does not throw when localStorage.setItem fails', () => {
    vi.stubGlobal('localStorage', {
      setItem() { throw new Error('quota exceeded') },
      getItem() { return null },
    })
    expect(() => savePairs([{ src: 'en', tgt: 'ja' }])).not.toThrow()
  })
})
