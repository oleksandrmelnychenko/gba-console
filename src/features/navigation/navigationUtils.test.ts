import { describe, expect, it } from 'vitest'
import {
  findNavigationMatch,
  getNavigationNodePath,
  isNavigationPathAllowed,
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

  it('removes unsupported marketplace and Poland navigation entries from API menu', () => {
    const modules: NavigationModule[] = [
      {
        Id: 1,
        Module: 'Продажі',
        Children: [
          {
            Id: 11,
            Module: 'Продажі Україна',
            Route: '/sales/ukraine/all',
          },
          {
            Id: 12,
            Module: 'Allegro',
            Route: '/sales/allegro',
          },
          {
            Id: 13,
            Module: 'Продажі Польща',
            Route: '/sales/poland/all',
          },
        ],
      },
      {
        Id: 2,
        Module: 'Постачання',
        Children: [
          {
            Id: 21,
            Module: 'Замовлення',
            Route: '/orders/poland/all',
          },
        ],
      },
    ]

    const normalizedModules = normalizeNavigation(modules)

    expect(normalizedModules.map((module) => module.Module)).toEqual(['Продажі'])
    expect(normalizedModules[0].Children.map((node) => node.Module)).toEqual(['Продажі Україна'])
  })

  it('removes inactive tax-free and SAD export workflow entries from orders menu', () => {
    const modules: NavigationModule[] = [
      {
        Id: 1,
        Module: 'Замовлення',
        Children: [
          {
            Id: 11,
            Module: 'Акти звірки',
            Route: '/ukraine/act/reconcoliation',
          },
          {
            Id: 12,
            Module: 'Пак лісти',
            Route: '/tax-free/pack-list/all',
          },
          {
            Id: 13,
            Module: 'Перевізники',
            Route: '/tax-free/carriers/all',
          },
          {
            Id: 14,
            Module: 'Tax-Free',
            Route: '/tax-free/all',
          },
          {
            Id: 15,
            Module: 'Експорт',
            Route: '/sad/all',
          },
        ],
      },
    ]

    const [ordersModule] = normalizeNavigation(modules)

    expect(ordersModule.Children.map((node) => node.Module)).toEqual(['Акти звірки'])
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

  it('finds nested backend navigation nodes recursively', () => {
    const modules: NavigationModule[] = [
      {
        Id: 1,
        Module: 'Меню',
        Children: [
          {
            Id: 11,
            Module: 'Батьківський розділ',
            Route: '/accounting',
            Children: [
              {
                Id: 111,
                Module: 'Каси',
                Route: '/accounting/payment-accounts',
              },
            ],
          },
        ],
      },
    ]

    expect(findNavigationMatch(modules, '/accounting/payment-accounts/edit/1')?.node.Module).toBe('Каси')
  })

  it('prefers an exact route in another module over an earlier wildcard route', () => {
    const modules: NavigationModule[] = [
      {
        Id: 1,
        Module: 'Товари',
        Children: [
          {
            Id: 11,
            Module: 'Весь асортимент',
            Route: '/products/all',
          },
        ],
      },
      {
        Id: 2,
        Module: 'Складський облік',
        Children: [
          {
            Id: 21,
            Module: 'Документи приходу',
            Route: '/products/income/documents',
          },
          {
            Id: 22,
            Module: 'Складські позиції',
            Route: '/products/storages',
          },
        ],
      },
    ]

    expect(findNavigationMatch(modules, '/products/storages')).toMatchObject({
      module: { Module: 'Складський облік' },
      node: { Module: 'Складські позиції' },
    })
    expect(findNavigationMatch(modules, '/products/income/documents')).toMatchObject({
      module: { Module: 'Складський облік' },
      node: { Module: 'Документи приходу' },
    })
  })
})

describe('isNavigationPathAllowed', () => {
  it('allows dashboard and descendants of allowed menu nodes', () => {
    const modules: NavigationModule[] = [
      {
        Id: 1,
        Module: 'Меню',
        Children: [
          {
            Id: 11,
            Module: 'Клієнти',
            Route: '/clients',
          },
        ],
      },
    ]

    expect(isNavigationPathAllowed(modules, '/')).toBe(true)
    expect(isNavigationPathAllowed(modules, '/dashboard')).toBe(true)
    expect(isNavigationPathAllowed(modules, '/clients/edit/client-1')).toBe(true)
    expect(isNavigationPathAllowed(modules, '/users')).toBe(false)
  })

  it('does not reuse loose active-menu wildcards for access control', () => {
    const modules: NavigationModule[] = [
      {
        Id: 1,
        Module: 'Меню',
        Children: [
          {
            Id: 11,
            Module: 'Новий користувач',
            Route: '/users/new',
          },
          {
            Id: 12,
            Module: 'Продажі Україна',
            Route: '/sales/ukraine/all',
          },
        ],
      },
    ]

    expect(findNavigationMatch(modules, '/users/edit/user-1')?.node.Module).toBe('Новий користувач')
    expect(isNavigationPathAllowed(modules, '/users/edit/user-1')).toBe(false)
    expect(isNavigationPathAllowed(modules, '/users/new')).toBe(true)
    expect(isNavigationPathAllowed(modules, '/users/new/details')).toBe(true)
    expect(isNavigationPathAllowed(modules, '/sales/ukraine/debtors')).toBe(true)
    expect(isNavigationPathAllowed(modules, '/sales/ukraine/all/returns/new')).toBe(true)
  })

  it('allows explicit migrated sibling routes for known menu roots', () => {
    const modules: NavigationModule[] = [
      {
        Id: 1,
        Module: 'Меню',
        Children: [
          {
            Id: 11,
            Module: 'Замовлення на Україну',
            Route: '/orders/ukraine/all',
          },
          {
            Id: 12,
            Module: 'Продажі Україна',
            Route: '/sales/ukraine/all',
          },
        ],
      },
    ]

    expect(isNavigationPathAllowed(modules, '/orders/ukraine/view/order-1')).toBe(true)
    expect(isNavigationPathAllowed(modules, '/orders/ukraine/protocols/order-1')).toBe(true)
    expect(isNavigationPathAllowed(modules, '/orders/develop/all/edit/order-1/specifications')).toBe(true)
    expect(isNavigationPathAllowed(modules, '/sales/ukraine/offers')).toBe(true)
    expect(isNavigationPathAllowed(modules, '/resales/new')).toBe(true)
    expect(isNavigationPathAllowed(modules, '/accounting/payment-accounts')).toBe(false)
  })

  it('allows accounting compatibility and create routes for known menu roots', () => {
    const modules: NavigationModule[] = [
      {
        Id: 1,
        Module: 'Бухгалтерія',
        Children: [
          {
            Id: 11,
            Module: 'Наявні платежі',
            Route: '/accounting/available-payments',
          },
          {
            Id: 12,
            Module: 'Прихід коштів',
            Route: '/accounting/income-cashflows',
          },
          {
            Id: 13,
            Module: 'Рух коштів',
            Route: '/accounting/outgoing-cashflow',
          },
        ],
      },
    ]

    expect(isNavigationPathAllowed(modules, '/payments/available')).toBe(true)
    expect(isNavigationPathAllowed(modules, '/accounting/income-cashflows/new/shop')).toBe(true)
    expect(isNavigationPathAllowed(modules, '/accounting/outgoing-cashflow/new/client-return')).toBe(true)
    expect(isNavigationPathAllowed(modules, '/accounting/outgoing-cashflow/order-1/advanced-report/view')).toBe(true)
    expect(isNavigationPathAllowed(modules, '/accounting/payment-accounts/new')).toBe(false)
  })

  it('allows opening advance-report details from the advanced reports menu root', () => {
    const modules: NavigationModule[] = [
      {
        Id: 1,
        Module: 'Бухгалтерія',
        Children: [
          {
            Id: 11,
            Module: 'Авансові звіти',
            Route: '/accounting/advanced-reports',
          },
        ],
      },
    ]

    expect(isNavigationPathAllowed(modules, '/accounting/outgoing-cashflow/order-1/advanced-report/view')).toBe(true)
    expect(isNavigationPathAllowed(modules, '/accounting/outgoing-cashflow/new/simple')).toBe(false)
  })

  it('allows available-payments menu nodes to open the accounting canonical route', () => {
    const modules: NavigationModule[] = [
      {
        Id: 1,
        Module: 'Платежі',
        Children: [
          {
            Id: 11,
            Module: 'Наявні платежі',
            Route: '/payments/available',
          },
        ],
      },
    ]

    expect(isNavigationPathAllowed(modules, '/accounting/available-payments')).toBe(true)
  })
})
