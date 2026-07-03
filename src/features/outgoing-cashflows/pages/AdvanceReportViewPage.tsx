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
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy, IconGasStation, IconReceipt2 } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import {
  calculateAdvanceReportOrder,
  getAdvanceReportOrder,
  updateAdvanceReportOrder,
} from '../api/advanceReportApi'
import {
  canRemoveAdvanceReportConsumableRow,
  canRemoveAdvanceReportFuelRow,
  isLocalAdvanceReportEntity,
} from '../advanceReportRowPermissions'
import {
  PaymentRegisterTypeValue,
  type AdvanceReportConsumablesOrder,
  type AdvanceReportConsumableRow,
  type AdvanceReportFuelRow,
  type AdvanceReportOrder,
  type CompanyCarFueling,
} from '../advanceReportTypes'
import { AdvanceReportConsumableOrderModal } from '../components/AdvanceReportConsumableOrderModal'
import { AdvanceReportFuelGrid } from '../components/AdvanceReportFuelGrid'
import { AdvanceReportFuelModal } from '../components/AdvanceReportFuelModal'
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

type AdvanceReportViewState = {
  consumableDocumentFilesByOrderKey: Record<string, File[]>
  error: string | null
  hasLocalChanges: boolean
  isLoading: boolean
  order: AdvanceReportOrder | null
}

const INITIAL_ADVANCE_REPORT_VIEW_STATE: AdvanceReportViewState = {
  consumableDocumentFilesByOrderKey: {},
  error: null,
  hasLocalChanges: false,
  isLoading: true,
  order: null,
}

