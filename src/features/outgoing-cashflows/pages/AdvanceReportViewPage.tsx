import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  Stack,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  calculateAdvanceReportOrder,
  getAdvanceReportOrder,
  updateAdvanceReportOrder,
} from '../api/advanceReportApi'
import {
  PaymentRegisterTypeValue,
  type AdvanceReportConsumableRow,
  type AdvanceReportFuelRow,
  type AdvanceReportOrder,
} from '../advanceReportTypes'
import { AdvanceReportFuelGrid } from '../components/AdvanceReportFuelGrid'
import { AdvanceReportProductsGrid } from '../components/AdvanceReportProductsGrid'

const OUTGOING_CASHFLOW_ROUTE = '/accounting/outgoing-cashflow'

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

function useAdvanceReportViewModel() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [order, setOrder] = useValueState<AdvanceReportOrder | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [error, setError] = useValueState<string | null>(null)
  const [isSaving, setSaving] = useValueState(false)
  const [createIncomeAutomatically, setCreateIncomeAutomatically] = useValueState(false)
  const requestRef = useRef(0)

  useEffect(() => {
    if (!id) {
      setOrder(null)
      setLoading(false)
      setError(t('Не вказано ідентифікатор авансового звіту'))
      return
    }

    const requestId = requestRef.current + 1
    requestRef.current = requestId
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load(netId: string) {
      try {
        const result = await getAdvanceReportOrder(netId)

        if (!cancelled && requestRef.current === requestId) {
          setOrder(result)
          setError(result ? null : t('Авансовий звіт не знайдено'))
        }
      } catch (loadError) {
        if (!cancelled && requestRef.current === requestId) {
          setOrder(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити авансовий звіт'))
        }
      } finally {
        if (!cancelled && requestRef.current === requestId) {
          setLoading(false)
        }
      }
    }

    void load(id)

    return () => {
      cancelled = true
    }
  }, [id, setError, setLoading, setOrder, t])

  const consumableRows = useMemo(() => buildConsumableRows(order), [order])
  const fuelRows = useMemo(() => buildFuelRows(order), [order])
  const totals = useMemo(() => calculateTotals(order), [order])
  const orderAmount = order?.Amount || 0
  const reportTotal = totals.total
  const isDone = Boolean(order?.IsUnderReportDone)
  const currencyCode = order?.PaymentCurrencyRegister?.Currency?.Code || order?.PaymentCurrencyRegister?.Currency?.Name
  const headerTitle = useMemo(() => buildHeaderTitle(order, t), [order, t])
  const reportTitle = useMemo(() => buildReportTitle(order, t), [order, t])

  const goBack = useCallback(() => {
    navigate(OUTGOING_CASHFLOW_ROUTE)
  }, [navigate])

  const recalculate = useCallback(
    async (nextOrder: AdvanceReportOrder) => {
      setError(null)

      try {
        const calculated = await calculateAdvanceReportOrder(nextOrder)

        if (calculated) {
          setOrder(calculated)
        }
      } catch (calculateError) {
        setError(calculateError instanceof Error ? calculateError.message : t('Не вдалося перерахувати суму'))
      }
    },
    [setError, setOrder, t],
  )

  const removeConsumableRow = useCallback(
    (row: AdvanceReportConsumableRow) => {
      if (!order) {
        return
      }

      setOrder(removeConsumableItem(order, row.id))
      void recalculate(removeConsumableItem(order, row.id))
    },
    [order, recalculate, setOrder],
  )

  const removeFuelRow = useCallback(
    (row: AdvanceReportFuelRow) => {
      if (!order) {
        return
      }

      const nextOrder = removeFuelItem(order, row.id)
      setOrder(nextOrder)
      void recalculate(nextOrder)
    },
    [order, recalculate, setOrder],
  )

  const save = useCallback(
    async (auto: boolean) => {
      if (!order) {
        return
      }

      if (!hasAnyRows(order)) {
        notifications.show({ color: 'red', message: t('Добавьте хоча б 1 товар') })
        return
      }

      setSaving(true)
      setError(null)

      const payload: AdvanceReportOrder = {
        ...order,
        IsUnderReportDone: true,
        OutcomePaymentOrderConsumablesOrders: (order.OutcomePaymentOrderConsumablesOrders || []).map((item) => ({
          ...item,
          ConsumablesOrder: item.ConsumablesOrder
            ? { ...item.ConsumablesOrder, IsPayed: true }
            : item.ConsumablesOrder,
        })),
      }

      try {
        await updateAdvanceReportOrder(auto, payload)
        notifications.show({ color: 'green', message: t('Оновлення видаткового ордера') })
        navigate(OUTGOING_CASHFLOW_ROUTE)
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти авансовий звіт'))
      } finally {
        setSaving(false)
      }
    },
    [navigate, order, setError, setSaving, t],
  )

  return {
    consumableRows,
    createIncomeAutomatically,
    currencyCode,
    error,
    fuelRows,
    headerTitle,
    isDone,
    isLoading,
    isSaving,
    order,
    orderAmount,
    reportTitle,
    reportTotal,
    totals,
    goBack,
    removeConsumableRow,
    removeFuelRow,
    save,
    setCreateIncomeAutomatically,
  }
}

