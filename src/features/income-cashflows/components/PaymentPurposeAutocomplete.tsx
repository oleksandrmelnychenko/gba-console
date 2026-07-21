import { Autocomplete, Loader } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useEffect, useState } from 'react'
import { searchIncomeCashflowPaymentPurposes } from '../api/incomeCashflowsApi'

const SEARCH_DEBOUNCE_MS = 300
const SUGGESTIONS_LIMIT = 10

type PaymentPurposeAutocompleteProps = {
  clientAgreementNetId?: string
  clientNetId?: string
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  value: string
}

type SuggestionsState = {
  queryKey: string
  values: string[]
}

export function PaymentPurposeAutocomplete({
  clientAgreementNetId,
  clientNetId,
  disabled,
  label,
  onChange,
  value,
}: PaymentPurposeAutocompleteProps) {
  const [suggestionsState, setSuggestionsState] = useState<SuggestionsState>({ queryKey: '', values: [] })
  const normalizedValue = value.trim()
  const [debouncedValue] = useDebouncedValue(normalizedValue, SEARCH_DEBOUNCE_MS)
  const hasSuggestionScope = Boolean(clientNetId && clientAgreementNetId)
  const queryKey = hasSuggestionScope ? [clientNetId, clientAgreementNetId, debouncedValue].join('\u0000') : ''
  const isDebouncing = normalizedValue !== debouncedValue
  const suggestions = !isDebouncing && suggestionsState.queryKey === queryKey ? suggestionsState.values : []
  const isLoading = Boolean(hasSuggestionScope && (isDebouncing || suggestionsState.queryKey !== queryKey))

  useEffect(() => {
    if (!clientNetId || !clientAgreementNetId) {
      return
    }

    const controller = new AbortController()
    let cancelled = false

    void searchIncomeCashflowPaymentPurposes({
      clientAgreementNetId,
      clientNetId,
      limit: SUGGESTIONS_LIMIT,
      signal: controller.signal,
      value: debouncedValue,
    })
      .then((nextSuggestions) => {
        if (!cancelled) {
          setSuggestionsState({ queryKey, values: nextSuggestions })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestionsState({ queryKey, values: [] })
        }
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [clientAgreementNetId, clientNetId, debouncedValue, queryKey])

  return (
    <Autocomplete
      autoComplete="off"
      data={suggestions}
      disabled={disabled}
      filter={({ options }) => options}
      label={label}
      limit={SUGGESTIONS_LIMIT}
      maxLength={450}
      maxDropdownHeight={240}
      rightSection={isLoading ? <Loader size="xs" /> : undefined}
      rightSectionPointerEvents="none"
      value={value}
      onChange={onChange}
    />
  )
}
