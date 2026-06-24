import { normalizeStatus, isApiSupported, validatePair } from './checker.js'

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
    expect(validatePair('zh', 'zh-TW', [])).toEqual({ valid: true })
  })
})