export function AdvanceReportViewPage() {
  const model = useAdvanceReportViewModel()
  const { t } = useI18n()

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Button color="gray" leftSection={<IconArrowLeft size={16} />} variant="light" onClick={model.goBack}>
          {t('Назад')}
        </Button>
        {!model.isDone && model.order && hasAnyRows(model.order) && (
          <Button
            color="violet"
            leftSection={<IconDeviceFloppy size={16} />}
            loading={model.isSaving}
            onClick={() => model.save(model.createIncomeAutomatically)}
          >
            {t('Зберегти')}
          </Button>
        )}
      </Group>

      {model.error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {model.error}
        </Alert>
      )}

      {model.isLoading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : model.order ? (
        <AdvanceReportContent model={model} />
      ) : null}
    </Stack>
  )
}

function AdvanceReportContent({ model }: { model: ReturnType<typeof useAdvanceReportViewModel> }) {
  const { t } = useI18n()
  const { order } = model

  if (!order) {
    return null
  }

  const hasConsumables = (order.OutcomePaymentOrderConsumablesOrders || []).length > 0
  const hasFuel = (order.CompanyCarFuelings || []).length > 0

  return (
    <Stack gap="md">
      <Card withBorder padding="md" radius="md">
        <Stack gap={4}>
          <Text fw={700}>{model.reportTitle}</Text>
          <Group gap={8}>
            <Text fw={600}>{model.headerTitle}</Text>
            <Text>{displayValue(order.Number)}</Text>
            <Text c="dimmed">{t('Від')}</Text>
            <Text>{formatDateTime(order.FromDate)}</Text>
            {order.Colleague?.LastName && <Text>{order.Colleague.LastName}</Text>}
            <Text c="dimmed">{t('на сумму')}</Text>
            <Text fw={600}>
              {formatMoney(model.orderAmount)} {model.currencyCode || ''}
            </Text>
          </Group>
        </Stack>
      </Card>

      {hasConsumables && (
        <Card withBorder padding="md" radius="md">
          <Stack gap="sm">
            <Text fw={700}>
              {t('Товари')} / {t('Послуги')}
            </Text>
            <AdvanceReportProductsGrid
              canRemove={!model.isDone}
              rows={model.consumableRows}
              onRemove={model.removeConsumableRow}
            />
          </Stack>
        </Card>
      )}

      {hasFuel && (
        <Card withBorder padding="md" radius="md">
          <Stack gap="sm">
            <Text fw={700}>{t('Пальне')}</Text>
            <AdvanceReportFuelGrid canRemove={!model.isDone} rows={model.fuelRows} onRemove={model.removeFuelRow} />
          </Stack>
        </Card>
      )}

      {hasAnyRows(order) && (
        <Card withBorder padding="md" radius="md">
          <Stack gap="md">
            <IncomeMessage model={model} />
            <DifferenceMessage model={model} />
            <Group justify="flex-end" gap="xl">
              <TotalItem label={t('в.т.ч ПДВ')} value={formatMoney(model.totals.totalVat)} />
              <TotalItem label={t('Сума')} value={formatMoney(model.totals.total)} />
            </Group>
          </Stack>
        </Card>
      )}
    </Stack>
  )
}

