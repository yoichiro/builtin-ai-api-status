import { summarize } from './summarizer.js'

function makeSummarizer({ chunks = [], destroy = vi.fn(), throwAfter = null }) {
  return {
    summarizeStreaming: vi.fn(async function* () {
      for (let i = 0; i < chunks.length; i++) {
        if (throwAfter === i) {
          const err = new Error('aborted')
          err.name = 'AbortError'
          throw err
        }
        yield chunks[i]
      }
    }),
    destroy,
  }
}

describe('summarize', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('streams chunks to onChunk and resolves with the full text', async () => {
    const destroy = vi.fn()
    const session = makeSummarizer({ chunks: ['The ', 'article ', 'argues X.'], destroy })
    vi.stubGlobal('Summarizer', { create: vi.fn(async () => session) })
    const onChunk = vi.fn()

    const full = await summarize({
      type: 'key-points', format: 'markdown', length: 'medium',
      text: 'long text', onChunk,
    })

    expect(full).toBe('The article argues X.')
    expect(onChunk.mock.calls.map(c => c[0])).toEqual(['The ', 'article ', 'argues X.'])
    expect(destroy).toHaveBeenCalled()
  })

  it('passes type/format/length to create()', async () => {
    const create = vi.fn(async () => makeSummarizer({ chunks: ['x'] }))
    vi.stubGlobal('Summarizer', { create })
    await summarize({ type: 'tldr', format: 'plain-text', length: 'short', text: 't', onChunk: vi.fn() })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'tldr', format: 'plain-text', length: 'short',
    }))
  })

  it('throws when create() rejects with a non-abort error', async () => {
    vi.stubGlobal('Summarizer', { create: vi.fn(async () => { throw new Error('boom') }) })
    await expect(summarize({ text: 't', onChunk: vi.fn() })).rejects.toThrow('boom')
  })

  it('resolves with partial text and destroys session when aborted mid-stream', async () => {
    const destroy = vi.fn()
    const session = makeSummarizer({ chunks: ['part', 'never'], throwAfter: 1, destroy })
    vi.stubGlobal('Summarizer', { create: vi.fn(async () => session) })
    const controller = new AbortController()
    const onChunk = vi.fn()

    const full = await summarize({ text: 't', signal: controller.signal, onChunk })

    expect(full).toBe('part')
    expect(onChunk).toHaveBeenCalledWith('part')
    expect(destroy).toHaveBeenCalled()
  })

  it('resolves with empty text when aborted during create()', async () => {
    const destroy = vi.fn()
    vi.stubGlobal('Summarizer', {
      create: vi.fn(async () => {
        const err = new Error('aborted')
        err.name = 'AbortError'
        throw err
      }),
    })
    const controller = new AbortController()
    const full = await summarize({ text: 't', signal: controller.signal, onChunk: vi.fn() })
    expect(full).toBe('')
    expect(destroy).not.toHaveBeenCalled()
  })
})
