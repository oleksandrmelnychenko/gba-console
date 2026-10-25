import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getClientSubClients } from '../../../clients/api/clientCabinetApi'
import type { Client, ClientAgreement, ClientIdentityAttentionSummary, ClientInDebt } from '../../../clients/types'
import type { SalesUkraineClientAgreement } from '../../types'
import { getWizardClientAgreements, getWizardClientGroupedDebts, getWizardClientIdentityAttention, type WizardSaleRegisterQuery } from './wizardClientStepApi'
import { getWizardAgreementKey, isWizardSaleClientSelectable } from './wizardClientStepModel'
import { setWizardKeyboardState } from './wizardKeyboard'
import { getWizardHeaderClient, type WizardSalesPermissionFlow } from './wizardSaleHeaderApi'

type Selection = {
  identityAttention: ClientIdentityAttentionSummary | null
  selectedClient: Client | null
  agreements: ClientAgreement[]
  groupedDebts: ClientInDebt[]
  agreementsLoading: boolean
  selectedAgreementKey: string
}
const EMPTY_SELECTION: Selection = { identityAttention: null, selectedClient: null, agreements: [], groupedDebts: [], agreementsLoading: false, selectedAgreementKey: '' }
type SelectionSession = {
  client: Client
  controller: AbortController
  phase: 'waiting' | 'loading' | 'ready' | 'failed'
  debtPromise?: Promise<boolean>
  debtController?: AbortController
  agreementsLoaded?: boolean
  debtsLoaded?: boolean
  supplementaryStarted?: boolean
}
type Options = {
  clientNetId: string | null
  initialClient?: Client | null
  permissionFlow: WizardSalesPermissionFlow
  hasRegistryItems: boolean
  onClientChange: (netId: string | null) => void
  onClientResolved?: (client: Client | null) => void
  onAgreementChange: (netId: string | null, agreement: SalesUkraineClientAgreement | null) => void
  onShowClient: (client: Client) => void
  resetRegister: (netId?: string, loading?: boolean) => void
  fetchRegister: (overrides?: Partial<WizardSaleRegisterQuery>) => Promise<void>
}

