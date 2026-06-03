import { describe, expect, it } from 'vitest'
import { buildRootProductGroupChanges } from './utils'
import type { ProductGroup } from './types'

describe('product group utils', () => {
  it('marks fallback root relation as deleted when changing root group', () => {
    const productGroup: ProductGroup = {
      Id: 10,
      Name: 'Filters',
      NetUid: 'group-10',
      RootProductGroup: {
        Id: 1,
        Name: 'Old root',
        NetUid: 'root-old',
      },
      RootProductGroups: [],
    }
    const selectedRoot: ProductGroup = {
      Id: 2,
      Name: 'New root',
      NetUid: 'root-new',
    }

    const changes = buildRootProductGroupChanges(productGroup, selectedRoot)

    expect(changes).toEqual([
      expect.objectContaining({
        Deleted: true,
        RootProductGroup: expect.objectContaining({ NetUid: 'root-old' }),
        RootProductGroupId: 1,
        SubProductGroup: expect.objectContaining({ NetUid: 'group-10' }),
        SubProductGroupId: 10,
      }),
      {
        RootProductGroup: selectedRoot,
      },
    ])
  })
})
