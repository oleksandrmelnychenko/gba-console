import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  NumberInput,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { ArrowLeftRight, CircleAlert, Package, Receipt, Warehouse } from 'lucide-react'
import { useEffect, useReducer } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getShiftedSaleById, shiftOrderItemsCurrent } from '../api/salesUkraineApi'
import { getSaleLifecycleStatusKey } from '../saleStatus'
import { usePersistentSaleJsonMutation } from '../usePersistentSaleJsonMutation'
import {
  OrderItemShiftStatusType,
  type OrderItemShiftStatusTypeValue,
  type SalesUkraineOrderItem,
  type SalesUkraineOrderItemShiftStatus,
  type SalesUkraineSale,
} from '../types'
import './sales-drawers.css'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 })
const SALE_EDIT_TABLE_MIN_WIDTH = 1120
const SALE_EDIT_TABLE_LAYOUT: DataTableDefaultLayout = {
  columnSizing: {
    amount: 120,
    bill: 124,
    created: 128,
    currency: 76,
    originalNumber: 150,
    product: 300,
    qty: 86,
    store: 124,
    user: 180,
    vendorCode: 140,
  },
  density: 'compact',
}

type ShiftDraftEntry = { bill: number | string; billTouched: boolean; store: number | string; storeTouched: boolean }
type ShiftDraft = Record<string, ShiftDraftEntry>
type SaleEditOrderItemRow = {
  billNum: number
  entry: ShiftDraftEntry
  item: SalesUkraineOrderItem
  key: string
  qty: number
  storeNum: number
}

const EMPTY_DRAFT_ENTRY: ShiftDraftEntry = { bill: '', billTouched: false, store: '', storeTouched: false }
type SaleEditState = {
  draft: ShiftDraft
  error: string | null
  isLoading: boolean
  isSaving: boolean
  sale: SalesUkraineSale
}
type SaleEditAction =
  | { type: 'draftEntryChanged'; key: string; patch: Partial<ShiftDraftEntry> }
  | { type: 'draftReplaced'; draft: ShiftDraft }
  | { type: 'loadFailed'; error: string }
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; sale: SalesUkraineSale }
  | { type: 'savingFinished' }
  | { type: 'savingStarted' }

export function SaleEditDrawer({
  sale,
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
  sale: SalesUkraineSale | null
}) {
  const { t } = useI18n()
  const isNew = isNewSale(sale)
  const title = isNew ? t('Акт редагування рахунку') : t('Акт редагування накладної')

  return (
    <AppDrawer
      classNames={{
        body: 'sale-edit-drawer-body',
        content: 'sale-edit-drawer-content',
        header: 'sale-edit-drawer-header',
        title: 'sale-edit-drawer-title',
      }}
      offset={8}
      opened={Boolean(sale)}
      padding="lg"
      position="right"
      radius="md"
      size="full"
      title={title}
      onClose={onClose}
    >
      {sale && <SaleEditContent key={sale.NetUid || sale.Id} initialSale={sale} onClose={onClose} onSaved={onSaved} />}
    </AppDrawer>
  )
}

function createInitialSaleEditState(initialSale: SalesUkraineSale): SaleEditState {
  return {
    draft: buildDraft(getOrderItems(initialSale)),
    error: null,
    isLoading: Boolean(initialSale.NetUid),
    isSaving: false,
    sale: initialSale,
  }
}

function saleEditReducer(state: SaleEditState, action: SaleEditAction): SaleEditState {
  switch (action.type) {
    case 'draftEntryChanged':
      return {
        ...state,
        draft: {
          ...state.draft,
          [action.key]: {
            ...state.draft[action.key],
            ...action.patch,
          },
        },
      }
    case 'draftReplaced':
      return { ...state, draft: action.draft }
    case 'loadFailed':
      return { ...state, error: action.error, isLoading: false }
    case 'loadStarted':
      return { ...state, error: null, isLoading: true }
    case 'loadSucceeded':
      return {
        ...state,
        draft: buildDraft(getOrderItems(action.sale)),
        error: null,
        isLoading: false,
        sale: action.sale,
      }
    case 'savingFinished':
      return { ...state, isSaving: false }
    case 'savingStarted':
      return { ...state, isSaving: true }
    default:
      return state
  }
}

