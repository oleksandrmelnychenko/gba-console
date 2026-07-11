export type SemanticTransporterIcon = 'bus' | 'self-pickup' | null

export function getSemanticTransporterIcon(
  cssClass?: string | null,
  name?: string | null,
): SemanticTransporterIcon {
  const normalizedClass = cssClass?.trim()
  const normalizedName = normalizeTransporterName(name || '')

  if (normalizedClass === 'bus_item_class' || normalizedName === 'автобус' || normalizedName === 'bus') {
    return 'bus'
  }

  if (
    normalizedClass === 'self_checkout_item_class'
    || normalizedName === 'самовивіз'
    || normalizedName === 'самовывоз'
    || normalizedName === 'selfpickup'
  ) {
    return 'self-pickup'
  }

  return null
}

function normalizeTransporterName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('uk-UA')
    .replace(/[\s\-_'".,`’«»()]+/g, '')
}
