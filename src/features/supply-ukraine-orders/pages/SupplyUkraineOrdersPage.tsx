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
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Download, Eye, FileSpreadsheet, FileText, ListChecks, PackageCheck, PackageOpen, Plus, Receipt, ReceiptText, RotateCcw, Route, Search, Trash2 } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { realtimeEvents, useRealtimeEvent } from '../../../shared/realtime/events'
import { getSupplyUkraineOrderDisplayNumber, normalizeDisplayNumber } from '../../../shared/supplyUkraineOrderNumbers'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
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
import { DirectOrderProductIncomeStatus } from '../components/DirectOrderProductIncomeStatus'
import { canOpenDirectProductIncomeFromRow } from '../directOrderActions'
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
import { hasSupplyProForm } from '../proFormHelpers'
import '../../../shared/ui/console-table-page.css'
import './supply-ukraine-orders.css'

const FILTER_STORAGE_KEY = 'allOrdersUkraineFilter'
const DEFAULT_PAGE_SIZE = DEFAULT_PAGINATOR_PAGE_SIZE
const SUPPLY_ORGANIZATION_SEARCH_DEBOUNCE_MS = 300
const ORDERS_TABLE_MIN_WIDTH = 1280
const ORDER_INVOICES_TABLE_MIN_WIDTH = 760
const ORDERS_TABLE_DEFAULT_LAYOUT: DataTableDefaultLayout = {
  columnOrder: ['order', 'grossPrice', 'qty', 'additionalPercent', 'organization', 'responsible', 'isPlaced', 'kind'],
  columnSizing: {
    additionalPercent: 96,
    grossPrice: 132,
    isPlaced: 112,
    kind: 118,
    order: 420,
    organization: 260,
    qty: 104,
    responsible: 158,
  },
  density: 'normal',
}
const ORDER_INVOICES_TABLE_DEFAULT_LAYOUT: DataTableDefaultLayout = {
  columnOrder: ['invoice', 'invoiceDate', 'qty', 'grossPrice', 'isPlaced'],
  columnSizing: {
    grossPrice: 122,
    invoice: 320,
    invoiceDate: 124,
    isPlaced: 112,
    qty: 86,
  },
  density: 'normal',
}

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
        page: 1,
      }
    case 'resetFilters':
      return {
        ...state,
        activeFilters: action.filters,
        filterDraft: action.filters,
        page: 1,
      }
    case 'setPage':
      return { ...state, page: action.page }
    case 'setPageSize':
      return { ...state, page: 1, pageSize: action.pageSize }
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
    filterDraft,
    isDeleting,
    isDownloading,
    officialCostsRow,
    page,
    pageSize,
    selectedRow,
  } = uiState

  // Debounced supplier search: the «Постачальник» box filters as you type. After a short pause we
  // commit the typed name to the active filters (which re-fetches), so the search runs without the
  // user hunting for a refresh button. Enter still applies immediately.
  const [debouncedSupplier] = useDebouncedValue(filterDraft.supplier, 400)
  useEffect(() => {
    if (debouncedSupplier === activeFilters.supplier) {
      return
    }

    dispatchUi({ filters: { ...activeFilters, supplier: debouncedSupplier }, type: 'setActiveFilters' })
  }, [debouncedSupplier, activeFilters])

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

  // The Поставки/Замовлення type toggle applies immediately (unlike the range/text filters, which
  // apply on refresh): patch the draft AND commit it to active filters in one go so the list
  // re-fetches for the chosen kind right away.
  function applyTypeFilter(type: SupplyUkraineOrderKind) {
    dispatchUi({ patch: { type }, type: 'patchFilterDraft' })
    dispatchUi({ filters: { ...filterDraft, type }, type: 'setActiveFilters' })
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

  function openRow(row: SupplyUkraineOrderRow) {
    if (row.kind !== 'invoice') {
      dispatchUi({ row, type: 'setSelectedRow' })
    }
  }

  function navigateFromModal(path: string) {
    dispatchUi({ row: null, type: 'setSelectedRow' })

    if (path.startsWith('/orders/ukraine/placement/') || /^\/orders\/ukraine\/[^/]+\/product-income$/.test(path)) {
      navigate(path, { state: { backgroundLocation: location } })
      return
    }

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
    applyTypeFilter,
    refreshOrders,
    resetFilters,
    rows,
    selectedRow,
    state,
    totalPages,
    updateFilterDraft,
    canDeleteOrder,
    requestDelete: (row: SupplyUkraineOrderRow) => dispatchUi({ row, type: 'setDeleteCandidate' }),
  }
}

