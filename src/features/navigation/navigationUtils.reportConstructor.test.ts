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
    'uses the existing %s node for the workspace and exact register report URL',
    route => {
      const original = reportsNavigation(route)
      const modules = normalizeNavigation(original)
      const node = modules[0].Children[0]

      expect(node).toMatchObject({ Id: 12, NetUid: 'existing-report-node', Route: route, Module: 'Конструктор звітів' })
      expect(original[0].Children[0].Module).toBe('Звіт залишків')
      expect(modules[0].Children).toHaveLength(1)
      expect(getNavigationNodePath(node)).toBe('/reports/constructor')
      for (const path of ['/reports/constructor', '/reports/stocks', '/reports/registers']) {
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
    'does not derive constructor or register report access from %s',
    route => {
      const modules = normalizeNavigation(reportsNavigation(route))
      expect(isNavigationPathAllowed(modules, '/reports/constructor')).toBe(false)
      expect(isNavigationPathAllowed(modules, '/reports/registers')).toBe(false)
      expect(findNavigationMatch(modules, '/reports/registers')).toBeNull()
      expect(modules[0].Children[0].Route).toBe(route)
      expect(getNavigationNodePath(modules[0].Children[0])).toBe(route)
    },
  )

  it('requires an existing menu grant and limits the new alias to the exact workspace', () => {
    expect(isNavigationPathAllowed([], '/reports/constructor')).toBe(false)
    expect(isNavigationPathAllowed([], '/reports/registers')).toBe(false)
    const modules = normalizeNavigation(reportsNavigation('/reports/stocks'))
    for (const path of ['/reports/constructor/details', '/reports/constructor-other', '/reports/sale']) {
      expect(isNavigationPathAllowed(modules, path)).toBe(false)
    }
    expect(isNavigationPathAllowed(reportsNavigation('/reports/constructor'), '/reports/stocks/details')).toBe(false)
  })

  it.each(['/reports/stocks', '/reports/constructor'])(
    'does not extend the register alias from %s to descendants or similarly named paths',
    route => {
      const modules = normalizeNavigation(reportsNavigation(route))
      for (const path of ['/reports/registers/details', '/reports/registers-other', '/reports/register',
        '/reports/registers//details', '/reports/registers%2Fdetails', '/reports/registers/../sale']) {
        expect(isNavigationPathAllowed(modules, path), path).toBe(false)
        expect(findNavigationMatch(modules, path), path).toBeNull()
      }
    },
  )

  it.each(['/reports/stocks/details', '/reports/constructor/details', '/reports/stocks-other',
    '/reports/constructor-other', '/reports/all'])(
    'requires an exact existing report menu node instead of %s',
    route => {
      expect(isNavigationPathAllowed(normalizeNavigation(reportsNavigation(route)), '/reports/registers')).toBe(false)
    },
  )
})
