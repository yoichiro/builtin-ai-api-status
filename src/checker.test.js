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
