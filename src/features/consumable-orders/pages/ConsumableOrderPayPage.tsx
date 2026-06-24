import {
  Alert,
  Autocomplete,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconDeviceFloppy, IconPlus } from '@tabler/icons-react'
import { type FormEvent, useEffect, useMemo } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  calculateConsumableOrder,
  createOutcomePaymentOrder,
  createPaymentMovement,
  getConsumableOrder,
  getConsumableOrderOrganizations,
  getPaymentMovements,
  searchPaymentMovements,
  searchPaymentRegisters,
} from '../api/consumableOrdersApi'
import {
  MONEY_EPSILON,
  buildPaymentPayload,
  calculateLocalTotal,
  getPaidAmount,
  getPaymentTotalAmount,
  getRemainingPaymentAmount,
  isPaymentCoveringOutstandingAmount,
} from '../paymentPayload'
import type {
  ConsumablesOrder,
  ConsumablesOrderItem,
  NamedEntity,
  Organization,
  PaymentCurrencyRegister,
  PaymentMovement,
  PaymentRegister,
} from '../types'

type LocationState = {
  returnPath?: string
}

type PayFormState = {
  amount: number
  comment: string
  date: string
  movementSearch: string
  organizationValue: string
  paymentRegisterValue: string
  selectedCurrencyRegisterValue: string
  selectedMovementValue: string
  time: string
}

type SelectOption = {
  label: string
  value: string
}

