import type { NavigationMatch, NavigationModule, NavigationNode } from './types'

const wildcardRouteSegments = new Set(['all', 'edit', 'new'])
const removedNavigationNodeNetUids = new Set(['d27584ab-ac29-4994-b1d1-016af5f073b1'])
// Frontend label overrides for backend-provided menu items whose names we want
// to present differently than the source DB label. Keyed by the exact backend
// label; the override flows into both the side menu and the breadcrumb.
const navigationLabelOverrides = new Map<string, string>([
  ['Кокпіт продажів', 'Завдання продажів'],
])
const removedNavigationLabelPatterns = [/allegro/i, /poland/i, /польщ/i]
const removedNavigationRoutePatterns = [
  /^\/?orders\/poland(?:\/|$)/i,
  /^\/?products\/income\/poland(?:\/|$)/i,
  /^\/?products\/pl-income-order(?:\/|$)/i,
  // PL/export workflow is not active in the current console data scope.
  /^\/?sad(?:\/|$)/i,
  /^\/?sales\/allegro(?:\/|$)/i,
  /^\/?sales\/poland(?:\/|$)/i,
  /^\/?tax-free(?:\/|$)/i,
  /^\/?warehouse\/poland(?:\/|$)/i,
]
const navigationRouteAliasRules: Array<{ source: string; targets: RegExp[] }> = [
  {
    source: '/orders/ukraine/all',
    targets: [
      /^\/orders\/develop\/all\/edit\/[^/]+\/specifications$/i,
      /^\/orders\/ukraine\/all\/(?:new|edit\/[^/]+(?:\/.*)?)$/i,
      /^\/orders\/ukraine\/(?:to-ukraine\/new|view\/[^/]+|placement\/[^/]+|protocols\/[^/]+|[^/]+\/product-income)$/i,
      /^\/supply-orders\/product-placement\/[^/]+$/i,
    ],
  },
  {
    source: '/sales/ukraine/all',
    targets: [
      /^\/resales(?:\/.*)?$/i,
      /^\/sales\/charts$/i,
      /^\/sales\/return\/client$/i,
      /^\/sales\/ukraine\/(?:all\/returns\/new|cart-reserve|client-product-movement|debtors|interest|offers|prediction)$/i,
    ],
  },
  {
    source: '/accounting/available-payments',
    targets: [
      /^\/payments\/available$/i,
    ],
  },
  {
    source: '/payments/available',
    targets: [
      /^\/accounting\/available-payments$/i,
    ],
  },
  {
    source: '/accounting/income-cashflows',
    targets: [
      /^\/accounting\/income-cashflows\/new\/(?:client|conversion|shop|user)$/i,
    ],
  },
  {
    source: '/accounting/outgoing-cashflow',
    targets: [
      /^\/accounting\/outgoing-cashflow\/new(?:\/(?:simple|supplier|client-return|group|payment-tasks))?$/i,
      /^\/accounting\/outgoing-cashflow\/[^/]+\/advanced-report\/view$/i,
    ],
  },
  {
    source: '/accounting/advanced-reports',
    targets: [
      /^\/accounting\/outgoing-cashflow\/[^/]+\/advanced-report\/view$/i,
    ],
  },
  {
    source: '/basket-supply-ukraine-order/cockpit',
    targets: [
      /^\/basket-supply-ukraine-order(?:\/.*)?$/i,
    ],
  },
]

export function normalizeNavigation(modules: NavigationModule[] | null | undefined): NavigationModule[] {
  const normalizedModules: NavigationModule[] = []

  for (const module of modules || []) {
    if (!module?.Module || isRemovedNavigationModule(module)) {
      continue
    }

    const children = normalizeNavigationNodes(module.Children)

    if (children.length === 0) {
      continue
    }

    normalizedModules.push({
      ...module,
      Module: overrideNavigationLabel(module.Module),
      Children: children,
    })
  }

  return normalizedModules.sort((left, right) => left.Module.localeCompare(right.Module, 'uk'))
}

function normalizeNavigationNodes(nodes: NavigationNode[] | null | undefined): NavigationNode[] {
  const normalizedNodes: NavigationNode[] = []

  for (const node of nodes || []) {
    if (!node?.Module || isRemovedNavigationNode(node)) {
      continue
    }

    normalizedNodes.push({
      ...node,
      Module: overrideNavigationLabel(node.Module),
      Children: normalizeNavigationNodes(node.Children),
    })
  }

  return normalizedNodes.sort((left, right) => left.Module.localeCompare(right.Module, 'uk'))
}

export function getModuleKey(module: NavigationModule): string {
  return module.NetUid || String(module.Id)
}

function overrideNavigationLabel(label: string | undefined): string {
  return (label && navigationLabelOverrides.get(label)) || label || ''
}

export function getNavigationNodePath(node: NavigationNode): string {
  return normalizeNavigationTarget(node.Route || '/dashboard')
}

export function findNavigationMatch(modules: NavigationModule[], pathname: string): NavigationMatch | null {
  for (const module of modules) {
    const node = findActiveNode(module.Children, pathname)

    if (node) {
      return { module, node }
    }
  }

  return null
}

export function isNavigationPathAllowed(modules: NavigationModule[], pathname: string): boolean {
  const normalizedPath = normalizePath(pathname)

  if (normalizedPath === '/' || normalizedPath === '/dashboard') {
    return true
  }

  return modules.some((module) => hasAllowedNavigationNode(module.Children, pathname))
}

