import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Checkbox,
  Group,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconFileTypePdf,
  IconFileTypeXls,
  IconMinus,
  IconPlus,
  IconRefresh,
} from '@tabler/icons-react'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { apiRequest } from '../../api/apiClient'
import { formatLocalDate } from '../../date/dateTime'
import { useI18n } from '../../i18n/useI18n'
import { AppDrawer } from '../AppDrawer'
import { AppModal } from '../AppModal'
import { DataTable } from '../data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../data-table/types'

export type MovementHistoryProduct = {
  Name?: string
  NameUA?: string
  NetUid?: string
  VendorCode?: string
}

export type ProductMovementHistoryTab = 'movement' | 'income' | 'outcome'

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
  IncomeInvoiceDate?: Date | string
  IncomeInvoiceNumber?: string | number
  IncomeQty?: number
  IncomeToStorageDate?: Date | string
  IncomeToStorageNumber?: string | number
  ManagementEurUnitPrice?: number
  NetPrice?: number
  OrganizationName?: string
  PriceDifference?: number
  RemainingQty?: number
  ReturnPrice?: number
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

type ProductMovementExportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

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
  { label: 'Замовлення постачання в Україну', value: 4 },
  { label: 'Акт уцінки', value: 5 },
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
      }
    case 'export-finished':
      return {
        ...state,
        exportingKey: null,
      }
    case 'export-started':
      return {
        ...state,
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
        <Tabs value={activeTab} onChange={(value) => setActiveTab((value as ProductMovementHistoryTab) || 'movement')}>
          <Tabs.List>
            <Tabs.Tab value="movement">{t('Рух')}</Tabs.Tab>
            <Tabs.Tab value="income">{t('Прихід')}</Tabs.Tab>
            <Tabs.Tab value="outcome">{t('Вихід')}</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="movement" pt="md">
            <ProductMovementPanel active={opened && activeTab === 'movement'} product={product} />
          </Tabs.Panel>
          <Tabs.Panel value="income" pt="md">
            <ProductIncomeMovementPanel active={opened && activeTab === 'income'} product={product} />
          </Tabs.Panel>
          <Tabs.Panel value="outcome" pt="md">
            <ProductOutcomeMovementPanel active={opened && activeTab === 'outcome'} product={product} />
          </Tabs.Panel>
        </Tabs>
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
  }, [dateFrom, dateTo, filterError, opened, page, pageSize, productNetUid, t])

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
            <ActionIcon
              aria-label={t('Попередня сторінка')}
              color="gray"
              disabled={!canMoveBack || isLoading || Boolean(filterError)}
              variant="light"
              onClick={() => dispatchDrawerState({ type: 'previous-page' })}
            >
              <IconChevronLeft size={18} />
            </ActionIcon>
            <ActionIcon
              aria-label={t('Наступна сторінка')}
              color="gray"
              disabled={!canMoveForward || isLoading || Boolean(filterError)}
              variant="light"
              onClick={() => dispatchDrawerState({ type: 'next-page' })}
            >
              <IconChevronRight size={18} />
            </ActionIcon>
          </Group>
        </Group>
        {activeError ? (
          <Alert color={filterError || missingNetUidError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
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
  const filterError = getDateRangeError(dateFrom, dateTo, t)
  const missingNetUidError = productNetUid ? null : t('У товару немає NetUid для завантаження руху товару')
  const typesError = selectedTypes.length === 0 ? t('Оберіть хоча б один тип руху') : null
  const activeError = filterError || missingNetUidError || typesError || error
  const exportKey = `${active}|${productNetUid}|${dateFrom}|${dateTo}|${movementType}|${selectedTypes.join(',')}`
  const exportDocument = exportDocumentState?.key === exportKey ? exportDocumentState.document : null
  const isExporting = exportingKey === exportKey

  useEffect(() => {
    exportRequestRef.current += 1
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
    <Stack gap="md">
      <Group align="end" gap="sm" wrap="wrap" className="clients-filter-row">
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
        <Button
          disabled={Boolean(filterError) || Boolean(typesError)}
          leftSection={<IconRefresh size={18} />}
          loading={isLoading}
          variant="light"
          onClick={() => reload()}
        >
          {t('Оновити')}
        </Button>
        <Button
          disabled={!productNetUid || Boolean(filterError) || Boolean(typesError)}
          leftSection={<IconDownload size={18} />}
          loading={isExporting}
          variant="light"
          onClick={() => void exportMovements()}
        >
          {t('Друк')}
        </Button>
      </Group>
      <Group gap="md" wrap="wrap" align="center">
        {movementItemTypeOptions.map((option) => (
          <Checkbox
            key={option.value}
            checked={selectedTypes.includes(option.value)}
            label={t(option.label)}
            size="xs"
            onChange={() => toggleMovementItemType(option.value)}
          />
        ))}
        <Button size="xs" color="gray" variant="subtle" onClick={() => dispatchFilterState({ type: 'reset-selected-types' })}>
          {t('Скинути')}
        </Button>
      </Group>
      {activeError ? (
        <Alert color={filterError || missingNetUidError || typesError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
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
  )
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
  const filterError = getDateRangeError(dateFrom, dateTo, t)
  const missingNetUidError = productNetUid ? null : t('У товару немає NetUid для завантаження приходу')
  const activeError = filterError || missingNetUidError || error
  const exportKey = `${active}|${productNetUid}|${dateFrom}|${dateTo}`
  const exportDocument = exportDocumentState?.key === exportKey ? exportDocumentState.document : null
  const isExporting = exportingKey === exportKey

  useEffect(() => {
    exportRequestRef.current += 1
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
    <Stack gap="md">
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
      {activeError ? (
        <Alert color={filterError || missingNetUidError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
          {activeError}
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        data={activeError ? [] : rows}
        defaultLayout={INCOME_TABLE_DEFAULT_LAYOUT}
        emptyText={t('Прихід товару не знайдено')}
        getRowId={(row, index) => String(row.NetUid || row.Id || `${row.IncomeToStorageNumber || 'income'}-${row.IncomeInvoiceNumber || 'invoice'}-${index}`)}
        isLoading={isLoading}
        layoutVersion="product-income-movement-history-shared-1"
        loadingText={t('Завантаження приходу товару')}
        maxHeight="calc(100vh - 320px)"
        minWidth={1780}
        tableId="product-income-movement-history"
      />
      <ProductDocumentDownloadModal
        document={exportDocument}
        title={t('Документ приходу товару')}
        onClose={() => dispatchExportModalState({ type: 'close-document' })}
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
    <Stack gap="md">
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
      {activeError ? (
        <Alert color={filterError || missingNetUidError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
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
    <Group align="end" gap="sm" wrap="wrap" className="clients-filter-row">
      <TextInput label={t('З')} type="date" value={dateFrom} w={150} onChange={(event) => onDateFromChange(event.currentTarget.value)} />
      <TextInput label={t('По')} type="date" value={dateTo} w={150} onChange={(event) => onDateToChange(event.currentTarget.value)} />
      <Button leftSection={<IconRefresh size={18} />} loading={isLoading} variant="light" onClick={onRefresh}>
        {t('Оновити')}
      </Button>
      <Button disabled={exportDisabled} leftSection={<IconDownload size={18} />} loading={exportLoading} variant="light" onClick={onExport}>
        {t('Друк')}
      </Button>
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
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(document)} title={title} onClose={onClose}>
      <Stack gap="sm">
        {document?.DocumentURL || document?.PdfDocumentURL ? (
          <>
            {document.DocumentURL ? (
              <Anchor href={document.DocumentURL} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-excel">
                  <IconFileTypeXls size={22} stroke={1.8} />
                </span>
                <span>{t('Excel документ')}</span>
              </Anchor>
            ) : null}
            {document.PdfDocumentURL ? (
              <Anchor href={document.PdfDocumentURL} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-pdf">
                  <IconFileTypePdf size={22} stroke={1.8} />
                </span>
                <span>{t('PDF документ')}</span>
              </Anchor>
            ) : null}
          </>
        ) : (
          <Text c="dimmed" size="sm">
            {t('Документ недоступний для завантаження')}
          </Text>
        )}
      </Stack>
    </AppModal>
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
        cell: (row) => formatDateTime(row.IncomeToStorageDate),
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
              {row.AdditionType === 1 ? <IconMinus size={15} /> : <IconPlus size={15} />}
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

  return normalizeExportDocument(result)
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

  return normalizeExportDocument(result)
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

  return normalizeExportDocument(result)
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

function normalizeExportDocument(result: unknown): ProductMovementExportDocument {
  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, unknown>

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL: typeof payload.PdfDocumentURL === 'string' ? payload.PdfDocumentURL : '',
  }
}

function getProductTitle(product: MovementHistoryProduct): string {
  const code = product.VendorCode?.trim()
  const name = product.NameUA?.trim() || product.Name?.trim()

  return [code, name].filter(Boolean).join(' - ') || product.NetUid || ''
}

function getTodayDate(): string {
  return formatLocalDate(new Date())
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
