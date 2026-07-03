import {
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  ScrollArea,
  Stack,
  Table,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconArrowsLeftRight, IconBuildingWarehouse, IconReceipt } from '@tabler/icons-react'
import { useEffect, useReducer } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getShiftedSaleById, shiftOrderItemsCurrent } from '../api/salesUkraineApi'
import { getSaleLifecycleStatusKey } from '../saleStatus'
import {
  OrderItemShiftStatusType,
  type SalesUkraineOrderItem,
  type SalesUkraineOrderItemShiftStatus,
  type SalesUkraineSale,
} from '../types'
import './sales-drawers.css'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

type ShiftDraftEntry = { bill: number | string; billTouched: boolean; store: number | string; storeTouched: boolean }
type ShiftDraft = Record<string, ShiftDraftEntry>

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
      offset={8}
      opened={Boolean(sale)}
      padding="lg"
      position="right"
      radius="md"
      size="min(1180px, 100vw)"
      title={sale ? `${title} ${sale.SaleNumber?.Value || ''}`.trim() : title}
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
      await shiftOrderItemsCurrent(payload)
      notifications.show({ color: 'green', message: t('Зсув виконано') })
      onSaved()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося виконати зсув') })
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
      <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
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
      gap="md"
      onKeyUp={(event) => {
        if (event.key === 'Enter' && !isSaving) {
          void doShift()
        }
      }}
    >
      <Group justify="space-between" wrap="wrap">
        <Badge color="blue" variant="light">
          {t('Товарів')}: {orderItems.length}
        </Badge>
        <Group gap="xs">
          {!isNew && (
            <Button disabled={isSaving} leftSection={<IconReceipt size={16} />} variant="light" onClick={allToBill}>
              {t('Все в рахунок')}
            </Button>
          )}
          <Button disabled={isSaving} leftSection={<IconBuildingWarehouse size={16} />} variant="light" onClick={allToStore}>
            {t('Все на склад')}
          </Button>
        </Group>
      </Group>

      <ScrollArea.Autosize mah="calc(100vh - 260px)" type="auto">
        <Table className="sales-drawer-table" withRowBorders={false} stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Код Виробника')}</Table.Th>
              <Table.Th>{t('Ориг. номер')}</Table.Th>
              <Table.Th>{t('Назва товару')}</Table.Th>
              <Table.Th ta="right">{t('Сума')}</Table.Th>
              <Table.Th>{t('Валюта')}</Table.Th>
              <Table.Th ta="right">{t('К-сть')}</Table.Th>
              {!isNew && (
                <Table.Th ta="right" style={{ minWidth: 120 }}>
                  {t('В рахунок')}
                </Table.Th>
              )}
              <Table.Th ta="right" style={{ minWidth: 120 }}>
                {t('На склад')}
              </Table.Th>
              <Table.Th>{t('Дата')}</Table.Th>
              <Table.Th>{t('Відповідальний')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {orderItems.map((item, index) => {
              const key = itemKey(item, index)
              const qty = getNumber(item.Qty) ?? 0
              const entry = draft[key] || EMPTY_DRAFT_ENTRY
              const billNum = entry.billTouched ? toNumber(entry.bill) : getExistingShiftQty(item, OrderItemShiftStatusType.Bill)
              const storeNum = entry.storeTouched ? toNumber(entry.store) : getExistingShiftQty(item, OrderItemShiftStatusType.Store)

              return (
                <Table.Tr key={key}>
                  <Table.Td>{displayValue(getOrderItemProductCode(item))}</Table.Td>
                  <Table.Td>{displayValue(item.Product?.MainOriginalNumber)}</Table.Td>
                  <Table.Td>{displayValue(getOrderItemProductName(item))}</Table.Td>
                  <Table.Td ta="right">{amountFormatter.format(getNumber(item.TotalAmount) ?? 0)}</Table.Td>
                  <Table.Td>EUR</Table.Td>
                  <Table.Td ta="right">{displayValue(qty)}</Table.Td>
                  {!isNew && (
                    <Table.Td>
                      <NumberInput
                        allowDecimal={false}
                        allowNegative={false}
                        clampBehavior="strict"
                        hideControls
                        max={Math.max(0, qty - storeNum)}
                        min={0}
                        size="xs"
                        value={entry.bill}
                        onChange={(value) => updateEntry(key, { bill: value, billTouched: true })}
                      />
                    </Table.Td>
                  )}
                  <Table.Td>
                    <NumberInput
                      allowDecimal={false}
                      allowNegative={false}
                      clampBehavior="strict"
                      hideControls
                      max={Math.max(0, qty - (isNew ? 0 : billNum))}
                      min={0}
                      size="xs"
                      value={entry.store}
                      onChange={(value) => updateEntry(key, { store: value, storeTouched: true })}
                    />
                  </Table.Td>
                  <Table.Td>{formatDateTime(item.Created)}</Table.Td>
                  <Table.Td>{displayValue(getUserName(item.User))}</Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>

      <Group justify="flex-end" gap="sm">
        <Button color="gray" disabled={isSaving} variant="subtle" onClick={onClose}>
          {t('Скасувати')}
        </Button>
        <Button color={CREATE_ACTION_COLOR} leftSection={<IconArrowsLeftRight size={16} />} loading={isSaving} onClick={doShift}>
          {t('Зробити зсув')}
        </Button>
      </Group>
    </Stack>
  )
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
