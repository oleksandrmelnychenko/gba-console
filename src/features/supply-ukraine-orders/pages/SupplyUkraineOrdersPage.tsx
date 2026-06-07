import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  FileInput,
  Group,
  NumberInput,
  Pagination,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronRight,
  IconDownload,
  IconEye,
  IconFileInvoice,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconFileTypeXls,
  IconListDetails,
  IconPackageImport,
  IconReceipt,
  IconRefresh,
  IconRestore,
  IconRoute,
  IconTrash,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, type MouseEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { realtimeEvents, useRealtimeEvent } from '../../../shared/realtime/events'
import { getSupplyUkraineOrderDisplayNumber, normalizeDisplayNumber } from '../../../shared/supplyUkraineOrderNumbers'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import {
  createSupplyOrderUkraineDeliveryExpense,
  deleteDirectSupplyUkraineOrder,
  deleteSupplyUkraineOrder,
  getDirectSupplyUkraineOrders,
  getSupplyOrderCurrencies,
  getSupplyOrderServiceConsumableProducts,
  getSupplyOrderServiceOrganizations,
  getSupplyUkraineOrders,
  printSupplyOrdersDocument,
  updateSupplyOrderUkraineDeliveryExpense,
} from '../api/supplyUkraineOrdersApi'
import type {
  Currency,
  DirectSupplyOrder,
  ProductDeliveryExpense,
  SupplyServiceConsumableProduct,
  SupplyServiceOrganization,
  SupplyServiceOrganizationAgreement,
  SupplyInvoice,
  SupplyOrderPrintDocument,
  SupplyOrderUkraine,
  SupplyUkraineOrderKind,
  SupplyUkraineOrderRow,
  SupplyUkraineOrdersFilter,
  SupplyUkraineOrdersResponse,
} from '../types'
import './supply-ukraine-orders.css'

const FILTER_STORAGE_KEY = 'allOrdersUkraineFilter'
const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = ['20', '40', '60', '100']

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'number', 'createdDate'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})
const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const TYPE_OPTIONS: Array<{ label: string, value: SupplyUkraineOrderKind }> = [
  { label: 'Всі', value: 'all' },
  { label: 'Поставки в Україну', value: 'toUkraine' },
  { label: 'Замовлення Україна', value: 'direct' },
]

const PERMISSION_CREATE_TO_UKRAINE = 'Supply_Order_To_Ukraine_PKEY'
const PERMISSION_CREATE_DIRECT = 'Ukraine_Order_PKEY'
const PERMISSION_PRINT = 'SupplyOrderPrintDocumentUrls_Load_PKEY'
const PERMISSION_TO_UKRAINE_PLACEMENT = 'UkraineAllOrders_SelectAnOption_ProductPlacement_PKEY'
const PERMISSION_TO_UKRAINE_VIEW = 'UkraineAllOrders_SelectAnOption_View_PKEY'
const PERMISSION_TO_UKRAINE_PROTOCOLS = 'UkraineAllOrders_SelectAnOption_NewPaymentProtocol_PKEY'
const PERMISSION_TO_UKRAINE_OFFICIAL_COSTS = 'UkraineAllOrders_SelectAnOption_AddingOfficialCostsForProductDelivery_PKEY'
const PERMISSION_DIRECT_INVOICES = 'UkraineAllOrders_SelectAnOption_Products_PKEY'
const PERMISSION_DIRECT_SPECIFICATIONS = 'UkraineAllOrders_SelectAnOption_ProductSpecificationCodes_PKEY'
const PERMISSION_DIRECT_LOGISTICS = 'UkraineAllOrders_SelectAnOption_LogisticWay_PKEY'
const PERMISSION_DIRECT_PRODUCT_INCOME = 'UkraineAllOrders_SelectAnOption_PlacementSupplyOrder_PKEY'

type OrdersState = {
  directOrders: DirectSupplyOrder[]
  directTotal: number
  error: string | null
  isLoading: boolean
  toUkraineOrders: SupplyOrderUkraine[]
  toUkraineTotal: number
}

type OrdersAction =
  | { type: 'loading' }
  | {
    directOrders: DirectSupplyOrder[]
    directTotal: number
    toUkraineOrders: SupplyOrderUkraine[]
    toUkraineTotal: number
    type: 'loaded'
  }
  | { error: string; type: 'failed' }

type CurrenciesState = {
  error: string | null
  items: Currency[]
}

type CurrenciesAction =
  | { currencies: Currency[]; type: 'loaded' }
  | { error: string; type: 'failed' }

type OrderActionsPermissions = {
  canOpenDirectInvoices: boolean
  canOpenDirectLogistics: boolean
  canOpenDirectProductIncome: boolean
  canOpenDirectSpecifications: boolean
  canOpenToUkraineOfficialCosts: boolean
  canOpenToUkrainePlacement: boolean
  canOpenToUkraineProtocols: boolean
  canOpenToUkraineView: boolean
}

type OrderCreatePermissions = {
  canCreateDirect: boolean
  canCreateToUkraine: boolean
  canPrint: boolean
}

type OrdersUiState = {
  activeFilters: SupplyUkraineOrdersFilter
  deleteCandidate: SupplyUkraineOrderRow | null
  downloadDocument: SupplyOrderPrintDocument | null
  downloadError: string | null
  downloadOpened: boolean
  expandedDirectOrders: Set<string>
  filterDraft: SupplyUkraineOrdersFilter
  isDeleting: boolean
  isDownloading: boolean
  officialCostsRow: SupplyUkraineOrderRow | null
  page: number
  pageSize: number
  selectedRow: SupplyUkraineOrderRow | null
}

type OrdersUiAction =
  | { patch: Partial<SupplyUkraineOrdersFilter>; type: 'patchFilterDraft' }
  | { filters: SupplyUkraineOrdersFilter; type: 'setActiveFilters' }
  | { filters: SupplyUkraineOrdersFilter; type: 'resetFilters' }
  | { page: number; type: 'setPage' }
  | { pageSize: number; type: 'setPageSize' }
  | { orderKey: string; type: 'toggleDirectOrder' }
  | { row: SupplyUkraineOrderRow | null; type: 'setSelectedRow' }
  | { row: SupplyUkraineOrderRow | null; type: 'setDeleteCandidate' }
  | { row: SupplyUkraineOrderRow | null; type: 'setOfficialCostsRow' }
  | { isDeleting: boolean; type: 'setDeleting' }
  | { type: 'openDownload' }
  | { document: SupplyOrderPrintDocument | null; type: 'setDownloadDocument' }
  | { error: string | null; type: 'setDownloadError' }
  | { isDownloading: boolean; type: 'setDownloading' }
  | { type: 'closeDownload' }

const initialState: OrdersState = {
  directOrders: [],
  directTotal: 0,
  error: null,
  isLoading: true,
  toUkraineOrders: [],
  toUkraineTotal: 0,
}

const initialCurrenciesState: CurrenciesState = {
  error: null,
  items: [],
}

function ordersReducer(state: OrdersState, action: OrdersAction): OrdersState {
  switch (action.type) {
    case 'loading':
      return { ...state, error: null, isLoading: true }
    case 'loaded':
      return {
        directOrders: action.directOrders,
        directTotal: action.directTotal,
        error: null,
        isLoading: false,
        toUkraineOrders: action.toUkraineOrders,
        toUkraineTotal: action.toUkraineTotal,
      }
    case 'failed':
      return {
        directOrders: [],
        directTotal: 0,
        error: action.error,
        isLoading: false,
        toUkraineOrders: [],
        toUkraineTotal: 0,
      }
  }
}

function currenciesReducer(_state: CurrenciesState, action: CurrenciesAction): CurrenciesState {
  switch (action.type) {
    case 'loaded':
      return { error: null, items: action.currencies }
    case 'failed':
      return { error: action.error, items: [] }
  }
}

function createInitialOrdersUiState(defaultFilters: SupplyUkraineOrdersFilter): OrdersUiState {
  const savedFilters = readSavedFilters(defaultFilters)

  return {
    activeFilters: savedFilters,
    deleteCandidate: null,
    downloadDocument: null,
    downloadError: null,
    downloadOpened: false,
    expandedDirectOrders: new Set(),
    filterDraft: savedFilters,
    isDeleting: false,
    isDownloading: false,
    officialCostsRow: null,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    selectedRow: null,
  }
}

