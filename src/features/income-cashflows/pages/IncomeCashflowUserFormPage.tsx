import {
  Alert,
  Autocomplete,
  Badge,
  Button,
  Checkbox,
  Group,
  NumberInput,
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
import { useNavigate } from 'react-router-dom'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  createIncomeCashflow,
  createIncomeCashflowPaymentMovement,
  getIncomeCashflowOrganizations,
  getIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentRegisters,
  searchIncomeCashflowUsers,
} from '../api/incomeCashflowsApi'
import type {
  Currency,
  IncomePaymentOrder,
  NamedEntity,
  Organization,
  PaymentCurrencyRegister,
  PaymentMovement,
  PaymentRegister,
} from '../types'
import { IncomePaymentOperationType, IncomePaymentOrderType, PaymentRegisterType } from '../types'

type FormState = {
  amount: number
  comment: string
  date: string
  exchangeRate: number
  isAccounting: boolean
  isManagementAccounting: boolean
  movementSearch: string
  organizationValue: string
  paymentRegisterValue: string
  selectedCurrencyValue: string
  selectedMovementValue: string
  selectedUserValue: string
  time: string
  userSearch: string
  vatAmount: number
  vatRate: number
}

type SelectOption = {
  label: string
  value: string
}

const INCOME_CASHFLOWS_PATH = '/accounting/income-cashflows'
const SEARCH_DEBOUNCE_MS = 300

export function IncomeCashflowUserFormPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [organizations, setOrganizations] = useValueState<Organization[]>([])
  const [paymentRegisters, setPaymentRegisters] = useValueState<PaymentRegister[]>([])
  const [paymentMovements, setPaymentMovements] = useValueState<PaymentMovement[]>([])
  const [users, setUsers] = useValueState<NamedEntity[]>([])
  const [form, setForm] = useValueState<FormState>(() => createInitialForm())
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => getEntityValue(organization) === form.organizationValue) || null,
    [form.organizationValue, organizations],
  )
  const filteredPaymentRegisters = useMemo(
    () => paymentRegisters.filter((register) => matchesRegister(register, selectedOrganization)),
    [paymentRegisters, selectedOrganization],
  )
  const selectedRegister = useMemo(
    () => paymentRegisters.find((register) => getEntityValue(register) === form.paymentRegisterValue) || null,
    [form.paymentRegisterValue, paymentRegisters],
  )
  const selectedCurrencyRegister = useMemo(
    () =>
      (selectedRegister?.PaymentCurrencyRegisters || []).find(
        (currencyRegister) => getEntityValue(currencyRegister.Currency) === form.selectedCurrencyValue,
      ) || null,
    [form.selectedCurrencyValue, selectedRegister],
  )
  const selectedCurrency = selectedCurrencyRegister?.Currency || null
  const selectedMovement = useMemo(
    () => paymentMovements.find((movement) => getEntityValue(movement) === form.selectedMovementValue) || null,
    [form.selectedMovementValue, paymentMovements],
  )
  const activeMovement = useMemo(
    () => selectedMovement || paymentMovements.find((movement) => getEntityName(movement) === form.movementSearch.trim()) || null,
    [form.movementSearch, paymentMovements, selectedMovement],
  )
  const selectedUser = useMemo(
    () => users.find((user) => getEntityValue(user) === form.selectedUserValue) || null,
    [form.selectedUserValue, users],
  )
  const activeUser = useMemo(
    () => selectedUser || users.find((user) => getEntityName(user) === form.userSearch.trim()) || null,
    [form.userSearch, selectedUser, users],
  )
  const organizationOptions = useMemo(() => toEntityOptions(organizations), [organizations])
  const registerOptions = useMemo(() => toEntityOptions(filteredPaymentRegisters), [filteredPaymentRegisters])
  const currencyOptions = useMemo(() => toCurrencyOptions(selectedRegister), [selectedRegister])
  const movementOptions = useMemo(() => toUniqueLabels(paymentMovements), [paymentMovements])
  const userOptions = useMemo(() => toUniqueLabels(users), [users])

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        const [nextOrganizations, nextRegisters, nextMovements] = await Promise.all([
          getIncomeCashflowOrganizations(),
          searchIncomeCashflowPaymentRegisters(''),
          getIncomeCashflowPaymentMovements(),
        ])

        if (cancelled) {
          return
        }

        const defaultOrganization = nextOrganizations[0] || null
        const defaultRegister = selectDefaultRegister(nextRegisters, defaultOrganization)
        const defaultCurrency = defaultRegister?.PaymentCurrencyRegisters?.[0]?.Currency || null
        const defaultMovement = nextMovements[0] || null

        setOrganizations(nextOrganizations)
        setPaymentRegisters(nextRegisters)
        setPaymentMovements(nextMovements)
        setForm((current) => ({
          ...current,
          movementSearch: defaultMovement?.OperationName || '',
          organizationValue: defaultOrganization ? getEntityValue(defaultOrganization) : '',
          paymentRegisterValue: defaultRegister ? getEntityValue(defaultRegister) : '',
          selectedCurrencyValue: defaultCurrency ? getEntityValue(defaultCurrency) : '',
          selectedMovementValue: defaultMovement ? getEntityValue(defaultMovement) : '',
        }))
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити довідники для повернення від колеги'))
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
  }, [setError, setForm, setLoading, setOrganizations, setPaymentMovements, setPaymentRegisters, t])

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
    const value = form.userSearch.trim()
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        setUsers([])
        return
      }

      void searchIncomeCashflowUsers(value).then(setUsers).catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [form.userSearch, setUsers])

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function handleOrganizationChanged(value: string | null) {
    const organization = organizations.find((item) => getEntityValue(item) === value) || null
    const register = selectDefaultRegister(paymentRegisters, organization)
    const currency = register?.PaymentCurrencyRegisters?.[0]?.Currency || null

    updateForm({
      organizationValue: value || '',
      paymentRegisterValue: register ? getEntityValue(register) : '',
      selectedCurrencyValue: currency ? getEntityValue(currency) : '',
    })
  }

  function handleRegisterChanged(value: string | null) {
    const register = paymentRegisters.find((item) => getEntityValue(item) === value) || null
    const currency = register?.PaymentCurrencyRegisters?.[0]?.Currency || null

    updateForm({
      paymentRegisterValue: value || '',
      selectedCurrencyValue: currency ? getEntityValue(currency) : '',
    })
  }

  function handleAmountChanged(value: string | number) {
    const amount = toNumber(value)

    updateForm({
      amount,
      vatAmount: calculateVatAmount(amount, form.vatRate),
    })
  }

  function handleVatRateChanged(value: string | number) {
    const vatRate = toNumber(value)

    updateForm({
      vatAmount: calculateVatAmount(form.amount, vatRate),
      vatRate,
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

  function handleUserSubmit(value: string) {
    const user = users.find((item) => getEntityName(item) === value)

    if (!user) {
      return
    }

    updateForm({
      selectedUserValue: getEntityValue(user),
      userSearch: getEntityName(user),
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateForm({
      activeMovement,
      activeUser,
      amount: form.amount,
      selectedCurrency,
      selectedCurrencyRegister,
      selectedOrganization,
      selectedRegister,
      t,
    })

    if (validationError) {
      setError(validationError)
      return
    }

    const payload = buildIncomePaymentOrder({
      activeMovement: activeMovement as PaymentMovement,
      activeUser: activeUser as NamedEntity,
      form,
      selectedCurrency: selectedCurrency as Currency,
      selectedCurrencyRegister: selectedCurrencyRegister as PaymentCurrencyRegister,
      selectedOrganization: selectedOrganization as Organization,
      selectedRegister: selectedRegister as PaymentRegister,
    })

    setSaving(true)
    setError(null)

    try {
      await createIncomeCashflow(payload, false)
      notifications.show({
        color: 'green',
        message: t('Повернення від колеги створено'),
      })
      navigate(INCOME_CASHFLOWS_PATH, { replace: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити повернення від колеги'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppDrawer
      opened
      position="right"
      size="standard"
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>t('Повернення від колеги')</span>}
      onClose={() => navigate(INCOME_CASHFLOWS_PATH)}
      footer={
        <Button
          color={CREATE_ACTION_COLOR}
          disabled={isLoading || isSaving}
          form="income-cashflow-user-form"
          leftSection={<Save size={16} />}
          loading={isSaving}
          type="submit"
        >
          {t('Зберегти')}
        </Button>
      }
    >
      <form id="income-cashflow-user-form" onSubmit={handleSubmit}>
        <Stack gap="md">
          <Group gap="xs">
            <Badge color="green" variant="light">
              {t('Прибутковий ордер')}
            </Badge>
            <Text c="dimmed" size="sm">
              {t('Новий прибутковий ордер від користувача')}
            </Text>
          </Group>

          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
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
            <Autocomplete
              data={userOptions}
              disabled={isLoading || isSaving}
              label={t('Колега')}
              placeholder={t('Почніть вводити імʼя')}
              value={form.userSearch}
              onChange={(value) => updateForm({ selectedUserValue: '', userSearch: value })}
              onOptionSubmit={handleUserSubmit}
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
            <NumberInput
              allowNegative={false}
              decimalScale={6}
              disabled={isLoading || isSaving}
              label={t('Курс')}
              min={0}
              value={form.exchangeRate}
              onChange={(value) => updateForm({ exchangeRate: toNumber(value) })}
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
    date: formatLocalDate(now),
    exchangeRate: 0,
    isAccounting: false,
    isManagementAccounting: true,
    movementSearch: '',
    organizationValue: '',
    paymentRegisterValue: '',
    selectedCurrencyValue: '',
    selectedMovementValue: '',
    selectedUserValue: '',
    time: toTimeValue(now),
    userSearch: '',
    vatAmount: 0,
    vatRate: 0,
  }
}

function buildIncomePaymentOrder({
  activeMovement,
  activeUser,
  form,
  selectedCurrency,
  selectedCurrencyRegister,
  selectedOrganization,
  selectedRegister,
}: {
  activeMovement: PaymentMovement
  activeUser: NamedEntity
  form: FormState
  selectedCurrency: Currency
  selectedCurrencyRegister: PaymentCurrencyRegister
  selectedOrganization: Organization
  selectedRegister: PaymentRegister
}): IncomePaymentOrder {
  return {
    Amount: form.amount,
    Colleague: activeUser,
    Comment: form.comment.trim(),
    Currency: selectedCurrency,
    ExchangeRate: form.exchangeRate || undefined,
    FromDate: toIsoDateTime(form.date, form.time),
    IncomeCashOrderType: selectedRegister.Type === PaymentRegisterType.Cash ? IncomePaymentOrderType.Cash : IncomePaymentOrderType.Transfer,
    IsAccounting: form.isAccounting,
    IsManagementAccounting: form.isManagementAccounting,
    OperationType: String(IncomePaymentOperationType.ReturnFromColleague),
    Organization: selectedOrganization,
    PaymentCurrencyRegister: selectedCurrencyRegister,
    PaymentMovementOperation: {
      PaymentMovement: activeMovement,
    },
    PaymentRegister: selectedRegister,
    VAT: form.vatAmount,
    VatPercent: form.vatRate,
  }
}

function validateForm({
  activeMovement,
  activeUser,
  amount,
  selectedCurrency,
  selectedCurrencyRegister,
  selectedOrganization,
  selectedRegister,
  t,
}: {
  activeMovement: PaymentMovement | null
  activeUser: NamedEntity | null
  amount: number
  selectedCurrency: Currency | null
  selectedCurrencyRegister: PaymentCurrencyRegister | null
  selectedOrganization: Organization | null
  selectedRegister: PaymentRegister | null
  t: (value: string) => string
}): string | null {
  if (!activeMovement) {
    return t('Оберіть статтю руху коштів')
  }

  if (!activeUser) {
    return t('Оберіть колегу')
  }

  if (!selectedOrganization) {
    return t('Оберіть організацію')
  }

  if (!selectedRegister) {
    return t('Оберіть касу або рахунок')
  }

  if (!selectedCurrency || !selectedCurrencyRegister) {
    return t('Оберіть валюту')
  }

  if (!amount || amount <= 0) {
    return t('Сума має бути більшою за нуль')
  }

  return null
}

function selectDefaultRegister(paymentRegisters: PaymentRegister[], organization: Organization | null): PaymentRegister | null {
  return paymentRegisters.find((register) => matchesRegister(register, organization)) || null
}

function matchesRegister(register: PaymentRegister, organization: Organization | null): boolean {
  if (!organization) {
    return true
  }

  return getEntityValue(register.Organization) === getEntityValue(organization) || register.OrganizationId === organization.Id
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

    if (!value) {
      continue
    }

    options.push({
      label: currency?.Code || currency?.Name || value,
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
  return joinTruthyParts([entity?.FirstName, entity?.LastName]) || entity?.FullName || entity?.Name || entity?.OperationName || entity?.Code || entity?.Number || ''
}

function joinTruthyParts(parts: Array<string | null | undefined>, separator = ' '): string {
  const labels: string[] = []

  for (const part of parts) {
    if (part) {
      labels.push(part)
    }
  }

  return labels.join(separator)
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
