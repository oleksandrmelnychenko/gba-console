import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { Client } from '../../../clients/types'
import { searchWizardClients } from './wizardClientStepApi'
import type { WizardSalesPermissionFlow } from './wizardSaleHeaderApi'

const MIN_QUERY_LENGTH = 3

export function useWizardClientSearch({ permissionFlow, onResults, onAppendResults }: {
  permissionFlow: WizardSalesPermissionFlow
  onResults: (clients: Client[]) => void
  onAppendResults: (clients: Client[]) => void
}) {
  const [query, setQueryValue] = useState('')
  const queryRef = useRef('')
  const requestedQueryRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<AbortController | null>(null)
  const pageRef = useRef<AbortController | null>(null)
  const offsetRef = useRef(0)
  const exhaustedRef = useRef(false)
  const loadedRef = useRef(false)
  const seenRef = useRef(new Set<string>())
  const latestRef = useRef({ onResults, onAppendResults })
  useLayoutEffect(() => { latestRef.current = { onResults, onAppendResults } })

  const cancel = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = null
    searchRef.current?.abort()
    pageRef.current?.abort()
    searchRef.current = null
    pageRef.current = null
  }, [])

  useLayoutEffect(() => {
    cancel()
    offsetRef.current = 0
    exhaustedRef.current = false
    loadedRef.current = false
    requestedQueryRef.current = null
    seenRef.current.clear()
    return cancel
  }, [permissionFlow, cancel])

  const setQuery = useCallback((value: string) => {
    cancel()
    requestedQueryRef.current = null
    queryRef.current = value
    setQueryValue(value)
  }, [cancel])

  // false tells keyboard navigation to retain the current carousel and business selection.
  const handleQueryChange = useCallback((value: string): boolean => {
    const effectiveQuery = value.trim()
    if (requestedQueryRef.current === effectiveQuery && (timerRef.current !== null || searchRef.current || loadedRef.current)) {
      queryRef.current = value
      setQueryValue(value)
      return false
    }
    setQuery(value)
    requestedQueryRef.current = effectiveQuery
    offsetRef.current = 0
    exhaustedRef.current = false
    loadedRef.current = false
    seenRef.current.clear()
    if (value.trim().length < MIN_QUERY_LENGTH) {
      latestRef.current.onResults([])
      return true
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      const controller = new AbortController()
      searchRef.current = controller
      void searchWizardClients(value, 20, 0, controller.signal, permissionFlow).then((data) => {
        if (controller.signal.aborted) return
        offsetRef.current = data.length
        loadedRef.current = true
        seenRef.current = new Set(data.map(clientKey).filter(Boolean))
        latestRef.current.onResults(data)
      }).catch(() => {
        if (!controller.signal.aborted) latestRef.current.onResults([])
      }).finally(() => {
        if (searchRef.current === controller) searchRef.current = null
      })
    }, 260)
    return true
  }, [setQuery, permissionFlow])

  const runVirtualLoad = useCallback(async () => {
    const value = queryRef.current
    if (!loadedRef.current || timerRef.current !== null || searchRef.current || pageRef.current || exhaustedRef.current || value.trim().length < MIN_QUERY_LENGTH) return
    const controller = new AbortController()
    pageRef.current = controller
    try {
      const data = await searchWizardClients(value, 10, offsetRef.current, controller.signal, permissionFlow)
      if (controller.signal.aborted) return
      offsetRef.current += data.length
      exhaustedRef.current = data.length === 0
      const added = takeUnseenClients(data, seenRef.current)
      if (added.length > 0) latestRef.current.onAppendResults(added)
    } catch {
      // Preserve the server offset so a failed page can be retried.
    } finally {
      if (pageRef.current === controller) pageRef.current = null
    }
  }, [permissionFlow])

  return { query, setQuery, handleQueryChange, runVirtualLoad }
}

function clientKey(client: Client): string {
  return client.NetUid || (client.Id ? String(client.Id) : '')
}

function takeUnseenClients(clients: Client[], seen: Set<string>): Client[] {
  return clients.filter(client => {
    const key = clientKey(client)
    if (key && seen.has(key)) return false
    if (key) seen.add(key)
    return true
  })
}