function ordersUiReducer(state: OrdersUiState, action: OrdersUiAction): OrdersUiState {
  switch (action.type) {
    case 'patchFilterDraft':
      return { ...state, filterDraft: { ...state.filterDraft, ...action.patch } }
    case 'setActiveFilters':
      return {
        ...state,
        activeFilters: action.filters,
        expandedDirectOrders: new Set(),
      }
    case 'resetFilters':
      return {
        ...state,
        activeFilters: action.filters,
        expandedDirectOrders: new Set(),
        filterDraft: action.filters,
        page: 1,
      }
    case 'setPage':
      return { ...state, page: action.page }
    case 'setPageSize':
      return { ...state, page: 1, pageSize: action.pageSize }
    case 'toggleDirectOrder': {
      const expandedDirectOrders = new Set(state.expandedDirectOrders)

      if (expandedDirectOrders.has(action.orderKey)) {
        expandedDirectOrders.delete(action.orderKey)
      } else {
        expandedDirectOrders.add(action.orderKey)
      }

      return { ...state, expandedDirectOrders }
    }
    case 'setSelectedRow':
      return { ...state, selectedRow: action.row }
    case 'setDeleteCandidate':
      return { ...state, deleteCandidate: action.row }
    case 'setOfficialCostsRow':
      return { ...state, officialCostsRow: action.row }
    case 'setDeleting':
      return { ...state, isDeleting: action.isDeleting }
    case 'openDownload':
      return {
        ...state,
        downloadDocument: null,
        downloadError: null,
        downloadOpened: true,
        isDownloading: true,
      }
    case 'setDownloadDocument':
      return { ...state, downloadDocument: action.document }
    case 'setDownloadError':
      return { ...state, downloadError: action.error }
    case 'setDownloading':
      return { ...state, isDownloading: action.isDownloading }
    case 'closeDownload':
      return {
        ...state,
        downloadDocument: null,
        downloadError: null,
        downloadOpened: false,
        isDownloading: false,
      }
  }
}

function useSupplyUkraineOrdersPageController() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const { hasPermission } = useAuth()
  const defaultFilters = useMemo(() => createDefaultFilters(), [])
  const [uiState, dispatchUi] = useReducer(ordersUiReducer, defaultFilters, createInitialOrdersUiState)
  const [state, dispatchOrders] = useReducer(ordersReducer, initialState)
  const [currenciesState, dispatchCurrencies] = useReducer(currenciesReducer, initialCurrenciesState)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const {
    activeFilters,
    deleteCandidate,
    downloadDocument,
    downloadError,
    downloadOpened,
    expandedDirectOrders,
    filterDraft,
    isDeleting,
    isDownloading,
    officialCostsRow,
    page,
    pageSize,
    selectedRow,
  } = uiState
  const requestIdRef = useRef(0)
  const downloadRequestRef = useRef(0)
  const filterError = getFilterError(activeFilters)
  const canCreateToUkraine = hasPermission(PERMISSION_CREATE_TO_UKRAINE)
  const canCreateDirect = hasPermission(PERMISSION_CREATE_DIRECT)
  const canPrint = hasPermission(PERMISSION_PRINT)
  const canOpenToUkrainePlacement = hasPermission(PERMISSION_TO_UKRAINE_PLACEMENT)
  const canOpenToUkraineView = hasPermission(PERMISSION_TO_UKRAINE_VIEW)
  const canOpenToUkraineProtocols = hasPermission(PERMISSION_TO_UKRAINE_PROTOCOLS)
  const canOpenToUkraineOfficialCosts = hasPermission(PERMISSION_TO_UKRAINE_OFFICIAL_COSTS)
  const canOpenDirectInvoices = hasPermission(PERMISSION_DIRECT_INVOICES)
  const canOpenDirectSpecifications = hasPermission(PERMISSION_DIRECT_SPECIFICATIONS)
  const canOpenDirectLogistics = hasPermission(PERMISSION_DIRECT_LOGISTICS)
  const canOpenDirectProductIncome = hasPermission(PERMISSION_DIRECT_PRODUCT_INCOME)
  const reloadFromRealtime = useCallback(() => {
    reload()
  }, [])

  useRealtimeEvent(realtimeEvents.supplyOrderAdded, reloadFromRealtime)
  useRealtimeEvent(realtimeEvents.supplyOrderNotification, reloadFromRealtime)

  useEffect(() => {
    let cancelled = false

    async function loadCurrencies() {
      try {
        const nextCurrencies = await getSupplyOrderCurrencies()

        if (!cancelled) {
          dispatchCurrencies({ currencies: nextCurrencies, type: 'loaded' })
        }
      } catch (error) {
        if (!cancelled) {
          dispatchCurrencies({
            error: error instanceof Error ? error.message : t('Не вдалося завантажити валюти'),
            type: 'failed',
          })
        }
      }
    }

    void loadCurrencies()

    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    saveFilters(activeFilters)
  }, [activeFilters])

  useEffect(() => {
    if (filterError) {
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    const offset = (page - 1) * pageSize
    const params = {
      currencyId: activeFilters.currencyId,
      from: activeFilters.from,
      limit: pageSize,
      offset,
      supplierName: activeFilters.supplier,
      to: activeFilters.to,
    }

    dispatchOrders({ type: 'loading' })

    void Promise.all([
      activeFilters.type === 'direct'
        ? Promise.resolve<SupplyUkraineOrdersResponse<SupplyOrderUkraine>>({ items: [], totalQty: 0 })
        : getSupplyUkraineOrders(params),
      activeFilters.type === 'toUkraine'
        ? Promise.resolve<SupplyUkraineOrdersResponse<DirectSupplyOrder>>({ items: [], totalQty: 0 })
        : getDirectSupplyUkraineOrders(params),
    ])
      .then(([toUkraineResult, directResult]) => {
        if (requestIdRef.current !== requestId) {
          return
        }

        dispatchOrders({
          directOrders: directResult.items,
          directTotal: directResult.totalQty,
          toUkraineOrders: toUkraineResult.items,
          toUkraineTotal: toUkraineResult.totalQty,
          type: 'loaded',
        })
      })
      .catch((error: unknown) => {
        if (requestIdRef.current !== requestId) {
          return
        }

        dispatchOrders({
          error: error instanceof Error ? error.message : t('Не вдалося завантажити замовлення'),
          type: 'failed',
        })
      })
  }, [activeFilters, filterError, page, pageSize, reloadKey, t])

  const rows = useMemo(
    () => buildRows(state.toUkraineOrders, state.directOrders, expandedDirectOrders),
    [expandedDirectOrders, state.directOrders, state.toUkraineOrders],
  )
  const totalQty = state.toUkraineTotal + state.directTotal
  const totalPages = Math.max(1, Math.ceil(totalQty / pageSize))
  const currencyOptions = useMemo(
    () => toSelectOptions(currenciesState.items, getCurrencyLabel),
    [currenciesState.items],
  )
  const toolbarLeft = useMemo(
    () => (
      <Group gap="xs">
        <Badge color="gray" variant="light">{t('Сторінка')} {page}</Badge>
        <Badge color="blue" variant="light">{t('Поставки')}: {state.toUkraineTotal}</Badge>
        <Badge color="teal" variant="light">{t('Замовлення')}: {state.directTotal}</Badge>
      </Group>
    ),
    [page, state.directTotal, state.toUkraineTotal, t],
  )
  const orderActionsPermissions = useMemo<OrderActionsPermissions>(
    () => ({
      canOpenDirectInvoices,
      canOpenDirectLogistics,
      canOpenDirectProductIncome,
      canOpenDirectSpecifications,
      canOpenToUkraineOfficialCosts,
      canOpenToUkrainePlacement,
      canOpenToUkraineProtocols,
      canOpenToUkraineView,
    }),
    [
      canOpenDirectInvoices,
      canOpenDirectLogistics,
      canOpenDirectProductIncome,
      canOpenDirectSpecifications,
      canOpenToUkraineOfficialCosts,
      canOpenToUkrainePlacement,
      canOpenToUkraineProtocols,
      canOpenToUkraineView,
    ],
  )
  const columns = useSupplyUkraineOrdersColumns({
    expandedDirectOrders,
    onDelete: (row) => dispatchUi({ row, type: 'setDeleteCandidate' }),
    onToggleDirectOrder: toggleDirectOrder,
  })

  function updateFilterDraft(patch: Partial<SupplyUkraineOrdersFilter>) {
    dispatchUi({ patch, type: 'patchFilterDraft' })
  }

  function refreshOrders() {
    dispatchUi({ filters: filterDraft, type: 'setActiveFilters' })
    reload()
  }

  function resetFilters() {
    dispatchUi({ filters: defaultFilters, type: 'resetFilters' })
    saveFilters(defaultFilters)
  }

  function changePageSize(value: string | null) {
    const nextPageSize = Number(value || DEFAULT_PAGE_SIZE)
    dispatchUi({
      pageSize: Number.isFinite(nextPageSize) ? nextPageSize : DEFAULT_PAGE_SIZE,
      type: 'setPageSize',
    })
  }

  function toggleDirectOrder(order: DirectSupplyOrder) {
    const key = getOrderKey(order)

    if (!key) {
      return
    }

    dispatchUi({ orderKey: key, type: 'toggleDirectOrder' })
  }

  function openRow(row: SupplyUkraineOrderRow) {
    if (row.kind !== 'invoice') {
      dispatchUi({ row, type: 'setSelectedRow' })
    }
  }

  function navigateFromModal(path: string) {
    dispatchUi({ row: null, type: 'setSelectedRow' })
    navigate(path)
  }

  function openOfficialCosts(row: SupplyUkraineOrderRow) {
    dispatchUi({ row: null, type: 'setSelectedRow' })
    dispatchUi({ row, type: 'setOfficialCostsRow' })
  }

  async function confirmDelete() {
    if (!deleteCandidate?.netUid) {
      dispatchUi({ row: null, type: 'setDeleteCandidate' })
      return
    }

    dispatchUi({ isDeleting: true, type: 'setDeleting' })

    try {
      if (deleteCandidate.kind === 'toUkraine') {
        await deleteSupplyUkraineOrder(deleteCandidate.netUid)
      } else {
        await deleteDirectSupplyUkraineOrder(deleteCandidate.netUid)
      }

      notifications.show({
        color: 'green',
        message: t('Замовлення видалено'),
      })
      dispatchUi({ row: null, type: 'setDeleteCandidate' })
      reload()
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : t('Не вдалося видалити замовлення'),
      })
    } finally {
      dispatchUi({ isDeleting: false, type: 'setDeleting' })
    }
  }

  const closeDownload = useCallback(() => {
    downloadRequestRef.current += 1
    dispatchUi({ type: 'closeDownload' })
  }, [])

  async function downloadPrintDocument() {
    const requestId = downloadRequestRef.current + 1
    downloadRequestRef.current = requestId
    dispatchUi({ type: 'openDownload' })

    try {
      const document = await printSupplyOrdersDocument(activeFilters.from, activeFilters.to, buildPrintColumns(t))

      if (downloadRequestRef.current === requestId) {
        dispatchUi({ document, type: 'setDownloadDocument' })
      }
    } catch (error) {
      if (downloadRequestRef.current === requestId) {
        dispatchUi({
          error: error instanceof Error ? error.message : t('Документ недоступний для завантаження'),
          type: 'setDownloadError',
        })
      }
    } finally {
      if (downloadRequestRef.current === requestId) {
        dispatchUi({ isDownloading: false, type: 'setDownloading' })
      }
    }
  }

  return {
    changePage: (nextPage: number) => dispatchUi({ page: nextPage, type: 'setPage' }),
    changePageSize,
    closeDelete: () => dispatchUi({ row: null, type: 'setDeleteCandidate' }),
    closeDownload,
    closeOfficialCosts: () => dispatchUi({ row: null, type: 'setOfficialCostsRow' }),
    closeRow: () => dispatchUi({ row: null, type: 'setSelectedRow' }),
    columns,
    confirmDelete,
    createDirect: () => navigate('/orders/ukraine/all/new', { state: { backgroundLocation: location } }),
    createPermissions: { canCreateDirect, canCreateToUkraine, canPrint },
    createToUkraine: () => navigate('/orders/ukraine/to-ukraine/new', { state: { backgroundLocation: location } }),
    currenciesState,
    currencyOptions,
    deleteCandidate,
    downloadDocument,
    downloadError,
    downloadOpened,
    downloadPrintDocument,
    filterDraft,
    filterError,
    isDeleting,
    isDownloading,
    navigateFromModal,
    officialCostsRow,
    officialCostsSaved: () => {
      dispatchUi({ row: null, type: 'setOfficialCostsRow' })
      reload()
    },
    openOfficialCosts,
    openRow,
    orderActionsPermissions,
    page,
    pageSize,
    refreshOrders,
    resetFilters,
    rows,
    selectedRow,
    state,
    toolbarLeft,
    totalPages,
    updateFilterDraft,
  }
}