export function SupplyUkraineOrdersPage() {
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
    applyTypeFilter,
    refreshOrders,
    resetFilters,
    rows,
    selectedRow,
    state,
    totalPages,
    updateFilterDraft,
  } = useSupplyUkraineOrdersPageController()

  return (
    <Stack className="supply-ukraine-orders-page" gap={6}>
      <OrdersListCard
        canPrint={createPermissions.canPrint}
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
        totalPages={totalPages}
        onChangePage={changePage}
        onChangePageSize={changePageSize}
        onDownload={downloadPrintDocument}
        onApplyType={applyTypeFilter}
        onFilterDraftChange={updateFilterDraft}
        onCreateDirect={createDirect}
        onCreateToUkraine={createToUkraine}
        onRefresh={refreshOrders}
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
  canPrint,
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
  totalPages,
  onChangePage,
  onChangePageSize,
  onCreateDirect,
  onCreateToUkraine,
  onDownload,
  onApplyType,
  onFilterDraftChange,
  onRefresh,
  onResetFilters,
  onRowClick,
}: {
  canPrint: boolean
  createPermissions: { canCreateDirect: boolean; canCreateToUkraine: boolean }
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
  totalPages: number
  onChangePage: (page: number) => void
  onChangePageSize: (value: string | null) => void
  onCreateDirect: () => void
  onCreateToUkraine: () => void
  onDownload: () => void
  onApplyType: (type: SupplyUkraineOrderKind) => void
  onFilterDraftChange: (patch: Partial<SupplyUkraineOrdersFilter>) => void
  onRefresh: () => void
  onResetFilters: () => void
  onRowClick: (row: SupplyUkraineOrderRow) => void
}) {
  const { t } = useI18n()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const columns = useSupplyUkraineOrderColumns()

  return (
    <Card className="app-data-card supply-ukraine-orders-card" withBorder radius="md" padding={0}>
      <OrdersFilterToolbar
        canPrint={canPrint}
        createPermissions={createPermissions}
        currencyOptions={currencyOptions}
        filterDraft={filterDraft}
        isDownloading={isDownloading}
        isLoading={state.isLoading}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        onChangePage={onChangePage}
        onChangePageSize={onChangePageSize}
        onCreateDirect={onCreateDirect}
        onCreateToUkraine={onCreateToUkraine}
        onDownload={onDownload}
        onApplyType={onApplyType}
        onFilterDraftChange={onFilterDraftChange}
        onRefresh={onRefresh}
        onResetFilters={onResetFilters}
        onTableToolbarSlotMount={setTableToolbarSlot}
      />

      {currenciesError && (
        <Alert className="console-table-alert" color="yellow" icon={<CircleAlert size={18} />} variant="light">
          {currenciesError}
        </Alert>
      )}

      {(orderError || filterError) && (
        <Alert className="console-table-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
          {filterError || orderError}
        </Alert>
      )}

      <div className="supply-ukraine-orders-table">
        <SupplyUkraineOrdersRoster
          emptyText={t('Замовлень не знайдено')}
          isLoading={state.isLoading}
          loadingText={t('Завантаження замовлень')}
          rows={rows}
          tableToolbarSlot={tableToolbarSlot}
          columns={columns}
          onRowClick={onRowClick}
        />
      </div>
    </Card>
  )
}

