const GENERIC_LEAF = /^(без пдв|з пдв|пдв|кількість|сума|результат)$/iu
const GROUP_UNIT = /,\s*([A-Z]{3}|%)$/u

export function compactMeasureCaptions(paths: readonly (readonly string[])[]): string[] | null {
  if (!paths.length || paths.some(path => path.length !== 2)) return null
  if (paths.some(([, leaf]) => leaf.trim().length < 10 || GENERIC_LEAF.test(leaf.trim()))) return null
  const captions = paths.map(([group, leaf]) => {
    const unit = GROUP_UNIT.exec(group.trim())?.[1]
    return unit && !leaf.includes(unit) ? `${leaf.trim()}, ${unit}` : leaf.trim()
  })
  return new Set(captions).size === captions.length ? captions : null
}

export function isMeasureOnlyColumnSchema(schema: readonly { Identity?: string }[]): boolean {
  return schema.length === 2 && schema[0]?.Identity === '$measureGroup' && schema[1]?.Identity === '$measure'
}
