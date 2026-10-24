import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Client } from '../../../clients/types'
import { buildWizardClientStacks, isWizardSaleClientSelectable, WIZARD_CLIENT_CAROUSEL_INITIAL,
  type WizardClientCarouselState } from './wizardClientStepModel'

type Options = {
  confirmClient: (client: Client, options?: { debounceDetails?: boolean }) => void
  unselectClient: () => void
  loadMore: () => Promise<void>
}

export function useWizardClientCarousel(options: Options) {
  const [carousel, setCarousel] = useState(WIZARD_CLIENT_CAROUSEL_INITIAL)
  const carouselRef = useRef(carousel)
  const canLoadMoreRef = useRef(false)
  const latestRef = useRef(options)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const focusFrameRef = useRef<number | null>(null)
  useLayoutEffect(() => { latestRef.current = options })

  const publish = useCallback((next: WizardClientCarouselState) => {
    carouselRef.current = next
    setCarousel(next)
  }, [])
  const cancelPendingFocus = useCallback(() => {
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current)
    focusFrameRef.current = null
  }, [])
  useEffect(() => cancelPendingFocus, [cancelPendingFocus])
  const focusSearchInput = useCallback(() => {
    cancelPendingFocus()
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null
      searchInputRef.current?.focus()
    })
  }, [cancelPendingFocus])

  const showClient = useCallback((client: Client) => {
    canLoadMoreRef.current = false
    const { bottom, top } = buildWizardClientStacks(client)
    publish({ dataBottom: bottom, dataTop: top, selected: client, showDetails: true })
  }, [publish])
  const applySearchResults = useCallback((clients: Client[]) => {
    if (clients.length === 1) {
      showClient(clients[0])
      latestRef.current.confirmClient(clients[0])
      return
    }
    const middle = Math.ceil(clients.length / 2)
    canLoadMoreRef.current = clients.length > 1
    publish({ dataBottom: clients.slice(middle), dataTop: clients.slice(0, middle), selected: null, showDetails: false })
  }, [publish, showClient])
  const appendSearchResults = useCallback((clients: Client[]) => {
    if (!canLoadMoreRef.current || !clients.length) return
    const current = carouselRef.current
    publish({ ...current, dataBottom: [...current.dataBottom, ...clients] })
  }, [publish])
  const move = useCallback((direction: 'up' | 'down') => {
    const current = carouselRef.current
    const item = direction === 'up' ? current.dataTop.at(-1) : current.dataBottom[0]
    // At the boundary retain the selected client and agreement instead of
    // clearing the business selection while leaving the same card visible.
    if (!item) {
      if (direction === 'down' && canLoadMoreRef.current) void latestRef.current.loadMore()
      return
    }
    const previous = current.selected && (current.selected.Id ?? 0) > 0 ? [current.selected] : []
    const next = direction === 'up'
      ? { dataBottom: [...previous, ...current.dataBottom], dataTop: current.dataTop.slice(0, -1), selected: item, showDetails: true }
      : { dataBottom: current.dataBottom.slice(1), dataTop: [...current.dataTop, ...previous], selected: item, showDetails: true }
    publish(next)
    if (!next.dataBottom.length && canLoadMoreRef.current) void latestRef.current.loadMore()
    // Structural folders expand only on Enter; preview must retire any
    // pending details request without replacing the drum with child rows.
    if (isWizardSaleClientSelectable(item)) latestRef.current.confirmClient(item, { debounceDetails: true })
    else latestRef.current.unselectClient()
  }, [publish])
  const confirmFocusedClient = useCallback(() => {
    const item = carouselRef.current.selected
    if (!item) return
    if (item.SubClients?.length) showClient(item)
    latestRef.current.confirmClient(item)
  }, [showClient])
  const pickClient = useCallback((client: Client) => {
    const current = carouselRef.current
    const all = [...current.dataTop, ...(current.selected ? [current.selected] : []), ...current.dataBottom]
    const key = String(client.NetUid || client.Id || '')
    const index = all.findIndex((item) => String(item.NetUid || item.Id || '') === key)
    publish(index < 0 ? { ...current, selected: client, showDetails: true } : {
      dataBottom: all.slice(index + 1), dataTop: all.slice(0, index), selected: client, showDetails: true,
    })
    latestRef.current.confirmClient(client)
    // The clicked row unmounts when re-centered. Restore focus after commit.
    focusSearchInput()
  }, [publish, focusSearchInput])
  const hideDetails = useCallback(() => {
    const current = carouselRef.current
    if (current.showDetails) publish({ ...current, showDetails: false })
  }, [publish])
  const getCarousel = useCallback(() => carouselRef.current, [])

  return { carousel, getCarousel, searchInputRef, showClient, applySearchResults, appendSearchResults,
    move, confirmFocusedClient, pickClient, hideDetails, focusSearchInput, cancelPendingFocus }
}

export type WizardClientCarouselController = ReturnType<typeof useWizardClientCarousel>
