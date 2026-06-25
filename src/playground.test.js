import { getParams } from './playground.js'

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