function useSupplyUkraineOrderColumns(): DataTableColumn<SupplyUkraineOrderRow>[] {
  const { t } = useI18n()

  return useMemo(
    () => [
      {
        accessor: (row) => [row.supplier, row.number, row.invoiceNumber].filter(Boolean).join(' '),
        cell: (row) => <OrderMainGridCell row={row} />,
        fill: true,
        header: t('Замовлення / постачальник'),
        id: 'order',
        minWidth: 360,
        width: 420,
      },
      {
        accessor: (row) => row.grossPrice ?? null,
        align: 'right',
        cell: (row) => <OrderMoneyCell currency={row.currency} value={row.grossPrice} />,
        header: t('Сума'),
        id: 'grossPrice',
        minWidth: 112,
        width: 132,
      },
      {
        accessor: (row) => row.qty ?? null,
        cell: (row) => (
          <div className="supply-order-metric-cell is-qty">
            <OrderMetricValue label="#" value={formatAmountCell(row.qty)} />
          </div>
        ),
        header: t('К-сть'),
        id: 'qty',
        minWidth: 92,
        width: 104,
      },
      {
        accessor: (row) => row.additionalPercent ?? null,
        align: 'right',
        cell: (row) => (
          <div className="supply-order-metric-cell is-percent">
            <OrderMetricValue label="%" value={formatAmountCell(row.additionalPercent)} />
          </div>
        ),
        header: t('% дод.'),
        id: 'additionalPercent',
        minWidth: 88,
        width: 96,
      },
      {
        accessor: (row) => [row.organization, row.agreement].filter(Boolean).join(' '),
        cell: (row) => <OrderOrganizationGridCell row={row} />,
        header: t('Організація / договір'),
        id: 'organization',
        minWidth: 220,
        width: 260,
      },
      {
        accessor: (row) => row.responsible ?? '',
        cell: (row) => <OrderResponsibleGridCell value={displayTableValue(row.responsible)} />,
        header: t('Відповідальний'),
        id: 'responsible',
        minWidth: 150,
        width: 158,
      },
      {
        accessor: (row) => (row.isPlaced ? 1 : 0),
        align: 'center',
        cell: (row) => <OrderPlacedCell value={row.isPlaced} />,
        header: t('Розміщено'),
        id: 'isPlaced',
        minWidth: 104,
        width: 112,
      },
      {
        accessor: (row) => row.kind,
        align: 'center',
        cell: (row) => <OrderKindCell row={row} />,
        header: t('Тип'),
        id: 'kind',
        minWidth: 110,
        width: 118,
      },
    ],
    [t],
  )
}

function SupplyUkraineOrdersRoster({
  columns,
  emptyText,
  isLoading,
  loadingText,
  rows,
  tableToolbarSlot,
  onRowClick,
}: {
  columns: DataTableColumn<SupplyUkraineOrderRow>[]
  emptyText: string
  isLoading: boolean
  loadingText: string
  rows: SupplyUkraineOrderRow[]
  tableToolbarSlot: HTMLDivElement | null
  onRowClick: (row: SupplyUkraineOrderRow) => void
}) {
  const { t } = useI18n()

  return (
    <DataTable
      columns={columns}
      data={rows}
      defaultLayout={ORDERS_TABLE_DEFAULT_LAYOUT}
      emptyText={emptyText}
      expandColumnLabels={{ collapseRow: t('Згорнути'), expandRow: t('Розгорнути') }}
      getRowCanExpand={(row) => row.kind === 'direct' && (row.directOrder?.SupplyInvoices?.length ?? 0) > 0}
      getRowId={getSupplyOrderRosterRowId}
      height="100%"
      isLoading={isLoading}
      layoutVersion="supply-ukraine-orders-table-1"
      loadingText={loadingText}
      minWidth={ORDERS_TABLE_MIN_WIDTH}
      renderExpandedRow={(row) => row.directOrder ? <SupplyOrderInvoicesExpand order={row.directOrder} /> : null}
      rowClassName={(row) => `supply-orders-table-row is-${row.kind}`}
      showLayoutControls
      tableId="supply-ukraine-orders"
      toolbarPortalTarget={tableToolbarSlot}
      onRowClick={onRowClick}
    />
  )
}

