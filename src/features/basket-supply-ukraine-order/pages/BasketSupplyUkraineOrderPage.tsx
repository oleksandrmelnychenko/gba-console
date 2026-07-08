import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
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
import { AppModal } from "../../../shared/ui/AppModal"
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { ArrowLeft, ArrowRight, Check, CircleAlert, Eye, FileInput, FileSpreadsheet, Pencil, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AiFeatureBadge } from '../../../shared/ai/AiFeatureBadge'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  addOrUpdateSad,
  addOrUpdateSaleSad,
  addOrUpdateSaleTaxFreePackList,
  addOrUpdateTaxFreePackList,
  calculateTotalsByCartItems,
  calculateTotalsBySales,
  getCartItemRecommendations,
  getNotSentSads,
  getNotSentSaleSads,
  getNotSentSaleTaxFreePackLists,
  getNotSentTaxFreePackLists,
  getSalesForMovingToUkraine,
  getUkraineCartItems,
  updateUkraineCartItem,
  uploadPreviewUkraineCartItemsFromFile,
  uploadUkraineCartItemsFromFile,
} from '../api/basketSupplyUkraineOrderApi'
import { BasketSupplyUploadModal } from '../components/BasketSupplyUploadModal'
import { DocumentTargetControls } from '../components/DocumentTargetControls'
import { PreviewCartItemsModal } from '../components/PreviewCartItemsModal'
import { BudgetCartTab } from '../components/BudgetCartTab'
import { BuyerCockpitTab } from '../components/BuyerCockpitTab'
import { ProcureDashboardTab } from '../components/ProcureDashboardTab'
import type {
  BasketOrderItem,
  BasketSale,
  BasketSupplyDocumentState,
  BasketSupplyFileUploadMode,
  BasketSupplySalesFilters,
  BasketSupplyWorkflowTab,
  CartItemsParseConfiguration,
  CartItemsTotals,
  PreviewCartItem,
  Sad,
  SadTypeValue,
  SupplyOrderUkraineCartItem,
  SupplyOrderUkraineCartItemPriority,
  TaxFreePackList,
} from '../types'
import { SAD_TYPES, SUPPLY_ORDER_UKRAINE_CART_ITEM_PRIORITY } from '../types'
import './basketSupplyUkraineOrder.css'

type CartFilterState = {
  availability: 'all' | 'reserved' | 'available'
  priority: 'all' | '1' | '2' | '3'
  search: string
}

type CreatedDocumentState = {
  kind: 'TaxFree' | 'SAD'
  netUid?: string
  number?: string
  sadType?: SadTypeValue
}

const BASKET_CART_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['select', 'priority', 'vendorCode'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const BASKET_DESTINATION_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['select', 'vendorCode'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const BASKET_SALES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['date', 'number'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const BASKET_RECOMMENDATIONS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['vendorCode'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const EMPTY_NET_UID = '00000000-0000-0000-0000-000000000000'

const EMPTY_TOTALS: CartItemsTotals = {
  TotalEuroAmount: 0,
  TotalPlnAmount: 0,
  TotalQty: 0,
  TotalWeight: 0,
}

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const qtyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

const ALERT_CIRCLE_ICON = <CircleAlert size={16} />
const ARROW_LEFT_ICON = <ArrowLeft size={16} />
const ARROW_RIGHT_ICON = <ArrowRight size={16} />
const CHECK_ICON = <Check size={16} />
const FILE_IMPORT_ICON = <FileInput size={16} />
const FILE_SPREADSHEET_ICON = <FileSpreadsheet size={16} />
const SEARCH_ICON = <Search size={16} />

export function BasketSupplyUkraineOrderPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const activeTab = getActiveTab(location.pathname)
  const tabs: Array<{ ai?: boolean; label: string; value: BasketSupplyWorkflowTab }> = [
    { value: 'sales', label: t('Фактура') },
    { value: 'cart', label: t('Переміщення на Україну') },
    { value: 'recommendations', label: t('Рекомендації'), ai: true },
    { value: 'dashboard', label: t('Дашборд'), ai: true },
    { value: 'cockpit', label: t('Робоче місце закупівельника'), ai: true },
    { value: 'budget-cart', label: t('Бюджетний кошик') },
  ]

  function changeTab(nextTab: string | null) {
    if (!nextTab) {
      return
    }

    navigate(getTabPath(nextTab as BasketSupplyWorkflowTab))
  }

  return (
    <Stack className="basket-supply-page" gap={6}>
      <div>
        <div className="pill-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`pill-tab${activeTab === tab.value ? ' is-active' : ''}`}
              aria-pressed={activeTab === tab.value}
              onClick={() => changeTab(tab.value)}
            >
              {tab.label}
              {tab.ai && <AiFeatureBadge compact tooltip={t('AI-сервіс закупівель')} />}
            </button>
          ))}
        </div>

        <div style={{ paddingTop: 'var(--mantine-spacing-md)' }}>
          {activeTab === 'cart' && <BasketCartWorkflow />}
          {activeTab === 'sales' && <SalesWorkflowTab />}
          {activeTab === 'recommendations' && <RecommendationsTab />}
          {activeTab === 'dashboard' && <ProcureDashboardTab />}
          {activeTab === 'cockpit' && <BuyerCockpitTab />}
          {activeTab === 'budget-cart' && <BudgetCartTab />}
        </div>
      </div>
    </Stack>
  )
}

