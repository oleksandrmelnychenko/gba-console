import { describe, expect, it } from 'vitest'
import { filterNavigationByRouteAccess } from './navigationUtils'
import type { NavigationModule } from './types'

const node = (Id: number, Route: string, Module = Route) => ({ Id, Module, Route, Children: [] })

const modules: NavigationModule[] = [
  {
    Id: 1,
    Module: 'Продажі',
    Children: [node(11, '/sales/ukraine/all'), node(12, '/sales/geography')],
  },
  {
    Id: 2,
    Module: 'Адміністрування',
    Children: [node(21, '/accounting/sync/documents')],
  },
  {
    Id: 3,
    Module: 'Контрагенти',
    Children: [node(31, '/clients?roleIds=1')],
  },
]

describe('filterNavigationByRouteAccess', () => {
  it('hides entries whose page the user cannot open and drops empty modules', () => {
    const allowed = new Set(['/sales/ukraine/all', '/clients'])
    const result = filterNavigationByRouteAccess(modules, (path) => allowed.has(path))

    expect(result.map((module) => module.Module)).toEqual(['Продажі', 'Контрагенти'])
    expect(result[0].Children.map((child) => child.Route)).toEqual(['/sales/ukraine/all'])
  })

  it('matches routes without their query string', () => {
    const seen: string[] = []
    filterNavigationByRouteAccess(modules, (path) => {
      seen.push(path)
      return true
    })

    expect(seen).toContain('/clients')
  })

  it('keeps everything when every route is openable', () => {
    expect(filterNavigationByRouteAccess(modules, () => true)).toEqual(modules)
  })
})