function SaleEditContent({
  initialSale,
  onClose,
  onSaved,
}: {
  initialSale: SalesUkraineSale
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const [{ draft, error, isLoading, isSaving, sale }, dispatch] = useReducer(
    saleEditReducer,
    initialSale,
    createInitialSaleEditState,
  )
  const shiftMutation = usePersistentSaleJsonMutation(
    `sale-shift-current:${String(initialSale.NetUid || initialSale.Id || '')}`,
    'sale-shift-current',
  )

  useEffect(() => {
    const netId = initialSale.NetUid

    if (!netId) {
      return
    }

    let cancelled = false

    async function load(id: string) {
      dispatch({ type: 'loadStarted' })

      try {
        const next = await getShiftedSaleById(id)

        if (!cancelled) {
          if (next) {
            dispatch({ sale: next, type: 'loadSucceeded' })
          } else {
            dispatch({ error: t('Не вдалося завантажити продаж'), type: 'loadFailed' })
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatch({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити продаж'),
            type: 'loadFailed',
          })
        }
      }
    }

    void load(netId)

    return () => {
      cancelled = true
    }
  }, [initialSale.NetUid, t])

  const orderItems = getOrderItems(sale)
  const isNew = isNewSale(sale)
  const totalAmount = orderItems.reduce((sum, item) => sum + (getNumber(item.TotalAmount) ?? 0), 0)
  const totalQty = orderItems.reduce((sum, item) => sum + (getNumber(item.Qty) ?? 0), 0)
  const billShiftTotal = sumShiftQty(orderItems, draft, OrderItemShiftStatusType.Bill)
  const storeShiftTotal = sumShiftQty(orderItems, draft, OrderItemShiftStatusType.Store)
  const tableRows = orderItems.map((item, index) => {
    const key = itemKey(item, index)
    const qty = getNumber(item.Qty) ?? 0
    const entry = draft[key] || EMPTY_DRAFT_ENTRY

    return {
      billNum: entry.billTouched ? toNumber(entry.bill) : getExistingShiftQty(item, OrderItemShiftStatusType.Bill),
      entry,
      item,
      key,
      qty,
      storeNum: entry.storeTouched ? toNumber(entry.store) : getExistingShiftQty(item, OrderItemShiftStatusType.Store),
    }
  })
  const isMutationLocked = isSaving || shiftMutation.hasPending
  const tableColumns = createSaleEditColumns({ isNew, isSaving: isMutationLocked, t, updateEntry })

  function updateEntry(key: string, patch: Partial<ShiftDraftEntry>) {
    dispatch({ key, patch, type: 'draftEntryChanged' })
  }

  function allToBill() {
    dispatch({ draft: buildBulkDraft(orderItems, 'bill'), type: 'draftReplaced' })
    void submitShift(buildBulkShiftPayload(sale, 'bill'))
  }

  function allToStore() {
    dispatch({ draft: buildBulkDraft(orderItems, 'store'), type: 'draftReplaced' })
    void submitShift(buildBulkShiftPayload(sale, 'store'))
  }

  async function submitShift(payload: SalesUkraineSale) {
    dispatch({ type: 'savingStarted' })

    try {
      const result = await shiftMutation.run(payload, shiftOrderItemsCurrent)

      if (!result.completed) {
        return
      }

      notifications.show({ color: 'green', message: t('Зсув виконано') })
      onSaved()
    } catch (shiftError) {
      notifications.show({
        color: 'red',
        message: shiftError instanceof Error && shiftError.message.trim()
          ? shiftError.message
          : t('Не вдалося виконати зсув'),
      })
    } finally {
      dispatch({ type: 'savingFinished' })
    }
  }

  function doShift() {
    return submitShift(buildShiftPayload(sale, draft))
  }

  if (isLoading) {
    return <SaleEditSkeleton />
  }

  if (error) {
    return (
      <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
        {error}
      </Alert>
    )
  }

  if (!orderItems.length) {
    return (
      <Text c="dimmed" size="sm">
        {t('Товарів не знайдено')}
      </Text>
    )
  }

  return (
    <Stack
      className="sale-edit-sheet"
      gap={0}
      onKeyUp={(event) => {
        if (event.key === 'Enter' && !isSaving) {
          void doShift()
        }
      }}
    >
      <Box className="sale-edit-hero">
        <Box className="sale-edit-hero__main">
          <span className="sale-edit-hero__icon">
            <ArrowLeftRight size={23} strokeWidth={1.8} />
          </span>
          <Box className="sale-edit-hero__copy">
            <Badge className="app-role-pill" size="sm" variant="light">
              {isNew ? t('Рахунок') : t('Накладна')}
            </Badge>
            <Text className="sale-edit-hero__number">{sale.SaleNumber?.Value || '-'}</Text>
          </Box>
        </Box>
        <Group className="sale-edit-metrics" gap={8} wrap="nowrap">
          <SaleEditMetric label={t('позицій')} value={orderItems.length} />
          <SaleEditMetric label={t('к-сть')} value={qtyFormatter.format(totalQty)} />
          <SaleEditMetric label="EUR" value={amountFormatter.format(totalAmount)} />
          {!isNew && <SaleEditMetric label={t('в рахунок')} value={qtyFormatter.format(billShiftTotal)} />}
          <SaleEditMetric label={t('на склад')} value={qtyFormatter.format(storeShiftTotal)} />
        </Group>
      </Box>

      {shiftMutation.pendingError && (
        <Alert color="orange" icon={<CircleAlert size={18} />} m="md" variant="light">
          {shiftMutation.pendingError}
        </Alert>
      )}

      <Box className="sale-edit-command">
        <Box className="sale-edit-command__copy">
          <Group gap={8} wrap="nowrap">
            <Package size={17} strokeWidth={1.8} />
            <Text className="sale-edit-command__title">{t('Склад накладної')}</Text>
            <Badge className="sale-edit-command__badge" variant="light">
              {orderItems.length}
            </Badge>
          </Group>
          <Text className="sale-edit-command__description">
            {t('Вкажіть кількість для зсуву позицій між рахунком та складом')}
          </Text>
        </Box>
        <Group className="sale-edit-bulk-actions" gap={8}>
          {!isNew && (
            <Button
              className="sale-edit-bulk-action"
              disabled={isMutationLocked}
              leftSection={<Receipt size={16} />}
              variant="outline"
              onClick={allToBill}
            >
              {t('Все в рахунок')}
            </Button>
          )}
          <Button
            className="sale-edit-bulk-action"
            disabled={isMutationLocked}
            leftSection={<Warehouse size={16} />}
            variant="outline"
            onClick={allToStore}
          >
            {t('Все на склад')}
          </Button>
        </Group>
      </Box>

      <Box className="sale-edit-table-shell">
        <DataTable
          columns={tableColumns}
          data={tableRows}
          defaultLayout={SALE_EDIT_TABLE_LAYOUT}
          distributeAvailableWidth
          emptyText={t('Товарів не знайдено')}
          getRowId={(row) => row.key}
          height="100%"
          layoutVersion={isNew ? 'sale-edit-new-1' : 'sale-edit-invoice-1'}
          minWidth={SALE_EDIT_TABLE_MIN_WIDTH}
          showDensityToggle={false}
          tableId={isNew ? 'sale-edit-new' : 'sale-edit-invoice'}
        />
      </Box>

      <Group className="sale-edit-footer" justify="flex-end" gap="sm">
        <Button className="sale-edit-cancel" color="gray" disabled={isSaving} variant="subtle" onClick={onClose}>
          {t('Скасувати')}
        </Button>
        <Button
          className="sale-edit-submit"
          color={CREATE_ACTION_COLOR}
          leftSection={<ArrowLeftRight size={16} />}
          loading={isSaving}
          onClick={doShift}
        >
          {t('Зробити зсув')}
        </Button>
      </Group>
    </Stack>
  )
}

function createSaleEditColumns({
  isNew,
  isSaving,
  t,
  updateEntry,
}: {
  isNew: boolean
  isSaving: boolean
  t: (key: string) => string
  updateEntry: (key: string, patch: Partial<ShiftDraftEntry>) => void
}): DataTableColumn<SaleEditOrderItemRow>[] {
  const columns: DataTableColumn<SaleEditOrderItemRow>[] = [
    {
      id: 'vendorCode',
      header: t('Код Виробника'),
      accessor: (row) => getOrderItemProductCode(row.item),
      cell: (row) => <span className="sale-edit-code-pill">{displayValue(getOrderItemProductCode(row.item)) || '-'}</span>,
      width: 140,
      minWidth: 120,
      enableSorting: false,
    },
    {
      id: 'originalNumber',
      header: t('Ориг. номер'),
      accessor: (row) => row.item.Product?.MainOriginalNumber || '',
      cell: (row) => <span className="sale-edit-muted-value">{displayValue(row.item.Product?.MainOriginalNumber) || '-'}</span>,
      width: 150,
      minWidth: 132,
      enableSorting: false,
    },
    {
      id: 'product',
      header: t('Назва товару'),
      accessor: (row) => getOrderItemProductName(row.item),
      cell: (row) => (
        <Text className="sale-edit-product-name" title={displayValue(getOrderItemProductName(row.item))} truncate>
          {displayValue(getOrderItemProductName(row.item)) || '-'}
        </Text>
      ),
      width: 300,
      minWidth: 240,
      fill: true,
      enableSorting: false,
    },
    {
      id: 'amount',
      header: t('Сума'),
      align: 'right',
      accessor: (row) => getNumber(row.item.TotalAmount) ?? 0,
      cell: (row) => (
        <span className="sale-edit-money">{amountFormatter.format(getNumber(row.item.TotalAmount) ?? 0)}</span>
      ),
      width: 120,
      minWidth: 108,
      enableSorting: false,
    },
    {
      id: 'currency',
      header: t('Валюта'),
      accessor: () => 'EUR',
      cell: () => <span className="sale-edit-currency">EUR</span>,
      width: 76,
      minWidth: 72,
      enableSorting: false,
    },
    {
      id: 'qty',
      header: t('К-сть'),
      align: 'right',
      accessor: (row) => row.qty,
      cell: (row) => <span className="sale-edit-qty">{displayValue(row.qty)}</span>,
      width: 86,
      minWidth: 76,
      enableSorting: false,
    },
    {
      id: 'store',
      header: t('На склад'),
      accessor: (row) => row.entry.store,
      cell: (row) => {
        const storageName = getReturnStorageName(row.item)
        const label = storageName ? `${t('Скасувати резерв на склад')}: ${storageName}` : t('Скасувати резерв на склад')

        return (
          <Tooltip label={label} disabled={!storageName} withArrow>
            <NumberInput
              allowDecimal={false}
              allowNegative={false}
              clampBehavior="strict"
              hideControls
              max={Math.max(0, row.qty - (isNew ? 0 : row.billNum))}
              min={0}
              className="sale-edit-shift-input"
              disabled={isSaving}
              size="xs"
              value={row.entry.store}
              onChange={(value) => updateEntry(row.key, { store: value, storeTouched: true })}
            />
          </Tooltip>
        )
      },
      width: 124,
      minWidth: 112,
      className: 'sale-edit-input-column',
      enableSorting: false,
    },
    {
      id: 'created',
      header: t('Дата'),
      accessor: (row) => row.item.Created || '',
      cell: (row) => <span className="sale-edit-muted-value">{formatDateTime(row.item.Created) || '-'}</span>,
      width: 128,
      minWidth: 118,
      enableSorting: false,
    },
    {
      id: 'user',
      header: t('Відповідальний'),
      accessor: (row) => getUserName(row.item.User),
      cell: (row) => <span className="sale-edit-user-name">{displayValue(getUserName(row.item.User)) || '-'}</span>,
      width: 180,
      minWidth: 150,
      enableSorting: false,
    },
  ]

  if (!isNew) {
    columns.splice(6, 0, {
      id: 'bill',
      header: t('В рахунок'),
      accessor: (row) => row.entry.bill,
      cell: (row) => (
        <Tooltip label={t('Скасувати резерв у рахунку')} withArrow>
          <NumberInput
            allowDecimal={false}
            allowNegative={false}
            clampBehavior="strict"
            hideControls
            max={Math.max(0, row.qty - row.storeNum)}
            min={0}
            className="sale-edit-shift-input"
            disabled={isSaving}
            size="xs"
            value={row.entry.bill}
            onChange={(value) => updateEntry(row.key, { bill: value, billTouched: true })}
          />
        </Tooltip>
      ),
      width: 124,
      minWidth: 112,
      className: 'sale-edit-input-column',
      enableSorting: false,
    })
  }

  return columns
}

function SaleEditMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <Box className="sale-edit-metric">
      <Text>{value}</Text>
      <Text>{label}</Text>
    </Box>
  )
}

