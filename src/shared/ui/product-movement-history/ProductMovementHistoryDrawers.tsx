import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { Archive, ChevronLeft, ChevronRight, CircleAlert, Download, LockKeyhole, Minus, Plus, RefreshCw, TriangleAlert } from 'lucide-react'
import { DocumentExportModal } from '../document-export-modal/DocumentExportModal'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { apiRequest } from '../../api/apiClient'
import { formatLocalDate } from '../../date/dateTime'
import { requireExportDocument, type ExportDocument } from '../../documents/exportDocument'
import { useI18n } from '../../i18n/useI18n'
import { AppDrawer } from '../AppDrawer'
import { DataTable } from '../data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../data-table/types'
import {
  buildProductIncomeMovementTree,
  formatProductIncomeMovementDateTime,
  hasCrossSourceStockCollision,
  type ProductIncomeMovementTreeRow,
} from './productIncomeMovementTree'
import {
  buildHistoricalSourceAnchors,
  isSafeHistoricalSourceMovement,
  type HistoricalSourceAnchor,
  type HistoricalSourceMovement,
} from './historicalSourceAnchors'
import {
  isSafeInformationalMovement,
  type InformationalMovement,
} from './informationalMovements'
import './product-movement-history-drawers.css'

export type MovementHistoryProduct = {
  Name?: string
  NameUA?: string
  NetUid?: string
  VendorCode?: string
}

export type ProductMovementHistoryTab = 'movement' | 'income' | 'outcome' | 'historical-source' | 'informational'

type EntityFields = {
  Created?: Date | string
  Deleted?: boolean
  Id?: number
  NetUid?: string
  Updated?: Date | string
}

type ProductMovement = EntityFields & {
  AccountingPrice?: number
  ClientName?: string
  Comment?: string
  Discount?: number
  DocumentFromDate?: Date | string
  DocumentNumber?: string | number
  DocumentType?: string
  FromDate?: Date | string
  IncomeDocumentFromDate?: Date | string
  IncomeDocumentNumber?: string | number
  IncomeQty?: number
  IsEdited?: boolean
  MovementType?: string
  OrganizationName?: string
  OutcomeQty?: number
  Price?: number
  Responsible?: string
  StorageName?: string
  UserName?: string
}

type ProductIncomeMovement = EntityFields & {
  AccountingEurUnitPrice?: number
  AccountingGrossPrice?: number
  Currency?: string
  ExchangeRate?: number
  FromInvoiceDate?: Date | string
  FromInvoiceNumber?: string | number
  GrossPrice?: number
  ImportedForAmg?: boolean | null
  IncomeInvoiceDate?: Date | string
  IncomeInvoiceNumber?: string | number
  IncomeQty?: number
  IncomeToStorageDate?: Date | string
  IncomeToStorageNumber?: string | number
  IsHide?: boolean
  ManagementEurUnitPrice?: number
  NetPrice?: number
  OrganizationName?: string
  PriceDifference?: number
  RemainingQty?: number
  ReturnPrice?: number
  SourceDocumentId?: string | null
  SourceDocumentType?: number | null
  StorageName?: string
  SupplierName?: string
  TotalNetPrice?: number
  UnitPriceLocal?: number
  Weight?: number
}

type ProductOutcomeMovement = EntityFields & {
  ClientName?: string
  DocumentNumber?: string | number
  DocumentTypeName?: string
  FromDate?: Date | string
  HasUpdateDataCarrier?: boolean
  OrganizationName?: string
  Price?: number
  Qty?: number
  ResponsibleName?: string
  StorageName?: string
}

type ProductStorageLocationHistory = EntityFields & {
  AdditionType?: number
  Placement?: string
  Product?: MovementHistoryProduct | null
  Qty?: number
  Storage?: {
    Name?: string
  } | null
  StorageLocationType?: number
  TotalRowsQty?: number
  User?: {
    FirstName?: string
    LastName?: string
  } | null
}

type ProductMovementExportDocument = ExportDocument

type ProductMovementExportState = {
  document: ProductMovementExportDocument
  key: string
}

type ProductMovementParams = {
  from: string
  movementType: number
  productNetId: string
  to: string
  types: number[]
}

type ProductIncomeOutcomeMovementParams = {
  from: string
  productNetId: string
  to: string
}

type InformationalMovementParams = {
  from: string
  limit: number
  offset: number
  productNetId?: string
  to: string
}

type ProductStorageLocationHistoryParams = {
  from: string
  limit: number
  offset: number
  productNetId: string
  to: string
}

type StorageLocationDrawerState = {
  dateFrom: string
  dateTo: string
  error: string | null
  isLoading: boolean
  loadedProductNetUid: string
  page: number
  pageSize: number
  rows: ProductStorageLocationHistory[]
}

type StorageLocationDrawerAction =
  | { type: 'load-failed'; error: string; productNetUid: string }
  | { type: 'load-started' }
  | { type: 'load-succeeded'; productNetUid: string; rows: ProductStorageLocationHistory[] }
  | { type: 'next-page' }
  | { type: 'previous-page' }
  | { type: 'set-date-from'; value: string }
  | { type: 'set-date-to'; value: string }
  | { type: 'set-page-size'; value: number }

type ProductMovementFilterState = {
  dateFrom: string
  dateTo: string
  movementType: string
  selectedTypes: number[]
}

type ProductMovementFilterAction =
  | { type: 'reset-selected-types' }
  | { type: 'set-date-from'; value: string }
  | { type: 'set-date-to'; value: string }
  | { type: 'set-movement-type'; value: string }
  | { type: 'toggle-selected-type'; value: number }

type MovementDateState = {
  dateFrom: string
  dateTo: string
}

type MovementDateAction =
  | { type: 'set-date-from'; value: string }
  | { type: 'set-date-to'; value: string }

type MovementRowsState<TRow> = {
  error: string | null
  isLoading: boolean
  rows: TRow[]
}

type MovementRowsAction<TRow> =
  | { type: 'clear-error' }
  | { type: 'load-failed'; error: string }
  | { type: 'load-started' }
  | { type: 'load-succeeded'; rows: TRow[] }
  | { type: 'set-error'; error: string }

type ProductMovementExportModalState = {
  documentState: ProductMovementExportState | null
  exportingKey: string | null
}

type ProductMovementExportModalAction =
  | { type: 'close-document' }
  | { type: 'export-finished' }
  | { type: 'export-started'; key: string }
  | { type: 'export-succeeded'; document: ProductMovementExportDocument; key: string }