const ORDERS_PATH = '/accounting/consumable-orders'
const SEARCH_DEBOUNCE_MS = 300

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function ConsumableOrderPayPage() {
  const { t } = useI18n()
  const { id } = useParams<{ id?: string }>()
  const routeLocation = useLocation()
  const navigate = useNavigate()
  const locationState = routeLocation.state as LocationState | null
  const returnPath = locationState?.returnPath || ORDERS_PATH
  const [order, setOrder] = useValueState<ConsumablesOrder | null>(null)
  const [organizations, setOrganizations] = useValueState<Organization[]>([])
  const [paymentRegisters, setPaymentRegisters] = useValueState<PaymentRegister[]>([])
  const [paymentMovements, setPaymentMovements] = useValueState<PaymentMovement[]>([])
  const [form, setForm] = useValueState<PayFormState>(() => createInitialForm())
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const selectedOrganization = useMemo(
    () => organizations.find((organization) => getEntityValue(organization) === form.organizationValue) || null,
    [form.organizationValue, organizations],
  )
  const selectedRegister = useMemo(
    () => paymentRegisters.find((register) => getEntityValue(register) === form.paymentRegisterValue) || null,
    [form.paymentRegisterValue, paymentRegisters],
  )
  const selectedCurrencyRegister = useMemo(
    () =>
      (selectedRegister?.PaymentCurrencyRegisters || []).find(
        (currencyRegister) => getEntityValue(currencyRegister) === form.selectedCurrencyRegisterValue,
      ) || null,
    [form.selectedCurrencyRegisterValue, selectedRegister],
  )
  const selectedMovement = useMemo(
    () => paymentMovements.find((movement) => getEntityValue(movement) === form.selectedMovementValue) || null,
    [form.selectedMovementValue, paymentMovements],
  )
  const organizationOptions = useMemo(() => toEntityOptions(organizations), [organizations])
  const registerOptions = useMemo(() => toEntityOptions(paymentRegisters), [paymentRegisters])
  const currencyOptions = useMemo(() => toCurrencyOptions(selectedRegister?.PaymentCurrencyRegisters || []), [selectedRegister])
  const movementOptions = useMemo(() => toEntityOptions(paymentMovements, (movement) => movement?.OperationName || ''), [paymentMovements])
  const items = order?.ConsumablesOrderItems?.filter((item) => !item.Deleted) || []
  const paymentTotalAmount = order ? getPaymentTotalAmount(order) : 0
  const paidAmount = order ? getPaidAmount(order) : 0
  const remainingAmount = order ? getRemainingPaymentAmount(order) : 0
  const isOrderPaid = Boolean(order?.IsPayed) || Boolean(order && isPaymentCoveringOutstandingAmount(order, 0))

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        const [nextOrder, nextOrganizations, nextRegisters, nextMovements] = await Promise.all([
          getConsumableOrder(id as string),
          getConsumableOrderOrganizations(),
          searchPaymentRegisters(''),
          getPaymentMovements(),
        ])

        if (cancelled) {
          return
        }

        if (!nextOrder) {
          setOrder(null)
          setError(t('Прибуткову накладну не знайдено'))
          return
        }

        const calculation = await calculateConsumableOrder(nextOrder).catch((calcError) => {
          if (!cancelled) {
            setError(calcError instanceof Error ? calcError.message : t('Не вдалося розрахувати оплату накладної'))
          }

          return null
        })
        const calculatedOrder = calculation?.Collection[0] || nextOrder
        const defaultOrganization = calculatedOrder.SupplyOrganizationAgreement?.Organization || nextOrganizations[0] || null
        const defaultRegister = nextRegisters[0] || null
        const defaultCurrencyRegister = defaultRegister?.PaymentCurrencyRegisters?.[0] || null
        const totalAmount = calculation?.Total || calculatedOrder.TotalAmount || calculateLocalTotal(calculatedOrder.ConsumablesOrderItems || [])
        const paidAmount = nextOrder.TotalPaidAmount || 0
        const remainingAmount = totalAmount - paidAmount
        const defaultAmount = remainingAmount > 0 ? remainingAmount : 0
        const normalizedOrder: ConsumablesOrder = {
          ...calculatedOrder,
          TotalAmount: totalAmount,
          TotalPaidAmount: paidAmount,
        }

        setOrder(normalizedOrder)
        setOrganizations(includeEntity(nextOrganizations, defaultOrganization))
        setPaymentRegisters(nextRegisters)
        setPaymentMovements(nextMovements)
        setForm((current) => ({
          ...current,
          amount: defaultAmount,
          organizationValue: defaultOrganization ? getEntityValue(defaultOrganization) : '',
          paymentRegisterValue: defaultRegister ? getEntityValue(defaultRegister) : '',
          selectedCurrencyRegisterValue: defaultCurrencyRegister ? getEntityValue(defaultCurrencyRegister) : '',
        }))
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити оплату накладної'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      cancelled = true
    }
  }, [id, setError, setForm, setLoading, setOrder, setOrganizations, setPaymentMovements, setPaymentRegisters, t])

  useEffect(() => {
    const value = form.movementSearch.trim()
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchPaymentMovements(value).then(setPaymentMovements).catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [form.movementSearch, setPaymentMovements])

  if (!id) {
    return <Navigate replace to={ORDERS_PATH} />
  }

  function updateForm(patch: Partial<PayFormState>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function handleRegisterChanged(value: string | null) {
    const register = paymentRegisters.find((item) => getEntityValue(item) === value) || null
    const currencyRegister = register?.PaymentCurrencyRegisters?.[0] || null

    updateForm({
      paymentRegisterValue: value || '',
      selectedCurrencyRegisterValue: currencyRegister ? getEntityValue(currencyRegister) : '',
    })
  }

  function handleMovementSubmit(value: string) {
    const movement = paymentMovements.find((item) => getEntityValue(item) === value)

    if (!movement) {
      return
    }

    updateForm({
      movementSearch: movement.OperationName || '',
      selectedMovementValue: getEntityValue(movement),
    })
  }

  async function handleCreateMovement() {
    const operationName = form.movementSearch.trim()

    if (!operationName) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const createdMovement = await createPaymentMovement(operationName)

      if (createdMovement) {
        setPaymentMovements((current) => includeEntity(current, createdMovement))
        updateForm({
          movementSearch: createdMovement.OperationName || operationName,
          selectedMovementValue: getEntityValue(createdMovement),
        })
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('Не вдалося створити статтю руху коштів'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!order) {
      setError(t('Прибуткову накладну не знайдено'))
      return
    }

    if (order.IsPayed) {
      setError(t('Накладна вже оплачена'))
      return
    }

    const validationError = validatePaymentForm({
      amount: form.amount,
      order,
      selectedCurrencyRegister,
      selectedMovement,
      selectedOrganization,
      selectedRegister,
      t,
    })

    if (validationError) {
      setError(validationError)
      return
    }

    const payload = buildPaymentPayload({
      amount: form.amount,
      comment: form.comment,
      date: form.date,
      order,
      selectedCurrencyRegister: selectedCurrencyRegister as PaymentCurrencyRegister,
      selectedMovement: selectedMovement as PaymentMovement,
      selectedOrganization: selectedOrganization as Organization,
      selectedRegister: selectedRegister as PaymentRegister,
      time: form.time,
    })

    setSaving(true)
    setError(null)

    try {
      await createOutcomePaymentOrder(payload)
      notifications.show({
        color: 'green',
        message: t('Оплату накладної створено'),
      })
      navigate(returnPath, { replace: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити оплату накладної'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppDrawer
      opened
      position="right"
      size="wide"
      title={t('Оплата прибуткової накладної')}
      onClose={() => navigate(returnPath, { replace: true })}
      footer={
        <Button
          color={CREATE_ACTION_COLOR}
          disabled={isLoading || isSaving || isOrderPaid}
          form="consumable-order-pay-form"
          leftSection={<IconDeviceFloppy size={16} />}
          loading={isSaving}
          type="submit"
        >
          {t('Створити оплату')}
        </Button>
      }
    >
      <form id="consumable-order-pay-form" onSubmit={handleSubmit}>
        <Stack gap="md">
          <div>
            <Group gap="xs">
              {order?.IsPayed && (
                <Badge color="green" variant="light">
                  {t('Вже оплачено')}
                </Badge>
              )}
            </Group>
            <Text c="dimmed" size="sm">
              {order?.Number ? `${t('Номер')}: ${order.Number}` : t('Накладна без внутрішнього номера')}
            </Text>
          </div>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          {isOrderPaid && (
            <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
              {t('Накладна вже оплачена. Повторна оплата недоступна.')}
            </Alert>
          )}

          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <TextInput
              disabled={isLoading || isSaving || isOrderPaid}
              label={t('Дата')}
              type="date"
              value={form.date}
              onChange={(event) => updateForm({ date: event.currentTarget.value })}
            />
            <TextInput
              disabled={isLoading || isSaving || isOrderPaid}
              label={t('Час')}
              type="time"
              value={form.time}
              onChange={(event) => updateForm({ time: event.currentTarget.value })}
            />
            <NumberInput
              allowNegative={false}
              decimalScale={2}
              disabled={isLoading || isSaving || isOrderPaid}
              label={t('Сума')}
              min={0}
              value={form.amount}
              onChange={(value) => updateForm({ amount: toNumber(value) })}
            />
            <Select
              data={organizationOptions}
              disabled={isLoading || isSaving || isOrderPaid}
              label={t('Організація')}
              searchable
              value={form.organizationValue || null}
              onChange={(value) => updateForm({ organizationValue: value || '' })}
            />
            <Select
              data={registerOptions}
              disabled={isLoading || isSaving || isOrderPaid}
              label={t('Каса / рахунок')}
              searchable
              value={form.paymentRegisterValue || null}
              onChange={handleRegisterChanged}
            />
            <Select
              data={currencyOptions}
              disabled={!selectedRegister || isLoading || isSaving || isOrderPaid}
              label={t('Валюта')}
              searchable
              value={form.selectedCurrencyRegisterValue || null}
              onChange={(value) => updateForm({ selectedCurrencyRegisterValue: value || '' })}
            />
            <Autocomplete
              data={movementOptions}
              disabled={isLoading || isSaving || isOrderPaid}
              label={t('Стаття руху коштів')}
              value={form.movementSearch}
              onChange={(value) => updateForm({ movementSearch: value, selectedMovementValue: '' })}
              onOptionSubmit={handleMovementSubmit}
            />
            <Button
              disabled={Boolean(selectedMovement) || !form.movementSearch.trim() || isLoading || isSaving || isOrderPaid}
              leftSection={<IconPlus size={16} />}
              mt={24}
              type="button"
              variant="default"
              onClick={() => void handleCreateMovement()}
            >
              {t('Створити статтю')}
            </Button>
            <TextInput
              disabled={isLoading || isSaving || isOrderPaid}
              label={t('Коментар')}
              value={form.comment}
              onChange={(event) => updateForm({ comment: event.currentTarget.value })}
            />
          </SimpleGrid>

          <Card withBorder radius="md" shadow="sm">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={700}>{t('Позиції накладної')}</Text>
                <Group gap="xs" wrap="wrap">
                  <Badge color="blue" variant="light">
                    {t('Разом')}: {formatMoney(paymentTotalAmount)}
                  </Badge>
                  {paidAmount > 0 ? (
                    <Badge color="teal" variant="light">
                      {t('Оплачено')}: {formatMoney(paidAmount)}
                    </Badge>
                  ) : null}
                  {remainingAmount > 0 ? (
                    <Badge color="yellow" variant="light">
                      {t('Залишок')}: {formatMoney(remainingAmount)}
                    </Badge>
                  ) : null}
                </Group>
              </Group>

              <Table.ScrollContainer minWidth={820}>
                <Table highlightOnHover verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('Артикул')}</Table.Th>
                      <Table.Th>{t('Назва')}</Table.Th>
                      <Table.Th>{t('Кількість')}</Table.Th>
                      <Table.Th>{t('Ціна')}</Table.Th>
                      <Table.Th>{t('Разом')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {items.length > 0 ? (
                      items.map((item, index) => (
                        <Table.Tr key={getItemKey(item, index)}>
                          <Table.Td>{displayValue(item.ConsumableProduct?.VendorCode)}</Table.Td>
                          <Table.Td>{displayValue(item.ConsumableProduct?.Name || item.ConsumableProductCategory?.Name)}</Table.Td>
                          <Table.Td>{formatAmount(item.Qty)} {item.ConsumableProduct?.MeasureUnit?.Name || ''}</Table.Td>
                          <Table.Td>{formatMoney(item.PricePerItem)}</Table.Td>
                          <Table.Td>{formatMoney(item.TotalPriceWithVAT)}</Table.Td>
                        </Table.Tr>
                      ))
                    ) : (
                      <Table.Tr>
                        <Table.Td colSpan={5}>
                          <Text c="dimmed" ta="center">
                            {t('Позицій немає')}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Stack>
          </Card>
        </Stack>
      </form>
    </AppDrawer>
  )
}

function createInitialForm(): PayFormState {
  const now = new Date()

  return {
    amount: 0,
    comment: '',
    date: formatLocalDate(now),
    movementSearch: '',
    organizationValue: '',
    paymentRegisterValue: '',
    selectedCurrencyRegisterValue: '',
    selectedMovementValue: '',
    time: toTimeValue(now),
  }
}

function validatePaymentForm({
  amount,
  order,
  selectedCurrencyRegister,
  selectedMovement,
  selectedOrganization,
  selectedRegister,
  t,
}: {
  amount: number
  order: ConsumablesOrder
  selectedCurrencyRegister: PaymentCurrencyRegister | null
  selectedMovement: PaymentMovement | null
  selectedOrganization: Organization | null
  selectedRegister: PaymentRegister | null
  t: (value: string) => string
}): string | null {
  if (!order.ConsumablesOrderItems?.length) {
    return t('У накладній немає позицій для оплати')
  }

  if (!selectedOrganization) {
    return t('Оберіть організацію')
  }

  if (!selectedRegister) {
    return t('Оберіть касу або рахунок')
  }

  if (!selectedCurrencyRegister) {
    return t('Оберіть валюту')
  }

  if (!selectedMovement) {
    return t('Оберіть статтю руху коштів')
  }

  if (!amount || amount <= 0) {
    return t('Сума має бути більшою за нуль')
  }

  const remainingAmount = getRemainingPaymentAmount(order)

  if (remainingAmount <= MONEY_EPSILON) {
    return t('Накладна вже оплачена')
  }

  if (amount - remainingAmount > MONEY_EPSILON) {
    return t('Сума перевищує залишок до оплати')
  }

  return null
}

function toEntityOptions<T extends NamedEntity>(entities: T[], labelGetter = getEntityLabel): SelectOption[] {
  const options: SelectOption[] = []

  for (const entity of entities) {
    const value = getEntityValue(entity)
    const label = labelGetter(entity) || value

    if (value) {
      options.push({ label, value })
    }
  }

  return options
}

function toCurrencyOptions(currencyRegisters: PaymentCurrencyRegister[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const currencyRegister of currencyRegisters) {
    const currency = currencyRegister.Currency
    const value = getEntityValue(currencyRegister)
    const balance = typeof currencyRegister.Amount === 'number' ? ` (${formatMoney(currencyRegister.Amount)})` : ''
    const label = `${currency?.Code || currency?.Name || value}${balance}`

    if (value) {
      options.push({ label, value })
    }
  }

  return options
}

function includeEntity<T extends NamedEntity>(entities: T[], entity: T | null): T[] {
  if (!entity) {
    return entities
  }

  const entityValue = getEntityValue(entity)

  if (!entityValue || entities.some((item) => getEntityValue(item) === entityValue)) {
    return entities
  }

  return [entity, ...entities]
}

function getEntityValue(entity?: NamedEntity | null): string {
  return String(entity?.NetUid || entity?.Id || '')
}

function getEntityLabel(entity?: NamedEntity | null): string {
  return entity?.FullName || entity?.LastName || entity?.Name || entity?.OperationName || entity?.Code || entity?.Number || ''
}

function getItemKey(item: ConsumablesOrderItem, index: number): string {
  return String(item.NetUid || item.Id || `${item.ConsumableProduct?.NetUid || item.ConsumableProduct?.Id || 'item'}-${index}`)
}

function toTimeValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${hours}:${minutes}`
}

function toNumber(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value.replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : 0
}

function formatAmount(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? amountFormatter.format(value) : '—'
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '—'
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}
