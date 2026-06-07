import type { NavigationMatch, NavigationModule, NavigationNode } from './types'

const wildcardRouteSegments = new Set(['all', 'edit', 'new'])
const removedNavigationNodeNetUids = new Set(['d27584ab-ac29-4994-b1d1-016af5f073b1'])
const removedNavigationLabelPatterns = [/allegro/i, /poland/i, /польщ/i]
const removedNavigationRoutePatterns = [
  /^\/?orders\/poland(?:\/|$)/i,
  /^\/?products\/income\/poland(?:\/|$)/i,
  /^\/?products\/pl-income-order(?:\/|$)/i,
  /^\/?sales\/allegro(?:\/|$)/i,
  /^\/?sales\/poland(?:\/|$)/i,
  /^\/?warehouse\/poland(?:\/|$)/i,
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
      Children: normalizeNavigationNodes(node.Children),
    })
  }

  return normalizedNodes.sort((left, right) => left.Module.localeCompare(right.Module, 'uk'))
}

export function getModuleKey(module: NavigationModule): string {
  return module.NetUid || String(module.Id)
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

function findActiveNode(nodes: NavigationNode[], pathname: string): NavigationNode | null {
  let activeNode: NavigationNode | null = null
  let activeRouteLength = -1

  for (const node of nodes) {
    if (!isNavigationNodeActive(node, pathname)) {
      continue
    }

    const routeLength = splitPath(node.Route).length

    if (routeLength > activeRouteLength) {
      activeNode = node
      activeRouteLength = routeLength
    }
  }

  return activeNode
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

function splitPath(path?: string): string[] {
  if (!path) {
    return []
  }

  return normalizePath(path).split('/').filter(Boolean)
}
