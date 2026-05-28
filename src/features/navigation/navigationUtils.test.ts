import { describe, expect, it } from 'vitest'
import { normalizeNavigation } from './navigationUtils'
import type { NavigationModule } from './types'

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
