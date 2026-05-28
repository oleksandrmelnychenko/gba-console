import { describe, expect, it } from 'vitest'
import { buildServerSearchFilter } from './searchQuery'

type SerializedSearchPayload = {
  BooleanFilter: string
  Filter: string
  Limit: number
  Offset: number
  SortDescriptors: unknown[]
  Table: string
  TypeRoleFilter: string
  forReSale?: boolean | null
}

function parseSearchPayload(value: string): SerializedSearchPayload {
  return JSON.parse(value) as SerializedSearchPayload
}

describe('buildServerSearchFilter', () => {
  it('serializes the base server search envelope', () => {
    const payload = parseSearchPayload(buildServerSearchFilter({
      table: 'Client',
      offset: 25,
      limit: 50,
    }))

    expect(payload).toEqual({
      Table: 'Client',
      Offset: 25,
      Limit: 50,
      BooleanFilter: '',
      Filter: '',
      TypeRoleFilter: '',
      SortDescriptors: [],
    })
  })

  it('serializes filter criteria with the server filter item shape', () => {
    const payload = parseSearchPayload(buildServerSearchFilter({
      table: 'Client',
      offset: 0,
      limit: 20,
      value: 'Acme',
      filterEntityType: 7,
      filterSql: 'Client.FullName',
    }))

    expect(JSON.parse(payload.Filter)).toEqual({
      Value: 'Acme',
      FilterItem: {
        Type: 7,
        SQL: 'Client.FullName',
        FilterOperationItem: {
          SQL: 'Contains',
        },
      },
    })
  })

  it('serializes boolean, role, sort, and extra fields', () => {
    const booleanFilter = {
      CssClass: 'active_clients',
      Name: 'ShowOnlyActive',
      SQL: 'IsActive',
      Value: true,
    }
    const sortDescriptors = [{ Column: 'FullName', Dir: 'asc' as const }]

    const payload = parseSearchPayload(buildServerSearchFilter({
      table: 'Client',
      offset: 5,
      limit: 10,
      value: 'Kyiv',
      filterSql: 'RegionCode.Value',
      filterOperationSql: 'StartsWith',
      booleanFilter,
      typeRoleFilter: 'ClientTypeRole.Id = 7',
      sortDescriptors,
      extra: {
        forReSale: false,
      },
    }))

    expect(JSON.parse(payload.BooleanFilter)).toEqual(booleanFilter)
    expect(JSON.parse(payload.Filter)).toEqual({
      Value: 'Kyiv',
      FilterItem: {
        SQL: 'RegionCode.Value',
        FilterOperationItem: {
          SQL: 'StartsWith',
        },
      },
    })
    expect(payload.TypeRoleFilter).toBe('ClientTypeRole.Id = 7')
    expect(payload.SortDescriptors).toEqual(sortDescriptors)
    expect(payload.forReSale).toBe(false)
  })
})
