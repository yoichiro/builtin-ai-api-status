import { createDetector, detectLanguages } from './detector.js'

describe('createDetector', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the session from LanguageDetector.create()', async () => {
    const session = { detect: async () => [] }
    const create = vi.fn(async () => session)
    vi.stubGlobal('LanguageDetector', { create })
    const detector = await createDetector()
    expect(detector).toBe(session)
    expect(create).toHaveBeenCalled()
  })
})

describe('detectLanguages', () => {
  it('maps detectedLanguage to language and passes confidence through', async () => {
    const detector = {
      detect: async () => [
        { detectedLanguage: 'fr', confidence: 0.82 },
        { detectedLanguage: 'en', confidence: 0.12 },
      ],
    }
    const out = await detectLanguages(detector, 'bonjour')
    expect(out).toEqual([
      { language: 'fr', confidence: 0.82 },
      { language: 'en', confidence: 0.12 },
    ])
  })

  it('returns at most max entries (default 5)', async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ detectedLanguage: `l${i}`, confidence: 1 - i * 0.1 }))
    const detector = { detect: async () => many }
    const out = await detectLanguages(detector, 'x')
    expect(out.length).toBe(5)
    expect(out[0]).toEqual({ language: 'l0', confidence: 1 })
  })

  it('respects a custom max', async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ detectedLanguage: `l${i}`, confidence: 0.5 }))
    const detector = { detect: async () => many }
    const out = await detectLanguages(detector, 'x', { max: 2 })
    expect(out.length).toBe(2)
  })
})
