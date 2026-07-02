import {
  Alert,
  Autocomplete,
  Badge,
  Button,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconBuildingBank,
  IconCalendar,
  IconClock,
  IconCoins,
  IconDeviceFloppy,
  IconHash,
  IconNotes,
  IconPackage,
  IconPlus,
  IconReceipt,
  IconWallet,
} from '@tabler/icons-react'
import { type FormEvent, type ReactNode, useEffect, useMemo } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
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
  getPaymentSupplyOrganization,
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
import './consumable-order-pay-page.css'

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

const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
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
  const [movementModalOpened, setMovementModalOpened] = useValueState(false)
  const [movementDraft, setMovementDraft] = useValueState('')
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
    () =>
      paymentMovements.find((movement) => getEntityValue(movement) === form.selectedMovementValue) ||
      findPaymentMovementByName(paymentMovements, form.movementSearch) ||
      null,
    [form.movementSearch, form.selectedMovementValue, paymentMovements],
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
  const currencyLabel =
    selectedCurrencyRegister?.Currency?.Code ||
    selectedCurrencyRegister?.Currency?.Name ||
    order?.SupplyOrganizationAgreement?.Currency?.Code ||
    order?.SupplyOrganizationAgreement?.Currency?.Name ||
    ''
  const supplierLabel = displayValue(
    getEntityLabel(order?.SupplyOrganizationAgreement?.SupplyOrganization) ||
      getEntityLabel(order?.ConsumableProductOrganization) ||
      getEntityLabel(order?.SupplyOrganizationAgreement?.Organization),
  )
  const agreementLabel = displayValue(order?.SupplyOrganizationAgreement?.Name || order?.SupplyOrganizationAgreement?.Number)
  const orderNumberLabel = order?.Number ? `№ ${order.Number}` : t('Накладна без внутрішнього номера')
  const sourceNumberLabel = order?.OrganizationNumber ? `№ ${order.OrganizationNumber}` : t('Без номера постачальника')

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
        void getPaymentMovements().then(setPaymentMovements).catch(() => undefined)
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
    const movement = paymentMovements.find((item) => getEntityValue(item) === value) || findPaymentMovementByName(paymentMovements, value)

    if (!movement) {
      return
    }

    updateForm({
      movementSearch: movement.OperationName || '',
      selectedMovementValue: getEntityValue(movement),
    })
  }

  function openMovementModal() {
    setMovementDraft(selectedMovement ? '' : form.movementSearch.trim())
    setMovementModalOpened(true)
  }

  async function handleCreateMovement(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    const operationName = movementDraft.trim()

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
        setMovementDraft('')
        setMovementModalOpened(false)
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
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Оплата прибуткової накладної')}</span>}
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
      <form className="consumable-order-pay" id="consumable-order-pay-form" onSubmit={handleSubmit}>
        <Stack gap="md">
          <section className="consumable-order-pay-hero">
            <div className="consumable-order-pay-hero__main">
              <div className="consumable-order-pay-title">
                <div className="consumable-order-pay-title__copy">
                  <strong>{orderNumberLabel}</strong>
                  <span>{sourceNumberLabel}</span>
                </div>
              </div>
              <div className="consumable-order-pay-meta">
                <span>{supplierLabel}</span>
                <span>{agreementLabel}</span>
                <span>{formatDisplayDate(order?.OrganizationFromDate)}</span>
              </div>
            </div>

            <div className="consumable-order-pay-metrics">
              <PaymentMetric label={t('Разом')} meta={currencyLabel} tone="neutral" value={formatMoney(paymentTotalAmount)} />
              <PaymentMetric label={t('Оплачено')} meta={currencyLabel} tone="green" value={formatMoney(paidAmount)} />
              <PaymentMetric
                label={t('До оплати')}
                meta={currencyLabel}
                tone={remainingAmount > MONEY_EPSILON ? 'orange' : 'green'}
                value={formatMoney(remainingAmount)}
              />
            </div>
          </section>

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

          <section className="consumable-order-pay-section">
            <PaySectionHeader
              action={
                <Button
                  className="consumable-order-pay-add-movement"
                  disabled={isLoading || isSaving || isOrderPaid}
                  leftSection={<IconPlus size={14} />}
                  size="xs"
                  type="button"
                  variant="light"
                  onClick={openMovementModal}
                >
                  {t('Додати статтю')}
                </Button>
              }
              title={t('Оплата')}
            />
            <div className="consumable-order-pay-form-grid">
            <TextInput
              className="consumable-order-pay-control is-compact is-date"
              disabled={isLoading || isSaving || isOrderPaid}
              label={t('Дата')}
              leftSection={<IconCalendar size={15} />}
              type="date"
              value={form.date}
              onChange={(event) => updateForm({ date: event.currentTarget.value })}
            />
            <TextInput
              className="consumable-order-pay-control is-compact is-time"
              disabled={isLoading || isSaving || isOrderPaid}
              label={t('Час')}
              leftSection={<IconClock size={15} />}
              type="time"
              value={form.time}
              onChange={(event) => updateForm({ time: event.currentTarget.value })}
            />
            <NumberInput
              allowNegative={false}
              className="consumable-order-pay-control is-amount"
              decimalScale={2}
              disabled={isLoading || isSaving || isOrderPaid}
              label={t('Сума')}
              leftSection={<IconCoins size={15} />}
              min={0}
              value={form.amount}
              onChange={(value) => updateForm({ amount: toNumber(value) })}
            />
            <Select
              className="consumable-order-pay-control is-organization"
              data={organizationOptions}
              disabled={isLoading || isSaving || isOrderPaid}
              label={t('Організація')}
              leftSection={<IconReceipt size={15} />}
              searchable
              value={form.organizationValue || null}
              onChange={(value) => updateForm({ organizationValue: value || '' })}
            />
            <Select
              className="consumable-order-pay-control is-register"
              data={registerOptions}
              disabled={isLoading || isSaving || isOrderPaid}
              label={t('Каса / рахунок')}
              leftSection={<IconBuildingBank size={15} />}
              searchable
              value={form.paymentRegisterValue || null}
              onChange={handleRegisterChanged}
            />
            <Select
              className="consumable-order-pay-control is-compact is-currency"
              data={currencyOptions}
              disabled={!selectedRegister || isLoading || isSaving || isOrderPaid}
              label={t('Валюта')}
              leftSection={<IconWallet size={15} />}
              searchable
              value={form.selectedCurrencyRegisterValue || null}
              onChange={(value) => updateForm({ selectedCurrencyRegisterValue: value || '' })}
            />
            <Autocomplete
              className="consumable-order-pay-control is-movement"
              data={movementOptions}
              disabled={isLoading || isSaving || isOrderPaid}
              label={t('Стаття руху коштів')}
              leftSection={<IconReceipt size={15} />}
              value={form.movementSearch}
              onChange={(value) => updateForm({ movementSearch: value, selectedMovementValue: '' })}
              onOptionSubmit={handleMovementSubmit}
            />
            <TextInput
              className="consumable-order-pay-control is-comment"
              disabled={isLoading || isSaving || isOrderPaid}
              label={t('Коментар')}
              leftSection={<IconNotes size={15} />}
              value={form.comment}
              onChange={(event) => updateForm({ comment: event.currentTarget.value })}
            />
            </div>
          </section>

          <section className="consumable-order-pay-section">
            <PaySectionHeader
              action={
                <Badge className="app-role-pill is-gray" variant="light">
                  {items.length}
                </Badge>
              }
              title={t('Позиції')}
            />
            <div className="consumable-order-pay-items">
              <div className="consumable-order-pay-items__head">
                <span>{t('Артикул')}</span>
                <span>{t('Назва')}</span>
                <span>{t('К-сть')}</span>
                <span>{t('Ціна')}</span>
                <span>{t('Разом')}</span>
              </div>
              <div className="consumable-order-pay-items__body">
                {items.length > 0 ? (
                  items.map((item, index) => <PaymentItemRow key={getItemKey(item, index)} item={item} />)
                ) : (
                  <div className="consumable-order-pay-empty">
                    <Text c="dimmed" size="sm" ta="center">
                      {t('Позицій немає')}
                    </Text>
                  </div>
                )}
              </div>
            </div>
          </section>
        </Stack>
      </form>
      <PaymentMovementModal
        isSaving={isSaving}
        opened={movementModalOpened}
        value={movementDraft}
        onChange={setMovementDraft}
        onClose={() => setMovementModalOpened(false)}
        onSubmit={handleCreateMovement}
      />
    </AppDrawer>
  )
}