function IncomeMessage({ model }: { model: ReturnType<typeof useAdvanceReportViewModel> }) {
  const { t } = useI18n()
  const { order } = model

  if (!order || model.isDone) {
    return null
  }

  const amount = order.Amount || 0
  const overSpent = amount < model.reportTotal
  const underSpent = amount > model.reportTotal

  if (!overSpent && !underSpent) {
    return null
  }

  const difference = overSpent ? model.reportTotal - amount : amount - model.reportTotal
  const orderTypeLabel = overSpent ? incomeOrderTypeLabel(order, t) : model.headerTitle

  return (
    <Group align="center" gap="sm" wrap="wrap">
      <Checkbox
        checked={model.createIncomeAutomatically}
        label={t('Створити автоматично')}
        onChange={(event) => model.setCreateIncomeAutomatically(event.currentTarget.checked)}
      />
      <Text>{t('Буде створений новий')}</Text>
      <Text fw={600}>{orderTypeLabel}</Text>
      <Text c="dimmed">{t('на сумму')}</Text>
      <Text fw={700}>
        {formatMoney(difference)} {model.currencyCode || ''}
      </Text>
    </Group>
  )
}

function DifferenceMessage({ model }: { model: ReturnType<typeof useAdvanceReportViewModel> }) {
  const { t } = useI18n()
  const { order } = model
  const difference = order?.DifferenceAmount || 0

  if (!order || !model.isDone || difference === 0) {
    return null
  }

  if (difference < 0) {
    return (
      <Group align="center" gap="sm" wrap="wrap">
        <Badge color="red" variant="light">
          {t('Борг колеги')}: {formatMoney(difference)}
        </Badge>
        <Button color="green" size="xs" variant="light" onClick={() => model.save(true)}>
          {t('Оплатив')}
        </Button>
      </Group>
    )
  }

  return (
    <Group align="center" gap="sm" wrap="wrap">
      <Badge color="green" variant="light">
        {t('Винні колезі')}: {formatMoney(difference)}
      </Badge>
      <Button color="violet" size="xs" variant="light" onClick={() => model.save(true)}>
        {t('Погасити борг')}
      </Button>
    </Group>
  )
}

function TotalItem({ label, value }: { label: string; value: string }) {
  return (
    <Group gap={8}>
      <Text c="dimmed">{label}</Text>
      <Text fw={700}>{value}</Text>
    </Group>
  )
}

function buildConsumableRows(order: AdvanceReportOrder | null): AdvanceReportConsumableRow[] {
  if (!order?.OutcomePaymentOrderConsumablesOrders) {
    return []
  }

  const rows: AdvanceReportConsumableRow[] = []

  order.OutcomePaymentOrderConsumablesOrders.forEach((entry, entryIndex) => {
    const consumablesOrder = entry.ConsumablesOrder
    const items = consumablesOrder?.ConsumablesOrderItems || []

    items.forEach((item, itemIndex) => {
      rows.push({
        agreementName: consumablesOrder?.SupplyOrganizationAgreement?.Name || '',
        amount: item.TotalPrice,
        category: item.ConsumableProductCategory?.Name || '',
        id: String(item.NetUid || item.Id || `${entryIndex}-${itemIndex}`),
        name: item.ConsumableProduct?.Name || '',
        organization: consumablesOrder?.ConsumableProductOrganization?.Name || '',
        organizationFromNumber: consumablesOrder?.OrganizationNumber || '',
        organizationName: consumablesOrder?.SupplyOrganizationAgreement?.Organization?.FullName || '',
        pricePerUnit: item.PricePerItem,
        quantity: item.Qty,
        storageName: consumablesOrder?.ConsumablesStorage?.Name || '',
        totalAmount: item.TotalPriceWithVAT,
        vatAmount: item.VAT,
        vatPercent: item.VatPercent,
        vendorCode: item.ConsumableProduct?.VendorCode || '',
      })
    })
  })

  return rows
}

