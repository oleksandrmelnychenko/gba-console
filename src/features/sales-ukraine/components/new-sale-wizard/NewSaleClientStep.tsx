import { Anchor, Box, Loader, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconExternalLink, IconFileCheck, IconFileExcel, IconFileTypePdf, IconUserSearch } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { formatLocalDate } from '../../../../shared/date/dateTime'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { realtimeEvents, useRealtimeEvent } from '../../../../shared/realtime/events'
import { SaleAuditDetail } from '../../../../shared/sale-audit/SaleAuditDetail'
import { getSaleStatisticBySaleId } from '../../../../shared/sale-audit/saleAuditApi'
import type { SaleAuditStatistic } from '../../../../shared/sale-audit/saleAuditTypes'
import { AppDrawer } from '../../../../shared/ui/AppDrawer'
import { AppModal } from '../../../../shared/ui/AppModal'
import { useAuth } from '../../../auth/useAuth'
import { getClientSubClients, getRootClientBySubClientNetId } from '../../../clients/api/clientCabinetApi'
import type { Client, ClientAgreement, ClientInDebt } from '../../../clients/types'
import { getSaleActProtocolEditDocument, getSaleById, updateSale } from '../../api/salesUkraineApi'
import { SALES_UKRAINE_EDIT_PERMISSION } from '../../permissions'
import type { SaleDocumentResult, SalesUkraineClientAgreement, SalesUkraineSale } from '../../types'
import { MergedSalesDrawer } from '../MergedSalesDrawer'
import { SaleDetailsDrawer } from '../SaleDetailsDrawer'
import { SaleEditDrawer } from '../SaleEditDrawer'
import { bumpWizardDebtRefresh } from './newSaleWizardState'
import { WizardClientAgreementsStrip } from './WizardClientAgreementsStrip'
import { WizardClientCarousel } from './WizardClientCarousel'
import { WizardClientHeroHeader } from './WizardClientHeroHeader'
import { WizardClientRegistry } from './WizardClientRegistry'
import {
  buildWizardClientStacks,
  getWizardAgreementKey,
  WIZARD_CLIENT_CAROUSEL_INITIAL,
  type WizardClientCarouselState,
} from './wizardClientStepModel'
import {
  getWizardClientAgreements,
  getWizardClientGroupedDebts,
  getWizardSalesRegister,
  mapWizardSaleRegisterItems,
  searchWizardClients,
  WIZARD_SALE_REGISTER_STATUS_ALL,
  type WizardSaleRegisterQuery,
  type WizardSaleRegisterStatistic,
} from './wizardClientStepApi'
import { WizardOrderedProductsDrawer } from './WizardOrderedProductsDrawer'
import { getWizardHeaderClient } from './wizardSaleHeaderApi'
import { setWizardKeyboardState, useWizardKeyboard, useWizardKeyHandler, type WizardKeyEvent } from './wizardKeyboard'

type WizardPrintState = {
  document: SaleDocumentResult | null
  isLoading: boolean
}

// Minimum characters before the client search hits the server. 1–2 characters match almost
// everything and just hammer the (slow) client search, so wait until the query is meaningful.
const WIZARD_CLIENT_SEARCH_MIN_LENGTH = 3
const WIZARD_CLIENT_ARROW_LOAD_DEBOUNCE_MS = 220