function sumShiftQty(
  orderItems: SalesUkraineOrderItem[],
  draft: ShiftDraft,
  shiftStatus: OrderItemShiftStatusTypeValue,
): number {
  return orderItems.reduce((sum, item, index) => {
    const key = itemKey(item, index)
    const entry = draft[key] || EMPTY_DRAFT_ENTRY
    const value =
      shiftStatus === OrderItemShiftStatusType.Bill
        ? entry.billTouched
          ? toNumber(entry.bill)
          : getExistingShiftQty(item, OrderItemShiftStatusType.Bill)
        : entry.storeTouched
          ? toNumber(entry.store)
          : getExistingShiftQty(item, OrderItemShiftStatusType.Store)

    return sum + value
  }, 0)
}

function buildShiftPayload(sale: SalesUkraineSale, draft: ShiftDraft): SalesUkraineSale {
  const orderItems = getOrderItems(sale)

  const nextItems = orderItems.map((item, index) => {
    const key = itemKey(item, index)
    const entry = draft[key] || EMPTY_DRAFT_ENTRY
    const nextStatuses: SalesUkraineOrderItemShiftStatus[] = []

    // The server only processes NEW (Id === 0) shift statuses (IsNew filter). Always emit a fresh
    // status for a touched box; never reuse the persisted (Id > 0) statuses loaded from
    // /sales/get/shifted — those fail IsNew() so the server drops the whole item and shifts nothing.
    if (entry.billTouched) {
      const billQty = toNumber(entry.bill)

      if (billQty > 0) {
        nextStatuses.push(buildShiftStatus(OrderItemShiftStatusType.Bill, billQty, item))
      }
    }

    if (entry.storeTouched) {
      const storeQty = toNumber(entry.store)

      if (storeQty > 0) {
        nextStatuses.push(buildShiftStatus(OrderItemShiftStatusType.Store, storeQty, item))
      }
    }

    return { ...item, ShiftStatuses: nextStatuses }
  })

  return {
    ...sale,
    Order: {
      ...sale.Order,
      OrderItems: nextItems,
    },
  }
}

