import {
  Alert,
  Autocomplete,
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Plus, Save } from 'lucide-react'
import { type FormEvent, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  createIncomeCashflow,
  createIncomeCashflowPaymentMovement,
  getCurrentEuroExchangeRate,
  getIncomeCashflowOrganizations,
  getIncomeCashflowPaymentMovements,
  searchIncomeCashflowCounterparties,
  searchIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentRegisters,
} from '../api/incomeCashflowsApi'
import type {
  Currency,
  IncomePaymentOrder,
  NamedEntity,
  Organization,
  PaymentMovement,
  PaymentRegister,
} from '../types'
import { IncomeCounterpartySearchType, IncomePaymentOperationType, PaymentRegisterType } from '../types'

type FormState = {
  amount: number
  comment: string
  counterpartySearch: string
  counterpartyValue: string
  date: string
  entranceNumber: string
  isAccounting: boolean
  isManagementAccounting: boolean
  movementSearch: string
  organizationValue: string
  paymentPurpose: string
  paymentRegisterValue: string
  searchType: IncomeCounterpartySearchType
  selectedCurrencyValue: string
  selectedMovementValue: string
  time: string
  vatAmount: number
  vatRate: number
}

type SelectOption = {
  label: string
  value: string
}

const INCOME_CASHFLOWS_PATH = '/accounting/income-cashflows'
const SEARCH_DEBOUNCE_MS = 300

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function IncomeCashflowConversionFormPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const registerType = parseRegisterType(searchParams.get('type'))
  const isBankIncome = registerType === PaymentRegisterType.Bank
  const [organizations, setOrganizations] = useValueState<Organization[]>([])
  const [paymentRegisters, setPaymentRegisters] = useValueState<PaymentRegister[]>([])
  const [paymentMovements, setPaymentMovements] = useValueState<PaymentMovement[]>([])
  const [counterparties, setCounterparties] = useValueState<NamedEntity[]>([])
  const [form, setForm] = useValueState<FormState>(() => createInitialForm())
  const [euroExchangeRate, setEuroExchangeRate] = useValueState(0)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => getEntityValue(organization) === form.organizationValue) || null,
    [form.organizationValue, organizations],
  )
  const filteredPaymentRegisters = useMemo(
    () => paymentRegisters.filter((register) => matchesRegister(register, selectedOrganization, registerType)),
    [paymentRegisters, registerType, selectedOrganization],
  )
  const selectedRegister = useMemo(
    () => paymentRegisters.find((register) => getEntityValue(register) === form.paymentRegisterValue) || null,
    [form.paymentRegisterValue, paymentRegisters],
  )
  const selectedCurrency = useMemo(
    () => getRegisterCurrencies(selectedRegister).find((currency) => getEntityValue(currency) === form.selectedCurrencyValue) || null,
    [form.selectedCurrencyValue, selectedRegister],
  )
  const selectedMovement = useMemo(
    () => paymentMovements.find((movement) => getEntityValue(movement) === form.selectedMovementValue) || null,
    [form.selectedMovementValue, paymentMovements],
  )
  const activeMovement = useMemo(
    () => selectedMovement || paymentMovements.find((movement) => getEntityName(movement) === form.movementSearch.trim()) || null,
    [form.movementSearch, paymentMovements, selectedMovement],
  )
  const selectedCounterparty = useMemo(
    () => counterparties.find((counterparty) => getEntityValue(counterparty) === form.counterpartyValue) || null,
    [counterparties, form.counterpartyValue],
  )
  const activeCounterparty = useMemo(
    () => selectedCounterparty || counterparties.find((counterparty) => getEntityName(counterparty) === form.counterpartySearch.trim()) || null,
    [counterparties, form.counterpartySearch, selectedCounterparty],
  )
  const organizationOptions = useMemo(() => toEntityOptions(organizations), [organizations])
  const registerOptions = useMemo(() => toEntityOptions(filteredPaymentRegisters), [filteredPaymentRegisters])
  const currencyOptions = useMemo(() => toCurrencyOptions(selectedRegister), [selectedRegister])
  const movementOptions = useMemo(() => toUniqueLabels(paymentMovements), [paymentMovements])
  const counterpartyOptions = useMemo(() => toUniqueLabels(counterparties), [counterparties])
  const title = isBankIncome ? t('Інші надходження на рахунок') : t('Інший касовий прихід')

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        const [nextOrganizations, nextRegisters, nextMovements, nextEuroRate] = await Promise.all([
          getIncomeCashflowOrganizations(),
          searchIncomeCashflowPaymentRegisters(''),
          getIncomeCashflowPaymentMovements(),
          getCurrentEuroExchangeRate(),
        ])

        if (cancelled) {
          return
        }

        setEuroExchangeRate(nextEuroRate)

        const defaultOrganization = nextOrganizations[0] || null
        const defaultRegister = selectDefaultRegister(nextRegisters, defaultOrganization, registerType)
        const defaultCurrency = getRegisterCurrencies(defaultRegister)[0] || null

        setOrganizations(nextOrganizations)
        setPaymentRegisters(nextRegisters)
        setPaymentMovements(nextMovements)
        setCounterparties([])
        setForm((current) => ({
          ...current,
          counterpartySearch: '',
          counterpartyValue: '',
          organizationValue: defaultOrganization ? getEntityValue(defaultOrganization) : '',
          paymentRegisterValue: defaultRegister ? getEntityValue(defaultRegister) : '',
          searchType: IncomeCounterpartySearchType.Client,
          selectedCurrencyValue: defaultCurrency ? getEntityValue(defaultCurrency) : '',
        }))
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити довідники для прибуткового ордера'))
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
  }, [registerType, setCounterparties, setError, setEuroExchangeRate, setForm, setLoading, setOrganizations, setPaymentMovements, setPaymentRegisters, t])

  useEffect(() => {
    const value = form.movementSearch.trim()
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchIncomeCashflowPaymentMovements(value).then(setPaymentMovements).catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [form.movementSearch, setPaymentMovements])

  useEffect(() => {
    if (!isBankIncome) {
      return
    }

    const value = form.counterpartySearch.trim()
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        setCounterparties([])
        return
      }

      void searchIncomeCashflowCounterparties(value, form.searchType, controller.signal).then(setCounterparties).catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [form.counterpartySearch, form.searchType, isBankIncome, setCounterparties])

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function handleModeChanged(value: string) {
    navigate(`${INCOME_CASHFLOWS_PATH}/new/conversion?type=${value}`, { replace: true })
  }

  function handleOrganizationChanged(value: string | null) {
    const organization = organizations.find((item) => getEntityValue(item) === value) || null
    const nextRegister = selectDefaultRegister(paymentRegisters, organization, registerType)
    const nextCurrency = getRegisterCurrencies(nextRegister)[0] || null

    updateForm({
      organizationValue: value || '',
      paymentRegisterValue: nextRegister ? getEntityValue(nextRegister) : '',
      selectedCurrencyValue: nextCurrency ? getEntityValue(nextCurrency) : '',
    })
  }

  function handleRegisterChanged(value: string | null) {
    const register = paymentRegisters.find((item) => getEntityValue(item) === value) || null
    const currency = getRegisterCurrencies(register)[0] || null

    updateForm({
      paymentRegisterValue: value || '',
      selectedCurrencyValue: currency ? getEntityValue(currency) : '',
    })
  }

  function handleVatRateChanged(value: string | number) {
    const vatRate = toNumber(value)

    updateForm({
      vatAmount: calculateVatAmount(form.amount, vatRate),
      vatRate,
    })
  }

  function handleAmountChanged(value: string | number) {
    const amount = toNumber(value)

    updateForm({
      amount,
      vatAmount: calculateVatAmount(amount, form.vatRate),
    })
  }

  function handleMovementSubmit(value: string) {
    const movement = paymentMovements.find((item) => getEntityName(item) === value)

    if (!movement) {
      return
    }

    updateForm({
      movementSearch: getEntityName(movement),
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
      const createdMovement = await createIncomeCashflowPaymentMovement(operationName)

      if (createdMovement) {
        setPaymentMovements((current) => includeEntity(current, createdMovement))
        updateForm({
          movementSearch: getEntityName(createdMovement) || operationName,
          selectedMovementValue: getEntityValue(createdMovement),
        })
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('Не вдалося створити статтю руху коштів'))
    } finally {
      setSaving(false)
    }
  }

  function handleSearchTypeChanged(value: string) {
    updateForm({
      counterpartySearch: '',
      counterpartyValue: '',
      searchType: Number(value) as IncomeCounterpartySearchType,
    })
    setCounterparties([])
  }

  function handleCounterpartySubmit(value: string) {
    const counterparty = counterparties.find((item) => getEntityName(item) === value)

    if (!counterparty) {
      return
    }

    updateForm({
      counterpartySearch: getEntityName(counterparty),
      counterpartyValue: getEntityValue(counterparty),
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateForm({
      activeMovement,
      amount: form.amount,
      selectedCurrency,
      selectedOrganization,
      selectedRegister,
      t,
    })

    if (validationError) {
      setError(validationError)
      return
    }

    const payload = buildIncomePaymentOrder({
      counterparty: isBankIncome ? activeCounterparty : null,
      euroExchangeRate,
      form,
      selectedCurrency: selectedCurrency as Currency,
      selectedMovement: activeMovement as PaymentMovement,
      selectedOrganization: selectedOrganization as Organization,
      selectedRegister: selectedRegister as PaymentRegister,
    })

    setSaving(true)
    setError(null)

    try {
      await createIncomeCashflow(payload, false)
      notifications.show({
        color: 'green',
        message: t('Прибутковий ордер створено'),
      })
      navigate(INCOME_CASHFLOWS_PATH, { replace: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити прибутковий ордер'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppDrawer
      opened
      position="right"
      size="standard"
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>title</span>}
      onClose={() => navigate(INCOME_CASHFLOWS_PATH)}
      footer={
        <Button
          color={CREATE_ACTION_COLOR}
          disabled={isLoading || isSaving}
          form="income-cashflow-conversion-form"
          leftSection={<Save size={16} />}
          loading={isSaving}
          type="submit"
        >
          {t('Зберегти')}
        </Button>
      }
    >
      <form id="income-cashflow-conversion-form" onSubmit={handleSubmit}>
        <Stack gap="md">
          <Group justify="flex-end" gap="xs" wrap="wrap">
            <SegmentedControl
              data={[
                { label: t('Каса'), value: String(PaymentRegisterType.Cash) },
                { label: t('Банк'), value: String(PaymentRegisterType.Bank) },
              ]}
              disabled={isLoading || isSaving}
              value={String(registerType)}
              onChange={handleModeChanged}
            />
          </Group>

          <Group gap="xs">
            <Badge color={isBankIncome ? 'indigo' : 'green'} variant="light">
              {isBankIncome ? t('Банк') : t('Каса')}
            </Badge>
            <Text c="dimmed" size="sm">
              {t('Новий прибутковий ордер')}
            </Text>
          </Group>

          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}

          {isBankIncome && (
            <>
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <SegmentedControl
                  data={[
                    { label: t('Клієнти'), value: String(IncomeCounterpartySearchType.Client) },
                    { label: t('Постачальники'), value: String(IncomeCounterpartySearchType.Supplier) },
                    { label: t('Виробники'), value: String(IncomeCounterpartySearchType.Manufacturer) },
                  ]}
                  disabled={isLoading || isSaving}
                  value={String(form.searchType)}
                  onChange={handleSearchTypeChanged}
                />
                <Autocomplete
                  data={counterpartyOptions}
                  disabled={isLoading || isSaving}
                  label={t('Платник')}
                  placeholder={t('Почніть вводити назву')}
                  value={form.counterpartySearch}
                  onChange={(value) => updateForm({ counterpartySearch: value, counterpartyValue: '' })}
                  onOptionSubmit={handleCounterpartySubmit}
                />
              </SimpleGrid>
              <Divider />
            </>
          )}

          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <TextInput
              disabled={isLoading || isSaving}
              label={t('Дата')}
              type="date"
              value={form.date}
              onChange={(event) => updateForm({ date: event.currentTarget.value })}
            />
            <TextInput
              disabled={isLoading || isSaving}
              label={t('Час')}
              type="time"
              value={form.time}
              onChange={(event) => updateForm({ time: event.currentTarget.value })}
            />
            <TextInput
              disabled={isLoading || isSaving}
              label={t('Вхідний номер')}
              value={form.entranceNumber}
              onChange={(event) => updateForm({ entranceNumber: event.currentTarget.value })}
            />
            <Select
              data={organizationOptions}
              disabled={isLoading || isSaving}
              label={t('Організація')}
              searchable
              value={form.organizationValue || null}
              onChange={handleOrganizationChanged}
            />
            <Select
              data={registerOptions}
              disabled={!selectedOrganization || isLoading || isSaving}
              label={t('Каса / рахунок')}
              searchable
              value={form.paymentRegisterValue || null}
              onChange={handleRegisterChanged}
            />
            <Select
              data={currencyOptions}
              disabled={!selectedRegister || isLoading || isSaving}
              label={t('Валюта')}
              searchable
              value={form.selectedCurrencyValue || null}
              onChange={(value) => updateForm({ selectedCurrencyValue: value || '' })}
            />
            <NumberInput
              allowNegative={false}
              decimalScale={2}
              disabled={isLoading || isSaving}
              label={t('Сума')}
              min={0}
              value={form.amount}
              onChange={handleAmountChanged}
            />
            <NumberInput
              allowNegative={false}
              decimalScale={2}
              disabled={isLoading || isSaving}
              label={t('Ставка ПДВ')}
              min={0}
              value={form.vatRate}
              onChange={handleVatRateChanged}
            />
            <NumberInput
              allowNegative={false}
              decimalScale={2}
              disabled={isLoading || isSaving}
              label={t('Сума ПДВ')}
              min={0}
              value={form.vatAmount}
              onChange={(value) => updateForm({ vatAmount: toNumber(value) })}
            />
            <Autocomplete
              data={movementOptions}
              disabled={isLoading || isSaving}
              label={t('Стаття руху коштів')}
              value={form.movementSearch}
              onChange={(value) => updateForm({ movementSearch: value, selectedMovementValue: '' })}
              onOptionSubmit={handleMovementSubmit}
            />
            <Button
              disabled={Boolean(activeMovement) || !form.movementSearch.trim() || isLoading}
              leftSection={<Plus size={16} />}
              mt={24}
              type="button"
              variant="default"
              onClick={() => void handleCreateMovement()}
            >
              {t('Створити статтю')}
            </Button>
            <TextInput
              disabled={isLoading || isSaving}
              label={t('Призначення платежу')}
              value={form.paymentPurpose}
              onChange={(event) => updateForm({ paymentPurpose: event.currentTarget.value })}
            />
          </SimpleGrid>

          <Group gap="lg">
            <Checkbox
              checked={form.isManagementAccounting}
              disabled={isLoading || isSaving}
              label={t('Управлінський облік')}
              onChange={(event) => updateForm({ isManagementAccounting: event.currentTarget.checked })}
            />
            <Checkbox
              checked={form.isAccounting}
              disabled={isLoading || isSaving}
              label={t('Бухгалтерський облік')}
              onChange={(event) => updateForm({ isAccounting: event.currentTarget.checked })}
            />
          </Group>

          <Textarea
            disabled={isLoading || isSaving}
            label={t('Коментар')}
            minRows={3}
            value={form.comment}
            onChange={(event) => updateForm({ comment: event.currentTarget.value })}
          />
        </Stack>
      </form>
    </AppDrawer>
  )
}

function createInitialForm(): FormState {
  const now = new Date()

  return {
    amount: 0,
    comment: '',
    counterpartySearch: '',
    counterpartyValue: '',
    date: formatLocalDate(now),
    entranceNumber: '',
    isAccounting: false,
    isManagementAccounting: true,
    movementSearch: '',
    organizationValue: '',
    paymentPurpose: '',
    paymentRegisterValue: '',
    searchType: IncomeCounterpartySearchType.Client,
    selectedCurrencyValue: '',
    selectedMovementValue: '',
    time: toTimeValue(now),
    vatAmount: 0,
    vatRate: 0,
  }
}

function buildIncomePaymentOrder({
  counterparty,
  euroExchangeRate,
  form,
  selectedCurrency,
  selectedMovement,
  selectedOrganization,
  selectedRegister,
}: {
  counterparty: NamedEntity | null
  euroExchangeRate: number
  form: FormState
  selectedCurrency: Currency
  selectedMovement: PaymentMovement
  selectedOrganization: Organization
  selectedRegister: PaymentRegister
}): IncomePaymentOrder {
  const order: IncomePaymentOrder = {
    Amount: form.amount,
    ArrivalNumber: form.entranceNumber.trim(),
    Comment: form.comment.trim(),
    Currency: selectedCurrency,
    ExchangeRate: euroExchangeRate || undefined,
    FromDate: toIsoDateTime(form.date, form.time),
    IsAccounting: form.isAccounting,
    IsManagementAccounting: form.isManagementAccounting,
    OperationType: String(IncomePaymentOperationType.OtherIncome),
    Organization: selectedOrganization,
    PaymentMovementOperation: {
      PaymentMovement: selectedMovement,
    },
    PaymentPurpose: form.paymentPurpose.trim(),
    PaymentRegister: selectedRegister,
    VAT: form.vatAmount,
    VatPercent: form.vatRate,
  }

  if (counterparty) {
    if (form.searchType === IncomeCounterpartySearchType.Supplier) {
      order.SupplyOrganization = counterparty
    } else {
      order.Client = counterparty
    }
  }

  return order
}

function validateForm({
  activeMovement,
  amount,
  selectedCurrency,
  selectedOrganization,
  selectedRegister,
  t,
}: {
  activeMovement: PaymentMovement | null
  amount: number
  selectedCurrency: Currency | null
  selectedOrganization: Organization | null
  selectedRegister: PaymentRegister | null
  t: (value: string) => string
}): string | null {
  if (!selectedOrganization) {
    return t('Оберіть організацію')
  }

  if (!selectedRegister) {
    return t('Оберіть касу або рахунок')
  }

  if (!selectedCurrency) {
    return t('Оберіть валюту')
  }

  if (!activeMovement) {
    return t('Оберіть статтю руху коштів')
  }

  if (!amount || amount <= 0) {
    return t('Сума має бути більшою за нуль')
  }

  return null
}

function selectDefaultRegister(
  paymentRegisters: PaymentRegister[],
  organization: Organization | null,
  registerType: PaymentRegisterType,
): PaymentRegister | null {
  return paymentRegisters.find((register) => matchesRegister(register, organization, registerType)) || null
}

function matchesRegister(register: PaymentRegister, organization: Organization | null, registerType: PaymentRegisterType): boolean {
  if (Number(register.Type) !== registerType) {
    return false
  }

  if (!organization) {
    return true
  }

  return getEntityValue(register.Organization) === getEntityValue(organization) || register.OrganizationId === organization.Id
}

function getRegisterCurrencies(register?: PaymentRegister | null): Currency[] {
  const currencies: Currency[] = []

  for (const currencyRegister of register?.PaymentCurrencyRegisters || []) {
    const currency = currencyRegister.Currency

    if (currency && getEntityValue(currency)) {
      currencies.push(currency)
    }
  }

  return currencies
}

function toEntityOptions<T extends NamedEntity>(entities: T[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const entity of entities) {
    const value = getEntityValue(entity)

    if (!value) {
      continue
    }

    options.push({
      label: getEntityName(entity) || value,
      value,
    })
  }

  return options
}

function toCurrencyOptions(register?: PaymentRegister | null): SelectOption[] {
  const options: SelectOption[] = []

  for (const currencyRegister of register?.PaymentCurrencyRegisters || []) {
    const currency = currencyRegister.Currency
    const value = getEntityValue(currency)
    const balance = typeof currencyRegister.Amount === 'number' ? ` (${moneyFormatter.format(currencyRegister.Amount)})` : ''

    if (!value) {
      continue
    }

    options.push({
      label: `${currency?.Code || currency?.Name || value}${balance}`,
      value,
    })
  }

  return options
}

function toUniqueLabels<T extends NamedEntity>(entities: T[]): string[] {
  const labels: string[] = []
  const seenLabels = new Set<string>()

  for (const entity of entities) {
    const label = getEntityName(entity)

    if (!label || seenLabels.has(label)) {
      continue
    }

    seenLabels.add(label)
    labels.push(label)
  }

  return labels
}

function includeEntity<T extends NamedEntity>(entities: T[], entity: T): T[] {
  const entityValue = getEntityValue(entity)

  if (!entityValue || entities.some((item) => getEntityValue(item) === entityValue)) {
    return entities
  }

  return [entity, ...entities]
}

function parseRegisterType(value: string | null): PaymentRegisterType {
  return value === String(PaymentRegisterType.Bank) ? PaymentRegisterType.Bank : PaymentRegisterType.Cash
}

function calculateVatAmount(amount: number, vatRate: number): number {
  if (!amount || !vatRate) {
    return 0
  }

  return Math.round((amount * vatRate * 100) / (100 + vatRate)) / 100
}

function getEntityValue(entity?: NamedEntity | null): string {
  return String(entity?.NetUid || entity?.Id || '')
}

function getEntityName(entity?: NamedEntity | null): string {
  return entity?.FullName || entity?.LastName || entity?.Name || entity?.OperationName || entity?.Code || entity?.Number || ''
}

function toIsoDateTime(dateValue: string, timeValue: string): string {
  const date = new Date(`${dateValue || formatLocalDate(new Date())}T${timeValue || '00:00'}`)

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
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
