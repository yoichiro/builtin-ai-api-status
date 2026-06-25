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