const MOVEMENT_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['incomeDocumentNumber', 'documentType'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const INCOME_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['storageName', 'incomeToStorageNumber'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const OUTCOME_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['fromDate', 'documentTypeName'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const STORAGE_LOCATION_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['created', 'product'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const movementItemTypes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const movementItemTypeOptions: Array<{ label: string; value: number }> = [
  { label: 'Реалізація', value: 0 },
  { label: 'Повернення', value: 1 },
  { label: 'Акт редагування накладної', value: 2 },
  { label: 'Прихід товару', value: 3 },
  { label: 'Прихід на Україну', value: 4 },
  { label: 'Акт списання', value: 5 },
  { label: 'Повернення постачальнику', value: 6 },
  { label: 'Переміщення товару', value: 7 },
  { label: 'ВМД', value: 8 },
  { label: 'Tax Free', value: 9 },
  { label: 'Рух кошика', value: 10 },
  { label: 'Оприбуткування', value: 11 },
  { label: 'Акт редагування накладної (склад)', value: 12 },
]
const movementTypeOptions = [
  { label: 'Загальний рух', value: '0' },
  { label: 'Бухгалтерський рух', value: '1' },
  { label: 'Управлінський рух', value: '2' },
]
const pageSizeOptions = ['20', '40', '60', '100']
const INFORMATIONAL_PAGE_SIZE = 200

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

function createStorageLocationDrawerState(): StorageLocationDrawerState {
  return {
    dateFrom: getTodayDate(),
    dateTo: getTodayDate(),
    error: null,
    isLoading: false,
    loadedProductNetUid: '',
    page: 1,
    pageSize: 20,
    rows: [],
  }
}

function storageLocationDrawerReducer(
  state: StorageLocationDrawerState,
  action: StorageLocationDrawerAction,
): StorageLocationDrawerState {
  switch (action.type) {
    case 'load-failed':
      return {
        ...state,
        error: action.error,
        isLoading: false,
        loadedProductNetUid: action.productNetUid,
        rows: [],
      }
    case 'load-started':
      return {
        ...state,
        error: null,
        isLoading: true,
        rows: [],
      }
    case 'load-succeeded':
      return {
        ...state,
        isLoading: false,
        loadedProductNetUid: action.productNetUid,
        rows: action.rows,
      }
    case 'next-page':
      return {
        ...state,
        page: state.page + 1,
      }
    case 'previous-page':
      return {
        ...state,
        page: Math.max(1, state.page - 1),
      }
    case 'set-date-from':
      return {
        ...state,
        dateFrom: action.value,
        page: 1,
      }
    case 'set-date-to':
      return {
        ...state,
        dateTo: action.value,
        page: 1,
      }
    case 'set-page-size':
      return {
        ...state,
        page: 1,
        pageSize: action.value,
      }
  }
}

function createProductMovementFilterState(): ProductMovementFilterState {
  return {
    dateFrom: getTodayDate(),
    dateTo: getTodayDate(),
    movementType: '0',
    selectedTypes: movementItemTypes,
  }
}

function productMovementFilterReducer(
  state: ProductMovementFilterState,
  action: ProductMovementFilterAction,
): ProductMovementFilterState {
  switch (action.type) {
    case 'reset-selected-types':
      return {
        ...state,
        selectedTypes: movementItemTypes,
      }
    case 'set-date-from':
      return {
        ...state,
        dateFrom: action.value,
      }
    case 'set-date-to':
      return {
        ...state,
        dateTo: action.value,
      }
    case 'set-movement-type':
      return {
        ...state,
        movementType: action.value,
      }
    case 'toggle-selected-type':
      return {
        ...state,
        selectedTypes: state.selectedTypes.includes(action.value)
          ? state.selectedTypes.filter((type) => type !== action.value)
          : state.selectedTypes.concat(action.value),
      }
  }
}

function createMovementDateState(): MovementDateState {
  return {
    dateFrom: getTodayDate(),
    dateTo: getTodayDate(),
  }
}

function movementDateReducer(state: MovementDateState, action: MovementDateAction): MovementDateState {
  switch (action.type) {
    case 'set-date-from':
      return {
        ...state,
        dateFrom: action.value,
      }
    case 'set-date-to':
      return {
        ...state,
        dateTo: action.value,
      }
  }
}

function createMovementRowsState<TRow>(): MovementRowsState<TRow> {
  return {
    error: null,
    isLoading: false,
    rows: [],
  }
}

function movementRowsReducer<TRow>(
  state: MovementRowsState<TRow>,
  action: MovementRowsAction<TRow>,
): MovementRowsState<TRow> {
  switch (action.type) {
    case 'clear-error':
      return {
        ...state,
        error: null,
      }
    case 'load-failed':
      return {
        ...state,
        error: action.error,
        isLoading: false,
        rows: [],
      }
    case 'load-started':
      return {
        ...state,
        error: null,
        isLoading: true,
        rows: [],
      }
    case 'load-succeeded':
      return {
        ...state,
        isLoading: false,
        rows: action.rows,
      }
    case 'set-error':
      return {
        ...state,
        error: action.error,
      }
  }
}

function createProductMovementExportModalState(): ProductMovementExportModalState {
  return {
    documentState: null,
    exportingKey: null,
  }
}

function productMovementExportModalReducer(
  state: ProductMovementExportModalState,
  action: ProductMovementExportModalAction,
): ProductMovementExportModalState {
  switch (action.type) {
    case 'close-document':
      return {
        ...state,
        documentState: null,
        exportingKey: null,
      }
    case 'export-finished':
      return {
        ...state,
        exportingKey: null,
      }
    case 'export-started':
      return {
        ...state,
        documentState: null,
        exportingKey: action.key,
      }
    case 'export-succeeded':
      return {
        ...state,
        documentState: {
          document: action.document,
          key: action.key,
        },
      }
  }
}

export function ProductMovementHistoryDrawer({
  initialTab = 'movement',
  opened,
  product,
  onClose,
}: {
  initialTab?: ProductMovementHistoryTab
  opened: boolean
  product: MovementHistoryProduct | null
  onClose: () => void
}) {
  const productNetUid = product?.NetUid?.trim() || ''
  const productKey = productNetUid || product?.VendorCode || product?.Name || product?.NameUA || 'closed'

  return (
    <ProductMovementHistoryDrawerContent
      key={`${productKey}-${initialTab}`}
      initialTab={initialTab}
      opened={opened}
      product={product}
      onClose={onClose}
    />
  )
}

function ProductMovementHistoryDrawerContent({
  initialTab,
  opened,
  product,
  onClose,
}: {
  initialTab: ProductMovementHistoryTab
  opened: boolean
  product: MovementHistoryProduct | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<ProductMovementHistoryTab>(initialTab)
  const title = product ? `${t('Рух товару')}: ${getProductTitle(product)}` : t('Рух товару')

  return (
    <AppDrawer opened={opened && Boolean(product)} position="right" size="min(1280px, 98vw)" title={title} onClose={onClose}>
      {product ? (
        <Card
          className="app-data-card product-movement-history-shell"
          withBorder
          radius="md"
          padding={0}
        >
        <Tabs
          className="product-movement-history-tabs-root"
          value={activeTab}
          onChange={(value) => setActiveTab((value as ProductMovementHistoryTab) || 'movement')}
        >
          <Tabs.List className="pill-tabs product-movement-history-tabs">
            <Tabs.Tab value="movement">{t('Рух')}</Tabs.Tab>
            <Tabs.Tab value="income">{t('Прихід')}</Tabs.Tab>
            <Tabs.Tab value="outcome">{t('Вихід')}</Tabs.Tab>
            <Tabs.Tab leftSection={<Archive size={15} />} value="historical-source">
              {t('Архівні партії 1С')}
            </Tabs.Tab>
            <Tabs.Tab leftSection={<TriangleAlert size={15} />} value="informational">
              {t('Неповні дані 1С')}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="movement" pt={0}>
            <ProductMovementPanel active={opened && activeTab === 'movement'} product={product} />
          </Tabs.Panel>
          <Tabs.Panel value="income" pt={0}>
            <ProductIncomeMovementPanel active={opened && activeTab === 'income'} product={product} />
          </Tabs.Panel>
          <Tabs.Panel value="outcome" pt={0}>
            <ProductOutcomeMovementPanel active={opened && activeTab === 'outcome'} product={product} />
          </Tabs.Panel>
          <Tabs.Panel value="historical-source" pt={0}>
            <HistoricalSourceMovementPanel active={opened && activeTab === 'historical-source'} product={product} />
          </Tabs.Panel>
          <Tabs.Panel value="informational" pt={0}>
            <InformationalMovementPanel active={opened && activeTab === 'informational'} product={product} />
          </Tabs.Panel>
        </Tabs>
        </Card>
      ) : null}
    </AppDrawer>
  )
}

export function ProductStorageLocationHistoryDrawer({
  opened,
  product,
  onClose,
}: {
  opened: boolean
  product: MovementHistoryProduct | null
  onClose: () => void
}) {
  const productNetUid = product?.NetUid?.trim() || ''

  return (
    <ProductStorageLocationHistoryDrawerContent
      key={productNetUid || 'closed'}
      opened={opened}
      product={product}
      onClose={onClose}
    />
  )
}

function ProductStorageLocationHistoryDrawerContent({
  opened,
  product,
  onClose,
}: {
  opened: boolean
  product: MovementHistoryProduct | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const productNetUid = product?.NetUid?.trim() || ''
  const [drawerState, dispatchDrawerState] = useReducer(storageLocationDrawerReducer, undefined, createStorageLocationDrawerState)
  const { dateFrom, dateTo, error, isLoading, loadedProductNetUid, page, pageSize, rows } = drawerState
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const columns = useStorageLocationHistoryColumns()
  const filterError = getDateRangeError(dateFrom, dateTo, t)
  const missingNetUidError = productNetUid ? null : t('У товару немає NetUid для завантаження історії місця зберігання')
  const activeError = filterError || missingNetUidError || error
  const total = rows[0]?.TotalRowsQty
  const canMoveBack = page > 1
  const canMoveForward = typeof total === 'number' ? page * pageSize < total : rows.length === pageSize
  const title = product ? `${t('Історія місця зберігання')}: ${getProductTitle(product)}` : t('Історія місця зберігання')
  const tableRows = loadedProductNetUid === productNetUid ? rows : []

  useEffect(() => {
    if (!opened || !productNetUid || filterError) {
      return
    }

    let cancelled = false
    const offset = (page - 1) * pageSize

    async function loadRows() {
      dispatchDrawerState({ type: 'load-started' })

      try {
        const nextRows = await getProductStorageLocationHistory({
          from: dateFrom,
          limit: pageSize,
          offset,
          productNetId: productNetUid,
          to: dateTo,
        })

        if (!cancelled) {
          dispatchDrawerState({ productNetUid, rows: nextRows, type: 'load-succeeded' })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatchDrawerState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити історію місця зберігання'),
            productNetUid,
            type: 'load-failed',
          })
        }
      }
    }

    void loadRows()

    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, filterError, opened, page, pageSize, productNetUid, reloadKey, t])

  return (
    <AppDrawer opened={opened && Boolean(product)} position="right" size="min(1180px, 98vw)" title={title} onClose={onClose}>
      <Stack gap="md">
        <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
          <TextInput
            label={t('З')}
            type="date"
            value={dateFrom}
            w={150}
            onChange={(event) => {
              dispatchDrawerState({ type: 'set-date-from', value: event.currentTarget.value })
            }}
          />
          <TextInput
            label={t('По')}
            type="date"
            value={dateTo}
            w={150}
            onChange={(event) => {
              dispatchDrawerState({ type: 'set-date-to', value: event.currentTarget.value })
            }}
          />
          <Select
            label={t('Розмір сторінки')}
            data={pageSizeOptions}
            value={String(pageSize)}
            w={140}
            onChange={(value) => {
              dispatchDrawerState({ type: 'set-page-size', value: Number(value || 20) })
            }}
          />
          <Group gap="xs">
            <Button
              disabled={Boolean(filterError || missingNetUidError)}
              leftSection={<RefreshCw size={18} />}
              loading={isLoading}
              variant="outline"
              onClick={() => reload()}
            >
              {t('Оновити')}
            </Button>
            <ActionIcon
              aria-label={t('Попередня сторінка')}
              color="gray"
              disabled={!canMoveBack || isLoading || Boolean(filterError)}
              variant="light"
              onClick={() => dispatchDrawerState({ type: 'previous-page' })}
            >
              <ChevronLeft size={18} />
            </ActionIcon>
            <ActionIcon
              aria-label={t('Наступна сторінка')}
              color="gray"
              disabled={!canMoveForward || isLoading || Boolean(filterError)}
              variant="light"
              onClick={() => dispatchDrawerState({ type: 'next-page' })}
            >
              <ChevronRight size={18} />
            </ActionIcon>
          </Group>
        </Group>
        {activeError ? (
          <Alert color={filterError || missingNetUidError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">
            {activeError}
          </Alert>
        ) : null}
        <DataTable
          columns={columns}
          data={activeError ? [] : tableRows}
          defaultLayout={STORAGE_LOCATION_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Історію місця зберігання не знайдено')}
          getRowId={(row, index) => String(row.NetUid || row.Id || `${row.Created || 'date'}-${index}`)}
          isLoading={isLoading}
          layoutVersion="product-storage-location-history-shared-1"
          loadingText={t('Завантаження історії')}
          maxHeight="calc(100vh - 260px)"
          minWidth={1120}
          tableId="product-storage-location-history"
        />
      </Stack>
    </AppDrawer>
  )
}

function ProductMovementPanel({ active, product }: { active: boolean; product: MovementHistoryProduct }) {
  const { t } = useI18n()
  const productNetUid = product.NetUid?.trim() || ''
  const [filterState, dispatchFilterState] = useReducer(productMovementFilterReducer, undefined, createProductMovementFilterState)
  const { dateFrom, dateTo, movementType, selectedTypes } = filterState
  const [rowsState, dispatchRowsState] = useReducer(
    movementRowsReducer<ProductMovement>,
    undefined,
    createMovementRowsState<ProductMovement>,
  )
  const { error, isLoading, rows } = rowsState
  const [exportModalState, dispatchExportModalState] = useReducer(
    productMovementExportModalReducer,
    undefined,
    createProductMovementExportModalState,
  )
  const { documentState: exportDocumentState, exportingKey } = exportModalState
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const exportRequestRef = useRef(0)
  const columns = useProductMovementColumns()
  const selectedTypeSet = useMemo(() => new Set(selectedTypes), [selectedTypes])
  const filterError = getDateRangeError(dateFrom, dateTo, t)
  const missingNetUidError = productNetUid ? null : t('У товару немає NetUid для завантаження руху товару')
  const typesError = selectedTypes.length === 0 ? t('Оберіть хоча б один тип руху') : null
  const activeError = filterError || missingNetUidError || typesError || error
  const exportKey = `${active}|${productNetUid}|${dateFrom}|${dateTo}|${movementType}|${selectedTypes.join(',')}`
  const exportDocument = exportDocumentState?.key === exportKey ? exportDocumentState.document : null
  const isExporting = exportingKey === exportKey

  useEffect(() => {
    exportRequestRef.current += 1
    dispatchExportModalState({ type: 'close-document' })
  }, [active, dateFrom, dateTo, movementType, productNetUid, selectedTypes])

  useEffect(() => {
    if (!active || filterError || typesError || !productNetUid) {
      return
    }

    let cancelled = false

    async function loadRows() {
      dispatchRowsState({ type: 'load-started' })

      try {
        const nextRows = await getProductMovements({
          from: dateFrom,
          movementType: Number(movementType),
          productNetId: productNetUid,
          to: dateTo,
          types: selectedTypes,
        })

        if (!cancelled) {
          dispatchRowsState({ rows: nextRows, type: 'load-succeeded' })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatchRowsState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити рух товару'),
            type: 'load-failed',
          })
        }
      }
    }

    void loadRows()

    return () => {
      cancelled = true
    }
  }, [active, dateFrom, dateTo, filterError, movementType, productNetUid, reloadKey, selectedTypes, t, typesError])

  function toggleMovementItemType(value: number) {
    dispatchFilterState({ type: 'toggle-selected-type', value })
  }

  async function exportMovements() {
    if (!productNetUid || filterError || typesError || isExporting) {
      return
    }

    const requestId = exportRequestRef.current + 1
    exportRequestRef.current = requestId
    const requestKey = exportKey
    dispatchExportModalState({ key: requestKey, type: 'export-started' })
    dispatchRowsState({ type: 'clear-error' })

    try {
      const nextDocument = await exportProductMovementsDocument({
        from: dateFrom,
        movementType: Number(movementType),
        productNetId: productNetUid,
        to: dateTo,
        types: selectedTypes,
      })

      if (exportRequestRef.current === requestId) {
        dispatchExportModalState({ document: nextDocument, key: requestKey, type: 'export-succeeded' })
      }
    } catch (exportError) {
      if (exportRequestRef.current === requestId) {
        dispatchRowsState({
          error: exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ руху товару'),
          type: 'set-error',
        })
      }
    } finally {
      if (exportRequestRef.current === requestId) {
        dispatchExportModalState({ type: 'export-finished' })
      }
    }
  }

  return (
    <Stack className="product-movement-history-panel" gap={0}>
      <div className="app-filter-bar product-movement-history-filter-bar product-movement-history-filter-bar--extended">
      <Group align="end" gap={10} wrap="nowrap" className="product-movement-history-filter-row">
        <TextInput
          label={t('З')}
          type="date"
          value={dateFrom}
          w={150}
          onChange={(event) => dispatchFilterState({ type: 'set-date-from', value: event.currentTarget.value })}
        />
        <TextInput
          label={t('По')}
          type="date"
          value={dateTo}
          w={150}
          onChange={(event) => dispatchFilterState({ type: 'set-date-to', value: event.currentTarget.value })}
        />
        <Select
          label={t('Тип руху')}
          data={movementTypeOptions.map((option) => ({ ...option, label: t(option.label) }))}
          value={movementType}
          w={220}
          onChange={(value) => dispatchFilterState({ type: 'set-movement-type', value: value || '0' })}
        />
        <div className="app-filter-actions">
        <Button
          disabled={Boolean(filterError) || Boolean(typesError)}
          leftSection={<RefreshCw size={18} />}
          loading={isLoading}
          variant="outline"
          onClick={() => reload()}
        >
          {t('Оновити')}
        </Button>
        <Button
          disabled={!productNetUid || Boolean(filterError) || Boolean(typesError)}
          leftSection={<Download size={18} />}
          loading={isExporting}
          variant="outline"
          onClick={() => void exportMovements()}
        >
          {t('Друк')}
        </Button>
        </div>
      </Group>
      <Group gap="md" wrap="wrap" align="center" className="product-movement-history-types-row">
        {movementItemTypeOptions.map((option) => (
          <Checkbox
            key={option.value}
            checked={selectedTypeSet.has(option.value)}
            label={t(option.label)}
            size="xs"
            onChange={() => toggleMovementItemType(option.value)}
          />
        ))}
        <Button size="xs" color="gray" variant="subtle" onClick={() => dispatchFilterState({ type: 'reset-selected-types' })}>
          {t('Скинути')}
        </Button>
      </Group>
      </div>
      <Stack className="product-movement-history-panel__body" gap="md">
      {activeError ? (
        <Alert color={filterError || missingNetUidError || typesError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">
          {activeError}
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        data={activeError ? [] : rows}
        defaultLayout={MOVEMENT_TABLE_DEFAULT_LAYOUT}
        emptyText={t('Рух товару не знайдено')}
        getRowId={(row, index) => String(row.NetUid || row.Id || `${row.DocumentType || 'document'}-${row.DocumentNumber || 'number'}-${index}`)}
        isLoading={isLoading}
        layoutVersion="product-movement-history-shared-1"
        loadingText={t('Завантаження руху товару')}
        maxHeight="calc(100vh - 390px)"
        minWidth={1640}
        tableId="product-movement-history"
      />
      <ProductDocumentDownloadModal
        document={exportDocument}
        title={t('Документ руху товару')}
        onClose={() => dispatchExportModalState({ type: 'close-document' })}
      />
      </Stack>
    </Stack>
  )
}

export function HistoricalSourceMovementPanel({
  active,
  initialDateFrom,
  product,
}: {
  active: boolean
  initialDateFrom?: string
  product: MovementHistoryProduct
}) {
  const { t } = useI18n()
  const productNetUid = product.NetUid?.trim() || ''
  const [dateFrom, setDateFrom] = useState(() => initialDateFrom || getDateYearsAgo(3))
  const [dateTo, setDateTo] = useState(getTodayDate)
  const [rowsState, dispatchRowsState] = useReducer(
    movementRowsReducer<HistoricalSourceMovement>,
    undefined,
    createMovementRowsState<HistoricalSourceMovement>,
  )
  const { error, isLoading, rows } = rowsState
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const filterError = getDateRangeError(dateFrom, dateTo, t)
  const missingNetUidError = productNetUid ? null : t('У товару немає NetUid для завантаження архівних партій 1С')
  const unsafeRows = useMemo(() => rows.filter((row) => !isSafeHistoricalSourceMovement(row)), [rows])
  const safeRows = useMemo(() => rows.filter(isSafeHistoricalSourceMovement), [rows])
  const anchors = useMemo(() => buildHistoricalSourceAnchors(safeRows), [safeRows])
  const columns = useHistoricalSourceAnchorColumns()
  const documentColumns = useHistoricalSourceDocumentColumns()
  const activeError = filterError || missingNetUidError || error

  useEffect(() => {
    if (!active || filterError || !productNetUid) {
      return
    }

    let cancelled = false

    async function loadRows() {
      dispatchRowsState({ type: 'load-started' })

      try {
        const nextRows = await getHistoricalSourceMovements({
          from: dateFrom,
          productNetId: productNetUid,
          to: dateTo,
        })

        if (!cancelled) {
          dispatchRowsState({ rows: nextRows, type: 'load-succeeded' })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatchRowsState({
            error: loadError instanceof Error
              ? loadError.message
              : t('Не вдалося завантажити архівні партії 1С'),
            type: 'load-failed',
          })
        }
      }
    }

    void loadRows()

    return () => {
      cancelled = true
    }
  }, [active, dateFrom, dateTo, filterError, productNetUid, reloadKey, t])

  return (
    <Stack className="product-movement-history-panel" gap={0}>
      <div className="app-filter-bar product-movement-history-filter-bar">
        <Group align="end" gap={10} wrap="nowrap" className="product-movement-history-filter-row">
          <TextInput label={t('З')} type="date" value={dateFrom} w={150} onChange={(event) => setDateFrom(event.currentTarget.value)} />
          <TextInput label={t('По')} type="date" value={dateTo} w={150} onChange={(event) => setDateTo(event.currentTarget.value)} />
          <div className="app-filter-actions">
            <Button
              disabled={Boolean(filterError || missingNetUidError)}
              leftSection={<RefreshCw size={18} />}
              loading={isLoading}
              variant="outline"
              onClick={() => reload()}
            >
              {t('Оновити')}
            </Button>
          </div>
        </Group>
      </div>
      <Stack className="product-movement-history-panel__body" gap="md">
        <Alert color="gray" icon={<LockKeyhole size={18} />} variant="light">
          {t('Історичні партії з 1С без активної локальної партії. Вони доступні лише для перегляду, не змінюють складську наявність і недоступні для складських операцій.')}
        </Alert>
        {activeError ? (
          <Alert color={filterError || missingNetUidError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">
            {activeError}
          </Alert>
        ) : null}
        {unsafeRows.length > 0 ? (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {t('Частину рядків приховано: сервер не підтвердив read-only стан або відсутність впливу на наявність.')} ({unsafeRows.length})
          </Alert>
        ) : null}
        <DataTable
          columns={columns}
          data={activeError ? [] : anchors}
          defaultLayout={{ columnPinning: { left: ['state', 'batchNumber'] }, density: 'normal' }}
          emptyText={t('Архівних партій 1С у вибраному періоді не знайдено')}
          getRowCanExpand={(row) => row.Documents.length > 0}
          getRowId={(row) => row.AnchorKey}
          isLoading={isLoading}
          layoutVersion="historical-source-movement-1"
          loadingText={t('Завантаження архівних партій 1С')}
          maxHeight="calc(100vh - 360px)"
          minWidth={1420}
          renderExpandedRow={(row) => (
            <HistoricalSourceDocuments columns={documentColumns} row={row} />
          )}
          rowClassName={() => 'historical-source-anchor-row'}
          tableId="historical-source-movement"
        />
      </Stack>
    </Stack>
  )
}

export function InformationalMovementPanel({
  active,
  product,
}: {
  active: boolean
  product?: MovementHistoryProduct
}) {
  const { t } = useI18n()
  const productNetUid = product?.NetUid?.trim() || ''
  const [dateFrom, setDateFrom] = useState(() => getDateYearsAgo(20))
  const [dateTo, setDateTo] = useState(getTodayDate)
  const [page, setPage] = useState(1)
  const [rowsState, dispatchRowsState] = useReducer(
    movementRowsReducer<InformationalMovement>,
    undefined,
    createMovementRowsState<InformationalMovement>,
  )
  const { error, isLoading, rows } = rowsState
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const filterError = getDateRangeError(dateFrom, dateTo, t)
  const missingNetUidError = product && !productNetUid
    ? t('У товару немає NetUid для завантаження неповних даних 1С')
    : null
  const unsafeRows = useMemo(() => rows.filter((row) => !isSafeInformationalMovement(row)), [rows])
  const safeRows = useMemo(() => rows.filter(isSafeInformationalMovement), [rows])
  const columns = useInformationalMovementColumns()
  const activeError = filterError || missingNetUidError || error
  const totalRows = safeRows[0]?.TotalRows || 0
  const canMoveBack = page > 1
  const canMoveForward = page * INFORMATIONAL_PAGE_SIZE < totalRows

  useEffect(() => {
    if (!active || filterError || missingNetUidError) {
      return
    }

    let cancelled = false

    async function loadRows() {
      dispatchRowsState({ type: 'load-started' })

      try {
        const nextRows = await getInformationalMovements({
          from: dateFrom,
          limit: INFORMATIONAL_PAGE_SIZE,
          offset: (page - 1) * INFORMATIONAL_PAGE_SIZE,
          productNetId: productNetUid || undefined,
          to: dateTo,
        })

        if (!cancelled) {
          dispatchRowsState({ rows: nextRows, type: 'load-succeeded' })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatchRowsState({
            error: loadError instanceof Error
              ? loadError.message
              : t('Не вдалося завантажити неповні дані 1С'),
            type: 'load-failed',
          })
        }
      }
    }

    void loadRows()

    return () => {
      cancelled = true
    }
  }, [active, dateFrom, dateTo, filterError, missingNetUidError, page, productNetUid, reloadKey, t])

  return (
    <Stack className="product-movement-history-panel" gap={0}>
      <div className="app-filter-bar product-movement-history-panel__filters">
        <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
          <TextInput
            label={t('З')}
            type="date"
            value={dateFrom}
            w={150}
            onChange={(event) => {
              setPage(1)
              setDateFrom(event.currentTarget.value)
            }}
          />
          <TextInput
            label={t('По')}
            type="date"
            value={dateTo}
            w={150}
            onChange={(event) => {
              setPage(1)
              setDateTo(event.currentTarget.value)
            }}
          />
          <div className="app-filter-actions">
            <Button
              disabled={Boolean(filterError || missingNetUidError)}
              leftSection={<RefreshCw size={18} />}
              loading={isLoading}
              variant="outline"
              onClick={() => reload()}
            >
              {t('Оновити')}
            </Button>
            <ActionIcon
              aria-label={t('Попередня сторінка')}
              color="gray"
              disabled={!canMoveBack || isLoading || Boolean(activeError)}
              variant="light"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            >
              <ChevronLeft size={18} />
            </ActionIcon>
            <ActionIcon
              aria-label={t('Наступна сторінка')}
              color="gray"
              disabled={!canMoveForward || isLoading || Boolean(activeError)}
              variant="light"
              onClick={() => setPage((currentPage) => currentPage + 1)}
            >
              <ChevronRight size={18} />
            </ActionIcon>
          </div>
        </Group>
      </div>
      <Stack className="product-movement-history-panel__body" gap="md">
        <Alert color="yellow" icon={<TriangleAlert size={18} />} variant="light">
          {t('Це неповні або службові записи джерела. Вони показані для діагностики, але не є рухом товару, не змінюють наявність і недоступні для редагування.')}
        </Alert>
        {activeError ? (
          <Alert color={filterError || missingNetUidError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">
            {activeError}
          </Alert>
        ) : null}
        {unsafeRows.length > 0 ? (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {t('Частину рядків приховано: сервер не підтвердив безпечний інформаційний стан.')} ({unsafeRows.length})
          </Alert>
        ) : null}
        {!activeError ? (
          <DataTable
            columns={columns}
            data={safeRows}
            defaultLayout={{ columnPinning: { left: ['state', 'product'] }, density: 'normal' }}
            emptyText={t('Неповних даних 1С у вибраному періоді не знайдено')}
            getRowId={(row) => row.InfoKey}
            isLoading={isLoading}
            layoutVersion="informational-movement-1"
            loadingText={t('Завантаження неповних даних 1С')}
            maxHeight="calc(100vh - 390px)"
            minWidth={1480}
            rowClassName={() => 'informational-movement-row'}
            tableId="informational-movement"
          />
        ) : null}
        {!activeError && totalRows > 0 ? (
          <Text c="dimmed" size="xs">
            {t('Показано')}: {(page - 1) * INFORMATIONAL_PAGE_SIZE + 1}–{Math.min(page * INFORMATIONAL_PAGE_SIZE, totalRows)} / {totalRows}
          </Text>
        ) : null}
      </Stack>
    </Stack>
  )
}

function HistoricalSourceDocuments({
  columns,
  row,
}: {
  columns: DataTableColumn<HistoricalSourceMovement>[]
  row: HistoricalSourceAnchor
}) {
  const { t } = useI18n()

  return (
    <Stack className="historical-source-documents" gap="xs">
      <Group gap="xs" justify="space-between">
        <Text className="app-section-title" fw={600}>{t('Прив’язані документи продажу 1С')}</Text>
        <Text c="dimmed" size="xs">{t('Рядків')}: {row.Documents.length}</Text>
      </Group>
      <DataTable
        columns={columns}
        data={row.Documents}
        enablePinning={false}
        getRowId={(document) => String(document.AllocationId)}
        layoutVersion="historical-source-documents-1"
        maxHeight={360}
        minWidth={1500}
        rowClassName={() => 'historical-source-document-row'}
        showLayoutControls={false}
        tableId="historical-source-documents"
      />
    </Stack>
  )
}

function useInformationalMovementColumns(): DataTableColumn<InformationalMovement>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<InformationalMovement>[]>(() => [
    {
      id: 'state',
      header: t('Стан'),
      width: 165,
      minWidth: 150,
      accessor: (row) => row.StateCode,
      cell: (row) => (
        <Badge color={row.IsKnownFixture ? 'blue' : 'yellow'} variant="light">
          <Group gap={4} wrap="nowrap">
            <LockKeyhole size={12} />
            {row.IsKnownFixture ? t('Тестовий запис') : t('Не є рухом')}
          </Group>
        </Badge>
      ),
    },
    {
      id: 'product',
      header: t('Товар'),
      width: 230,
      minWidth: 190,
      accessor: (row) => `${row.VendorCode || ''} ${row.ProductName || ''}`,
      cell: (row) => (
        <Stack gap={0}>
          <Text fw={600} size="sm">{displayValue(row.VendorCode)}</Text>
          <Text c="dimmed" lineClamp={1} size="xs">{displayValue(row.ProductName)}</Text>
        </Stack>
      ),
    },
    {
      id: 'reason',
      header: t('Чому неповний'),
      width: 245,
      minWidth: 205,
      accessor: (row) => getInformationalReasonLabel(row.ReasonCode, t),
      cell: (row) => getInformationalReasonLabel(row.ReasonCode, t),
    },
    {
      id: 'documentType',
      header: t('Джерело'),
      width: 250,
      minWidth: 210,
      accessor: (row) => row.DocumentType,
      cell: (row) => displayValue(row.DocumentType),
    },
    {
      id: 'documentNumber',
      header: t('Документ'),
      width: 165,
      minWidth: 140,
      accessor: (row) => row.DocumentNumber,
      cell: (row) => displayValue(row.DocumentNumber),
    },
    {
      id: 'documentDate',
      header: t('Дата'),
      width: 150,
      minWidth: 130,
      accessor: (row) => row.DocumentDate,
      cell: (row) => row.DocumentDate ? formatDateTime(row.DocumentDate) : '—',
    },
    {
      id: 'qty',
      header: t('Кількість джерела'),
      width: 135,
      minWidth: 118,
      align: 'right',
      accessor: (row) => row.Qty,
      cell: (row) => formatAmount(row.Qty),
    },
    {
      id: 'missingEvidence',
      header: t('Чого бракує'),
      width: 235,
      minWidth: 195,
      accessor: (row) => getMissingEvidenceLabel(row.MissingEvidenceCode, t),
      cell: (row) => getMissingEvidenceLabel(row.MissingEvidenceCode, t),
    },
    {
      id: 'comment',
      header: t('Коментар'),
      width: 240,
      minWidth: 180,
      accessor: (row) => row.Comment,
      cell: (row) => displayValue(row.Comment),
    },
    {
      id: 'sourceId',
      header: 'Source ID',
      width: 110,
      minWidth: 96,
      align: 'right',
      accessor: (row) => row.SourceItemId,
      cell: (row) => String(row.SourceItemId),
    },
  ], [t])
}

function getInformationalReasonLabel(reasonCode: string, t: (key: string) => string): string {
  switch (reasonCode) {
    case 'AcceptanceTestFixture':
      return t('Службовий acceptance-тест')
    case 'NoPhysicalSource':
      return t('Немає фізичної партії або локації')
    case 'PendingReconciliation':
      return t('Різницю ще не застосовано дією')
    case 'ZeroQuantity':
      return t('Нульова кількість джерела')
    case 'ZeroStockSyncShell':
      return t('Sync-shell без активного залишку')
    default:
      return reasonCode
  }
}

function getMissingEvidenceLabel(evidenceCode: string, t: (key: string) => string): string {
  switch (evidenceCode) {
    case 'ActiveLocalLotOrIncomeMovement':
      return t('Активна локальна партія або прихідний рух')
    case 'ConcreteInventoryAction':
      return t('Конкретна складська дія')
    case 'ConsignmentItemOrReservedLot':
      return t('Партія або резерв фізичної партії')
    case 'LotReservationOrLocation':
      return t('Партія, резерв або складська локація')
    case 'PositiveQuantity':
      return t('Додатна кількість')
    default:
      return evidenceCode
  }
}

function useHistoricalSourceAnchorColumns(): DataTableColumn<HistoricalSourceAnchor>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<HistoricalSourceAnchor>[]>(() => [
    {
      id: 'state',
      header: t('Стан'),
      width: 150,
      minWidth: 140,
      accessor: (row) => row.StateCode,
      cell: () => (
        <Badge color="gray" variant="light">
          <Group gap={4} wrap="nowrap"><LockKeyhole size={12} />{t('Лише історія')}</Group>
        </Badge>
      ),
    },
    {
      id: 'source',
      header: t('Контур 1С'),
      width: 100,
      minWidth: 90,
      accessor: (row) => row.ImportedForAmg ? 'AMG' : 'Fenix',
      cell: (row) => <Badge color={row.ImportedForAmg ? 'orange' : 'blue'} variant="light">{row.ImportedForAmg ? 'AMG' : 'Fenix'}</Badge>,
    },
    {
      id: 'batchNumber',
      header: t('Документ партії'),
      width: 190,
      minWidth: 160,
      accessor: (row) => row.SourceBatchDocumentNumber,
      cell: (row) => (
        <Stack gap={0}>
          <Text size="sm">{displayValue(row.SourceBatchDocumentNumber)}</Text>
          <Text c="dimmed" size="xs">{t('Тип')}: {row.SourceBatchDocumentType}</Text>
        </Stack>
      ),
    },
    {
      id: 'batchDate',
      header: t('Дата партії'),
      width: 150,
      minWidth: 130,
      accessor: (row) => row.SourceBatchDocumentDate,
      cell: (row) => formatDateTime(row.SourceBatchDocumentDate),
    },
    {
      id: 'storage',
      header: t('Склад 1С'),
      width: 210,
      minWidth: 170,
      accessor: (row) => row.SourceStorageName,
      cell: (row) => displayValue(row.SourceStorageName),
    },
    {
      id: 'organization',
      header: t('Організація'),
      width: 230,
      minWidth: 180,
      accessor: (row) => row.SourceOrganizationName,
      cell: (row) => displayValue(row.SourceOrganizationName),
    },
    {
      id: 'qty',
      header: t('Історична к-сть'),
      width: 130,
      minWidth: 112,
      align: 'right',
      accessor: (row) => row.TotalQty,
      cell: (row) => formatAmount(row.TotalQty),
    },
    {
      id: 'documents',
      header: t('Рядків продажу'),
      width: 120,
      minWidth: 108,
      align: 'right',
      accessor: (row) => row.Documents.length,
      cell: (row) => formatAmount(row.Documents.length),
    },
    {
      id: 'saleRange',
      header: t('Дати продажів'),
      width: 220,
      minWidth: 180,
      accessor: (row) => `${row.FirstSaleDocumentDate} ${row.LastSaleDocumentDate}`,
      cell: (row) => formatHistoricalDateRange(row.FirstSaleDocumentDate, row.LastSaleDocumentDate),
    },
    {
      id: 'cost',
      header: t('Source cost EUR'),
      width: 130,
      minWidth: 112,
      align: 'right',
      accessor: (row) => row.TotalSourceCostEur,
      cell: (row) => formatMoney(row.TotalSourceCostEur),
    },
  ], [t])
}

function useHistoricalSourceDocumentColumns(): DataTableColumn<HistoricalSourceMovement>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<HistoricalSourceMovement>[]>(() => [
    { id: 'allocation', header: 'Allocation ID', width: 110, minWidth: 96, accessor: (row) => row.AllocationId, cell: (row) => String(row.AllocationId) },
    { id: 'saleNumber', header: t('Продаж 1С'), width: 160, minWidth: 135, accessor: (row) => row.SourceSaleNumber || row.SourceOrderNumber, cell: (row) => displayValue(row.SourceSaleNumber || row.SourceOrderNumber) },
    { id: 'saleDate', header: t('Дата продажу'), width: 150, minWidth: 130, accessor: (row) => row.SaleDocumentDate, cell: (row) => formatDateTime(row.SaleDocumentDate) },
    { id: 'orderNumber', header: t('Замовлення 1С'), width: 160, minWidth: 135, accessor: (row) => row.SourceOrderNumber, cell: (row) => displayValue(row.SourceOrderNumber) },
    { id: 'client', header: t('Клієнт'), width: 220, minWidth: 170, accessor: (row) => row.ClientName, cell: (row) => displayValue(row.ClientName) },
    { id: 'qty', header: t('Кількість'), width: 110, minWidth: 96, align: 'right', accessor: (row) => row.Qty, cell: (row) => formatAmount(row.Qty) },
    { id: 'amount', header: t('Сума EUR'), width: 120, minWidth: 104, align: 'right', accessor: (row) => row.SourceAmountEur, cell: (row) => formatMoney(row.SourceAmountEur) },
    { id: 'vat', header: t('ПДВ EUR'), width: 110, minWidth: 96, align: 'right', accessor: (row) => row.SourceVatEur, cell: (row) => formatMoney(row.SourceVatEur) },
    { id: 'cost', header: t('Cost EUR'), width: 110, minWidth: 96, align: 'right', accessor: (row) => row.SourceCostEur, cell: (row) => formatMoney(row.SourceCostEur) },
    { id: 'responsible', header: t('Відповідальний'), width: 170, minWidth: 140, accessor: (row) => row.Responsible, cell: (row) => displayValue(row.Responsible) },
    { id: 'comment', header: t('Коментар'), width: 240, minWidth: 180, accessor: (row) => row.Comment, cell: (row) => displayValue(row.Comment) },
  ], [t])
}

function formatHistoricalDateRange(from: Date | string, to: Date | string): string {
  const formattedFrom = formatDateTime(from)
  const formattedTo = formatDateTime(to)

  return formattedFrom === formattedTo ? formattedFrom : `${formattedFrom} — ${formattedTo}`
}

function ProductIncomeMovementPanel({ active, product }: { active: boolean; product: MovementHistoryProduct }) {
  const { t } = useI18n()
  const productNetUid = product.NetUid?.trim() || ''
  const [dateState, dispatchDateState] = useReducer(movementDateReducer, undefined, createMovementDateState)
  const { dateFrom, dateTo } = dateState
  const [rowsState, dispatchRowsState] = useReducer(
    movementRowsReducer<ProductIncomeMovement>,
    undefined,
    createMovementRowsState<ProductIncomeMovement>,
  )
  const { error, isLoading, rows } = rowsState
  const [exportModalState, dispatchExportModalState] = useReducer(
    productMovementExportModalReducer,
    undefined,
    createProductMovementExportModalState,
  )
  const { documentState: exportDocumentState, exportingKey } = exportModalState
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const exportRequestRef = useRef(0)
  const columns = useProductIncomeMovementColumns()
  const treeRows = useMemo(() => buildProductIncomeMovementTree(rows), [rows])
  const hasDoubleStockSource = useMemo(() => hasCrossSourceStockCollision(rows), [rows])
  const filterError = getDateRangeError(dateFrom, dateTo, t)
  const missingNetUidError = productNetUid ? null : t('У товару немає NetUid для завантаження приходу')
  const activeError = filterError || missingNetUidError || error
  const exportKey = `${active}|${productNetUid}|${dateFrom}|${dateTo}`
  const exportDocument = exportDocumentState?.key === exportKey ? exportDocumentState.document : null
  const isExporting = exportingKey === exportKey

  useEffect(() => {
    exportRequestRef.current += 1
    dispatchExportModalState({ type: 'close-document' })
  }, [active, dateFrom, dateTo, productNetUid])

  useEffect(() => {
    if (!active || filterError || !productNetUid) {
      return
    }

    let cancelled = false

    async function loadRows() {
      dispatchRowsState({ type: 'load-started' })

      try {
        const nextRows = await getProductIncomeMovements({
          from: dateFrom,
          productNetId: productNetUid,
          to: dateTo,
        })

        if (!cancelled) {
          dispatchRowsState({ rows: nextRows, type: 'load-succeeded' })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatchRowsState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити прихід товару'),
            type: 'load-failed',
          })
        }
      }
    }

    void loadRows()

    return () => {
      cancelled = true
    }
  }, [active, dateFrom, dateTo, filterError, productNetUid, reloadKey, t])

  async function exportMovements() {
    if (!productNetUid || filterError || isExporting) {
      return
    }

    const requestId = exportRequestRef.current + 1
    exportRequestRef.current = requestId
    const requestKey = exportKey
    dispatchExportModalState({ key: requestKey, type: 'export-started' })
    dispatchRowsState({ type: 'clear-error' })

    try {
      const nextDocument = await exportProductIncomeMovementsDocument({
        from: dateFrom,
        productNetId: productNetUid,
        to: dateTo,
      })

      if (exportRequestRef.current === requestId) {
        dispatchExportModalState({ document: nextDocument, key: requestKey, type: 'export-succeeded' })
      }
    } catch (exportError) {
      if (exportRequestRef.current === requestId) {
        dispatchRowsState({
          error: exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ приходу'),
          type: 'set-error',
        })
      }
    } finally {
      if (exportRequestRef.current === requestId) {
        dispatchExportModalState({ type: 'export-finished' })
      }
    }
  }

  return (
    <Stack className="product-movement-history-panel" gap={0}>
      <div className="app-filter-bar product-movement-history-filter-bar">
      <MovementDateToolbar
        dateFrom={dateFrom}
        dateTo={dateTo}
        exportDisabled={!productNetUid || Boolean(filterError)}
        exportLoading={isExporting}
        isLoading={isLoading}
        onDateFromChange={(value) => dispatchDateState({ type: 'set-date-from', value })}
        onDateToChange={(value) => dispatchDateState({ type: 'set-date-to', value })}
        onExport={() => void exportMovements()}
        onRefresh={() => reload()}
      />
      </div>
      <Stack className="product-movement-history-panel__body" gap="md">
      {activeError ? (
        <Alert color={filterError || missingNetUidError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">
          {activeError}
        </Alert>
      ) : null}
      {!activeError && hasDoubleStockSource ? (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {t('Знайдено дві активні складські гілки одного приходу з AMG і Fenix. Записи показано окремо, оскільки обидва впливають на залишок.')}
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        data={activeError ? [] : treeRows}
        defaultLayout={INCOME_TABLE_DEFAULT_LAYOUT}
        emptyText={t('Прихід товару не знайдено')}
        getRowCanExpand={(row) => row.Branches.length > 1}
        getRowId={(row) => row.TreeKey}
        isLoading={isLoading}
        layoutVersion="product-income-movement-history-shared-2"
        loadingText={t('Завантаження приходу товару')}
        maxHeight="calc(100vh - 320px)"
        minWidth={1780}
        renderExpandedRow={(row) => (
          <ProductIncomeMovementBranches columns={columns} row={row} />
        )}
        tableId="product-income-movement-history"
      />
      <ProductDocumentDownloadModal
        document={exportDocument}
        title={t('Документ приходу товару')}
        onClose={() => dispatchExportModalState({ type: 'close-document' })}
      />
      </Stack>
    </Stack>
  )
}

function ProductIncomeMovementBranches({
  columns,
  row,
}: {
  columns: DataTableColumn<ProductIncomeMovement>[]
  row: ProductIncomeMovementTreeRow<ProductIncomeMovement>
}) {
  const { t } = useI18n()

  return (
    <Stack className="product-income-movement-branches" gap="xs">
      <Group gap="xs" justify="space-between">
        <Text className="app-section-title" fw={600}>
          {t('Пов’язані записи приходу')}
        </Text>
        <Text className="product-income-movement-branches__count">
          {t('Гілок')}: {row.Branches.length}
        </Text>
      </Group>
      <DataTable
        columns={columns}
        data={row.Branches}
        defaultLayout={INCOME_TABLE_DEFAULT_LAYOUT}
        enablePinning={false}
        getRowId={(branch, index) => [
          row.TreeKey,
          branch.ImportedForAmg === true ? 'amg' : branch.ImportedForAmg === false ? 'fenix' : 'unknown',
          branch.SourceDocumentType ?? 'unknown',
          branch.SourceDocumentId?.trim() || branch.Id || branch.NetUid || index,
        ].join(':')}
        layoutVersion="product-income-movement-branches-1"
        maxHeight={320}
        minWidth={1740}
        showLayoutControls={false}
        tableId="product-income-movement-branches"
      />
    </Stack>
  )
}

function ProductOutcomeMovementPanel({ active, product }: { active: boolean; product: MovementHistoryProduct }) {
  const { t } = useI18n()
  const productNetUid = product.NetUid?.trim() || ''
  const [dateState, dispatchDateState] = useReducer(movementDateReducer, undefined, createMovementDateState)
  const { dateFrom, dateTo } = dateState
  const [rowsState, dispatchRowsState] = useReducer(
    movementRowsReducer<ProductOutcomeMovement>,
    undefined,
    createMovementRowsState<ProductOutcomeMovement>,
  )
  const { error, isLoading, rows } = rowsState
  const [exportModalState, dispatchExportModalState] = useReducer(
    productMovementExportModalReducer,
    undefined,
    createProductMovementExportModalState,
  )
  const { documentState: exportDocumentState, exportingKey } = exportModalState
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const exportRequestRef = useRef(0)
  const columns = useProductOutcomeMovementColumns()
  const filterError = getDateRangeError(dateFrom, dateTo, t)
  const missingNetUidError = productNetUid ? null : t('У товару немає NetUid для завантаження виходу')
  const activeError = filterError || missingNetUidError || error
  const exportKey = `${active}|${productNetUid}|${dateFrom}|${dateTo}`
  const exportDocument = exportDocumentState?.key === exportKey ? exportDocumentState.document : null
  const isExporting = exportingKey === exportKey

  useEffect(() => {
    exportRequestRef.current += 1
    dispatchExportModalState({ type: 'close-document' })
  }, [active, dateFrom, dateTo, productNetUid])

  useEffect(() => {
    if (!active || filterError || !productNetUid) {
      return
    }

    let cancelled = false

    async function loadRows() {
      dispatchRowsState({ type: 'load-started' })

      try {
        const nextRows = await getProductOutcomeMovements({
          from: dateFrom,
          productNetId: productNetUid,
          to: dateTo,
        })

        if (!cancelled) {
          dispatchRowsState({ rows: nextRows, type: 'load-succeeded' })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatchRowsState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити вихід товару'),
            type: 'load-failed',
          })
        }
      }
    }

    void loadRows()

    return () => {
      cancelled = true
    }
  }, [active, dateFrom, dateTo, filterError, productNetUid, reloadKey, t])

  async function exportMovements() {
    if (!productNetUid || filterError || isExporting) {
      return
    }

    const requestId = exportRequestRef.current + 1
    exportRequestRef.current = requestId
    const requestKey = exportKey
    dispatchExportModalState({ key: requestKey, type: 'export-started' })
    dispatchRowsState({ type: 'clear-error' })

    try {
      const nextDocument = await exportProductOutcomeMovementsDocument({
        from: dateFrom,
        productNetId: productNetUid,
        to: dateTo,
      })

      if (exportRequestRef.current === requestId) {
        dispatchExportModalState({ document: nextDocument, key: requestKey, type: 'export-succeeded' })
      }
    } catch (exportError) {
      if (exportRequestRef.current === requestId) {
        dispatchRowsState({
          error: exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ виходу'),
          type: 'set-error',
        })
      }
    } finally {
      if (exportRequestRef.current === requestId) {
        dispatchExportModalState({ type: 'export-finished' })
      }
    }
  }

  return (
    <Stack className="product-movement-history-panel" gap={0}>
      <div className="app-filter-bar product-movement-history-filter-bar">
      <MovementDateToolbar
        dateFrom={dateFrom}
        dateTo={dateTo}
        exportDisabled={!productNetUid || Boolean(filterError)}
        exportLoading={isExporting}
        isLoading={isLoading}
        onDateFromChange={(value) => dispatchDateState({ type: 'set-date-from', value })}
        onDateToChange={(value) => dispatchDateState({ type: 'set-date-to', value })}
        onExport={() => void exportMovements()}
        onRefresh={() => reload()}
      />
      </div>
      <Stack className="product-movement-history-panel__body" gap="md">
      {activeError ? (
        <Alert color={filterError || missingNetUidError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">
          {activeError}
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        data={activeError ? [] : rows}
        defaultLayout={OUTCOME_TABLE_DEFAULT_LAYOUT}
        emptyText={t('Вихід товару не знайдено')}
        getRowId={(row, index) => String(row.NetUid || row.Id || `${row.DocumentTypeName || 'outcome'}-${row.DocumentNumber || 'number'}-${index}`)}
        isLoading={isLoading}
        layoutVersion="product-outcome-movement-history-shared-1"
        loadingText={t('Завантаження виходу товару')}
        maxHeight="calc(100vh - 320px)"
        minWidth={1280}
        tableId="product-outcome-movement-history"
      />
      <ProductDocumentDownloadModal
        document={exportDocument}
        title={t('Документ виходу товару')}
        onClose={() => dispatchExportModalState({ type: 'close-document' })}
      />
      </Stack>
    </Stack>
  )
}

function MovementDateToolbar({
  dateFrom,
  dateTo,
  exportDisabled,
  exportLoading,
  isLoading,
  onDateFromChange,
  onDateToChange,
  onExport,
  onRefresh,
}: {
  dateFrom: string
  dateTo: string
  exportDisabled: boolean
  exportLoading: boolean
  isLoading: boolean
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onExport: () => void
  onRefresh: () => void
}) {
  const { t } = useI18n()

  return (
    <Group align="end" gap={10} wrap="nowrap" className="product-movement-history-filter-row">
      <TextInput label={t('З')} type="date" value={dateFrom} w={150} onChange={(event) => onDateFromChange(event.currentTarget.value)} />
      <TextInput label={t('По')} type="date" value={dateTo} w={150} onChange={(event) => onDateToChange(event.currentTarget.value)} />
      <div className="app-filter-actions">
      <Button leftSection={<RefreshCw size={18} />} loading={isLoading} variant="outline" onClick={onRefresh}>
        {t('Оновити')}
      </Button>
      <Button disabled={exportDisabled} leftSection={<Download size={18} />} loading={exportLoading} variant="outline" onClick={onExport}>
        {t('Друк')}
      </Button>
      </div>
    </Group>
  )
}

function ProductDocumentDownloadModal({
  document,
  onClose,
  title,
}: {
  document: ProductMovementExportDocument | null
  onClose: () => void
  title: string
}) {
  return (
    <DocumentExportModal
      document={document}
      opened={Boolean(document)}
      title={title}
      onClose={onClose}
    />
  )
}

function useProductMovementColumns(): DataTableColumn<ProductMovement>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ProductMovement>[]>(
    () => [
      {
        id: 'incomeDocumentNumber',
        header: t('Номер прихідної накладної'),
        width: 150,
        minWidth: 130,
        accessor: (row) => row.IncomeDocumentNumber,
        cell: (row) => displayValue(row.IncomeDocumentNumber),
      },
      {
        id: 'incomeDocumentDate',
        header: t('Дата прихідної накладної'),
        width: 150,
        minWidth: 130,
        accessor: (row) => row.IncomeDocumentFromDate,
        cell: (row) => formatDateTime(row.IncomeDocumentFromDate),
      },
      {
        id: 'documentType',
        header: t('Документ'),
        width: 220,
        minWidth: 170,
        accessor: (row) => row.DocumentType || row.MovementType,
        cell: (row) => formatEditedValue(row.DocumentType || row.MovementType, row.IsEdited),
      },
      {
        id: 'documentNumber',
        header: t('Номер'),
        width: 140,
        minWidth: 112,
        accessor: (row) => row.DocumentNumber,
        cell: (row) => formatEditedValue(row.DocumentNumber, row.IsEdited),
      },
      {
        id: 'documentDate',
        header: t('Дата'),
        width: 140,
        minWidth: 120,
        accessor: (row) => row.DocumentFromDate || row.FromDate || row.Created,
        cell: (row) => formatDateTime(row.DocumentFromDate || row.FromDate || row.Created),
      },
      {
        id: 'clientName',
        header: t('Клієнт'),
        width: 220,
        minWidth: 170,
        accessor: (row) => row.ClientName,
        cell: (row) => displayValue(row.ClientName),
      },
      {
        id: 'storageName',
        header: t('Склад'),
        width: 180,
        minWidth: 140,
        accessor: (row) => row.StorageName,
        cell: (row) => displayValue(row.StorageName),
      },
      {
        id: 'organizationName',
        header: t('Організація'),
        width: 220,
        minWidth: 170,
        accessor: (row) => row.OrganizationName,
        cell: (row) => displayValue(row.OrganizationName),
      },
      {
        id: 'sourceProjection',
        header: t('Джерело / запис'),
        width: 150,
        minWidth: 132,
        accessor: (row) => `${getIncomeSourceLabel(row, t)} ${getIncomeProjectionLabel(row, t)}`,
        cell: (row) => (
          <Stack gap={0}>
            <Text size="sm">{getIncomeSourceLabel(row, t)}</Text>
            <Text c="dimmed" size="xs">{getIncomeProjectionLabel(row, t)}</Text>
          </Stack>
        ),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 160,
        minWidth: 130,
        accessor: (row) => row.Responsible || row.UserName,
        cell: (row) => displayValue(row.Responsible || row.UserName),
      },
      {
        id: 'price',
        header: t('Собівартість'),
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (row) => row.Price,
        cell: (row) => formatMoney(row.Price),
      },
      {
        id: 'accountingPrice',
        header: t('Облікова собівартість'),
        width: 140,
        minWidth: 120,
        align: 'right',
        accessor: (row) => row.AccountingPrice,
        cell: (row) => formatMoney(row.AccountingPrice),
      },
      {
        id: 'discount',
        header: t('Знижка'),
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (row) => row.Discount,
        cell: (row) => formatMoney(row.Discount),
      },
      {
        id: 'incomeQty',
        header: t('Прихід'),
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (row) => row.IncomeQty,
        cell: (row) => formatAmount(row.IncomeQty),
      },
      {
        id: 'outcomeQty',
        header: t('Розхід'),
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (row) => row.OutcomeQty,
        cell: (row) => formatAmount(row.OutcomeQty),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        width: 220,
        minWidth: 160,
        accessor: (row) => row.Comment,
        cell: (row) => displayValue(row.Comment),
      },
    ],
    [t],
  )
}

function useProductIncomeMovementColumns(): DataTableColumn<ProductIncomeMovement>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ProductIncomeMovement>[]>(
    () => [
      {
        id: 'storageName',
        header: t('Склад'),
        width: 160,
        minWidth: 130,
        accessor: (row) => row.StorageName,
        cell: (row) => displayValue(row.StorageName),
      },
      {
        id: 'supplierName',
        header: t('Постачальник'),
        width: 220,
        minWidth: 170,
        accessor: (row) => row.SupplierName,
        cell: (row) => displayValue(row.SupplierName),
      },
      {
        id: 'organizationName',
        header: t('Організація'),
        width: 220,
        minWidth: 170,
        accessor: (row) => row.OrganizationName,
        cell: (row) => displayValue(row.OrganizationName),
      },
      {
        id: 'incomeToStorageDate',
        header: t('Дата приходу на склад'),
        width: 150,
        minWidth: 130,
        accessor: (row) => row.IncomeToStorageDate,
        cell: (row) => formatProductIncomeMovementDateTime(row.IncomeToStorageDate),
      },
      {
        id: 'incomeToStorageNumber',
        header: t('№ документу приходу на склад'),
        width: 170,
        minWidth: 150,
        accessor: (row) => row.IncomeToStorageNumber,
        cell: (row) => displayValue(row.IncomeToStorageNumber),
      },
      {
        id: 'incomeInvoiceNumber',
        header: t('№ прихідного інвойсу'),
        width: 160,
        minWidth: 140,
        accessor: (row) => row.IncomeInvoiceNumber,
        cell: (row) => displayValue(row.IncomeInvoiceNumber),
      },
      {
        id: 'incomeInvoiceDate',
        header: t('Дата прихідного інвойсу'),
        width: 160,
        minWidth: 140,
        accessor: (row) => row.IncomeInvoiceDate,
        cell: (row) => formatDateTime(row.IncomeInvoiceDate),
      },
      {
        id: 'currency',
        header: t('Валюта договору'),
        width: 110,
        minWidth: 96,
        accessor: (row) => row.Currency,
        cell: (row) => displayValue(row.Currency),
      },
      {
        id: 'exchangeRate',
        header: t('Курс'),
        width: 100,
        minWidth: 90,
        align: 'right',
        accessor: (row) => row.ExchangeRate,
        cell: (row) => formatAmount(row.ExchangeRate),
      },
      {
        id: 'unitPriceLocal',
        header: t('Ціна net в валюті договору'),
        width: 150,
        minWidth: 132,
        align: 'right',
        accessor: (row) => row.UnitPriceLocal,
        cell: (row) => formatMoney(row.UnitPriceLocal),
      },
      {
        id: 'netPrice',
        header: t('Ціна net EUR'),
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (row) => row.NetPrice,
        cell: (row) => formatMoney(row.NetPrice),
      },
      {
        id: 'totalNetPrice',
        header: t('Сума net'),
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (row) => row.TotalNetPrice,
        cell: (row) => formatMoney(row.TotalNetPrice),
      },
      {
        id: 'grossPrice',
        header: t('Сума gross УО'),
        width: 130,
        minWidth: 112,
        align: 'right',
        accessor: (row) => row.GrossPrice,
        cell: (row) => formatMoney(row.GrossPrice),
      },
      {
        id: 'accountingGrossPrice',
        header: t('Сума gross БО'),
        width: 130,
        minWidth: 112,
        align: 'right',
        accessor: (row) => row.AccountingGrossPrice,
        cell: (row) => formatMoney(row.AccountingGrossPrice),
      },
      {
        id: 'managementEurUnitPrice',
        header: t('УО EUR за од.'),
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (row) => row.ManagementEurUnitPrice,
        cell: (row) => formatMoney(row.ManagementEurUnitPrice),
      },
      {
        id: 'accountingEurUnitPrice',
        header: t('БО EUR за од.'),
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (row) => row.AccountingEurUnitPrice,
        cell: (row) => formatMoney(row.AccountingEurUnitPrice),
      },
      {
        id: 'weight',
        header: t('Вага'),
        width: 100,
        minWidth: 90,
        align: 'right',
        accessor: (row) => row.Weight,
        cell: (row) => formatAmount(row.Weight),
      },
      {
        id: 'incomeQty',
        header: t('Кількість у приході'),
        width: 130,
        minWidth: 112,
        align: 'right',
        accessor: (row) => row.IncomeQty,
        cell: (row) => formatAmount(row.IncomeQty),
      },
      {
        id: 'remainingQty',
        header: t('Залишок'),
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (row) => row.RemainingQty,
        cell: (row) => formatAmount(row.RemainingQty),
      },
      {
        id: 'fromInvoiceNumber',
        header: t('З інвойсу №'),
        width: 130,
        minWidth: 112,
        accessor: (row) => row.FromInvoiceNumber,
        cell: (row) => displayValue(row.FromInvoiceNumber),
      },
      {
        id: 'fromInvoiceDate',
        header: t('З інвойсу дата'),
        width: 140,
        minWidth: 120,
        accessor: (row) => row.FromInvoiceDate,
        cell: (row) => formatDateTime(row.FromInvoiceDate),
      },
      {
        id: 'returnPrice',
        header: t('Ціна повернення'),
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (row) => row.ReturnPrice,
        cell: (row) => formatMoney(row.ReturnPrice),
      },
      {
        id: 'priceDifference',
        header: t('Різниця'),
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (row) => row.PriceDifference,
        cell: (row) => formatMoney(row.PriceDifference),
      },
    ],
    [t],
  )
}

function getIncomeSourceLabel(
  row: ProductIncomeMovement,
  t: (value: string) => string,
): string {
  if (row.ImportedForAmg === true) {
    return 'AMG'
  }

  if (row.ImportedForAmg === false) {
    return 'Fenix'
  }

  return t('Локальний запис')
}

function getIncomeProjectionLabel(
  row: ProductIncomeMovement,
  t: (value: string) => string,
): string {
  if (row.IsHide === true) {
    return t('Впливає на склад')
  }

  if (row.IsHide === false) {
    return t('Історія документа')
  }

  return t('Тип не визначено')
}

function useProductOutcomeMovementColumns(): DataTableColumn<ProductOutcomeMovement>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ProductOutcomeMovement>[]>(
    () => [
      {
        id: 'fromDate',
        header: t('Дата'),
        width: 150,
        minWidth: 130,
        accessor: (row) => row.FromDate,
        cell: (row) => formatEditedValue(formatDateTime(row.FromDate), row.HasUpdateDataCarrier),
      },
      {
        id: 'documentTypeName',
        header: t('Тип документа'),
        width: 220,
        minWidth: 170,
        accessor: (row) => row.DocumentTypeName,
        cell: (row) => formatEditedValue(row.DocumentTypeName, row.HasUpdateDataCarrier),
      },
      {
        id: 'storageName',
        header: t('Склад'),
        width: 200,
        minWidth: 160,
        accessor: (row) => row.StorageName,
        cell: (row) => displayValue(row.StorageName),
      },
      {
        id: 'organizationName',
        header: t('Організація'),
        width: 220,
        minWidth: 170,
        accessor: (row) => row.OrganizationName,
        cell: (row) => displayValue(row.OrganizationName),
      },
      {
        id: 'documentNumber',
        header: t('Сервісний номер'),
        width: 170,
        minWidth: 150,
        accessor: (row) => row.DocumentNumber,
        cell: (row) => formatEditedValue(row.DocumentNumber, row.HasUpdateDataCarrier),
      },
      {
        id: 'clientName',
        header: t('Клієнт'),
        width: 220,
        minWidth: 170,
        accessor: (row) => row.ClientName,
        cell: (row) => displayValue(row.ClientName),
      },
      {
        id: 'responsibleName',
        header: t('Відповідальний'),
        width: 170,
        minWidth: 140,
        accessor: (row) => row.ResponsibleName,
        cell: (row) => displayValue(row.ResponsibleName),
      },
      {
        id: 'price',
        header: t('Ціна виходу'),
        width: 130,
        minWidth: 112,
        align: 'right',
        accessor: (row) => row.Price,
        cell: (row) => formatMoney(row.Price),
      },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (row) => row.Qty,
        cell: (row) => formatAmount(row.Qty),
      },
    ],
    [t],
  )
}

function useStorageLocationHistoryColumns(): DataTableColumn<ProductStorageLocationHistory>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ProductStorageLocationHistory>[]>(
    () => [
      {
        id: 'created',
        header: t('Дата'),
        width: 150,
        minWidth: 130,
        accessor: (row) => row.Created,
        cell: (row) => formatDateTime(row.Created),
      },
      {
        id: 'product',
        header: t('Товар'),
        width: 180,
        minWidth: 150,
        accessor: (row) => row.Product?.VendorCode || row.Product?.NameUA || row.Product?.Name,
        cell: (row) => displayValue(row.Product?.VendorCode || row.Product?.NameUA || row.Product?.Name),
      },
      {
        id: 'storage',
        header: t('Склад'),
        width: 180,
        minWidth: 140,
        accessor: (row) => row.Storage?.Name,
        cell: (row) => displayValue(row.Storage?.Name),
      },
      {
        id: 'placement',
        header: t('Місце'),
        width: 150,
        minWidth: 120,
        accessor: (row) => row.Placement,
        cell: (row) => displayValue(row.Placement),
      },
      {
        id: 'additionType',
        header: t('Статус'),
        width: 110,
        minWidth: 96,
        align: 'center',
        accessor: (row) => row.AdditionType,
        cell: (row) => (
          <Tooltip label={row.AdditionType === 1 ? t('Списано з місця') : t('Додано на місце')}>
            <ActionIcon aria-label={row.AdditionType === 1 ? t('Списано з місця') : t('Додано на місце')} color={row.AdditionType === 1 ? 'red' : 'green'} size="sm" variant="light">
              {row.AdditionType === 1 ? <Minus size={15} /> : <Plus size={15} />}
            </ActionIcon>
          </Tooltip>
        ),
      },
      {
        id: 'locationType',
        header: t('Місце зміни товару'),
        width: 240,
        minWidth: 180,
        accessor: (row) => formatStorageLocationType(row.StorageLocationType, t),
        cell: (row) => formatStorageLocationType(row.StorageLocationType, t),
      },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (row) => row.Qty,
        cell: (row) => formatStorageLocationQty(row),
      },
      {
        id: 'user',
        header: t('Відповідальний'),
        width: 180,
        minWidth: 140,
        accessor: (row) => [row.User?.FirstName, row.User?.LastName].filter(Boolean).join(' '),
        cell: (row) => displayValue([row.User?.FirstName, row.User?.LastName].filter(Boolean).join(' ')),
      },
    ],
    [t],
  )
}

async function getProductMovements(params: ProductMovementParams): Promise<ProductMovement[]> {
  const result = await apiRequest<unknown>('/consignments/info/movement/filtered', {
    query: {
      from: params.from,
      movementType: params.movementType,
      productNetId: params.productNetId,
      to: params.to,
      types: params.types,
    },
    errorMessages: {
      default: 'Не вдалося завантажити рух товару',
      network: 'Сервер руху товару недоступний',
    },
  })

  return normalizeArray(result) as ProductMovement[]
}

async function getHistoricalSourceMovements(
  params: ProductIncomeOutcomeMovementParams,
): Promise<HistoricalSourceMovement[]> {
  const result = await apiRequest<unknown>('/consignments/info/movement/historical-source/filtered', {
    query: {
      from: params.from,
      productNetId: params.productNetId,
      to: params.to,
    },
    errorMessages: {
      default: 'Не вдалося завантажити архівні партії 1С',
      network: 'Сервер архівних партій 1С недоступний',
    },
  })

  return normalizeArray(result) as HistoricalSourceMovement[]
}

async function getInformationalMovements(
  params: InformationalMovementParams,
): Promise<InformationalMovement[]> {
  const result = await apiRequest<unknown>('/consignments/info/movement/informational/filtered', {
    query: {
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      ...(params.productNetId ? { productNetId: params.productNetId } : {}),
      to: params.to,
    },
    errorMessages: {
      default: 'Не вдалося завантажити неповні дані 1С',
      network: 'Сервер неповних даних 1С недоступний',
    },
  })

  return normalizeArray(result) as InformationalMovement[]
}

async function getProductIncomeMovements(
  params: ProductIncomeOutcomeMovementParams,
): Promise<ProductIncomeMovement[]> {
  const result = await apiRequest<unknown>('/consignments/info/income/filtered', {
    query: {
      from: params.from,
      productNetId: params.productNetId,
      to: params.to,
    },
    errorMessages: {
      default: 'Не вдалося завантажити прихід товару',
      network: 'Сервер приходу недоступний',
    },
  })

  return normalizeArray(result) as ProductIncomeMovement[]
}

async function getProductOutcomeMovements(
  params: ProductIncomeOutcomeMovementParams,
): Promise<ProductOutcomeMovement[]> {
  const result = await apiRequest<unknown>('/consignments/info/outcome/filtered', {
    query: {
      from: params.from,
      productNetId: params.productNetId,
      to: params.to,
    },
    errorMessages: {
      default: 'Не вдалося завантажити вихід товару',
      network: 'Сервер виходу недоступний',
    },
  })

  return normalizeArray(result) as ProductOutcomeMovement[]
}

async function getProductStorageLocationHistory(
  params: ProductStorageLocationHistoryParams,
): Promise<ProductStorageLocationHistory[]> {
  const result = await apiRequest<unknown>('/products/placements/history/all/filtered', {
    query: {
      ProductNetId: params.productNetId,
      from: params.from,
      limit: params.limit,
      offset: params.offset,
      to: params.to,
    },
    errorMessages: {
      default: 'Не вдалося завантажити історію місця зберігання',
      network: 'Сервер історії недоступний',
    },
  })

  return normalizeArray(result) as ProductStorageLocationHistory[]
}

async function exportProductMovementsDocument(
  params: ProductMovementParams,
): Promise<ProductMovementExportDocument> {
  const result = await apiRequest<unknown>('/consignments/info/movement/document/export', {
    query: {
      from: params.from,
      movementType: params.movementType,
      productNetId: params.productNetId,
      to: params.to,
      types: params.types,
    },
    errorMessages: {
      default: 'Не вдалося сформувати документ руху товару',
      network: 'Сервер експорту руху товару недоступний',
    },
  })

  return requireExportDocument(result, 'Документ руху товару недоступний для завантаження')
}

async function exportProductIncomeMovementsDocument(
  params: ProductIncomeOutcomeMovementParams,
): Promise<ProductMovementExportDocument> {
  const result = await apiRequest<unknown>('/consignments/info/income/document/export', {
    query: {
      from: params.from,
      productNetId: params.productNetId,
      to: params.to,
    },
    errorMessages: {
      default: 'Не вдалося сформувати документ приходу',
      network: 'Сервер експорту приходу недоступний',
    },
  })

  return requireExportDocument(result, 'Документ приходу недоступний для завантаження')
}

async function exportProductOutcomeMovementsDocument(
  params: ProductIncomeOutcomeMovementParams,
): Promise<ProductMovementExportDocument> {
  const result = await apiRequest<unknown>('/consignments/info/outcome/document/export', {
    query: {
      from: params.from,
      productNetId: params.productNetId,
      to: params.to,
    },
    errorMessages: {
      default: 'Не вдалося сформувати документ виходу',
      network: 'Сервер експорту виходу недоступний',
    },
  })

  return requireExportDocument(result, 'Документ виходу недоступний для завантаження')
}

function normalizeArray(result: unknown): unknown[] {
  if (Array.isArray(result)) {
    return result
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>

  return readArrayPayload(payload, ['Items', 'Collection', 'Data', 'Movements', 'History'])
}

function readArrayPayload(payload: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return payload[key] as unknown[]
    }
  }

  return []
}

function getProductTitle(product: MovementHistoryProduct): string {
  const code = product.VendorCode?.trim()
  const name = product.NameUA?.trim() || product.Name?.trim()

  return [code, name].filter(Boolean).join(' - ') || product.NetUid || ''
}

function getTodayDate(): string {
  return formatLocalDate(new Date())
}

function getDateYearsAgo(years: number): string {
  const date = new Date()
  date.setFullYear(date.getFullYear() - years)
  return formatLocalDate(date)
}

function getDateRangeError(dateFrom: string, dateTo: string, t: (key: string) => string): string | null {
  if (!dateFrom || !dateTo) {
    return t('Оберіть діапазон дат')
  }

  if (dateFrom > dateTo) {
    return t('Дата “З” не може бути більшою за дату “По”')
  }

  return null
}

function formatStorageLocationType(type: number | undefined, t: (key: string) => string): string {
  switch (type) {
    case 0:
      return t('Редагування')
    case 1:
      return t('Розміщення')
    case 2:
      return t('Замовлення постачання')
    case 3:
      return t('Переміщення')
    default:
      return '-'
  }
}

function formatStorageLocationQty(row: ProductStorageLocationHistory): string {
  if (!isFiniteNumber(row.Qty)) {
    return '-'
  }

  const signedQty = row.AdditionType === 1 ? -Math.abs(row.Qty) : row.Qty

  return amountFormatter.format(signedQty)
}

function formatEditedValue(value: string | number | undefined, isEdited?: boolean) {
  if (!isEdited) {
    return displayValue(value)
  }

  return (
    <Text component="span" c="orange.7" fw={600}>
      {displayValue(value)}
    </Text>
  )
}

function formatDateTime(value?: Date | string | null): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateTimeFormatter.format(date)
}

function formatAmount(value?: number): string {
  if (!isFiniteNumber(value)) {
    return '-'
  }

  return amountFormatter.format(value)
}

function formatMoney(value?: number): string {
  if (!isFiniteNumber(value)) {
    return '-'
  }

  return moneyFormatter.format(value)
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '-'
  }

  return value ? String(value) : '-'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
