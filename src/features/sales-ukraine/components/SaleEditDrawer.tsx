import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  NumberInput,
  ScrollArea,
  Stack,
  Table,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconArrowsLeftRight, IconBuildingWarehouse, IconReceipt } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { getSaleById, shiftOrderItemsCurrent } from '../api/salesUkraineApi'
import {
  OrderItemShiftStatusType,
  type SalesUkraineOrderItem,
  type SalesUkraineOrderItemShiftStatus,
  type SalesUkraineSale,
} from '../types'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

type ShiftDraftEntry = { bill: number | string; store: number | string }
type ShiftDraft = Record<string, ShiftDraftEntry>

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
  const isNew = sale?.BaseLifeCycleStatus?.SaleLifeCycleType === 0
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
  const [sale, setSale] = useState<SalesUkraineSale>(initialSale)
  const [draft, setDraft] = useState<ShiftDraft>(() => buildDraft(getOrderItems(initialSale)))
  const [isLoading, setLoading] = useState(() => Boolean(initialSale.NetUid))
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const netId = initialSale.NetUid

    if (!netId) {
      return
    }

    let cancelled = false

    async function load(id: string) {
      setLoading(true)
      setError(null)

      try {
        const next = await getSaleById(id)

        if (!cancelled && next) {
          setSale(next)
          setDraft(buildDraft(getOrderItems(next)))
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити продаж'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load(netId)

    return () => {
      cancelled = true
    }
  }, [initialSale.NetUid, t])

  const orderItems = getOrderItems(sale)
  const currencyCode = sale.ClientAgreement?.Agreement?.Currency?.Code || 'EUR'

  function updateEntry(key: string, patch: Partial<ShiftDraftEntry>) {
    setDraft((current) => ({ ...current, [key]: { ...current[key], ...patch } }))
  }

  function allToBill() {
    setDraft(() => {
      const next: ShiftDraft = {}

      orderItems.forEach((item, index) => {
        const qty = getNumber(item.Qty) ?? 0
        next[itemKey(item, index)] = { bill: qty || '', store: '' }
      })

      return next
    })
  }

  function allToStore() {
    setDraft(() => {
      const next: ShiftDraft = {}

      orderItems.forEach((item, index) => {
        const qty = getNumber(item.Qty) ?? 0
        next[itemKey(item, index)] = { bill: '', store: qty || '' }
      })

      return next
    })
  }

  async function doShift() {
    setSaving(true)

    try {
      const payload = buildShiftPayload(sale, draft)
      await shiftOrderItemsCurrent(payload)
      notifications.show({ color: 'green', message: t('Зсув виконано') })
      onSaved()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося виконати зсув') })
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    )
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
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <Badge color="blue" variant="light">
          {t('Товарів')}: {orderItems.length}
        </Badge>
        <Group gap="xs">
          <Button leftSection={<IconReceipt size={16} />} variant="light" onClick={allToBill}>
            {t('Все в рахунок')}
          </Button>
          <Button leftSection={<IconBuildingWarehouse size={16} />} variant="light" onClick={allToStore}>
            {t('Все на склад')}
          </Button>
        </Group>
      </Group>

      <ScrollArea.Autosize mah="calc(100vh - 260px)" type="auto">
        <Table withColumnBorders highlightOnHover horizontalSpacing="sm" stickyHeader verticalSpacing={6}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Код Виробника')}</Table.Th>
              <Table.Th>{t('Ориг. номер')}</Table.Th>
              <Table.Th>{t('Назва товару')}</Table.Th>
              <Table.Th ta="right">{t('Сума')}</Table.Th>
              <Table.Th>{t('Валюта')}</Table.Th>
              <Table.Th ta="right">{t('К-сть')}</Table.Th>
              <Table.Th ta="right" style={{ minWidth: 120 }}>
                {t('В рахунок')}
              </Table.Th>
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
              const entry = draft[key] || { bill: '', store: '' }
              const billNum = toNumber(entry.bill)
              const storeNum = toNumber(entry.store)

              return (
                <Table.Tr key={key}>
                  <Table.Td>{displayValue(getOrderItemProductCode(item))}</Table.Td>
                  <Table.Td>{displayValue(item.Product?.MainOriginalNumber)}</Table.Td>
                  <Table.Td>{displayValue(getOrderItemProductName(item))}</Table.Td>
                  <Table.Td ta="right">
                    {amountFormatter.format(getNumber(item.TotalAmountLocal) ?? getNumber(item.TotalAmount) ?? 0)}
                  </Table.Td>
                  <Table.Td>{currencyCode}</Table.Td>
                  <Table.Td ta="right">{displayValue(qty)}</Table.Td>
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
                      onChange={(value) => updateEntry(key, { bill: value })}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      allowDecimal={false}
                      allowNegative={false}
                      clampBehavior="strict"
                      hideControls
                      max={Math.max(0, qty - billNum)}
                      min={0}
                      size="xs"
                      value={entry.store}
                      onChange={(value) => updateEntry(key, { store: value })}
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
        <Button color="teal" leftSection={<IconArrowsLeftRight size={16} />} loading={isSaving} onClick={doShift}>
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
    const entry = draft[key] || { bill: '', store: '' }
    const billQty = toNumber(entry.bill)
    const storeQty = toNumber(entry.store)
    const existing = Array.isArray(item.ShiftStatuses) ? item.ShiftStatuses : []
    const nextStatuses: SalesUkraineOrderItemShiftStatus[] = []

    if (billQty > 0) {
      nextStatuses.push(buildShiftStatus(existing, OrderItemShiftStatusType.Bill, billQty, item))
    }

    if (storeQty > 0) {
      nextStatuses.push(buildShiftStatus(existing, OrderItemShiftStatusType.Store, storeQty, item))
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

function buildShiftStatus(
  existing: SalesUkraineOrderItemShiftStatus[],
  shiftStatus: number,
  qty: number,
  item: SalesUkraineOrderItem,
): SalesUkraineOrderItemShiftStatus {
  const current = existing.find((status) => status.ShiftStatus === shiftStatus)

  if (current) {
    return { ...current, Qty: qty }
  }

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
    const statuses = Array.isArray(item.ShiftStatuses) ? item.ShiftStatuses : []
    const bill = statuses.find((status) => status.ShiftStatus === OrderItemShiftStatusType.Bill)?.Qty
    const store = statuses.find((status) => status.ShiftStatus === OrderItemShiftStatusType.Store)?.Qty

    draft[itemKey(item, index)] = {
      bill: typeof bill === 'number' ? bill : '',
      store: typeof store === 'number' ? store : '',
    }
  })

  return draft
}

function getOrderItems(sale: SalesUkraineSale): SalesUkraineOrderItem[] {
  return Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
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
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : '—'
  }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')

  return `${day}.${month}.${date.getFullYear()}`
}

function displayValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  if (typeof value === 'string') {
    return value.trim() || '—'
  }

  return '—'
}
