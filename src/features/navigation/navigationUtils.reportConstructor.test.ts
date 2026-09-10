import { describe, expect, it } from 'vitest'
import {
  findNavigationMatch,
  getNavigationNodePath,
  isNavigationNodeActive,
  isNavigationPathAllowed,
  normalizeNavigation,
} from './navigationUtils'
import type { NavigationModule } from './types'

function reportsNavigation(route: string): NavigationModule[] {
  return [{
    Id: 1,
    Module: 'Звіти',
    Children: [{ Id: 12, NetUid: 'existing-report-node', Module: 'Звіт залишків', Route: route }],
  }]
}

describe('report constructor navigation', () => {
  it.each(['/reports/stocks', '/reports/constructor'])(
    'uses the existing %s node for both report workspace URLs',
    route => {
      const original = reportsNavigation(route)
      const modules = normalizeNavigation(original)
      const node = modules[0].Children[0]

      expect(node).toMatchObject({ Id: 12, NetUid: 'existing-report-node', Route: route, Module: 'Конструктор звітів' })
      expect(original[0].Children[0].Module).toBe('Звіт залишків')
      expect(modules[0].Children).toHaveLength(1)
      expect(getNavigationNodePath(node)).toBe('/reports/constructor')
      for (const path of ['/reports/constructor', '/reports/stocks']) {
        expect(isNavigationPathAllowed(modules, `${path}/?template=123#result`)).toBe(true)
        expect(isNavigationNodeActive(node, path)).toBe(true)
        expect(findNavigationMatch(modules, path)?.node).toBe(node)
      }
    },
  )

  it('preserves query and hash values on menu targets', () => {
    const modules = normalizeNavigation(reportsNavigation('reports/stocks/?template=123#result'))
    const node = modules[0].Children[0]
    expect(node.Route).toBe('reports/stocks/?template=123#result')
    expect(getNavigationNodePath(node)).toBe('/reports/constructor?template=123#result')
    expect(node.Module).toBe('Конструктор звітів')
  })

  it.each(['/reports/sale', '/reports/sales', '/sales/ukraine/all'])(
    'does not derive constructor access from %s',
    route => {
      const modules = normalizeNavigation(reportsNavigation(route))
      expect(isNavigationPathAllowed(modules, '/reports/constructor')).toBe(false)
      expect(modules[0].Children[0].Route).toBe(route)
      expect(getNavigationNodePath(modules[0].Children[0])).toBe(route)
    },
  )

  it('requires an existing menu grant and limits the new alias to the exact workspace', () => {
    expect(isNavigationPathAllowed([], '/reports/constructor')).toBe(false)
    const modules = normalizeNavigation(reportsNavigation('/reports/stocks'))
    for (const path of ['/reports/constructor/details', '/reports/constructor-other', '/reports/registers', '/reports/sale']) {
      expect(isNavigationPathAllowed(modules, path)).toBe(false)
    }
    expect(isNavigationPathAllowed(reportsNavigation('/reports/constructor'), '/reports/stocks/details')).toBe(false)
  })
})