export function NewSaleClientStep({
  clientNetId,
  headerClose,
  headerTools,
  initialClient,
  onClientChange,
  onClientResolved,
  onAgreementChange,
  onOpenSale,
  onCreateMergedMainClientSale,
  onEditMergedSale,
  onInvoiceMergedSale,
  onRequestClose,
}: {
  clientNetId: string | null
  headerClose?: ReactNode
  headerTools?: ReactNode
  initialClient?: Client | null
  onAgreementChange: (agreementNetId: string | null, agreement: SalesUkraineClientAgreement | null) => void
  onClientChange: (clientNetId: string | null) => void
  onClientResolved?: (client: Client | null) => void
  onCreateMergedMainClientSale?: (unionSale: SalesUkraineSale) => void
  onEditMergedSale?: (sale: SalesUkraineSale, unionSale: SalesUkraineSale | null) => void
  onInvoiceMergedSale?: (sale: SalesUkraineSale, unionSale: SalesUkraineSale | null) => void
  onOpenSale: (sale: SalesUkraineSale) => void
  onRequestClose?: () => void
}) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const canEdit = hasPermission(SALES_UKRAINE_EDIT_PERMISSION)
  const { state: keyboardState, setState: setKeyboardState } = useWizardKeyboard(0)

  const [query, setQuery] = useState('')
  const [carousel, setCarousel] = useState<WizardClientCarouselState>(WIZARD_CLIENT_CAROUSEL_INITIAL)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [groupedDebts, setGroupedDebts] = useState<ClientInDebt[]>([])
  const [agreements, setAgreements] = useState<ClientAgreement[]>([])
  const [selectedAgreementKey, setSelectedAgreementKey] = useState('')
  const [registryItems, setRegistryItems] = useState<WizardSaleRegisterStatistic[]>([])
  const [isRegistryLoading, setRegistryLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState(WIZARD_SALE_REGISTER_STATUS_ALL)
  const [saleSearch, setSaleSearch] = useState('')
  const [dateFrom, setDateFrom] = useState(() => formatLocalDate(getDateDaysAgo(7)))
  const [dateTo, setDateTo] = useState(() => formatLocalDate(new Date()))
  const [isOrderedProductsOpen, setOrderedProductsOpen] = useState(false)
  const [editShiftSale, setEditShiftSale] = useState<SalesUkraineSale | null>(null)
  const [mergedSale, setMergedSale] = useState<SalesUkraineSale | null>(null)
  const [detailsSale, setDetailsSale] = useState<SalesUkraineSale | null>(null)
  const [auditSale, setAuditSale] = useState<SalesUkraineSale | null>(null)
  const [auditStatistic, setAuditStatistic] = useState<SaleAuditStatistic | null>(null)
  const [isAuditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [printState, setPrintState] = useState<WizardPrintState | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchTimerRef = useRef<number | null>(null)
  const searchRequestRef = useRef(0)
  const searchAbortRef = useRef<AbortController | null>(null)
  const virtualSearchAbortRef = useRef<AbortController | null>(null)
  const clientDetailsTimerRef = useRef<number | null>(null)
  const clientDetailsRequestRef = useRef(0)
  const isVirtualLoadingRef = useRef(false)
  const loadedCountRef = useRef(0)
  const registryRequestRef = useRef(0)
  const registryInFlightKeyRef = useRef<string | null>(null)
  const auditRequestRef = useRef(0)
  const printRequestRef = useRef(0)
  const saleSearchTimerRef = useRef<number | null>(null)
  const realtimeTimerRef = useRef<number | null>(null)
  const bootstrappedRef = useRef(false)
  const registerArgsRef = useRef<WizardSaleRegisterQuery>({
    clientNetId: '',
    from: dateFrom,
    to: dateTo,
    type: statusFilter,
    value: saleSearch,
  })

  useEffect(
    () => () => {
      searchAbortRef.current?.abort()
      virtualSearchAbortRef.current?.abort()
    },
    [],
  )

  useEffect(() => {
    registerArgsRef.current = {
      clientNetId: selectedClient?.NetUid || '',
      from: dateFrom,
      to: dateTo,
      type: statusFilter,
      value: saleSearch,
    }
  })

  const fetchRegister = useCallback(async (overrides?: Partial<WizardSaleRegisterQuery>) => {
    const args = { ...registerArgsRef.current, ...overrides }

    if (!args.clientNetId) {
      return
    }

    const requestKey = getRegisterRequestKey(args)

    if (registryInFlightKeyRef.current === requestKey) {
      return
    }

    const requestId = registryRequestRef.current + 1
    registryRequestRef.current = requestId
    registryInFlightKeyRef.current = requestKey
    setRegistryLoading(true)

    try {
      const items = await getWizardSalesRegister(args)

      if (registryRequestRef.current === requestId) {
        setRegistryItems(mapWizardSaleRegisterItems(items))
      }
    } catch {
      if (registryRequestRef.current === requestId) {
        setRegistryItems([])
      }
    } finally {
      if (registryRequestRef.current === requestId) {
        setRegistryLoading(false)
      }

      if (registryInFlightKeyRef.current === requestKey) {
        registryInFlightKeyRef.current = null
      }
    }
  }, [])

  const loadGroupedDebts = useCallback(async (client: Client, requestId?: number) => {
    if (!client.NetUid) {
      return
    }

    const debts = await getWizardClientGroupedDebts(client.NetUid).catch(() => [])

    if (requestId === undefined || clientDetailsRequestRef.current === requestId) {
      setGroupedDebts(debts)
    }
  }, [])

  const loadAgreements = useCallback(
    async (client: Client, requestId?: number) => {
      if (!client.NetUid) {
        return
      }

      try {
        const list = await getWizardClientAgreements(client.NetUid)

        if (requestId !== undefined && clientDetailsRequestRef.current !== requestId) {
          return
        }

        setAgreements(list)

        // Prefer the active agreement, otherwise fall back to the first one so a selected
        // client always has an agreement and can advance to the products step (Alt+2).
        const active = list.find((item) => item.Agreement?.IsActive) ?? list[0]

        if (active) {
          setSelectedAgreementKey(getWizardAgreementKey(active))
          onAgreementChange(active.NetUid ?? null, toSalesUkraineAgreement(active))
        } else {
          setSelectedAgreementKey('')
          onAgreementChange(null, null)
        }
      } catch {
        if (requestId === undefined || clientDetailsRequestRef.current === requestId) {
          setAgreements([])
          setSelectedAgreementKey('')
          onAgreementChange(null, null)
        }
      }
    },
    [onAgreementChange],
  )

  const loadClientDetails = useCallback(
    (client: Client, requestId: number) => {
      void loadGroupedDebts(client, requestId)
      void loadAgreements(client, requestId)
      void fetchRegister({ clientNetId: client.NetUid || '' })
    },
    [fetchRegister, loadAgreements, loadGroupedDebts],
  )

  const confirmClient = useCallback(
    (client: Client, { debounceDetails = false }: { debounceDetails?: boolean } = {}) => {
      if ((client.Id ?? 0) <= 0) {
        return
      }

      // A client is now selected, so the one-time bootstrap is done. This prevents the
      // bootstrap effect (which rebuilds the carousel from a single client) from firing
      // when confirmClient updates clientNetId — that would wipe the found-clients list.
      bootstrappedRef.current = true

      const requestId = clientDetailsRequestRef.current + 1
      clientDetailsRequestRef.current = requestId

      if (clientDetailsTimerRef.current !== null) {
        window.clearTimeout(clientDetailsTimerRef.current)
        clientDetailsTimerRef.current = null
      }

      setSelectedClient(client)
      onClientResolved?.(client)
      setGroupedDebts([])
      setAgreements([])
      setSelectedAgreementKey('')
      setRegistryItems([])
      setRegistryLoading(false)
      registryRequestRef.current += 1
      registryInFlightKeyRef.current = null
      setKeyboardState('ClientSelection')

      if (debounceDetails) {
        clientDetailsTimerRef.current = window.setTimeout(() => {
          clientDetailsTimerRef.current = null

          if (clientDetailsRequestRef.current === requestId) {
            onClientChange(client.NetUid ?? null)
            loadClientDetails(client, requestId)
          }
        }, WIZARD_CLIENT_ARROW_LOAD_DEBOUNCE_MS)

        return
      }

      onClientChange(client.NetUid ?? null)
      loadClientDetails(client, requestId)
    },
    [loadClientDetails, onClientChange, onClientResolved, setKeyboardState],
  )

  // Keep the latest confirmClient and preserved client reachable without making them
  // bootstrap-effect dependencies: their identity is unstable (inline parent callbacks),
  // and a parent re-render during the async restore would otherwise cancel the in-flight bootstrap.
  const confirmClientRef = useRef(confirmClient)
  const initialClientRef = useRef(initialClient)

  useEffect(() => {
    confirmClientRef.current = confirmClient
  }, [confirmClient])

  useEffect(() => {
    initialClientRef.current = initialClient
  }, [initialClient])

  function unselectClient() {
    // Runs on EVERY search keystroke: bail when nothing is selected — otherwise
    // onClientChange(null)/onAgreementChange(null, null) build a fresh host
    // state object per key and the entire wizard re-renders per keystroke.
    if (!selectedClient && !selectedAgreementKey && agreements.length === 0 && groupedDebts.length === 0 && registryItems.length === 0) {
      return
    }

    setSelectedClient(null)
    onClientResolved?.(null)
    setGroupedDebts([])
    setAgreements([])
    setSelectedAgreementKey('')
    setRegistryItems([])
    setRegistryLoading(false)
    clientDetailsRequestRef.current += 1
    registryRequestRef.current += 1
    registryInFlightKeyRef.current = null

    if (clientDetailsTimerRef.current !== null) {
      window.clearTimeout(clientDetailsTimerRef.current)
      clientDetailsTimerRef.current = null
    }

    onClientChange(null)
    onAgreementChange(null, null)
  }

  function handleSearchChange(value: string) {
    setQuery(value)

    // Typing in the search field always means the user wants to look up a new client,
    // even right after one was selected — switch back into search mode and run the query.
    if (keyboardState !== 'ClientSearch') {
      setKeyboardState('ClientSearch')
    }

    unselectClient()

    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current)
    }

    // Hold off until the user has typed enough characters. Below the threshold, clear any
    // stale results and bump the request id so an already in-flight query can't repaint them.
    if (value.trim().length < WIZARD_CLIENT_SEARCH_MIN_LENGTH) {
      searchRequestRef.current += 1
      loadedCountRef.current = 0
      setCarousel(WIZARD_CLIENT_CAROUSEL_INITIAL)

      return
    }

    searchTimerRef.current = window.setTimeout(() => {
      searchTimerRef.current = null
      void runSearch(value)
    }, 260)
  }

  async function runSearch(value: string) {
    const requestId = searchRequestRef.current + 1
    searchRequestRef.current = requestId
    searchAbortRef.current?.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller

    try {
      const data = await searchWizardClients(value, 20, 0, controller.signal)

      if (searchRequestRef.current === requestId && !controller.signal.aborted) {
        loadedCountRef.current = data.length
        applySearchResults(data)
      }
    } catch {
      if (controller.signal.aborted) {
        return
      }

      if (searchRequestRef.current === requestId) {
        setCarousel(WIZARD_CLIENT_CAROUSEL_INITIAL)
      }
    } finally {
      if (searchAbortRef.current === controller) {
        searchAbortRef.current = null
      }
    }
  }

  function applySearchResults(data: Client[]) {
    if (data.length === 1) {
      const client = data[0]
      const { bottom, top } = buildWizardClientStacks(client)

      setCarousel({ dataBottom: bottom, dataTop: top, selected: client, showDetails: true })
      confirmClient(client)

      return
    }

    const halfLength = Math.ceil(data.length / 2)

    setCarousel({
      dataBottom: data.slice(halfLength),
      dataTop: data.slice(0, halfLength),
      selected: null,
      showDetails: false,
    })
  }

  function selectFromTop() {
    const item = carousel.dataTop[carousel.dataTop.length - 1]

    if (!item) {
      unselectClient()

      return
    }

    const dataBottom =
      carousel.selected && (carousel.selected.Id ?? 0) > 0 ? [carousel.selected, ...carousel.dataBottom] : carousel.dataBottom

    setCarousel({ dataBottom, dataTop: carousel.dataTop.slice(0, -1), selected: item, showDetails: true })

    if (dataBottom.length === 0) {
      void runVirtualLoad()
    }

    // Mark the scrolled-to client immediately, but debounce heavy detail requests while
    // the user is holding Up/Down so the server is not hit for every intermediate row.
    confirmClient(item, { debounceDetails: true })
  }

  function selectFromBottom() {
    const item = carousel.dataBottom[0]

    if (!item) {
      unselectClient()

      return
    }

    const dataTop =
      carousel.selected && (carousel.selected.Id ?? 0) > 0 ? [...carousel.dataTop, carousel.selected] : carousel.dataTop

    setCarousel({ dataBottom: carousel.dataBottom.slice(1), dataTop, selected: item, showDetails: true })

    // Mark the scrolled-to client immediately, but debounce heavy detail requests while
    // the user is holding Up/Down so the server is not hit for every intermediate row.
    confirmClient(item, { debounceDetails: true })
  }

  async function runVirtualLoad() {
    if (isVirtualLoadingRef.current) {
      return
    }

    isVirtualLoadingRef.current = true
    virtualSearchAbortRef.current?.abort()
    const controller = new AbortController()
    virtualSearchAbortRef.current = controller

    try {
      const data = await searchWizardClients(query, 10, loadedCountRef.current, controller.signal)

      if (!data.length) {
        loadedCountRef.current = 0

        return
      }

      loadedCountRef.current += data.length
      setCarousel((current) => ({ ...current, dataBottom: [...current.dataBottom, ...data] }))
    } catch {
      if (controller.signal.aborted) {
        return
      }

      loadedCountRef.current = 0
    } finally {
      if (virtualSearchAbortRef.current === controller) {
        virtualSearchAbortRef.current = null
      }
      isVirtualLoadingRef.current = false
    }
  }

  function enterSelectClient() {
    const item = carousel.selected

    if (!item) {
      return
    }

    if (item.SubClients?.length) {
      const { bottom, top } = buildWizardClientStacks(item, { includeRootClients: false })

      setCarousel({ dataBottom: bottom, dataTop: top, selected: item, showDetails: true })
    }

    confirmClient(item)
  }

  function pickClient(client: Client) {
    // Re-center the carousel on the picked client so the highlighted center card always
    // matches the selected client (otherwise clicking a row desyncs it from the arrows).
    setCarousel((current) => {
      const all = [...current.dataTop, ...(current.selected ? [current.selected] : []), ...current.dataBottom]
      const key = String(client.NetUid || client.Id || '')
      const index = all.findIndex((item) => String(item.NetUid || item.Id || '') === key)

      if (index < 0) {
        return { ...current, selected: client, showDetails: true }
      }

      return {
        dataBottom: all.slice(index + 1),
        dataTop: all.slice(0, index),
        selected: client,
        showDetails: true,
      }
    })
    confirmClient(client)
    // The clicked row unmounts after re-centering, so restore focus to the (hidden) search
    // input — otherwise focus falls back to the body and arrow-key navigation stops working.
    focusSearchInput()
  }

  function selectAgreement(agreement: ClientAgreement) {
    setSelectedAgreementKey(getWizardAgreementKey(agreement))
    onAgreementChange(agreement.NetUid ?? null, toSalesUkraineAgreement(agreement))
  }

  function selectNextAgreement() {
    if (!agreements.length) {
      return
    }

    const index = agreements.findIndex((item) => getWizardAgreementKey(item) === selectedAgreementKey)

    if (index < 0) {
      selectAgreement(agreements[0])

      return
    }

    selectAgreement(agreements[index + 1] ?? agreements[0])
  }

  function selectPreviousAgreement() {
    if (!agreements.length) {
      return
    }

    const index = agreements.findIndex((item) => getWizardAgreementKey(item) === selectedAgreementKey)

    if (index < 0) {
      selectAgreement(agreements[0])

      return
    }

    selectAgreement(agreements[index - 1] ?? agreements[agreements.length - 1])
  }

  function focusSearchInput() {
    window.requestAnimationFrame(() => searchInputRef.current?.focus())
  }

  // Up/Down (carousel) and Escape (back / reveal search) must always work on this step —
  // even after a click or a step switch moved focus off the search input. A capture-phase
  // document listener gives them top priority, independent of which element is focused
  // (skipped while one of this step's overlays is open so those handle the key themselves).
  // Escape lived only on the wizard's onKeyDown before, so it silently died whenever focus
  // was outside the wizard (e.g. right after returning from another step).
  const arrowNavRef = useRef<(event: KeyboardEvent) => void>(() => {})

  useEffect(() => {
    arrowNavRef.current = (event: KeyboardEvent) => {
      const isArrow = event.key === 'ArrowUp' || event.key === 'ArrowDown'
      const isAgreementArrow = event.key === 'ArrowLeft' || event.key === 'ArrowRight'
      const isEscape = event.key === 'Escape'

      if (!isArrow && !isAgreementArrow && !isEscape) {
        return
      }

      if (
        editShiftSale ||
        auditSale ||
        detailsSale ||
        mergedSale ||
        isOrderedProductsOpen ||
        printState
      ) {
        return
      }

      if (isEscape) {
        event.preventDefault()
        event.stopPropagation()

        if (keyboardState === 'ClientSelection') {
          setCarousel((current) => ({ ...current, showDetails: false }))
          setKeyboardState('ClientSearch')
          setQuery('')
          focusSearchInput()
        } else if (keyboardState === 'ClientAgreementSelection') {
          setKeyboardState('ClientSelection')
        } else {
          onRequestClose?.()
        }

        return
      }

      if (isAgreementArrow) {
        // Left/Right switch agreements — focus-independent, like Up/Down above, so it keeps
        // working after returning from another step or clicking off the search input.
        if (keyboardState !== 'ClientSelection' && keyboardState !== 'ClientAgreementSelection') {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        setKeyboardState('ClientAgreementSelection')

        if (event.key === 'ArrowRight') {
          selectNextAgreement()
        } else {
          selectPreviousAgreement()
        }

        return
      }

      if (!carousel.dataTop.length && !carousel.dataBottom.length) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'ArrowUp') {
        selectFromTop()
      } else {
        selectFromBottom()
      }

      if (keyboardState === 'ClientSearch') {
        setKeyboardState('ClientSelection')
      }
    }
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => arrowNavRef.current(event)
    document.addEventListener('keydown', listener, true)

    return () => document.removeEventListener('keydown', listener, true)
  }, [])

  useWizardKeyHandler((event: WizardKeyEvent) => {
    switch (event.hotkey) {
      case 'ArrowUp': {
        // Up/Down always navigate clients — even while selecting an agreement (Left/Right),
        // so agreement navigation doesn't disable client navigation.
        if (!carousel.dataTop.length && !carousel.dataBottom.length) {
          return false
        }

        selectFromTop()

        if (keyboardState === 'ClientSearch') {
          setKeyboardState('ClientSelection')
        }

        return true
      }
      case 'ArrowDown': {
        if (!carousel.dataTop.length && !carousel.dataBottom.length) {
          return false
        }

        selectFromBottom()

        if (keyboardState === 'ClientSearch') {
          setKeyboardState('ClientSelection')
        }

        return true
      }
      case 'ArrowRight':
      case 'ArrowLeft': {
        if (keyboardState !== 'ClientSelection' && keyboardState !== 'ClientAgreementSelection') {
          return false
        }

        setKeyboardState('ClientAgreementSelection')

        if (event.hotkey === 'ArrowRight') {
          selectNextAgreement()
        } else {
          selectPreviousAgreement()
        }

        return true
      }
      case 'Enter': {
        if (event.inEditable && event.nativeEvent.target !== searchInputRef.current) {
          return false
        }

        if (!carousel.selected) {
          return false
        }

        enterSelectClient()

        return true
      }
      case 'Escape': {
        if (keyboardState === 'ClientSelection') {
          setCarousel((current) => ({ ...current, showDetails: false }))
          setKeyboardState('ClientSearch')
          setQuery('')
          focusSearchInput()

          return true
        }

        if (keyboardState === 'ClientAgreementSelection') {
          setKeyboardState('ClientSelection')

          return true
        }

        onRequestClose?.()

        return true
      }
      default:
        return false
    }
  })

  function handleStatusChange(value: number) {
    setStatusFilter(value)
    setRegistryItems([])
    void fetchRegister({ type: value })
  }

  function handleSaleSearchChange(value: string) {
    setSaleSearch(value)

    if (saleSearchTimerRef.current !== null) {
      window.clearTimeout(saleSearchTimerRef.current)
    }

    saleSearchTimerRef.current = window.setTimeout(() => {
      saleSearchTimerRef.current = null
      void fetchRegister({ value })
    }, 200)
  }

  function handleDateFromChange(value: string) {
    // Clearing the native date picker should fall back to 7 days ago, not an empty range.
    const nextValue = value || formatLocalDate(getDateDaysAgo(7))
    setDateFrom(nextValue)
    void fetchRegister({ from: nextValue })
  }

  function handleDateToChange(value: string) {
    // Clearing the native date picker should fall back to today, not an empty range.
    const nextValue = value || formatLocalDate(new Date())
    setDateTo(nextValue)
    void fetchRegister({ to: nextValue })
  }

  function openRow(sale: SalesUkraineSale) {
    if (sale.InputSaleMerges?.length) {
      setMergedSale(sale)
    } else {
      onOpenSale(sale)
    }
  }

  function handleMergedEdit(sale: SalesUkraineSale) {
    const unionSale = mergedSale

    setMergedSale(null)
    onEditMergedSale?.(sale, unionSale)
  }

  function handleMergedInvoice(sale: SalesUkraineSale) {
    const unionSale = mergedSale

    setMergedSale(null)
    onInvoiceMergedSale?.(sale, unionSale)
  }

  function handleMergedNewSale() {
    const unionSale = mergedSale
    setMergedSale(null)

    if (unionSale) {
      onCreateMergedMainClientSale?.(unionSale)
    }
  }

  function replaceRegistryRow(statistic: WizardSaleRegisterStatistic, _autoExpand: boolean) {
    void _autoExpand

    const netId = statistic.Sale?.NetUid

    if (!netId) {
      return
    }

    setRegistryItems((current) => current.map((item) => (item.Sale?.NetUid === netId ? statistic : item)))
  }

  async function refreshRegistryRow(sale: SalesUkraineSale, autoExpand: boolean) {
    if (!sale.NetUid) {
      return
    }

    const statistic = await getSaleStatisticBySaleId(sale.NetUid).catch(() => null)

    if (statistic?.Sale) {
      replaceRegistryRow(statistic as unknown as WizardSaleRegisterStatistic, autoExpand)
    }
  }

  function openEditRow(sale: SalesUkraineSale) {
    setEditShiftSale(sale)
    void refreshRegistryRow(sale, false)
  }

  function openAudit(sale: SalesUkraineSale) {
    setAuditSale(sale)
    setAuditStatistic(null)
    setAuditError(null)

    if (!sale.NetUid) {
      return
    }

    setAuditLoading(true)
    const requestId = auditRequestRef.current + 1
    auditRequestRef.current = requestId

    void (async () => {
      try {
        const statistic = await getSaleStatisticBySaleId(sale.NetUid as string)

        if (auditRequestRef.current === requestId) {
          setAuditStatistic(statistic)

          if (statistic?.Sale) {
            replaceRegistryRow(statistic as unknown as WizardSaleRegisterStatistic, false)
          }
        }
      } catch (auditFetchError) {
        if (auditRequestRef.current === requestId) {
          setAuditError(auditFetchError instanceof Error ? auditFetchError.message : t('Не вдалося завантажити дані'))
        }
      } finally {
        if (auditRequestRef.current === requestId) {
          setAuditLoading(false)
        }
      }
    })()
  }

  function closeAudit() {
    auditRequestRef.current += 1
    setAuditSale(null)
    setAuditStatistic(null)
    setAuditError(null)
    setAuditLoading(false)
  }

  async function printRow(sale: SalesUkraineSale) {
    const netId = sale.NetUid

    if (!netId) {
      return
    }

    const requestId = printRequestRef.current + 1
    printRequestRef.current = requestId
    setPrintState({ document: null, isLoading: true })

    // Mark-before-print (mirrors legacy OnPrintActProtocolEdit): on the first print of the current
    // edit act, persist IsInvoice + IsPrintedActProtocolEdit so the printed-status indicator lights
    // up. A later shift resets the flag server-side, so this re-marks after each edit. The registry
    // row is a lightweight SalesRegisterModel, so hydrate the full sale first — posting an
    // un-hydrated sale to /sales/update would wipe its OrderPackages (empty Order.OrderPackages ->
    // RemoveAllByOrderId).
    if (!sale.IsPrintedActProtocolEdit) {
      try {
        const hydrated = await getSaleById(netId)

        if (hydrated) {
          await updateSale({ ...hydrated, IsInvoice: true, IsPrintedActProtocolEdit: true })
        }
      } catch {
        // Persisting the printed flag is best-effort; never block the print itself.
      }
    }

    void refreshRegistryRow(sale, true)

    try {
      const document = await getSaleActProtocolEditDocument(netId)

      if (printRequestRef.current === requestId) {
        setPrintState({ document, isLoading: false })
      }
    } catch {
      if (printRequestRef.current === requestId) {
        setPrintState(null)
        notifications.show({ color: 'red', message: t('Не вдалося сформувати документ') })
      }
    }
  }

  function closePrint() {
    printRequestRef.current += 1
    setPrintState(null)
  }

  async function handleShiftSaved() {
    const shifted = editShiftSale
    setEditShiftSale(null)
    bumpWizardDebtRefresh()

    if (selectedClient) {
      void loadGroupedDebts(selectedClient)
    }

    // Refresh the whole register first (a bill-shift can spawn a new child sale), then re-pull the
    // edited sale's row from the per-sale statistic endpoint so its recomputed Сума replaces the
    // (stale) list value — otherwise it stays 0 until a manual page reload.
    await fetchRegister()

    if (shifted) {
      await refreshRegistryRow(shifted, false)
    }
  }

  const scheduleRealtimeRegister = useCallback(() => {
    if (!registerArgsRef.current.clientNetId) {
      return
    }

    if (realtimeTimerRef.current !== null) {
      window.clearTimeout(realtimeTimerRef.current)
    }

    realtimeTimerRef.current = window.setTimeout(() => {
      realtimeTimerRef.current = null
      void fetchRegister()
    }, 400)
  }, [fetchRegister])

  useRealtimeEvent(realtimeEvents.saleAdded, scheduleRealtimeRegister)
  useRealtimeEvent(realtimeEvents.saleUpdated, scheduleRealtimeRegister)

  useEffect(() => {
    // Returning to this step with a client already chosen must restore ClientSelection so the
    // Left/Right agreement switch works again. Done before the one-shot guard below so it also
    // re-applies under React StrictMode's mount double-invoke (which would otherwise leave the
    // keyboard on ClientSearch after the unmount cleanup). A fresh entry has no client → search.
    if (clientNetId) {
      setWizardKeyboardState('ClientSelection')
    }

    if (bootstrappedRef.current || !clientNetId) {
      return
    }

    // Do NOT mark bootstrapped here. The server-restore path below is async and gets cancelled by
    // this effect's cleanup under React StrictMode's mount double-invoke; setting the flag now would
    // make the second run skip and leave the client unloaded — exactly what happens when opening a
    // sale for editing (step 2 first, no preserved client). confirmClient sets the flag once a
    // client is actually resolved, which still guards against the carousel-wiping re-entry.

    // Restore instantly from the client preserved by the parent across step switches.
    const preserved = initialClientRef.current

    if (preserved && preserved.NetUid === clientNetId && (preserved.Id ?? 0) > 0) {
      const { bottom, top } = buildWizardClientStacks(preserved)

      setCarousel({ dataBottom: bottom, dataTop: top, selected: preserved, showDetails: true })
      confirmClientRef.current(preserved)

      return
    }

    let cancelled = false

    async function restore(netId: string) {
      const client = await getWizardHeaderClient(netId).catch(() => null)

      if (cancelled || !client || (client.Id ?? 0) <= 0) {
        return
      }

      if (!client.IsTradePoint && !client.IsSubClient) {
        const subClients = await getClientSubClients(netId).catch(() => null)

        if (subClients) {
          client.SubClients = subClients
        }
      } else {
        const rootClient = await getRootClientBySubClientNetId(netId).catch(() => null)

        if (rootClient) {
          client.RootClients = [{ RootClient: rootClient }]
        }
      }

      if (cancelled) {
        return
      }

      const { bottom, top } = buildWizardClientStacks(client)

      setCarousel({ dataBottom: bottom, dataTop: top, selected: client, showDetails: true })
      confirmClientRef.current(client)
    }

    void restore(clientNetId)

    return () => {
      cancelled = true
    }
  }, [clientNetId])

  useEffect(
    () => () => {
      const timers = [searchTimerRef, saleSearchTimerRef, realtimeTimerRef, clientDetailsTimerRef]

      timers.forEach((timer) => {
        if (timer.current !== null) {
          window.clearTimeout(timer.current)
        }
      })

      setWizardKeyboardState('ClientSearch')
    },
    [],
  )

  const selectedAgreement = agreements.find((item) => getWizardAgreementKey(item) === selectedAgreementKey) ?? null
  const selectedAgreementClientId = selectedAgreement?.ClientId ?? selectedAgreement?.Client?.Id

  return (
    <>
      <Box className="new-sale-client-step">
        {selectedClient && (
          <WizardClientHeroHeader
            activeAgreementNetId={selectedAgreementKey}
            agreements={agreements}
            client={selectedClient}
            debts={groupedDebts}
            headerClose={headerClose}
            headerTools={headerTools}
            registryCount={registryItems.length}
          />
        )}

        <Box className="new-sale-client-drum-panel">
          <Box className="new-sale-client-drum-panel__glow" />
          <Box className="new-sale-client-drum-panel__body">
            <WizardClientCarousel
              carousel={carousel}
              hasDebt={Boolean(selectedClient) && groupedDebts.length > 0}
              hideName={false}
              searchInputRef={searchInputRef}
              searchMode={keyboardState === 'ClientSearch'}
              searchValue={query}
              selectedClientKey={selectedClient ? String(selectedClient.NetUid || selectedClient.Id || '') : ''}
              onPickClient={pickClient}
              onSearchChange={handleSearchChange}
            />
          </Box>
        </Box>

        <Box className="new-sale-client-workspace">
          {selectedClient ? (
            <>
              <Box className="new-sale-client-agreements-zone">
                <WizardClientAgreementsStrip
                  agreements={agreements}
                  selectedKey={selectedAgreementKey}
                  onSelect={selectAgreement}
                />
              </Box>
              <WizardClientRegistry
                canEdit={canEdit}
                dateFrom={dateFrom}
                dateTo={dateTo}
                isLoading={isRegistryLoading}
                items={registryItems}
                saleSearch={saleSearch}
                selectedAgreementClientId={selectedAgreementClientId}
                status={statusFilter}
                onAuditRow={openAudit}
                onChangeDateFrom={handleDateFromChange}
                onChangeDateTo={handleDateToChange}
                onChangeSaleSearch={handleSaleSearchChange}
                onChangeStatus={handleStatusChange}
                onDeliveryRow={setDetailsSale}
                onEditRow={openEditRow}
                onOpenOrderedProducts={() => setOrderedProductsOpen(true)}
                onOpenRow={openRow}
                onPrintRow={(sale) => void printRow(sale)}
              />
            </>
          ) : (
            <Stack align="center" className="new-sale-client-empty" gap={10} justify="center">
              <span className="new-sale-client-empty__icon">
                <IconUserSearch size={30} stroke={1.55} />
              </span>
              <Stack align="center" gap={3}>
                <Text className="new-sale-client-empty__title">{t('Клієнт ще не вибраний')}</Text>
                <Text className="new-sale-client-empty__description">
                  {t('Оберіть клієнта у списку зліва, щоб відкрити договори, борги та реєстр документів.')}
                </Text>
              </Stack>
            </Stack>
          )}
        </Box>
      </Box>

      <WizardOrderedProductsDrawer
        clientNetId={selectedClient?.NetUid ?? null}
        opened={isOrderedProductsOpen}
        onClose={() => setOrderedProductsOpen(false)}
      />

      <SaleEditDrawer sale={editShiftSale} onClose={() => setEditShiftSale(null)} onSaved={handleShiftSaved} />

      <AppDrawer
        opened={Boolean(auditSale)}
        position="right"
        size="min(720px, 100vw)"
        title={t('Рух товарно-матеріальних цінностей')}
        onClose={closeAudit}
      >
        <SaleAuditDetail error={auditError} isLoading={isAuditLoading} statistic={auditStatistic} />
      </AppDrawer>

      <SaleDetailsDrawer
        sale={detailsSale}
        onClose={() => setDetailsSale(null)}
        onSaved={() => {
          setDetailsSale(null)
          void fetchRegister()
        }}
      />

      <MergedSalesDrawer
        clientAgreementNetId={mergedSale?.ClientAgreement?.NetUid ?? null}
        saleNetId={mergedSale?.NetUid ?? null}
        onChanged={() => void fetchRegister()}
        onClose={() => setMergedSale(null)}
        onCreateNewSale={onCreateMergedMainClientSale ? handleMergedNewSale : undefined}
        onEditSale={onEditMergedSale ? handleMergedEdit : undefined}
        onInvoice={onInvoiceMergedSale ? handleMergedInvoice : undefined}
      />

      <WizardPrintDocumentModal opened={Boolean(printState)} printState={printState} onClose={closePrint} />
    </>
  )
}

