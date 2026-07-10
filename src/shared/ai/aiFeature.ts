type AiFeatureTarget = {
  Children?: AiFeatureTarget[]
  Module?: string
  Route?: string
}

const aiRoutePatterns = [
  /^\/?products\/assortment(?:\/|$)/i,
  /^\/?recommendations(?:\/|$)/i,
  /^\/?basket-supply-ukraine-order\/(?:recommendations|dashboard|cockpit|budget-cart)(?:\/|$)/i,
  /^\/?sales\/cockpit(?:\/|$)/i,
  /^\/?sales\/ukraine\/prediction(?:\/|$)/i,
]

const aiLabelPatterns = [
  /ai|аі|штучн/i,
  /аналітика асортименту/i,
  /завдання продажів/i,
  /закупівельник/i,
  /прогноз продажів/i,
  /платоспроможн/i,
  /рекомендац/i,
]

export function isAiFeatureRoute(route: string | null | undefined): boolean {
  const normalizedRoute = normalizeRoute(route)

  return Boolean(normalizedRoute && aiRoutePatterns.some((pattern) => pattern.test(normalizedRoute)))
}

export function isAiFeatureLabel(label: string | null | undefined): boolean {
  return Boolean(label && aiLabelPatterns.some((pattern) => pattern.test(label)))
}

export function isAiFeatureTarget(target: AiFeatureTarget | null | undefined): boolean {
  return Boolean(target && (isAiFeatureRoute(target.Route) || isAiFeatureLabel(target.Module)))
}

export function hasAiFeatureDescendant(target: { Children?: AiFeatureTarget[] } | null | undefined): boolean {
  return Boolean(target?.Children?.some((child) => isAiFeatureTarget(child) || hasAiFeatureDescendant(child)))
}

function normalizeRoute(route: string | null | undefined): string {
  if (!route) {
    return ''
  }

  const trimmed = route.trim()

  if (!trimmed) {
    return ''
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}