function PaymentMovementModal({
  isSaving,
  opened,
  value,
  onChange,
  onClose,
  onSubmit,
}: {
  isSaving: boolean
  opened: boolean
  value: string
  onChange: (value: string) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} title={t('Нова стаття руху коштів')} onClose={onClose}>
      <form className="consumable-order-pay-movement-modal" onSubmit={onSubmit}>
        <Stack gap="md">
          <TextInput
            autoFocus
            className="consumable-order-pay-control"
            disabled={isSaving}
            label={t('Назва')}
            leftSection={<IconReceipt size={15} />}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
          <div className="consumable-order-pay-modal-actions">
            <Button color="gray" disabled={isSaving} type="button" variant="subtle" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button color={CREATE_ACTION_COLOR} disabled={!value.trim()} leftSection={<IconPlus size={15} />} loading={isSaving} type="submit">
              {t('Створити')}
            </Button>
          </div>
        </Stack>
      </form>
    </AppModal>
  )
}

function PaymentMetric({
  label,
  meta,
  tone,
  value,
}: {
  label: string
  meta?: string
  tone: 'green' | 'neutral' | 'orange'
  value: string
}) {
  return (
    <div className={`consumable-order-pay-metric is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {meta ? <small>{meta}</small> : null}
    </div>
  )
}

function PaySectionHeader({
  action,
  title,
}: {
  action?: ReactNode
  title: string
}) {
  return (
    <div className="consumable-order-pay-section-header">
      <Text className="app-section-title" fw={600} size="sm">
        {title}
      </Text>
      {action ? <div className="consumable-order-pay-section-header__action">{action}</div> : null}
    </div>
  )
}

function PaymentItemRow({ item }: { item: ConsumablesOrderItem }) {
  const productName = displayValue(item.ConsumableProduct?.Name || item.ConsumableProductCategory?.Name)
  const categoryName = displayValue(item.ConsumableProductCategory?.Name || item.ConsumableProduct?.ConsumableProductCategory?.Name)
  const unitName = item.ConsumableProduct?.MeasureUnit?.Name || ''

  return (
    <div className="consumable-order-pay-item-row">
      <div className="consumable-order-pay-item-code">
        <span aria-hidden>
          <IconHash size={13} />
        </span>
        <strong>{displayValue(item.ConsumableProduct?.VendorCode)}</strong>
      </div>
      <div className="consumable-order-pay-item-product">
        <span className="consumable-order-pay-item-product__icon" aria-hidden>
          <IconPackage size={15} />
        </span>
        <span className="consumable-order-pay-item-product__copy">
          <strong>{productName}</strong>
          <small>{categoryName}</small>
        </span>
      </div>
      <div className="consumable-order-pay-item-qty">
        <span aria-hidden>
          <IconHash size={13} />
        </span>
        <strong>{formatAmount(item.Qty)}</strong>
        {unitName ? <small>{unitName}</small> : null}
      </div>
      <div className="consumable-order-pay-item-money">
        <strong>{formatMoney(item.PricePerItem)}</strong>
      </div>
      <div className="consumable-order-pay-item-money is-total">
        <strong>{formatMoney(item.TotalPriceWithVAT)}</strong>
      </div>
    </div>
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

  if (!getPaymentSupplyOrganization(order)) {
    return t('У накладній не вказано постачальника')
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

function findPaymentMovementByName(movements: PaymentMovement[], value: string): PaymentMovement | null {
  const normalizedValue = normalizeSearchValue(value)

  if (!normalizedValue) {
    return null
  }

  return movements.find((movement) => normalizeSearchValue(movement.OperationName) === normalizedValue) || null
}

function normalizeSearchValue(value?: string | null): string {
  return (value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('uk')
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

function formatDisplayDate(value?: string | null): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}
