// Create a summarizer with the given options, stream the summary of `text`,
// forward each delta to onChunk, then destroy the session. Returns the full
// concatenated summary. Throws on genuine failure; on abort (including abort
// during create) resolves with whatever text streamed so far.
export async function summarize({ type, format, length, text, signal, onChunk }) {
  const opts = { type, format, length }
  if (signal) opts.signal = signal

  let summarizer
  let full = ''
  try {
    summarizer = await Summarizer.create(opts)
    for await (const chunk of summarizer.summarizeStreaming(text, { signal })) {
      full += chunk
      onChunk?.(chunk)
    }
    return full
  } catch (err) {
    if (err?.name === 'AbortError' || signal?.aborted) return full
    throw err
  } finally {
    summarizer?.destroy()
  }
}