function useSupplyOrderInvoiceColumns(): DataTableColumn<SupplyUkraineOrderRow>[] {
  const { t } = useI18n()

  return useMemo(
    () => [
      {
        accessor: (row) => [row.invoiceNumber, row.number, row.agreement].filter(Boolean).join(' '),
        cell: (row) => <InvoiceMainCell row={row} />,
        fill: true,
        header: t('Інвойс'),
        id: 'invoice',
        minWidth: 300,
        width: 320,
      },
      {
        accessor: (row) => toTimestamp(row.invoiceDate),
        align: 'right',
        cell: (row) => {
          const label = formatCompactDateTimeCell(row.invoiceDate)

          return <span className="supply-invoice-date" title={nativeTitle(label)}>{label}</span>
        },
        header: t('Дата'),
        id: 'invoiceDate',
        minWidth: 112,
        width: 124,
      },
      {
        accessor: (row) => row.qty ?? null,
        align: 'right',
        cell: (row) => <OrderMetricValue label="#" value={formatAmountCell(row.qty)} />,
        header: t('К-сть'),
        id: 'qty',
        minWidth: 78,
        width: 86,
      },
      {
        accessor: (row) => row.grossPrice ?? null,
        align: 'right',
        cell: (row) => <OrderMoneyCell currency={row.currency} value={row.grossPrice} />,
        header: t('Сума'),
        id: 'grossPrice',
        minWidth: 112,
        width: 122,
      },
      {
        accessor: (row) => (row.isPlaced ? 1 : 0),
        align: 'center',
        cell: (row) => <OrderPlacedCell value={row.isPlaced} />,
        header: t('Розміщено'),
        id: 'isPlaced',
        minWidth: 104,
        width: 112,
      },
    ],
    [t],
  )
}

function getSupplyOrderRosterRowId(row: SupplyUkraineOrderRow, index: number): string {
  return String(row.netUid || `${row.kind}-${row.number || ''}-${index}`)
}

function OrderMainGridCell({ row }: { row: SupplyUkraineOrderRow }) {
  const { t } = useI18n()
  const supplier = displayTableValue(row.supplier)

  return (
    <div className="supply-order-main-cell">
      <div className="supply-order-main-body">
        <div className="supply-order-main-title-row">
          <span className="supply-order-main-title" title={nativeTitle(supplier)}>{supplier}</span>
        </div>
        <OrderMetaLine
          items={[
            { label: '№', value: displayTableValue(row.number), strong: true },
            { label: t('ств.'), value: formatCompactDateTimeCell(row.createdDate) },
            { label: t('від'), value: formatCompactDateTimeCell(row.orderDate) },
            { label: t('інв.'), value: displayTableValue(row.invoiceNumber) },
            { label: t('дата інв.'), value: formatCompactDateTimeCell(row.invoiceDate) },
          ]}
        />
      </div>
    </div>
  )
}

function OrderOrganizationGridCell({ row }: { row: SupplyUkraineOrderRow }) {
  const organization = displayTableValue(row.organization)
  const agreement = displayTableValue(row.agreement)

  return (
    <span className="supply-order-two-line-cell">
      <span className="supply-order-two-line-primary" title={nativeTitle(organization)}>{organization}</span>
      <span className="supply-order-two-line-secondary" title={nativeTitle(agreement)}>{agreement}</span>
    </span>
  )
}

function OrderResponsibleGridCell({ value }: { value: string }) {
  return (
    <span className="supply-order-responsible-cell" title={nativeTitle(value)}>{value}</span>
  )
}