function useAdvanceReportViewModel() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [viewState, setViewState] = useValueState<AdvanceReportViewState>(INITIAL_ADVANCE_REPORT_VIEW_STATE)
  const [isSaving, setSaving] = useValueState(false)
  const [isRecalculating, setRecalculating] = useValueState(false)
  const [isConsumableModalOpen, setConsumableModalOpen] = useValueState(false)
  const [isFuelModalOpen, setFuelModalOpen] = useValueState(false)
  const [createIncomeAutomatically, setCreateIncomeAutomatically] = useValueState(false)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useValueState(false)
  const requestRef = useRef(0)
  const recalculateRef = useRef(0)
  const { consumableDocumentFilesByOrderKey, error, hasLocalChanges, isLoading, order } = viewState

  useEffect(() => {
    if (!id) {
      setViewState({
        ...INITIAL_ADVANCE_REPORT_VIEW_STATE,
        error: t('Не вказано ідентифікатор авансового звіту'),
        isLoading: false,
      })
      return
    }

    const requestId = requestRef.current + 1
    requestRef.current = requestId
    let cancelled = false
    setViewState((current) => ({
      ...current,
      error: null,
      isLoading: true,
    }))

    async function load(netId: string) {
      try {
        const result = await getAdvanceReportOrder(netId)

        if (!cancelled && requestRef.current === requestId) {
          setViewState({
            consumableDocumentFilesByOrderKey: {},
            error: result ? null : t('Авансовий звіт не знайдено'),
            hasLocalChanges: false,
            isLoading: false,
            order: result,
          })
        }
      } catch (loadError) {
        if (!cancelled && requestRef.current === requestId) {
          setViewState({
            ...INITIAL_ADVANCE_REPORT_VIEW_STATE,
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити авансовий звіт'),
            isLoading: false,
          })
        }
      }
    }

    void load(id)

    return () => {
      cancelled = true
    }
  }, [id, setViewState, t])

  const isDone = Boolean(order?.IsUnderReportDone)
  const consumableRows = useMemo(() => buildConsumableRows(order, isDone), [isDone, order])
  const fuelRows = useMemo(() => buildFuelRows(order, isDone), [isDone, order])
  const totals = useMemo(() => calculateTotals(order), [order])
  const orderAmount = order?.Amount || 0
  const reportTotal = totals.total
  const isBusy = isSaving || isRecalculating
  const canAppendRows = Boolean(order && !isBusy && (!isDone || (order.DifferenceAmount || 0) < 0))
  const hasUnsavedRows = useMemo(() => Boolean(order && hasNewRows(order)), [order])
  const hasPendingConsumableFiles = hasFilesByOrderKey(consumableDocumentFilesByOrderKey)
  const hasPendingChanges = hasLocalChanges || hasUnsavedRows || hasPendingConsumableFiles
  const canSave = Boolean(order && !isBusy && hasAnyRows(order) && (!isDone || hasUnsavedRows))
  const currencyCode = order?.PaymentCurrencyRegister?.Currency?.Code || order?.PaymentCurrencyRegister?.Currency?.Name
  const headerTitle = useMemo(() => buildHeaderTitle(order, t), [order, t])
  const reportTitle = useMemo(() => buildReportTitle(order, t), [order, t])

  const goBack = useCallback(() => {
    if (isBusy) {
      return
    }

    if (hasPendingChanges) {
      setConfirmLeaveOpen(true)
      return
    }

    navigate(OUTGOING_CASHFLOW_ROUTE)
  }, [hasPendingChanges, isBusy, navigate, setConfirmLeaveOpen])

  const confirmLeave = useCallback(() => {
    if (isBusy) {
      return
    }

    setConfirmLeaveOpen(false)
    navigate(OUTGOING_CASHFLOW_ROUTE)
  }, [isBusy, navigate, setConfirmLeaveOpen])

  useEffect(() => {
    if (!hasPendingChanges) {
      return undefined
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasPendingChanges])

  const recalculate = useCallback(
    async (nextOrder: AdvanceReportOrder) => {
      const requestId = recalculateRef.current + 1
      recalculateRef.current = requestId
      setViewState((current) => ({ ...current, error: null }))
      setRecalculating(true)

      try {
        const calculated = await calculateAdvanceReportOrder(nextOrder)

        if (recalculateRef.current === requestId) {
          if (calculated) {
            setViewState((current) => ({ ...current, order: calculated }))
          } else {
            setViewState((current) => ({ ...current, error: t('Не вдалося перерахувати суму') }))
          }
        }
      } catch (calculateError) {
        if (recalculateRef.current === requestId) {
          setViewState((current) => ({
            ...current,
            error: calculateError instanceof Error ? calculateError.message : t('Не вдалося перерахувати суму'),
          }))
        }
      } finally {
        if (recalculateRef.current === requestId) {
          setRecalculating(false)
        }
      }
    },
    [setRecalculating, setViewState, t],
  )

  const removeConsumableRow = useCallback(
    (row: AdvanceReportConsumableRow) => {
      if (!order || isBusy) {
        return
      }

      const nextOrder = removeConsumableItem(order, row.id)
      setViewState((current) => ({
        ...current,
        consumableDocumentFilesByOrderKey: pruneConsumableDocumentFiles(current.consumableDocumentFilesByOrderKey, nextOrder),
        hasLocalChanges: true,
        order: nextOrder,
      }))
      void recalculate(nextOrder)
    },
    [isBusy, order, recalculate, setViewState],
  )

  const removeFuelRow = useCallback(
    (row: AdvanceReportFuelRow) => {
      if (!order || isBusy) {
        return
      }

      const nextOrder = removeFuelItem(order, row.id)
      setViewState((current) => ({
        ...current,
        hasLocalChanges: true,
        order: nextOrder,
      }))
      void recalculate(nextOrder)
    },
    [isBusy, order, recalculate, setViewState],
  )

  const addConsumableOrder = useCallback(
    (consumablesOrder: AdvanceReportConsumablesOrder, documentFiles: File[]) => {
      if (!order || isBusy) {
        return
      }

      const entryNetUid = createLocalId()
      const nextOrder: AdvanceReportOrder = {
        ...order,
        OutcomePaymentOrderConsumablesOrders: [
          ...(order.OutcomePaymentOrderConsumablesOrders || []),
          {
            ConsumablesOrder: {
              ...consumablesOrder,
              Id: consumablesOrder.Id || 0,
              NetUid: consumablesOrder.NetUid || entryNetUid,
            },
            Id: 0,
            NetUid: entryNetUid,
          },
        ],
      }

      setViewState((current) => ({
        ...current,
        consumableDocumentFilesByOrderKey:
          documentFiles.length > 0
            ? { ...current.consumableDocumentFilesByOrderKey, [entryNetUid]: documentFiles }
            : current.consumableDocumentFilesByOrderKey,
        hasLocalChanges: true,
        order: nextOrder,
      }))
      void recalculate(nextOrder)
    },
    [isBusy, order, recalculate, setViewState],
  )

  const addFueling = useCallback(
    (fueling: CompanyCarFueling) => {
      if (!order || isBusy) {
        return
      }

      const nextOrder: AdvanceReportOrder = {
        ...order,
        CompanyCarFuelings: [
          ...(order.CompanyCarFuelings || []),
          {
            ...fueling,
            Id: fueling.Id || 0,
            NetUid: fueling.NetUid || createLocalId(),
          },
        ],
      }

      setViewState((current) => ({
        ...current,
        hasLocalChanges: true,
        order: nextOrder,
      }))
      void recalculate(nextOrder)
    },
    [isBusy, order, recalculate, setViewState],
  )

  const save = useCallback(
    async (auto: boolean) => {
      if (!order || isBusy) {
        return
      }

      if (!hasAnyRows(order)) {
        notifications.show({ color: 'red', message: t('Добавьте хоча б 1 товар') })
        return
      }

      const consumableDocumentFiles = getConsumableDocumentFiles(consumableDocumentFilesByOrderKey)
      setSaving(true)
      setViewState((current) => ({ ...current, error: null }))

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
        await updateAdvanceReportOrder(auto, payload, consumableDocumentFiles)
        setViewState((current) => ({
          ...current,
          consumableDocumentFilesByOrderKey: {},
          hasLocalChanges: false,
        }))
        notifications.show({ color: 'green', message: t('Оновлення видаткового ордера') })
        navigate(OUTGOING_CASHFLOW_ROUTE)
      } catch (saveError) {
        setViewState((current) => ({
          ...current,
          error: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти авансовий звіт'),
        }))
      } finally {
        setSaving(false)
      }
    },
    [
      consumableDocumentFilesByOrderKey,
      isBusy,
      navigate,
      order,
      setSaving,
      setViewState,
      t,
    ],
  )

  const settleDifference = useCallback(async () => {
    if (!order || isBusy) {
      return
    }

    const consumableDocumentFiles = getConsumableDocumentFiles(consumableDocumentFilesByOrderKey)
    setSaving(true)
    setViewState((current) => ({ ...current, error: null }))

    try {
      await updateAdvanceReportOrder(true, order, consumableDocumentFiles)
      setViewState((current) => ({
        ...current,
        consumableDocumentFilesByOrderKey: {},
        hasLocalChanges: false,
      }))
      notifications.show({ color: 'green', message: t('Оновлення видаткового ордера') })
      navigate(OUTGOING_CASHFLOW_ROUTE)
    } catch (saveError) {
      setViewState((current) => ({
        ...current,
        error: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти авансовий звіт'),
      }))
    } finally {
      setSaving(false)
    }
  }, [
    consumableDocumentFilesByOrderKey,
    isBusy,
    navigate,
    order,
    setSaving,
    setViewState,
    t,
  ])

  return {
    addConsumableOrder,
    addFueling,
    canAppendRows,
    canSave,
    confirmLeave,
    confirmLeaveOpen,
    consumableRows,
    createIncomeAutomatically,
    currencyCode,
    error,
    fuelRows,
    headerTitle,
    isConsumableModalOpen,
    isDone,
    isFuelModalOpen,
    isLoading,
    isBusy,
    isRecalculating,
    isSaving,
    order,
    orderAmount,
    reportTitle,
    reportTotal,
    totals,
    goBack,
    openConsumableModal: () => {
      if (!isBusy) {
        setConsumableModalOpen(true)
      }
    },
    openFuelModal: () => {
      if (!isBusy) {
        setFuelModalOpen(true)
      }
    },
    removeConsumableRow,
    removeFuelRow,
    save,
    settleDifference,
    setConsumableModalOpen,
    setConfirmLeaveOpen,
    setCreateIncomeAutomatically,
    setFuelModalOpen,
  }
}

