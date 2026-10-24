import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { splitProductSearchResults } from '../../../products/utils'
import type { WizardSaleProduct } from './wizardSaleProduct'

const SEARCH_LIFT_DEBOUNCE_MS = 260
const NO_PRODUCTS: WizardSaleProduct[] = []

type WizardProductCarouselOptions = {
  products: WizardSaleProduct[]
  focusedIndex: number
  hasFocus: boolean
  searchMode: boolean
  searchValue: string
  searchContextKey: string
  onPick: (index: number) => void
  onSearchChange: (value: string) => void
}

export function useWizardProductCarousel({
  products, focusedIndex, hasFocus, searchMode, searchValue, searchContextKey, onPick, onSearchChange,
}: WizardProductCarouselOptions) {
  // Keep keystrokes local; the products step only receives the settled query.
  const [text, setText] = useState(searchValue)
  const lastLiftedRef = useRef(searchValue)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRef = useRef({ onPick, onSearchChange, searchValue })

  useLayoutEffect(() => {
    latestRef.current = { onPick, onSearchChange, searchValue }
  })

  const cancelPendingLift = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useLayoutEffect(() => {
    // Switching client/agreement or leaving search retires the local draft,
    // even when the parent query is still empty and has not changed.
    cancelPendingLift()
    const value = latestRef.current.searchValue
    lastLiftedRef.current = value
    setText(value)
    return cancelPendingLift
  }, [searchContextKey, searchMode, cancelPendingLift])

  useLayoutEffect(() => {
    // Acknowledging our last query must not discard a newer local draft.
    if (searchValue === lastLiftedRef.current) return
    cancelPendingLift()
    lastLiftedRef.current = searchValue
    setText(searchValue)
  }, [searchValue, cancelPendingLift])

  const handlePick = useCallback((index: number) => latestRef.current.onPick(index), [])

  const handleTextChange = useCallback((value: string) => {
    if (!searchMode) return
    setText(value)
    cancelPendingLift()
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      lastLiftedRef.current = value
      latestRef.current.onSearchChange(value)
    }, SEARCH_LIFT_DEBOUNCE_MS)
  }, [searchMode, cancelPendingLift])

  const pendingSearchLift = searchMode && text !== searchValue
  const visibleProducts = pendingSearchLift ? NO_PRODUCTS : products
  const focused = hasFocus && focusedIndex >= 0 ? visibleProducts[focusedIndex] ?? null : null
  const { topProducts, bottomProducts, bottomOffset } = useMemo(() => {
    if (focused) {
      return {
        topProducts: visibleProducts.slice(0, focusedIndex),
        bottomProducts: visibleProducts.slice(focusedIndex + 1),
        bottomOffset: focusedIndex + 1,
      }
    }
    const split = splitProductSearchResults(visibleProducts)
    return { ...split, bottomOffset: split.topProducts.length }
  }, [focused, focusedIndex, visibleProducts])

  return {
    text, handleTextChange, handlePick, pendingSearchLift,
    visibleProducts, focused, topProducts, bottomProducts, bottomOffset,
    showInput: searchMode || !focused,
  }
}
