import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  FileInput,
  Group,
  Loader,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
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
  IconPlus,
  IconReceipt,
  IconRestore,
  IconRoute,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { Fragment, useCallback, useEffect, useMemo, useReducer, useRef, useState, type MouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { realtimeEvents, useRealtimeEvent } from '../../../shared/realtime/events'
import { getSupplyUkraineOrderDisplayNumber, normalizeDisplayNumber } from '../../../shared/supplyUkraineOrderNumbers'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR, PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import {
  createSupplyOrderUkraineDeliveryExpense,
  deleteDirectSupplyUkraineOrder,
  deleteSupplyUkraineOrder,
  getDirectSupplyUkraineOrders,
  getSupplyOrderCurrencies,
  getSupplyOrderServiceConsumableProducts,
  getSupplyUkraineOrders,
  printSupplyOrdersDocument,
  searchSupplyOrderServiceOrganizations,
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
import '../../../shared/ui/console-table-page.css'
import './supply-ukraine-orders.css'

const FILTER_STORAGE_KEY = 'allOrdersUkraineFilter'
const DEFAULT_PAGE_SIZE = DEFAULT_PAGINATOR_PAGE_SIZE
const SUPPLY_ORGANIZATION_SEARCH_DEBOUNCE_MS = 300

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
const PERMISSION_DELETE_ORDER = 'UkraineAllOrders_SelectAnOption_Delete_PKEY'
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
  const canDeleteOrder = hasPermission(PERMISSION_DELETE_ORDER)
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
    () => buildRows(state.toUkraineOrders, state.directOrders),
    [state.directOrders, state.toUkraineOrders],
  )
  const totalQty = state.toUkraineTotal + state.directTotal
  const totalPages = Math.max(1, Math.ceil(totalQty / pageSize))
  const currencyOptions = useMemo(
    () => toSelectOptions(currenciesState.items, getCurrencyLabel),
    [currenciesState.items],
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
    totalPages,
    updateFilterDraft,
    canDeleteOrder,
    expandedDirectOrders,
    requestDelete: (row: SupplyUkraineOrderRow) => dispatchUi({ row, type: 'setDeleteCandidate' }),
    toggleDirectOrder,
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
    totalPages,
    updateFilterDraft,
    canDeleteOrder,
    expandedDirectOrders,
    requestDelete,
    toggleDirectOrder,
  } = useSupplyUkraineOrdersPageController()

  return (
    <Stack gap="md" className="supply-ukraine-orders-page console-table-page">
      <PageHeaderActions>
        <Group gap={8} wrap="nowrap">
          {createPermissions.canCreateToUkraine && (
            <Button color={CREATE_ACTION_COLOR} size="sm" leftSection={<IconPlus size={16} />} onClick={createToUkraine}>
              {t('Поставка')}
            </Button>
          )}
          {createPermissions.canCreateDirect && (
            <Button color={CREATE_ACTION_COLOR} size="sm" leftSection={<IconPlus size={16} />} variant="light" onClick={createDirect}>
              {t('Замовлення')}
            </Button>
          )}
        </Group>
      </PageHeaderActions>

      <OrdersListCard
        canPrint={createPermissions.canPrint}
        canDeleteOrder={canDeleteOrder}
        currenciesError={currenciesState.error}
        currencyOptions={currencyOptions}
        expandedDirectOrders={expandedDirectOrders}
        filterDraft={filterDraft}
        filterError={filterError}
        isDownloading={isDownloading}
        orderError={state.error}
        page={page}
        pageSize={pageSize}
        rows={filterError ? [] : rows}
        state={state}
        totalPages={totalPages}
        onChangePage={changePage}
        onChangePageSize={changePageSize}
        onDownload={downloadPrintDocument}
        onFilterDraftChange={updateFilterDraft}
        onRefresh={refreshOrders}
        onDelete={requestDelete}
        onResetFilters={resetFilters}
        onRowClick={openRow}
        onToggleDirectOrder={toggleDirectOrder}
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
  canPrint,
  canDeleteOrder,
  currenciesError,
  currencyOptions,
  expandedDirectOrders,
  filterDraft,
  filterError,
  isDownloading,
  orderError,
  page,
  pageSize,
  rows,
  state,
  totalPages,
  onChangePage,
  onChangePageSize,
  onDelete,
  onDownload,
  onFilterDraftChange,
  onRefresh,
  onResetFilters,
  onRowClick,
  onToggleDirectOrder,
}: {
  canPrint: boolean
  canDeleteOrder: boolean
  currenciesError: string | null
  currencyOptions: Array<{ label: string, value: string }>
  expandedDirectOrders: Set<string>
  filterDraft: SupplyUkraineOrdersFilter
  filterError: string | null
  isDownloading: boolean
  orderError: string | null
  page: number
  pageSize: number
  rows: SupplyUkraineOrderRow[]
  state: OrdersState
  totalPages: number
  onChangePage: (page: number) => void
  onChangePageSize: (value: string | null) => void
  onDelete: (row: SupplyUkraineOrderRow) => void
  onDownload: () => void
  onFilterDraftChange: (patch: Partial<SupplyUkraineOrdersFilter>) => void
  onRefresh: () => void
  onResetFilters: () => void
  onRowClick: (row: SupplyUkraineOrderRow) => void
  onToggleDirectOrder: (order: DirectSupplyOrder) => void
}) {
  const { t } = useI18n()

  return (
    <div className="supply-ukraine-orders-shell console-table-shell">
      <OrdersFilterToolbar
        canPrint={canPrint}
        currencyOptions={currencyOptions}
        filterDraft={filterDraft}
        isDownloading={isDownloading}
        isLoading={state.isLoading}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        onChangePage={onChangePage}
        onChangePageSize={onChangePageSize}
        onDownload={onDownload}
        onFilterDraftChange={onFilterDraftChange}
        onRefresh={onRefresh}
        onResetFilters={onResetFilters}
      />

      {currenciesError && (
        <Alert className="console-table-alert" color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
          {currenciesError}
        </Alert>
      )}

      {(orderError || filterError) && (
        <Alert className="console-table-alert" color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {filterError || orderError}
        </Alert>
      )}

      <div className="supply-ukraine-orders-table console-table-body">
        <SupplyOrdersGrid
          canDeleteOrder={canDeleteOrder}
          emptyText={t('Замовлень не знайдено')}
          expandedDirectOrders={expandedDirectOrders}
          isLoading={state.isLoading}
          loadingText={t('Завантаження замовлень')}
          rows={rows}
          onDelete={onDelete}
          onRowClick={onRowClick}
          onToggleDirectOrder={onToggleDirectOrder}
        />
      </div>
    </div>
  )
}

