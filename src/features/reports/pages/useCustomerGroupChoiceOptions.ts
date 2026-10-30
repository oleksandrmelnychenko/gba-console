import { customerGroupWarehouseQueryError } from '../data/customerGroupWarehouse'
import { customerGroupProductGroupQueryError } from '../data/customerGroupProductGroup'
import { customerGroupAgreementQueryError } from '../data/customerGroupAgreement'
import { useState } from 'react'
import { useDebouncedValue } from '@mantine/hooks'
import { customerGroupProductQueryError, type CustomerGroupExactChoiceField } from '../data/customerGroupSelections'
import { customerGroupAuthorQueryError } from '../data/customerGroupAuthors'
import type { CustomerGroupChoice } from '../api/customerGroupSelectionsApi'
import { useCustomerGroupCodeCatalogue } from './useCustomerGroupCodeCatalogue'
import { useCustomerGroupChoicePage } from './useCustomerGroupChoicePage'
const EMPTY_CHOICES: CustomerGroupChoice[] = []
function searchPolicy(field: number, query: string, debounced: string, disabled: boolean | undefined) {
  const queryError = query.length > 120 ? 'Введіть не більше 120 символів.' : field === 1 ? customerGroupProductQueryError(query) : field === 4 ? customerGroupProductGroupQueryError(query) : field === 9 ? customerGroupAgreementQueryError(query) : field === 21 ? customerGroupWarehouseQueryError(query) : field === 15 || field === 16 ? customerGroupAuthorQueryError(query) : null
  return { queryError, ready: !disabled && !queryError && (field === 4 || field === 21 || query.length >= 2) && debounced === query,
    waiting: !disabled && (field === 4 || field === 21 || query.length >= 2) && debounced !== query }
}
export function useCustomerGroupChoiceOptions(field:CustomerGroupExactChoiceField, disabled:boolean|undefined) {
  const [searchState, setSearchState] = useState({ query: '', count: 30 })
  const query = field === 4 || field === 21 ? searchState.query : searchState.query.trim()
  const [debounced] = useDebouncedValue(query, 250)
  const policy = searchPolicy(field, query, debounced, disabled)
  const catalogue = useCustomerGroupCodeCatalogue(field === 8 && !disabled)
  const page = useCustomerGroupChoicePage(field, query, policy.ready)
  const filteredCodes = (catalogue.codes ?? EMPTY_CHOICES).filter(item => item.Name.toLocaleLowerCase('uk').includes(query.toLocaleLowerCase('uk')))
  const codeView = { options: filteredCodes.slice(0, searchState.count), loading: !disabled && catalogue.codes === null && !catalogue.codesFailed,
    failure: catalogue.codesFailed, more: filteredCodes.length > searchState.count, capped: false,
    loadMore: () => setSearchState(current => ({ ...current, count: current.count + 30 })), retry: catalogue.retryCodes }
  const remoteView = { options: page.rows, loading: page.loading || policy.waiting, failure: page.failed,
    more: page.more && page.next <= 10000, capped: page.more && page.next > 10000,
    loadMore: page.loadMore, retry: page.rows.length ? page.loadMore : page.retry }
  const view = field === 8 ? codeView : remoteView
  return { ...view, options: disabled || policy.queryError ? EMPTY_CHOICES : view.options, queryError: policy.queryError,
    search: searchState.query, setSearch: (query:string) => setSearchState({ query, count:30 }) }
}
