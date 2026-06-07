import type { NavigationMatch, NavigationModule, NavigationNode } from './types'

const wildcardRouteSegments = new Set(['all', 'edit', 'new'])
const removedNavigationNodeNetUids = new Set(['d27584ab-ac29-4994-b1d1-016af5f073b1'])
const removedNavigationLabelPatterns = [/перевізник.*польщ|польщ.*перевізник/i]

export function normalizeNavigation(modules: NavigationModule[] | null | undefined): NavigationModule[] {
  const normalizedModules: NavigationModule[] = []

  for (const module of modules || []) {
    if (!module?.Module || isRemovedNavigationModule(module)) {
      continue
    }

    normalizedModules.push({
      ...module,
      Children: normalizeNavigationNodes(module.Children),
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
  let activeScore = -1

  for (const node of nodes) {
    if (!isNavigationNodeActive(node, pathname)) {
      continue
    }

    const routeLength = splitPath(node.Route).length
    const queryScore = getRouteQueryScore(node.Route, pathname)
    const routeScore = routeLength * 1000 + queryScore

    if (routeScore > activeScore) {
      activeNode = node
      activeScore = routeScore
    }
  }

  return activeNode
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
  return hasRemovedNavigationNetUid(node.NetUid) || hasRemovedNavigationLabel(node.Module)
}

function hasRemovedNavigationNetUid(netUid: string | undefined): boolean {
  return Boolean(netUid && removedNavigationNodeNetUids.has(netUid))
}

function hasRemovedNavigationLabel(label: string | undefined): boolean {
  return Boolean(label && removedNavigationLabelPatterns.some((pattern) => pattern.test(label)))
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