export function AdvanceReportViewPage() {
  const model = useAdvanceReportViewModel()
  const { t } = useI18n()

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Button color="gray" disabled={model.isBusy} leftSection={<IconArrowLeft size={16} />} variant="light" onClick={model.goBack}>
          {t('Назад')}
        </Button>
        <Group gap="xs" justify="flex-end">
          {!model.isDone && (
            <>
              <Button disabled={model.isBusy} leftSection={<IconReceipt2 size={16} />} variant="light" onClick={model.openConsumableModal}>
                {t('Додати товар / послугу')}
              </Button>
              <Button disabled={model.isBusy} leftSection={<IconGasStation size={16} />} variant="light" onClick={model.openFuelModal}>
                {t('Додати пальне')}
              </Button>
            </>
          )}
          {model.canSave && (
            <Button
              color={CREATE_ACTION_COLOR}
              leftSection={<IconDeviceFloppy size={16} />}
              loading={model.isSaving || model.isRecalculating}
              onClick={() => model.save(model.createIncomeAutomatically)}
            >
              {t('Зберегти')}
            </Button>
          )}
        </Group>
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

      {model.order && (
        <>
          <AdvanceReportConsumableOrderModal
            opened={model.isConsumableModalOpen}
            outcomeOrder={model.order}
            onAdd={model.addConsumableOrder}
            onClose={() => {
              if (!model.isBusy) {
                model.setConsumableModalOpen(false)
              }
            }}
          />
          <AdvanceReportFuelModal
            opened={model.isFuelModalOpen}
            outcomeOrder={model.order}
            onAdd={model.addFueling}
            onClose={() => {
              if (!model.isBusy) {
                model.setFuelModalOpen(false)
              }
            }}
          />
        </>
      )}

      <AppModal
        centered
        opened={model.confirmLeaveOpen}
        title={t('Є незбережені зміни')}
        onClose={() => {
          if (!model.isBusy) {
            model.setConfirmLeaveOpen(false)
          }
        }}
      >
        <Stack gap="md">
          <Text>{t('Якщо вийти зі сторінки, додані рядки, видалення і прикріплені файли не будуть збережені.')}</Text>
          <Group justify="flex-end">
            <Button color="gray" disabled={model.isBusy} variant="light" onClick={() => model.setConfirmLeaveOpen(false)}>
              {t('Залишитися')}
            </Button>
            <Button color="red" disabled={model.isBusy} onClick={model.confirmLeave}>
              {t('Вийти без збереження')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

function AdvanceReportContent({ model }: { model: ReturnType<typeof useAdvanceReportViewModel> }) {
  const { t } = useI18n()
  const { order } = model

  if (!order) {
    return null
  }

  const hasConsumables = model.consumableRows.length > 0
  const hasFuel = model.fuelRows.length > 0

  return (
    <Stack gap="md">
      <Card className="app-section-card" withBorder padding="md" radius="md">
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
        <Card className="app-section-card" withBorder padding="md" radius="md">
          <Stack gap="sm">
            <Text fw={700}>
              {t('Товари')} / {t('Послуги')}
            </Text>
            <AdvanceReportProductsGrid
              canRemove={!model.isBusy}
              rows={model.consumableRows}
              onRemove={model.removeConsumableRow}
            />
          </Stack>
        </Card>
      )}

      {hasFuel && (
        <Card className="app-section-card" withBorder padding="md" radius="md">
          <Stack gap="sm">
            <Text fw={700}>{t('Пальне')}</Text>
            <AdvanceReportFuelGrid canRemove={!model.isBusy} rows={model.fuelRows} onRemove={model.removeFuelRow} />
          </Stack>
        </Card>
      )}

      {hasAnyRows(order) && (
        <Card className="app-section-card" withBorder padding="md" radius="md">
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
        disabled={model.isBusy}
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
        <Button
          color="green"
          disabled={model.isBusy}
          loading={model.isSaving || model.isRecalculating}
          size="xs"
          variant="light"
          onClick={model.settleDifference}
        >
          {t('Оплатив')}
        </Button>
        {model.canAppendRows && (
          <>
            <Button disabled={model.isBusy} leftSection={<IconReceipt2 size={14} />} size="xs" variant="light" onClick={model.openConsumableModal}>
              {t('Прикріпити накладну')}
            </Button>
            <Button disabled={model.isBusy} leftSection={<IconGasStation size={14} />} size="xs" variant="light" onClick={model.openFuelModal}>
              {t('Додати пальне')}
            </Button>
          </>
        )}
      </Group>
    )
  }

  return (
    <Group align="center" gap="sm" wrap="wrap">
      <Badge color="green" variant="light">
        {t('Винні колезі')}: {formatMoney(difference)}
      </Badge>
      <Button
        color={CREATE_ACTION_COLOR}
        disabled={model.isBusy}
        loading={model.isSaving || model.isRecalculating}
        size="xs"
        variant="light"
        onClick={model.settleDifference}
      >
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

function buildConsumableRows(order: AdvanceReportOrder | null, isDone: boolean): AdvanceReportConsumableRow[] {
  if (!order?.OutcomePaymentOrderConsumablesOrders) {
    return []
  }

  const rows: AdvanceReportConsumableRow[] = []

  order.OutcomePaymentOrderConsumablesOrders.forEach((entry, entryIndex) => {
    const consumablesOrder = entry.ConsumablesOrder
    const items = consumablesOrder?.ConsumablesOrderItems || []

    items.forEach((item, itemIndex) => {
      if (item.Deleted) {
        return
      }

      rows.push({
        agreementName: consumablesOrder?.SupplyOrganizationAgreement?.Name || '',
        amount: item.TotalPrice,
        canRemove: canRemoveAdvanceReportConsumableRow(isDone, entry, consumablesOrder, item),
        category: item.ConsumableProductCategory?.Name || '',
        documentUrls: getConsumablesOrderDocumentUrls(consumablesOrder?.ConsumablesOrderDocuments),
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

function getConsumablesOrderDocumentUrls(
  documents?: AdvanceReportConsumablesOrder['ConsumablesOrderDocuments'],
): string[] {
  return (documents || []).reduce<string[]>((urls, document) => {
    if (document.Deleted) {
      return urls
    }

    const url =
      document.DocumentURL ||
      document.DocumentUrl ||
      document.PdfDocumentURL ||
      document.PdfDocumentUrl ||
      document.URL ||
      document.Url ||
      document.url

    if (url) {
      urls.push(upgradeHttpToHttps(url))
    }

    return urls
  }, [])
}

function buildFuelRows(order: AdvanceReportOrder | null, isDone: boolean): AdvanceReportFuelRow[] {
  if (!order?.CompanyCarFuelings) {
    return []
  }

  return order.CompanyCarFuelings.reduce<AdvanceReportFuelRow[]>((rows, fueling, index) => {
    if (!fueling.Deleted) {
      rows.push({
        canRemove: canRemoveAdvanceReportFuelRow(isDone, fueling),
        companyCar: fueling.CompanyCar?.LicensePlate || '',
        fuelAmount: fueling.FuelAmount,
        id: String(fueling.NetUid || fueling.Id || `fuel-${index}`),
        paymentCostMovement: fueling.PaymentCostMovementOperation?.PaymentCostMovement?.OperationName || '',
        pricePerLiter: fueling.PricePerLiter,
        serviceOrganization: fueling.ConsumableProductOrganization?.Name || '',
        totalAmountWithoutVat: fueling.TotalPrice,
        totalPrice: fueling.TotalPriceWithVat,
        vatAmount: fueling.VatAmount,
        vatPercent: fueling.VatPercent,
      })
    }

    return rows
  }, [])
}

function calculateTotals(order: AdvanceReportOrder | null): { total: number; totalVat: number } {
  if (!order) {
    return { total: 0, totalVat: 0 }
  }

  let total = 0
  let totalVat = 0

  for (const fueling of order.CompanyCarFuelings || []) {
    if (!fueling.Deleted) {
      total += fueling.TotalPriceWithVat || 0
      totalVat += fueling.VatAmount || 0
    }
  }

  for (const entry of order.OutcomePaymentOrderConsumablesOrders || []) {
    for (const item of entry.ConsumablesOrder?.ConsumablesOrderItems || []) {
      if (!item.Deleted) {
        total += item.TotalPriceWithVAT || 0
        totalVat += item.VAT || 0
      }
    }
  }

  return { total, totalVat }
}

function removeConsumableItem(order: AdvanceReportOrder, rowId: string): AdvanceReportOrder {
  const entries = (order.OutcomePaymentOrderConsumablesOrders || []).reduce<
    NonNullable<AdvanceReportOrder['OutcomePaymentOrderConsumablesOrders']>
  >((nextEntries, entry, entryIndex) => {
    const consumablesOrder = entry.ConsumablesOrder

    if (!consumablesOrder) {
      nextEntries.push(entry)
      return nextEntries
    }

    let removedFromEntry = false
    const items = (consumablesOrder.ConsumablesOrderItems || []).reduce<
      NonNullable<typeof consumablesOrder.ConsumablesOrderItems>
    >((nextItems, item, itemIndex) => {
      const itemId = String(item.NetUid || item.Id || `${entryIndex}-${itemIndex}`)

      if (itemId !== rowId) {
        nextItems.push(item)
        return nextItems
      }

      removedFromEntry = true

      if (!isLocalAdvanceReportEntity(item)) {
        nextItems.push({ ...item, Deleted: true })
      }

      return nextItems
    }, [])

    if (items.length > 0 || !removedFromEntry) {
      nextEntries.push({
        ...entry,
        ConsumablesOrder: { ...consumablesOrder, ConsumablesOrderItems: items },
      })
    }

    return nextEntries
  }, [])

  return { ...order, OutcomePaymentOrderConsumablesOrders: entries }
}

function removeFuelItem(order: AdvanceReportOrder, rowId: string): AdvanceReportOrder {
  const fuelings = (order.CompanyCarFuelings || []).reduce<NonNullable<AdvanceReportOrder['CompanyCarFuelings']>>(
    (nextFuelings, fueling, index) => {
      const fuelingId = String(fueling.NetUid || fueling.Id || `fuel-${index}`)

      if (fuelingId !== rowId) {
        nextFuelings.push(fueling)
        return nextFuelings
      }

      if (!isLocalAdvanceReportEntity(fueling)) {
        nextFuelings.push({ ...fueling, Deleted: true })
      }

      return nextFuelings
    },
    [],
  )

  return { ...order, CompanyCarFuelings: fuelings }
}

function hasFilesByOrderKey(filesByOrderKey: Record<string, File[]>): boolean {
  return Object.values(filesByOrderKey).some((files) => files.length > 0)
}

function getConsumableDocumentFiles(filesByOrderKey: Record<string, File[]>): File[] {
  return Object.values(filesByOrderKey).flat()
}

function pruneConsumableDocumentFiles(
  filesByOrderKey: Record<string, File[]>,
  order: AdvanceReportOrder,
): Record<string, File[]> {
  const activeOrderKeys = new Set(
    (order.OutcomePaymentOrderConsumablesOrders || []).flatMap((entry) => getConsumableEntryKeys(entry)),
  )

  return Object.entries(filesByOrderKey).reduce<Record<string, File[]>>((nextFiles, [orderKey, files]) => {
    if (activeOrderKeys.has(orderKey)) {
      nextFiles[orderKey] = files
    }

    return nextFiles
  }, {})
}

function getConsumableEntryKeys(
  entry: NonNullable<AdvanceReportOrder['OutcomePaymentOrderConsumablesOrders']>[number],
): string[] {
  return [entry.NetUid, entry.ConsumablesOrder?.NetUid].filter((netUid): netUid is string => Boolean(netUid))
}

function hasAnyRows(order: AdvanceReportOrder): boolean {
  return (
    (order.OutcomePaymentOrderConsumablesOrders || []).some(
      (entry) => (entry.ConsumablesOrder?.ConsumablesOrderItems || []).some((item) => !item.Deleted),
    ) || (order.CompanyCarFuelings || []).some((fueling) => !fueling.Deleted)
  )
}

function hasNewRows(order: AdvanceReportOrder): boolean {
  return (
    (order.OutcomePaymentOrderConsumablesOrders || []).some(
      (entry) =>
        !entry.Id ||
        !entry.ConsumablesOrder?.Id ||
        (entry.ConsumablesOrder.ConsumablesOrderItems || []).some((item) => !item.Id),
    ) || (order.CompanyCarFuelings || []).some((fueling) => !fueling.Id)
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

function createLocalId(): string {
  return `local-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}
