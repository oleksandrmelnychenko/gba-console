import { useSingleFlight } from '../../../shared/hooks/useSingleFlight'
import { useBusyState } from '../../../shared/hooks/useBusyState'
import { getOrganizationDisplayName } from '../../../shared/organizations/organizationDisplayName'
import { TableChip } from '../../../shared/ui/TableChip'
import '../../../shared/ui/document-detail/document-detail.css'
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { AppModal, AppModalFooter } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import { Check, CircleAlert, Eye, FileChartColumn, Plus, Search, Trash2 } from 'lucide-react'
import { ProductCardModal } from '../../products/components/ProductCardModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import '../../../shared/ui/console-table-page.css'
import './new-ukraine-sale-return-page.css'
import './new-sale-return-create.css'
import {
  cancelSaleReturn,
  createSaleReturn,
  exportSaleReturnDocument,
  getReturnStorages,
  getReturnVatWarning,
  getSaleReturns,
  getSalesForReturn,
  getSalesReturnOrganizations,
  isSalesForReturnResultTruncated,
  MIN_SALES_FOR_RETURN_PRODUCT_SEARCH_LENGTH,
  searchSalesReturnClients,
} from '../api/salesReturnsApi'
import type {
  ReturnOrderItemDraft,
  SalesReturn,
  SalesReturnClient,
  SalesReturnDocument,
  SalesReturnItem,
  SalesReturnItemStatusValue,
  SalesReturnOrderItem,
  SalesReturnProduct,
  SalesReturnOrganization,
  SalesReturnSale,
  SalesReturnStorage,
} from '../types'
import {
  displayValue,
  formatAmount,
  formatDateTime,
  formatMoney,
  getEntityName,
  getStatusLabel,
  getStatusOptions,
  parseStatusValue,
  readNumber,
} from '../utils'
import {
  SalesPendingMutationRecoveredError,
  usePersistentSalesMutation,
} from '../../sales-ukraine/persistentSalesMutation'
import { ClientReturnsReportPanel } from '../components/ClientReturnsReportPanel'
import { ToolbarDateRangeFilter } from '../../../shared/ui/ToolbarDateRangeFilter'