function SupplyOrdersGrid({
  canDeleteOrder,
  emptyText,
  expandedDirectOrders,
  isLoading,
  loadingText,
  rows,
  onDelete,
  onRowClick,
  onToggleDirectOrder,
}: {
  canDeleteOrder: boolean
  emptyText: string
  expandedDirectOrders: Set<string>
  isLoading: boolean
  loadingText: string
  rows: SupplyUkraineOrderRow[]
  onDelete: (row: SupplyUkraineOrderRow) => void
  onRowClick: (row: SupplyUkraineOrderRow) => void
  onToggleDirectOrder: (order: DirectSupplyOrder) => void
}) {
  const { t } = useI18n()

  if (isLoading) {
    return (
      <div className="supply-orders-grid-state">
        <Group justify="center" gap="xs">
          <Loader size="sm" />
          {loadingText}
        </Group>
      </div>
    )
  }

  if (rows.length === 0) {
    return <div className="supply-orders-grid-state">{emptyText}</div>
  }

  return (
    <div className="supply-orders-grid" role="table">
      <div className="supply-orders-grid-head" role="row">
        <span>{t('Замовлення / постачальник')}</span>
        <span>{t('Сума')}</span>
        <span>{t('К-сть')}</span>
        <span>{t('% дод.')}</span>
        <span>{t('Організація / договір')}</span>
        <span>{t('Відповідальний')}</span>
        <span>{t('Розміщено')}</span>
        <span>{t('Тип')}</span>
        <span>{t('Дії')}</span>
      </div>
      {rows.map((row) => {
        const isExpanded = Boolean(row.directOrder && expandedDirectOrders.has(getOrderKey(row.directOrder)))

        return (
          <Fragment key={getRowId(row)}>
            <SupplyOrderGridRow
              canDeleteOrder={canDeleteOrder}
              expandedDirectOrders={expandedDirectOrders}
              row={row}
              onDelete={onDelete}
              onRowClick={onRowClick}
              onToggleDirectOrder={onToggleDirectOrder}
            />
            {isExpanded && row.directOrder ? (
              <div className="supply-orders-grid-expand">
                <SupplyOrderInvoicesExpand order={row.directOrder} />
              </div>
            ) : null}
          </Fragment>
        )
      })}
    </div>
  )
}

