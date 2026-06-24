import {
  Alert,
  Autocomplete,
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy, IconPlus } from '@tabler/icons-react'
import { type FormEvent, useEffect, useMemo } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  createOutgoingCashflowOrder,
  createOutgoingCreatePaymentMovement,
  getOutgoingCreateOrganizations,
  getOutgoingCreatePaymentMovements,
  searchOutgoingCreatePaymentMovements,
  searchOutgoingCreatePaymentRegisters,
  searchOutgoingCreateUsers,
} from '../api/outgoingCashflowCreateApi'
import {
  type CreateFormState,
  type CreatePaymentCurrencyRegister,
  type CreatePaymentRegister,
  OUTCOME_OPERATION_TYPE,
  type OutcomePaymentOrderCreatePayload,
  type OutcomePaymentUser,
} from '../outgoingCreateTypes'
import type { Organization, PaymentMovement } from '../types'

type OutgoingCashOrderFormProps = {
  onCancel: () => void
  onCreated: () => void
}

const SEARCH_DEBOUNCE_MS = 300

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

type SelectOption = {
  label: string
  value: string
}

export function OutgoingCashOrderForm({ onCancel, onCreated }: OutgoingCashOrderFormProps) {
  const { t } = useI18n()
  const [organizations, setOrganizations] = useValueState<Organization[]>([])
  const [paymentRegisters, setPaymentRegisters] = useValueState<CreatePaymentRegister[]>([])
  const [paymentMovements, setPaymentMovements] = useValueState<PaymentMovement[]>([])
  const [users, setUsers] = useValueState<OutcomePaymentUser[]>([])
  const [form, setForm] = useValueState<CreateFormState>(() => createInitialForm())
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => getEntityValue(organization) === form.organizationValue) || null,
    [form.organizationValue, organizations],
  )
  const organizationRegisters = useMemo(
    () => paymentRegisters.filter((register) => isRegisterForOrganization(register, selectedOrganization)),
    [paymentRegisters, selectedOrganization],
  )
  const selectedRegister = useMemo(
    () => organizationRegisters.find((register) => getEntityValue(register) === form.paymentRegisterValue) || null,
    [form.paymentRegisterValue, organizationRegisters],
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
  const selectedColleague = useMemo(
    () => users.find((user) => getEntityValue(user) === form.selectedColleagueValue) || null,
    [form.selectedColleagueValue, users],
  )

  const organizationOptions = useMemo(() => toEntityOptions(organizations), [organizations])
  const registerOptions = useMemo(() => toEntityOptions(organizationRegisters), [organizationRegisters])
  const currencyOptions = useMemo(
    () => toCurrencyOptions(selectedRegister?.PaymentCurrencyRegisters || []),
    [selectedRegister],
  )
  const movementOptions = useMemo(
    () => toEntityOptions(paymentMovements, (movement) => movement?.OperationName || ''),
    [paymentMovements],
  )
  const userOptions = useMemo(() => toUserOptions(users), [users])

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        const [nextOrganizations, nextRegisters, nextMovements] = await Promise.all([
          getOutgoingCreateOrganizations(),
          searchOutgoingCreatePaymentRegisters(''),
          getOutgoingCreatePaymentMovements(),
        ])

        if (cancelled) {
          return
        }

        setOrganizations(nextOrganizations)
        setPaymentRegisters(nextRegisters)
        setPaymentMovements(nextMovements)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося виконати запит'))
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
  }, [setError, setLoading, setOrganizations, setPaymentMovements, setPaymentRegisters, t])

  useEffect(() => {
    const value = form.movementSearch.trim()
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchOutgoingCreatePaymentMovements(value).then(setPaymentMovements).catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [form.movementSearch, setPaymentMovements])

  useEffect(() => {
    const value = form.userSearch.trim()
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchOutgoingCreateUsers(value).then(setUsers).catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [form.userSearch, setUsers])

  function updateForm(patch: Partial<CreateFormState>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function handleOrganizationChanged(value: string | null) {
    const organization = organizations.find((item) => getEntityValue(item) === value) || null
    const nextRegisters = paymentRegisters.filter((register) => isRegisterForOrganization(register, organization))
    const mainRegister = nextRegisters.find((register) => register.IsMain) || nextRegisters[0] || null
    const currencyRegister = mainRegister?.PaymentCurrencyRegisters?.[0] || null

    updateForm({
      organizationValue: value || '',
      paymentRegisterValue: mainRegister ? getEntityValue(mainRegister) : '',
      selectedCurrencyRegisterValue: currencyRegister ? getEntityValue(currencyRegister) : '',
    })
  }

  function handleRegisterChanged(value: string | null) {
    const register = organizationRegisters.find((item) => getEntityValue(item) === value) || null
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

  function handleUserSubmit(value: string) {
    const user = users.find((item) => getUserLabel(item) === value || getEntityValue(item) === value)

    if (!user) {
      return
    }

    updateForm({
      selectedColleagueValue: getEntityValue(user),
      userSearch: getUserLabel(user),
    })
  }

  async function handleCreateMovement() {
    const operationName = form.movementSearch.trim()

    if (!operationName) {
      setError(t('Введіть значення статті грошових витрат'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const createdMovement = await createOutgoingCreatePaymentMovement(operationName)

      if (createdMovement) {
        setPaymentMovements((current) => includeEntity(current, createdMovement))
        updateForm({
          movementSearch: createdMovement.OperationName || operationName,
          selectedMovementValue: getEntityValue(createdMovement),
        })
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateForm({
      amount: form.amount,
      isUnderReport: form.isUnderReport,
      selectedColleague,
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

    const payload = buildPayload({
      colleague: selectedColleague,
      form,
      selectedCurrencyRegister: selectedCurrencyRegister as CreatePaymentCurrencyRegister,
      selectedMovement: selectedMovement as PaymentMovement,
      selectedOrganization: selectedOrganization as Organization,
      selectedRegister: selectedRegister as CreatePaymentRegister,
    })

    setSaving(true)
    setError(null)

    try {
      await createOutgoingCashflowOrder(payload)
      onCreated()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }

  const balanceLabel =
    selectedCurrencyRegister && typeof selectedCurrencyRegister.Amount === 'number'
      ? `${t('Залишки')}: ${moneyFormatter.format(selectedCurrencyRegister.Amount)} ${selectedCurrencyRegister.Currency?.Code || ''}`
      : ''

  return (
    <Card withBorder radius="md" shadow="sm">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <Text fw={700} size="xl">
              {t('Створення нового видаткового ордера')}
            </Text>
            <Group gap="xs">
              <Button
                color="gray"
                leftSection={<IconArrowLeft size={16} />}
                type="button"
                variant="light"
                onClick={onCancel}
              >
                {t('Скасувати')}
              </Button>
              <Button
                color={CREATE_ACTION_COLOR}
                disabled={isLoading || isSaving}
                leftSection={<IconDeviceFloppy size={16} />}
                loading={isSaving}
                type="submit"
              >
                {t('Створити')}
              </Button>
            </Group>
          </Group>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <TextInput
              disabled={isLoading || isSaving}
              label={t('Від якої дати')}
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
              value={form.invoiceNumber}
              onChange={(event) => updateForm({ invoiceNumber: event.currentTarget.value })}
            />
          </SimpleGrid>

          <Group gap="lg">
            <Checkbox
              checked={form.isUnderReport}
              disabled={isLoading || isSaving}
              label={t('під звіт')}
              onChange={(event) => updateForm({ isUnderReport: event.currentTarget.checked })}
            />
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

          <SimpleGrid cols={{ base: 1, md: 3 }}>
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
              label={t('Грошові рахунки')}
              searchable
              value={form.paymentRegisterValue || null}
              onChange={handleRegisterChanged}
            />
            <Select
              data={currencyOptions}
              description={balanceLabel || undefined}
              disabled={!selectedRegister || isLoading || isSaving}
              label={t('Валюта')}
              searchable
              value={form.selectedCurrencyRegisterValue || null}
              onChange={(value) => updateForm({ selectedCurrencyRegisterValue: value || '' })}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <NumberInput
              allowNegative={false}
              decimalScale={2}
              disabled={isLoading || isSaving}
              label={t('Сума')}
              min={0}
              value={form.amount}
              onChange={(value) => updateForm({ amount: toNumber(value) })}
            />
            <Autocomplete
              data={userOptions}
              disabled={isLoading || isSaving}
              label={t('Кому видано')}
              value={form.userSearch}
              onChange={(value) => updateForm({ selectedColleagueValue: '', userSearch: value })}
              onOptionSubmit={handleUserSubmit}
            />
            <TextInput
              disabled={isLoading || isSaving}
              label={t('Призначення платежу')}
              value={form.paymentPurpose}
              onChange={(event) => updateForm({ paymentPurpose: event.currentTarget.value })}
            />
          </SimpleGrid>

          <Group align="flex-end" gap="sm" grow wrap="nowrap">
            <Autocomplete
              data={movementOptions}
              disabled={isLoading || isSaving}
              label={t('Статті руху грошових коштів')}
              value={form.movementSearch}
              onChange={(value) => updateForm({ movementSearch: value, selectedMovementValue: '' })}
              onOptionSubmit={handleMovementSubmit}
            />
            <Button
              disabled={Boolean(selectedMovement) || !form.movementSearch.trim() || isLoading || isSaving}
              leftSection={<IconPlus size={16} />}
              maw={220}
              type="button"
              variant="light"
              onClick={() => void handleCreateMovement()}
            >
              {t('Зберегти')}
            </Button>
          </Group>

          <TextInput
            disabled={isLoading || isSaving}
            label={t('Коментар')}
            value={form.comment}
            onChange={(event) => updateForm({ comment: event.currentTarget.value })}
          />
        </Stack>
      </form>
    </Card>
  )
}

function createInitialForm(): CreateFormState {
  const now = new Date()

  return {
    amount: 0,
    comment: '',
    date: formatLocalDate(now),
    invoiceNumber: '',
    isAccounting: false,
    isManagementAccounting: false,
    isUnderReport: true,
    movementSearch: '',
    organizationValue: '',
    paymentPurpose: '',
    paymentRegisterValue: '',
    selectedColleagueValue: '',
    selectedCurrencyRegisterValue: '',
    selectedMovementValue: '',
    time: toTimeValue(now),
    userSearch: '',
  }
}

function buildPayload({
  colleague,
  form,
  selectedCurrencyRegister,
  selectedMovement,
  selectedOrganization,
  selectedRegister,
}: {
  colleague: OutcomePaymentUser | null
  form: CreateFormState
  selectedCurrencyRegister: CreatePaymentCurrencyRegister
  selectedMovement: PaymentMovement
  selectedOrganization: Organization
  selectedRegister: CreatePaymentRegister
}): OutcomePaymentOrderCreatePayload {
  const invoiceNumber = form.invoiceNumber.trim()

  return {
    Amount: form.amount,
    Colleague: form.isUnderReport ? colleague : null,
    Comment: form.comment.trim(),
    FromDate: toIsoDateTime(form.date, form.time),
    IsAccounting: form.isAccounting,
    IsManagementAccounting: form.isManagementAccounting,
    IsUnderReport: form.isUnderReport,
    OperationType: OUTCOME_OPERATION_TYPE.TransferToColleague,
    Organization: selectedOrganization,
    PaymentCurrencyRegister: selectedCurrencyRegister,
    PaymentMovementOperation: {
      PaymentMovement: selectedMovement,
    },
    PaymentPurpose: form.paymentPurpose.trim(),
    PaymentRegister: selectedRegister,
    ...(invoiceNumber ? { ArrivalNumber: invoiceNumber } : {}),
  }
}

function validateForm({
  amount,
  isUnderReport,
  selectedColleague,
  selectedCurrencyRegister,
  selectedMovement,
  selectedOrganization,
  selectedRegister,
  t,
}: {
  amount: number
  isUnderReport: boolean
  selectedColleague: OutcomePaymentUser | null
  selectedCurrencyRegister: CreatePaymentCurrencyRegister | null
  selectedMovement: PaymentMovement | null
  selectedOrganization: Organization | null
  selectedRegister: CreatePaymentRegister | null
  t: (value: string) => string
}): string | null {
  if (!selectedOrganization) {
    return t('Організація')
  }

  if (!selectedRegister) {
    return t('Грошові рахунки')
  }

  if (!selectedCurrencyRegister) {
    return t('Валюта')
  }

  if (!selectedMovement) {
    return t('Виберіть статтю грошових витрат')
  }

  if (isUnderReport && !selectedColleague) {
    return t('Виберіть відповідального')
  }

  if (!amount || amount <= 0) {
    return t('Сума')
  }

  return null
}

function isRegisterForOrganization(register: CreatePaymentRegister, organization: Organization | null): boolean {
  if (!organization) {
    return true
  }

  if (typeof register.OrganizationId === 'number' && typeof organization.Id === 'number') {
    return register.OrganizationId === organization.Id
  }

  if (register.Organization) {
    return getEntityValue(register.Organization) === getEntityValue(organization)
  }

  return true
}

function toEntityOptions<T extends { Code?: string; Id?: number; Name?: string; NetUid?: string; OperationName?: string }>(
  entities: T[],
  labelGetter: (entity: T) => string = (entity) => entity.Name || entity.OperationName || entity.Code || '',
): SelectOption[] {
  return collectValuedOptions(entities, (entity) => {
    const value = getEntityValue(entity)

    return {
      label: labelGetter(entity) || value,
      value,
    }
  })
}

function toCurrencyOptions(currencyRegisters: CreatePaymentCurrencyRegister[]): SelectOption[] {
  return collectValuedOptions(currencyRegisters, (currencyRegister) => {
    const currency = currencyRegister.Currency
    const value = getEntityValue(currencyRegister)
    const balance = typeof currencyRegister.Amount === 'number' ? ` (${moneyFormatter.format(currencyRegister.Amount)})` : ''

    return {
      label: `${currency?.Code || currency?.Name || value}${balance}`,
      value,
    }
  })
}

function toUserOptions(users: OutcomePaymentUser[]): string[] {
  return collectUniqueTruthyLabels(users, getUserLabel)
}

function collectValuedOptions<T>(items: T[], getOption: (item: T) => SelectOption): SelectOption[] {
  const options: SelectOption[] = []

  for (const item of items) {
    const option = getOption(item)

    if (option.value) {
      options.push(option)
    }
  }

  return options
}

function collectUniqueTruthyLabels<T>(items: T[], getLabel: (item: T) => string): string[] {
  const seen = new Set<string>()
  const labels: string[] = []

  for (const item of items) {
    const label = getLabel(item)

    if (!label || seen.has(label)) {
      continue
    }

    seen.add(label)
    labels.push(label)
  }

  return labels
}

function includeEntity<T extends { Id?: number; NetUid?: string }>(entities: T[], entity: T | null): T[] {
  if (!entity) {
    return entities
  }

  const entityValue = getEntityValue(entity)

  if (!entityValue || entities.some((item) => getEntityValue(item) === entityValue)) {
    return entities
  }

  return [entity, ...entities]
}

function getEntityValue(entity?: { Id?: number; NetUid?: string } | null): string {
  return String(entity?.NetUid || entity?.Id || '')
}

function getUserLabel(user?: OutcomePaymentUser | null): string {
  if (!user) {
    return ''
  }

  const fullName = joinTruthyParts([user.LastName, user.FirstName, user.MiddleName]).trim()

  return user.FullName || fullName || user.Name || getEntityValue(user)
}

function joinTruthyParts(parts: Array<string | null | undefined>): string {
  const truthyParts: string[] = []

  for (const part of parts) {
    if (part) {
      truthyParts.push(part)
    }
  }

  return truthyParts.join(' ')
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
