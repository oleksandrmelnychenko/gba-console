import { describe, expect, it } from 'vitest'

import { toggleAllPages, validatePasswordPair } from './utils'
import type { DashboardNodeModule } from './types'

describe('validatePasswordPair', () => {
  it('accepts a valid password with a special character in the middle', () => {
    expect(validatePasswordPair('Hrimm_jow92', 'Hrimm_jow92')).toBeNull()
  })

  it('rejects a password without a special character', () => {
    expect(validatePasswordPair('Hrimmjow92', 'Hrimmjow92')).not.toBeNull()
  })
})

describe('toggleAllPages', () => {
  const modules: DashboardNodeModule[] = [
    {
      NetUid: 'module-a',
      Children: [
        {
          NetUid: 'page-a',
          Children: [
            {
              NetUid: 'page-a-child',
            },
          ],
        },
        {
          NetUid: 'page-b',
        },
      ],
    },
    {
      NetUid: 'module-b',
      Children: [
        {
          NetUid: 'page-c',
        },
      ],
    },
  ]

  it('selects nested pages from every module', () => {
    expect(toggleAllPages([], modules).map((node) => node.NetUid)).toEqual([
      'page-a',
      'page-a-child',
      'page-b',
      'page-c',
    ])
  })

  it('removes all module pages when they are already selected', () => {
    const selected = toggleAllPages([], modules)

    expect(toggleAllPages(selected, modules)).toEqual([])
  })
})