function SupplyOrderGridRow({
  canDeleteOrder,
  expandedDirectOrders,
  row,
  onDelete,
  onRowClick,
  onToggleDirectOrder,
}: {
  canDeleteOrder: boolean
  expandedDirectOrders: Set<string>
  row: SupplyUkraineOrderRow
  onDelete: (row: SupplyUkraineOrderRow) => void
  onRowClick: (row: SupplyUkraineOrderRow) => void
  onToggleDirectOrder: (order: DirectSupplyOrder) => void
}) {
  const { t } = useI18n()
  const isExpanded = Boolean(row.directOrder && expandedDirectOrders.has(getOrderKey(row.directOrder)))
  const isInteractive = row.kind !== 'invoice'

  return (
    <div
      className={`supply-orders-grid-row is-${row.kind}${isExpanded ? ' is-expanded' : ''}`}
      role="row"
      tabIndex={isInteractive ? 0 : -1}
      onClick={() => {
        if (isInteractive) {
          onRowClick(row)
        }
      }}
      onKeyDown={(event) => {
        if (isInteractive && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onRowClick(row)
        }
      }}
    >
      <OrderMainGridCell row={row} />
      <OrderMoneyCell currency={row.currency} value={row.grossPrice} />
      <OrderMetricValue label="#" value={formatAmount(row.qty)} />
      <OrderMetricValue label="%" value={formatAmount(row.additionalPercent)} />
      <OrderOrganizationGridCell row={row} />
      <OrderResponsibleGridCell value={displayValue(row.responsible)} />
      {placedBadge(row.isPlaced, t)}
      {getKindBadge(row, t)}
      <OrderActionsCell
        canDelete={canDeleteOrder && canDeleteRow(row)}
        isExpanded={isExpanded}
        row={row}
        onDelete={onDelete}
        onToggleDirectOrder={onToggleDirectOrder}
      />
    </div>
  )
}

function OrderMainGridCell({ row }: { row: SupplyUkraineOrderRow }) {
  const { t } = useI18n()
  const supplier = displayValue(row.supplier)

  return (
    <div className="supply-order-main-cell">
      <OrderIndexCell row={row} />
      <div className="supply-order-main-body">
        <div className="supply-order-main-title-row">
          <Tooltip label={supplier} disabled={supplier === '-'} openDelay={350} withArrow>
            <span className="supply-order-main-title">{supplier}</span>
          </Tooltip>
        </div>
        <OrderMetaLine
          items={[
            { label: '№', value: displayValue(row.number), strong: true },
            { label: t('ств.'), value: formatCompactDateTime(row.createdDate) },
            { label: t('від'), value: formatCompactDateTime(row.orderDate) },
            { label: t('інв.'), value: displayValue(row.invoiceNumber) },
            { label: t('дата інв.'), value: formatCompactDateTime(row.invoiceDate) },
          ]}
        />
      </div>
    </div>
  )
}

function OrderOrganizationGridCell({ row }: { row: SupplyUkraineOrderRow }) {
  return (
    <span className="supply-order-two-line-cell">
      <Tooltip label={displayValue(row.organization)} openDelay={350} withArrow>
        <span className="supply-order-two-line-primary">{displayValue(row.organization)}</span>
      </Tooltip>
      <Tooltip label={displayValue(row.agreement)} openDelay={350} withArrow>
        <span className="supply-order-two-line-secondary">{displayValue(row.agreement)}</span>
      </Tooltip>
    </span>
  )
}

function OrderResponsibleGridCell({ value }: { value: string }) {
  return (
    <Tooltip label={value} disabled={value === '-'} openDelay={350} withArrow>
      <span className="supply-order-responsible-cell">{value}</span>
    </Tooltip>
  )
}

function SupplyOrderInvoicesExpand({ order }: { order: DirectSupplyOrder }) {
  const { t } = useI18n()
  const invoices = order.SupplyInvoices || []

  if (!invoices.length) {
    return (
      <div className="supply-invoices-expand is-empty">
        <Text c="dimmed" size="sm">{t('Інвойсів не знайдено')}</Text>
      </div>
    )
  }

  return (
    <div className="supply-invoices-expand">
      <div className="supply-invoices-expand-head">
        <span>{t('Інвойс')}</span>
        <span>{t('Дата')}</span>
        <span>{t('К-сть')}</span>
        <span>{t('Сума')}</span>
        <span>{t('Розміщено')}</span>
      </div>
      {invoices.map((invoice, index) => (
        <SupplyOrderInvoiceExpandItem
          key={String(invoice.NetUid || invoice.Id || invoice.Number || index)}
          index={index}
          invoice={invoice}
          order={order}
        />
      ))}
    </div>
  )
}

