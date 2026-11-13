import { describe, expect, it } from 'vitest'
import {
  findNavigationMatch,
  getNavigationNodePath,
  isNavigationPathAllowed,
  normalizeNavigation } from './navigationUtils'
import type { NavigationModule } from './types'


function reportsNavigation(route: string): NavigationModule[] {
  return [{
    Id: 1,
    Module: 'Звіти',
    Children: [{ Id: 12, NetUid: 'existing-report-node', Module: 'Звіт залишків', Route: route }],
  }]
}

describe('BUG-1274-only report navigation', () => {
  it.each(['/reports/stocks', '/reports/constructor'])(
    'labels the existing %s node as reports and opens the BUG-1274 reports page',
    route => {
      const modules = normalizeNavigation(reportsNavigation(route))
      const node = modules[0].Children[0]
      expect(node).toMatchObject({ Id: 12, NetUid: 'existing-report-node', Route: route, Module: 'Звіти' })
      expect(getNavigationNodePath(node)).toBe('/reports/stocks')
      for (const path of ['/reports/stocks', '/reports/constructor', '/reports/registers', '/reports/sale', '/reports/sales']) {
        expect(isNavigationPathAllowed(modules, path), path).toBe(true)
        expect(findNavigationMatch(modules, path)?.node, path).toBe(node)
      }
      for (const path of ['/reports/sale/details', '/reports/sales-other', '/reports/registers/details']) {
        expect(isNavigationPathAllowed(modules, path), path).toBe(false)
      }
    },
  )

  it('keeps query and hash values on the reports page target', () => {
    const node = normalizeNavigation(reportsNavigation('reports/constructor/?template=123#result'))[0].Children[0]
    expect(getNavigationNodePath(node)).toBe('/reports/stocks?template=123#result')
  })

  it.each(['/reports/sale', '/reports/sales', 'reports/sale/?file=1'])('hides the sale-file report node %s', route => {
    const modules = normalizeNavigation([{ Id: 1, Module: 'Звіти', Children: [
      { Id: 12, Module: 'Конструктор', Route: '/reports/stocks' },
      { Id: 13, Module: 'Перегляд звіту з файла', Route: route },
    ] }])
    expect(modules[0].Children.map(node => node.Id)).toEqual([12])
    expect(normalizeNavigation(reportsNavigation(route))).toEqual([])
    expect(isNavigationPathAllowed(normalizeNavigation(reportsNavigation(route)), '/reports/sale')).toBe(false)
  })
})