function buildBulkShiftPayload(sale: SalesUkraineSale, target: 'bill' | 'store'): SalesUkraineSale {
  const shiftStatus = target === 'bill' ? OrderItemShiftStatusType.Bill : OrderItemShiftStatusType.Store

  return {
    ...sale,
    Order: {
      ...sale.Order,
      OrderItems: getOrderItems(sale).map((item) => ({
        ...item,
        ShiftStatuses: [
          {
            Id: 0,
            NetUid: EMPTY_GUID,
            Deleted: false,
            ShiftStatus: shiftStatus as SalesUkraineOrderItemShiftStatus['ShiftStatus'],
            Qty: getNumber(item.Qty) ?? 0,
            OrderItemId: item.Id,
          },
        ],
      })),
    },
  }
}

function getExistingShiftQty(item: SalesUkraineOrderItem, shiftStatus: number): number {
  const statuses = Array.isArray(item.ShiftStatuses) ? item.ShiftStatuses : []

  return getNumber(statuses.find((status) => status.ShiftStatus === shiftStatus)?.Qty) ?? 0
}

function buildShiftStatus(shiftStatus: number, qty: number, item: SalesUkraineOrderItem): SalesUkraineOrderItemShiftStatus {
  // Always a brand-new status (Id 0 / empty NetUid) so it passes the server's IsNew() filter.
  return {
    Id: 0,
    NetUid: EMPTY_GUID,
    Deleted: false,
    ShiftStatus: shiftStatus as SalesUkraineOrderItemShiftStatus['ShiftStatus'],
    Qty: qty,
    OrderItemId: item.Id,
  }
}