function SupplyOrderInvoiceExpandItem({
  index,
  invoice,
  order,
}: {
  index: number
  invoice: SupplyInvoice
  order: DirectSupplyOrder
}) {
  const { t } = useI18n()
  const row = mapInvoiceRow(order, invoice, index + 1)

  return (
    <div className="supply-invoices-expand-item">
      <div className="supply-invoice-main-cell">
        <span className="supply-invoice-icon" aria-hidden>
          <IconFileInvoice size={14} />
        </span>
        <div className="supply-invoice-copy">
          <div className="supply-invoice-main-line">
            <span className="supply-invoice-label">{t('Інвойс')}</span>
            <Tooltip label={displayValue(row.invoiceNumber)} disabled={!row.invoiceNumber} openDelay={350} withArrow>
              <span className="supply-invoice-number">{displayValue(row.invoiceNumber)}</span>
            </Tooltip>
          </div>
          <div className="supply-invoice-meta">
            <span>{t('Замовлення')} {displayValue(getDirectOrderDisplayNumber(order))}</span>
            <span>{displayValue(order.ClientAgreement?.Agreement?.Name)}</span>
          </div>
        </div>
      </div>
      <OrderDateInline value={row.invoiceDate} />
      <OrderMetricValue label="#" value={formatAmount(row.qty)} />
      <OrderMoneyCell currency={row.currency} value={row.grossPrice} />
      {placedBadge(row.isPlaced, t)}
    </div>
  )
}

function OrderDateInline({ value }: { value?: Date | string }) {
  return <span className="supply-invoice-date">{formatCompactDateTime(value)}</span>
}

