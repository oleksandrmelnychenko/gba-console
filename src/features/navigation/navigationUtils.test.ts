import { describe, expect, it } from 'vitest'
import {
  findNavigationMatch,
  getNavigationNodePath,
  isNavigationNodeActive,
  isNavigationNodeRouteTarget,
  normalizeNavigation,
} from './navigationUtils'
import type { NavigationModule, NavigationNode } from './types'

describe('normalizeNavigation', () => {
  it('removes disabled API navigation entries', () => {
    const modules: NavigationModule[] = [
      {
        Id: 1,
        Module: 'Меню',
        Children: [
          {
            Id: 11,
            Module: 'Активний розділ',
            Route: '/active',
          },
          {
            Id: 12,
            NetUid: 'd27584ab-ac29-4994-b1d1-016af5f073b1',
            Module: 'Вилучений розділ',
            Route: '/removed',
            Children: [
              {
                Id: 121,
                Module: 'Вкладений розділ',
                Route: '/removed/new',
              },
            ],
          },
        ],
      },
    ]

    const [ordersModule] = normalizeNavigation(modules)

    expect(ordersModule.Children.map((node) => node.Module)).toEqual(['Активний розділ'])
  })
})

describe('getNavigationNodePath', () => {
  it('preserves query and hash when normalizing navigation targets', () => {
    const node: NavigationNode = {
      Id: 1,
      Module: 'Доступні платежі',
      Route: 'accounting/available-payments/?type=2&operationType=4#pending',
    }

    expect(getNavigationNodePath(node)).toBe('/accounting/available-payments?type=2&operationType=4#pending')
  })

  it('preserves hash-only navigation targets', () => {
    const node: NavigationNode = {
      Id: 1,
      Module: 'Панель',
      Route: '/dashboard/#rates',
    }

    expect(getNavigationNodePath(node)).toBe('/dashboard#rates')
  })
})

describe('isNavigationNodeActive', () => {
  it('matches backend routes by pathname without treating query or hash as route segments', () => {
    const node: NavigationNode = {
      Id: 1,
      Module: 'Доступні платежі',
      Route: '/accounting/available-payments?type=2&operationType=4#pending',
    }

    expect(isNavigationNodeActive(node, '/accounting/available-payments')).toBe(true)
    expect(isNavigationNodeActive(node, '/accounting/available-payments?type=3#other')).toBe(true)
  })
})

describe('isNavigationNodeRouteTarget', () => {
  it('matches exact navigation targets while ignoring query and hash', () => {
    const node: NavigationNode = {
      Id: 1,
      Module: 'Доступні платежі',
      Route: '/accounting/available-payments?type=2&operationType=4#pending',
    }

    expect(isNavigationNodeRouteTarget(node, '/accounting/available-payments')).toBe(true)
    expect(isNavigationNodeRouteTarget(node, '/accounting/available-payments?type=3#other')).toBe(true)
  })

  it('does not treat parent navigation nodes as exact fallback targets', () => {
    const node: NavigationNode = {
      Id: 1,
      Module: 'Клієнти',
      Route: '/clients',
    }

    expect(isNavigationNodeRouteTarget(node, '/clients/missing')).toBe(false)
  })

  it('does not treat empty routes as exact fallback targets', () => {
    const node: NavigationNode = {
      Id: 1,
      Module: 'Без маршруту',
      Route: '',
    }

    expect(isNavigationNodeRouteTarget(node, '/dashboard')).toBe(false)
    expect(isNavigationNodeActive(node, '/dashboard')).toBe(false)
  })
})

describe('findNavigationMatch', () => {
  it('finds backend navigation nodes whose routes include query parameters', () => {
    const modules: NavigationModule[] = [
      {
        Id: 1,
        Module: 'Меню',
        Children: [
          {
            Id: 11,
            Module: 'Доступні платежі',
            Route: '/accounting/available-payments?type=2&operationType=4',
          },
        ],
      },
    ]

    expect(findNavigationMatch(modules, '/accounting/available-payments')?.node.Module).toBe('Доступні платежі')
  })
})