function buildDraft(orderItems: SalesUkraineOrderItem[]): ShiftDraft {
  const draft: ShiftDraft = {}

  orderItems.forEach((item, index) => {
    draft[itemKey(item, index)] = { ...EMPTY_DRAFT_ENTRY }
  })

  return draft
}

function buildBulkDraft(orderItems: SalesUkraineOrderItem[], target: 'bill' | 'store'): ShiftDraft {
  const draft: ShiftDraft = {}

  orderItems.forEach((item, index) => {
    const qty = getNumber(item.Qty) ?? 0
    draft[itemKey(item, index)] = {
      bill: target === 'bill' ? qty || '' : '',
      billTouched: true,
      store: target === 'store' ? qty || '' : '',
      storeTouched: true,
    }
  })

  return draft
}

function getOrderItems(sale: SalesUkraineSale): SalesUkraineOrderItem[] {
  return Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
}

function isNewSale(sale: SalesUkraineSale | null): boolean {
  return getSaleLifecycleStatusKey(
    sale?.BaseLifeCycleStatus?.SaleLifeCycleType ?? sale?.BaseLifeCycleStatus?.Name,
  ) === 'New'
}

function itemKey(item: SalesUkraineOrderItem, index: number): string {
  return String(item.NetUid || item.Id || index)
}