function OrderMetaValue({ label, strong = false, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <span className={`supply-order-meta-value${strong ? ' is-strong' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  )
}

function OrderMetaLine({
  items,
}: {
  items: Array<{ label: string; strong?: boolean; value: string }>
}) {
  return (
    <div className="supply-order-main-meta">
      {items.map((item, index) => (
        <Fragment key={`${item.label}-${index}`}>
          {index > 0 ? <OrderMetaSeparator /> : null}
          <OrderMetaValue label={item.label} strong={item.strong} value={item.value} />
        </Fragment>
      ))}
    </div>
  )
}

function OrderMetaSeparator() {
  return <span className="supply-order-meta-separator" aria-hidden />
}

function OrdersFilterToolbar({
  canPrint,
  currencyOptions,
  filterDraft,
  isDownloading,
  isLoading,
  page,
  pageSize,
  totalPages,
  onChangePage,
  onChangePageSize,
  onDownload,
  onFilterDraftChange,
  onRefresh,
  onResetFilters,
}: {
  canPrint: boolean
  currencyOptions: Array<{ label: string, value: string }>
  filterDraft: SupplyUkraineOrdersFilter
  isDownloading: boolean
  isLoading: boolean
  page: number
  pageSize: number
  totalPages: number
  onChangePage: (page: number) => void
  onChangePageSize: (value: string | null) => void
  onDownload: () => void
  onFilterDraftChange: (patch: Partial<SupplyUkraineOrdersFilter>) => void
  onRefresh: () => void
  onResetFilters: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="app-filter-bar supply-ukraine-orders-filter-bar">
      <div className="supply-ukraine-orders-period-filter">
        <span className="supply-ukraine-orders-filter-label">{t('Період')}</span>
        <div className="supply-ukraine-orders-period-fields">
          <TextInput
            className="supply-ukraine-orders-date-input"
            aria-label={t('Від')}
            type="date"
            value={filterDraft.from}
            onChange={(event) => onFilterDraftChange({ from: event.currentTarget.value })}
          />
          <span className="supply-ukraine-orders-period-separator" />
          <TextInput
            className="supply-ukraine-orders-date-input"
            aria-label={t('До')}
            type="date"
            value={filterDraft.to}
            onChange={(event) => onFilterDraftChange({ to: event.currentTarget.value })}
          />
        </div>
      </div>
      <TextInput
        className="supply-ukraine-orders-search-input"
        leftSection={<IconSearch size={16} />}
        label={t('Постачальник')}
        placeholder={t('Назва постачальника')}
        value={filterDraft.supplier}
        onChange={(event) => onFilterDraftChange({ supplier: event.currentTarget.value })}
      />
      <Select
        clearable
        className="supply-ukraine-orders-currency-filter"
        data={currencyOptions}
        label={t('Валюта')}
        placeholder={t('Усі')}
        searchable
        value={filterDraft.currencyId || null}
        onChange={(value) => onFilterDraftChange({ currencyId: value || '' })}
      />
      <Select
        allowDeselect={false}
        className="supply-ukraine-orders-type-filter"
        data={TYPE_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
        label={t('Тип')}
        value={filterDraft.type}
        onChange={(value) => onFilterDraftChange({ type: (value as SupplyUkraineOrderKind) || 'all' })}
      />
      <div className="app-filter-actions">
        <Tooltip label={t('Скинути фільтри')}>
          <ActionIcon variant="light" color="gray" size={34} aria-label={t('Скинути фільтри')} onClick={onResetFilters}>
            <IconRestore size={17} />
          </ActionIcon>
        </Tooltip>
        {canPrint && (
          <Tooltip label={t('Завантажити')}>
            <ActionIcon variant="light" color="gray" size={34} aria-label={t('Завантажити')} loading={isDownloading} onClick={onDownload}>
              <IconDownload size={18} />
            </ActionIcon>
          </Tooltip>
        )}
        <Paginator
          isLoading={isLoading}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          onPageChange={onChangePage}
          onPageSizeChange={(nextPageSize) => onChangePageSize(String(nextPageSize))}
          onRefresh={onRefresh}
        />
      </div>
    </div>
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

function OrderIndexCell({ row }: { row: SupplyUkraineOrderRow }) {
  return (
    <span className={`supply-order-control-cell is-${row.kind}`}>
      <span className="supply-order-control-icon" aria-hidden>
        {getOrderKindIcon(row, 15)}
      </span>
    </span>
  )
}

function OrderActionsCell({
  canDelete,
  isExpanded,
  row,
  onDelete,
  onToggleDirectOrder,
}: {
  canDelete: boolean
  isExpanded: boolean
  row: SupplyUkraineOrderRow
  onDelete: (row: SupplyUkraineOrderRow) => void
  onToggleDirectOrder: (order: DirectSupplyOrder) => void
}) {
  const { t } = useI18n()
  const canToggleInvoices = row.kind === 'direct' && row.directOrder && (row.directOrder.SupplyInvoices?.length || 0) > 0

  return (
    <span className="supply-order-actions">
      {canToggleInvoices ? (
        <Tooltip label={isExpanded ? t('Згорнути інвойси') : t('Показати інвойси')}>
          <ActionIcon
            aria-label={t('Показати інвойси')}
            className="supply-order-action-button"
            size={30}
            variant="subtle"
            onClick={(event: MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation()
              onToggleDirectOrder(row.directOrder as DirectSupplyOrder)
            }}
          >
            {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </ActionIcon>
        </Tooltip>
      ) : (
        <span className="supply-order-action-placeholder" aria-hidden />
      )}
      {canDelete ? (
        <Tooltip label={t('Видалити')}>
          <ActionIcon
            aria-label={t('Видалити')}
            className="supply-order-action-button is-danger"
            color="red"
            size={30}
            variant="subtle"
            onClick={(event: MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation()
              onDelete(row)
            }}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Tooltip>
      ) : (
        <span className="supply-order-action-placeholder" aria-hidden />
      )}
    </span>
  )
}

function getOrderKindIcon(row: SupplyUkraineOrderRow, size = 15) {
  if (row.kind === 'invoice') {
    return <IconFileInvoice size={size} />
  }

  if (row.kind === 'direct') {
    return <IconFileSpreadsheet size={size} />
  }

  return <IconPackageImport size={size} />
}

function OrderMoneyCell({ currency, value }: { currency?: string; value?: number }) {
  return (
    <span className="supply-order-money-cell">
      <span className="supply-order-money-amount">{formatMoney(value)}</span>
      <span className="supply-order-money-currency">{displayValue(currency)}</span>
    </span>
  )
}

function OrderMetricValue({ label, value }: { label: string; value: string }) {
  return (
    <span className="supply-order-metric-value">
      <span className="supply-order-metric-label">{label}</span>
      <span className="supply-order-metric-number">{value}</span>
    </span>
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
  | { organizations: SupplyServiceOrganization[]; type: 'setOrganizations' }
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
    case 'setOrganizations':
      return { ...state, organizations: action.organizations }
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
  const [organizationSearch, setOrganizationSearch] = useState('')
  const [debouncedOrganizationSearch] = useDebouncedValue(
    organizationSearch,
    SUPPLY_ORGANIZATION_SEARCH_DEBOUNCE_MS,
  )
  const organizationsRef = useRef(organizations)

  useEffect(() => {
    organizationsRef.current = organizations
  }, [organizations])

  useEffect(() => {
    let cancelled = false

    async function loadDictionaries() {
      dispatch({ type: 'loadStart' })
      setOrganizationSearch('')

      try {
        const nextProducts = await getSupplyOrderServiceConsumableProducts('')

        if (!cancelled) {
          dispatch({
            organizations: addSelectedOrganization([], expense?.SupplyOrganization || null),
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

  useEffect(() => {
    const value = debouncedOrganizationSearch.trim()

    if (!value) {
      return
    }

    let cancelled = false

    async function loadOrganizations() {
      const selectedOrganization =
        organizationsRef.current.find((organization) => getEntityKey(organization) === form.serviceOrganizationKey) ||
        (getEntityKey(expense?.SupplyOrganization) === form.serviceOrganizationKey ? expense?.SupplyOrganization || null : null)

      try {
        const nextOrganizations = await searchSupplyOrderServiceOrganizations(value)

        if (!cancelled) {
          dispatch({
            organizations: addSelectedOrganization(nextOrganizations, selectedOrganization),
            type: 'setOrganizations',
          })
        }
      } catch (searchError) {
        if (!cancelled) {
          dispatch({
            error: searchError instanceof Error ? searchError.message : t('Не вдалося завантажити постачальників послуг'),
            type: 'setError',
          })
        }
      }
    }

    void loadOrganizations()

    return () => {
      cancelled = true
    }
  }, [debouncedOrganizationSearch, expense?.SupplyOrganization, form.serviceOrganizationKey, t])

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
            nothingFoundMessage={t('Нічого не знайдено')}
            searchable
            searchValue={organizationSearch}
            value={form.serviceOrganizationKey || null}
            onChange={(value) => {
              changeOrganization(value)
              setOrganizationSearch('')
            }}
            onSearchChange={setOrganizationSearch}
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
): SupplyUkraineOrderRow[] {
  const baseRows = [
    ...toUkraineOrders.map(mapToUkraineOrderRow),
    ...directOrders.map(mapDirectOrderRow),
  ].sort(compareRows)

  return baseRows.map((row, index) => ({ ...row, index: index + 1 }))
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
    agreement: order.ClientAgreement?.Agreement?.Name,
    currency: order.ClientAgreement?.Agreement?.Currency?.Code || order.ClientAgreement?.Agreement?.Currency?.Name,
    directOrder: order,
    grossPrice: isResident ? positiveNumber(invoice.TotalValueWithVat) : positiveNumber(invoice.TotalNetPrice),
    index,
    invoice,
    invoiceDate: invoice.DateFrom,
    invoiceNumber: invoice.Number,
    isPlaced: Boolean(invoice.IsFullyPlaced),
    kind: 'invoice',
    netUid: invoice.NetUid || `${order.NetUid || ''}-${invoice.Number || index}`,
    number: getDirectOrderDisplayNumber(order),
    orderDate: order.DateFrom,
    organization: order.Organization?.Name,
    qty: positiveNumber(invoice.TotalQuantity),
    responsible: getEntityName(order.Responsible),
    supplier: getEntityName(order.Client),
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
    return <OrderStatusTag tone="neutral">{t('Інвойс')}</OrderStatusTag>
  }

  if (row.kind === 'direct') {
    return <OrderStatusTag tone="info">{t('Замовлення')}</OrderStatusTag>
  }

  return <OrderStatusTag tone="accent">{t('Поставка')}</OrderStatusTag>
}

function placedBadge(value: boolean | undefined, t: (key: string) => string) {
  return value
    ? <OrderStatusTag tone="success">{t('Так')}</OrderStatusTag>
    : <OrderStatusTag tone="neutral">{t('Ні')}</OrderStatusTag>
}

function OrderStatusTag({
  children,
  tone,
}: {
  children: string
  tone: 'accent' | 'info' | 'neutral' | 'success'
}) {
  return <span className={`supply-order-status-tag is-${tone}`}>{children}</span>
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

function formatCompactDateTime(value?: Date | string): string {
  return formatDateTime(value).replace(', ', ' ')
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
