import { useDebouncedValue } from '@mantine/hooks'
import { useState } from 'react'

export const REPORT_VALUE_SEARCH_DEBOUNCE_MS = 300
export const REPORT_VALUE_VISIBLE_PILLS = 6
export const REPORT_VALUE_EXACT_ID_PLACEHOLDER = 'Назва або id:123'
export const REPORT_VALUE_LOOKUP_FAILED = 'Не вдалося завантажити значення.'

export function useReportValueSearch() {
  const [search, setSearch] = useState('')
  const [query] = useDebouncedValue(search, REPORT_VALUE_SEARCH_DEBOUNCE_MS)
  return { search, setSearch, query, pending: search !== query }
}

export function reportValueExactId(search: string): string | null {
  return search.startsWith('id:') ? search.slice(3) : null
}