export function isNavigationNodeActive(node: NavigationNode, pathname: string): boolean {
  const routeSegments = splitPath(node.Route)
  const currentSegments = splitPath(pathname)

  if (routeSegments.length === 0 || currentSegments.length === 0) {
    return false
  }

  for (let index = 0; index < routeSegments.length; index += 1) {
    const segment = routeSegments[index]

    if (segment !== currentSegments[index] && !wildcardRouteSegments.has(segment)) {
      return false
    }
  }

  return true
}

export function isNavigationNodeRouteTarget(node: NavigationNode, pathname: string): boolean {
  const routeSegments = splitPath(node.Route)
  const currentSegments = splitPath(pathname)

  return (
    routeSegments.length > 0 &&
    routeSegments.length === currentSegments.length &&
    routeSegments.every((segment, index) => segment === currentSegments[index])
  )
}

function hasAllowedNavigationNode(nodes: NavigationNode[], pathname: string): boolean {
  for (const node of nodes) {
    if (isNavigationNodePathAllowed(node, pathname) || hasAllowedNavigationNode(node.Children || [], pathname)) {
      return true
    }
  }

  return false
}

function isNavigationNodePathAllowed(node: NavigationNode, pathname: string): boolean {
  const routeSegments = splitPath(node.Route)
  const currentSegments = splitPath(pathname)

  const exactOrDescendantMatch = (
    routeSegments.length > 0 &&
    currentSegments.length >= routeSegments.length &&
    routeSegments.every((segment, index) => segment === currentSegments[index])
  )

  return exactOrDescendantMatch || isNavigationAliasPathAllowed(node.Route, pathname)
}

function isNavigationAliasPathAllowed(route: string | undefined, pathname: string): boolean {
  const normalizedRoute = normalizePath(route || '')
  const normalizedPath = normalizePath(pathname)
  const rule = navigationRouteAliasRules.find((item) => item.source === normalizedRoute)

  return Boolean(rule && rule.targets.some((target) => target.test(normalizedPath)))
}

function findActiveNode(nodes: NavigationNode[], pathname: string): NavigationNode | null {
  let activeNode: NavigationNode | null = null
  let activeScore = -1

  for (const node of nodes) {
    if (isNavigationNodeActive(node, pathname)) {
      const routeScore = getActiveNodeScore(node, pathname)

      if (routeScore > activeScore) {
        activeNode = node
        activeScore = routeScore
      }
    }

    const childNode = findActiveNode(node.Children || [], pathname)

    if (childNode) {
      const routeScore = getActiveNodeScore(childNode, pathname)

      if (routeScore > activeScore) {
        activeNode = childNode
        activeScore = routeScore
      }
    }
  }

  return activeNode
}

function getActiveNodeScore(node: NavigationNode, pathname: string): number {
  const routeLength = splitPath(node.Route).length
  const queryScore = getRouteQueryScore(node.Route, pathname)

  return routeLength * 1000 + queryScore
}

function getRouteQueryScore(route: string | undefined, currentPath: string): number {
  const routeParams = getRouteSearchParams(route)

  if (routeParams.size === 0) {
    return 0
  }

  const currentParams = getRouteSearchParams(currentPath)

  for (const [key, value] of routeParams) {
    if (currentParams.get(key) !== value) {
      return -1
    }
  }

  return routeParams.size
}

function isRemovedNavigationModule(module: NavigationModule): boolean {
  return hasRemovedNavigationNetUid(module.NetUid) || hasRemovedNavigationLabel(module.Module)
}

function isRemovedNavigationNode(node: NavigationNode): boolean {
  return hasRemovedNavigationNetUid(node.NetUid) || hasRemovedNavigationLabel(node.Module) || hasRemovedNavigationRoute(node.Route)
}

function hasRemovedNavigationNetUid(netUid: string | undefined): boolean {
  return Boolean(netUid && removedNavigationNodeNetUids.has(netUid))
}

function hasRemovedNavigationLabel(label: string | undefined): boolean {
  return Boolean(label && removedNavigationLabelPatterns.some((pattern) => pattern.test(label)))
}

function hasRemovedNavigationRoute(route: string | undefined): boolean {
  return Boolean(route && removedNavigationRoutePatterns.some((pattern) => pattern.test(normalizePath(route))))
}

function normalizeNavigationTarget(path: string): string {
  const { pathname, suffix } = splitRouteTarget(path)

  return `${normalizePath(pathname)}${suffix}`
}

function normalizePath(path: string): string {
  const { pathname } = splitRouteTarget(path)
  const withSlash = pathname.startsWith('/') ? pathname : `/${pathname}`
  const trimmed = withSlash.replace(/\/+$/, '')

  return trimmed || '/'
}

function splitRouteTarget(path: string): { pathname: string; suffix: string } {
  const queryIndex = path.indexOf('?')
  const hashIndex = path.indexOf('#')
  const suffixIndex =
    queryIndex === -1 ? hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex)

  if (suffixIndex === -1) {
    return { pathname: path, suffix: '' }
  }

  return {
    pathname: path.slice(0, suffixIndex),
    suffix: path.slice(suffixIndex),
  }
}

function getRouteSearchParams(path: string | undefined): URLSearchParams {
  if (!path) {
    return new URLSearchParams()
  }

  const queryIndex = path.indexOf('?')

  if (queryIndex === -1) {
    return new URLSearchParams()
  }

  const hashIndex = path.indexOf('#', queryIndex)
  const query = hashIndex === -1 ? path.slice(queryIndex + 1) : path.slice(queryIndex + 1, hashIndex)

  return new URLSearchParams(query)
}

function splitPath(path?: string): string[] {
  if (!path) {
    return []
  }

  return normalizePath(path).split('/').filter(Boolean)
}
