import { Anchor, Box, Button, Group, Loader, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconFileExcel, IconFileTypePdf, IconUserOff } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { getSaleActProtocolEditDocument } from '../../api/salesUkraineApi'
import { SALES_UKRAINE_EDIT_PERMISSION } from '../../permissions'
import type { SaleDocumentResult, SalesUkraineClientAgreement, SalesUkraineSale } from '../../types'
import { MergedSalesDrawer } from '../MergedSalesDrawer'
import { SaleDetailsDrawer } from '../SaleDetailsDrawer'
import { SaleEditDrawer } from '../SaleEditDrawer'
import { SaleEditorDrawer } from '../SaleEditorDrawer'
import { WizardClientAgreementsStrip } from './WizardClientAgreementsStrip'
import { WizardClientCarousel } from './WizardClientCarousel'
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

export function NewSaleClientStep({
  agreementNetId,
  clientNetId,
  onClientChange,
  onAgreementChange,
  onRequestClose,
}: {
  agreementNetId: string | null
  clientNetId: string | null
  onAgreementChange: (agreementNetId: string | null, agreement: SalesUkraineClientAgreement | null) => void
  onClientChange: (clientNetId: string | null) => void
  onRequestClose?: () => void
}) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const canEdit = hasPermission(SALES_UKRAINE_EDIT_PERMISSION)
  const { state: keyboardState, setState: setKeyboardState, consumeNextEscape } = useWizardKeyboard(0)

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
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [isOrderedProductsOpen, setOrderedProductsOpen] = useState(false)
  const [editShiftSale, setEditShiftSale] = useState<SalesUkraineSale | null>(null)
  const [editorSale, setEditorSale] = useState<SalesUkraineSale | null>(null)
  const [mergedSaleNetId, setMergedSaleNetId] = useState<string | null>(null)
  const [detailsSale, setDetailsSale] = useState<SalesUkraineSale | null>(null)
  const [auditSale, setAuditSale] = useState<SalesUkraineSale | null>(null)
  const [auditStatistic, setAuditStatistic] = useState<SaleAuditStatistic | null>(null)
  const [isAuditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [printState, setPrintState] = useState<WizardPrintState | null>(null)
  const [isExitConfirmOpen, setExitConfirmOpen] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchTimerRef = useRef<number | null>(null)
  const searchRequestRef = useRef(0)
  const isVirtualLoadingRef = useRef(false)
  const loadedCountRef = useRef(0)
  const registryRequestRef = useRef(0)
  const auditRequestRef = useRef(0)
  const printRequestRef = useRef(0)
  const saleSearchTimerRef = useRef<number | null>(null)
  const delayedRegisterTimerRef = useRef<number | null>(null)
  const realtimeTimerRef = useRef<number | null>(null)
  const bootstrappedRef = useRef(false)
  const restoreAgreementNetIdRef = useRef<string | null>(null)
  const registerArgsRef = useRef<WizardSaleRegisterQuery>({
    clientNetId: '',
    from: dateFrom,
    to: dateTo,
    type: statusFilter,
    value: saleSearch,
  })

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

    const requestId = registryRequestRef.current + 1
    registryRequestRef.current = requestId
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
    }
  }, [])

  const loadGroupedDebts = useCallback(async (client: Client) => {
    if (!client.NetUid) {
      return
    }

    const debts = await getWizardClientGroupedDebts(client.NetUid).catch(() => [])
    setGroupedDebts(debts)
  }, [])

  const loadAgreements = useCallback(
    async (client: Client) => {
      if (!client.NetUid) {
        return
      }

      try {
        const list = await getWizardClientAgreements(client.NetUid)
        setAgreements(list)

        const restoreNetId = restoreAgreementNetIdRef.current
        restoreAgreementNetIdRef.current = null
        const restored = restoreNetId ? list.find((item) => item.NetUid === restoreNetId) : undefined
        const active = restored ?? list.find((item) => item.Agreement?.IsActive)

        if (active) {
          setSelectedAgreementKey(getWizardAgreementKey(active))
          onAgreementChange(active.NetUid ?? null, toSalesUkraineAgreement(active))
        } else {
          setSelectedAgreementKey('')
          onAgreementChange(null, null)
        }
      } catch {
        setAgreements([])
        setSelectedAgreementKey('')
      }
    },
    [onAgreementChange],
  )

  const confirmClient = useCallback(
    (client: Client) => {
      if ((client.Id ?? 0) <= 0) {
        return
      }

      setSelectedClient(client)
      setRegistryItems([])
      setExpandedKey(null)
      setKeyboardState('ClientSelection')
      onClientChange(client.NetUid ?? null)
      void loadGroupedDebts(client)
      void loadAgreements(client)
      void fetchRegister({ clientNetId: client.NetUid || '' })

      if (delayedRegisterTimerRef.current !== null) {
        window.clearTimeout(delayedRegisterTimerRef.current)
      }

      delayedRegisterTimerRef.current = window.setTimeout(() => {
        delayedRegisterTimerRef.current = null
        void fetchRegister()
      }, 800)
    },
    [fetchRegister, loadAgreements, loadGroupedDebts, onClientChange, setKeyboardState],
  )

  function unselectClient() {
    setSelectedClient(null)
    setGroupedDebts([])
    setAgreements([])
    setSelectedAgreementKey('')
    setRegistryItems([])
    setExpandedKey(null)
    onClientChange(null)
    onAgreementChange(null, null)
  }

  function handleSearchChange(value: string) {
    setQuery(value)

    if (keyboardState !== 'ClientSearch') {
      return
    }

    unselectClient()

    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current)
    }

    searchTimerRef.current = window.setTimeout(() => {
      searchTimerRef.current = null
      void runSearch(value)
    }, 260)
  }

  async function runSearch(value: string) {
    const requestId = searchRequestRef.current + 1
    searchRequestRef.current = requestId

    try {
      const data = await searchWizardClients(value, 20, 0)

      if (searchRequestRef.current !== requestId) {
        return
      }

      loadedCountRef.current = data.length
      applySearchResults(data)
    } catch {
      if (searchRequestRef.current === requestId) {
        setCarousel(WIZARD_CLIENT_CAROUSEL_INITIAL)
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

    unselectClient()
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
    unselectClient()
  }

  async function runVirtualLoad() {
    if (isVirtualLoadingRef.current) {
      return
    }

    isVirtualLoadingRef.current = true

    try {
      const data = await searchWizardClients(query, 10, loadedCountRef.current)

      if (!data.length) {
        loadedCountRef.current = 0

        return
      }

      loadedCountRef.current += data.length
      setCarousel((current) => ({ ...current, dataBottom: [...current.dataBottom, ...data] }))
    } catch {
      loadedCountRef.current = 0
    } finally {
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
    const ordered = [...carousel.dataTop, ...(carousel.selected ? [carousel.selected] : []), ...carousel.dataBottom]
    const index = ordered.indexOf(client)

    if (index < 0) {
      return
    }

    setCarousel({
      dataBottom: ordered.slice(index + 1),
      dataTop: ordered.slice(0, index),
      selected: client,
      showDetails: true,
    })
    confirmClient(client)
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

  useWizardKeyHandler((event: WizardKeyEvent) => {
    switch (event.hotkey) {
      case 'ArrowUp': {
        if (keyboardState === 'ClientAgreementSelection') {
          return false
        }

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
        if (keyboardState === 'ClientAgreementSelection') {
          return false
        }

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

        setExitConfirmOpen(true)

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
    setDateFrom(value)
    void fetchRegister({ from: value })
  }

  function handleDateToChange(value: string) {
    setDateTo(value)
    void fetchRegister({ to: value })
  }

  function toggleExpand(key: string) {
    setExpandedKey((current) => (current === key ? null : key))
  }

  function openRow(sale: SalesUkraineSale) {
    if (sale.InputSaleMerges?.length) {
      setMergedSaleNetId(sale.NetUid ?? null)
    } else {
      setEditorSale(sale)
    }
  }

  const openAudit = useCallback(
    (sale: SalesUkraineSale) => {
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
    },
    [t],
  )

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

  function handleShiftSaved() {
    setEditShiftSale(null)
    setExpandedKey(null)

    if (selectedClient) {
      confirmClient(selectedClient)
    }
  }

  function confirmExitYes() {
    setExitConfirmOpen(false)
    setQuery('')
    setCarousel(WIZARD_CLIENT_CAROUSEL_INITIAL)
    unselectClient()
    setKeyboardState('ClientSearch')
    focusSearchInput()

    if (onRequestClose) {
      onRequestClose()
    }
  }

  function confirmExitCancel() {
    setExitConfirmOpen(false)
    consumeNextEscape()
    focusSearchInput()
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
    if (bootstrappedRef.current || !clientNetId) {
      return
    }

    bootstrappedRef.current = true
    restoreAgreementNetIdRef.current = agreementNetId
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
      confirmClient(client)
    }

    void restore(clientNetId)

    return () => {
      cancelled = true
    }
  }, [agreementNetId, clientNetId, confirmClient])

  useEffect(
    () => () => {
      const timers = [searchTimerRef, saleSearchTimerRef, delayedRegisterTimerRef, realtimeTimerRef]

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
      <Group align="stretch" gap="md" wrap="nowrap" style={{ height: 'calc(100dvh - 330px)', minHeight: 440 }}>
        <Box
          style={{
            borderRight: '1px solid var(--mantine-color-gray-3)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            paddingRight: 12,
            width: 300,
          }}
        >
          <WizardClientCarousel
            carousel={carousel}
            hasDebt={Boolean(selectedClient) && groupedDebts.length > 0}
            hideName={Boolean(selectedClient && (selectedClient.Id ?? 0) > 0)}
            searchInputRef={searchInputRef}
            searchValue={query}
            onPickClient={pickClient}
            onSearchChange={handleSearchChange}
          />
        </Box>

        <Box style={{ display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0 }}>
          {selectedClient ? (
            <Stack gap="sm" style={{ flex: 1, minHeight: 0 }}>
              <WizardClientAgreementsStrip
                agreements={agreements}
                selectedKey={selectedAgreementKey}
                onSelect={selectAgreement}
              />
              <WizardClientRegistry
                canEdit={canEdit}
                dateFrom={dateFrom}
                dateTo={dateTo}
                expandedKey={expandedKey}
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
                onEditRow={setEditShiftSale}
                onOpenOrderedProducts={() => setOrderedProductsOpen(true)}
                onOpenRow={openRow}
                onPrintRow={(sale) => void printRow(sale)}
                onToggleExpand={toggleExpand}
              />
            </Stack>
          ) : (
            <Stack align="center" gap="xs" justify="center" style={{ flex: 1 }}>
              <IconUserOff size={48} stroke={1.2} style={{ color: 'var(--mantine-color-gray-4)' }} />
              <Text c="dimmed">{t('Не вибраний клієнт')}</Text>
            </Stack>
          )}
        </Box>
      </Group>

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

      <SaleEditorDrawer
        sale={editorSale}
        onClose={() => {
          setEditorSale(null)
          void fetchRegister()
        }}
      />

      <MergedSalesDrawer
        saleNetId={mergedSaleNetId}
        onChanged={() => void fetchRegister()}
        onClose={() => setMergedSaleNetId(null)}
      />

      <AppModal centered opened={Boolean(printState)} size="sm" title={t('Документ')} onClose={closePrint}>
        {printState && (
          <Stack gap="sm">
            {printState.isLoading ? (
              <Group justify="center" py="md">
                <Loader size="sm" />
              </Group>
            ) : printState.document?.pdfUrl || printState.document?.excelUrl ? (
              <>
                {printState.document.pdfUrl && (
                  <Anchor href={printState.document.pdfUrl} rel="noopener noreferrer" target="_blank">
                    <Group gap="xs">
                      <IconFileTypePdf size={18} />
                      <Text>{t('Відкрити PDF')}</Text>
                    </Group>
                  </Anchor>
                )}
                {printState.document.excelUrl && (
                  <Anchor href={printState.document.excelUrl} rel="noopener noreferrer" target="_blank">
                    <Group gap="xs">
                      <IconFileExcel size={18} />
                      <Text>{t('Відкрити Excel')}</Text>
                    </Group>
                  </Anchor>
                )}
              </>
            ) : (
              <Text c="dimmed" size="sm">
                {t('Документ недоступний для завантаження')}
              </Text>
            )}
            <Group justify="flex-end">
              <Button variant="subtle" onClick={closePrint}>
                {t('Закрити')}
              </Button>
            </Group>
          </Stack>
        )}
      </AppModal>

      <AppModal
        centered
        closeOnEscape={false}
        opened={isExitConfirmOpen}
        size="sm"
        title={t('Підтвердження')}
        withCloseButton={false}
        onClose={confirmExitCancel}
      >
        <Box
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.stopPropagation()
              confirmExitYes()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              confirmExitCancel()
            }
          }}
        >
          <Stack gap="md">
            <Text>{t('Закрити вікно?')}</Text>
            <Group justify="flex-end">
              <Button color="gray" variant="subtle" onClick={confirmExitCancel}>
                {t('Скасувати')}
              </Button>
              <Button data-autofocus onClick={confirmExitYes}>
                {t('Так')}
              </Button>
            </Group>
          </Stack>
        </Box>
      </AppModal>
    </>
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
