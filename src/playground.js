// Recommended values and ranges for prefilling the Playground inputs.
export async function getParams() {
  const p = await LanguageModel.params()
  return {
    defaultTemperature: p.defaultTemperature,
    maxTemperature:     p.maxTemperature,
    defaultTopK:        p.defaultTopK,
    maxTopK:            p.maxTopK,
  }
}

// Create a session, stream a prompt, forward deltas to onChunk, then destroy.
// Returns the full concatenated text. Throws on failure; on abort resolves
// with whatever text streamed so far.
export async function runPrompt({ systemPrompt, temperature, topK, prompt, signal, onChunk }) {
  const opts = {}
  if (signal) opts.signal = signal
  // temperature and topK must be set together or not at all.
  if (temperature != null && topK != null) {
    opts.temperature = temperature
    opts.topK = topK
  }
  if (systemPrompt) {
    opts.initialPrompts = [{ role: 'system', content: systemPrompt }]
  }

  const session = await LanguageModel.create(opts)
  let full = ''
  try {
    for await (const chunk of session.promptStreaming(prompt, { signal })) {
      full += chunk
      onChunk?.(chunk)
    }
    return full
  } catch (err) {
    if (err?.name === 'AbortError' || signal?.aborted) return full
    throw err
  } finally {
    session.destroy()
  }
}