export function useWizardClientSelection(options: Options) {
  const { clientNetId, permissionFlow } = options
  const [selection, setSelection] = useState(EMPTY_SELECTION)
  const selectionRef = useRef(selection)
  const latestRef = useRef(options)
  const sessionRef = useRef<SelectionSession | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const generationRef = useRef(0)
  const bootstrappedRef = useRef(false)
  const restoringRef = useRef(false)
  useLayoutEffect(() => { latestRef.current = options })

  const publish = useCallback((patch: Partial<Selection>) => {
    const next = { ...selectionRef.current, ...patch }
    selectionRef.current = next
    setSelection(next)
  }, [])
  const retireSelection = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = null
    sessionRef.current?.controller.abort()
    sessionRef.current?.debtController?.abort()
    sessionRef.current = null
    generationRef.current += 1
  }, [])

  useEffect(() => () => {
    retireSelection()
    bootstrappedRef.current = false
    setWizardKeyboardState('ClientSearch')
  }, [retireSelection])

  const loadDebts = useCallback((session: SelectionSession, options?: { fresh?: boolean }): Promise<boolean> => {
    const netId = session.client.NetUid
    if (!netId || sessionRef.current !== session) return Promise.resolve(false)
    if (session.debtPromise && !options?.fresh) return session.debtPromise
    session.debtController?.abort()
    const controller = new AbortController()
    session.debtController = controller
    const isCurrent = () => sessionRef.current === session && session.debtController === controller && !controller.signal.aborted
    const request = options?.fresh
      ? getWizardClientGroupedDebts(netId, controller.signal, options)
      : getWizardClientGroupedDebts(netId, controller.signal)
    session.debtPromise = request.then((debts) => {
      if (!isCurrent()) return false
      session.debtsLoaded = true
      publish({ groupedDebts: debts })
      return true
    }).catch(() => {
      if (isCurrent()) {
        session.debtsLoaded = false
        publish({ groupedDebts: [] })
      }
      return false
    }).finally(() => {
      if (session.debtController === controller) session.debtPromise = undefined
    })
    return session.debtPromise
  }, [publish])

  const loadDetails = useCallback((session: SelectionSession) => {
    if (sessionRef.current !== session) return
    const netId = session.client.NetUid
    if (!netId) { session.phase = 'ready'; return }
    session.phase = 'loading'
    if (!session.supplementaryStarted) {
      session.supplementaryStarted = true
      void latestRef.current.fetchRegister({ clientNetId: netId })
      // Supplementary risk information must not delay agreements or the register.
      void getWizardClientIdentityAttention(netId, session.controller.signal).then((identityAttention) => {
        if (sessionRef.current === session) publish({ identityAttention })
      }).catch(() => {
        if (sessionRef.current === session) publish({ identityAttention: null })
      })
    }
    const debts = session.debtsLoaded ? Promise.resolve(true) : loadDebts(session)
    if (!session.agreementsLoaded && !selectionRef.current.agreementsLoading) publish({ agreementsLoading: true })
    const agreements = session.agreementsLoaded ? Promise.resolve(true) : getWizardClientAgreements(netId, session.controller.signal).then((list) => {
      if (sessionRef.current !== session) return false
      session.agreementsLoaded = true
      const active = list.find((item) => item.Agreement?.IsActive) ?? list[0]
      publish({ agreements: list, agreementsLoading: false, selectedAgreementKey: active ? getWizardAgreementKey(active) : '' })
      latestRef.current.onAgreementChange(active?.NetUid ?? null, active ? toSalesAgreement(active) : null)
      return true
    }).catch(() => {
      if (sessionRef.current === session) {
        publish({ agreements: [], agreementsLoading: false, selectedAgreementKey: '' })
        latestRef.current.onAgreementChange(null, null)
      }
      return false
    })
    void Promise.all([debts, agreements]).then((results) => {
      if (sessionRef.current === session) session.phase = results.every(Boolean) ? 'ready' : 'failed'
    })
  }, [loadDebts, publish])

  const clearSelection = useCallback(() => {
    retireSelection()
    publish(EMPTY_SELECTION)
    latestRef.current.onClientResolved?.(null)
    latestRef.current.resetRegister()
    latestRef.current.onClientChange(null)
    latestRef.current.onAgreementChange(null, null)
  }, [retireSelection, publish])

  const confirmClient = useCallback((client: Client, { debounceDetails = false }: { debounceDetails?: boolean } = {}) => {
    if ((client.Id ?? 0) <= 0) return
    bootstrappedRef.current = true
    restoringRef.current = false
    setWizardKeyboardState('ClientSelection')
    if (!isWizardSaleClientSelectable(client)) {
      clearSelection()
      latestRef.current.onShowClient(client)
      return
    }
    const current = sessionRef.current
    if (current && clientKey(current.client) === clientKey(client)) {
      // Enter while previewing flushes the existing debounce. Repeated clicks
      // while loading/ready retain the chosen agreement and in-flight requests.
      if (current.phase === 'failed') loadDetails(current)
      if (current.phase === 'waiting' && !debounceDetails) {
        if (timerRef.current !== null) clearTimeout(timerRef.current)
        timerRef.current = null
        latestRef.current.onClientChange(client.NetUid ?? null)
        loadDetails(current)
      }
      return
    }
    retireSelection()
    const session: SelectionSession = { client, controller: new AbortController(), phase: debounceDetails ? 'waiting' : 'loading' }
    sessionRef.current = session
    publish({ ...EMPTY_SELECTION, selectedClient: client, agreementsLoading: Boolean(client.NetUid) })
    latestRef.current.onClientResolved?.(client)
    latestRef.current.onAgreementChange(null, null)
    latestRef.current.resetRegister(client.NetUid ?? '', true)
    if (debounceDetails) {
      latestRef.current.onClientChange(null)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        if (sessionRef.current !== session) return
        latestRef.current.onClientChange(client.NetUid ?? null)
        loadDetails(session)
      }, 220)
    } else {
      latestRef.current.onClientChange(client.NetUid ?? null)
      loadDetails(session)
    }
  }, [clearSelection, retireSelection, publish, loadDetails])

  const unselectClient = useCallback(() => {
    if (!sessionRef.current && !selectionRef.current.selectedClient && !latestRef.current.hasRegistryItems && !restoringRef.current) return
    // Typing during a server bootstrap must retire that restore as well.
    bootstrappedRef.current = true
    restoringRef.current = false
    clearSelection()
  }, [clearSelection])

  const selectAgreement = useCallback((agreement: ClientAgreement) => {
    const key = getWizardAgreementKey(agreement)
    const current = selectionRef.current.agreements.find((item) => getWizardAgreementKey(item) === key)
    if (!current || selectionRef.current.selectedAgreementKey === key) return
    publish({ selectedAgreementKey: key })
    latestRef.current.onAgreementChange(current.NetUid ?? null, toSalesAgreement(current))
  }, [publish])
  const moveAgreement = useCallback((direction: 1 | -1) => {
    const { agreements, selectedAgreementKey } = selectionRef.current
    if (!agreements.length) return
    const index = agreements.findIndex((item) => getWizardAgreementKey(item) === selectedAgreementKey)
    selectAgreement(agreements[index < 0 ? 0 : (index + direction + agreements.length) % agreements.length])
  }, [selectAgreement])
  const selectNextAgreement = useCallback(() => moveAgreement(1), [moveAgreement])
  const selectPreviousAgreement = useCallback(() => moveAgreement(-1), [moveAgreement])
  const refreshGroupedDebts = useCallback((options?: { fresh?: boolean }) => sessionRef.current ? loadDebts(sessionRef.current, options) : Promise.resolve(false), [loadDebts])

  useEffect(() => {
    if (clientNetId) setWizardKeyboardState('ClientSelection')
    if (bootstrappedRef.current || !clientNetId) return
    const preserved = latestRef.current.initialClient
    if (preserved && preserved.NetUid === clientNetId && (preserved.Id ?? 0) > 0) {
      latestRef.current.onShowClient(preserved)
      confirmClient(preserved)
      return
    }
    let cancelled = false
    const generation = generationRef.current
    restoringRef.current = true
    const isCurrent = () => !cancelled && generationRef.current === generation && !bootstrappedRef.current
    void (async () => {
      try {
        const client = await getWizardHeaderClient(clientNetId, permissionFlow).catch(() => null)
        if (!isCurrent() || !client || (client.Id ?? 0) <= 0) return
        let restored = client
        if (!isWizardSaleClientSelectable(client)) {
          const children = await getClientSubClients(clientNetId).catch(() => null)
          if (children) restored = { ...client, SubClients: children }
        }
        if (!isCurrent()) return
        latestRef.current.onShowClient(restored)
        confirmClient(restored)
      } finally {
        if (!cancelled && generationRef.current === generation) restoringRef.current = false
      }
    })()
    return () => { cancelled = true; restoringRef.current = false }
  }, [clientNetId, permissionFlow, confirmClient])

  const selectedAgreement = selection.agreements.find((item) => getWizardAgreementKey(item) === selection.selectedAgreementKey) ?? null
  return { ...selection, selectedAgreement, confirmClient, unselectClient, selectAgreement,
    selectNextAgreement, selectPreviousAgreement, refreshGroupedDebts }
}

function clientKey(client: Client) { return client.NetUid || String(client.Id) }
function toSalesAgreement(agreement: ClientAgreement) { return agreement as unknown as SalesUkraineClientAgreement }