export function SupplyUkraineOrdersPage() {
  const { t } = useI18n()
  const {
    changePage,
    changePageSize,
    closeDelete,
    closeDownload,
    closeOfficialCosts,
    closeRow,
    columns,
    confirmDelete,
    createDirect,
    createPermissions,
    createToUkraine,
    currenciesState,
    currencyOptions,
    deleteCandidate,
    downloadDocument,
    downloadError,
    downloadOpened,
    downloadPrintDocument,
    filterDraft,
    filterError,
    isDeleting,
    isDownloading,
    navigateFromModal,
    officialCostsRow,
    officialCostsSaved,
    openOfficialCosts,
    openRow,
    orderActionsPermissions,
    page,
    pageSize,
    refreshOrders,
    resetFilters,
    rows,
    selectedRow,
    state,
    toolbarLeft,
    totalPages,
    updateFilterDraft,
  } = useSupplyUkraineOrdersPageController()

  return (
    <Stack gap="sm" className="supply-ukraine-orders-page">
      <PageHeaderActions>
        <Button leftSection={<IconRefresh size={16} />} loading={state.isLoading} size="sm" onClick={refreshOrders}>
          {t('Оновити')}
        </Button>
      </PageHeaderActions>

      <OrdersListCard
        columns={columns}
        createPermissions={createPermissions}
        currenciesError={currenciesState.error}
        currencyOptions={currencyOptions}
        filterDraft={filterDraft}
        filterError={filterError}
        isDownloading={isDownloading}
        orderError={state.error}
        page={page}
        pageSize={pageSize}
        rows={filterError ? [] : rows}
        state={state}
        toolbarLeft={toolbarLeft}
        totalPages={totalPages}
        onChangePage={changePage}
        onChangePageSize={changePageSize}
        onCreateDirect={createDirect}
        onCreateToUkraine={createToUkraine}
        onDownload={downloadPrintDocument}
        onFilterDraftChange={updateFilterDraft}
        onResetFilters={resetFilters}
        onRowClick={openRow}
      />

      <OrdersPageModals
        deleteCandidate={deleteCandidate}
        downloadDocument={downloadDocument}
        downloadError={downloadError}
        downloadOpened={downloadOpened}
        isDeleting={isDeleting}
        isDownloading={isDownloading}
        officialCostsRow={officialCostsRow}
        permissions={orderActionsPermissions}
        selectedRow={selectedRow}
        onCloseDelete={closeDelete}
        onCloseDownload={closeDownload}
        onCloseOfficialCosts={closeOfficialCosts}
        onCloseRow={closeRow}
        onConfirmDelete={confirmDelete}
        onNavigate={navigateFromModal}
        onOpenOfficialCosts={openOfficialCosts}
        onOfficialCostsSaved={officialCostsSaved}
      />
    </Stack>
  )
}