const SALE_ITEMS_TABLE_LAYOUT = {
  columnPinning: {
    left: ['select'],
    right: ['actions'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const DETAIL_ITEMS_TABLE_LAYOUT = {
  columnPinning: {
    left: ['vendorCode'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const RETURNS_TABLE_LAYOUT = {
  columnPinning: {
    left: ['number', 'client'],
    // Pin the amount together with the actions — otherwise «Сума» slid under
    // the pinned actions on horizontal scroll and its tail was cut off.
    right: ['total', 'actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

type SaleItemRow = {
  item: SalesReturnOrderItem
  sale: SalesReturnSale
}

type ReturnsListState = {
  isLoading: boolean
  items: SalesReturn[]
}

type SalesSearchState = {
  isLoading: boolean
  sales: SalesReturnSale[]
}

type ItemEditorState = {
  draft?: ReturnOrderItemDraft
  row: SaleItemRow
}

export function NewUkraineSaleReturnPage() {
  const runActionOnce = useSingleFlight()
  const { t } = useI18n()
  const runCancelMutation = usePersistentSalesMutation(
    'sale-return-cancel',
    'ukraine-sale-return:cancel',
  )
  const runCreateMutation = usePersistentSalesMutation(
    'sale-return-create',
    'ukraine-sale-return:create',
  )
  const [fromDate, setFromDate] = useState(() => shiftDateInput(-14))
  const [toDate, setToDate] = useState(() => shiftDateInput(0))
  const [searchDraft, setSearchDraft] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGINATOR_PAGE_SIZE)
  const [reloadKey, setReloadKey] = useState(0)
  const [reportOpened, setReportOpened] = useState(false)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const [listState, setListState] = useState<ReturnsListState>({
    isLoading: false,
    items: [],
  })
  const [listError, setListError] = useState<string | null>(null)
  const [selectedReturn, setSelectedReturn] = useState<SalesReturn | null>(null)
  const [downloadDocument, setDownloadDocument] = useState<SalesReturnDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useState(false)
  const [exportingNetId, setExportingNetId] = useState<string | null>(null)
  const [cancelCandidate, setCancelCandidate] = useState<SalesReturn | null>(null)
  const [isCanceling, setCanceling, tryStartCanceling] = useBusyState()
  const [createOpened, setCreateOpened] = useState(false)
  const [createTableToolbarSlot, setCreateTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const [organizations, setOrganizations] = useState<SalesReturnOrganization[]>([])
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [clients, setClients] = useState<SalesReturnClient[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [saleSearch, setSaleSearch] = useState('')
  // Wide default so a product from an older sale is actually found ("не находить
  // товар", bug #10) — the "З дати" filter below stays editable to narrow it.
  const [saleFromDate, setSaleFromDate] = useState(() => shiftDateInput(-1825))
  const [saleToDate, setSaleToDate] = useState(() => shiftDateInput(0))
  const [salesState, setSalesState] = useState<SalesSearchState>({
    isLoading: false,
    sales: [],
  })
  const [drafts, setDrafts] = useState<ReturnOrderItemDraft[]>([])
  const [createError, setCreateError] = useState<string | null>(null)
  const [createWarning, setCreateWarning] = useState<string | null>(null)
  const [reviewOpened, setReviewOpened] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [isSaving, setSaving, tryStartSaving] = useBusyState()
  const [editor, setEditor] = useState<ItemEditorState | null>(null)
  const [editorQty, setEditorQty] = useState<number | ''>('')
  const [editorStatus, setEditorStatus] = useState<SalesReturnItemStatusValue | undefined>()
  const [editorStorageId, setEditorStorageId] = useState<string | null>(null)
  const [editorStorages, setEditorStorages] = useState<SalesReturnStorage[]>([])
  const [editorVatWarning, setEditorVatWarning] = useState<string | null>(null)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [isLoadingEditorStorages, setLoadingEditorStorages] = useState(false)
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)
  const salesRequestIdRef = useRef(0)
  const editorRequestIdRef = useRef(0)
  const storageRequestIdRef = useRef(0)

  const { items, isLoading } = listState
  const filteredItems = useMemo(() => filterReturns(items, searchValue), [items, searchValue])
  const offset = (page - 1) * pageSize
  const canMoveForward = items.length === pageSize
  const selectedOrganization = useMemo(
    () => organizations.find((organization) => getEntityKey(organization) === organizationId) || null,
    [organizationId, organizations],
  )
  const selectedClient = useMemo(
    () => clients.find((client) => getEntityKey(client) === clientId) || null,
    [clientId, clients],
  )
  const selectedClientNetUid = selectedClient?.NetUid
  const hasReturnSearch = Boolean(saleSearch.trim() || selectedClientNetUid)
  const selectedOrganizationNetUid = selectedOrganization?.NetUid
  const clientOptions = useMemo(() => mergeSelectedClient(clients, selectedClient), [clients, selectedClient])
  const saleItemRows = useMemo(() => flattenSaleItemRows(salesState.sales), [salesState.sales])
  const showReturnResults = hasReturnSearch || salesState.isLoading || saleItemRows.length > 0
  const statusOptions = useMemo(() => getStatusOptions(t), [t])
  const saleItemColumns = useSaleItemColumns({
    drafts,
    onEdit: openEditor,
    onOpenProductCard: setProductCardNetId,
    onRemove: removeDraft,
    searchedVendorCode: saleSearch.trim(),
    t,
  })
  const detailColumns = useDetailColumns({ onOpenProductCard: setProductCardNetId, t })
  const returnColumns = useReturnColumns({
    exportingNetId,
    onCancel: setCancelCandidate,
    onExport: handleExport,
  })

  useEffect(() => {
    let cancelled = false

    async function loadReturns() {
      setListState((currentState) => ({
        ...currentState,
        isLoading: true,
      }))
      setListError(null)

      try {
        const nextReturns = await getSaleReturns({
          from: fromDate,
          limit: pageSize,
          offset,
          to: toDate,
          value: searchValue,
        })

        if (!cancelled) {
          setListState({
            isLoading: false,
            items: nextReturns,
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setListState({
            isLoading: false,
            items: [],
          })
          setListError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити повернення'))
        }
      }
    }

    void loadReturns()

    return () => {
      cancelled = true
    }
  }, [fromDate, offset, pageSize, reloadKey, searchValue, t, toDate])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchValue(searchDraft.trim())
      // A new query re-queries from the first page — otherwise a high page
      // offset would ask the server for a page that the filtered set lacks.
      setPage(1)
    }, 200)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [searchDraft])

  useEffect(() => {
    if (!createOpened) {
      return
    }

    let cancelled = false

    async function loadOrganizations() {
      try {
        const nextOrganizations = await getSalesReturnOrganizations()

        if (!cancelled) {
          setOrganizations(nextOrganizations)
        }
      } catch (loadError) {
        if (!cancelled) {
          setCreateError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити організації'))
        }
      }
    }

    void loadOrganizations()

    return () => {
      cancelled = true
    }
  }, [createOpened, t])

  useEffect(() => {
    const normalizedSearch = clientSearch.trim()

    if (
      !createOpened ||
      normalizedSearch.length < 2 ||
      selectedClient && normalizedSearch === getClientOptionLabel(selectedClient)
    ) {
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      searchSalesReturnClients(normalizedSearch, controller.signal)
        .then((nextClients) => {
          if (controller.signal.aborted) {
            return
          }
          // Mantine replaces the search text with the rendered option label
          // after selection. A request for that decorated label can resolve
          // empty; retain the selected entity so its NetUid remains available
          // to the sales-for-return request.
          setClients((currentClients) => {
            const currentSelection = clientId
              ? currentClients.find((client) => getEntityKey(client) === clientId) || null
              : null

            return mergeSelectedClient(nextClients, currentSelection)
          })
          setCreateError(null)
        })
        .catch((searchError: unknown) => {
          if (!controller.signal.aborted) {
            setCreateError(searchError instanceof Error ? searchError.message : t('Не вдалося виконати пошук клієнта'))
          }
        })
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [clientId, clientSearch, createOpened, selectedClient, t])

  function updateListSearch(nextSearchValue: string) {
    setPage(1)
    setSearchDraft(nextSearchValue)
  }

  function openCreate() {
    salesRequestIdRef.current += 1
    editorRequestIdRef.current += 1
    storageRequestIdRef.current += 1
    setOrganizationId(null)
    setClients([])
    setClientId(null)
    setClientSearch('')
    setSaleSearch('')
    setSaleFromDate(shiftDateInput(-1825))
    setSaleToDate(shiftDateInput(0))
    setSalesState({ isLoading: false, sales: [] })
    setDrafts([])
    setCreateError(null)
    setCreateWarning(null)
    setReviewOpened(false)
    setReviewError(null)
    setEditor(null)
    setEditorQty('')
    setEditorStatus(undefined)
    setEditorStorageId(null)
    setEditorStorages([])
    setEditorVatWarning(null)
    setEditorError(null)
    setLoadingEditorStorages(false)
    setProductCardNetId(null)
    setCreateOpened(true)
  }

  const loadSales = useCallback(async (signal?: AbortSignal) => {
    const requestId = salesRequestIdRef.current + 1

    salesRequestIdRef.current = requestId
    const normalizedSaleSearch = saleSearch.trim()

    if (
      normalizedSaleSearch &&
      normalizedSaleSearch.length < MIN_SALES_FOR_RETURN_PRODUCT_SEARCH_LENGTH
    ) {
      setSalesState({
        isLoading: false,
        sales: [],
      })
      setCreateError(null)
      setCreateWarning(
        t(`Введіть щонайменше ${MIN_SALES_FOR_RETURN_PRODUCT_SEARCH_LENGTH} символи артикула`),
      )
      return
    }

    if (!normalizedSaleSearch && !selectedClientNetUid) {
      setSalesState({
        isLoading: false,
        sales: [],
      })
      setCreateError(null)
      setCreateWarning(t('Введіть артикул або виберіть клієнта'))
      return
    }

    setSalesState((currentState) => ({
      ...currentState,
      isLoading: true,
    }))
    setCreateError(null)
    setCreateWarning(null)

    const searchParams = {
      clientNetId: selectedClientNetUid,
      from: saleFromDate,
      organizationNetId: selectedOrganizationNetUid,
      to: saleToDate,
      value: saleSearch,
    }

    try {
      const sales = await getSalesForReturn(searchParams, signal)

      if (signal?.aborted || requestId !== salesRequestIdRef.current) {
        return
      }

      setSalesState({
        isLoading: false,
        sales,
      })

      if (!sales.length) {
        setCreateWarning(t('Продажі для повернення не знайдено'))
      } else if (isSalesForReturnResultTruncated(searchParams, sales.length)) {
        setCreateWarning(
          t('Показано лише останні {count} продажів. Звузьте період або виберіть клієнта, щоб знайти старіший продаж.', {
            count: sales.length,
          }),
        )
      }
    } catch (loadError) {
      if (signal?.aborted || requestId !== salesRequestIdRef.current) {
        return
      }

      setSalesState({
        isLoading: false,
        sales: [],
      })
      setCreateError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити продажі'))
    }
  }, [saleSearch, saleFromDate, saleToDate, selectedClientNetUid, selectedOrganizationNetUid, t])

  useEffect(() => {
    if (!createOpened) {
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      void loadSales(controller.signal)
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [createOpened, loadSales])

  async function handleExport(saleReturn: SalesReturn) {
    return runActionOnce('handleExport', async () => {
      if (!saleReturn.NetUid) {
        return
      }

      setExportingNetId(saleReturn.NetUid)
      setListError(null)

      try {
        setDownloadDocument(await exportSaleReturnDocument(saleReturn.NetUid))
        setDownloadModalOpened(true)
      } catch (exportError) {
        setListError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ'))
      } finally {
        setExportingNetId(null)
      }
    })
  }

  async function confirmCancel() {
    if (!cancelCandidate?.NetUid) {
      return
    }

    if (!tryStartCanceling()) {
      return
    }
    setListError(null)

    try {
      const canceledReturn = await runCancelMutation(
        { netId: cancelCandidate.NetUid },
        ({ netId }, operation) => cancelSaleReturn(netId, operation),
      )

      if (canceledReturn) {
        setListState((currentState) => ({
          ...currentState,
          items: currentState.items.map((item) => (item.NetUid === canceledReturn.NetUid ? { ...item, ...canceledReturn } : item)),
        }))
      }

      notifications.show({
        color: 'green',
        message: t('Повернення скасовано'),
      })
      setCancelCandidate(null)
    } catch (cancelError) {
      if (cancelError instanceof SalesPendingMutationRecoveredError) {
        setCancelCandidate(null)
        setReloadKey((value) => value + 1)
        notifications.show({
          color: 'yellow',
          message: t(cancelError.message),
        })
        return
      }
      setListError(cancelError instanceof Error ? cancelError.message : t('Не вдалося скасувати повернення'))
    } finally {
      setCanceling(false)
    }
  }

  function openEditor(row: SaleItemRow) {
    editorRequestIdRef.current += 1
    storageRequestIdRef.current += 1
    setLoadingEditorStorages(false)
    const draft = drafts.find((item) => getOrderItemKey(item.orderItem) === getOrderItemKey(row.item))

    setEditor({
      draft,
      row,
    })
    setEditorQty(draft?.qty || 1)
    setEditorStatus(draft?.status)
    setEditorStorageId(draft?.storage ? getEntityKey(draft.storage) : null)
    setEditorStorages(draft?.storage ? [draft.storage] : [])
    setEditorError(null)
    setEditorVatWarning(null)
    void loadEditorVatWarning(row)

    if (typeof draft?.status === 'number') {
      void loadEditorStorages(row, draft.status)
    }
  }

  async function loadEditorVatWarning(row: SaleItemRow) {
    const requestId = editorRequestIdRef.current
    const orderItemNetId = row.item.NetUid

    if (!orderItemNetId) {
      return
    }

    try {
      const vatWarning = await getReturnVatWarning(orderItemNetId)

      if (requestId === editorRequestIdRef.current) {
        setEditorVatWarning(vatWarning || null)
      }
    } catch {
      if (requestId === editorRequestIdRef.current) {
        setEditorVatWarning(null)
      }
    }
  }

  async function loadEditorStorages(row: SaleItemRow, status?: SalesReturnItemStatusValue) {
    const requestId = ++storageRequestIdRef.current
    const orderItemNetId = row.item.NetUid
    // Fall back to the organization the user filtered by when the sale payload
    // omits the deeply-nested Organization.NetUid — otherwise the editor hard-
    // failed and showed no return storages at all (bug #10).
    const organizationNetId = row.sale.ClientAgreement?.Agreement?.Organization?.NetUid || selectedOrganizationNetUid

    if (typeof status !== 'number') {
      setEditorStorages([])
      setEditorStorageId(null)
      setLoadingEditorStorages(false)
      return
    }

    if (!orderItemNetId || !organizationNetId) {
      setEditorError(t('Неможливо визначити продаж або організацію для складів повернення'))
      return
    }

    setLoadingEditorStorages(true)

    try {
      const storages = await getReturnStorages({
        orderItemNetId,
        organizationNetId,
        status,
      })

      if (requestId !== storageRequestIdRef.current) {
        return
      }
      setEditorStorages(storages)
      setEditorStorageId((currentStorageId) => {
        if (currentStorageId && storages.some((storage) => getEntityKey(storage) === currentStorageId)) {
          return currentStorageId
        }

        return storages[0] ? getEntityKey(storages[0]) : null
      })
    } catch (loadError) {
      if (requestId === storageRequestIdRef.current) {
        setEditorError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити склади повернення'))
      }
    } finally {
      if (requestId === storageRequestIdRef.current) {
        setLoadingEditorStorages(false)
      }
    }
  }

  function saveEditorDraft() {
    if (!editor) {
      return
    }

    const storage = editorStorages.find((item) => getEntityKey(item) === editorStorageId) || null
    const validationError = validateDraft({
      item: editor.row.item,
      qty: editorQty,
      status: editorStatus,
      storage,
      t,
    })

    if (validationError) {
      setEditorError(validationError)
      return
    }

    const nextDraft: ReturnOrderItemDraft = {
      orderItem: editor.row.item,
      qty: Number(editorQty),
      status: editorStatus,
      storage,
    }

    setDrafts((currentDrafts) => [
      ...currentDrafts.filter((draft) => getOrderItemKey(draft.orderItem) !== getOrderItemKey(editor.row.item)),
      nextDraft,
    ])
    setEditor(null)
  }

  function removeDraft(row: SaleItemRow) {
    removeDraftByOrderItem(row.item)
  }

  function removeDraftByOrderItem(orderItem: SalesReturnOrderItem) {
    const nextDrafts = drafts.filter(
      (draft) =>
        getOrderItemKey(draft.orderItem) !==
        getOrderItemKey(orderItem),
    )
    setDrafts(nextDrafts)
    if (!nextDrafts.length) {
      setReviewOpened(false)
    }
  }

  function openReview() {
    const validationError = validateCreatePayload(drafts, t)

    if (validationError) {
      setCreateError(validationError)
      return
    }

    setReviewError(null)
    setReviewOpened(true)
  }

  async function saveReturn() {
    const validationError = validateCreatePayload(drafts, t)

    if (validationError) {
      setReviewError(validationError)
      return
    }

    const firstDraft = drafts[0]
    const client = firstDraft.orderItem.Order?.Sale?.ClientAgreement?.Client
      || salesState.sales.find((sale) => sale.Order?.OrderItems?.some((item) => getOrderItemKey(item) === getOrderItemKey(firstDraft.orderItem)))
        ?.ClientAgreement?.Client

    if (!client) {
      setReviewError(t('Неможливо визначити клієнта для повернення'))
      return
    }

    if (!tryStartSaving()) {
      return
    }
    setReviewError(null)

    try {
      const payload = {
        Client: client,
        SaleReturnItems: drafts.map((draft) => ({
          OrderItem: draft.orderItem,
          Qty: draft.qty,
          SaleReturnItemStatus: draft.status as SalesReturnItemStatusValue,
          Storage: draft.storage as SalesReturnStorage,
        })),
      }

      await runCreateMutation(
        payload,
        createSaleReturn,
      )

      notifications.show({
        color: 'green',
        message: t('Повернення створено'),
      })
      setDrafts([])
      setReviewOpened(false)
      setCreateOpened(false)
      setReloadKey((value) => value + 1)
    } catch (saveError) {
      if (saveError instanceof SalesPendingMutationRecoveredError) {
        setDrafts([])
        setReviewOpened(false)
        setCreateOpened(false)
        setReloadKey((value) => value + 1)
        notifications.show({
          color: 'yellow',
          message: t(saveError.message),
        })
        return
      }
      setReviewError(saveError instanceof Error ? saveError.message : t('Не вдалося створити повернення'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box className="new-sale-return-page console-table-page">
      <div className="sales-dashboard-tab-content new-sale-return-shell">
        <div className="new-sale-return-command-bar app-filter-bar">
          <ToolbarDateRangeFilter
            from={fromDate}
            to={toDate}
            onChange={({ from, to }) => {
              setPage(1)
              setFromDate(from)
              setToDate(to)
            }}
          />

          <TextInput
            className="new-sale-return-search-input"
            label={t('Пошук')}
            leftSection={<Search size={15} />}
            placeholder={t('Номер, клієнт, договір або продаж')}
            value={searchDraft}
            onChange={(event) => updateListSearch(event.currentTarget.value)}
          />

          <div className="app-filter-actions new-sale-return-command-actions">
            <Paginator
              hasNext={canMoveForward}
              isLoading={isLoading}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPage(1)
                setPageSize(nextPageSize)
              }}
              onRefresh={() => setReloadKey((value) => value + 1)}
            />
          </div>
          <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot new-sale-return-table-toolbar-slot" />
          <div className="new-sale-return-create-actions">
            <Tooltip label={t('Сформувати звіт')}>
              <Button variant="default" size="sm" className="new-sale-return-report-action"
                aria-label={t('Сформувати звіт')}
                leftSection={<FileChartColumn size={16} />}
                onClick={() => setReportOpened(true)}
              >
                {t('Сформувати звіт')}
              </Button>
            </Tooltip>
            <Button color={CREATE_ACTION_COLOR} size="sm" leftSection={<Plus size={16} />} onClick={openCreate}>
              {t('Створити')}
            </Button>
          </div>
        </div>

        {listError ? (
          <Alert className="console-table-alert" color="red" icon={<CircleAlert size={16} />} title={t('Помилка')}>
            {listError}
          </Alert>
        ) : null}

        <div className="new-sale-return-page__table console-table-body">
          <DataTable
            columns={returnColumns}
            data={filteredItems}
            defaultLayout={RETURNS_TABLE_LAYOUT}
            distributeAvailableWidth
            emptyText={t('Повернення не знайдено')}
            getRowId={(saleReturn, index) => saleReturn.NetUid || String(saleReturn.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="sales-return-new-returns-2"
            minWidth={1260}
            showLayoutControls
            tableId="sales-return-new-returns"
            toolbarPortalTarget={tableToolbarSlot}
            onRowClick={setSelectedReturn}
          />
        </div>
      </div>
      <ClientReturnsReportPanel
        opened={reportOpened}
        onClose={() => setReportOpened(false)}
      />
      <AppDrawer opened={Boolean(selectedReturn)} onClose={() => setSelectedReturn(null)} position="right" size="xl" title={t('Повернення')}>
        {selectedReturn ? (
          <ReturnDetails saleReturn={selectedReturn} columns={detailColumns} />
        ) : null}
      </AppDrawer>

      <AppDrawer
        className="new-sale-return-create-sheet"
        opened={createOpened}
        position="right"
        size="full"
        title={t('Нове повернення')}
        onClose={() => setCreateOpened(false)}
        footer={
          <Group gap={8}>
            <Button variant="default" onClick={() => setCreateOpened(false)}>
              {t('Скасувати')}
            </Button>
            <Button color="brand" variant="filled" size="sm" disabled={!drafts.length} leftSection={<Eye size={16} />} onClick={openReview}>
              {t('Перегляд')} ({drafts.length})
            </Button>
          </Group>
        }
      >
        <Stack className={`new-sale-return-create-workspace${!saleItemRows.length ? ' is-empty' : ''}`} gap={10}>
          {createError ? (
            <Alert color="red" icon={<CircleAlert size={16} />} title={t('Помилка')}>
              {createError}
            </Alert>
          ) : null}
          {createWarning && hasReturnSearch && createWarning !== t('Продажі для повернення не знайдено') ? (
            <Alert className="new-sale-return-create-warning" color="yellow" icon={<CircleAlert size={16} />}>
              {createWarning}
            </Alert>
          ) : null}

          <section className="new-sale-return-create-filters" aria-label={t('Пошук продажів')}>
            <div className="new-sale-return-create-fields">
              <ToolbarDateRangeFilter
                from={saleFromDate}
                to={saleToDate}
                onChange={({ from, to }) => {
                  setSaleFromDate(from)
                  setSaleToDate(to)
                }}
              />
              <Select
                className="new-sale-return-create-organization"
                comboboxProps={{ classNames: { dropdown: 'new-sale-return-create-dropdown' } }}
                clearable
                data={organizations.map((organization) => ({
                  label: getOrganizationDisplayName(organization) || t('Без назви'),
                  value: getEntityKey(organization),
                }))}
                label={t('Організація')}
                onChange={setOrganizationId}
                searchable
                value={organizationId}
              />
              <Select
                className="new-sale-return-create-client"
                comboboxProps={{ classNames: { dropdown: 'new-sale-return-create-dropdown' } }}
                clearable
                data={clientOptions.map((client) => ({
                  label: getClientOptionLabel(client),
                  value: getEntityKey(client),
                }))}
                label={t('Клієнт')}
                onChange={setClientId}
                onSearchChange={setClientSearch}
                searchable
                searchValue={clientSearch}
                value={clientId}
              />
              <TextInput className="new-sale-return-create-search" placeholder={t('Пошук за артикулом')} leftSection={<Search size={16} />} label={t('Артикул')} onChange={(event) => setSaleSearch(event.currentTarget.value)} value={saleSearch} />
            </div>
          </section>
          <section className="new-sale-return-create-results" aria-label={t('Продажі для повернення')}>
            <div className="new-sale-return-create-results__toolbar">
              <Group gap={8}>
                <Text className="app-section-title">{t('Продажі для повернення')}</Text>
                {saleItemRows.length ? <TableChip tone="neutral" value={saleItemRows.length} /> : null}
              </Group>
              {showReturnResults ? <div className="new-sale-return-create-results__controls" ref={setCreateTableToolbarSlot} /> : null}
            </div>
            <div className="new-sale-return-create-results__table">
              {showReturnResults ? <DataTable
                columns={saleItemColumns}
                data={saleItemRows}
                defaultLayout={SALE_ITEMS_TABLE_LAYOUT}
                emptyText={(
                  <div className="new-sale-return-create-empty">
                    <Search size={22} aria-hidden="true" />
                    <Text>{hasReturnSearch ? t('Продажі або позиції не знайдено') : t('Введіть артикул або виберіть клієнта')}</Text>
                  </div>
                )}
                getRowId={(row, index) => `${getOrderItemKey(row.item)}-${index}`}
                height="100%"
                isLoading={salesState.isLoading}
                distributeAvailableWidth
                layoutVersion="sales-return-new-sale-items-compact-4"
                minWidth={1464}
                tableId="sales-return-new-sale-items"
                toolbarPortalTarget={createTableToolbarSlot}
              /> : (
                <div className="new-sale-return-create-empty is-initial">
                  <Search size={24} aria-hidden="true" />
                  <Text fw={600}>{t('Введіть артикул або виберіть клієнта')}</Text>
                  <Text c="dimmed">{t('Знайдіть продаж і додайте потрібні позиції до повернення')}</Text>
                </div>
              )}
            </div>
          </section>
        </Stack>
      </AppDrawer>

      <AppDrawer
        className="new-sale-return-review-sheet"
        opened={reviewOpened}
        onClose={() => setReviewOpened(false)}
        position="right"
        size="standard"
        closeOnEscape={false}
        title={t('Перегляд повернення')}
        footer={
          <Group gap="sm">
            <Button variant="default" onClick={() => setReviewOpened(false)}>
              {t('Скасувати')}
            </Button>
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={!drafts.length}
              leftSection={<Check size={16} />}
              loading={isSaving}
              onClick={() => void saveReturn()}
            >
              {t('Зберегти')}
            </Button>
          </Group>
        }
      >
        <Stack gap={10}>
          {reviewError ? (
            <Alert color="red" icon={<CircleAlert size={16} />} title={t('Помилка')}>
              {reviewError}
            </Alert>
          ) : null}

          {groupDraftsByClient(drafts).map((group) => (
            <Stack className="new-sale-return-review-group" gap={10} key={group.key}>
              <TableChip tone="warning" value={group.clientName} />
              <Stack gap="xs">
                {group.drafts.map((draft) => (
                  <Group className="new-sale-return-review-item" key={getOrderItemKey(draft.orderItem)} justify="space-between" wrap="nowrap" gap={10}>
                    <div className="new-sale-return-review-item__main">
                      <ReturnDraftProduct product={draft.orderItem.Product} onOpen={setProductCardNetId} />
                      <Group className="new-sale-return-review-item__meta" gap={6}>
                        <span>{t('Кількість')}</span>
                        <TableChip value={formatAmount(draft.qty)} />
                        <TableChip title={t('Причина')} value={getStatusLabel(draft.status, t)} />
                        <TableChip tone="storage" value={displayValue(draft.storage?.Name)} />
                      </Group>
                    </div>
                    <Tooltip label={t('Видалити')}>
                      <ActionIcon
                        aria-label={t('Видалити')}
                        color="dark"
                        onClick={() => removeDraftByOrderItem(draft.orderItem)}
                        variant="transparent"
                      >
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                ))}
              </Stack>
            </Stack>
          ))}

        </Stack>
      </AppDrawer>

      <AppModal className="new-sale-return-editor" opened={Boolean(editor)} onClose={() => setEditor(null)} size="lg" title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Позиція повернення')}</span>}>
        {editor ? (
          <Stack className="app-compact-form" gap={10}>
            <div className="new-sale-return-editor-product">
              <ReturnDraftProduct product={editor.row.item.Product} onOpen={setProductCardNetId} />
              <Group gap={6}>
                <TableChip tone="document" value={editor.row.sale.SaleNumber?.Value} />
                <TableChip tone="warning" value={editor.row.sale.ClientAgreement?.Client?.FullName || editor.row.sale.ClientAgreement?.Client?.Name} />
              </Group>
            </div>
            {editorError ? (
              <Alert color="red" icon={<CircleAlert size={16} />}>
                {editorError}
              </Alert>
            ) : null}
            {editorVatWarning ? (
              <Alert color="yellow" icon={<CircleAlert size={16} />}>
                {editorVatWarning}
              </Alert>
            ) : null}
            <SimpleGrid className="new-sale-return-editor-fields" cols={{ base: 1, sm: 3 }} spacing={8}>
              <NumberInput
                allowDecimal
                decimalScale={3}
                label={t('Кількість')}
                max={readNumber(editor.row.item.Qty)}
                min={0}
                onChange={(value) => setEditorQty(typeof value === 'number' ? value : '')}
                value={editorQty}
              />
              <Select
                clearable
                data={statusOptions}
                label={t('Причина')}
                onChange={(value) => {
                  const nextStatus = parseStatusValue(value)

                  setEditorStatus(nextStatus)
                  setEditorStorageId(null)
                  setEditorStorages([])
                  void loadEditorStorages(editor.row, nextStatus)
                }}
                value={typeof editorStatus === 'number' ? String(editorStatus) : null}
              />
              <Select
                clearable
                data={editorStorages.map((storage) => ({
                  label: [storage.Name, storage.Organization?.Name ? `(${storage.Organization.Name})` : ''].filter(Boolean).join(' '),
                  value: getEntityKey(storage),
                }))}
                disabled={typeof editorStatus !== 'number' || isLoadingEditorStorages}
                label={t('Склад повернення')}
                onChange={setEditorStorageId}
                placeholder={typeof editorStatus === 'number' ? t('Оберіть склад') : t('Спочатку оберіть причину')}
                searchable
                value={editorStorageId}
              />
            </SimpleGrid>
            {typeof editorStatus !== 'number' ? (
              <Text c="dimmed" size="xs">
                {t('Оберіть причину повернення, щоб побачити доступні склади')}
              </Text>
            ) : !isLoadingEditorStorages && !editorError && editorStorages.length === 0 ? (
              <Text c="dimmed" size="xs">
                {t('Немає складів, доступних для повернення за умовами цієї причини')}
              </Text>
            ) : null}
            <AppModalFooter>
              <Button size="sm" variant="default" onClick={() => setEditor(null)}>
                {t('Скасувати')}
              </Button>
              <Button color="brand" variant="filled" size="sm" onClick={saveEditorDraft}>
                {editor.draft ? t('Оновити') : t('Додати')}
              </Button>
            </AppModalFooter>
          </Stack>
        ) : null}
      </AppModal>

      <DocumentExportModal
        document={downloadDocument ? {
          DocumentURL: downloadDocument.DocumentURL || downloadDocument.XlsxDocument,
          PdfDocumentURL: downloadDocument.PdfDocumentURL || downloadDocument.PdfDocument,
        } : null}
        opened={downloadModalOpened}
        title={t('Документи')}
        onClose={() => setDownloadModalOpened(false)}
      />

      <AppModal className="new-sale-return-cancel-modal" size={420} opened={Boolean(cancelCandidate)} onClose={() => setCancelCandidate(null)} title={t('Скасувати повернення')}>
        <Stack className="app-compact-form" gap={12}>
          <Group gap={6} className="new-sale-return-cancel-message">
            <Text>{t('Скасувати повернення')}</Text>
            <TableChip tone="document" value={cancelCandidate?.Number} />
            <Text>?</Text>
          </Group>
          <AppModalFooter>
            <Button variant="default" onClick={() => setCancelCandidate(null)}>
              {t('Ні')}
            </Button>
            <Button color="red" loading={isCanceling} onClick={() => void confirmCancel()}>
              {t('Так')}
            </Button>
          </AppModalFooter>
        </Stack>
      </AppModal>

      <ProductCardModal productNetId={productCardNetId} onClose={() => setProductCardNetId(null)} />
    </Box>
  )
}

function ReturnDraftProduct({ product, onOpen }: {
  product?: SalesReturnProduct | null
  onOpen: (netId: string) => void
}) {
  const identity = (
    <>
      <TableChip tone="product" value={displayValue(product?.VendorCode)} />
      <span className="new-sale-return-draft-product__name">{displayValue(product?.Name)}</span>
    </>
  )

  const netId = product?.NetUid

  return netId ? (
    <button className="new-sale-return-draft-product" type="button" onClick={() => onOpen(netId)}>
      {identity}
    </button>
  ) : <div className="new-sale-return-draft-product">{identity}</div>
}

function useReturnColumns({
  exportingNetId,
  onCancel,
  onExport,
}: {
  exportingNetId: string | null
  onCancel: (saleReturn: SalesReturn) => void
  onExport: (saleReturn: SalesReturn) => void
}): DataTableColumn<SalesReturn>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SalesReturn>[]>(
    () => [
      {
        id: 'number',
        header: t('Повернення'),
        accessor: (saleReturn) => saleReturn.Number,
        cell: (saleReturn) => <ReturnDocumentCell saleReturn={saleReturn} />,
        width: 170,
        minWidth: 150,
      },
      {
        id: 'client',
        header: t('Клієнт / договір'),
        accessor: (saleReturn) => saleReturn.Client?.FullName || saleReturn.Client?.Name,
        cell: (saleReturn) => <ReturnClientCell saleReturn={saleReturn} />,
        width: 320,
        minWidth: 260,
        fill: true,
      },
      {
        id: 'organization',
        header: t('Організація / склад'),
        accessor: (saleReturn) => [
          saleReturn.ClientAgreement?.Agreement?.Organization?.Name,
          saleReturn.Storage?.Name,
        ].filter(Boolean).join(' '),
        cell: (saleReturn) => <ReturnOrganizationCell saleReturn={saleReturn} />,
        width: 260,
        minWidth: 210,
      },
      {
        id: 'sales',
        header: t('Продажі'),
        accessor: (saleReturn) => getSaleNumbers(saleReturn),
        cell: (saleReturn) => <ReturnSalesCell saleReturn={saleReturn} />,
        width: 190,
        minWidth: 150,
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        accessor: (saleReturn) => getReturnUserName(saleReturn.CreatedBy),
        cell: (saleReturn) => <ReturnResponsibleCell saleReturn={saleReturn} />,
        width: 210,
        minWidth: 170,
      },
      {
        id: 'total',
        header: t('Сума'),
        accessor: (saleReturn) => readNumber(saleReturn.TotalAmountLocal) ?? 0,
        align: 'right',
        cell: (saleReturn) => <ReturnAmountCell saleReturn={saleReturn} />,
        width: 150,
        minWidth: 130,
      },
      {
        id: 'actions',
        header: '',
        align: 'right',
        cell: (saleReturn) => (
          <ReturnActionsCell
            exportingNetId={exportingNetId}
            saleReturn={saleReturn}
            onCancel={onCancel}
            onExport={onExport}
          />
        ),
        enableSorting: false,
        width: 86,
        minWidth: 78,
      },
    ],
    [exportingNetId, onCancel, onExport, t],
  )
}

function ReturnActionsCell({
  exportingNetId,
  saleReturn,
  onCancel,
  onExport,
}: {
  exportingNetId: string | null
  saleReturn: SalesReturn
  onCancel: (saleReturn: SalesReturn) => void
  onExport: (saleReturn: SalesReturn) => void
}) {
  const { t } = useI18n()

  return (
    <div className="new-sale-return-actions-cell">
      <TableRowAction
        action="download"
        label={t('Експорт')}
        loading={exportingNetId === saleReturn.NetUid}
        onClick={() => onExport(saleReturn)}
      />
      <TableRowAction
        action="cancel"
        disabled={saleReturn.IsCanceled}
        label={t('Скасувати')}
        onClick={() => onCancel(saleReturn)}
      />
    </div>
  )
}

function ReturnDocumentCell({ saleReturn }: { saleReturn: SalesReturn }) {
  const { t } = useI18n()
  const number = displayValue(saleReturn.Number)
  const date = formatDateTime(saleReturn.FromDate)

  return (
    <div className="new-sale-return-document-cell">
      <span className="new-sale-return-document-copy">
        <span className="new-sale-return-title-line">
          <TableChip tone="document" value={number} />
          {saleReturn.IsCanceled ? <span className="app-role-pill is-red new-sale-return-canceled-tag">{t('Скасовано')}</span> : null}
        </span>
        <span className="new-sale-return-muted-line is-mono" title={date}>{date}</span>
      </span>
    </div>
  )
}

function ReturnClientCell({ saleReturn }: { saleReturn: SalesReturn }) {
  const client = (saleReturn.Client?.FullName || saleReturn.Client?.Name || '').trim()
  const agreement = saleReturn.ClientAgreement?.Agreement?.Name?.trim() || ''
  const region = saleReturn.Client?.RegionCode?.Value?.trim() || ''

  return (
    <div className="new-sale-return-client-cell">
      {region ? <span className="app-role-pill is-gray new-sale-return-region-tag">{region}</span> : null}
      <span className="new-sale-return-two-line">
        <span className="new-sale-return-main-line" title={client}>{client}</span>
        {agreement ? (
          <span className="new-sale-return-client-meta">
            <span className="app-role-pill is-gray new-sale-return-agreement-pill" title={agreement}>
              {agreement}
            </span>
          </span>
        ) : null}
      </span>
    </div>
  )
}

function ReturnOrganizationCell({ saleReturn }: { saleReturn: SalesReturn }) {
  const organization = getOrganizationDisplayName(saleReturn.ClientAgreement?.Agreement?.Organization)
  const storage = saleReturn.Storage?.Name?.trim() || ''

  return (
    <span className="new-sale-return-two-line">
      <TableChip tone="product" value={organization} />
      {storage ? (
        <span className="new-sale-return-organization-meta">
          <span className="app-role-pill new-sale-return-storage-pill is-storage" title={storage}>
            {storage}
          </span>
        </span>
      ) : null}
    </span>
  )
}

function ReturnSalesCell({ saleReturn }: { saleReturn: SalesReturn }) {
  const sales = getSaleNumbers(saleReturn).trim()
  const saleNumbers = sales.split(/\s+/).filter(Boolean)

  return (
    <span className="new-sale-return-sales-cell" title={sales}>
      {saleNumbers.length ? (
        <span className="new-sale-return-sales-pills">
          {saleNumbers.map((number) => (
            <span className="app-role-pill new-sale-return-sale-pill is-document" key={number}>
              {number}
            </span>
          ))}
        </span>
      ) : (
        <span className="new-sale-return-muted-inline" />
      )}
    </span>
  )
}

function ReturnResponsibleCell({ saleReturn }: { saleReturn: SalesReturn }) {
  const { t } = useI18n()
  const userName = getReturnUserName(saleReturn.CreatedBy)

  return (
    <div className="new-sale-return-responsible-cell">
      {userName ? (
        <span
          className="app-role-pill new-sale-return-responsible-pill is-gray"
          title={`${t('Відповідальний')}: ${userName}`}
        >
          {userName}
        </span>
      ) : null}
    </div>
  )
}

function ReturnAmountCell({ saleReturn }: { saleReturn: SalesReturn }) {
  const currency = displayValue(saleReturn.ClientAgreement?.Agreement?.Currency?.Code || saleReturn.Currency?.Code)

  return (
    <span className="new-sale-return-amount-cell">
      <strong className="app-money">{formatMoney(saleReturn.TotalAmountLocal)}</strong>
      <TableChip tone="source" value={currency} />
    </span>
  )
}

function filterReturns(rows: SalesReturn[], value: string): SalesReturn[] {
  const query = value.trim().toLowerCase()

  if (!query) {
    return rows
  }

  return rows.filter((saleReturn) => {
    const haystack = [
      saleReturn.Number,
      saleReturn.Client?.FullName,
      saleReturn.Client?.Name,
      saleReturn.ClientAgreement?.Agreement?.Name,
      saleReturn.ClientAgreement?.Agreement?.Organization?.Name,
      getReturnUserName(saleReturn.CreatedBy),
      getSaleNumbers(saleReturn),
      saleReturn.Storage?.Name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })
}

function getReturnUserName(user?: SalesReturn['CreatedBy']): string {
  return user?.FullName?.trim() || [user?.LastName, user?.Name].filter(Boolean).join(' ').trim()
}

function useSaleItemColumns({
  drafts,
  onEdit,
  onOpenProductCard,
  onRemove,
  searchedVendorCode,
  t,
}: {
  drafts: ReturnOrderItemDraft[]
  onEdit: (row: SaleItemRow) => void
  onOpenProductCard: (netId: string) => void
  onRemove: (row: SaleItemRow) => void
  searchedVendorCode: string
  t: (value: string) => string
}): DataTableColumn<SaleItemRow>[] {
  return useMemo(
    () => [
      {
        id: 'select',
        header: '',
        cell: (row) => {
          const draft = drafts.find((item) => getOrderItemKey(item.orderItem) === getOrderItemKey(row.item))

          return (
            <Checkbox
              aria-label={t('Обрати позицію')}
              checked={Boolean(draft)}
              onChange={() => (draft ? onRemove(row) : onEdit(row))}
            />
          )
        },
        enableSorting: false,
        width: 44,
      },
      {
        id: 'saleNumber',
        header: t('Продаж'),
        accessor: (row) => row.sale.SaleNumber?.Value,
        cell: (row) => <TableChip tone="document" value={displayValue(row.sale.SaleNumber?.Value)} />,
        width: 130,
      },
      {
        id: 'vendorCode',
        header: t('Артикул'),
        accessor: (row) => row.item.Product?.VendorCode,
        cell: (row) => {
          const netId = row.item.Product?.NetUid
          const isHighlighted = Boolean(searchedVendorCode && row.item.Product?.VendorCode === searchedVendorCode)

          const code = <TableChip tone="product" value={displayValue(row.item.Product?.VendorCode)} />

          if (!netId) return code

          return (
            <Anchor
              className={isHighlighted ? 'new-sale-return-create-product-link is-match' : 'new-sale-return-create-product-link'}
              c="dark.6"
              underline="hover"
              component="button"
              fw={600}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenProductCard(netId)
              }}
            >
              {code}
            </Anchor>
          )
        },
        width: 140,
      },
      {
        id: 'product',
        header: t('Товар'),
        accessor: (row) => row.item.Product?.Name,
        cell: (row) => {
          const netId = row.item.Product?.NetUid

          return netId ? (
            <Anchor
              c="dark.6"
              underline="hover"
              component="button"
              size="sm"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenProductCard(netId)
              }}
            >
              {displayValue(row.item.Product?.Name)}
            </Anchor>
          ) : (
            displayValue(row.item.Product?.Name)
          )
        },
        width: 240,
      },
      {
        id: 'client',
        header: t('Клієнт'),
        accessor: (row) => row.sale.ClientAgreement?.Client?.FullName,
        cell: (row) => <TableChip tone="warning" value={displayValue(row.sale.ClientAgreement?.Client?.FullName || row.sale.ClientAgreement?.Client?.Name)} />,
        width: 200,
      },
      {
        id: 'soldQty',
        header: t('К-сть'),
        accessor: (row) => row.item.Qty,
        cell: (row) => <span className="new-sale-return-create-number">{formatAmount(row.item.Qty)}</span>,
        align: 'right',
        width: 90,
        minWidth: 90,
      },
      {
        id: 'returnedQty',
        header: t('Повернено'),
        accessor: (row) => row.item.ReturnItemQty,
        cell: (row) => <span className="new-sale-return-create-number">{formatAmount(row.item.ReturnItemQty)}</span>,
        align: 'right',
        width: 120,
        minWidth: 120,
      },
      {
        id: 'price',
        header: t('Сума'),
        accessor: (row) => row.item.TotalAmountLocal,
        cell: (row) => (
          <span className="new-sale-return-create-amount">
            <strong className="app-money">{formatMoney(row.item.TotalAmountLocal)}</strong>
          </span>
        ),
        align: 'right',
        width: 140,
      },
      {
        id: 'currency',
        header: t('Валюта'),
        accessor: (row) => row.sale.ClientAgreement?.Agreement?.Currency?.Code,
        cell: (row) => <TableChip tone="source" value={row.sale.ClientAgreement?.Agreement?.Currency?.Code} />,
        width: 100,
        minWidth: 100,
      },
      {
        id: 'draft',
        header: t('Повернення'),
        cell: (row) => {
          const draft = drafts.find((item) => getOrderItemKey(item.orderItem) === getOrderItemKey(row.item))

          return draft ? (
            <Badge className="app-role-pill" variant="light">
              <span className="app-table-number">{formatAmount(draft.qty)}</span> ·{' '}
              {getStatusLabel(draft.status, t)}
            </Badge>
          ) : ''
        },
        width: 160,
        minWidth: 145,
      },
      {
        id: 'actions',
        header: '',
        cell: (row) => {
          const isAdded = drafts.some((draft) => getOrderItemKey(draft.orderItem) === getOrderItemKey(row.item))

          return (
            <Button color="brand" size="xs" variant={isAdded ? 'default' : 'filled'} onClick={() => onEdit(row)}>
              {isAdded ? t('Змінити') : t('Додати')}
            </Button>
          )
        },
        enableSorting: false,
        width: 100,
      },
    ],
    [drafts, onEdit, onOpenProductCard, onRemove, searchedVendorCode, t],
  )
}

function useDetailColumns({
  onOpenProductCard,
  t,
}: {
  onOpenProductCard: (netId: string) => void
  t: (value: string) => string
}): DataTableColumn<SalesReturnItem>[] {
  return useMemo(
    () => [
      {
        id: 'vendorCode',
        header: t('Артикул'),
        accessor: (item) => item.OrderItem?.Product?.VendorCode,
        cell: (item) => {
          const netId = item.OrderItem?.Product?.NetUid

          return netId ? (
            <Anchor
              c="dark.6"
              underline="hover"
              component="button"
              fw={600}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenProductCard(netId)
              }}
            >
              <TableChip tone="product" value={displayValue(item.OrderItem?.Product?.VendorCode)} />
            </Anchor>
          ) : (
            <TableChip tone="product" value={displayValue(item.OrderItem?.Product?.VendorCode)} />
          )
        },
        width: 140,
      },
      {
        id: 'product',
        header: t('Товар'),
        accessor: (item) => item.OrderItem?.Product?.Name,
        cell: (item) => {
          const netId = item.OrderItem?.Product?.NetUid

          return netId ? (
            <Anchor
              c="dark.6"
              underline="hover"
              component="button"
              size="sm"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenProductCard(netId)
              }}
            >
              {displayValue(item.OrderItem?.Product?.Name)}
            </Anchor>
          ) : (
            displayValue(item.OrderItem?.Product?.Name)
          )
        },
        width: 260,
      },
      {
        id: 'qty',
        header: t('Кількість'),
        accessor: (item) => item.Qty,
        cell: (item) => <span className="new-sale-return-detail-number">{formatAmount(item.Qty)}</span>,
        align: 'right',
        width: 90,
      },
      {
        id: 'status',
        header: t('Причина'),
        accessor: (item) => getStatusLabel(item.SaleReturnItemStatus, t),
        cell: (item) => <TableChip value={getStatusLabel(item.SaleReturnItemStatus, t)} />,
        width: 170,
      },
      {
        id: 'storage',
        header: t('Склад'),
        accessor: (item) => item.Storage?.Name,
        cell: (item) => <TableChip tone="storage" value={displayValue(item.Storage?.Name)} />,
        width: 145,
      },
      {
        id: 'amount',
        header: t('Сума'),
        accessor: (item) => item.AmountLocal,
        cell: (item) => (
          <span className="new-sale-return-detail-amount">
            <strong className="app-money">{formatMoney(item.AmountLocal)}</strong>
            <TableChip tone="source" value={item.OrderItem?.Order?.Sale?.ClientAgreement?.Agreement?.Currency?.Code} />
          </span>
        ),
        align: 'right',
        width: 110,
      },
      {
        id: 'vatAmount',
        header: t('ПДВ'),
        accessor: (item) => (item.OrderItem?.Order?.Sale?.IsVatSale ? item.VatAmountLocal : undefined),
        cell: (item) => (item.OrderItem?.Order?.Sale?.IsVatSale ? <span className="new-sale-return-detail-number">{formatMoney(item.VatAmountLocal)}</span> : ''),
        align: 'right',
        width: 110,
      },
    ],
    [onOpenProductCard, t],
  )
}

function ReturnDetails({
  columns,
  saleReturn,
}: {
  columns: DataTableColumn<SalesReturnItem>[]
  saleReturn: SalesReturn
}) {
  const { t } = useI18n()
  const items = saleReturn.SaleReturnItems || []
  const clientName = displayValue(saleReturn.Client?.FullName || saleReturn.Client?.Name)
  const status = saleReturn.IsCanceled ? t('Скасовано') : t('Активне')
  const currency = saleReturn.Currency?.Code || saleReturn.ClientAgreement?.Agreement?.Currency?.Code

  return (
    <div className="document-detail-drawer new-sale-return-detail">
      <section className="new-sale-return-detail-summary">
        <div className="new-sale-return-detail-summary__main">
          <Group gap={8}>
            <TableChip tone="document" value={saleReturn.Number} />
            <TableChip tone={saleReturn.IsCanceled ? 'danger' : 'success'} value={status} />
            <span className="new-sale-return-detail-date">{formatDateTime(saleReturn.FromDate)}</span>
          </Group>
          <div className="new-sale-return-detail-client">
            <TableChip tone="warning" value={clientName} />
          </div>
        </div>
        <div className="new-sale-return-detail-summary__metrics">
          <ReturnDetailMetric label={t('Позицій')} value={String(items.length)} />
          <ReturnDetailMetric label={t('Сума')} value={formatMoney(saleReturn.TotalAmountLocal)} currency={currency} />
        </div>
      </section>

      <section className="new-sale-return-detail-participants" aria-label={t('Учасники')}>
        <ReturnDetailRow label={t('Договір')} value={saleReturn.ClientAgreement?.Agreement?.Name} />
        <ReturnDetailRow label={t('Організація')} value={<TableChip tone="product" value={saleReturn.ClientAgreement?.Agreement?.Organization?.Name} />} />
        <ReturnDetailRow label={t('Склад')} value={<TableChip tone="storage" value={displayValue(saleReturn.Storage?.Name)} />} />
      </section>

      <section className="new-sale-return-detail-section">
        <div className="new-sale-return-detail-section__head">
          <span className="app-section-title">{t('Позиції повернення')}</span>
          <TableChip value={items.length} />
        </div>
        <div className="new-sale-return-detail-table">
          <DataTable
            columns={columns}
            data={items}
            defaultLayout={DETAIL_ITEMS_TABLE_LAYOUT}
            distributeAvailableWidth
            emptyText={t('Позиції не знайдено')}
            getRowId={(item, index) => item.NetUid || String(item.Id || index)}
            layoutVersion="sales-return-detail-items-compact-2"
            minWidth={1025}
            showToolbar={false}
            tableId="sales-return-detail-items"
          />
        </div>
      </section>
    </div>
  )
}

function ReturnDetailMetric({
  label,
  value,
  currency,
}: {
  label: string
  value: string
  currency?: string
}) {
  return (
    <div className="new-sale-return-detail-metric">
      <span>{label}</span>
      <div className="new-sale-return-detail-metric__value">
        <strong>{value}</strong>
        {currency ? <TableChip tone="source" value={currency} /> : null}
      </div>
    </div>
  )
}

function ReturnDetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="new-sale-return-detail-row">
      <span className="new-sale-return-detail-row__label">{label}</span>
      <span className="new-sale-return-detail-row__value">{value || '—'}</span>
    </div>
  )
}

function flattenSaleItemRows(sales: SalesReturnSale[]): SaleItemRow[] {
  return sales.flatMap((sale) =>
    (sale.Order?.OrderItems || []).map((item) => ({
      item: {
        ...item,
        Order: {
          ...item.Order,
          Sale: sale,
        },
      },
      sale,
    })),
  )
}

function groupDraftsByClient(drafts: ReturnOrderItemDraft[]): Array<{
  key: string
  clientName: string
  drafts: ReturnOrderItemDraft[]
}> {
  const groups: Array<{ key: string; clientName: string; drafts: ReturnOrderItemDraft[] }> = []

  drafts.forEach((draft) => {
    const client = draft.orderItem.Order?.Sale?.ClientAgreement?.Client
    const key = client ? getEntityKey(client) : ''
    const existing = groups.find((group) => group.key === key)

    if (existing) {
      existing.drafts.push(draft)
      return
    }

    groups.push({
      clientName: getEntityName(client),
      drafts: [draft],
      key,
    })
  })

  return groups
}

function validateDraft({
  item,
  qty,
  status,
  storage,
  t,
}: {
  item: SalesReturnOrderItem
  qty: number | ''
  status?: SalesReturnItemStatusValue
  storage: SalesReturnStorage | null
  t: (value: string) => string
}) {
  const numericQty = typeof qty === 'number' ? qty : 0
  const availableQty = readNumber(item.Qty)

  if (!Number.isFinite(numericQty) || numericQty <= 0) {
    return t('Кількість повернення має бути більшою за нуль')
  }

  if (typeof availableQty === 'number' && numericQty > availableQty) {
    return t('Кількість повернення не може перевищувати кількість у продажу')
  }

  if (typeof status !== 'number') {
    return t('Оберіть причину повернення')
  }

  if (!storage?.Id) {
    return t('Оберіть склад повернення')
  }

  return null
}

function validateCreatePayload(drafts: ReturnOrderItemDraft[], t: (value: string) => string): string | null {
  if (!drafts.length) {
    return t('Оберіть хоча б одну позицію для повернення')
  }

  const clientNetIds = new Set(
    drafts.flatMap((draft) => {
      const netUid = draft.orderItem.Order?.Sale?.ClientAgreement?.Client?.NetUid
      return netUid ? [netUid] : []
    }),
  )

  if (clientNetIds.size > 1) {
    return t('Повернення можна створити лише для одного клієнта')
  }

  const invalidDraft = drafts.find((draft) => !draft.storage?.Id || typeof draft.status !== 'number' || draft.qty <= 0)

  if (invalidDraft) {
    return t('Перевірте кількість, причину та склад у вибраних позиціях')
  }

  return null
}

function getSaleNumbers(saleReturn: SalesReturn): string {
  const numbers = new Set<string>()

  ;(saleReturn.SaleReturnItems || []).forEach((item) => {
    const saleNumber = item.OrderItem?.Order?.Sale?.SaleNumber?.Value

    if (saleNumber) {
      numbers.add(saleNumber)
    }
  })

  return [...numbers].join(' ')
}

function getOrderItemKey(item: SalesReturnOrderItem): string {
  return item.NetUid || String(item.Id || '')
}

function getEntityKey(entity: { Id?: number; NetUid?: string }): string {
  return entity.NetUid || String(entity.Id || '')
}

function mergeSelectedClient(clients: SalesReturnClient[], selectedClient: SalesReturnClient | null): SalesReturnClient[] {
  if (!selectedClient || clients.some((client) => getEntityKey(client) === getEntityKey(selectedClient))) {
    return clients
  }

  return [selectedClient, ...clients]
}

function getClientOptionLabel(client: SalesReturnClient): string {
  return [client.FullName || client.Name, client.RegionCode?.Value].filter(Boolean).join(' · ')
}

function shiftDateInput(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}