function SupplyOrderInvoicesExpand({ order }: { order: DirectSupplyOrder }) {
  const { t } = useI18n()
  const columns = useSupplyOrderInvoiceColumns()
  const rows = useMemo(
    () => (order.SupplyInvoices || []).map((invoice, index) => mapInvoiceRow(order, invoice, index + 1)),
    [order],
  )

  return (
    <div className="supply-invoices-expand">
      <DataTable
        columns={columns}
        data={rows}
        defaultLayout={ORDER_INVOICES_TABLE_DEFAULT_LAYOUT}
        emptyText={t('Інвойсів не знайдено')}
        getRowId={getSupplyOrderRosterRowId}
        layoutVersion="supply-order-invoices-table-1"
        minWidth={ORDER_INVOICES_TABLE_MIN_WIDTH}
        showDensityToggle={false}
        showLayoutControls={false}
        tableId="supply-order-invoices"
      />
    </div>
  )
}

function InvoiceMainCell({ row }: { row: SupplyUkraineOrderRow }) {
  const { t } = useI18n()
  const invoiceNumber = displayTableValue(row.invoiceNumber)
  const orderNumber = displayTableValue(row.number)
  const agreement = displayTableValue(row.agreement)

  return (
    <div className="supply-invoice-main-cell">
      <span className="supply-invoice-icon" aria-hidden>
        <ReceiptText size={14} />
      </span>
      <div className="supply-invoice-copy">
        <div className="supply-invoice-main-line">
          <span className="supply-invoice-label">{t('Інвойс')}</span>
          <span className="supply-invoice-number" title={nativeTitle(invoiceNumber)}>{invoiceNumber}</span>
        </div>
        <div className="supply-invoice-meta">
          <span className="supply-order-meta-value is-strong" title={nativeTitle(orderNumber)}>
            <span>{t('Замовлення')}</span>
            <strong>{orderNumber}</strong>
          </span>
          {agreement ? (
            <span className="app-role-pill is-gray supply-invoice-agreement-pill" title={nativeTitle(agreement)}>
              {agreement}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
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
        <Fragment key={item.label}>
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
  createPermissions,
  currencyOptions,
  filterDraft,
  isDownloading,
  isLoading,
  page,
  pageSize,
  totalPages,
  onChangePage,
  onChangePageSize,
  onCreateDirect,
  onCreateToUkraine,
  onDownload,
  onApplyType,
  onFilterDraftChange,
  onRefresh,
  onResetFilters,
  onTableToolbarSlotMount,
}: {
  canPrint: boolean
  createPermissions: { canCreateDirect: boolean; canCreateToUkraine: boolean }
  currencyOptions: Array<{ label: string, value: string }>
  filterDraft: SupplyUkraineOrdersFilter
  isDownloading: boolean
  isLoading: boolean
  page: number
  pageSize: number
  totalPages: number
  onChangePage: (page: number) => void
  onChangePageSize: (value: string | null) => void
  onCreateDirect: () => void
  onCreateToUkraine: () => void
  onDownload: () => void
  onApplyType: (type: SupplyUkraineOrderKind) => void
  onFilterDraftChange: (patch: Partial<SupplyUkraineOrdersFilter>) => void
  onRefresh: () => void
  onResetFilters: () => void
  onTableToolbarSlotMount: (node: HTMLDivElement | null) => void
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
        leftSection={<Search size={16} />}
        label={t('Постачальник')}
        placeholder={t('Назва постачальника')}
        value={filterDraft.supplier}
        onChange={(event) => onFilterDraftChange({ supplier: event.currentTarget.value })}
        onKeyDown={(event) => {
          // Text filters apply on refresh; a search box should also run on Enter, otherwise
          // typing a supplier name does nothing until the user finds the refresh button.
          if (event.key === 'Enter') {
            event.preventDefault()
            onRefresh()
          }
        }}
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
        onChange={(value) => onApplyType((value as SupplyUkraineOrderKind) || 'all')}
      />
      <div className="app-filter-actions">
        <Tooltip label={t('Скинути фільтри')}>
          <ActionIcon variant="light" color="gray" size={34} aria-label={t('Скинути фільтри')} onClick={onResetFilters}>
            <RotateCcw size={17} />
          </ActionIcon>
        </Tooltip>
        {canPrint && (
          <Tooltip label={t('Завантажити')}>
            <ActionIcon variant="light" color="gray" size={34} aria-label={t('Завантажити')} loading={isDownloading} onClick={onDownload}>
              <Download size={18} />
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
      <div ref={onTableToolbarSlotMount} className="supply-ukraine-orders-table-toolbar-slot" />
      <div className="supply-ukraine-orders-create-actions">
        {createPermissions.canCreateDirect && (
          <Button color={CREATE_ACTION_COLOR} size="sm" leftSection={<Plus size={16} />} onClick={onCreateDirect}>
            {t('Нове замовлення')}
          </Button>
        )}
        {createPermissions.canCreateToUkraine && (
          <Button color={CREATE_ACTION_COLOR} size="sm" leftSection={<Plus size={16} />} variant="outline" onClick={onCreateToUkraine}>
            {t('Поставка')}
          </Button>
        )}
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
            <Button color="red" leftSection={<Trash2 size={16} />} loading={isDeleting} onClick={onConfirmDelete}>
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
  const directHasProForma = hasSupplyProForm(row?.directOrder)

  return (
    <AppModal
      centered
      size={496}
      opened={Boolean(row)}
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{getRowTitle(row)}</span>}
      onClose={onClose}
    >
      {row && (
        <Stack className="app-modal-actions" gap="xs">
          {row.kind === 'direct' && row.netUid && (
            <DirectOrderProductIncomeStatus key={`direct:${row.netUid}`} compact orderNetId={row.netUid} />
          )}

          {row.kind === 'toUkraine' && row.netUid && (
            <DirectOrderProductIncomeStatus
              key={`toUkraine:${row.netUid}`}
              compact
              orderNetId={row.netUid}
              source="toUkraine"
            />
          )}

          {row.kind === 'toUkraine' && canOpenToUkrainePlacement && row.netUid && (
            <OrderActionButton
              icon={<PackageCheck size={20} color="var(--mantine-color-gray-7)" />}
              label={t('Оприходування')}
              onClick={() => onNavigate(`/orders/ukraine/placement/${row.netUid}`)}
            />
          )}

          {row.kind === 'toUkraine' && canOpenToUkrainePlacement && row.netUid && (
            <OrderActionButton
              icon={<PackageOpen size={20} color="var(--mantine-color-gray-7)" />}
              label={t('Документ оприходування')}
              onClick={() => onNavigate(`/orders/ukraine/${row.netUid}/product-income`)}
            />
          )}

          {row.kind === 'toUkraine' && canOpenToUkraineView && row.netUid && (
            <OrderActionButton
              icon={<Eye size={20} color="var(--mantine-color-gray-7)" />}
              label={t('Огляд')}
              onClick={() => onNavigate(`/orders/ukraine/view/${row.netUid}`)}
            />
          )}

          {row.kind === 'toUkraine' && canOpenToUkraineProtocols && row.netUid && (
            <OrderActionButton
              icon={<ReceiptText size={20} color="var(--mantine-color-gray-7)" />}
              label={t('Протоколи оплат')}
              onClick={() => onNavigate(`/orders/ukraine/protocols/${row.netUid}`)}
            />
          )}

          {row.kind === 'toUkraine' && canOpenToUkraineOfficialCosts && row.order && (
            <OrderActionButton
              icon={<Receipt size={20} color="var(--mantine-color-gray-7)" />}
              label={getOfficialCostsActionLabel(row.order, t)}
              onClick={() => onOpenOfficialCosts(row)}
            />
          )}

          {row.kind === 'direct' && canOpenDirectLogistics && row.netUid && (
            <OrderActionButton
              icon={<Route size={20} color="var(--mantine-color-gray-7)" />}
              label={t('Логістика')}
              onClick={() => onNavigate(`/orders/ukraine/all/edit/${row.netUid}`)}
            />
          )}

          {row.kind === 'direct' && canOpenDirectInvoices && directHasProForma && row.netUid && (
            <OrderActionButton
              icon={<FileText size={20} color="var(--mantine-color-gray-7)" />}
              label={t('Інвойси і пак листи')}
              onClick={() => onNavigate(`/orders/ukraine/all/edit/${row.netUid}/supply-invoices`)}
            />
          )}

          {row.kind === 'direct' && canOpenDirectSpecifications && directHasProForma && row.netUid && (
            <OrderActionButton
              icon={<ListChecks size={20} color="var(--mantine-color-gray-7)" />}
              label={t('Специфікації')}
              onClick={() => onNavigate(`/orders/ukraine/all/edit/${row.netUid}/specifications`)}
            />
          )}

          {canOpenDirectProductIncomeFromRow(row, canOpenDirectProductIncome) && (
            <OrderActionButton
              icon={<PackageCheck size={20} color="var(--mantine-color-gray-7)" />}
              label={t('Оприходування')}
              onClick={() => onNavigate(`/orders/ukraine/all/edit/${row.netUid}/product-income`)}
            />
          )}
        </Stack>
      )}
    </AppModal>
  )
}

/* Row-actions popup entry per docs/ui-patterns.md §7.1. */
function OrderActionButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <Button
      fullWidth
      justify="flex-start"
      color="dark"
      size="md"
      leftSection={<span className="app-action-icon">{icon}</span>}
      variant="subtle"
      onClick={onClick}
    >
      {label}
    </Button>
  )
}

function OrderMoneyCell({ currency, value }: { currency?: string; value?: number }) {
  const amount = formatMoneyCell(value)
  const currencyLabel = displayTableValue(currency)

  return (
    <span className="supply-order-money-cell">
      <span className="supply-order-money-amount" title={nativeTitle(amount)}>{amount}</span>
      <span className="supply-order-money-currency" title={nativeTitle(currencyLabel)}>{currencyLabel}</span>
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

function OrderPlacedCell({ value }: { value?: boolean }) {
  const { t } = useI18n()

  return <span className="supply-order-status-cell">{placedBadge(value, t)}</span>
}

function OrderKindCell({ row }: { row: SupplyUkraineOrderRow }) {
  const { t } = useI18n()

  return <span className="supply-order-status-cell">{getKindBadge(row, t)}</span>
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
    <AppModal
      centered
      classNames={{
        body: 'supply-orders-official-costs-body',
        content: 'supply-orders-official-costs-content',
        header: 'supply-orders-official-costs-header',
      }}
      opened={Boolean(row)}
      size={1120}
      title={<span className="supply-orders-official-costs-title">{t('Офіційні витрати доставки')}</span>}
      onClose={onClose}
    >
      <Stack className="supply-orders-official-costs" gap="md">
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <Card className="app-section-card supply-orders-official-costs-card" withBorder radius="md" padding="md">
          <Stack gap="md">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Дані витрат')}
            </Text>

            <SimpleGrid className="supply-orders-official-costs-grid" cols={{ base: 1, md: 2 }} spacing="md">
              <Select
                className="supply-orders-official-costs-field is-mono"
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
                className="supply-orders-official-costs-field is-mono"
                data={agreementOptions}
                disabled={isLoading || isSaving || !selectedOrganization}
                label={t('Договір')}
                searchable
                value={form.serviceAgreementKey || null}
                onChange={(value) => updateForm({ serviceAgreementKey: value || '' })}
              />
              <Select
                className="supply-orders-official-costs-field is-mono"
                data={productOptions}
                disabled={isLoading || isSaving}
                label={t('Тип')}
                searchable
                value={form.consumableProductKey || null}
                onChange={(value) => updateForm({ consumableProductKey: value || '' })}
              />
              <TextInput
                className="supply-orders-official-costs-field is-mono"
                disabled={isSaving}
                label={t('Номер інвойса')}
                value={form.invoiceNumber}
                onChange={(event) => updateForm({ invoiceNumber: event.currentTarget.value })}
              />
              <NumberInput
                className="supply-orders-official-costs-field is-mono"
                disabled={isSaving}
                label={t('Вартість брутто')}
                min={0}
                value={form.grossAmount}
                onChange={(value) => updateForm({ grossAmount: toNonNegativeNumber(value) })}
              />
              <NumberInput
                className="supply-orders-official-costs-field is-mono"
                disabled={isSaving}
                label={t('ПДВ %')}
                min={0}
                value={form.vatPercent}
                onChange={(value) => updateForm({ vatPercent: toNonNegativeNumber(value) })}
              />
              <NumberInput
                className="supply-orders-official-costs-field is-mono"
                disabled={isSaving}
                label={t('Бух. вартість брутто')}
                min={0}
                value={form.accountingGrossAmount}
                onChange={(value) => updateForm({ accountingGrossAmount: toNonNegativeNumber(value) })}
              />
              <NumberInput
                className="supply-orders-official-costs-field is-mono"
                disabled={isSaving}
                label={t('Бух. ПДВ %')}
                min={0}
                value={form.accountingVatPercent}
                onChange={(value) => updateForm({ accountingVatPercent: toNonNegativeNumber(value) })}
              />
              <TextInput
                className="supply-orders-official-costs-field is-mono"
                disabled={isSaving}
                label={t('Дата')}
                type="datetime-local"
                value={form.fromDate}
                onChange={(event) => updateForm({ fromDate: event.currentTarget.value })}
              />
              <FileInput
                clearable
                multiple
                className="supply-orders-official-costs-field"
                disabled={isSaving || Boolean(expense?.Id)}
                label={t('Акти надання послуг')}
                value={form.actDocuments}
                onChange={(files) => updateForm({ actDocuments: files })}
              />
            </SimpleGrid>
          </Stack>
        </Card>

        <Group className="supply-orders-official-costs-footer" justify="flex-end" gap="sm">
          <Button className="supply-orders-official-costs-cancel" disabled={isSaving} variant="subtle" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button
            className="supply-orders-official-costs-save"
            color={CREATE_ACTION_COLOR}
            leftSection={<Receipt size={16} />}
            loading={isSaving}
            onClick={saveOfficialCosts}
          >
            {t('Зберегти')}
          </Button>
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
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">{error}</Alert>
        ) : document?.DocumentURL || document?.PdfDocumentURL ? (
          <Group>
            {document.DocumentURL && (
              <Anchor href={getDocumentHref(document.DocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                <Group gap={6}><FileSpreadsheet size={16} /> XLS</Group>
              </Anchor>
            )}
            {document.PdfDocumentURL && (
              <Anchor href={getDocumentHref(document.PdfDocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                <Group gap={6}><FileText size={16} /> PDF</Group>
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
    isPlaced: Boolean(order.IsFullyPlaced || order.IsPlaced),
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
  const className = [
    'app-role-pill',
    tone === 'accent' ? 'is-orange' : '',
    tone === 'neutral' ? 'is-gray' : '',
    tone === 'success' ? 'is-green' : '',
  ].filter(Boolean).join(' ')

  return (
    <Badge className={className} size="sm" variant="light">
      {children}
    </Badge>
  )
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

function displayTableValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  return String(value)
}

function nativeTitle(value: string): string | undefined {
  return value ? value : undefined
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

function formatCompactDateTimeCell(value?: Date | string): string {
  const formatted = formatCompactDateTime(value)

  return formatted === '-' ? '' : formatted
}

function formatAmountCell(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? amountFormatter.format(value) : ''
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '-'
}

function formatMoneyCell(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : ''
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
