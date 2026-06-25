// Create a detector session. The button only appears when availability is
// 'available', so no model download is expected here.
export async function createDetector(options = {}) {
  return await LanguageDetector.create(options)
}

// Detect languages in text and return the top `max` results normalized to
// { language, confidence }. detector.detect() returns results already sorted
// by confidence in descending order.
export async function detectLanguages(detector, text, { max = 5 } = {}) {
  const results = await detector.detect(text)
  return results.slice(0, max).map(r => ({
    language: r.detectedLanguage,
    confidence: r.confidence,
  }))
}