function OrdersListCard({
  columns,
  createPermissions,
  currenciesError,
  currencyOptions,
  filterDraft,
  filterError,
  isDownloading,
  orderError,
  page,
  pageSize,
  rows,
  state,
  toolbarLeft,
  totalPages,
  onChangePage,
  onChangePageSize,
  onCreateDirect,
  onCreateToUkraine,
  onDownload,
  onFilterDraftChange,
  onResetFilters,
  onRowClick,
}: {
  columns: DataTableColumn<SupplyUkraineOrderRow>[]
  createPermissions: OrderCreatePermissions
  currenciesError: string | null
  currencyOptions: Array<{ label: string, value: string }>
  filterDraft: SupplyUkraineOrdersFilter
  filterError: string | null
  isDownloading: boolean
  orderError: string | null
  page: number
  pageSize: number
  rows: SupplyUkraineOrderRow[]
  state: OrdersState
  toolbarLeft: ReactNode
  totalPages: number
  onChangePage: (page: number) => void
  onChangePageSize: (value: string | null) => void
  onCreateDirect: () => void
  onCreateToUkraine: () => void
  onDownload: () => void
  onFilterDraftChange: (patch: Partial<SupplyUkraineOrdersFilter>) => void
  onResetFilters: () => void
  onRowClick: (row: SupplyUkraineOrderRow) => void
}) {
  const { t } = useI18n()

  return (
    <Card withBorder radius="md" padding="sm" className="supply-ukraine-orders-card">
      <Stack gap="xs" className="supply-ukraine-orders-card-stack">
        <OrdersFilterToolbar
          createPermissions={createPermissions}
          currencyOptions={currencyOptions}
          filterDraft={filterDraft}
          isDownloading={isDownloading}
          onCreateDirect={onCreateDirect}
          onCreateToUkraine={onCreateToUkraine}
          onDownload={onDownload}
          onFilterDraftChange={onFilterDraftChange}
          onResetFilters={onResetFilters}
        />

        {currenciesError && (
          <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
            {currenciesError}
          </Alert>
        )}

        {(orderError || filterError) && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {filterError || orderError}
          </Alert>
        )}

        <div className="supply-ukraine-orders-table">
          <DataTable
            columns={columns}
            data={rows}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={t('Замовлень не знайдено')}
            getRowId={getRowId}
            height="100%"
            isLoading={state.isLoading}
            layoutVersion="supply-ukraine-orders-table-1"
            loadingText={t('Завантаження замовлень')}
            minWidth={1680}
            rowClassName={(row) => (row.kind === 'invoice' ? 'is-child-row' : undefined)}
            tableId="supply-ukraine-orders"
            toolbarLeft={toolbarLeft}
            onRowClick={onRowClick}
          />
        </div>

        <OrdersPagination
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          onChangePage={onChangePage}
          onChangePageSize={onChangePageSize}
        />
      </Stack>
    </Card>
  )
}

