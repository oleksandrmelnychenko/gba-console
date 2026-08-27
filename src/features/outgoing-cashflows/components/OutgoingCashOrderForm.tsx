import {
  ActionIcon,
  Alert,
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
  Tooltip,
} from '@mantine/core'
import { ArrowLeft, CircleAlert, Plus, Save } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawerFooter } from '../../../shared/ui/AppDrawer'
import { SearchableSelect } from '../../../shared/ui/SearchableSelect'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useAuth } from '../../auth/useAuth'
import { createAutocompleteOptionSubmitGuard } from '../../income-cashflows/autocompleteOptionSubmitGuard'
import {
  INCOME_CASHFLOW_TEXT_LIMITS,
  validateIncomeCashflowContract,
  validateIncomeCashflowMovementName,
} from '../../income-cashflows/incomeCashflowFormValidation'
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
  type OutcomePaymentUser,
} from '../outgoingCreateTypes'
import { buildOutgoingCashOrderPayload } from '../outgoingCashOrderPayload'
import {
  parseOutgoingCashOrderRegisterType,
  validateOutgoingCashOrderForm,
} from '../outgoingCashOrderPolicy'
import type { Organization, PaymentMovement } from '../types'

type OutgoingCashOrderFormProps = {
  onCancel: () => void
  onCreated: () => void
}