function buildFuelRows(order: AdvanceReportOrder | null): AdvanceReportFuelRow[] {
  if (!order?.CompanyCarFuelings) {
    return []
  }

  return order.CompanyCarFuelings.map((fueling, index) => ({
    companyCar: fueling.CompanyCar?.LicensePlate || '',
    fuelAmount: fueling.FuelAmount,
    id: String(fueling.Id || `fuel-${index}`),
    paymentCostMovement: fueling.PaymentCostMovementOperation?.PaymentCostMovement?.OperationName || '',
    pricePerLiter: fueling.PricePerLiter,
    serviceOrganization: fueling.ConsumableProductOrganization?.Name || '',
    totalAmountWithoutVat: fueling.TotalPrice,
    totalPrice: fueling.TotalPriceWithVat,
    vatAmount: fueling.VatAmount,
    vatPercent: fueling.VatPercent,
  }))
}

function calculateTotals(order: AdvanceReportOrder | null): { total: number; totalVat: number } {
  if (!order) {
    return { total: 0, totalVat: 0 }
  }

  const fuelings = order.CompanyCarFuelings || []
  const items = (order.OutcomePaymentOrderConsumablesOrders || []).flatMap(
    (entry) => entry.ConsumablesOrder?.ConsumablesOrderItems || [],
  )

  const total =
    fuelings.reduce((sum, fueling) => sum + (fueling.TotalPriceWithVat || 0), 0) +
    items.reduce((sum, item) => sum + (item.TotalPriceWithVAT || 0), 0)
  const totalVat =
    fuelings.reduce((sum, fueling) => sum + (fueling.VatAmount || 0), 0) +
    items.reduce((sum, item) => sum + (item.VAT || 0), 0)

  return { total, totalVat }
}

function removeConsumableItem(order: AdvanceReportOrder, rowId: string): AdvanceReportOrder {
  const entries = (order.OutcomePaymentOrderConsumablesOrders || [])
    .map((entry, entryIndex) => {
      const consumablesOrder = entry.ConsumablesOrder

      if (!consumablesOrder) {
        return entry
      }

      const items = (consumablesOrder.ConsumablesOrderItems || []).filter(
        (item, itemIndex) => String(item.NetUid || item.Id || `${entryIndex}-${itemIndex}`) !== rowId,
      )

      return {
        ...entry,
        ConsumablesOrder: { ...consumablesOrder, ConsumablesOrderItems: items },
      }
    })
    .filter((entry) => (entry.ConsumablesOrder?.ConsumablesOrderItems || []).length > 0)

  return { ...order, OutcomePaymentOrderConsumablesOrders: entries }
}

function removeFuelItem(order: AdvanceReportOrder, rowId: string): AdvanceReportOrder {
  const fuelings = (order.CompanyCarFuelings || []).filter(
    (fueling, index) => String(fueling.Id || `fuel-${index}`) !== rowId,
  )

  return { ...order, CompanyCarFuelings: fuelings }
}

function hasAnyRows(order: AdvanceReportOrder): boolean {
  return (
    (order.OutcomePaymentOrderConsumablesOrders || []).length > 0 || (order.CompanyCarFuelings || []).length > 0
  )
}

function buildHeaderTitle(order: AdvanceReportOrder | null, t: (key: string) => string): string {
  const type = order?.PaymentCurrencyRegister?.PaymentRegister?.Type

  if (type === PaymentRegisterTypeValue.Cash) {
    return t('Видатковий касовий ордер')
  }

  if (type === PaymentRegisterTypeValue.Bank) {
    return t('Видатковий банківський ордер')
  }

  return t('Видатковий картковий ордер')
}

function incomeOrderTypeLabel(order: AdvanceReportOrder, t: (key: string) => string): string {
  const type = order.PaymentCurrencyRegister?.PaymentRegister?.Type

  if (type === PaymentRegisterTypeValue.Cash) {
    return t('Прибутковий касовий ордер')
  }

  if (type === PaymentRegisterTypeValue.Bank) {
    return t('Прибутковий банківський ордер')
  }

  return t('Прибутковий картковий ордер')
}

function buildReportTitle(order: AdvanceReportOrder | null, t: (key: string) => string): string {
  if (!order) {
    return ''
  }

  return `${t('Авансовий звіт')} ${order.AdvanceNumber || ''} ${t('Від')} ${dateTimeFormatter.format(new Date())}`
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '—'
}

function displayValue(value?: string): string {
  return value ? value : '—'
}