function BasketCartWorkflow() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [cartItems, setCartItems] = useState<SupplyOrderUkraineCartItem[]>([])
  const [destinationItems, setDestinationItems] = useState<SupplyOrderUkraineCartItem[]>([])
  const [notSentTaxFreePackLists, setNotSentTaxFreePackLists] = useState<TaxFreePackList[]>([])
  const [notSentSads, setNotSentSads] = useState<Sad[]>([])
  const [filters, setFilters] = useState<CartFilterState>({ availability: 'all', priority: 'all', search: '' })
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(() => new Set())
  const [selectedDestinationIds, setSelectedDestinationIds] = useState<Set<string>>(() => new Set())
  const [documentState, setDocumentState] = useState<BasketSupplyDocumentState>(() => createInitialDocumentState())
  const [totals, setTotals] = useState<CartItemsTotals>(EMPTY_TOTALS)
  const [createdDocument, setCreatedDocument] = useState<CreatedDocumentState | null>(null)
  const [previewItems, setPreviewItems] = useState<PreviewCartItem[]>([])
  const [uploadMode, setUploadMode] = useState<BasketSupplyFileUploadMode>('load')
  const [isUploadModalOpen, setUploadModalOpen] = useState(false)
  const [isPreviewModalOpen, setPreviewModalOpen] = useState(false)
  const [isCreateModalOpen, setCreateModalOpen] = useState(false)
  const [reserveItem, setReserveItem] = useState<SupplyOrderUkraineCartItem | null>(null)
  const [reserveQty, setReserveQty] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [referenceError, setReferenceError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [isReferenceLoading, setReferenceLoading] = useState(true)
  const [isUploading, setUploading] = useState(false)
  const [isUpdatingReserve, setUpdatingReserve] = useState(false)
  const [isCreatingDocument, setCreatingDocument] = useState(false)
  const [isTotalsLoading, setTotalsLoading] = useState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { density: sourceDensity, toggleDensity: toggleSourceDensity } = useDataTableDensity(
    'basket-supply-ukraine-order-source',
    BASKET_CART_TABLE_DEFAULT_LAYOUT.density,
  )
  const filteredCartItems = useMemo(() => filterCartItems(cartItems, filters), [cartItems, filters])
  const selectedSourceCount = useMemo(
    () => countItems(filteredCartItems, (item) => selectedSourceIds.has(getCartItemKey(item))),
    [filteredCartItems, selectedSourceIds],
  )
  const movableSourceCount = useMemo(() => countItems(filteredCartItems, canMoveCartItem), [filteredCartItems])
  const selectedDestinationCount = useMemo(
    () => countItems(destinationItems, (item) => selectedDestinationIds.has(getCartItemKey(item))),
    [destinationItems, selectedDestinationIds],
  )
  const visibleTotals = destinationItems.length ? totals : EMPTY_TOTALS
  const visibleIsTotalsLoading = destinationItems.length ? isTotalsLoading : false
  const sourceColumns = useCartSourceColumns({
    isSelected: (item) => selectedSourceIds.has(getCartItemKey(item)),
    openReserveModal,
    t,
    toggleSelected: toggleSourceSelection,
  })
  const destinationColumns = useCartDestinationColumns({
    isSelected: (item) => selectedDestinationIds.has(getCartItemKey(item)),
    t,
    toggleSelected: toggleDestinationSelection,
    updateQty: updateDestinationQty,
  })

  const loadReferenceDocuments = useCallback(async () => {
    setReferenceLoading(true)
    setReferenceError(null)

    try {
      const [taxFreePackLists, sads] = await Promise.all([getNotSentTaxFreePackLists(), getNotSentSads()])

      setNotSentTaxFreePackLists(taxFreePackLists)
      setNotSentSads(sads)
    } catch (loadError) {
      setReferenceError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити залежні документи'))
    } finally {
      setReferenceLoading(false)
    }
  }, [t])

  useEffect(() => {
    let cancelled = false

    async function loadCart() {
      setLoading(true)
      setError(null)

      try {
        const items = await getUkraineCartItems()

        if (!cancelled) {
          setCartItems(sortCartItems(items))
          setSelectedSourceIds(new Set())
        }
      } catch (loadError) {
        if (!cancelled) {
          setCartItems([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити кошик'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadCart()

    return () => {
      cancelled = true
    }
  }, [reloadKey, t])

  useEffect(() => {
    let cancelled = false

    async function loadReferences() {
      setReferenceLoading(true)
      setReferenceError(null)

      try {
        const [taxFreePackLists, sads] = await Promise.all([getNotSentTaxFreePackLists(), getNotSentSads()])

        if (!cancelled) {
          setNotSentTaxFreePackLists(taxFreePackLists)
          setNotSentSads(sads)
        }
      } catch (loadError) {
        if (!cancelled) {
          setReferenceError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити залежні документи'))
        }
      } finally {
        if (!cancelled) {
          setReferenceLoading(false)
        }
      }
    }

    void loadReferences()

    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    let cancelled = false

    async function loadTotals() {
      if (!destinationItems.length) {
        return
      }

      setTotalsLoading(true)

      try {
        const nextTotals = await calculateTotalsByCartItems(toCartItemsForDocument(destinationItems))

        if (!cancelled) {
          setTotals(nextTotals)
        }
      } catch {
        if (!cancelled) {
          setTotals(EMPTY_TOTALS)
        }
      } finally {
        if (!cancelled) {
          setTotalsLoading(false)
        }
      }
    }

    void loadTotals()

    return () => {
      cancelled = true
    }
  }, [destinationItems])

  function openUploadModal(mode: BasketSupplyFileUploadMode) {
    setUploadMode(mode)
    setUploadError(null)
    setUploadModalOpen(true)
  }

  async function submitUpload(file: File, parseConfiguration: CartItemsParseConfiguration) {
    setUploading(true)
    setUploadError(null)

    try {
      if (uploadMode === 'preview') {
        const nextPreviewItems = await uploadPreviewUkraineCartItemsFromFile(file, parseConfiguration)

        setPreviewItems(nextPreviewItems)
        setPreviewModalOpen(true)
      } else {
        const nextCartItems = await uploadUkraineCartItemsFromFile(file, parseConfiguration)

        setCartItems(sortCartItems(nextCartItems))
        setSelectedSourceIds(new Set())
        notifications.show({
          color: 'green',
          message: t('Кошик оновлено з файлу'),
        })
      }

      setUploadModalOpen(false)
    } catch (uploadErrorResult) {
      setUploadError(uploadErrorResult instanceof Error ? uploadErrorResult.message : t('Не вдалося завантажити файл'))
    } finally {
      setUploading(false)
    }
  }

  function addPreviewItemsToDestination(items: SupplyOrderUkraineCartItem[]) {
    setDestinationItems((currentItems) => mergeDestinationItems(currentItems, items))
    setSelectedDestinationIds(new Set())
  }

  function toggleSourceSelection(item: SupplyOrderUkraineCartItem) {
    if (!canMoveCartItem(item)) {
      return
    }

    setSelectedSourceIds((currentSelection) => toggleSetValue(currentSelection, getCartItemKey(item)))
  }

  function toggleDestinationSelection(item: SupplyOrderUkraineCartItem) {
    setSelectedDestinationIds((currentSelection) => toggleSetValue(currentSelection, getCartItemKey(item)))
  }

  function moveSelectedRight() {
    const selectedItems = cartItems.filter((item) => selectedSourceIds.has(getCartItemKey(item)) && canMoveCartItem(item))

    if (!selectedItems.length) {
      return
    }

    setDestinationItems((currentItems) => mergeDestinationItems(currentItems, selectedItems))
    setCartItems((currentItems) =>
      currentItems.map((item) =>
        selectedSourceIds.has(getCartItemKey(item))
          ? {
              ...item,
              IsDirty: true,
              ReservedQty: 0,
            }
          : item,
      ),
    )
    setSelectedSourceIds(new Set())
    setSelectedDestinationIds(new Set())
  }

  function moveSelectedLeft() {
    const { items: selectedItems, keySet: selectedIds } = collectSelectedItems(
      destinationItems,
      selectedDestinationIds,
      getCartItemKey,
    )

    if (!selectedItems.length) {
      return
    }

    setCartItems((currentItems) =>
      currentItems.map((item) => {
        const destinationItem = selectedItems.find((selectedItem) => getCartItemKey(selectedItem) === getCartItemKey(item))

        if (!destinationItem || destinationItem.IsFromFile) {
          return item
        }

        return {
          ...item,
          IsDirty: false,
          ReservedQty: destinationItem.ReservedQty,
        }
      }),
    )
    setDestinationItems((currentItems) => currentItems.filter((item) => !selectedIds.has(getCartItemKey(item))))
    setSelectedDestinationIds(new Set())
  }

  function updateDestinationQty(item: SupplyOrderUkraineCartItem, qty: number | '') {
    if (!qty || qty <= 0 || item.IsFromFile || qty > toNumber(item.ReservedQty)) {
      return
    }

    setDestinationItems((currentItems) =>
      currentItems.map((currentItem) =>
        getCartItemKey(currentItem) === getCartItemKey(item)
          ? {
              ...currentItem,
              ChangedQty: qty,
            }
          : currentItem,
      ),
    )
  }

  function openReserveModal(item: SupplyOrderUkraineCartItem) {
    setReserveItem(item)
    setReserveQty(toNumber(item.ReservedQty))
  }

  async function saveReserveQty() {
    if (!reserveItem || !reserveQty || reserveQty < 0) {
      return
    }

    setUpdatingReserve(true)

    try {
      const updatedCartItem = await updateUkraineCartItem({
        ...reserveItem,
        ReservedQty: reserveQty,
      })

      if (updatedCartItem) {
        setCartItems((currentItems) =>
          currentItems.map((item) => (getCartItemKey(item) === getCartItemKey(updatedCartItem) ? updatedCartItem : item)),
        )
      }

      notifications.show({
        color: 'green',
        message: t('Резерв оновлено'),
      })
      setReserveItem(null)
    } catch (updateError) {
      notifications.show({
        color: 'red',
        message: updateError instanceof Error ? updateError.message : t('Не вдалося оновити резерв'),
      })
    } finally {
      setUpdatingReserve(false)
    }
  }

  async function createDocument() {
    setCreateError(null)
    setCreatedDocument(null)

    if (!destinationItems.length) {
      setCreateError(t('Оберіть позиції для документа'))
      return
    }

    setCreatingDocument(true)

    try {
      const documentItems = toCartItemsForDocument(destinationItems)
      const result =
        documentState.documentType === 'taxFree'
          ? await createTaxFreeDocument(documentState, notSentTaxFreePackLists, documentItems)
          : await createSadDocument(documentState, notSentSads, documentItems)

      setCreatedDocument(result)
      setCreateModalOpen(false)
      setDestinationItems([])
      setSelectedDestinationIds(new Set())
      reload()
      await loadReferenceDocuments()
      notifications.show({
        color: 'green',
        message: `${t('Документ створено')}: ${result.number || result.netUid || result.kind}`,
      })
      const documentPath = getCreatedDocumentPath(result)
      if (documentPath) {
        navigate(documentPath)
      }
    } catch (createDocumentError) {
      setCreateError(createDocumentError instanceof Error ? createDocumentError.message : t('Не вдалося створити документ'))
    } finally {
      setCreatingDocument(false)
    }
  }

  function closeCreateModal() {
    if (isCreatingDocument) {
      return
    }

    setCreateModalOpen(false)
  }

  const toggleAllSourceItems = useCallback(() => {
    const { hasUnselected: hasUnselectedItems, keys: movableIds } = collectSelectionKeys(
      filteredCartItems,
      selectedSourceIds,
      getCartItemKey,
      canMoveCartItem,
    )

    setSelectedSourceIds((currentSelection) => {
      const nextSelection = new Set(currentSelection)

      movableIds.forEach((id) => {
        if (hasUnselectedItems) {
          nextSelection.add(id)
        } else {
          nextSelection.delete(id)
        }
      })

      return nextSelection
    })
  }, [filteredCartItems, selectedSourceIds])
  const toggleAllDestinationItems = useCallback(() => {
    const { hasUnselected: hasUnselectedItems, keys: destinationIds } = collectSelectionKeys(
      destinationItems,
      selectedDestinationIds,
      getCartItemKey,
    )

    setSelectedDestinationIds(hasUnselectedItems ? new Set(destinationIds) : new Set())
  }, [destinationItems, selectedDestinationIds])
  const sourceToolbarLeft = useMemo(
    () => (
      <Group gap="xs">
        <Checkbox
          aria-label={t('Обрати всі')}
          checked={selectedSourceCount > 0 && selectedSourceCount === movableSourceCount}
          indeterminate={selectedSourceCount > 0 && selectedSourceCount < movableSourceCount}
          onChange={toggleAllSourceItems}
        />
      </Group>
    ),
    [movableSourceCount, selectedSourceCount, t, toggleAllSourceItems],
  )
  const destinationToolbarLeft = useMemo(
    () => (
      <Group gap="xs">
        <Checkbox
          aria-label={t('Обрати всі')}
          checked={selectedDestinationCount > 0 && selectedDestinationCount === destinationItems.length}
          indeterminate={selectedDestinationCount > 0 && selectedDestinationCount < destinationItems.length}
          onChange={toggleAllDestinationItems}
        />
        <Text size="xs" c="dimmed">
          {t('Позицій')}: {destinationItems.length}
        </Text>
      </Group>
    ),
    [destinationItems.length, selectedDestinationCount, t, toggleAllDestinationItems],
  )
  const destinationToolbarRight = useMemo(
    () => (
      <Button color={CREATE_ACTION_COLOR} disabled={!destinationItems.length} loading={isCreatingDocument} onClick={() => setCreateModalOpen(true)}>
        {isCreatingDocument ? t('Створення') : t('Створити')}
      </Button>
    ),
    [destinationItems.length, isCreatingDocument, t],
  )

  return (
    <Stack gap="md">
      {error && (
        <Alert color="red" icon={ALERT_CIRCLE_ICON} variant="light">
          {error}
        </Alert>
      )}
      {referenceError && (
        <Alert color="yellow" icon={ALERT_CIRCLE_ICON} variant="light">
          {referenceError}
        </Alert>
      )}
      {createError && (
        <Alert color="red" icon={ALERT_CIRCLE_ICON} variant="light">
          {createError}
        </Alert>
      )}
      {createdDocument && (
        <Alert color="green" icon={CHECK_ICON} variant="light">
          {t('Створено')} {createdDocument.kind}: {createdDocument.number || createdDocument.netUid || t('без номера')}
        </Alert>
      )}

      <Card className="app-data-card" padding={0} radius="md" withBorder>
        <div className="app-filter-bar basket-supply-command-bar is-split">
            <SimpleGrid className="basket-supply-filters" cols={{ base: 1, md: 3 }} spacing="sm">
              <TextInput
                label={t('Пошук по товару')}
                leftSection={SEARCH_ICON}
                placeholder={t('Код Виробника')}
                value={filters.search}
                onChange={(event) => { const nextValue = event.currentTarget.value; setFilters((current) => ({ ...current, search: nextValue })) }}
              />
              <Select
                data={[
                  { label: t('Усі пріоритети'), value: 'all' },
                  { label: t('Низький'), value: '1' },
                  { label: t('Високий'), value: '2' },
                  { label: t('TIR'), value: '3' },
                ]}
                label={t('Приорітет')}
                value={filters.priority}
                onChange={(value) => setFilters((current) => ({ ...current, priority: (value || 'all') as CartFilterState['priority'] }))}
              />
              <Select
                data={[
                  { label: t('Усі позиції'), value: 'all' },
                  { label: t('Зарезервована К-сть'), value: 'reserved' },
                  { label: t('Доступна К-сть'), value: 'available' },
                ]}
                label={t('Фільтр залишку')}
                value={filters.availability}
                onChange={(value) =>
                  setFilters((current) => ({ ...current, availability: (value || 'all') as CartFilterState['availability'] }))
                }
              />
            </SimpleGrid>

            <Group gap="xs">
              <Tooltip label={t('Оновити')}>
                <ActionIcon aria-label={t('Оновити')} loading={isLoading} variant="subtle" onClick={() => reload()}>
                  <RefreshCw size={16} />
                </ActionIcon>
              </Tooltip>
              <Button leftSection={FILE_IMPORT_ICON} styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }} variant="outline" onClick={() => openUploadModal('load')}>
                {t('Завантажити в корзину')}
              </Button>
              <Button leftSection={FILE_SPREADSHEET_ICON} styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }} variant="outline" onClick={() => openUploadModal('preview')}>
                {t('Вибрати для експорту')}
              </Button>
              <DataTableDensityToggle density={sourceDensity} onToggle={toggleSourceDensity} size={36} />
            </Group>
        </div>
        <Stack gap="md" p="md">

          <DataTable
            columns={sourceColumns}
            data={filteredCartItems}
            defaultLayout={BASKET_CART_TABLE_DEFAULT_LAYOUT}
            density={sourceDensity}
            emptyText={t('Даних не знайдено')}
            getRowId={(item, index) => getCartItemKey(item, index)}
            isLoading={isLoading}
            maxHeight={460}
            minWidth={1120}
            rowClassName={(item) => (selectedSourceIds.has(getCartItemKey(item)) ? 'basket-supply-row-selected' : undefined)}
            tableId="basket-supply-ukraine-order-source"
            toolbarLeft={sourceToolbarLeft}
          />
        </Stack>
      </Card>

      <Group align="center" className="basket-supply-transfer-controls" justify="center">
        <Button
          disabled={!selectedSourceCount}
          leftSection={ARROW_RIGHT_ICON}
          variant="outline"
          onClick={moveSelectedRight}
        >
          {t('Додати')} ({selectedSourceCount})
        </Button>
        <Button
          disabled={!selectedDestinationCount}
          leftSection={ARROW_LEFT_ICON}
          variant="outline"
          onClick={moveSelectedLeft}
        >
          {t('Повернути')} ({selectedDestinationCount})
        </Button>
      </Group>

      <Card className="app-section-card" withBorder padding="md" radius="md">
        <Stack gap="md">
          <DataTable
            columns={destinationColumns}
            data={destinationItems}
            defaultLayout={BASKET_DESTINATION_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Підбірка порожня')}
            getRowId={(item, index) => getCartItemKey(item, index)}
            maxHeight={420}
            minWidth={960}
            rowClassName={(item) => (selectedDestinationIds.has(getCartItemKey(item)) ? 'basket-supply-row-selected' : undefined)}
            tableId="basket-supply-ukraine-order-destination"
            toolbarLeft={destinationToolbarLeft}
            toolbarRight={destinationToolbarRight}
          />

          <TotalsBar isLoading={visibleIsTotalsLoading} totals={visibleTotals} />
        </Stack>
      </Card>

      <BasketSupplyUploadModal
        key={`${uploadMode}-${isUploadModalOpen ? 'open' : 'closed'}`}
        isSubmitting={isUploading}
        mode={uploadMode}
        opened={isUploadModalOpen}
        submitError={uploadError}
        t={t}
        onClose={() => setUploadModalOpen(false)}
        onSubmit={submitUpload}
      />

      <PreviewCartItemsModal
        opened={isPreviewModalOpen}
        previewItems={previewItems}
        t={t}
        onClose={() => setPreviewModalOpen(false)}
        onLoadValidItems={addPreviewItemsToDestination}
      />

      <AppModal centered opened={isCreateModalOpen} size="lg" title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Створити документ')}</span>} onClose={closeCreateModal}>
        <Stack gap="md">
          <DocumentTargetControls
            disabled={isCreatingDocument || isReferenceLoading}
            documentState={documentState}
            notSentSads={notSentSads}
            notSentTaxFreePackLists={notSentTaxFreePackLists}
            t={t}
            onChange={setDocumentState}
          />
          <Group justify="space-between">
            <Text c="dimmed" size="sm">
              {t('Позицій')}: {destinationItems.length}
            </Text>
            <Group gap="xs">
              <Button color="gray" disabled={isCreatingDocument} variant="light" onClick={closeCreateModal}>
                {t('Скасувати')}
              </Button>
              <Button color={CREATE_ACTION_COLOR} loading={isCreatingDocument} onClick={createDocument}>
                {isCreatingDocument ? t('Створення') : t('Створити')}
              </Button>
            </Group>
          </Group>
        </Stack>
      </AppModal>

      <AppModal centered opened={Boolean(reserveItem)} title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Резерв')}</span>} onClose={() => setReserveItem(null)}>
        <Stack gap="md">
          <Text size="sm">
            {reserveItem?.Product?.VendorCode} {reserveItem?.Product?.Name}
          </Text>
          <NumberInput
            allowDecimal={false}
            label={t('Зарезервована К-сть')}
            min={0}
            value={reserveQty}
            onChange={(value) => setReserveQty(toPositiveNumberOrZero(value))}
          />
          <Group justify="flex-end">
            <Button disabled={isUpdatingReserve} variant="subtle" onClick={() => setReserveItem(null)}>
              {t('Скасувати')}
            </Button>
            <Button color={CREATE_ACTION_COLOR} loading={isUpdatingReserve} onClick={saveReserveQty}>
              {t('Зберегти')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

function SalesWorkflowTab() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const today = useMemo(() => formatLocalDate(new Date()), [])
  const initialFilters = useMemo<BasketSupplySalesFilters>(
    () => ({
      from: getDateShiftedByDays(-20),
      to: today,
      value: '',
    }),
    [today],
  )
  const [filterDraft, setFilterDraft] = useState<BasketSupplySalesFilters>(initialFilters)
  const [activeFilters, setActiveFilters] = useState<BasketSupplySalesFilters>(initialFilters)
  const [sales, setSales] = useState<BasketSale[]>([])
  const [destinationSales, setDestinationSales] = useState<BasketSale[]>([])
  const [selectedSourceSaleIds, setSelectedSourceSaleIds] = useState<Set<string>>(() => new Set())
  const [selectedDestinationSaleIds, setSelectedDestinationSaleIds] = useState<Set<string>>(() => new Set())
  const [notSentSaleTaxFreePackLists, setNotSentSaleTaxFreePackLists] = useState<TaxFreePackList[]>([])
  const [notSentSaleSads, setNotSentSaleSads] = useState<Sad[]>([])
  const [documentState, setDocumentState] = useState<BasketSupplyDocumentState>(() => createInitialDocumentState())
  const [createdDocument, setCreatedDocument] = useState<CreatedDocumentState | null>(null)
  const [isCreateModalOpen, setCreateModalOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState<BasketSale | null>(null)
  const [totals, setTotals] = useState<CartItemsTotals>(EMPTY_TOTALS)
  const [error, setError] = useState<string | null>(null)
  const [referenceError, setReferenceError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [isReferenceLoading, setReferenceLoading] = useState(true)
  const [isCreatingDocument, setCreatingDocument] = useState(false)
  const [isTotalsLoading, setTotalsLoading] = useState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { density: salesDensity, toggleDensity: toggleSalesDensity } = useDataTableDensity(
    'basket-supply-ukraine-order-sales',
    BASKET_SALES_TABLE_DEFAULT_LAYOUT.density,
  )
  const [debouncedSearchValue] = useDebouncedValue(filterDraft.value, 400)
  const destinationSaleIds = useMemo(() => new Set(destinationSales.map(getBasketSaleKey)), [destinationSales])
  const selectedSourceSales = useMemo(
    () => sales.filter((sale) => selectedSourceSaleIds.has(getBasketSaleKey(sale))),
    [sales, selectedSourceSaleIds],
  )
  const clientScopeId = getBasketSaleClientId(destinationSales[0]) || getBasketSaleClientId(selectedSourceSales[0])
  const sourceSales = useMemo(
    () =>
      sales.filter((sale) => {
        if (destinationSaleIds.has(getBasketSaleKey(sale))) {
          return false
        }

        return !clientScopeId || getBasketSaleClientId(sale) === clientScopeId
      }),
    [clientScopeId, destinationSaleIds, sales],
  )
  const selectedSourceCount = useMemo(
    () => sourceSales.filter((sale) => selectedSourceSaleIds.has(getBasketSaleKey(sale))).length,
    [selectedSourceSaleIds, sourceSales],
  )
  const selectedDestinationCount = useMemo(
    () => destinationSales.filter((sale) => selectedDestinationSaleIds.has(getBasketSaleKey(sale))).length,
    [destinationSales, selectedDestinationSaleIds],
  )
  const sourceColumns = useBasketSalesColumns({
    isSelected: (sale) => selectedSourceSaleIds.has(getBasketSaleKey(sale)),
    onOpen: setSelectedSale,
    t,
    toggleSelected: toggleSourceSaleSelection,
  })
  const destinationColumns = useBasketSalesColumns({
    isSelected: (sale) => selectedDestinationSaleIds.has(getBasketSaleKey(sale)),
    onOpen: setSelectedSale,
    t,
    toggleSelected: toggleDestinationSaleSelection,
  })
  const visibleTotals = destinationSales.length ? totals : EMPTY_TOTALS
  const visibleIsTotalsLoading = destinationSales.length ? isTotalsLoading : false

  const loadSaleReferenceDocuments = useCallback(async () => {
    setReferenceLoading(true)
    setReferenceError(null)

    try {
      const [taxFreePackLists, sads] = await Promise.all([getNotSentSaleTaxFreePackLists(), getNotSentSaleSads()])

      setNotSentSaleTaxFreePackLists(taxFreePackLists)
      setNotSentSaleSads(sads)
    } catch (loadError) {
      setReferenceError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити залежні документи'))
    } finally {
      setReferenceLoading(false)
    }
  }, [t])

  useEffect(() => {
    let cancelled = false

    async function loadSales() {
      setLoading(true)
      setError(null)

      try {
        const nextSales = await getSalesForMovingToUkraine(activeFilters)

        if (!cancelled) {
          setSales(nextSales)
          setSelectedSourceSaleIds(new Set())
        }
      } catch (loadError) {
        if (!cancelled) {
          setSales([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити рахунки'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSales()

    return () => {
      cancelled = true
    }
  }, [activeFilters, reloadKey, t])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSaleReferenceDocuments()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadSaleReferenceDocuments])

  useEffect(() => {
    let cancelled = false

    async function loadTotals() {
      if (!destinationSales.length) {
        setTotals(EMPTY_TOTALS)
        return
      }

      setTotalsLoading(true)

      try {
        const nextTotals = await calculateTotalsBySales(destinationSales)

        if (!cancelled) {
          setTotals(nextTotals)
        }
      } catch {
        if (!cancelled) {
          setTotals(EMPTY_TOTALS)
        }
      } finally {
        if (!cancelled) {
          setTotalsLoading(false)
        }
      }
    }

    void loadTotals()

    return () => {
      cancelled = true
    }
  }, [destinationSales])

  useEffect(() => {
    const trimmedSearch = debouncedSearchValue.trim()

    if (trimmedSearch === activeFilters.value) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setSelectedSourceSaleIds(new Set())
      setActiveFilters((current) => ({ ...current, value: trimmedSearch }))
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeFilters.value, debouncedSearchValue])

  function applyFilters(nextFilters: BasketSupplySalesFilters) {
    setFilterDraft(nextFilters)
    setSelectedSourceSaleIds(new Set())
    setActiveFilters({
      ...nextFilters,
      value: nextFilters.value.trim(),
    })
  }

  function resetFilters() {
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
    setSelectedSourceSaleIds(new Set())
  }

  function toggleSourceSaleSelection(sale: BasketSale) {
    const saleClientId = getBasketSaleClientId(sale)

    if (clientScopeId && saleClientId !== clientScopeId) {
      notifications.show({ color: 'yellow', message: t('Оберіть фактури одного клієнта') })
      return
    }

    setSelectedSourceSaleIds((currentSelection) => toggleSetValue(currentSelection, getBasketSaleKey(sale)))
  }

  function toggleDestinationSaleSelection(sale: BasketSale) {
    setSelectedDestinationSaleIds((currentSelection) => toggleSetValue(currentSelection, getBasketSaleKey(sale)))
  }

  function toggleAllSourceSales() {
    const sourceClientIds = Array.from(
      new Set(
        sourceSales.flatMap((sale) => {
          const clientId = getBasketSaleClientId(sale)
          return clientId ? [clientId] : []
        }),
      ),
    )

    if (!clientScopeId && sourceClientIds.length > 1) {
      notifications.show({ color: 'yellow', message: t('Спочатку оберіть одну фактуру клієнта') })
      return
    }

    const sourceIds = sourceSales.map(getBasketSaleKey)
    const hasUnselectedSales = sourceIds.some((id) => !selectedSourceSaleIds.has(id))

    setSelectedSourceSaleIds(hasUnselectedSales ? new Set(sourceIds) : new Set())
  }

  function toggleAllDestinationSales() {
    const destinationIds = destinationSales.map(getBasketSaleKey)
    const hasUnselectedSales = destinationIds.some((id) => !selectedDestinationSaleIds.has(id))

    setSelectedDestinationSaleIds(hasUnselectedSales ? new Set(destinationIds) : new Set())
  }

  function moveSelectedSalesRight() {
    const selectedSales = sourceSales.filter((sale) => selectedSourceSaleIds.has(getBasketSaleKey(sale)))

    if (!selectedSales.length) {
      return
    }

    setDestinationSales((currentSales) => mergeBasketSales(currentSales, selectedSales))
    setSelectedSourceSaleIds(new Set())
    setSelectedDestinationSaleIds(new Set())
  }

  function moveSelectedSalesLeft() {
    const selectedIds = new Set(
      destinationSales.reduce<string[]>((acc, sale) => {
        const saleKey = getBasketSaleKey(sale)
        if (selectedDestinationSaleIds.has(saleKey)) {
          acc.push(saleKey)
        }
        return acc
      }, []),
    )

    if (!selectedIds.size) {
      return
    }

    setDestinationSales((currentSales) => currentSales.filter((sale) => !selectedIds.has(getBasketSaleKey(sale))))
    setSelectedDestinationSaleIds(new Set())
  }

  async function createSalesDocument() {
    setCreateError(null)
    setCreatedDocument(null)

    if (!destinationSales.length) {
      setCreateError(t('Оберіть фактури для документа'))
      return
    }

    setCreatingDocument(true)

    try {
      const result =
        documentState.documentType === 'taxFree'
          ? await createSaleTaxFreeDocument(documentState, notSentSaleTaxFreePackLists, destinationSales)
          : await createSaleSadDocument(documentState, notSentSaleSads, destinationSales)

      setCreatedDocument(result)
      setCreateModalOpen(false)
      setDestinationSales([])
      setSelectedSourceSaleIds(new Set())
      setSelectedDestinationSaleIds(new Set())
      reload()
      await loadSaleReferenceDocuments()
      notifications.show({
        color: 'green',
        message: `${t('Документ створено')}: ${result.number || result.netUid || result.kind}`,
      })
      const documentPath = getCreatedSaleDocumentPath(result)
      if (documentPath) {
        navigate(documentPath)
      }
    } catch (createDocumentError) {
      setCreateError(createDocumentError instanceof Error ? createDocumentError.message : t('Не вдалося створити документ'))
    } finally {
      setCreatingDocument(false)
    }
  }

  function closeCreateModal() {
    if (isCreatingDocument) {
      return
    }

    setCreateModalOpen(false)
  }

  return (
    <Stack gap="md">
      {error && (
        <Alert color="red" icon={<CircleAlert size={16} />} variant="light">
          {error}
        </Alert>
      )}
      {referenceError && (
        <Alert color="yellow" icon={<CircleAlert size={16} />} variant="light">
          {referenceError}
        </Alert>
      )}
      {createError && (
        <Alert color="red" icon={<CircleAlert size={16} />} variant="light">
          {createError}
        </Alert>
      )}
      {createdDocument && (
        <Alert color="green" icon={<Check size={16} />} variant="light">
          {t('Створено')} {createdDocument.kind}: {createdDocument.number || createdDocument.netUid || t('без номера')}
        </Alert>
      )}

      <Card className="app-section-card" withBorder padding="md" radius="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
            <TextInput
              label={t('З')}
              type="date"
              value={filterDraft.from}
              onChange={(event) => applyFilters({ ...filterDraft, from: event.currentTarget.value })}
            />
            <TextInput
              label={t('По')}
              type="date"
              value={filterDraft.to}
              onChange={(event) => applyFilters({ ...filterDraft, to: event.currentTarget.value })}
            />
            <TextInput
              label={t('Пошук')}
              leftSection={<Search size={16} />}
              value={filterDraft.value}
              onChange={(event) => {
                const nextValue = event.currentTarget.value
                setFilterDraft((current) => ({ ...current, value: nextValue }))
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  applyFilters(filterDraft)
                }
              }}
            />
            <Button leftSection={<RotateCcw size={16} />} variant="subtle" onClick={resetFilters}>
              {t('Скинути')}
            </Button>
            <Tooltip label={t('Оновити')}>
              <ActionIcon aria-label={t('Оновити')} loading={isLoading} variant="subtle" onClick={() => reload()}>
                <RefreshCw size={16} />
              </ActionIcon>
            </Tooltip>
            <DataTableDensityToggle density={salesDensity} onToggle={toggleSalesDensity} size={36} />
          </Group>

          <DataTable
            columns={sourceColumns}
            data={sourceSales}
            defaultLayout={BASKET_SALES_TABLE_DEFAULT_LAYOUT}
            density={salesDensity}
            emptyText={t('Даних не знайдено')}
            getRowId={(sale, index) => sale.NetUid || String(sale.Id || index)}
            isLoading={isLoading}
            maxHeight={520}
            minWidth={1100}
            rowClassName={(sale) => (selectedSourceSaleIds.has(getBasketSaleKey(sale)) ? 'basket-supply-row-selected' : undefined)}
            tableId="basket-supply-ukraine-order-sales"
            toolbarLeft={
              <Group gap="xs">
                <Checkbox
                  aria-label={t('Обрати всі')}
                  checked={selectedSourceCount > 0 && selectedSourceCount === sourceSales.length}
                  indeterminate={selectedSourceCount > 0 && selectedSourceCount < sourceSales.length}
                  onChange={toggleAllSourceSales}
                />
              </Group>
            }
            onRowClick={setSelectedSale}
          />
        </Stack>
      </Card>

      <Group align="center" className="basket-supply-transfer-controls" justify="center">
        <Button
          disabled={!selectedSourceCount}
          leftSection={<ArrowRight size={16} />}
          variant="outline"
          onClick={moveSelectedSalesRight}
        >
          {t('Додати')} ({selectedSourceCount})
        </Button>
        <Button
          disabled={!selectedDestinationCount}
          leftSection={<ArrowLeft size={16} />}
          variant="outline"
          onClick={moveSelectedSalesLeft}
        >
          {t('Повернути')} ({selectedDestinationCount})
        </Button>
      </Group>

      <Card className="app-section-card" withBorder padding="md" radius="md">
        <Stack gap="md">
          <DataTable
            columns={destinationColumns}
            data={destinationSales}
            defaultLayout={BASKET_SALES_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Підбірка порожня')}
            getRowId={(sale, index) => sale.NetUid || String(sale.Id || index)}
            maxHeight={420}
            minWidth={1100}
            rowClassName={(sale) =>
              selectedDestinationSaleIds.has(getBasketSaleKey(sale)) ? 'basket-supply-row-selected' : undefined
            }
            tableId="basket-supply-ukraine-order-sales-destination"
            toolbarLeft={
              <Group gap="xs">
                <Checkbox
                  aria-label={t('Обрати всі')}
                  checked={selectedDestinationCount > 0 && selectedDestinationCount === destinationSales.length}
                  indeterminate={selectedDestinationCount > 0 && selectedDestinationCount < destinationSales.length}
                  onChange={toggleAllDestinationSales}
                />
                <Text c="dimmed" size="xs">
                  {t('Фактур')}: {destinationSales.length}
                </Text>
              </Group>
            }
            toolbarRight={
              <Button color={CREATE_ACTION_COLOR} disabled={!destinationSales.length} loading={isCreatingDocument} onClick={() => setCreateModalOpen(true)}>
                {isCreatingDocument ? t('Створення') : t('Створити')}
              </Button>
            }
            onRowClick={setSelectedSale}
          />

          <TotalsBar isLoading={visibleIsTotalsLoading} totals={visibleTotals} />
        </Stack>
      </Card>

      <AppModal centered opened={isCreateModalOpen} size="lg" title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Створити документ')}</span>} onClose={closeCreateModal}>
        <Stack gap="md">
          <DocumentTargetControls
            disabled={isCreatingDocument || isReferenceLoading}
            documentState={documentState}
            notSentSads={notSentSaleSads}
            notSentTaxFreePackLists={notSentSaleTaxFreePackLists}
            t={t}
            onChange={setDocumentState}
          />
          <Group justify="space-between">
            <Text c="dimmed" size="sm">
              {t('Фактур')}: {destinationSales.length}
            </Text>
            <Group gap="xs">
              <Button color="gray" disabled={isCreatingDocument} variant="light" onClick={closeCreateModal}>
                {t('Скасувати')}
              </Button>
              <Button color={CREATE_ACTION_COLOR} loading={isCreatingDocument} onClick={createSalesDocument}>
                {isCreatingDocument ? t('Створення') : t('Створити')}
              </Button>
            </Group>
          </Group>
        </Stack>
      </AppModal>

      <AppDrawer
        opened={Boolean(selectedSale)}
        position="right"
        size="xl"
        title={`${t('Фактура')} ${selectedSale?.SaleNumber?.Value || ''}`}
        onClose={() => setSelectedSale(null)}
      >
        <SaleItemsList items={selectedSale?.Order?.OrderItems || []} />
      </AppDrawer>
    </Stack>
  )
}

function RecommendationsTab() {
  const { t } = useI18n()
  const [recommendations, setRecommendations] = useState<SupplyOrderUkraineCartItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const columns = useMemo<Array<DataTableColumn<SupplyOrderUkraineCartItem>>>(
    () => [
      {
        id: 'vendorCode',
        header: t('Код Виробника'),
        accessor: (item) => item.Product?.VendorCode || '',
        width: 160,
      },
      {
        id: 'recommendedQty',
        header: t('Рекомендована К-сть'),
        accessor: (item) => toNumber(item.UploadedQty),
        cell: (item) => formatQty(item.UploadedQty),
        width: 150,
        align: 'right',
      },
      {
        id: 'availableQty',
        header: t('Доступна К-сть'),
        accessor: (item) => toNumber(item.AvailableQty),
        cell: (item) => formatQty(item.AvailableQty),
        width: 140,
        align: 'right',
      },
      {
        id: 'fromDate',
        header: t('Від якої дати'),
        accessor: (item) => formatDate(item.FromDate),
        width: 130,
      },
      {
        id: 'product',
        header: t('Назва товару'),
        accessor: (item) => item.Product?.Name || '',
        minWidth: 320,
      },
    ],
    [t],
  )

  useEffect(() => {
    let cancelled = false

    async function loadRecommendations() {
      setLoading(true)
      setError(null)

      try {
        const nextRecommendations = await getCartItemRecommendations()

        if (!cancelled) {
          setRecommendations(nextRecommendations)
        }
      } catch (loadError) {
        if (!cancelled) {
          setRecommendations([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити рекомендації'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadRecommendations()

    return () => {
      cancelled = true
    }
  }, [reloadKey, t])

  const recommendationsToolbarRight = useMemo(
    () => (
      <Group gap="xs" wrap="nowrap">
        <AiFeatureBadge tooltip={t('AI-рекомендації переміщення')} />
        <Tooltip label={t('Оновити')}>
          <ActionIcon aria-label={t('Оновити')} loading={isLoading} size="sm" variant="subtle" onClick={() => reload()}>
            <RefreshCw size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    ),
    [isLoading, reload, t],
  )

  return (
    <Stack gap="md">
      {error && (
        <Alert color="red" icon={ALERT_CIRCLE_ICON} variant="light">
          {error}
        </Alert>
      )}

      <Card className="app-section-card" withBorder padding="md" radius="md">
        <DataTable
          columns={columns}
          data={recommendations}
          defaultLayout={BASKET_RECOMMENDATIONS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Даних не знайдено')}
          getRowId={(item, index) => getCartItemKey(item, index)}
          isLoading={isLoading}
          maxHeight={620}
          minWidth={960}
          tableId="basket-supply-ukraine-order-recommendations"
          toolbarRight={recommendationsToolbarRight}
        />
      </Card>
    </Stack>
  )
}

function TotalsBar({ isLoading, totals }: { isLoading: boolean; totals: CartItemsTotals }) {
  const { t } = useI18n()

  return (
    <SimpleGrid className="basket-supply-totals" cols={{ base: 2, md: 4 }} spacing="sm">
      <TotalItem isLoading={isLoading} label={t('Заг. к-сть')} value={formatQty(totals.TotalQty)} />
      <TotalItem isLoading={isLoading} label={t('Заг. вага')} value={formatQty(totals.TotalWeight)} />
      <TotalItem isLoading={isLoading} label={`${t('Вартість Брутто')} (EUR)`} value={formatAmount(totals.TotalEuroAmount)} />
      <TotalItem isLoading={isLoading} label={`${t('Вартість Брутто')} (PLN)`} value={formatAmount(totals.TotalPlnAmount)} />
    </SimpleGrid>
  )
}

function TotalItem({ isLoading, label, value }: { isLoading: boolean; label: string; value: string }) {
  return (
    <Box className="basket-supply-total-item">
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text className="app-money" fw={600}>{isLoading ? '...' : value}</Text>
    </Box>
  )
}

function SaleItemsList({ items }: { items: BasketOrderItem[] }) {
  const { t } = useI18n()

  if (!items.length) {
    return (
      <Text c="dimmed" size="sm">
        {t('Даних не знайдено')}
      </Text>
    )
  }

  return (
    <Stack gap="xs">
      {items.map((item, index) => (
        <Card key={`${item.NetUid || item.Id || index}`} withBorder padding="sm" radius="sm">
          <Group align="flex-start" justify="space-between" wrap="nowrap">
            <Box>
              <Text fw={600} size="sm">
                {item.Product?.VendorCode} {item.Product?.Name}
              </Text>
              <Text c="dimmed" size="xs">
                {t('Від')} {formatDateTime(item.Created)} {item.User?.LastName || ''}
              </Text>
            </Box>
            <Stack align="flex-end" gap={2}>
              <Text fw={700} size="sm">
                {formatAmount(item.TotalAmount)} EUR
              </Text>
              <Text c="dimmed" size="xs">
                {formatQty(item.Qty)} {t('штук')} · {formatQty(item.TotalWeight)} {t('Вага')}
              </Text>
            </Stack>
          </Group>
        </Card>
      ))}
    </Stack>
  )
}

function useBasketSalesColumns({
  isSelected,
  onOpen,
  t,
  toggleSelected,
}: {
  isSelected: (sale: BasketSale) => boolean
  onOpen: (sale: BasketSale) => void
  t: (key: string) => string
  toggleSelected: (sale: BasketSale) => void
}) {
  return useMemo<Array<DataTableColumn<BasketSale>>>(
    () => [
      {
        id: 'select',
        header: '',
        cell: (sale) => (
          <Checkbox
            aria-label={t('Обрати')}
            checked={isSelected(sale)}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              event.stopPropagation()
              toggleSelected(sale)
            }}
          />
        ),
        width: 56,
        enableSorting: false,
      },
      {
        id: 'date',
        header: t('Від якої дати'),
        accessor: (sale) => formatDateTime(sale.ChangedToInvoice || sale.FromDate),
        width: 150,
      },
      {
        id: 'number',
        header: t('Номер'),
        accessor: (sale) => sale.SaleNumber?.Value || sale.NetUid || '',
        width: 140,
      },
      {
        id: 'client',
        header: t('Клієнт'),
        accessor: (sale) => sale.ClientAgreement?.Client?.FullName || '',
        minWidth: 240,
      },
      {
        id: 'positions',
        header: t('К-сть позицій'),
        accessor: (sale) => sale.Order?.OrderItems?.length || 0,
        width: 120,
        align: 'right',
      },
      {
        id: 'eur',
        header: `${t('Вартість Брутто')} (EUR)`,
        accessor: (sale) => toNumber(sale.TotalAmount),
        cell: (sale) => <span className="app-money">{formatAmount(sale.TotalAmount)}</span>,
        width: 150,
        align: 'right',
      },
      {
        id: 'pln',
        header: `${t('Вартість Брутто')} (PLN)`,
        accessor: (sale) => toNumber(sale.TotalAmountLocal),
        cell: (sale) => <span className="app-money">{formatAmount(sale.TotalAmountLocal)}</span>,
        width: 150,
        align: 'right',
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        accessor: (sale) => sale.User?.LastName || sale.User?.FullName || '',
        width: 160,
      },
      {
        id: 'actions',
        header: '',
        cell: (sale) => (
          <Tooltip label={t('Переглянути')}>
            <ActionIcon
              aria-label={t('Переглянути')}
              size="sm"
              variant="subtle"
              onClick={(event) => {
                event.stopPropagation()
                onOpen(sale)
              }}
            >
              <Eye size={16} />
            </ActionIcon>
          </Tooltip>
        ),
        width: 72,
        enableSorting: false,
      },
    ],
    [isSelected, onOpen, t, toggleSelected],
  )
}

function useCartSourceColumns({
  isSelected,
  openReserveModal,
  t,
  toggleSelected,
}: {
  isSelected: (item: SupplyOrderUkraineCartItem) => boolean
  openReserveModal: (item: SupplyOrderUkraineCartItem) => void
  t: (key: string) => string
  toggleSelected: (item: SupplyOrderUkraineCartItem) => void
}) {
  return useMemo<Array<DataTableColumn<SupplyOrderUkraineCartItem>>>(
    () => [
      {
        id: 'select',
        header: '',
        cell: (item) => (
          <Checkbox
            aria-label={t('Обрати')}
            checked={isSelected(item)}
            disabled={!canMoveCartItem(item)}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              event.stopPropagation()
              toggleSelected(item)
            }}
          />
        ),
        width: 56,
        enableSorting: false,
      },
      {
        id: 'priority',
        header: '',
        cell: (item) => <PriorityBadge priority={item.ItemPriority} />,
        width: 58,
      },
      {
        id: 'vendorCode',
        header: t('Код Виробника'),
        accessor: (item) => item.Product?.VendorCode || '',
        width: 140,
      },
      {
        id: 'reservedQty',
        header: t('Зарезервована К-сть'),
        accessor: (item) => toNumber(item.ReservedQty),
        cell: (item) => formatQty(item.ReservedQty),
        width: 130,
        align: 'right',
      },
      {
        id: 'availableQty',
        header: t('Доступна К-сть'),
        accessor: (item) => toNumber(item.AvailableQty),
        cell: (item) => formatQty(item.AvailableQty),
        width: 130,
        align: 'right',
      },
      {
        id: 'fromDate',
        header: t('Від якої дати'),
        accessor: (item) => formatDate(item.FromDate),
        width: 130,
      },
      {
        id: 'productName',
        header: t('Назва товару'),
        accessor: (item) => item.Product?.Name || '',
        minWidth: 280,
      },
      {
        id: 'actions',
        header: '',
        cell: (item) => (
          <Tooltip label={t('Резерв')}>
            <ActionIcon
              aria-label={t('Резерв')}
              disabled={Boolean(item.IsDirty)}
              size="sm"
              variant="subtle"
              onClick={(event) => {
                event.stopPropagation()
                openReserveModal(item)
              }}
            >
              <Pencil size={16} />
            </ActionIcon>
          </Tooltip>
        ),
        width: 72,
        enableSorting: false,
      },
    ],
    [isSelected, openReserveModal, t, toggleSelected],
  )
}

function useCartDestinationColumns({
  isSelected,
  t,
  toggleSelected,
  updateQty,
}: {
  isSelected: (item: SupplyOrderUkraineCartItem) => boolean
  t: (key: string) => string
  toggleSelected: (item: SupplyOrderUkraineCartItem) => void
  updateQty: (item: SupplyOrderUkraineCartItem, qty: number | '') => void
}) {
  return useMemo<Array<DataTableColumn<SupplyOrderUkraineCartItem>>>(
    () => [
      {
        id: 'select',
        header: '',
        cell: (item) => (
          <Checkbox
            aria-label={t('Обрати')}
            checked={isSelected(item)}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              event.stopPropagation()
              toggleSelected(item)
            }}
          />
        ),
        width: 56,
        enableSorting: false,
      },
      {
        id: 'vendorCode',
        header: t('Код Виробника'),
        accessor: (item) => item.Product?.VendorCode || '',
        width: 140,
      },
      {
        id: 'fromDate',
        header: t('Від якої дати'),
        accessor: (item) => formatDate(item.FromDate),
        width: 130,
      },
      {
        id: 'productName',
        header: t('Назва товару'),
        accessor: (item) => item.Product?.Name || '',
        minWidth: 280,
      },
      {
        id: 'changedQty',
        header: t('К-сть'),
        cell: (item) => (
          <NumberInput
            allowDecimal={false}
            disabled={Boolean(item.IsFromFile)}
            max={toNumber(item.ReservedQty)}
            min={1}
            size="xs"
            value={item.ChangedQty || item.ReservedQty || ''}
            onChange={(value) => updateQty(item, toPositiveNumber(value))}
            onClick={(event) => event.stopPropagation()}
          />
        ),
        accessor: (item) => toNumber(item.ChangedQty || item.ReservedQty),
        width: 150,
        align: 'right',
      },
      {
        id: 'source',
        header: t('Джерело'),
        cell: (item) => (
          <Badge className={item.IsFromFile ? 'app-role-pill is-orange' : 'app-role-pill is-gray'} variant="light">
            {item.IsFromFile ? t('Файл') : t('Кошик')}
          </Badge>
        ),
        width: 120,
      },
    ],
    [isSelected, t, toggleSelected, updateQty],
  )
}

function PriorityBadge({ priority }: { priority?: SupplyOrderUkraineCartItemPriority }) {
  const { t } = useI18n()
  const color =
    priority === SUPPLY_ORDER_UKRAINE_CART_ITEM_PRIORITY.High
      ? 'is-red'
      : priority === SUPPLY_ORDER_UKRAINE_CART_ITEM_PRIORITY.TIR
        ? 'is-orange'
        : priority === SUPPLY_ORDER_UKRAINE_CART_ITEM_PRIORITY.Low
          ? 'is-green'
          : 'is-gray'

  return (
    <Badge className={`app-role-pill ${color}`} size="sm" variant="light">
      {getPriorityLabel(priority, t)}
    </Badge>
  )
}

async function createTaxFreeDocument(
  documentState: BasketSupplyDocumentState,
  notSentTaxFreePackLists: TaxFreePackList[],
  documentItems: SupplyOrderUkraineCartItem[],
): Promise<CreatedDocumentState> {
  const selectedPackList = documentState.isSelectExistingDocument
    ? findDocumentByNetUid(notSentTaxFreePackLists, documentState.existingTaxFreeNetUid)
    : null

  if (documentState.isSelectExistingDocument && !selectedPackList) {
    throw new Error('TaxFree pack list is not selected')
  }

  const packList: TaxFreePackList = selectedPackList
    ? {
        ...selectedPackList,
        SupplyOrderUkraineCartItems: [...(selectedPackList.SupplyOrderUkraineCartItems || []), ...documentItems],
      }
    : {
        SupplyOrderUkraineCartItems: documentItems,
      }

  const result = await addOrUpdateTaxFreePackList(packList)

  return {
    kind: 'TaxFree',
    netUid: result?.NetUid,
    number: result?.Number,
  }
}

async function createSadDocument(
  documentState: BasketSupplyDocumentState,
  notSentSads: Sad[],
  documentItems: SupplyOrderUkraineCartItem[],
): Promise<CreatedDocumentState> {
  const selectedSad = documentState.isSelectExistingDocument ? findDocumentByNetUid(notSentSads, documentState.existingSadNetUid) : null

  if (documentState.isSelectExistingDocument && !selectedSad) {
    throw new Error('SAD is not selected')
  }

  const sadItems = documentItems.map((item) => ({
    Qty: item.UploadedQty || item.ChangedQty || item.ReservedQty,
    SupplyOrderUkraineCartItem: item,
  }))
  const sad: Sad = selectedSad
    ? {
        ...selectedSad,
        SadItems: [...(selectedSad.SadItems || []), ...sadItems],
        SadType: documentState.sadType,
      }
    : {
        SadItems: sadItems,
        SadType: documentState.sadType,
      }

  const result = await addOrUpdateSad(sad)

  return {
    kind: 'SAD',
    netUid: result?.NetUid,
    number: result?.Number,
    sadType: documentState.sadType,
  }
}

async function createSaleTaxFreeDocument(
  documentState: BasketSupplyDocumentState,
  notSentTaxFreePackLists: TaxFreePackList[],
  sales: BasketSale[],
): Promise<CreatedDocumentState> {
  const selectedPackList = documentState.isSelectExistingDocument
    ? findDocumentByNetUid(notSentTaxFreePackLists, documentState.existingTaxFreeNetUid)
    : null

  if (documentState.isSelectExistingDocument && !selectedPackList) {
    throw new Error('TaxFree pack list is not selected')
  }

  const packList: TaxFreePackList = selectedPackList
    ? {
        ...selectedPackList,
        Sales: [...(selectedPackList.Sales || []), ...sales],
      }
    : {
        Sales: sales,
      }

  const result = await addOrUpdateSaleTaxFreePackList(packList)

  return {
    kind: 'TaxFree',
    netUid: result?.NetUid,
    number: result?.Number,
  }
}

async function createSaleSadDocument(
  documentState: BasketSupplyDocumentState,
  notSentSads: Sad[],
  sales: BasketSale[],
): Promise<CreatedDocumentState> {
  const selectedSad = documentState.isSelectExistingDocument ? findDocumentByNetUid(notSentSads, documentState.existingSadNetUid) : null

  if (documentState.isSelectExistingDocument && !selectedSad) {
    throw new Error('SAD is not selected')
  }

  const sad: Sad = selectedSad
    ? {
        ...selectedSad,
        SadType: documentState.sadType,
        Sales: [...(selectedSad.Sales || []), ...sales],
      }
    : {
        SadType: documentState.sadType,
        Sales: sales,
      }

  const result = await addOrUpdateSaleSad(sad)

  return {
    kind: 'SAD',
    netUid: result?.NetUid,
    number: result?.Number,
    sadType: documentState.sadType,
  }
}

function getCreatedDocumentPath(document: CreatedDocumentState): string | null {
  if (!document.netUid) {
    return null
  }

  if (document.kind === 'TaxFree') {
    return `/tax-free/pack-list/edit/${document.netUid}`
  }

  if (document.sadType === SAD_TYPES.TIR) {
    return `/sad/edit/${document.netUid}/tir`
  }

  return `/sad/edit/${document.netUid}`
}

function getCreatedSaleDocumentPath(document: CreatedDocumentState): string | null {
  if (!document.netUid) {
    return null
  }

  if (document.kind === 'TaxFree') {
    return `/tax-free/pack-list/edit/${document.netUid}`
  }

  if (document.sadType === SAD_TYPES.TIR) {
    return `/sad/edit/${document.netUid}/tir`
  }

  return `/sad/edit/${document.netUid}/sale`
}

function countItems<TItem>(items: TItem[], matches: (item: TItem) => boolean) {
  return items.reduce((count, item) => (matches(item) ? count + 1 : count), 0)
}

function collectSelectionKeys<TItem>(
  items: TItem[],
  selectedIds: ReadonlySet<string>,
  getKey: (item: TItem) => string,
  matches?: (item: TItem) => boolean,
) {
  const keys: string[] = []
  let hasUnselected = false

  items.forEach((item) => {
    if (matches && !matches(item)) {
      return
    }

    const key = getKey(item)

    keys.push(key)

    if (!selectedIds.has(key)) {
      hasUnselected = true
    }
  })

  return { hasUnselected, keys }
}

function collectSelectedItems<TItem>(items: TItem[], selectedIds: ReadonlySet<string>, getKey: (item: TItem) => string) {
  const selectedItems: TItem[] = []
  const selectedKeySet = new Set<string>()

  items.forEach((item) => {
    const key = getKey(item)

    if (!selectedIds.has(key)) {
      return
    }

    selectedItems.push(item)
    selectedKeySet.add(key)
  })

  return { items: selectedItems, keySet: selectedKeySet }
}

function mergeDestinationItems(
  currentItems: SupplyOrderUkraineCartItem[],
  itemsToAdd: SupplyOrderUkraineCartItem[],
): SupplyOrderUkraineCartItem[] {
  const nextItems = [...currentItems]

  itemsToAdd.forEach((item) => {
    const itemKey = getCartItemKey(item)
    const existingIndex = nextItems.findIndex((currentItem) => getCartItemKey(currentItem) === itemKey)

    if (existingIndex === -1) {
      nextItems.push({
        ...item,
        ChangedQty: item.ChangedQty || item.ReservedQty,
        IsSelected: false,
      })
    }
  })

  return nextItems
}

function mergeBasketSales(currentSales: BasketSale[], salesToAdd: BasketSale[]): BasketSale[] {
  const nextSales = [...currentSales]

  salesToAdd.forEach((sale) => {
    const saleKey = getBasketSaleKey(sale)

    if (!nextSales.some((currentSale) => getBasketSaleKey(currentSale) === saleKey)) {
      nextSales.push({
        ...sale,
        IsSelected: false,
      })
    }
  })

  return nextSales
}

function filterCartItems(items: SupplyOrderUkraineCartItem[], filters: CartFilterState) {
  const normalizedSearch = filters.search.trim().toLocaleLowerCase()

  return items.filter((item) => {
    const productName = item.Product?.Name?.toLocaleLowerCase() || ''
    const vendorCode = item.Product?.VendorCode?.toLocaleLowerCase() || ''
    const matchesSearch = !normalizedSearch || productName.includes(normalizedSearch) || vendorCode.includes(normalizedSearch)
    const matchesPriority = filters.priority === 'all' || String(item.ItemPriority || '') === filters.priority
    const matchesAvailability =
      filters.availability === 'all' ||
      (filters.availability === 'reserved' && toNumber(item.ReservedQty) > 0) ||
      (filters.availability === 'available' && toNumber(item.AvailableQty) > 0)

    return matchesSearch && matchesPriority && matchesAvailability
  })
}

function toCartItemsForDocument(items: SupplyOrderUkraineCartItem[]) {
  return items.map((item) => ({
    ...item,
    IsSelected: false,
    UploadedQty: item.ChangedQty || item.ReservedQty,
  }))
}

function sortCartItems(items: SupplyOrderUkraineCartItem[]) {
  return items.toSorted((left, right) => {
    const reservedDiff = toNumber(right.ReservedQty) - toNumber(left.ReservedQty)

    if (reservedDiff !== 0) {
      return reservedDiff
    }

    return toNumber(right.AvailableQty) - toNumber(left.AvailableQty)
  })
}

function createInitialDocumentState(): BasketSupplyDocumentState {
  return {
    documentType: 'taxFree',
    existingSadNetUid: '',
    existingTaxFreeNetUid: '',
    isSelectExistingDocument: false,
    sadType: SAD_TYPES.Sad,
  }
}

function canMoveCartItem(item: SupplyOrderUkraineCartItem) {
  return toNumber(item.ReservedQty) > 0
}

function toggleSetValue(currentSet: Set<string>, value: string) {
  const nextSet = new Set(currentSet)

  if (nextSet.has(value)) {
    nextSet.delete(value)
  } else {
    nextSet.add(value)
  }

  return nextSet
}

function findDocumentByNetUid<TDocument extends { Id?: number; NetUid?: string }>(
  documents: TDocument[],
  netUidOrId: string,
): TDocument | null {
  return documents.find((document) => document.NetUid === netUidOrId || String(document.Id || '') === netUidOrId) || null
}

function getActiveTab(pathname: string): BasketSupplyWorkflowTab {
  if (pathname.endsWith('/sales')) {
    return 'sales'
  }

  if (pathname.endsWith('/recommendations')) {
    return 'recommendations'
  }

  if (pathname.endsWith('/dashboard')) {
    return 'dashboard'
  }

  if (pathname.endsWith('/cockpit')) {
    return 'cockpit'
  }

  if (pathname.endsWith('/budget-cart')) {
    return 'budget-cart'
  }

  return 'cart'
}

function getTabPath(tab: BasketSupplyWorkflowTab) {
  if (tab === 'sales') {
    return '/basket-supply-ukraine-order/sales'
  }

  if (tab === 'recommendations') {
    return '/basket-supply-ukraine-order/recommendations'
  }

  if (tab === 'dashboard') {
    return '/basket-supply-ukraine-order/dashboard'
  }

  if (tab === 'cockpit') {
    return '/basket-supply-ukraine-order/cockpit'
  }

  if (tab === 'budget-cart') {
    return '/basket-supply-ukraine-order/budget-cart'
  }

  return '/basket-supply-ukraine-order'
}

function getCartItemKey(item: SupplyOrderUkraineCartItem, fallbackIndex?: number) {
  const netUid = normalizeNetUid(item.NetUid)

  if (netUid) {
    return `net:${netUid}`
  }

  if (typeof item.Id === 'number' && item.Id > 0) {
    return `id:${item.Id}`
  }

  const productKey = [
    item.ProductId,
    normalizeNetUid(item.Product?.NetUid),
    item.Product?.Id,
    item.Product?.VendorCode,
  ].find((value) => value !== undefined && value !== null && String(value).trim() !== '')

  return [
    'cart-item',
    productKey || 'product',
    item.FromDate || 'no-date',
    item.UploadedQty ?? item.ChangedQty ?? item.TempQty ?? item.AvailableQty ?? 'no-qty',
    fallbackIndex ?? 'no-index',
  ].map((part) => String(part)).join(':')
}

function normalizeNetUid(value?: string | null) {
  const normalized = value?.trim()

  if (!normalized || normalized === EMPTY_NET_UID) {
    return ''
  }

  return normalized
}

function getBasketSaleKey(sale: BasketSale) {
  return sale.NetUid || String(sale.Id || sale.SaleNumber?.Value || '')
}

function getBasketSaleClientId(sale?: BasketSale) {
  if (!sale?.ClientAgreement) {
    return ''
  }

  return String(sale.ClientAgreement.ClientId || sale.ClientAgreement.Client?.NetUid || sale.ClientAgreement.Client?.Id || '')
}

function getPriorityLabel(priority: SupplyOrderUkraineCartItemPriority | undefined, t: (key: string) => string) {
  if (priority === SUPPLY_ORDER_UKRAINE_CART_ITEM_PRIORITY.High) {
    return t('Високий')
  }

  if (priority === SUPPLY_ORDER_UKRAINE_CART_ITEM_PRIORITY.TIR) {
    return t('TIR')
  }

  if (priority === SUPPLY_ORDER_UKRAINE_CART_ITEM_PRIORITY.Low) {
    return t('Низький')
  }

  return ''
}

function formatDate(value: Date | string | undefined) {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleDateString('uk-UA')
}

function formatDateTime(value: Date | string | undefined) {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleString('uk-UA')
}

function formatAmount(value: unknown) {
  return amountFormatter.format(toNumber(value))
}

function formatQty(value: unknown) {
  return qtyFormatter.format(toNumber(value))
}

function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value || 0)
}

function toPositiveNumber(value: number | string): number | '' {
  const nextValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : ''
}

function toPositiveNumberOrZero(value: number | string): number | '' {
  const nextValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(nextValue) && nextValue >= 0 ? nextValue : ''
}

function getDateShiftedByDays(days: number): string {
  const date = new Date()

  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}
