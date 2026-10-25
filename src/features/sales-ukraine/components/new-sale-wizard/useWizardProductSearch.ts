import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getMostPurchasedProductsByClientId } from '../../../clients/api/clientRecommendationsApi'
import { searchSaleProductsWithAvailability } from './newSaleWizardApi'
import { getWizardKeyboardState, setWizardKeyboardState } from './wizardKeyboard'
import { findUniqueExactWizardProductSearchMatch, type ExactWizardProductSearchMatch } from './wizardProductSearchSelection'
import type { WizardSaleProduct } from './wizardSaleProduct'

export const PRODUCT_SEARCH_MIN_QUERY_LENGTH = 3

// Own the lifetime of every request that can replace or extend the search list.
// Selection, detail panels, keyboard focus and cart mutations stay in the view.
export function useWizardProductSearch({
  agreementNetId,
  clientNetId,
  onResetSelection,
  onResults,
}: {
  agreementNetId: string | null
  clientNetId: string | null
  onResetSelection: () => void
  onResults: (match: ExactWizardProductSearchMatch | null) => void
}) {
  const { t } = useI18n()
  const callbacksRef = useRef({ onResetSelection, onResults })
  useLayoutEffect(() => { callbacksRef.current = { onResetSelection, onResults } })
  const [searchMode, setSearchMode] = useState('5')
  const [sortMode, setSortMode] = useState('2')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WizardSaleProduct[]>([])
  const [isSearching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchRequestRevision, setSearchRequestRevision] = useState(0)
  const [isLoadingRecommendations, setLoadingRecommendations] = useState(false)
  const forceSearchRef = useRef(false)
  const searchAbortRef = useRef<AbortController | null>(null)
  const loadMoreAbortRef = useRef<AbortController | null>(null)
  const recommendationsAbortRef = useRef<AbortController | null>(null)
  const exhaustedRef = useRef(false)
  const nextOffsetRef = useRef(0)
  const contextRef = useRef({ agreementNetId, clientNetId })

  const abortRequests = useCallback(() => {
    searchAbortRef.current?.abort()
    loadMoreAbortRef.current?.abort()
    recommendationsAbortRef.current?.abort()
    searchAbortRef.current = null
    loadMoreAbortRef.current = null
    recommendationsAbortRef.current = null
  }, [])

  const cancelPendingSearch = useCallback(() => {
    abortRequests()
    setSearching(false)
    setLoadingRecommendations(false)
  }, [abortRequests])

  const clearSearch = useCallback(() => {
    cancelPendingSearch()
    exhaustedRef.current = false
    nextOffsetRef.current = 0
    forceSearchRef.current = false
    setQuery('')
    setResults([])
    setSearchError(null)
    callbacksRef.current.onResetSelection()
  }, [cancelPendingSearch])

  useLayoutEffect(() => {
    const previous = contextRef.current
    contextRef.current = { agreementNetId, clientNetId }

    if (previous.agreementNetId !== agreementNetId || previous.clientNetId !== clientNetId) {
      clearSearch()
      setWizardKeyboardState('ProductSearch')
    }

    // Also retire recommendations and pagination when the client/agreement
    // changes, even if the query is empty or the picker is in selection mode.
    return abortRequests
  }, [agreementNetId, clientNetId, clearSearch, abortRequests])

  const searchValue = query.trim()
  useEffect(() => {
    const value = searchValue
    if (value.length < PRODUCT_SEARCH_MIN_QUERY_LENGTH || !agreementNetId) return

    const forced = forceSearchRef.current
    forceSearchRef.current = false
    if (!forced && getWizardKeyboardState(1) !== 'ProductSearch') return

    const controller = new AbortController()
    abortRequests()
    searchAbortRef.current = controller
    exhaustedRef.current = false
    nextOffsetRef.current = 0

    void (async () => {
      try {
        const next = await searchSaleProductsWithAvailability(value, agreementNetId, {
          limit: 20,
          mode: searchMode,
          offset: 0,
          signal: controller.signal,
          sortMode,
        })
        if (controller.signal.aborted) return

        const nextResults = next.length === 1 && next[0]
          ? [next[0], ...(next[0].NextSearchedProducts ?? [])]
          : next
        nextOffsetRef.current = nextResults.length
        setResults(nextResults)
        callbacksRef.current.onResults(findUniqueExactWizardProductSearchMatch(value, nextResults))
      } catch (error) {
        if (!controller.signal.aborted) {
          setResults([])
          setSearchError(getErrorMessage(error, t('Не вдалося виконати пошук товарів')))
        }
      } finally {
        if (searchAbortRef.current === controller) {
          searchAbortRef.current = null
          setSearching(false)
        }
      }
    })()

    return () => {
      controller.abort()
      if (searchAbortRef.current === controller) searchAbortRef.current = null
    }
  }, [searchValue, agreementNetId, searchMode, sortMode, searchRequestRevision, abortRequests, t])

  async function loadMoreResults() {
    const value = query.trim()
    if (searchAbortRef.current || loadMoreAbortRef.current || recommendationsAbortRef.current || exhaustedRef.current || value.length < PRODUCT_SEARCH_MIN_QUERY_LENGTH || !agreementNetId) return

    const controller = new AbortController()
    loadMoreAbortRef.current = controller
    try {
      const next = await searchSaleProductsWithAvailability(value, agreementNetId, {
        limit: 10,
        mode: searchMode,
        offset: nextOffsetRef.current,
        signal: controller.signal,
        sortMode,
      })
      if (controller.signal.aborted) return

      // The server offset counts received rows, including overlaps. Counting
      // only displayed rows can repeatedly request the same overlapping page.
      nextOffsetRef.current += next.length
      exhaustedRef.current = next.length === 0
      if (next.length > 0) {
        setResults((previous) => {
          const seen = new Set(previous.map((product) => product.NetUid))
          const added = next.filter((product) => {
            if (seen.has(product.NetUid)) return false
            seen.add(product.NetUid)
            return true
          })
          return added.length > 0 ? [...previous, ...added] : previous
        })
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        notifications.show({ color: 'red', message: getErrorMessage(error, t('Не вдалося завантажити наступні товари')) })
      }
    } finally {
      if (loadMoreAbortRef.current === controller) loadMoreAbortRef.current = null
    }
  }

  function prepareSearch() {
    cancelPendingSearch()
    exhaustedRef.current = false
    nextOffsetRef.current = 0
    setSearchError(null)
  }

  function handleQueryChange(value: string) {
    if (getWizardKeyboardState(1) !== 'ProductSearch') return
    // A repeated settled input must neither abort its request nor clear its rows.
    // Keep the raw input for the carousel; the API uses the normalized value.
    if (searchValue.length >= PRODUCT_SEARCH_MIN_QUERY_LENGTH && value.trim() === searchValue) {
      setQuery(value)
      return
    }
    prepareSearch()
    setQuery(value)
    setResults([])
    callbacksRef.current.onResetSelection()
    setSearching(value.trim().length >= PRODUCT_SEARCH_MIN_QUERY_LENGTH && Boolean(agreementNetId))
  }

  function handleSearchSettingsChange(nextMode: string | null, nextSort: string | null) {
    if ((!nextMode || nextMode === searchMode) && (!nextSort || nextSort === sortMode)) return
    prepareSearch()
    if (nextMode) setSearchMode(nextMode)
    if (nextSort) setSortMode(nextSort)
    setResults([])
    callbacksRef.current.onResetSelection()
    requestSearch()
  }

  function requestSearch() {
    if (query.trim().length < PRODUCT_SEARCH_MIN_QUERY_LENGTH || !agreementNetId) return
    forceSearchRef.current = true
    setSearching(true)
    setSearchRequestRevision((revision) => revision + 1)
  }

  function retryProductSearch() {
    if (query.trim().length < PRODUCT_SEARCH_MIN_QUERY_LENGTH || !agreementNetId) return
    prepareSearch()
    requestSearch()
  }

  async function loadClientRecommendations(): Promise<boolean> {
    if (!clientNetId || !agreementNetId || recommendationsAbortRef.current) return false
    prepareSearch()
    const controller = new AbortController()
    recommendationsAbortRef.current = controller
    setLoadingRecommendations(true)
    setSearching(true)

    try {
      const recommended = (await getMostPurchasedProductsByClientId(clientNetId, false, {
        clientAgreementNetId: agreementNetId,
        signal: controller.signal,
      })) as unknown as WizardSaleProduct[]
      if (controller.signal.aborted) return false

      setQuery('')
      setResults(recommended)
      callbacksRef.current.onResults(null)
      setWizardKeyboardState('ProductSearch')
      if (recommended.length === 0) {
        notifications.show({ color: 'orange', message: t('Рекомендацій для клієнта не знайдено') })
      }
      return true
    } catch {
      if (!controller.signal.aborted) {
        notifications.show({ color: 'red', message: t('Не вдалося завантажити рекомендації') })
      }
      return false
    } finally {
      if (recommendationsAbortRef.current === controller) {
        recommendationsAbortRef.current = null
        setSearching(false)
        setLoadingRecommendations(false)
      }
    }
  }

  return {
    cancelPendingSearch,
    clearSearch,
    handleQueryChange,
    handleSearchSettingsChange,
    isLoadingRecommendations,
    isSearching,
    loadClientRecommendations,
    loadMoreResults,
    query,
    results,
    retryProductSearch,
    searchError,
    searchMode,
    setResults,
    setSearchError,
    sortMode,
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}
