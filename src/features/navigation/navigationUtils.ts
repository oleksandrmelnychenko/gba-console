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
  return normalizePath(node.Route || '/dashboard')
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
  return hasRemovedNavigationNetUid(node.NetUid) || hasRemovedNavigationLabel(node.Module)
}

function hasRemovedNavigationNetUid(netUid: string | undefined): boolean {
  return Boolean(netUid && removedNavigationNodeNetUids.has(netUid))
}

function hasRemovedNavigationLabel(label: string | undefined): boolean {
  return Boolean(label && removedNavigationLabelPatterns.some((pattern) => pattern.test(label)))
}

function normalizePath(path: string): string {
  const pathOnly = path.split('?')[0].split('#')[0]
  const withSlash = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`
  const trimmed = withSlash.replace(/\/+$/, '')

  return trimmed || '/'
}

function splitPath(path: string): string[] {
  return normalizePath(path).split('/').filter(Boolean)
}