function OrdersFilterToolbar({
  createPermissions,
  currencyOptions,
  filterDraft,
  isDownloading,
  onCreateDirect,
  onCreateToUkraine,
  onDownload,
  onFilterDraftChange,
  onResetFilters,
}: {
  createPermissions: OrderCreatePermissions
  currencyOptions: Array<{ label: string, value: string }>
  filterDraft: SupplyUkraineOrdersFilter
  isDownloading: boolean
  onCreateDirect: () => void
  onCreateToUkraine: () => void
  onDownload: () => void
  onFilterDraftChange: (patch: Partial<SupplyUkraineOrdersFilter>) => void
  onResetFilters: () => void
}) {
  const { t } = useI18n()

  return (
    <Group align="flex-end" gap="xs" wrap="wrap" className="supply-ukraine-orders-filters">
      <TextInput
        label={t('Від')}
        type="date"
        value={filterDraft.from}
        w={150}
        onChange={(event) => onFilterDraftChange({ from: event.currentTarget.value })}
      />
      <TextInput
        label={t('До')}
        type="date"
        value={filterDraft.to}
        w={150}
        onChange={(event) => onFilterDraftChange({ to: event.currentTarget.value })}
      />
      <TextInput
        label={t('Постачальник')}
        placeholder={t('Назва постачальника')}
        value={filterDraft.supplier}
        w={205}
        onChange={(event) => onFilterDraftChange({ supplier: event.currentTarget.value })}
      />
      <Select
        clearable
        data={currencyOptions}
        label={t('Валюта')}
        placeholder={t('Усі')}
        searchable
        value={filterDraft.currencyId || null}
        w={160}
        onChange={(value) => onFilterDraftChange({ currencyId: value || '' })}
      />
      <Select
        allowDeselect={false}
        data={TYPE_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
        label={t('Тип')}
        value={filterDraft.type}
        w={210}
        onChange={(value) => onFilterDraftChange({ type: (value as SupplyUkraineOrderKind) || 'all' })}
      />
      {createPermissions.canCreateToUkraine && (
        <Button leftSection={<IconPackageImport size={16} />} variant="light" onClick={onCreateToUkraine}>
          {t('Поставка в Україну')}
        </Button>
      )}
      {createPermissions.canCreateDirect && (
        <Button leftSection={<IconFileSpreadsheet size={16} />} variant="light" onClick={onCreateDirect}>
          {t('Замовлення Україна')}
        </Button>
      )}
      {createPermissions.canPrint && (
        <Button leftSection={<IconDownload size={16} />} loading={isDownloading} variant="light" onClick={onDownload}>
          {t('Завантажити')}
        </Button>
      )}
      <Tooltip label={t('Скинути фільтри')}>
        <ActionIcon aria-label={t('Скинути фільтри')} size="lg" variant="light" onClick={onResetFilters}>
          <IconRestore size={18} />
        </ActionIcon>
      </Tooltip>
    </Group>
  )
}

function OrdersPagination({
  page,
  pageSize,
  totalPages,
  onChangePage,
  onChangePageSize,
}: {
  page: number
  pageSize: number
  totalPages: number
  onChangePage: (page: number) => void
  onChangePageSize: (value: string | null) => void
}) {
  const { t } = useI18n()

  return (
    <Group justify="flex-end" className="supply-ukraine-orders-pagination">
      <Group gap={6}>
        <Text c="dimmed" size="xs">{t('Рядків')}</Text>
        <Select
          allowDeselect={false}
          aria-label={t('Рядків')}
          data={PAGE_SIZE_OPTIONS.map((value) => ({ label: value, value }))}
          size="xs"
          value={String(pageSize)}
          w={82}
          onChange={onChangePageSize}
        />
      </Group>
      {totalPages > 1 && (
        <Pagination total={totalPages} value={Math.min(page, totalPages)} onChange={onChangePage} />
      )}
    </Group>
  )
}

function OrdersPageModals({
  deleteCandidate,
  downloadDocument,
  downloadError,
  downloadOpened,
  isDeleting,
  isDownloading,
  officialCostsRow,
  permissions,
  selectedRow,
  onCloseDelete,
  onCloseDownload,
  onCloseOfficialCosts,
  onCloseRow,
  onConfirmDelete,
  onNavigate,
  onOpenOfficialCosts,
  onOfficialCostsSaved,
}: {
  deleteCandidate: SupplyUkraineOrderRow | null
  downloadDocument: SupplyOrderPrintDocument | null
  downloadError: string | null
  downloadOpened: boolean
  isDeleting: boolean
  isDownloading: boolean
  officialCostsRow: SupplyUkraineOrderRow | null
  permissions: OrderActionsPermissions
  selectedRow: SupplyUkraineOrderRow | null
  onCloseDelete: () => void
  onCloseDownload: () => void
  onCloseOfficialCosts: () => void
  onCloseRow: () => void
  onConfirmDelete: () => void
  onNavigate: (path: string) => void
  onOpenOfficialCosts: (row: SupplyUkraineOrderRow) => void
  onOfficialCostsSaved: () => void
}) {
  const { t } = useI18n()

  return (
    <>
      <OrderActionsModal
        permissions={permissions}
        row={selectedRow}
        onClose={onCloseRow}
        onOpenOfficialCosts={onOpenOfficialCosts}
        onNavigate={onNavigate}
      />

      {officialCostsRow && (
        <OfficialCostsModal
          key={officialCostsRow.netUid || officialCostsRow.index}
          row={officialCostsRow}
          onClose={onCloseOfficialCosts}
          onSaved={onOfficialCostsSaved}
        />
      )}

      <AppModal centered opened={Boolean(deleteCandidate)} title={t('Видалити замовлення')} onClose={onCloseDelete}>
        <Stack gap="md">
          <Text>
            {t('Видалити')} <Text span fw={700}>{getRowTitle(deleteCandidate)}</Text>?
          </Text>
          <Group justify="flex-end">
            <Button color="gray" disabled={isDeleting} variant="light" onClick={onCloseDelete}>
              {t('Скасувати')}
            </Button>
            <Button color="red" leftSection={<IconTrash size={16} />} loading={isDeleting} onClick={onConfirmDelete}>
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>

      <DownloadDocumentModal
        document={downloadDocument}
        error={downloadError}
        isLoading={isDownloading}
        opened={downloadOpened}
        onClose={onCloseDownload}
      />
    </>
  )
}

function useSupplyUkraineOrdersColumns({
  expandedDirectOrders,
  onDelete,
  onToggleDirectOrder,
}: {
  expandedDirectOrders: Set<string>
  onDelete: (row: SupplyUkraineOrderRow) => void
  onToggleDirectOrder: (order: DirectSupplyOrder) => void
}): DataTableColumn<SupplyUkraineOrderRow>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SupplyUkraineOrderRow>[]>(
    () => [
      {
        id: 'index',
        header: '',
        width: 58,
        minWidth: 50,
        accessor: (row) => row.index,
        cell: (row) => row.kind === 'invoice' ? '' : row.index,
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 140,
        accessor: (row) => row.number,
        cell: (row) => row.kind === 'invoice' ? <Text c="dimmed">{displayValue(row.invoiceNumber)}</Text> : <Text fw={700}>{displayValue(row.number)}</Text>,
      },
      {
        id: 'createdDate',
        header: t('Створено'),
        width: 142,
        accessor: (row) => toTimestamp(row.createdDate),
        cell: (row) => formatDateTime(row.createdDate),
      },
      {
        id: 'orderDate',
        header: t('Від'),
        width: 142,
        accessor: (row) => toTimestamp(row.orderDate),
        cell: (row) => formatDateTime(row.orderDate),
      },
      {
        id: 'invoiceNumber',
        header: t('Номер інвойсу'),
        width: 180,
        accessor: (row) => row.invoiceNumber,
        cell: (row) => displayValue(row.invoiceNumber),
      },
      {
        id: 'invoiceDate',
        header: t('Дата інвойсу'),
        width: 142,
        accessor: (row) => toTimestamp(row.invoiceDate),
        cell: (row) => formatDateTime(row.invoiceDate),
      },
      {
        id: 'grossPrice',
        header: t('Сума'),
        width: 110,
        align: 'right',
        accessor: (row) => row.grossPrice,
        cell: (row) => formatMoney(row.grossPrice),
      },
      {
        id: 'supplier',
        header: t('Постачальник'),
        minWidth: 220,
        accessor: (row) => row.supplier,
        cell: (row) => displayValue(row.supplier),
      },
      {
        id: 'agreement',
        header: t('Договір'),
        width: 190,
        accessor: (row) => row.agreement,
        cell: (row) => displayValue(row.agreement),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 90,
        accessor: (row) => row.currency,
        cell: (row) => displayValue(row.currency),
      },
      {
        id: 'qty',
        header: t('К-сть'),
        width: 92,
        align: 'right',
        accessor: (row) => row.qty,
        cell: (row) => formatAmount(row.qty),
      },
      {
        id: 'additionalPercent',
        header: t('% дод.'),
        width: 96,
        align: 'right',
        accessor: (row) => row.additionalPercent,
        cell: (row) => formatAmount(row.additionalPercent),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 180,
        accessor: (row) => row.organization,
        cell: (row) => displayValue(row.organization),
      },
      {
        id: 'isPlaced',
        header: t('Розміщено'),
        width: 110,
        accessor: (row) => row.isPlaced,
        cell: (row) => row.kind === 'invoice' ? placedBadge(row.isPlaced, t) : placedBadge(row.isPlaced, t),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 150,
        accessor: (row) => row.responsible,
        cell: (row) => displayValue(row.responsible),
      },
      {
        id: 'kind',
        header: t('Тип'),
        width: 130,
        accessor: (row) => row.kind,
        cell: (row) => getKindBadge(row, t),
      },
      {
        id: 'actions',
        header: '',
        width: 104,
        enableSorting: false,
        cell: (row) => (
          <Group gap={4} justify="center" wrap="nowrap">
            {row.kind === 'direct' && row.directOrder && (row.directOrder.SupplyInvoices?.length || 0) > 0 && (
              <Tooltip label={expandedDirectOrders.has(getOrderKey(row.directOrder)) ? t('Згорнути інвойси') : t('Показати інвойси')}>
                <ActionIcon
                  aria-label={t('Показати інвойси')}
                  size="sm"
                  variant="subtle"
                  onClick={(event: MouseEvent<HTMLButtonElement>) => {
                    event.stopPropagation()
                    onToggleDirectOrder(row.directOrder as DirectSupplyOrder)
                  }}
                >
                  {expandedDirectOrders.has(getOrderKey(row.directOrder)) ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
            {canDeleteRow(row) && (
              <Tooltip label={t('Видалити')}>
                <ActionIcon
                  aria-label={t('Видалити')}
                  color="red"
                  size="sm"
                  variant="subtle"
                  onClick={(event: MouseEvent<HTMLButtonElement>) => {
                    event.stopPropagation()
                    onDelete(row)
                  }}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        ),
      },
    ],
    [expandedDirectOrders, onDelete, onToggleDirectOrder, t],
  )
}

function OrderActionsModal({
  permissions,
  row,
  onClose,
  onOpenOfficialCosts,
  onNavigate,
}: {
  permissions: OrderActionsPermissions
  row: SupplyUkraineOrderRow | null
  onClose: () => void
  onOpenOfficialCosts: (row: SupplyUkraineOrderRow) => void
  onNavigate: (path: string) => void
}) {
  const { t } = useI18n()
  const {
    canOpenDirectInvoices,
    canOpenDirectLogistics,
    canOpenDirectProductIncome,
    canOpenDirectSpecifications,
    canOpenToUkraineOfficialCosts,
    canOpenToUkrainePlacement,
    canOpenToUkraineProtocols,
    canOpenToUkraineView,
  } = permissions
  const directHasInvoices = (row?.directOrder?.SupplyInvoices?.length || 0) > 0
  const directHasProForma = Boolean(row?.directOrder?.SupplyProFormId)

  return (
    <AppModal centered opened={Boolean(row)} size="sm" title={t('Оберіть дію')} onClose={onClose}>
      {row && (
        <Stack gap="xs">
          <Text c="dimmed" size="sm">{getRowTitle(row)}</Text>

          {row.kind === 'toUkraine' && canOpenToUkrainePlacement && row.netUid && (
            <Button
              justify="flex-start"
              leftSection={<IconPackageImport size={16} />}
              variant="light"
              onClick={() => onNavigate(`/orders/ukraine/placement/${row.netUid}`)}
            >
              {t('Розміщення товару')}
            </Button>
          )}

          {row.kind === 'toUkraine' && canOpenToUkraineView && row.netUid && (
            <Button
              justify="flex-start"
              leftSection={<IconEye size={16} />}
              variant="light"
              onClick={() => onNavigate(`/orders/ukraine/view/${row.netUid}`)}
            >
              {t('Огляд')}
            </Button>
          )}

          {row.kind === 'toUkraine' && canOpenToUkraineProtocols && row.netUid && (
            <Button
              justify="flex-start"
              leftSection={<IconFileInvoice size={16} />}
              variant="light"
              onClick={() => onNavigate(`/orders/ukraine/protocols/${row.netUid}`)}
            >
              {t('Протоколи оплат')}
            </Button>
          )}

          {row.kind === 'toUkraine' && canOpenToUkraineOfficialCosts && row.order && (
            <Button
              justify="flex-start"
              leftSection={<IconReceipt size={16} />}
              variant="light"
              onClick={() => onOpenOfficialCosts(row)}
            >
              {getOfficialCostsActionLabel(row.order, t)}
            </Button>
          )}

          {row.kind === 'direct' && canOpenDirectLogistics && row.netUid && (
            <Button
              justify="flex-start"
              leftSection={<IconRoute size={16} />}
              variant="light"
              onClick={() => onNavigate(`/orders/ukraine/all/edit/${row.netUid}`)}
            >
              {t('Логістика')}
            </Button>
          )}

          {row.kind === 'direct' && canOpenDirectInvoices && directHasProForma && row.netUid && (
            <Button
              justify="flex-start"
              leftSection={<IconFileInvoice size={16} />}
              variant="light"
              onClick={() => onNavigate(`/orders/ukraine/all/edit/${row.netUid}/supply-invoices`)}
            >
              {t('Інвойси і пак листи')}
            </Button>
          )}

          {row.kind === 'direct' && canOpenDirectSpecifications && directHasProForma && row.netUid && (
            <Button
              justify="flex-start"
              leftSection={<IconListDetails size={16} />}
              variant="light"
              onClick={() => onNavigate(`/orders/ukraine/all/edit/${row.netUid}/specifications`)}
            >
              {t('Специфікації')}
            </Button>
          )}

          {row.kind === 'direct' && canOpenDirectProductIncome && directHasInvoices && row.netUid && (
            <Button
              justify="flex-start"
              leftSection={<IconPackageImport size={16} />}
              variant="light"
              onClick={() => onNavigate(`/orders/ukraine/all/edit/${row.netUid}/product-income`)}
            >
              {t('Розміщення приходу')}
            </Button>
          )}
        </Stack>
      )}
    </AppModal>
  )
}

type OfficialCostsForm = {
  accountingGrossAmount: number | ''
  accountingVatPercent: number | ''
  actDocuments: File[]
  consumableProductKey: string
  fromDate: string
  grossAmount: number | ''
  invoiceNumber: string
  serviceAgreementKey: string
  serviceOrganizationKey: string
  vatPercent: number | ''
}

type OfficialCostsState = {
  error: string | null
  form: OfficialCostsForm
  isLoading: boolean
  isSaving: boolean
  organizations: SupplyServiceOrganization[]
  products: SupplyServiceConsumableProduct[]
}

type OfficialCostsAction =
  | { type: 'loadStart' }
  | {
    organizations: SupplyServiceOrganization[]
    products: SupplyServiceConsumableProduct[]
    type: 'loadSuccess'
  }
  | { error: string; type: 'loadFailure' }
  | { patch: Partial<OfficialCostsForm>; type: 'patchForm' }
  | { error: string | null; type: 'setError' }
  | { isSaving: boolean; type: 'setSaving' }

function createInitialOfficialCostsState(expense: ProductDeliveryExpense | null): OfficialCostsState {
  return {
    error: null,
    form: createOfficialCostsForm(expense),
    isLoading: true,
    isSaving: false,
    organizations: [],
    products: [],
  }
}

function officialCostsReducer(state: OfficialCostsState, action: OfficialCostsAction): OfficialCostsState {
  switch (action.type) {
    case 'loadStart':
      return { ...state, error: null, isLoading: true }
    case 'loadSuccess':
      return {
        ...state,
        error: null,
        isLoading: false,
        organizations: action.organizations,
        products: action.products,
      }
    case 'loadFailure':
      return { ...state, error: action.error, isLoading: false }
    case 'patchForm':
      return { ...state, form: { ...state.form, ...action.patch } }
    case 'setError':
      return { ...state, error: action.error }
    case 'setSaving':
      return { ...state, isSaving: action.isSaving }
  }
}

function OfficialCostsModal({
  row,
  onClose,
  onSaved,
}: {
  row: SupplyUkraineOrderRow
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const expense = row.order?.DeliveryExpenses?.[0] || null
  const [state, dispatch] = useReducer(officialCostsReducer, expense, createInitialOfficialCostsState)
  const { error, form, isLoading, isSaving, organizations, products } = state

  useEffect(() => {
    let cancelled = false

    async function loadDictionaries() {
      dispatch({ type: 'loadStart' })

      try {
        const [nextOrganizations, nextProducts] = await Promise.all([
          getSupplyOrderServiceOrganizations(),
          getSupplyOrderServiceConsumableProducts(''),
        ])

        if (!cancelled) {
          dispatch({
            organizations: addSelectedOrganization(nextOrganizations, expense?.SupplyOrganization || null),
            products: addSelectedProduct(nextProducts, expense?.ConsumableProduct || null),
            type: 'loadSuccess',
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatch({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити довідники'),
            type: 'loadFailure',
          })
        }
      }
    }

    void loadDictionaries()

    return () => {
      cancelled = true
    }
  }, [expense, t])

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => getEntityKey(organization) === form.serviceOrganizationKey) || null,
    [form.serviceOrganizationKey, organizations],
  )
  const selectedAgreement = useMemo(
    () => (selectedOrganization?.SupplyOrganizationAgreements || []).find((agreement) => getEntityKey(agreement) === form.serviceAgreementKey) || null,
    [form.serviceAgreementKey, selectedOrganization],
  )
  const selectedProduct = useMemo(
    () => products.find((product) => getEntityKey(product) === form.consumableProductKey) || null,
    [form.consumableProductKey, products],
  )
  const organizationOptions = useMemo(
    () => toSelectOptions(organizations, (organization) => organization.Name || String(organization.Id || '')),
    [organizations],
  )
  const agreementOptions = useMemo(
    () => toSelectOptions(selectedOrganization?.SupplyOrganizationAgreements || [], getServiceAgreementLabel),
    [selectedOrganization],
  )
  const productOptions = useMemo(
    () => toSelectOptions(products, (product) => product.Name || String(product.Id || '')),
    [products],
  )

  function updateForm(patch: Partial<OfficialCostsForm>) {
    dispatch({ patch, type: 'patchForm' })
  }

  function changeOrganization(value: string | null) {
    const organization = organizations.find((item) => getEntityKey(item) === value) || null
    const agreement = organization?.SupplyOrganizationAgreements?.[0] || null

    updateForm({
      serviceAgreementKey: getEntityKey(agreement),
      serviceOrganizationKey: value || '',
    })
  }

  async function saveOfficialCosts() {
    if (!row.order?.Id) {
      dispatch({ error: t('Поставка не завантажена'), type: 'setError' })
      return
    }

    if (!selectedOrganization || !selectedAgreement || !selectedProduct || !form.invoiceNumber.trim()) {
      dispatch({ error: t('Заповніть організацію, договір, тип і номер інвойса'), type: 'setError' })
      return
    }

    dispatch({ isSaving: true, type: 'setSaving' })
    dispatch({ error: null, type: 'setError' })

    const payload: ProductDeliveryExpense = {
      ...expense,
      AccountingGrossAmount: Number(form.accountingGrossAmount || 0),
      AccountingVatPercent: Number(form.accountingVatPercent || 0),
      ConsumableProduct: selectedProduct,
      ConsumableProductId: selectedProduct.Id,
      FromDate: normalizeDateTimeInput(form.fromDate),
      GrossAmount: Number(form.grossAmount || 0),
      InvoiceNumber: form.invoiceNumber.trim(),
      SupplyOrderUkraineId: row.order.Id,
      SupplyOrganization: selectedOrganization,
      SupplyOrganizationAgreement: selectedAgreement,
      SupplyOrganizationAgreementId: selectedAgreement.Id,
      SupplyOrganizationId: selectedOrganization.Id,
      VatPercent: Number(form.vatPercent || 0),
    }

    try {
      if (expense?.Id) {
        await updateSupplyOrderUkraineDeliveryExpense(payload)
      } else {
        await createSupplyOrderUkraineDeliveryExpense(payload, form.actDocuments)
      }

      notifications.show({ color: 'green', message: t('Офіційні витрати доставки збережено') })
      onSaved()
    } catch (saveError) {
      dispatch({
        error: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти офіційні витрати доставки'),
        type: 'setError',
      })
    } finally {
      dispatch({ isSaving: false, type: 'setSaving' })
    }
  }

  return (
    <AppModal centered opened={Boolean(row)} size="lg" title={t('Офіційні витрати доставки')} onClose={onClose}>
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Select
            data={organizationOptions}
            disabled={isLoading || isSaving}
            label={t('Постачальник послуг')}
            searchable
            value={form.serviceOrganizationKey || null}
            onChange={changeOrganization}
          />
          <Select
            data={agreementOptions}
            disabled={isLoading || isSaving || !selectedOrganization}
            label={t('Договір')}
            searchable
            value={form.serviceAgreementKey || null}
            onChange={(value) => updateForm({ serviceAgreementKey: value || '' })}
          />
          <Select
            data={productOptions}
            disabled={isLoading || isSaving}
            label={t('Тип')}
            searchable
            value={form.consumableProductKey || null}
            onChange={(value) => updateForm({ consumableProductKey: value || '' })}
          />
          <TextInput
            disabled={isSaving}
            label={t('Номер інвойса')}
            value={form.invoiceNumber}
            onChange={(event) => updateForm({ invoiceNumber: event.currentTarget.value })}
          />
          <NumberInput
            disabled={isSaving}
            label={t('Вартість брутто')}
            min={0}
            value={form.grossAmount}
            onChange={(value) => updateForm({ grossAmount: toNonNegativeNumber(value) })}
          />
          <NumberInput
            disabled={isSaving}
            label={t('ПДВ %')}
            min={0}
            value={form.vatPercent}
            onChange={(value) => updateForm({ vatPercent: toNonNegativeNumber(value) })}
          />
          <NumberInput
            disabled={isSaving}
            label={t('Бух. вартість брутто')}
            min={0}
            value={form.accountingGrossAmount}
            onChange={(value) => updateForm({ accountingGrossAmount: toNonNegativeNumber(value) })}
          />
          <NumberInput
            disabled={isSaving}
            label={t('Бух. ПДВ %')}
            min={0}
            value={form.accountingVatPercent}
            onChange={(value) => updateForm({ accountingVatPercent: toNonNegativeNumber(value) })}
          />
          <TextInput
            disabled={isSaving}
            label={t('Дата')}
            type="datetime-local"
            value={form.fromDate}
            onChange={(event) => updateForm({ fromDate: event.currentTarget.value })}
          />
          <FileInput
            clearable
            multiple
            disabled={isSaving || Boolean(expense?.Id)}
            label={t('Акти надання послуг')}
            value={form.actDocuments}
            onChange={(files) => updateForm({ actDocuments: files })}
          />
        </SimpleGrid>

        <Group justify="flex-end">
          <Button disabled={isSaving} variant="subtle" onClick={onClose}>{t('Скасувати')}</Button>
          <Button leftSection={<IconReceipt size={16} />} loading={isSaving} onClick={saveOfficialCosts}>{t('Зберегти')}</Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function DownloadDocumentModal({
  document,
  error,
  isLoading,
  opened,
  onClose,
}: {
  document: SupplyOrderPrintDocument | null
  error: string | null
  isLoading: boolean
  opened: boolean
  onClose: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} title={t('Завантажити')} onClose={onClose}>
      <Stack gap="md">
        {isLoading ? (
          <Text c="dimmed">{t('Документ формується')}</Text>
        ) : error ? (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">{error}</Alert>
        ) : document?.DocumentURL || document?.PdfDocumentURL ? (
          <Group>
            {document.DocumentURL && (
              <Anchor href={getDocumentHref(document.DocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                <Group gap={6}><IconFileTypeXls size={16} /> XLS</Group>
              </Anchor>
            )}
            {document.PdfDocumentURL && (
              <Anchor href={getDocumentHref(document.PdfDocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                <Group gap={6}><IconFileTypePdf size={16} /> PDF</Group>
              </Anchor>
            )}
          </Group>
        ) : (
          <Text c="dimmed">{t('Документ не повернув посилання')}</Text>
        )}
      </Stack>
    </AppModal>
  )
}

function buildRows(
  toUkraineOrders: SupplyOrderUkraine[],
  directOrders: DirectSupplyOrder[],
  expandedDirectOrders: Set<string>,
): SupplyUkraineOrderRow[] {
  const baseRows = [
    ...toUkraineOrders.map(mapToUkraineOrderRow),
    ...directOrders.map(mapDirectOrderRow),
  ].sort(compareRows)

  const rows: SupplyUkraineOrderRow[] = []

  baseRows.forEach((row) => {
    rows.push({ ...row, index: rows.length + 1 })

    if (row.kind === 'direct' && row.directOrder && expandedDirectOrders.has(getOrderKey(row.directOrder))) {
      row.directOrder.SupplyInvoices?.forEach((invoice) => {
        rows.push(mapInvoiceRow(row.directOrder as DirectSupplyOrder, invoice, rows.length + 1))
      })
    }
  })

  return rows
}

function mapToUkraineOrderRow(order: SupplyOrderUkraine): SupplyUkraineOrderRow {
  return {
    additionalPercent: positiveNumber(order.AdditionalPercent),
    agreement: order.ClientAgreement?.Agreement?.Name,
    createdDate: order.Created,
    currency: order.ClientAgreement?.Agreement?.Currency?.Code || order.ClientAgreement?.Agreement?.Currency?.Name,
    grossPrice: positiveNumber(order.TotalGrossPriceLocal),
    index: 0,
    invoiceDate: order.InvDate,
    invoiceNumber: order.InvNumber,
    isPlaced: Boolean(order.IsPlaced),
    kind: 'toUkraine',
    netUid: order.NetUid,
    number: getToUkraineOrderDisplayNumber(order),
    order,
    orderDate: order.FromDate,
    organization: order.Organization?.Name,
    qty: positiveNumber(order.TotalQty),
    responsible: getEntityName(order.Responsible),
    supplier: getEntityName(order.Supplier),
  }
}

function mapDirectOrderRow(order: DirectSupplyOrder): SupplyUkraineOrderRow {
  const isResident = !order.Client?.IsNotResident
  const grossPrice = positiveNumber(order.TotalNetPrice)

  return {
    additionalPercent: positiveNumber(order.AdditionalPercent),
    agreement: order.ClientAgreement?.Agreement?.Name,
    createdDate: order.Created,
    currency: order.ClientAgreement?.Agreement?.Currency?.Code || order.ClientAgreement?.Agreement?.Currency?.Name,
    directOrder: order,
    grossPrice: grossPrice && isResident ? grossPrice + (order.TotalVat || 0) : grossPrice,
    index: 0,
    isPlaced: Boolean(order.IsFullyPlaced),
    kind: 'direct',
    netUid: order.NetUid,
    number: getDirectOrderDisplayNumber(order),
    orderDate: order.DateFrom,
    organization: order.Organization?.Name,
    qty: positiveNumber(order.TotalQuantity),
    responsible: getEntityName(order.Responsible),
    supplier: getEntityName(order.Client),
  }
}

function mapInvoiceRow(order: DirectSupplyOrder, invoice: SupplyInvoice, index: number): SupplyUkraineOrderRow {
  const isResident = !order.Client?.IsNotResident

  return {
    directOrder: order,
    grossPrice: isResident ? positiveNumber(invoice.TotalValueWithVat) : positiveNumber(invoice.TotalNetPrice),
    index,
    invoice,
    invoiceDate: invoice.DateFrom,
    invoiceNumber: invoice.Number,
    isPlaced: Boolean(invoice.IsFullyPlaced),
    kind: 'invoice',
    netUid: invoice.NetUid || `${order.NetUid || ''}-${invoice.Number || index}`,
    orderDate: order.DateFrom,
    qty: positiveNumber(invoice.TotalQuantity),
  }
}

function compareRows(left: SupplyUkraineOrderRow, right: SupplyUkraineOrderRow): number {
  return toTimestamp(right.orderDate) - toTimestamp(left.orderDate)
}

function createDefaultFilters(): SupplyUkraineOrdersFilter {
  return {
    currencyId: '',
    from: getDateShiftedByDays(-7),
    supplier: '',
    to: formatLocalDate(new Date()),
    type: 'all',
  }
}

function readSavedFilters(fallback: SupplyUkraineOrdersFilter): SupplyUkraineOrdersFilter {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const rawValue = window.localStorage.getItem(FILTER_STORAGE_KEY)

    if (!rawValue) {
      return fallback
    }

    const savedValue = JSON.parse(rawValue) as Partial<SupplyUkraineOrdersFilter>

    return {
      currencyId: typeof savedValue.currencyId === 'string' ? savedValue.currencyId : fallback.currencyId,
      from: isDateInputValue(savedValue.from) ? savedValue.from : fallback.from,
      supplier: typeof savedValue.supplier === 'string' ? savedValue.supplier : fallback.supplier,
      to: isDateInputValue(savedValue.to) ? savedValue.to : fallback.to,
      type: isOrderKind(savedValue.type) ? savedValue.type : fallback.type,
    }
  } catch {
    return fallback
  }
}

function saveFilters(filters: SupplyUkraineOrdersFilter) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters))
  }
}

function getDateShiftedByDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function getFilterError(filters: SupplyUkraineOrdersFilter): string | null {
  if (!filters.from || !filters.to) {
    return 'Вкажіть період'
  }

  if (new Date(filters.from).getTime() > new Date(filters.to).getTime()) {
    return 'Дата початку не може бути пізніше дати завершення'
  }

  return null
}

function isDateInputValue(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isOrderKind(value: unknown): value is SupplyUkraineOrderKind {
  return value === 'all' || value === 'direct' || value === 'toUkraine'
}

function getDirectOrderDisplayNumber(order: DirectSupplyOrder): string | undefined {
  const orderNumber = normalizeDisplayNumber(order.SupplyOrderNumber?.Number)
  const proFormNumber = normalizeDisplayNumber(order.SupplyProForm?.Number)
  const invoiceNumber = normalizeDisplayNumber(order.SupplyInvoices?.find((invoice) => normalizeDisplayNumber(invoice.Number))?.Number)

  return orderNumber || proFormNumber || invoiceNumber
}

function getToUkraineOrderDisplayNumber(order: SupplyOrderUkraine): string | undefined {
  return getSupplyUkraineOrderDisplayNumber(order)
}

function getRowId(row: SupplyUkraineOrderRow): string {
  return `${row.kind}:${row.netUid || row.invoiceNumber || row.number || row.index}`
}

function getOrderKey(order: DirectSupplyOrder): string {
  return order.NetUid || String(order.Id || '')
}

function canDeleteRow(row: SupplyUkraineOrderRow): boolean {
  if (!row.netUid || row.kind === 'invoice') {
    return false
  }

  if (row.kind === 'direct') {
    return true
  }

  return !row.order?.IsPlaced && Boolean(row.order?.IsDirectFromSupplier)
}

function getRowTitle(row: SupplyUkraineOrderRow | null): string {
  if (!row) {
    return '-'
  }

  return [row.number, row.supplier].filter(Boolean).join(' - ') || row.netUid || '-'
}

function getKindBadge(row: SupplyUkraineOrderRow, t: (key: string) => string) {
  if (row.kind === 'invoice') {
    return <Badge color="gray" variant="light">{t('Інвойс')}</Badge>
  }

  if (row.kind === 'direct') {
    return <Badge color="teal" variant="light">{t('Замовлення')}</Badge>
  }

  return <Badge color="blue" variant="light">{t('Поставка')}</Badge>
}

function placedBadge(value: boolean | undefined, t: (key: string) => string) {
  return value ? <Badge color="green" variant="light">{t('Так')}</Badge> : <Badge color="gray" variant="light">{t('Ні')}</Badge>
}

function buildPrintColumns(t: (key: string) => string) {
  return [
    { Number: 1, ColumnName: 'Number', TableName: 'SupplyOrderModel', Translate: t('Номер') },
    { Number: 2, ColumnName: 'Created', TableName: 'SupplyOrderModel', Translate: t('Створено') },
    { Number: 3, ColumnName: 'FromDate', TableName: 'SupplyOrderModel', Translate: t('Від') },
    { Number: 4, ColumnName: 'InvNumber', TableName: 'SupplyOrderModel', Translate: t('Номер інвойсу') },
    { Number: 5, ColumnName: 'InvDate', TableName: 'SupplyOrderModel', Translate: t('Дата інвойсу') },
    { Number: 6, ColumnName: 'TotalPrice', TableName: 'SupplyOrderModel', Translate: t('Сума') },
    { Number: 7, ColumnName: 'Supplier', TableName: 'SupplyOrderModel', Translate: t('Постачальник') },
    { Number: 8, ColumnName: 'Agreement', TableName: 'SupplyOrderModel', Translate: t('Договір') },
    { Number: 9, ColumnName: 'Currency', TableName: 'SupplyOrderModel', Translate: t('Валюта') },
    { Number: 10, ColumnName: 'Qty', TableName: 'SupplyOrderModel', Translate: t('Кількість') },
    { Number: 11, ColumnName: 'AdditionalPrice', TableName: 'SupplyOrderModel', Translate: t('Додатковий відсоток') },
    { Number: 12, ColumnName: 'Organization', TableName: 'SupplyOrderModel', Translate: t('Організація') },
    { Number: 13, ColumnName: 'Placed', TableName: 'SupplyOrderModel', Translate: t('Розміщено') },
    { Number: 14, ColumnName: 'Responsible', TableName: 'SupplyOrderModel', Translate: t('Відповідальний') },
  ]
}

function createOfficialCostsForm(expense: ProductDeliveryExpense | null): OfficialCostsForm {
  return {
    accountingGrossAmount: expense?.AccountingGrossAmount ?? '',
    accountingVatPercent: expense?.AccountingVatPercent ?? '',
    actDocuments: [],
    consumableProductKey: getEntityKey(expense?.ConsumableProduct),
    fromDate: toDateTimeInput(expense?.FromDate),
    grossAmount: expense?.GrossAmount ?? '',
    invoiceNumber: expense?.InvoiceNumber || '',
    serviceAgreementKey: getEntityKey(expense?.SupplyOrganizationAgreement),
    serviceOrganizationKey: getEntityKey(expense?.SupplyOrganization),
    vatPercent: expense?.VatPercent ?? '',
  }
}

function addSelectedOrganization(
  organizations: SupplyServiceOrganization[],
  selectedOrganization: SupplyServiceOrganization | null,
): SupplyServiceOrganization[] {
  if (!selectedOrganization || organizations.some((organization) => getEntityKey(organization) === getEntityKey(selectedOrganization))) {
    return organizations
  }

  return [selectedOrganization, ...organizations]
}

function addSelectedProduct(
  products: SupplyServiceConsumableProduct[],
  selectedProduct: SupplyServiceConsumableProduct | null,
): SupplyServiceConsumableProduct[] {
  if (!selectedProduct || products.some((product) => getEntityKey(product) === getEntityKey(selectedProduct))) {
    return products
  }

  return [selectedProduct, ...products]
}

function getOfficialCostsActionLabel(order: SupplyOrderUkraine, t: (key: string) => string): string {
  const accountingGrossAmount = order.DeliveryExpenses?.[0]?.AccountingGrossAmount

  return typeof accountingGrossAmount === 'number' && Number.isFinite(accountingGrossAmount)
    ? `${t('Офіційні витрати доставки')} (${formatMoney(accountingGrossAmount)})`
    : t('Додати офіційні витрати доставки')
}

function getServiceAgreementLabel(agreement: SupplyServiceOrganizationAgreement): string {
  const currencyCode = agreement.Currency?.Code || agreement.Currency?.Name

  return [agreement.Name || agreement.Number, currencyCode].filter(Boolean).join(' - ') || String(agreement.Id || agreement.NetUid || '')
}

function toSelectOptions<T extends { Id?: number; NetUid?: string }>(
  items: T[],
  getLabel: (item: T) => string,
): Array<{ label: string; value: string }> {
  return items.reduce<Array<{ label: string; value: string }>>((options, item) => {
    const value = getEntityKey(item)

    if (!value) {
      return options
    }

    options.push({
      label: getLabel(item),
      value,
    })

    return options
  }, [])
}

function getEntityKey(entity?: { Id?: number; NetUid?: string } | null): string {
  return entity?.NetUid || (entity?.Id ? String(entity.Id) : '')
}

function toDateTimeInput(value?: Date | string): string {
  const date = value ? new Date(value) : new Date()

  if (Number.isNaN(date.getTime())) {
    return toDateTimeInput(new Date())
  }

  const datePart = formatLocalDate(date)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${datePart}T${hours}:${minutes}`
}

function normalizeDateTimeInput(value: string): string {
  return value.length === 16 ? `${value}:00` : value
}

function toNonNegativeNumber(value: number | string): number | '' {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : ''
}

function getCurrencyLabel(currency: Currency): string {
  return [currency.Name, currency.Code].filter(Boolean).join(' - ') || String(currency.Id || currency.NetUid || '')
}

function getEntityName(entity?: { FullName?: string, LastName?: string, Name?: string } | null): string {
  return entity?.FullName || entity?.Name || entity?.LastName || ''
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateTimeFormatter.format(date)
}

function formatAmount(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? amountFormatter.format(value) : '-'
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '-'
}

function positiveNumber(value?: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function toTimestamp(value?: Date | string): number {
  if (!value) {
    return 0
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}