function WizardPrintDocumentModal({
  opened,
  printState,
  onClose,
}: {
  opened: boolean
  printState: WizardPrintState | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const document = printState?.document
  const hasDocuments = Boolean(document?.pdfUrl || document?.excelUrl)

  return (
    <AppModal
      centered
      className="new-sale-print-modal"
      classNames={{
        body: 'new-sale-print-modal__modal-body',
        content: 'new-sale-print-modal__content',
        header: 'new-sale-print-modal__header',
        title: 'new-sale-print-modal__modal-title',
      }}
      opened={opened}
      size={460}
      title={<span className="new-sale-print-modal__title">{t('Документ')}</span>}
      onClose={onClose}
    >
      <Stack className="new-sale-print-modal__body" gap={0}>
        <Box className="new-sale-print-modal__summary">
          <span className="new-sale-print-modal__summary-icon">
            <IconFileCheck size={22} stroke={1.8} />
          </span>
          <Box className="new-sale-print-modal__summary-copy">
            <Text className="new-sale-print-modal__eyebrow">{t('Друк')}</Text>
            <Text className="new-sale-print-modal__heading">{t('Документ продажу')}</Text>
            <Text className="new-sale-print-modal__description">
              {printState?.isLoading
                ? t('Формуємо файл для відкриття')
                : hasDocuments
                  ? t('Виберіть потрібний формат документа')
                  : t('Документ недоступний для завантаження')}
            </Text>
          </Box>
        </Box>

        {printState?.isLoading ? (
          <Box className="new-sale-print-modal__loading">
            <Loader color="orange" size="sm" />
            <Text>{t('Зачекайте кілька секунд')}</Text>
          </Box>
        ) : hasDocuments ? (
          <Stack className="new-sale-print-modal__documents" gap={8}>
            {document?.pdfUrl && (
              <WizardPrintDocumentLink
                href={document.pdfUrl}
                icon={<IconFileTypePdf size={20} stroke={1.8} />}
                kind="pdf"
                label={t('PDF')}
                meta={t('Відкрити документ у новій вкладці')}
              />
            )}
            {document?.excelUrl && (
              <WizardPrintDocumentLink
                href={document.excelUrl}
                icon={<IconFileExcel size={20} stroke={1.8} />}
                kind="excel"
                label={t('Excel')}
                meta={t('Відкрити таблицю у новій вкладці')}
              />
            )}
          </Stack>
        ) : (
          <Box className="new-sale-print-modal__empty">
            <Text>{t('Файл не повернувся з сервера')}</Text>
            <Text>{t('Спробуйте сформувати документ ще раз')}</Text>
          </Box>
        )}

      </Stack>
    </AppModal>
  )
}

function WizardPrintDocumentLink({
  href,
  icon,
  kind,
  label,
  meta,
}: {
  href: string
  icon: ReactNode
  kind: 'excel' | 'pdf'
  label: string
  meta: string
}) {
  return (
    <Anchor className={`new-sale-print-document is-${kind}`} href={href} rel="noopener noreferrer" target="_blank">
      <span className="new-sale-print-document__icon">{icon}</span>
      <span className="new-sale-print-document__copy">
        <span className="new-sale-print-document__label">{label}</span>
        <span className="new-sale-print-document__meta">{meta}</span>
      </span>
      <IconExternalLink className="new-sale-print-document__arrow" size={17} stroke={1.8} />
    </Anchor>
  )
}

function toSalesUkraineAgreement(agreement: ClientAgreement): SalesUkraineClientAgreement {
  return agreement as unknown as SalesUkraineClientAgreement
}

function getDateDaysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)

  return date
}

function getRegisterRequestKey(query: WizardSaleRegisterQuery): string {
  return [query.clientNetId, query.from, query.to, query.type, query.value.trim()].join('|')
}