const FORM_ID = 'outgoing-cash-order-form'
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
  const { hasPermission } = useAuth()
  const [organizations, setOrganizations] = useValueState<Organization[]>([])
  const [paymentRegisters, setPaymentRegisters] = useValueState<CreatePaymentRegister[]>([])
  const [paymentMovements, setPaymentMovements] = useValueState<PaymentMovement[]>([])
  const [users, setUsers] = useValueState<OutcomePaymentUser[]>([])
  const [form, setForm] = useValueState<CreateFormState>(() => createInitialForm())
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [movementOptionSubmitGuard] = useState(
    createAutocompleteOptionSubmitGuard,
  )
  const [userOptionSubmitGuard] = useState(
    createAutocompleteOptionSubmitGuard,
  )

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => getEntityValue(organization) === form.organizationValue) || null,
    [form.organizationValue, organizations],
  )
  const [searchParams] = useSearchParams()
  // «Перерахування підзвітнику» відкривається з груп Банк/Каса з ?type= — префільтруємо реєстри.
  const registerTypeFilter = parseOutgoingCashOrderRegisterType(
    searchParams.get('type'),
  )
  const organizationRegisters = useMemo(
    () =>
      paymentRegisters.filter(
        (register) =>
          isRegisterForOrganization(register, selectedOrganization) &&
          (registerTypeFilter === null || register.Type === registerTypeFilter),
      ),
    [paymentRegisters, registerTypeFilter, selectedOrganization],
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
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchOutgoingCreatePaymentMovements(value)
        .then((items) => {
          if (!cancelled) {
            setPaymentMovements(items)
          }
        })
        .catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [form.movementSearch, setPaymentMovements])

  useEffect(() => {
    const value = form.userSearch.trim()
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchOutgoingCreateUsers(value)
        .then((items) => {
          if (!cancelled) {
            setUsers(items)
          }
        })
        .catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
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

    movementOptionSubmitGuard.markSubmitted(value)
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

    userOptionSubmitGuard.markSubmitted(value)
    updateForm({
      selectedColleagueValue: getEntityValue(user),
      userSearch: getUserLabel(user),
    })
  }

  function handleMovementSearchChanged(value: string) {
    if (movementOptionSubmitGuard.consumeChange(value)) {
      updateForm({ movementSearch: value })
      return
    }

    updateForm({
      movementSearch: value,
      selectedMovementValue: '',
    })
  }

  function handleUserSearchChanged(value: string) {
    if (userOptionSubmitGuard.consumeChange(value)) {
      updateForm({ userSearch: value })
      return
    }

    updateForm({
      selectedColleagueValue: '',
      userSearch: value,
    })
  }

  async function handleCreateMovement() {
    if (!hasPermission(PermissionKeys.FinancialAdministration.CashflowArticles.Article.Create)) {
      setError(t('Немає прав для створення статті руху коштів'))
      return
    }

    const operationName = form.movementSearch.trim()

    if (!operationName) {
      setError(t('Введіть значення статті грошових витрат'))
      return
    }

    const validationError = validateIncomeCashflowMovementName(operationName, t)

    if (validationError) {
      setError(validationError)
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

    if (!hasPermission(PermissionKeys.OutgoingCashflows.Order.Create)) {
      setError(t('Немає прав для створення видаткового ордера'))
      return
    }

    const typedColleague = form.userSearch.trim()
    const resolvedColleague =
      selectedColleague ??
      users.find((user) => getUserLabel(user) === typedColleague || getEntityValue(user) === typedColleague) ??
      null

    const validationError = validateOutgoingCashOrderForm({
      amount: form.amount,
      selectedColleague: resolvedColleague,
      selectedCurrencyRegister,
      selectedMovement,
      selectedOrganization,
      selectedRegister,
      t,
    }) || validateIncomeCashflowContract(
      {
        amount: form.amount,
        arrivalNumber: form.invoiceNumber,
        comment: form.comment,
        date: form.date,
        paymentPurpose: form.paymentPurpose,
        time: form.time,
      },
      t,
    )

    if (validationError) {
      setError(validationError)
      return
    }

    const payload = buildOutgoingCashOrderPayload({
      colleague: resolvedColleague,
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
    <>
      <form className="outgoing-cashflow-create-form" id={FORM_ID} onSubmit={handleSubmit}>
        <Stack gap="md">
          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <Stack gap="sm">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Дані видаткового ордера')}
            </Text>
            <SimpleGrid cols={{ base: 1, md: 3 }} style={{ alignItems: 'end' }}>
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Дата')}
                required
                type="date"
                value={form.date}
                onChange={(event) => updateForm({ date: event.currentTarget.value })}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Час')}
                required
                type="time"
                value={form.time}
                onChange={(event) => updateForm({ time: event.currentTarget.value })}
              />
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Вхідний номер')}
                maxLength={INCOME_CASHFLOW_TEXT_LIMITS.arrivalNumber}
                value={form.invoiceNumber}
                onChange={(event) => updateForm({ invoiceNumber: event.currentTarget.value })}
              />
            </SimpleGrid>
          </Stack>

          <Stack gap="sm">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Реквізити виплати')}
            </Text>
            <SimpleGrid cols={{ base: 1, md: 3 }} style={{ alignItems: 'end' }}>
              <Select
                data={organizationOptions}
                disabled={isLoading || isSaving}
                label={t('Організація')}
                required
                searchable
                value={form.organizationValue || null}
                onChange={handleOrganizationChanged}
              />
              <Select
                data={registerOptions}
                disabled={!selectedOrganization || isLoading || isSaving}
                label={t('Каса / рахунок')}
                required
                searchable
                value={form.paymentRegisterValue || null}
                onChange={handleRegisterChanged}
              />
              <Select
                className="app-input-description-below"
                data={currencyOptions}
                description={balanceLabel || undefined}
                disabled={!selectedRegister || isLoading || isSaving}
                label={t('Валюта')}
                required
                searchable
                value={form.selectedCurrencyRegisterValue || null}
                onChange={(value) => updateForm({ selectedCurrencyRegisterValue: value || '' })}
              />
              <NumberInput
                allowNegative={false}
                decimalScale={2}
                disabled={isLoading || isSaving}
                label={t('Сума')}
                min={0}
                required
                value={form.amount}
                onChange={(value) => updateForm({ amount: toNumber(value) })}
              />
              <SearchableSelect
                data={userOptions}
                disabled={isLoading || isSaving}
                label={t('Кому видано')}
                required
                value={form.userSearch}
                onChange={handleUserSearchChanged}
                onOptionSubmit={handleUserSubmit}
              />
              <Group align="flex-end" gap="xs" wrap="nowrap">
                <SearchableSelect
                  data={movementOptions}
                  disabled={isLoading || isSaving}
                  label={t('Стаття руху коштів')}
                  maxLength={INCOME_CASHFLOW_TEXT_LIMITS.movementName}
                  required
                  style={{ flex: 1 }}
                  value={form.movementSearch}
                  onChange={handleMovementSearchChanged}
                  onOptionSubmit={handleMovementSubmit}
                />
                {hasPermission(PermissionKeys.FinancialAdministration.CashflowArticles.Article.Create) && (
                  <Tooltip label={t('Створити статтю')} withArrow>
                    <ActionIcon
                      aria-label={t('Створити статтю')}
                      color={CREATE_ACTION_COLOR}
                      disabled={Boolean(selectedMovement) || !form.movementSearch.trim() || isLoading || isSaving}
                      size={36}
                      type="button"
                      variant="outline"
                      onClick={() => void handleCreateMovement()}
                    >
                      <Plus size={17} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </SimpleGrid>
          </Stack>

          <Stack gap="sm">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Деталі та облік')}
            </Text>
            <SimpleGrid cols={{ base: 1, md: 2 }} style={{ alignItems: 'start' }}>
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Призначення платежу')}
                maxLength={INCOME_CASHFLOW_TEXT_LIMITS.paymentPurpose}
                value={form.paymentPurpose}
                onChange={(event) => updateForm({ paymentPurpose: event.currentTarget.value })}
              />
              <Textarea
                autosize
                disabled={isLoading || isSaving}
                label={t('Коментар')}
                maxLength={INCOME_CASHFLOW_TEXT_LIMITS.comment}
                maxRows={4}
                minRows={1}
                value={form.comment}
                onChange={(event) => updateForm({ comment: event.currentTarget.value })}
              />
            </SimpleGrid>
            <Group className="outgoing-cashflow-create-form__accounting-flags" gap="lg">
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
          </Stack>
        </Stack>
      </form>
      <AppDrawerFooter>
        <Group gap="xs" justify="flex-end">
          <Button
            color="gray"
            leftSection={<ArrowLeft size={16} />}
            type="button"
            variant="light"
            onClick={onCancel}
          >
            {t('Скасувати')}
          </Button>
          {hasPermission(PermissionKeys.OutgoingCashflows.Order.Create) && (
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={isLoading || isSaving}
              form={FORM_ID}
              leftSection={<Save size={16} />}
              loading={isSaving}
              type="submit"
            >
              {t('Створити')}
            </Button>
          )}
        </Group>
      </AppDrawerFooter>
    </>
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

function toTimeValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${hours}:${minutes}`
}

function toNumber(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value.replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : 0
}
