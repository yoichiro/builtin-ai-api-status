import { getParams, runPrompt } from './playground.js'

describe('getParams', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('maps LanguageModel.params() into the prefill shape', async () => {
    vi.stubGlobal('LanguageModel', {
      params: async () => ({
        defaultTemperature: 0.8,
        maxTemperature: 2.0,
        defaultTopK: 3,
        maxTopK: 128,
      }),
    })
    const p = await getParams()
    expect(p).toEqual({
      defaultTemperature: 0.8,
      maxTemperature: 2.0,
      defaultTopK: 3,
      maxTopK: 128,
    })
  })
})

function makeSession({ chunks = [], destroy = vi.fn(), throwAfter = null }) {
  return {
    promptStreaming: vi.fn(async function* () {
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

describe('runPrompt', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('streams chunks to onChunk and resolves with the full text', async () => {
    const destroy = vi.fn()
    const session = makeSession({ chunks: ['Hello', ', ', 'world'], destroy })
    vi.stubGlobal('LanguageModel', { create: vi.fn(async () => session) })
    const onChunk = vi.fn()

    const full = await runPrompt({
      systemPrompt: 'You are helpful.',
      temperature: 0.8,
      topK: 3,
      prompt: 'hi',
      onChunk,
    })

    expect(full).toBe('Hello, world')
    expect(onChunk.mock.calls.map(c => c[0])).toEqual(['Hello', ', ', 'world'])
    expect(destroy).toHaveBeenCalled()
  })

  it('passes systemPrompt and params to create()', async () => {
    const create = vi.fn(async () => makeSession({ chunks: ['x'] }))
    vi.stubGlobal('LanguageModel', { create })
    await runPrompt({ systemPrompt: 'sys', temperature: 1.2, topK: 5, prompt: 'p', onChunk: vi.fn() })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      temperature: 1.2,
      topK: 5,
      initialPrompts: [{ role: 'system', content: 'sys' }],
    }))
  })

  it('throws when create() rejects', async () => {
    vi.stubGlobal('LanguageModel', { create: vi.fn(async () => { throw new Error('boom') }) })
    await expect(runPrompt({ prompt: 'p', onChunk: vi.fn() })).rejects.toThrow('boom')
  })

  it('resolves with partial text and destroys session when aborted', async () => {
    const destroy = vi.fn()
    const session = makeSession({ chunks: ['part', 'never'], throwAfter: 1, destroy })
    vi.stubGlobal('LanguageModel', { create: vi.fn(async () => session) })
    const controller = new AbortController()
    const onChunk = vi.fn()

    const full = await runPrompt({ prompt: 'p', signal: controller.signal, onChunk })

    expect(full).toBe('part')
    expect(onChunk).toHaveBeenCalledWith('part')
    expect(destroy).toHaveBeenCalled()
  })

  it('resolves with empty text when aborted during create()', async () => {
    const destroy = vi.fn()
    vi.stubGlobal('LanguageModel', {
      create: vi.fn(async () => {
        const err = new Error('aborted')
        err.name = 'AbortError'
        throw err
      }),
    })
    const controller = new AbortController()
    const full = await runPrompt({ prompt: 'p', signal: controller.signal, onChunk: vi.fn() })
    expect(full).toBe('')
    expect(destroy).not.toHaveBeenCalled()
  })
})