function getOrderItemProductName(item: SalesUkraineOrderItem): string {
  return item.Product?.NameUA || item.Product?.Name || ''
}

function getOrderItemProductCode(item: SalesUkraineOrderItem): string {
  return item.Product?.VendorCode || item.Product?.Articul || item.Product?.MainOriginalNumber || ''
}

function getUserName(user?: SalesUkraineOrderItem['User']): string {
  return user?.FullName?.trim() || [user?.LastName, user?.FirstName].filter(Boolean).join(' ').trim() || ''
}

function getReturnStorageName(item: SalesUkraineOrderItem): string {
  const movements = item.ConsignmentItemMovements
  const last = Array.isArray(movements) && movements.length ? movements[movements.length - 1] : undefined

  return last?.ConsignmentItem?.ProductIncomeItem?.ProductIncome?.Storage?.Name?.trim() || ''
}

function toNumber(value: number | string): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : 0
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : ''
  }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')

  return `${day}.${month}.${date.getFullYear()}`
}

function displayValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }

  if (typeof value === 'string') {
    return value.trim()
  }

  return ''
}

function SaleEditSkeleton() {
  return (
    <Stack className="sales-drawer-loading" gap="md">
      <div className="sales-drawer-skeleton-card">
        <Stack gap="sm">
          <div className="sales-drawer-skeleton-line" style={{ width: '22%' }} />
          {[0, 1, 2, 3, 4, 5].map((rowIndex) => (
            <div
              key={rowIndex}
              className="sales-drawer-skeleton-row"
              style={{
                gridTemplateColumns:
                  'minmax(96px, 0.8fr) minmax(96px, 0.8fr) minmax(200px, 1.5fr) minmax(80px, 0.6fr) minmax(80px, 0.6fr)',
              }}
            >
              <div className="sales-drawer-skeleton-line" />
              <div className="sales-drawer-skeleton-line" />
              <div className="sales-drawer-skeleton-line" style={{ width: rowIndex % 2 ? '76%' : '92%' }} />
              <div className="sales-drawer-skeleton-line" />
              <div className="sales-drawer-skeleton-line" />
            </div>
          ))}
        </Stack>
      </div>
    </Stack>
  )
}
