import {
  normalizeStatus, isApiSupported, validatePair,
  checkApi, checkTranslatorPair, checkAllApis,
  triggerDownload, triggerAllDownloads,
} from './checker.js'

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

describe('checkApi', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns unsupported when global is missing', async () => {
    const result = await checkApi('LanguageDetector')
    expect(result).toEqual({ id: 'LanguageDetector', label: 'Language Detector', status: 'unsupported' })
  })

  it('returns normalized status when global exists', async () => {
    vi.stubGlobal('Summarizer', { availability: async () => 'readily' })
    const result = await checkApi('Summarizer')
    expect(result.status).toBe('available')
  })

  it('returns unavailable when availability() throws', async () => {
    vi.stubGlobal('LanguageModel', { availability: async () => { throw new Error('fail') } })
    const result = await checkApi('LanguageModel')
    expect(result.status).toBe('unavailable')
  })
})

describe('checkTranslatorPair', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns unsupported when Translator global is missing', async () => {
    const result = await checkTranslatorPair('en', 'ja')
    expect(result).toEqual({ id: 'Translator-en-ja', src: 'en', tgt: 'ja', status: 'unsupported' })
  })

  it('returns normalized status for a valid pair', async () => {
    vi.stubGlobal('Translator', {
      availability: async () => 'downloadable',
    })
    const result = await checkTranslatorPair('en', 'ja')
    expect(result.status).toBe('downloadable')
  })

  it('returns unavailable when availability() throws', async () => {
    vi.stubGlobal('Translator', {
      availability: async () => { throw new Error('fail') },
    })
    const result = await checkTranslatorPair('en', 'ja')
    expect(result.status).toBe('unavailable')
  })
})

describe('triggerDownload', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('calls create() and fires onProgress via downloadprogress event', async () => {
    const onProgress = vi.fn()
    vi.stubGlobal('Summarizer', {
      create: vi.fn(({ monitor }) => {
        const m = {
          addEventListener: (evt, cb) => {
            if (evt === 'downloadprogress') cb({ loaded: 0.5, total: 1.0 })
          },
        }
        monitor(m)
        return Promise.resolve({})
      }),
    })
    await triggerDownload('Summarizer', 'Summarizer', {}, onProgress)
    expect(Summarizer.create).toHaveBeenCalled()
    expect(onProgress).toHaveBeenCalledWith('Summarizer', 0.5, 1.0)
  })

  it('calls onProgress with error message when create() rejects', async () => {
    const onProgress = vi.fn()
    vi.stubGlobal('LanguageModel', {
      create: vi.fn(() => Promise.reject(new Error('not supported'))),
    })
    await triggerDownload('LanguageModel', 'LanguageModel', {}, onProgress)
    expect(onProgress).toHaveBeenCalledWith('LanguageModel', -1, -1, 'not supported')
  })

  it('does nothing when global is missing', async () => {
    const onProgress = vi.fn()
    await triggerDownload('LanguageDetector', 'LanguageDetector', {}, onProgress)
    expect(onProgress).not.toHaveBeenCalled()
  })
})

describe('triggerAllDownloads', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('triggers downloads only for downloadable and downloading APIs', async () => {
    const onProgress = vi.fn()
    vi.stubGlobal('Summarizer', {
      create: vi.fn(({ monitor }) => {
        monitor({ addEventListener: () => {} })
        return Promise.resolve({})
      }),
    })
    const apis = [
      { id: 'LanguageDetector', status: 'available' },
      { id: 'Summarizer',       status: 'downloadable' },
    ]
    await triggerAllDownloads(apis, [], onProgress)
    expect(Summarizer.create).toHaveBeenCalled()
  })
})
