import { TableChip } from '../../../shared/ui/TableChip'
import {
  Alert,
  Box,
  Button,
  Group,
  Stack,
  Text,
} from '@mantine/core'
import { ArrowLeftRight, CircleAlert, Package, Receipt, Warehouse } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { DocumentDetailChip, DocumentDetailLayout, DocumentDetailMetric, DocumentDetailSection, DocumentDetailSummary } from '../../../shared/ui/document-detail/DocumentDetail'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getSaleLifecycleStatusKey } from '../saleStatus'
import { useSaleEditSubmit } from './useSaleEditSubmit'
import {
  OrderItemShiftStatusType,
  type SalesUkraineOrderItem,
  type SalesUkraineOrderItemShiftStatus,
  type SalesUkraineSale,
} from '../types'
import { buildBulkShiftPayload, hasShiftableQuantity } from './saleEditShiftPayload'
import { useSaleEditLoad, type SaleEditLoadAction } from './useSaleEditLoad'
import { SaleEditShiftInput } from './SaleEditShiftInput'
import './sales-drawers.css'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const SALE_EDIT_FORM_ID = 'sale-edit-shift-form'
const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 })
const SALE_EDIT_TABLE_MIN_WIDTH = 1180
const SALE_EDIT_TABLE_LAYOUT: DataTableDefaultLayout = {
  columnSizing: {
    amount: 88,
    bill: 112,
    created: 104,
    currency: 96,
    originalNumber: 120,
    product: 200,
    qty: 84,
    store: 104,
    user: 152,
    vendorCode: 144,
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
  sale: SalesUkraineSale
}
type SaleEditFooterState = {
  hasPending: boolean
  isSaving: boolean
  saleKey: string
  visible: boolean
}
type SaleEditAction =
  | { type: 'draftEntryChanged'; key: string; patch: Partial<ShiftDraftEntry> }
  | { type: 'draftReplaced'; draft: ShiftDraft }
  | SaleEditLoadAction


const HIDDEN_SALE_EDIT_FOOTER: SaleEditFooterState = {
  hasPending: false,
  isSaving: false,
  saleKey: '',
  visible: false,
}

export function SaleEditDrawer({
  sale,
  zIndex,
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void | Promise<void>
  sale: SalesUkraineSale | null
  zIndex?: number
}) {
  const { t } = useI18n()
  const isNew = isNewSale(sale)
  const title = isNew ? t('Акт редагування рахунку') : t('Акт редагування накладної')
  const saleKey = sale ? String(sale.NetUid || sale.Id || '') : ''
  const [footerState, setFooterState] = useState<SaleEditFooterState>(HIDDEN_SALE_EDIT_FOOTER)
  const activeFooterState = footerState.saleKey === saleKey ? footerState : HIDDEN_SALE_EDIT_FOOTER

  return (
    <AppDrawer
      zIndex={zIndex}
      footer={
        sale && activeFooterState.visible ? (
          <Group gap="sm" justify="flex-end">
            <Button color="gray" disabled={activeFooterState.isSaving} type="button" variant="default" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={activeFooterState.hasPending}
              form={SALE_EDIT_FORM_ID}
              leftSection={<ArrowLeftRight size={16} />}
              loading={activeFooterState.isSaving}
              type="submit"
            >
              {t('Зробити зсув')}
            </Button>
          </Group>
        ) : undefined
      }
      opened={Boolean(sale)}
      position="right"
      size="full"
      title={title}
      onClose={onClose}
    >
      {sale && (
        <SaleEditContent
          key={sale.NetUid || sale.Id}
          initialSale={sale}
          saleKey={saleKey}
          onFooterStateChange={setFooterState}
          onSaved={onSaved}
        />
      )}
    </AppDrawer>
  )
}

function createInitialSaleEditState(initialSale: SalesUkraineSale): SaleEditState {
  return {
    draft: buildDraft(getOrderItems(initialSale)),
    error: null,
    isLoading: Boolean(initialSale.NetUid),
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
    default:
      return state
  }
}

function SaleEditContent({
  initialSale,
  saleKey,
  onFooterStateChange,
  onSaved,
}: {
  initialSale: SalesUkraineSale
  saleKey: string
  onFooterStateChange: (state: SaleEditFooterState) => void
  onSaved: () => void | Promise<void>
}) {
  const { t } = useI18n()
  const [{ draft, error, isLoading, sale }, dispatch] = useReducer(
    saleEditReducer,
    initialSale,
    createInitialSaleEditState,
  )
  const shiftMutation = useSaleEditSubmit({
    context: `sale-shift-current:${String(initialSale.NetUid || initialSale.Id || '')}`,
    ready: !isLoading && !error,
    onSaved,
  })
  const { isSaving, submit: submitShift, recover: recoverPendingShift } = shiftMutation

  useSaleEditLoad(initialSale.NetUid, dispatch)

  const orderItems = useMemo(() => getOrderItems(sale), [sale])
  const { hasShiftableItems, totalAmount, totalQty, baseRows } = useMemo(() => ({
    hasShiftableItems: orderItems.some(hasShiftableQuantity),
    totalAmount: orderItems.reduce((sum, item) => sum + (getNumber(item.TotalAmount) ?? 0), 0),
    totalQty: orderItems.reduce((sum, item) => sum + (getNumber(item.Qty) ?? 0), 0),
    baseRows: orderItems.map((item, index) => ({
      key: itemKey(item, index), item, qty: getNumber(item.Qty) ?? 0,
      billNum: getExistingShiftQty(item, OrderItemShiftStatusType.Bill),
      storeNum: getExistingShiftQty(item, OrderItemShiftStatusType.Store),
    })),
  }), [orderItems])
  const isNew = isNewSale(sale)
  const tableRows = useMemo(() => baseRows.map(row => {
    const entry = draft[row.key] || EMPTY_DRAFT_ENTRY
    return {
      ...row, entry,
      billNum: entry.billTouched ? toNumber(entry.bill) : row.billNum,
      storeNum: entry.storeTouched ? toNumber(entry.store) : row.storeNum,
    }
  }), [baseRows, draft])
  const { billShiftTotal, storeShiftTotal } = useMemo(() => tableRows.reduce((sum, row) => ({
    billShiftTotal: sum.billShiftTotal + row.billNum,
    storeShiftTotal: sum.storeShiftTotal + row.storeNum,
  }), { billShiftTotal: 0, storeShiftTotal: 0 }), [tableRows])
  const updateEntry = useCallback((key: string, target: 'bill' | 'store', value: number | string) => {
    dispatch({ key, patch: target === 'bill' ? { bill: value, billTouched: true } : { store: value, storeTouched: true }, type: 'draftEntryChanged' })
  }, [])
  const isMutationLocked = isSaving || shiftMutation.hasPending
  const tableColumns = useMemo(
    () => createSaleEditColumns({ isNew, isSaving: isMutationLocked, t, updateEntry }),
    [isMutationLocked, isNew, t, updateEntry],
  )

  function allToBill() {
    dispatch({ draft: buildBulkDraft(orderItems, 'bill'), type: 'draftReplaced' })
    void submitShift(buildBulkShiftPayload(sale, 'bill'))
  }

  function allToStore() {
    dispatch({ draft: buildBulkDraft(orderItems, 'store'), type: 'draftReplaced' })
    void submitShift(buildBulkShiftPayload(sale, 'store'))
  }

  function doShift() {
    return submitShift(buildShiftPayload(sale, draft))
  }

  const showFooter = !isLoading && !error && hasShiftableItems

  useEffect(() => {
    onFooterStateChange({
      hasPending: shiftMutation.hasPending,
      isSaving,
      saleKey,
      visible: showFooter,
    })
  }, [isSaving, onFooterStateChange, saleKey, shiftMutation.hasPending, showFooter])

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
      component="form"
      gap={0}
      id={SALE_EDIT_FORM_ID}
      onSubmit={(event) => {
        event.preventDefault()

        if (!isMutationLocked) {
          void doShift()
        }
      }}
    >
      <DocumentDetailLayout
        summary={
          <DocumentDetailSummary
            variant="inventory"
            eyebrow={isNew ? t('Рахунок') : t('Накладна')}
            title={`№ ${sale.SaleNumber?.Value || '—'}`}
            meta={<>
              <DocumentDetailChip icon={<Package size={14} />}>{t('Позицій')}: {orderItems.length}</DocumentDetailChip>
              <DocumentDetailChip>{t('Кількість')}: {qtyFormatter.format(totalQty)}</DocumentDetailChip>
            </>}
            metrics={<>
              <div className="document-detail-metric">
                <span>{t('Сума')}</span>
                <strong>{amountFormatter.format(totalAmount)} <TableChip tone="source" value="EUR" /></strong>
              </div>
              {!isNew && <DocumentDetailMetric label={t('В рахунок')} value={qtyFormatter.format(billShiftTotal)} />}
              <DocumentDetailMetric label={t('На склад')} value={qtyFormatter.format(storeShiftTotal)} />
            </>}
          />
        }
      >
      {shiftMutation.pendingError && (
        <Alert color="orange" icon={<CircleAlert size={18} />} m="md" variant="light">
          <Stack gap="xs">
            <Text size="sm">{shiftMutation.pendingError}</Text>
            {shiftMutation.hasPending && (
              <Button
                loading={isSaving}
                size="xs"
                variant="light"
                onClick={() => void recoverPendingShift()}
              >
                {t('Перевірити та повторити')}
              </Button>
            )}
          </Stack>
        </Alert>
      )}

      <DocumentDetailSection
        title={isNew ? t('Склад рахунку') : t('Склад накладної')}
        subtitle={String(orderItems.length)}
        actions={
        <Group className="sale-edit-bulk-actions" gap={8} wrap="nowrap">
          {!isNew && (
            <Button
              disabled={isMutationLocked || !hasShiftableItems}
              leftSection={<Receipt size={16} />}
              color={CREATE_ACTION_COLOR}
              variant="filled"
              onClick={allToBill}
            >
              {t('Все в рахунок')}
            </Button>
          )}
          <Button
            disabled={isMutationLocked || !hasShiftableItems}
            leftSection={<Warehouse size={16} />}
            color={CREATE_ACTION_COLOR}
            variant="filled"
            onClick={allToStore}
          >
            {t('Все на склад')}
          </Button>
        </Group>
        }
        stacked
      >

      <Box className="sale-edit-table-shell">
        <DataTable
          columns={tableColumns}
          data={tableRows}
          defaultLayout={SALE_EDIT_TABLE_LAYOUT}
          distributeAvailableWidth
          emptyText={t('Товарів не знайдено')}
          getRowId={(row) => row.key}
          height="100%"
          layoutVersion={isNew ? 'sale-edit-new-6' : 'sale-edit-invoice-6'}
          minWidth={SALE_EDIT_TABLE_MIN_WIDTH}
          showDensityToggle={false}
          showToolbar={false}
          tableId={isNew ? 'sale-edit-new' : 'sale-edit-invoice'}
        />
      </Box>
      </DocumentDetailSection>
      </DocumentDetailLayout>
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
  updateEntry: (key: string, target: 'bill' | 'store', value: number | string) => void
}): DataTableColumn<SaleEditOrderItemRow>[] {
  const columns: DataTableColumn<SaleEditOrderItemRow>[] = [
    {
      id: 'vendorCode',
      header: t('Код виробника'),
      accessor: (row) => getOrderItemProductCode(row.item),
      cell: (row) => <TableChip tone="document" value={displayValue(getOrderItemProductCode(row.item)) || '-'} />,
      width: 144,
      minWidth: 144,
      enableSorting: false,
    },
    {
      id: 'originalNumber',
      header: t('Ориг. номер'),
      accessor: (row) => row.item.Product?.MainOriginalNumber || '',
      cell: (row) => <TableChip tone="product" value={displayValue(row.item.Product?.MainOriginalNumber) || '-'} />,
      width: 120,
      minWidth: 120,
      enableSorting: false,
    },
    {
      id: 'product',
      header: t('Назва товару'),
      accessor: (row) => getOrderItemProductName(row.item),
      cell: (row) => (
        <Group className="sale-edit-product" gap={8} wrap="nowrap">
          <span className="sale-edit-product__icon"><Package size={16} aria-hidden="true" /></span>
          <Text className="sale-edit-product-name" title={displayValue(getOrderItemProductName(row.item))}>
            {displayValue(getOrderItemProductName(row.item)) || '-'}
          </Text>
        </Group>
      ),
      width: 200,
      minWidth: 200,
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
      width: 88,
      minWidth: 88,
      enableSorting: false,
    },
    {
      id: 'currency',
      header: t('Валюта'),
      accessor: () => 'EUR',
      cell: () => <TableChip tone="source" value="EUR" />,
      align: 'center',
      width: 96,
      minWidth: 96,
      enableSorting: false,
    },
    {
      id: 'qty',
      header: t('К-сть'),
      align: 'right',
      accessor: (row) => row.qty,
      cell: (row) => <span className="sale-edit-qty">{displayValue(row.qty)}</span>,
      width: 84,
      minWidth: 84,
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
          <SaleEditShiftInput
            itemKey={row.key}
            target="store"
            value={row.entry.store}
            max={Math.max(0, row.qty - (isNew ? 0 : row.billNum))}
            disabled={isSaving}
            label={`${t('На склад')}: ${getOrderItemProductName(row.item)}`}
            hint={label}
            showHint={Boolean(storageName)}
            onChange={updateEntry}
          />
        )
      },
      width: 104,
      minWidth: 104,
      className: 'sale-edit-input-column',
      enableSorting: false,
    },
    {
      id: 'created',
      header: t('Дата'),
      accessor: (row) => row.item.Created || '',
      cell: (row) => <span className="sale-edit-muted-value">{formatDateTime(row.item.Created) || '-'}</span>,
      width: 104,
      minWidth: 104,
      enableSorting: false,
    },
    {
      id: 'user',
      header: t('Відповідальний'),
      accessor: (row) => getUserName(row.item.User),
      cell: (row) => <TableChip tone="warning" value={displayValue(getUserName(row.item.User)) || '-'} />,
      width: 152,
      minWidth: 152,
      enableSorting: false,
    },
  ]

  if (!isNew) {
    columns.splice(6, 0, {
      id: 'bill',
      header: t('В рахунок'),
      accessor: (row) => row.entry.bill,
      cell: (row) => (
        <SaleEditShiftInput
          itemKey={row.key}
          target="bill"
          value={row.entry.bill}
          max={Math.max(0, row.qty - row.storeNum)}
          disabled={isSaving}
          label={`${t('В рахунок')}: ${getOrderItemProductName(row.item)}`}
          hint={t('Скасувати резерв у рахунку')}
          showHint
          onChange={updateEntry}
        />
      ),
      width: 112,
      minWidth: 112,
      className: 'sale-edit-input-column',
      enableSorting: false,
    })
  }

  return columns
}

function buildShiftPayload(sale: SalesUkraineSale, draft: ShiftDraft): SalesUkraineSale {
  const orderItems = getOrderItems(sale).filter(hasShiftableQuantity)

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
