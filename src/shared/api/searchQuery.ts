export type ServerBooleanFilter = {
  CssClass?: string
  Name?: string
  SQL: string
  Value: boolean
}

export type ServerSearchSortDescriptor = {
  Column: string
  Dir: 'asc' | 'desc'
}

export type ServerSearchQueryOptions = {
  booleanFilter?: ServerBooleanFilter | null
  filterEntityType?: number
  filterOperationSql?: string
  filterSql?: string
  limit: number
  offset: number
  sortDescriptors?: ServerSearchSortDescriptor[]
  table: string
  typeRoleFilter?: string
  value?: string
  extra?: Record<string, unknown>
}

export function buildServerSearchFilter(options: ServerSearchQueryOptions): string {
  const query = {
    Table: options.table,
    Offset: options.offset,
    Limit: options.limit,
    BooleanFilter: options.booleanFilter ? JSON.stringify(options.booleanFilter) : '',
    Filter: buildFilterByItem(options),
    TypeRoleFilter: options.typeRoleFilter || '',
    SortDescriptors: options.sortDescriptors || [],
    ...options.extra,
  }

  return JSON.stringify(query)
}

function buildFilterByItem(options: ServerSearchQueryOptions): string {
  if (!options.filterSql) {
    return ''
  }

  return JSON.stringify({
    Value: options.value || '',
    FilterItem: {
      ...(typeof options.filterEntityType === 'number' ? { Type: options.filterEntityType } : {}),
      SQL: options.filterSql,
      FilterOperationItem: {
        SQL: options.filterOperationSql || 'Contains',
      },
    },
  })
}
