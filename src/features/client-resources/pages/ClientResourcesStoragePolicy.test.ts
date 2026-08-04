import { describe, expect, it } from 'vitest'
import type { ClientResourceOrganization } from '../types'
import { buildSaleOrganizationsByStorageId } from '../clientResourceStorageOrganizations'

describe('client resources canonical sale storage', () => {
  it('shows every organization that shares a canonical storage', () => {
    const organizations: ClientResourceOrganization[] = [
      { Id: 1, Name: 'Фенікс', StorageId: 2448 },
      { Id: 2, Name: 'ФОП Самолюк Алла Дмитрівна', StorageId: 2448 },
      { Id: 3, Name: 'ТОВ «АМГ «КОНКОРД»', StorageId: 2443 },
      { Id: 4, Name: 'Без основного складу' },
    ]

    const result = buildSaleOrganizationsByStorageId(organizations)

    expect(result.get(2448)).toEqual([
      'Фенікс',
      'ФОП Самолюк Алла Дмитрівна',
    ])
    expect(result.get(2443)).toEqual(['ТОВ «АМГ «КОНКОРД»'])
    expect(result.size).toBe(2)
  })

  it('uses the Ukrainian organization translation in the row description', () => {
    const result = buildSaleOrganizationsByStorageId([
      {
        Id: 1,
        Name: 'Fenix fallback',
        OrganizationTranslations: [
          { CultureCode: 'uk', Name: 'Фенікс' },
        ],
        StorageId: 2448,
      },
    ])

    expect(result.get(2448)).toEqual(['Фенікс'])
  })
})
