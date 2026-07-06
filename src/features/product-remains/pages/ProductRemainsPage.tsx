import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { AppModal } from "../../../shared/ui/AppModal"
import {
  IconAlertCircle,
  IconArrowsExchange,
  IconChevronDown,
  IconDownload,
  IconFileTypePdf,
  IconFileTypeXls,
  IconRefresh,
  IconRestore,
  IconSearch,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import {
  exportGroupedProductRemains,
  exportProductRemains,
  getGroupedProductRemains,
  getProductRemainMovements,
  getProductRemainStorages,
  getProductRemainSuppliers,
  getProductRemains,
} from '../api/productRemainsApi'
import type {
  CollectionWithTotals,
  GroupedConsignment,
  GroupedConsignmentItem,
  ProductRemainMovement,
  ProductRemainStorage,
  ProductRemainSupplier,
  ProductRemainsExportDocument,
  RemainingConsignment,
} from '../types'
import {
  displayValue,
  formatAmount,
  formatDate,
  formatDateTime,
  formatMoney,
  getProductName,
  getSupplierDisplayName,
  getVendorCode,
} from '../utils'
import './product-remains-page.css'

type ProductRemainsTab = 'batches' | 'products'

const ALL_STORAGES_VALUE = '__all_storages__'
const LOCAL_CURRENCY_CODE = 'UAH'
const PAGE_SIZE = 25
const pageSizeOptions = ['25', '50', '100']

const BATCHES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['fromDate', 'productIncomeNumber'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const PRODUCTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'vendorCode', 'productName'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const PRODUCT_REMAIN_MOVEMENTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['incomeDocumentNumber', 'documentType'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const BATCH_DETAILS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['vendorCode', 'productName'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

function getProductRemainsInitialTab(routeTab: string | undefined): ProductRemainsTab {
  return routeTab === 'products' ? 'products' : 'batches'
}

function useProductRemainsPageModel() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { tab: routeTab } = useParams()
  const [activeTab, setActiveTab] = useValueState<ProductRemainsTab>(() => getProductRemainsInitialTab(routeTab))
  const [storages, setStorages] = useValueState<ProductRemainStorage[]>([])
  const [selectedStorageValue, setSelectedStorageValue] = useValueState(ALL_STORAGES_VALUE)
  const [supplierOptions, setSupplierOptions] = useValueState<ProductRemainSupplier[]>([])
  const [supplierSearch, setSupplierSearch] = useValueState('')
  const [supplierNetId, setSupplierNetId] = useValueState<string | null>(null)
  const [dateFrom, setDateFrom] = useValueState(getDefaultDateFrom)
  const [dateTo, setDateTo] = useValueState(getDefaultDateTo)
  const [productSearchDraft, setProductSearchDraft] = useValueState('')
  const [productSearchValue, setProductSearchValue] = useValueState('')
  const [pageSize, setPageSize] = useValueState(PAGE_SIZE)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [isLoadingStorages, setLoadingStorages] = useValueState(true)
  const [isLoadingSuppliers, setLoadingSuppliers] = useValueState(false)
  const [storageResourceError, setStorageResourceError] = useValueState<string | null>(null)
  const [supplierResourceError, setSupplierResourceError] = useValueState<string | null>(null)

  const [batchRows, setBatchRows] = useValueState<GroupedConsignment[]>([])
  const [batchTotals, setBatchTotals] = useValueState<CollectionWithTotals<GroupedConsignment> | null>(null)
  const [batchOffset, setBatchOffset] = useReducer((_offset: number, nextOffset: number) => nextOffset, 0)
  const [batchHasMore, setBatchHasMore] = useValueState(true)
  const [batchError, setBatchError] = useValueState<string | null>(null)
  const [isLoadingBatches, setLoadingBatches] = useValueState(false)
  const [selectedBatch, setSelectedBatch] = useValueState<GroupedConsignment | null>(null)

  const [productRows, setProductRows] = useValueState<RemainingConsignment[]>([])
  const [productTotals, setProductTotals] = useValueState<CollectionWithTotals<RemainingConsignment> | null>(null)
  const [productOffset, setProductOffset] = useReducer((_offset: number, nextOffset: number) => nextOffset, 0)
  const [productHasMore, setProductHasMore] = useValueState(true)
  const [productError, setProductError] = useValueState<string | null>(null)
  const [isLoadingProducts, setLoadingProducts] = useValueState(false)
  const [selectedMovementRow, setSelectedMovementRow] = useValueState<RemainingConsignment | null>(null)

  const [downloadDocument, setDownloadDocument] = useValueState<ProductRemainsExportDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [exportingTab, setExportingTab] = useValueState<ProductRemainsTab | null>(null)

  const filterError = getFilterError(dateFrom, dateTo)
  const isAllStoragesSelected = selectedStorageValue === ALL_STORAGES_VALUE
  const storageNetId = isAllStoragesSelected ? undefined : selectedStorageValue.trim() || undefined
  const productStorageNetId = storageNetId
  const isProductStorageSelectionInvalid = !productStorageNetId
  const productStorageError = isProductStorageSelectionInvalid ? t('Оберіть склад для перегляду товарів') : null
  const selectedSupplierNetId = supplierNetId || undefined
  const exportScopeKey = [
    activeTab,
    dateFrom,
    dateTo,
    storageNetId || '',
    selectedSupplierNetId || '',
    productSearchValue,
  ].join('|')
  const exportScopeKeyRef = useRef(exportScopeKey)
  const exportRequestRef = useRef(0)
  const resourceError = storageResourceError || supplierResourceError
  const storageOptions = useMemo(() => buildStorageOptions(storages), [storages])
  const storageSelectValue = selectedStorageValue || null
  const supplierSelectOptions = useMemo(() => buildSupplierOptions(supplierOptions), [supplierOptions])
  const batchColumns = useProductRemainBatchColumns()
  const productColumns = useProductRemainProductColumns(openMovement)
  const { density: batchDensity, toggleDensity: toggleBatchDensity } = useDataTableDensity(
    'product-remains-batches',
    BATCHES_TABLE_DEFAULT_LAYOUT.density,
  )
  const { density: productDensity, toggleDensity: toggleProductDensity } = useDataTableDensity(
    'product-remains-products',
    PRODUCTS_TABLE_DEFAULT_LAYOUT.density,
  )
  const batchToolbarLeft = useMemo(() => <TableStatus totals={batchTotals} />, [batchTotals])
  const productToolbarLeft = useMemo(
    () => <TableStatus searchValue={productSearchValue} totals={productTotals} />,
    [productSearchValue, productTotals],
  )

  useEffect(() => {
    const nextActiveTab = getProductRemainsInitialTab(routeTab)

    setActiveTab((currentTab) => (currentTab === nextActiveTab ? currentTab : nextActiveTab))
    setSelectedBatch(null)
    setSelectedMovementRow(null)
  }, [routeTab, setActiveTab, setSelectedBatch, setSelectedMovementRow])

  const resetBatchesForInvalidFilter = useCallback(() => {
    setBatchRows([])
    setBatchTotals(null)
    setLoadingBatches(false)
  }, [setBatchRows, setBatchTotals, setLoadingBatches])
  const resetProductsForInvalidFilter = useCallback(() => {
    setProductRows([])
    setProductTotals(null)
    setProductHasMore(false)
    setLoadingProducts(false)
  }, [setLoadingProducts, setProductHasMore, setProductRows, setProductTotals])

  useEffect(() => {
    exportScopeKeyRef.current = exportScopeKey
  }, [exportScopeKey])
  const batchDetailColumns = useProductRemainBatchDetailColumns()
  const activeError = activeTab === 'batches' ? batchError : productStorageError || productError
  const isActiveLoading = activeTab === 'batches' ? isLoadingBatches : isLoadingProducts

  useProductRemainResourcesLoader({
    reloadKey,
    setLoadingStorages,
    setLoadingSuppliers,
    setStorageResourceError,
    setStorages,
    setSupplierResourceError,
    setSupplierOptions,
    supplierSearch,
  })
  useProductRemainBatchesLoader({
    batchOffset,
    dateFrom,
    dateTo,
    filterError,
    pageSize,
    reloadKey,
    resetBatchesForInvalidFilter,
    selectedSupplierNetId,
    setBatchError,
    setBatchHasMore,
    setBatchRows,
    setBatchTotals,
    setLoadingBatches,
    storageNetId,
  })
  useProductRemainProductsLoader({
    dateFrom,
    dateTo,
    filterError,
    pageSize,
    productOffset,
    productSearchValue,
    reloadKey,
    resetProductsForInvalidFilter,
    isStorageSelectionInvalid: isProductStorageSelectionInvalid,
    selectedSupplierNetId,
    setLoadingProducts,
    setProductError,
    setProductHasMore,
    setProductRows,
    setProductTotals,
    storageNetId,
  })

  function resetBatchData() {
    setBatchRows([])
    setBatchTotals(null)
    setBatchOffset(0)
    setBatchHasMore(true)
    setSelectedBatch(null)
  }

  function resetProductData() {
    setProductRows([])
    setProductTotals(null)
    setProductOffset(0)
    setProductHasMore(true)
    setSelectedMovementRow(null)
  }

  function resetAllData() {
    resetBatchData()
    resetProductData()
  }

  function updateProductSearch(nextValue: string) {
    resetProductData()
    setProductSearchDraft(nextValue)
    setProductSearchValue(nextValue.trim())
  }

  function resetFilters() {
    setDateFrom(getDefaultDateFrom())
    setDateTo(getDefaultDateTo())
    setSelectedStorageValue(ALL_STORAGES_VALUE)
    setSupplierNetId(null)
    setSupplierSearch('')
    setProductSearchDraft('')
    setProductSearchValue('')
    resetAllData()
    reload()
  }

  function refreshData() {
    resetAllData()
    reload()
  }

  function selectActiveTab(nextTab: ProductRemainsTab) {
    setSelectedBatch(null)
    setSelectedMovementRow(null)
    setActiveTab(nextTab)
    navigate(`/products/storages/incomes/${nextTab}`, { replace: true })
  }

  function openMovement(row: RemainingConsignment) {
    if (!row.ConsignmentItemNetId) {
      return
    }

    setSelectedMovementRow(row)
  }

  async function handleExport() {
    if (exportingTab || filterError || (activeTab === 'products' && isProductStorageSelectionInvalid)) {
      return
    }

    const requestId = exportRequestRef.current + 1
    exportRequestRef.current = requestId
    const requestKey = exportScopeKeyRef.current
    const isLatestExport = () => exportRequestRef.current === requestId
    const isCurrentExport = () => isLatestExport() && exportScopeKeyRef.current === requestKey
    const tabToExport = activeTab
    setExportingTab(tabToExport)
    setBatchError(null)
    setProductError(null)

    try {
      let document: ProductRemainsExportDocument

      if (tabToExport === 'batches') {
        document = await exportGroupedProductRemains({
          from: dateFrom,
          storageNetId,
          supplierNetId: selectedSupplierNetId,
          to: dateTo,
        })
      } else {
        if (!productStorageNetId) {
          return
        }

        document = await exportCurrentProductRemains({
          from: dateFrom,
          productSearchValue,
          selectedSupplierNetId,
          storageNetId: productStorageNetId,
          to: dateTo,
        })
      }

      if (isCurrentExport()) {
        setDownloadDocument(document)
        setDownloadModalOpened(true)
      }
    } catch (exportError) {
      if (!isCurrentExport()) {
        return
      }

      const message = exportError instanceof Error ? exportError.message : t('Не вдалося сформувати експорт залишків')

      if (tabToExport === 'batches') {
        setBatchError(message)
      } else {
        setProductError(message)
      }
    } finally {
      if (isLatestExport()) {
        setExportingTab(null)
      }
    }
  }

  return {
    activeError, activeTab, batchColumns, batchDensity, batchDetailColumns, batchHasMore, batchRows, batchToolbarLeft, batchTotals,
    dateFrom, dateTo, downloadDocument, downloadModalOpened, exportingTab, filterError, isActiveLoading,
    isProductStorageSelectionInvalid,
    isLoadingBatches, isLoadingProducts, isLoadingStorages, isLoadingSuppliers, openMovement, pageSize, productColumns,
    productDensity, productHasMore, productRows, productSearchDraft, productStorageError, productToolbarLeft, productTotals, resourceError,
    selectedBatch, selectedMovementRow, selectedStorageValue: storageSelectValue, selectedSupplierNetId, storageNetId, storageOptions, supplierNetId,
    supplierSearch, supplierSelectOptions, handleExport, refreshData, resetAllData, resetFilters, selectActiveTab,
    toggleBatchDensity, toggleProductDensity, setBatchOffset, setDateFrom, setDateTo, setDownloadModalOpened, setPageSize,
    setProductOffset, setSelectedBatch, setSelectedMovementRow, setSelectedStorageValue,
    setSupplierNetId, setSupplierSearch, updateProductSearch,
  }
}

type ValueSetter<T> = (value: T | ((current: T) => T)) => void

function useProductRemainResourcesLoader({
  reloadKey,
  setLoadingStorages,
  setLoadingSuppliers,
  setStorageResourceError,
  setStorages,
  setSupplierResourceError,
  setSupplierOptions,
  supplierSearch,
}: {
  reloadKey: number
  setLoadingStorages: (value: boolean) => void
  setLoadingSuppliers: (value: boolean) => void
  setStorageResourceError: (value: string | null) => void
  setStorages: (value: ProductRemainStorage[]) => void
  setSupplierResourceError: (value: string | null) => void
  setSupplierOptions: (value: ProductRemainSupplier[]) => void
  supplierSearch: string
}) {
  const { t } = useI18n()

  useEffect(() => {
    let cancelled = false

    async function loadStorages() {
      setLoadingStorages(true)
      setStorageResourceError(null)

      try {
        const nextStorages = await getProductRemainStorages()

        if (!cancelled) {
          setStorages(nextStorages)
        }
      } catch (loadError) {
        if (!cancelled) {
          setStorages([])
          setStorageResourceError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити склади'))
        }
      } finally {
        if (!cancelled) {
          setLoadingStorages(false)
        }
      }
    }

    void loadStorages()

    return () => {
      cancelled = true
    }
  }, [reloadKey, setLoadingStorages, setStorageResourceError, setStorages, t])

  useEffect(() => {
    const controller = new AbortController()

    async function loadSuppliers() {
      setLoadingSuppliers(true)
      setSupplierResourceError(null)

      try {
        const nextSuppliers = await getProductRemainSuppliers(
          {
            limit: 20,
            offset: 0,
            value: supplierSearch,
          },
          controller.signal,
        )

        if (!controller.signal.aborted) {
          setSupplierOptions(nextSuppliers)
          setSupplierResourceError(null)
        }
      } catch (loadError) {
        if (!controller.signal.aborted && !isAbortError(loadError)) {
          setSupplierOptions([])
          setSupplierResourceError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити постачальників'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingSuppliers(false)
        }
      }
    }

    void loadSuppliers()

    return () => {
      controller.abort()
    }
  }, [reloadKey, setLoadingSuppliers, setSupplierResourceError, setSupplierOptions, supplierSearch, t])
}

function useProductRemainBatchesLoader({
  batchOffset,
  dateFrom,
  dateTo,
  filterError,
  pageSize,
  reloadKey,
  resetBatchesForInvalidFilter,
  selectedSupplierNetId,
  setBatchError,
  setBatchHasMore,
  setBatchRows,
  setBatchTotals,
  setLoadingBatches,
  storageNetId,
}: {
  batchOffset: number
  dateFrom: string
  dateTo: string
  filterError: string | null
  pageSize: number
  reloadKey: number
  resetBatchesForInvalidFilter: () => void
  selectedSupplierNetId?: string
  setBatchError: (value: string | null) => void
  setBatchHasMore: (value: boolean) => void
  setBatchRows: ValueSetter<GroupedConsignment[]>
  setBatchTotals: (value: CollectionWithTotals<GroupedConsignment> | null) => void
  setLoadingBatches: (value: boolean) => void
  storageNetId?: string
}) {
  const { t } = useI18n()

  useEffect(() => {
    if (filterError) {
      resetBatchesForInvalidFilter()
      return
    }

    let cancelled = false
    const currentOffset = batchOffset

    async function loadBatches() {
      setLoadingBatches(true)
      setBatchError(null)

      try {
        const response = await getGroupedProductRemains({
          from: dateFrom,
          includeItems: false,
          limit: pageSize,
          offset: currentOffset,
          storageNetId,
          supplierNetId: selectedSupplierNetId,
          to: dateTo,
        })

        if (!cancelled) {
          setBatchRows((currentRows) => (currentOffset > 0 ? currentRows.concat(response.Collection) : response.Collection))
          setBatchTotals(response)
          setBatchHasMore(hasMoreCollectionPage(currentOffset, response, pageSize))
        }
      } catch (loadError) {
        if (!cancelled) {
          if (currentOffset === 0) {
            setBatchRows([])
            setBatchTotals(null)
          }

          setBatchHasMore(false)
          setBatchError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити залишки за партіями'))
        }
      } finally {
        if (!cancelled) {
          setLoadingBatches(false)
        }
      }
    }

    void loadBatches()

    return () => {
      cancelled = true
    }
  }, [batchOffset, dateFrom, dateTo, filterError, pageSize, reloadKey, resetBatchesForInvalidFilter, selectedSupplierNetId, setBatchError, setBatchHasMore, setBatchRows, setBatchTotals, setLoadingBatches, storageNetId, t])
}

function useProductRemainProductsLoader({
  dateFrom,
  dateTo,
  filterError,
  pageSize,
  productOffset,
  productSearchValue,
  reloadKey,
  resetProductsForInvalidFilter,
  isStorageSelectionInvalid,
  selectedSupplierNetId,
  setLoadingProducts,
  setProductError,
  setProductHasMore,
  setProductRows,
  setProductTotals,
  storageNetId,
}: {
  dateFrom: string
  dateTo: string
  filterError: string | null
  pageSize: number
  productOffset: number
  productSearchValue: string
  reloadKey: number
  resetProductsForInvalidFilter: () => void
  isStorageSelectionInvalid: boolean
  selectedSupplierNetId?: string
  setLoadingProducts: (value: boolean) => void
  setProductError: (value: string | null) => void
  setProductHasMore: (value: boolean) => void
  setProductRows: ValueSetter<RemainingConsignment[]>
  setProductTotals: (value: CollectionWithTotals<RemainingConsignment> | null) => void
  storageNetId?: string
}) {
  const { t } = useI18n()

  useEffect(() => {
    if (filterError || isStorageSelectionInvalid) {
      resetProductsForInvalidFilter()
      return
    }

    let cancelled = false
    const currentOffset = productOffset
    const productStorageNetId = storageNetId?.trim()

    if (!productStorageNetId) {
      resetProductsForInvalidFilter()
      return
    }

    const concreteProductStorageNetId = productStorageNetId

    async function loadProducts() {
      setLoadingProducts(true)
      setProductError(null)

      try {
        const response = await getProductRemains({
          from: dateFrom,
          limit: pageSize,
          offset: currentOffset,
          searchValue: productSearchValue,
          storageNetId: concreteProductStorageNetId,
          supplierNetId: selectedSupplierNetId,
          to: dateTo,
        })

        if (!cancelled) {
          setProductRows((currentRows) => {
            const previousRows = currentOffset > 0 ? currentRows : []
            const combinedRows = previousRows.concat(response.Collection)
            return combinedRows.map((row, index) => ({ ...row, RowNumber: index + 1 }))
          })
          setProductTotals(response)
          setProductHasMore(hasMoreCollectionPage(currentOffset, response, pageSize))
        }
      } catch (loadError) {
        if (!cancelled) {
          if (currentOffset === 0) {
            setProductRows([])
            setProductTotals(null)
          }

          setProductHasMore(false)
          setProductError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити залишки за товарами'))
        }
      } finally {
        if (!cancelled) {
          setLoadingProducts(false)
        }
      }
    }

    void loadProducts()

    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, filterError, isStorageSelectionInvalid, pageSize, productOffset, productSearchValue, reloadKey, resetProductsForInvalidFilter, selectedSupplierNetId, setLoadingProducts, setProductError, setProductHasMore, setProductRows, setProductTotals, storageNetId, t])
}

function hasMoreCollectionPage<TItem>(
  offset: number,
  response: CollectionWithTotals<TItem>,
  pageSize: number,
): boolean {
  const totalRowsQty = response.TotalRowsQtyFiltered ?? response.TotalRowsQty

  if (typeof totalRowsQty === 'number') {
    return offset + response.Collection.length < totalRowsQty
  }

  return response.Collection.length === pageSize
}

export function ProductRemainsPage() {
  const model = useProductRemainsPageModel()

  return <ProductRemainsPageView model={model} />
}

function ProductRemainsPageView({ model }: { model: ReturnType<typeof useProductRemainsPageModel> }) {
  const { t } = useI18n()
  const {
    activeError, activeTab, batchColumns, batchDensity, batchDetailColumns, batchHasMore, batchRows, batchToolbarLeft, batchTotals,
    dateFrom, dateTo, downloadDocument, downloadModalOpened, exportingTab, filterError, isActiveLoading,
    isProductStorageSelectionInvalid,
    isLoadingBatches, isLoadingProducts, isLoadingStorages, isLoadingSuppliers, openMovement, pageSize, productColumns,
    productDensity, productHasMore, productRows, productSearchDraft, productStorageError, productToolbarLeft, productTotals, resourceError,
    selectedBatch, selectedMovementRow, selectedStorageValue, selectedSupplierNetId, storageNetId, storageOptions, supplierNetId,
    supplierSearch, supplierSelectOptions, handleExport, refreshData, resetAllData, resetFilters, selectActiveTab,
    toggleBatchDensity, toggleProductDensity, setBatchOffset, setDateFrom, setDateTo, setDownloadModalOpened, setPageSize,
    setProductOffset, setSelectedBatch, setSelectedMovementRow, setSelectedStorageValue,
    setSupplierNetId, setSupplierSearch, updateProductSearch,
  } = model
  const alertMessage = filterError || resourceError || activeError
  const isWarningAlert = Boolean(filterError || (!resourceError && activeTab === 'products' && productStorageError))

  return (
    <Stack gap="md">
      <Card className="app-data-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar product-remains-filter-bar">
          <div className="product-remains-filter-row">
            <div className="product-remains-toolbar-tabs pill-tabs">
              {([
                { value: 'batches', label: t('Партії') },
                { value: 'products', label: t('Товари') },
              ] as const).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={`pill-tab${activeTab === tab.value ? ' is-active' : ''}`}
                  aria-pressed={activeTab === tab.value}
                  onClick={() => {
                    selectActiveTab(tab.value)
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <Select
              searchable
              allowDeselect={false}
              data={storageOptions}
              disabled={isLoadingStorages}
              label={t('Склад')}
              value={selectedStorageValue}
              onChange={(value) => {
                resetAllData()
                setSelectedStorageValue(value || ALL_STORAGES_VALUE)
              }}
            />
            <TextInput
              label={t('З')}
              type="date"
              value={dateFrom}
              onChange={(event) => {
                resetAllData()
                setDateFrom(event.currentTarget.value)
              }}
            />
            <TextInput
              label={t('По')}
              type="date"
              value={dateTo}
              onChange={(event) => {
                resetAllData()
                setDateTo(event.currentTarget.value)
              }}
            />
            <Select
              clearable
              searchable
              data={supplierSelectOptions}
              label={t('Постачальник')}
              loading={isLoadingSuppliers}
              placeholder={t('Всі постачальники')}
              searchValue={supplierSearch}
              value={supplierNetId}
              onChange={(value) => {
                resetAllData()
                setSupplierNetId(value)
              }}
              onSearchChange={setSupplierSearch}
            />
            <Select
              allowDeselect={false}
              data={pageSizeOptions}
              label={t('Ліміт')}
              value={String(pageSize)}
              onChange={(value) => {
                resetAllData()
                setPageSize(Number(value || PAGE_SIZE))
              }}
            />
            <div className="app-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={resetFilters}>
                  <IconRestore size={17} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Експорт')}>
                <ActionIcon
                  aria-label={t('Експорт')}
                  color="gray"
                  disabled={Boolean(exportingTab || filterError || (activeTab === 'products' && isProductStorageSelectionInvalid))}
                  loading={exportingTab === activeTab}
                  size={34}
                  variant="light"
                  onClick={handleExport}
                >
                  <IconDownload size={17} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Оновити')}>
                <ActionIcon
                  aria-label={t('Оновити')}
                  color="gray"
                  loading={isActiveLoading || isLoadingStorages}
                  size={34}
                  variant="light"
                  onClick={refreshData}
                >
                  <IconRefresh size={17} />
                </ActionIcon>
              </Tooltip>
              <DataTableDensityToggle
                density={activeTab === 'batches' ? batchDensity : productDensity}
                onToggle={activeTab === 'batches' ? toggleBatchDensity : toggleProductDensity}
                size={34}
              />
            </div>
          </div>
        </div>

        <Stack className="product-remains-body" gap={10}>
          {alertMessage && (
            <Alert color={isWarningAlert ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
              {alertMessage}
            </Alert>
          )}

          <Box>
            {activeTab === 'batches' && (
              <Box>
              <Stack gap="md">
                <DataTable
                  columns={batchColumns}
                  data={batchRows}
                  defaultLayout={BATCHES_TABLE_DEFAULT_LAYOUT}
                  density={batchDensity}
                  emptyText={t('Залишків за партіями не знайдено')}
                  getRowId={getBatchRowId}
                  isLoading={isLoadingBatches}
                  layoutVersion="product-remains-batches-table-1"
                  loadingText={t('Завантаження залишків за партіями')}
                  maxHeight="calc(100vh - 390px)"
                  minWidth={1390}
                  tableId="product-remains-batches"
                  toolbarLeft={batchToolbarLeft}
                  onRowClick={setSelectedBatch}
                />
                <TableFooter
                  canLoadMore={batchHasMore && !filterError}
                  isLoading={isLoadingBatches}
                  loaded={batchRows.length}
                  onLoadMore={() => setBatchOffset(batchRows.length)}
                />
                <RemainsTotalsFooter kind="batches" totals={batchTotals} />
              </Stack>
              </Box>
            )}

            {activeTab === 'products' && (
              <Box>
              <Stack gap="md">
                <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
                  <TextInput
                    leftSection={<IconSearch size={16} />}
                    label={t('Пошук товару')}
                    placeholder={t('Код або назва')}
                    value={productSearchDraft}
                    style={{ flex: '1 1 260px' }}
                    onChange={(event) => updateProductSearch(event.currentTarget.value)}
                  />
                </Group>

                <DataTable
                  columns={productColumns}
                  data={productRows}
                  defaultLayout={PRODUCTS_TABLE_DEFAULT_LAYOUT}
                  density={productDensity}
                  emptyText={isProductStorageSelectionInvalid ? t('Оберіть склад для перегляду товарів') : t('Залишків за товарами не знайдено')}
                  getRowId={getProductRowId}
                  isLoading={isLoadingProducts}
                  layoutVersion="product-remains-products-table-1"
                  loadingText={t('Завантаження залишків за товарами')}
                  maxHeight="calc(100vh - 450px)"
                  minWidth={1600}
                  tableId="product-remains-products"
                  toolbarLeft={productToolbarLeft}
                  onRowClick={openMovement}
                />
                <TableFooter
                  canLoadMore={productHasMore && !filterError && !isProductStorageSelectionInvalid}
                  isLoading={isLoadingProducts}
                  loaded={productRows.length}
                  onLoadMore={() => setProductOffset(productRows.length)}
                />
                <RemainsTotalsFooter kind="products" totals={productTotals} />
              </Stack>
              </Box>
            )}
          </Box>
        </Stack>
      </Card>

      <AppDrawer
        opened={Boolean(selectedBatch)}
        position="right"
        size="80vw"
        title={t('Деталі партії')}
        onClose={() => setSelectedBatch(null)}
      >
        {selectedBatch && (
          <BatchDetails
            key={getBatchRowId(selectedBatch, 0)}
            batch={selectedBatch}
            columns={batchDetailColumns}
            dateFrom={dateFrom}
            dateTo={dateTo}
            storageNetId={storageNetId}
            supplierNetId={selectedSupplierNetId}
          />
        )}
      </AppDrawer>

      <AppDrawer
        opened={Boolean(selectedMovementRow)}
        position="right"
        size="90vw"
        title={selectedMovementRow ? `${t('Рух товару')}: ${getVendorCode(selectedMovementRow.Product)}` : t('Рух товару')}
        onClose={() => setSelectedMovementRow(null)}
      >
        {selectedMovementRow && (
          <ProductRemainMovementsPanel
            key={getProductRowId(selectedMovementRow, 0)}
            row={selectedMovementRow}
          />
        )}
      </AppDrawer>

      <AppModal centered opened={downloadModalOpened} title={t('Експорт залишків')} onClose={() => setDownloadModalOpened(false)}>
        <Stack gap="sm">
          {downloadDocument?.DocumentURL || downloadDocument?.PdfDocumentURL ? (
            <>
              {downloadDocument.DocumentURL && (
                <Anchor
                  href={upgradeHttpToHttps(downloadDocument.DocumentURL)}
                  target="_blank"
                  rel="noreferrer"
                  className="document-link"
                >
                  <span className="document-link-badge document-link-badge-excel">
                    <IconFileTypeXls size={22} stroke={1.8} />
                  </span>
                  <span>{t('Excel документ')}</span>
                </Anchor>
              )}
              {downloadDocument.PdfDocumentURL && (
                <Anchor
                  href={upgradeHttpToHttps(downloadDocument.PdfDocumentURL)}
                  target="_blank"
                  rel="noreferrer"
                  className="document-link"
                >
                  <span className="document-link-badge document-link-badge-pdf">
                    <IconFileTypePdf size={22} stroke={1.8} />
                  </span>
                  <span>{t('PDF документ')}</span>
                </Anchor>
              )}
            </>
          ) : (
            <Text c="dimmed" size="sm">
              {t('Документ недоступний для завантаження')}
            </Text>
          )}
        </Stack>
      </AppModal>
    </Stack>
  )
}

function exportCurrentProductRemains({
  from,
  productSearchValue,
  selectedSupplierNetId,
  storageNetId,
  to,
}: {
  from: string
  productSearchValue: string
  selectedSupplierNetId?: string
  storageNetId: string
  to: string
}): Promise<ProductRemainsExportDocument> {
  return exportProductRemains({
    from,
    searchValue: productSearchValue,
    storageNetId,
    supplierNetId: selectedSupplierNetId,
    to,
  })
}

function useProductRemainBatchColumns() {
  return useMemo<DataTableColumn<GroupedConsignment>[]>(
    () => [
    {
      id: 'fromDate',
      header: 'Дата',
      width: 126,
      minWidth: 112,
      accessor: (batch) => batch.FromDate,
      cell: (batch) => formatDateTime(batch.FromDate),
    },
    {
      id: 'productIncomeNumber',
      header: 'Номер приходу',
      width: 170,
      minWidth: 140,
      accessor: (batch) => batch.ProductIncomeNumber,
      cell: (batch) => displayValue(batch.ProductIncomeNumber),
    },
    {
      id: 'invoiceNumber',
      header: 'Інвойс',
      width: 160,
      minWidth: 132,
      accessor: (batch) => batch.InvoiceNumber,
      cell: (batch) => displayValue(batch.InvoiceNumber),
    },
    {
      id: 'supplierName',
      header: 'Постачальник',
      width: 260,
      minWidth: 190,
      accessor: (batch) => batch.SupplierName,
      cell: (batch) => (
        <Text fw={600} lineClamp={2}>
          {displayValue(batch.SupplierName)}
        </Text>
      ),
    },
    {
      id: 'organizationName',
      header: 'Організація',
      width: 240,
      minWidth: 180,
      accessor: (batch) => batch.OrganizationName,
      cell: (batch) => displayValue(batch.OrganizationName),
    },
    {
      id: 'totalGrossPrice',
      header: 'Сума gross',
      width: 140,
      minWidth: 120,
      align: 'right',
      accessor: (batch) => batch.TotalGrossPrice,
      cell: (batch) => formatMoney(batch.TotalGrossPrice),
    },
    {
      id: 'accountingTotalGrossPrice',
      header: 'Облік gross',
      width: 140,
      minWidth: 120,
      align: 'right',
      accessor: (batch) => batch.AccountingTotalGrossPrice,
      cell: (batch) => formatMoney(batch.AccountingTotalGrossPrice),
    },
    {
      id: 'totalWeight',
      header: 'Вага',
      width: 120,
      minWidth: 100,
      align: 'right',
      accessor: (batch) => batch.TotalWeight,
      cell: (batch) => formatAmount(batch.TotalWeight),
    },
    {
      id: 'items',
      header: 'Позиції',
      width: 100,
      minWidth: 92,
      align: 'right',
      accessor: (batch) => getBatchItemsCount(batch),
      cell: (batch) => formatAmount(getBatchItemsCount(batch)),
    },
    ],
    [],
  )
}

function useProductRemainProductColumns(onOpenMovement: (row: RemainingConsignment) => void) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<RemainingConsignment>[]>(
    () => [
    {
      id: 'index',
      header: '#',
      width: 64,
      minWidth: 56,
      align: 'right',
      accessor: (row) => row.RowNumber,
      cell: (row) => displayValue(row.RowNumber),
    },
    {
      id: 'fromDate',
      header: 'Дата',
      width: 126,
      minWidth: 112,
      accessor: (row) => row.FromDate,
      cell: (row) => formatDateTime(row.FromDate),
    },
    {
      id: 'vendorCode',
      header: 'Код товару',
      width: 160,
      minWidth: 132,
      accessor: (row) => getVendorCode(row.Product),
      cell: (row) => <Text fw={700}>{getVendorCode(row.Product)}</Text>,
    },
    {
      id: 'productName',
      header: 'Товар',
      width: 320,
      minWidth: 240,
      accessor: (row) => getProductName(row.Product),
      cell: (row) => (
        <Text fw={600} lineClamp={2}>
          {getProductName(row.Product)}
        </Text>
      ),
    },
    {
      id: 'supplier',
      header: 'Постачальник',
      width: 240,
      minWidth: 180,
      accessor: (row) => row.SupplierName,
      cell: (row) => displayValue(row.SupplierName),
    },
    {
      id: 'remainingQty',
      header: 'Кількість',
      width: 112,
      minWidth: 96,
      align: 'right',
      accessor: (row) => row.RemainingQty,
      cell: (row) => formatAmount(row.RemainingQty),
    },
    {
      id: 'netPrice',
      header: 'Вартість нетто',
      width: 124,
      minWidth: 108,
      align: 'right',
      accessor: (row) => row.NetPrice,
      cell: (row) => formatMoney(row.NetPrice),
    },
    {
      id: 'grossPrice',
      header: 'Вартість брутто',
      width: 124,
      minWidth: 108,
      align: 'right',
      accessor: (row) => row.GrossPrice,
      cell: (row) => formatMoney(row.GrossPrice),
    },
    {
      id: 'accountingGrossPrice',
      header: 'Вартість брутто (Бух.)',
      width: 136,
      minWidth: 116,
      align: 'right',
      accessor: (row) => row.AccountingGrossPrice,
      cell: (row) => formatMoney(row.AccountingGrossPrice),
    },
    {
      id: 'currency',
      header: 'Валюта',
      width: 104,
      minWidth: 92,
      accessor: (row) => row.CurrencyName,
      cell: (row) => displayValue(row.CurrencyName),
    },
    {
      id: 'weight',
      header: 'Вага',
      width: 112,
      minWidth: 96,
      align: 'right',
      accessor: (row) => row.Weight,
      cell: (row) => formatAmount(row.Weight),
    },
    {
      id: 'storage',
      header: 'Склад',
      width: 220,
      minWidth: 170,
      accessor: (row) => row.StorageName,
      cell: (row) => displayValue(row.StorageName),
    },
    {
      id: 'actions',
      header: '',
      width: 72,
      minWidth: 64,
      enableSorting: false,
      cell: (row) => (
        <Tooltip label={row.ConsignmentItemNetId ? t('Рух товару') : t('Немає ConsignmentItemNetId')}>
          <ActionIcon
            aria-label={t('Рух товару')}
            color="gray"
            disabled={!row.ConsignmentItemNetId}
            size="sm"
            variant="subtle"
            onClick={(event) => {
              event.stopPropagation()
              onOpenMovement(row)
            }}
          >
            <IconArrowsExchange size={16} />
          </ActionIcon>
        </Tooltip>
      ),
    },
    ],
    [onOpenMovement, t],
  )
}

function useProductRemainBatchDetailColumns() {
  return useMemo<DataTableColumn<GroupedConsignmentItem>[]>(
    () => [
    {
      id: 'vendorCode',
      header: 'Код товару',
      width: 160,
      minWidth: 132,
      accessor: (item) => getVendorCode(item.Product),
      cell: (item) => <Text fw={700}>{getVendorCode(item.Product)}</Text>,
    },
    {
      id: 'productName',
      header: 'Товар',
      width: 300,
      minWidth: 220,
      accessor: (item) => getProductName(item.Product),
      cell: (item) => (
        <Text fw={600} lineClamp={2}>
          {getProductName(item.Product)}
        </Text>
      ),
    },
    {
      id: 'fromDate',
      header: 'Дата',
      width: 124,
      minWidth: 108,
      accessor: (item) => item.FromDate,
      cell: (item) => formatDateTime(item.FromDate),
    },
    {
      id: 'remainingQty',
      header: 'Кількість',
      width: 112,
      minWidth: 96,
      align: 'right',
      accessor: (item) => item.RemainingQty,
      cell: (item) => formatAmount(item.RemainingQty),
    },
    {
      id: 'grossPrice',
      header: 'Вартість брутто',
      width: 124,
      minWidth: 108,
      align: 'right',
      accessor: (item) => item.GrossPrice,
      cell: (item) => formatMoney(item.GrossPrice),
    },
    {
      id: 'accountingGrossPrice',
      header: 'Вартість брутто (Бух.)',
      width: 136,
      minWidth: 116,
      align: 'right',
      accessor: (item) => item.AccountingGrossPrice,
      cell: (item) => formatMoney(item.AccountingGrossPrice),
    },
    {
      id: 'weight',
      header: 'Вага',
      width: 112,
      minWidth: 96,
      align: 'right',
      accessor: (item) => item.Weight,
      cell: (item) => formatAmount(item.Weight),
    },
    ],
    [],
  )
}

function TableStatus<TItem>({
  searchValue,
  totals,
}: {
  searchValue?: string
  totals: CollectionWithTotals<TItem> | null
}) {
  const { t } = useI18n()

  return (
    <Group gap="md">
      {searchValue && (
        <Text size="xs" c="dimmed">
          {t('пошук')}: {searchValue}
        </Text>
      )}
      {totals && (
        <>
          <Text size="xs" c="dimmed">
            {t('Усього')}: {formatAmount(totals.TotalQty)}
          </Text>
          <Text size="xs" c="dimmed">
            {t('Період')}: {formatAmount(totals.TotalQtyFiltered)}
          </Text>
          <Text size="xs" c="dimmed">
            {t('Сума за період')}: {formatMoney(totals.TotalAmountFiltered)}
          </Text>
        </>
      )}
    </Group>
  )
}

function TableFooter({
  canLoadMore,
  isLoading,
  loaded,
  onLoadMore,
}: {
  canLoadMore: boolean
  isLoading: boolean
  loaded: number
  onLoadMore: () => void
}) {
  const { t } = useI18n()

  return (
    <Group justify="flex-end" gap="sm">
      <Button
        color="gray"
        disabled={!canLoadMore || isLoading}
        leftSection={<IconChevronDown size={16} />}
        loading={isLoading && loaded > 0}
        variant="light"
        onClick={onLoadMore}
      >
        {t('Завантажити ще')}
      </Button>
    </Group>
  )
}

function TotalEntry({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text size="sm" fw={600}>
        {value}
      </Text>
    </Box>
  )
}

function RemainsTotalsFooter<TItem>({ totals, kind }: { totals: CollectionWithTotals<TItem> | null; kind: ProductRemainsTab }) {
  const { t } = useI18n()

  if (!totals) {
    return null
  }

  const generalLabel = t('Загальна')
  const periodLabel = t('За вибраний період')
  const accountingShort = t('Бух.')

  return (
    <Box>
      <Divider mb="sm" />
      <Text fw={700} size="sm" mb="xs">
        {t('Сума')}
      </Text>
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }} spacing="sm">
        <TotalEntry label={t('Загальна к-сть')} value={formatAmount(totals.TotalQty)} />
        <TotalEntry label={`${generalLabel} (EUR)`} value={formatMoney(totals.TotalAmount)} />
        <TotalEntry label={`${generalLabel} (EUR, ${accountingShort})`} value={formatMoney(totals.AccountingTotalAmount)} />
        <TotalEntry label={`${generalLabel} (${LOCAL_CURRENCY_CODE})`} value={formatMoney(totals.TotalAmountLocal)} />
        <TotalEntry label={`${generalLabel} (${LOCAL_CURRENCY_CODE}, ${accountingShort})`} value={formatMoney(totals.AccountingTotalAmountLocal)} />
        <TotalEntry label={t('К-сть за вибраний період')} value={formatAmount(totals.TotalQtyFiltered)} />
        <TotalEntry label={`${periodLabel} (EUR)`} value={formatMoney(totals.TotalAmountFiltered)} />
        <TotalEntry label={`${periodLabel} (EUR, ${accountingShort})`} value={formatMoney(totals.AccountingTotalAmountFiltered)} />
        {kind === 'batches' && (
          <TotalEntry label={`${periodLabel} (${LOCAL_CURRENCY_CODE})`} value={formatMoney(totals.TotalAmountLocalFiltered)} />
        )}
        <TotalEntry label={`${periodLabel} (${LOCAL_CURRENCY_CODE}, ${accountingShort})`} value={formatMoney(totals.AccountingTotalAmountLocalFiltered)} />
      </SimpleGrid>
    </Box>
  )
}

function BatchDetails({
  batch,
  columns,
  dateFrom,
  dateTo,
  storageNetId,
  supplierNetId,
}: {
  batch: GroupedConsignment
  columns: DataTableColumn<GroupedConsignmentItem>[]
  dateFrom: string
  dateTo: string
  storageNetId?: string
  supplierNetId?: string
}) {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(batchDetailsReducer, batch, createInitialBatchDetailsState)
  const { detailBatch, error, isLoading } = state
  const visibleBatch = detailBatch || batch
  const items = detailBatch?.GroupedConsignmentItems || []

  useEffect(() => {
    if (batch.GroupedConsignmentItems?.length) {
      return
    }

    let cancelled = false

    async function loadBatchDetails() {
      dispatch({ type: 'loadStarted' })

      try {
        const rowOffset = Math.max(0, (batch.RowNumber || 1) - 1)
        const response = await getGroupedProductRemains({
          from: dateFrom,
          includeItems: true,
          limit: 1,
          offset: rowOffset,
          storageNetId,
          supplierNetId,
          to: dateTo,
        })
        const loadedBatch = response.Collection[0]

        if (!cancelled) {
          dispatch({
            batch: loadedBatch ? { ...batch, ...loadedBatch } : { ...batch, GroupedConsignmentItems: [] },
            type: 'loadSucceeded',
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatch({
            batch: { ...batch, GroupedConsignmentItems: [] },
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити позиції партії'),
            type: 'loadFailed',
          })
        }
      }
    }

    void loadBatchDetails()

    return () => {
      cancelled = true
    }
  }, [batch, dateFrom, dateTo, storageNetId, supplierNetId, t])

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <DetailItem label="Дата" value={formatDate(visibleBatch.FromDate)} />
        <DetailItem label="Постачальник" value={displayValue(visibleBatch.SupplierName)} />
        <DetailItem label="Номер приходу" value={displayValue(visibleBatch.ProductIncomeNumber)} />
        <DetailItem label="Інвойс" value={displayValue(visibleBatch.InvoiceNumber)} />
        <DetailItem label="Організація" value={displayValue(visibleBatch.OrganizationName)} />
        <DetailItem label="Сума gross" value={formatMoney(visibleBatch.TotalGrossPrice)} />
        <DetailItem label="Облік gross" value={formatMoney(visibleBatch.AccountingTotalGrossPrice)} />
        <DetailItem label="Вага" value={formatAmount(visibleBatch.TotalWeight)} />
      </SimpleGrid>
      <Divider />
      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}
      {items.length || isLoading ? (
        <DataTable
          columns={columns}
          data={items}
          defaultLayout={BATCH_DETAILS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Позицій партії не знайдено')}
          getRowId={(item, index) => String(item.NetUid || item.Id || `${getVendorCode(item.Product)}-${index}`)}
          isLoading={isLoading}
          layoutVersion="product-remains-batch-details-table-1"
          loadingText={t('Завантаження позицій партії')}
          maxHeight="calc(100vh - 320px)"
          minWidth={1080}
          tableId="product-remains-batch-details"
        />
      ) : (
        <Text c="dimmed" size="sm">
          {t('У відповіді немає позицій партії')}
        </Text>
      )}
    </Stack>
  )
}

type BatchDetailsState = {
  detailBatch: GroupedConsignment | null
  error: string | null
  isLoading: boolean
}

type BatchDetailsAction =
  | { type: 'loadFailed'; batch: GroupedConsignment; error: string }
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; batch: GroupedConsignment }

function createInitialBatchDetailsState(batch: GroupedConsignment): BatchDetailsState {
  const hasItems = Boolean(batch.GroupedConsignmentItems?.length)

  return {
    detailBatch: hasItems ? batch : null,
    error: null,
    isLoading: !hasItems,
  }
}

function batchDetailsReducer(state: BatchDetailsState, action: BatchDetailsAction): BatchDetailsState {
  switch (action.type) {
    case 'loadFailed':
      return { detailBatch: action.batch, error: action.error, isLoading: false }
    case 'loadStarted':
      return { ...state, error: null, isLoading: true }
    case 'loadSucceeded':
      return { detailBatch: action.batch, error: null, isLoading: false }
  }
}

type ProductRemainMovementsState = {
  dateFrom: string
  dateTo: string
  error: string | null
  isLoading: boolean
  reloadKey: number
  rows: ProductRemainMovement[]
}

type ProductRemainMovementsAction =
  | { type: 'dateFromChanged'; value: string }
  | { type: 'dateToChanged'; value: string }
  | { type: 'loadFailed'; error: string }
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; rows: ProductRemainMovement[] }
  | { type: 'reloadRequested' }

function ProductRemainMovementsPanel({ row }: { row: RemainingConsignment }) {
  const { t } = useI18n()
  const consignmentItemNetId = row.ConsignmentItemNetId?.trim()
  const [state, dispatch] = useReducer(
    productRemainMovementsReducer,
    Boolean(consignmentItemNetId),
    createInitialProductRemainMovementsState,
  )
  const { dateFrom, dateTo, error, isLoading, reloadKey, rows } = state
  const columns = useProductRemainMovementColumns()
  const filterError = getFilterError(dateFrom, dateTo)
  const missingNetIdError = consignmentItemNetId ? null : t('У рядку немає ConsignmentItemNetId для завантаження руху')
  const activeError = missingNetIdError || filterError || error

  useEffect(() => {
    if (!consignmentItemNetId || filterError) {
      return
    }

    let cancelled = false
    const netId = consignmentItemNetId

    async function loadMovements() {
      dispatch({ type: 'loadStarted' })

      try {
        const nextRows = await getProductRemainMovements({
          consignmentItemNetId: netId,
          from: dateFrom,
          to: dateTo,
        })

        if (!cancelled) {
          dispatch({ rows: nextRows, type: 'loadSucceeded' })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatch({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити рух товару'),
            type: 'loadFailed',
          })
        }
      }
    }

    void loadMovements()

    return () => {
      cancelled = true
    }
  }, [consignmentItemNetId, dateFrom, dateTo, filterError, reloadKey, t])

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
        <DetailItem label="Код товару" value={getVendorCode(row.Product)} />
        <DetailItem label="Товар" value={getProductName(row.Product)} />
        <DetailItem label="Номер приходу" value={displayValue(row.ProductIncomeNumber)} />
        <DetailItem label="Склад" value={displayValue(row.StorageName)} />
      </SimpleGrid>
      <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
        <TextInput
          label={t('З')}
          type="date"
          value={dateFrom}
          w={150}
          onChange={(event) => dispatch({ type: 'dateFromChanged', value: event.currentTarget.value })}
        />
        <TextInput
          label={t('По')}
          type="date"
          value={dateTo}
          w={150}
          onChange={(event) => dispatch({ type: 'dateToChanged', value: event.currentTarget.value })}
        />
        <Button
          color="gray"
          disabled={Boolean(missingNetIdError || filterError)}
          leftSection={<IconRefresh size={18} />}
          loading={isLoading}
          variant="light"
          onClick={() => dispatch({ type: 'reloadRequested' })}
        >
          {t('Оновити')}
        </Button>
      </Group>
      {activeError && (
        <Alert color={missingNetIdError || filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
          {activeError}
        </Alert>
      )}
      {!activeError && (
        <DataTable
          columns={columns}
          data={rows}
          defaultLayout={PRODUCT_REMAIN_MOVEMENTS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Руху товару не знайдено')}
          getRowId={getMovementRowId}
          isLoading={isLoading}
          layoutVersion="product-remain-movements-table-1"
          loadingText={t('Завантаження руху товару')}
          maxHeight="calc(100vh - 360px)"
          minWidth={1620}
          tableId="product-remain-movements"
        />
      )}
    </Stack>
  )
}

function createInitialProductRemainMovementsState(hasConsignmentItemNetId: boolean): ProductRemainMovementsState {
  return {
    dateFrom: getDefaultDateTo(),
    dateTo: getDefaultDateTo(),
    error: null,
    isLoading: hasConsignmentItemNetId,
    reloadKey: 0,
    rows: [],
  }
}

function productRemainMovementsReducer(
  state: ProductRemainMovementsState,
  action: ProductRemainMovementsAction,
): ProductRemainMovementsState {
  switch (action.type) {
    case 'dateFromChanged':
      return { ...state, dateFrom: action.value }
    case 'dateToChanged':
      return { ...state, dateTo: action.value }
    case 'loadFailed':
      return { ...state, error: action.error, isLoading: false, rows: [] }
    case 'loadStarted':
      return { ...state, error: null, isLoading: true }
    case 'loadSucceeded':
      return { ...state, error: null, isLoading: false, rows: action.rows }
    case 'reloadRequested':
      return { ...state, reloadKey: state.reloadKey + 1 }
  }
}

function useProductRemainMovementColumns() {
  return useMemo<DataTableColumn<ProductRemainMovement>[]>(
    () => [
      {
        id: 'incomeDocumentNumber',
        header: 'Вхідний інвойс',
        width: 140,
        minWidth: 120,
        accessor: (row) => row.IncomeDocumentNumber,
        cell: (row) => displayValue(row.IncomeDocumentNumber),
      },
      {
        id: 'incomeDocumentDate',
        header: 'Дата інвойсу',
        width: 126,
        minWidth: 112,
        accessor: (row) => row.IncomeDocumentFromDate,
        cell: (row) => formatDateTime(row.IncomeDocumentFromDate),
      },
      {
        id: 'documentType',
        header: 'Тип документа',
        width: 220,
        minWidth: 170,
        accessor: (row) => row.DocumentType,
        cell: (row) => displayValue(row.DocumentType),
      },
      {
        id: 'documentNumber',
        header: 'Номер',
        width: 140,
        minWidth: 112,
        accessor: (row) => row.DocumentNumber,
        cell: (row) => displayValue(row.DocumentNumber),
      },
      {
        id: 'documentDate',
        header: 'Дата',
        width: 126,
        minWidth: 112,
        accessor: (row) => row.DocumentFromDate,
        cell: (row) => formatDateTime(row.DocumentFromDate),
      },
      {
        id: 'clientName',
        header: 'Клієнт',
        width: 220,
        minWidth: 170,
        accessor: (row) => row.ClientName,
        cell: (row) => displayValue(row.ClientName),
      },
      {
        id: 'storageName',
        header: 'Склад',
        width: 180,
        minWidth: 140,
        accessor: (row) => row.StorageName,
        cell: (row) => displayValue(row.StorageName),
      },
      {
        id: 'organizationName',
        header: 'Організація',
        width: 220,
        minWidth: 170,
        accessor: (row) => row.OrganizationName,
        cell: (row) => displayValue(row.OrganizationName),
      },
      {
        id: 'responsible',
        header: 'Відповідальний',
        width: 160,
        minWidth: 130,
        accessor: (row) => row.Responsible,
        cell: (row) => displayValue(row.Responsible),
      },
      {
        id: 'price',
        header: 'Ціна',
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (row) => row.Price,
        cell: (row) => formatMoney(row.Price),
      },
      {
        id: 'accountingPrice',
        header: 'Облік',
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (row) => row.AccountingPrice,
        cell: (row) => formatMoney(row.AccountingPrice),
      },
      {
        id: 'discount',
        header: 'Знижка',
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (row) => row.Discount,
        cell: (row) => formatMoney(row.Discount),
      },
      {
        id: 'incomeQty',
        header: 'Прихід',
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (row) => row.IncomeQty,
        cell: (row) => formatAmount(row.IncomeQty),
      },
      {
        id: 'outcomeQty',
        header: 'Розхід',
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (row) => row.OutcomeQty,
        cell: (row) => formatAmount(row.OutcomeQty),
      },
      {
        id: 'comment',
        header: 'Коментар',
        width: 220,
        minWidth: 160,
        accessor: (row) => row.Comment,
        cell: (row) => displayValue(row.Comment),
      },
    ],
    [],
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  const { t } = useI18n()

  return (
    <Box>
      <Text c="dimmed" size="xs">
        {t(label)}
      </Text>
      <Text size="sm" fw={600}>
        {value}
      </Text>
    </Box>
  )
}

function buildStorageOptions(storages: ProductRemainStorage[]): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = [
    {
      label: translate('Всі склади'),
      value: ALL_STORAGES_VALUE,
    },
  ]

  storages.forEach((storage) => {
    if (storage.NetUid) {
      options.push({
        label: storage.Name || translate('Без назви'),
        value: storage.NetUid,
      })
    }
  })

  return options
}

function buildSupplierOptions(suppliers: ProductRemainSupplier[]): { label: string; value: string }[] {
  const usedValues = new Set<string>()
  const options: { label: string; value: string }[] = []

  suppliers.forEach((supplier) => {
    const value = supplier.NetUid?.trim()

    if (!value || usedValues.has(value)) {
      return
    }

    usedValues.add(value)

    options.push({
      label: getSupplierDisplayName(supplier),
      value,
    })
  })

  return options
}

function getBatchItemsCount(batch: GroupedConsignment): number {
  return batch.ItemsCount ?? batch.GroupedConsignmentItems?.length ?? 0
}

function getBatchRowId(batch: GroupedConsignment, index: number): string {
  return String(
    batch.NetUid
      || batch.Id
      || `${batch.FromDate || 'date'}-${batch.ProductIncomeNumber || 'income'}-${batch.InvoiceNumber || 'invoice'}-${index}`,
  )
}

function getProductRowId(row: RemainingConsignment, index: number): string {
  return String(row.ConsignmentItemNetId || row.NetUid || row.Id || `${getVendorCode(row.Product)}-${row.RowNumber || index}`)
}

function getMovementRowId(row: ProductRemainMovement, index: number): string {
  return String(
    row.NetUid
      || row.Id
      || `${row.DocumentType || 'document'}-${row.DocumentNumber || 'number'}-${row.DocumentFromDate || 'date'}-${index}`,
  )
}

function getDefaultDateFrom(): string {
  const date = new Date()
  date.setDate(date.getDate() - 30)

  return formatDateInputValue(date)
}

function getDefaultDateTo(): string {
  return formatDateInputValue(new Date())
}

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getFilterError(dateFrom: string, dateTo: string): string | null {
  if (!dateFrom || !dateTo) {
    return translate('Вкажіть дату початку та дату завершення')
  }

  if (dateFrom > dateTo) {
    return translate('Дата початку не може бути пізнішою за дату завершення')
  }

  return null
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
