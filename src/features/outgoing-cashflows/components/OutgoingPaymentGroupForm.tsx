import {
  Alert,
  Autocomplete,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  NumberInput,
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy, IconPlus } from '@tabler/icons-react'
import { type FormEvent, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  createIncomeCashflowPaymentMovement,
  getIncomeCashflowClientAgreements,
  getIncomeCashflowOrganizations,
  getIncomeCashflowPaymentMovements,
  getIncomeCashflowSpecificExchangeRate,
  getIncomeCashflowSupplyOrganizationAgreements,
  searchIncomeCashflowCounterparties,
  searchIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentRegisters,
} from '../../income-cashflows/api/incomeCashflowsApi'
import {
  IncomeCounterpartySearchType,
  PaymentRegisterType,
  type Client,
  type ClientAgreement,
  type Currency,
  type Organization,
  type PaymentMovement,
  type PaymentRegister,
  type SupplyOrganization,
  type SupplyOrganizationAgreement,
} from '../../income-cashflows/types'
import { createOutgoingCashflowOrder } from '../api/outgoingCashflowCreateApi'
import {
  type CreatePaymentCurrencyRegister,
  type CreatePaymentRegister,
  OUTCOME_OPERATION_TYPE,
  type OutcomeOperationType,
  type OutcomePaymentOrderCreatePayload,
} from '../outgoingCreateTypes'
import {
  SEARCH_DEBOUNCE_MS,
  balanceLabelOf,
  calculateVat,
  getEntityName,
  getEntityValue,
  includeEntity,
  toClientAgreementOptions,
  toCurrencyOptions,
  toEntityOptions,
  toIsoDateTime,
  toNumber,
  toSupplyAgreementOptions,
  toTimeValue,
  toUniqueLabels,
} from './outgoingModeShared'

type OutgoingPaymentGroupFormProps = {
  onCancel: () => void
  onCreated: () => void
}

type FormState = {
  amount: number
  comment: string
  counterpartySearch: string
  date: string
  exchangeRate: number
  isAccounting: boolean
  isManagementAccounting: boolean
  movementSearch: string
  operationType: OutcomeOperationType
  organizationValue: string
  paymentPurpose: string
  paymentRegisterValue: string
  registerType: PaymentRegisterType
  searchType: IncomeCounterpartySearchType
  selectedAgreementValue: string
  selectedCurrencyValue: string
  selectedMovementValue: string
  time: string
  vatAmount: number
  vatRate: number
}

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function OutgoingPaymentGroupForm({ onCancel, onCreated }: OutgoingPaymentGroupFormProps) {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const initialOperationType = parseOperationType(searchParams.get('operationType'))
  const initialRegisterType = parseRegisterType(searchParams.get('type'))
  const [organizations, setOrganizations] = useValueState<Organization[]>([])
  const [availableOrganizations, setAvailableOrganizations] = useValueState<Organization[]>([])
  const [paymentRegisters, setPaymentRegisters] = useValueState<PaymentRegister[]>([])
  const [paymentMovements, setPaymentMovements] = useValueState<PaymentMovement[]>([])
  const [counterparties, setCounterparties] = useValueState<Client[]>([])
  const [selectedClient, setSelectedClient] = useValueState<Client | null>(null)
  const [selectedSupplyOrganization, setSelectedSupplyOrganization] = useValueState<SupplyOrganization | null>(null)
  const [clientAgreements, setClientAgreements] = useValueState<ClientAgreement[]>([])
  const [supplyAgreements, setSupplyAgreements] = useValueState<SupplyOrganizationAgreement[]>([])
  const [form, setForm] = useValueState<FormState>(() => createInitialForm(initialOperationType, initialRegisterType))
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isResolvingCounterparty, setResolvingCounterparty] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)

  const operationType = form.operationType
  const registerType = form.registerType
  const isSupplierSearch = form.searchType === IncomeCounterpartySearchType.Supplier
  const isOtherOutcome = operationType === OUTCOME_OPERATION_TYPE.OtherOutcome
  const selectedOrganization = useMemo(
    () => availableOrganizations.find((organization) => getEntityValue(organization) === form.organizationValue) || null,
    [availableOrganizations, form.organizationValue],
  )
  const filteredRegisters = useMemo(
    () => paymentRegisters.filter((register) => matchesRegister(register, selectedOrganization, registerType)),
    [paymentRegisters, registerType, selectedOrganization],
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
  const selectedClientAgreement = useMemo(
    () => clientAgreements.find((agreement) => getEntityValue(agreement.Agreement) === form.selectedAgreementValue) || null,
    [clientAgreements, form.selectedAgreementValue],
  )
  const selectedSupplyAgreement = useMemo(
    () => supplyAgreements.find((agreement) => getEntityValue(agreement) === form.selectedAgreementValue) || null,
    [form.selectedAgreementValue, supplyAgreements],
  )
  const agreementCurrency = isSupplierSearch ? selectedSupplyAgreement?.Currency || null : selectedClientAgreement?.Agreement?.Currency || null
  const selectedMovement = useMemo(
    () => paymentMovements.find((movement) => getEntityValue(movement) === form.selectedMovementValue) || null,
    [form.selectedMovementValue, paymentMovements],
  )
  const activeMovement = useMemo(
    () => selectedMovement || paymentMovements.find((movement) => getEntityName(movement) === form.movementSearch.trim()) || null,
    [form.movementSearch, paymentMovements, selectedMovement],
  )

  const operationOptions = useMemo(() => getOperationOptions(t), [t])
  const searchTypeOptions = useMemo(() => getSearchTypeOptions(operationType, t), [operationType, t])
  const organizationOptions = useMemo(() => toEntityOptions(availableOrganizations), [availableOrganizations])
  const registerOptions = useMemo(() => toEntityOptions(filteredRegisters), [filteredRegisters])
  const currencyOptions = useMemo(() => toCurrencyOptions(selectedRegister), [selectedRegister])
  const agreementOptions = useMemo(
    () => (isSupplierSearch ? toSupplyAgreementOptions(supplyAgreements) : toClientAgreementOptions(clientAgreements)),
    [clientAgreements, isSupplierSearch, supplyAgreements],
  )
  const counterpartyOptions = useMemo(() => toUniqueLabels(counterparties), [counterparties])
  const movementOptions = useMemo(() => toUniqueLabels(paymentMovements), [paymentMovements])

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
        const defaultRegister = selectDefaultRegister(nextRegisters, defaultOrganization, initialRegisterType)
        const defaultCurrency = defaultRegister?.PaymentCurrencyRegisters?.[0]?.Currency || null
        const defaultMovement = nextMovements[0] || null

        setOrganizations(nextOrganizations)
        setAvailableOrganizations(nextOrganizations)
        setPaymentRegisters(nextRegisters)
        setPaymentMovements(nextMovements)
        setCounterparties([])
        setSelectedClient(null)
        setSelectedSupplyOrganization(null)
        setClientAgreements([])
        setSupplyAgreements([])
        setForm((current) => ({
          ...current,
          operationType: initialOperationType,
          registerType: initialRegisterType,
          organizationValue: defaultOrganization ? getEntityValue(defaultOrganization) : '',
          paymentRegisterValue: defaultRegister ? getEntityValue(defaultRegister) : '',
          selectedCurrencyValue: defaultCurrency ? getEntityValue(defaultCurrency) : '',
          selectedMovementValue: defaultMovement ? getEntityValue(defaultMovement) : '',
          movementSearch: getEntityName(defaultMovement),
        }))
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити довідники для видаткового ордера'))
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
  }, [
    initialOperationType,
    initialRegisterType,
    setAvailableOrganizations,
    setClientAgreements,
    setCounterparties,
    setError,
    setForm,
    setLoading,
    setOrganizations,
    setPaymentMovements,
    setPaymentRegisters,
    setSelectedClient,
    setSelectedSupplyOrganization,
    setSupplyAgreements,
    t,
  ])

  useEffect(() => {
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
  }, [form.counterpartySearch, form.searchType, setCounterparties])

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
    const fromCurrencyNetId = selectedCurrency?.NetUid
    const toCurrencyNetId = agreementCurrency?.NetUid

    if (!fromCurrencyNetId || !toCurrencyNetId) {
      return
    }

    let cancelled = false

    void getIncomeCashflowSpecificExchangeRate({
      fromCurrencyNetId,
      fromDate: toIsoDateTime(form.date, form.time),
      toCurrencyNetId,
    })
      .then((nextRate) => {
        if (!cancelled && nextRate > 0) {
          setForm((current) => ({ ...current, exchangeRate: nextRate }))
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [agreementCurrency?.NetUid, form.date, form.time, selectedCurrency?.NetUid, setForm])

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function handleRegisterTypeChanged(value: string) {
    const nextRegisterType = Number(value) as PaymentRegisterType
    const nextRegister = selectDefaultRegister(paymentRegisters, selectedOrganization, nextRegisterType)
    const nextCurrency = nextRegister?.PaymentCurrencyRegisters?.[0]?.Currency || null

    updateForm({
      paymentRegisterValue: nextRegister ? getEntityValue(nextRegister) : '',
      registerType: nextRegisterType,
      selectedCurrencyValue: nextCurrency ? getEntityValue(nextCurrency) : '',
    })
  }

  function handleOperationChanged(value: string) {
    const nextOperationType = Number(value) as OutcomeOperationType

    updateForm({
      counterpartySearch: '',
      operationType: nextOperationType,
      organizationValue: '',
      paymentRegisterValue: '',
      searchType: getDefaultSearchType(nextOperationType),
      selectedAgreementValue: '',
      selectedCurrencyValue: '',
    })
    setCounterparties([])
    setSelectedClient(null)
    setSelectedSupplyOrganization(null)
    setClientAgreements([])
    setSupplyAgreements([])
    setAvailableOrganizations(organizations)
  }

  function handleSearchTypeChanged(value: string) {
    const nextSearchType = Number(value) as IncomeCounterpartySearchType

    updateForm({
      counterpartySearch: '',
      searchType: nextSearchType,
      selectedAgreementValue: '',
    })
    setCounterparties([])
    setSelectedClient(null)
    setSelectedSupplyOrganization(null)
    setClientAgreements([])
    setSupplyAgreements([])
    setAvailableOrganizations(organizations)
  }

  async function handleCounterpartySubmit(value: string) {
    const counterparty = counterparties.find((item) => getEntityName(item) === value)

    if (!counterparty) {
      return
    }

    if (form.searchType === IncomeCounterpartySearchType.Supplier) {
      await selectSupplyOrganization(counterparty as SupplyOrganization, value)
      return
    }

    await selectClient(counterparty, value)
  }

  async function selectClient(client: Client, label: string) {
    setResolvingCounterparty(true)
    setError(null)

    try {
      const nextAgreements = client.NetUid
        ? await getIncomeCashflowClientAgreements(client.NetUid).catch(() => client.ClientAgreements || [])
        : client.ClientAgreements || []
      const nextOrganizations = pickOrganizationsByClientAgreements(organizations, nextAgreements)
      const nextOrganization = nextOrganizations[0] || organizations[0] || null
      const nextClientAgreements = nextOrganization ? filterClientAgreementsByOrganization(nextAgreements, nextOrganization) : nextAgreements
      const nextAgreement = nextClientAgreements[0] || null
      const nextRegister = selectDefaultRegister(paymentRegisters, nextOrganization, registerType)
      const nextCurrency = nextRegister?.PaymentCurrencyRegisters?.[0]?.Currency || null

      setSelectedClient({
        ...client,
        ClientAgreements: nextClientAgreements,
      })
      setSelectedSupplyOrganization(null)
      setClientAgreements(nextClientAgreements)
      setSupplyAgreements([])
      setAvailableOrganizations(nextOrganizations.length ? nextOrganizations : organizations)
      setForm((current) => ({
        ...current,
        counterpartySearch: label,
        organizationValue: nextOrganization ? getEntityValue(nextOrganization) : '',
        paymentRegisterValue: nextRegister ? getEntityValue(nextRegister) : '',
        selectedAgreementValue: nextAgreement?.Agreement ? getEntityValue(nextAgreement.Agreement) : '',
        selectedCurrencyValue: nextCurrency ? getEntityValue(nextCurrency) : '',
      }))
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : t('Не вдалося завантажити контрагента'))
    } finally {
      setResolvingCounterparty(false)
    }
  }

  async function selectSupplyOrganization(supplyOrganization: SupplyOrganization, label: string) {
    setResolvingCounterparty(true)
    setError(null)

    try {
      const nextAgreements = supplyOrganization.Id
        ? await getIncomeCashflowSupplyOrganizationAgreements(supplyOrganization.Id).catch(
            () => supplyOrganization.SupplyOrganizationAgreements || [],
          )
        : supplyOrganization.SupplyOrganizationAgreements || []
      const nextOrganizations = pickOrganizationsBySupplyAgreements(organizations, nextAgreements)
      const nextOrganization = nextOrganizations[0] || organizations[0] || null
      const nextSupplyAgreements = nextOrganization ? filterSupplyAgreementsByOrganization(nextAgreements, nextOrganization) : nextAgreements
      const nextAgreement = nextSupplyAgreements[0] || null
      const nextRegister = selectDefaultRegister(paymentRegisters, nextOrganization, registerType)
      const nextCurrency = nextRegister?.PaymentCurrencyRegisters?.[0]?.Currency || null

      setSelectedSupplyOrganization({
        ...supplyOrganization,
        SupplyOrganizationAgreements: nextSupplyAgreements,
      })
      setSelectedClient(null)
      setClientAgreements([])
      setSupplyAgreements(nextSupplyAgreements)
      setAvailableOrganizations(nextOrganizations.length ? nextOrganizations : organizations)
      setForm((current) => ({
        ...current,
        counterpartySearch: label,
        organizationValue: nextOrganization ? getEntityValue(nextOrganization) : '',
        paymentRegisterValue: nextRegister ? getEntityValue(nextRegister) : '',
        selectedAgreementValue: nextAgreement ? getEntityValue(nextAgreement) : '',
        selectedCurrencyValue: nextCurrency ? getEntityValue(nextCurrency) : '',
      }))
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : t('Не вдалося завантажити постачальника'))
    } finally {
      setResolvingCounterparty(false)
    }
  }

  function handleOrganizationChanged(value: string | null) {
    const organization = availableOrganizations.find((item) => getEntityValue(item) === value) || null
    const nextRegister = selectDefaultRegister(paymentRegisters, organization, registerType)
    const nextCurrency = nextRegister?.PaymentCurrencyRegisters?.[0]?.Currency || null

    if (isSupplierSearch) {
      const nextAgreements = organization
        ? filterSupplyAgreementsByOrganization(selectedSupplyOrganization?.SupplyOrganizationAgreements || [], organization)
        : []
      const nextAgreement = nextAgreements[0] || null

      setSupplyAgreements(nextAgreements)
      updateForm({
        organizationValue: value || '',
        paymentRegisterValue: nextRegister ? getEntityValue(nextRegister) : '',
        selectedAgreementValue: nextAgreement ? getEntityValue(nextAgreement) : '',
        selectedCurrencyValue: nextCurrency ? getEntityValue(nextCurrency) : '',
      })
      return
    }

    const sourceAgreements = selectedClient?.ClientAgreements || clientAgreements
    const nextClientAgreements = organization ? filterClientAgreementsByOrganization(sourceAgreements, organization) : []
    const nextAgreement = nextClientAgreements[0] || null

    setClientAgreements(nextClientAgreements)
    updateForm({
      organizationValue: value || '',
      paymentRegisterValue: nextRegister ? getEntityValue(nextRegister) : '',
      selectedAgreementValue: nextAgreement?.Agreement ? getEntityValue(nextAgreement.Agreement) : '',
      selectedCurrencyValue: nextCurrency ? getEntityValue(nextCurrency) : '',
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
      vatAmount: calculateVat(amount, form.vatRate),
    })
  }

  function handleVatRateChanged(value: string | number) {
    const vatRate = toNumber(value)

    updateForm({
      vatAmount: calculateVat(form.amount, vatRate),
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
      setError(t('Введіть значення статті грошових витрат'))
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateForm({
      activeMovement,
      amount: form.amount,
      isOtherOutcome,
      isSupplierSearch,
      selectedClient,
      selectedClientAgreement,
      selectedCurrency,
      selectedOrganization,
      selectedRegister,
      selectedSupplyAgreement,
      selectedSupplyOrganization,
      t,
    })

    if (validationError) {
      setError(validationError)
      return
    }

    const payload = buildOutcomePayload({
      form,
      isOtherOutcome,
      operationType,
      selectedClient,
      selectedClientAgreement,
      selectedCurrencyRegister: selectedCurrencyRegister as CreatePaymentCurrencyRegister,
      selectedMovement: activeMovement as PaymentMovement,
      selectedOrganization: selectedOrganization as Organization,
      selectedRegister: selectedRegister as CreatePaymentRegister,
      selectedSupplyAgreement,
      selectedSupplyOrganization,
    })

    setSaving(true)
    setError(null)

    try {
      await createOutgoingCashflowOrder(payload)
      onCreated()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити видатковий ордер'))
    } finally {
      setSaving(false)
    }
  }

  const title = getTitle(operationType, registerType, t)
  const balanceLabel = balanceLabelOf(selectedCurrencyRegister, t('Залишки'))
  const agreementBalance = getAgreementBalanceLabel({
    isSupplierSearch,
    selectedClientAgreement,
    selectedSupplyAgreement,
    t,
  })

  return (
    <Card withBorder radius="md" shadow="sm">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Group gap="xs">
                <Text fw={700} size="xl">
                  {title}
                </Text>
                <Badge color={registerType === PaymentRegisterType.Bank ? 'indigo' : 'green'} variant="light">
                  {registerType === PaymentRegisterType.Bank ? t('Банк') : t('Каса')}
                </Badge>
              </Group>
              <Text c="dimmed" size="sm">
                {t('Новий видатковий ордер по контрагенту або іншому списанню')}
              </Text>
            </div>

            <Group gap="xs">
              <SegmentedControl
                data={[
                  { label: t('Каса'), value: String(PaymentRegisterType.Cash) },
                  { label: t('Банк'), value: String(PaymentRegisterType.Bank) },
                ]}
                disabled={isLoading || isSaving}
                value={String(registerType)}
                onChange={handleRegisterTypeChanged}
              />
              <Button color="gray" leftSection={<IconArrowLeft size={16} />} type="button" variant="light" onClick={onCancel}>
                {t('Назад')}
              </Button>
              <Button
                color={CREATE_ACTION_COLOR}
                disabled={isLoading || isResolvingCounterparty || isSaving}
                leftSection={<IconDeviceFloppy size={16} />}
                loading={isSaving}
                type="submit"
              >
                {t('Створити')}
              </Button>
            </Group>
          </Group>

          <SegmentedControl data={operationOptions} disabled={isLoading || isSaving} value={String(operationType)} onChange={handleOperationChanged} />

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <SegmentedControl data={searchTypeOptions} disabled={isLoading || isSaving} value={String(form.searchType)} onChange={handleSearchTypeChanged} />
            <Autocomplete
              data={counterpartyOptions}
              disabled={isLoading || isSaving}
              label={t('Отримувач')}
              placeholder={t('Почніть вводити назву')}
              value={form.counterpartySearch}
              onChange={(value) => updateForm({ counterpartySearch: value })}
              onOptionSubmit={handleCounterpartySubmit}
            />
          </SimpleGrid>

          <Divider />

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
            <Select
              data={organizationOptions}
              disabled={!organizationOptions.length || isLoading || isSaving}
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
              description={balanceLabel || undefined}
              disabled={!selectedRegister || isLoading || isSaving}
              label={t('Валюта')}
              searchable
              value={form.selectedCurrencyValue || null}
              onChange={(value) => updateForm({ selectedCurrencyValue: value || '' })}
            />
            {!isOtherOutcome && (
              <Select
                data={agreementOptions}
                description={agreementBalance || undefined}
                disabled={!agreementOptions.length || isLoading || isSaving}
                label={t('Договір')}
                searchable
                value={form.selectedAgreementValue || null}
                onChange={(value) => updateForm({ selectedAgreementValue: value || '' })}
              />
            )}
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
              decimalScale={6}
              disabled={isLoading || isSaving}
              label={t('Курс')}
              min={0}
              value={form.exchangeRate}
              onChange={(value) => updateForm({ exchangeRate: toNumber(value) })}
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
          </SimpleGrid>

          <Group align="flex-end" gap="sm" grow wrap="nowrap">
            <Autocomplete
              data={movementOptions}
              disabled={isLoading || isSaving}
              label={t('Стаття руху коштів')}
              value={form.movementSearch}
              onChange={(value) => updateForm({ movementSearch: value, selectedMovementValue: '' })}
              onOptionSubmit={handleMovementSubmit}
            />
            <Button
              disabled={Boolean(activeMovement) || !form.movementSearch.trim() || isLoading || isSaving}
              leftSection={<IconPlus size={16} />}
              maw={220}
              type="button"
              variant="light"
              onClick={() => void handleCreateMovement()}
            >
              {t('Зберегти')}
            </Button>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TextInput
              disabled={isLoading || isSaving}
              label={t('Призначення платежу')}
              value={form.paymentPurpose}
              onChange={(event) => updateForm({ paymentPurpose: event.currentTarget.value })}
            />
            <Textarea
              disabled={isLoading || isSaving}
              label={t('Коментар')}
              minRows={2}
              value={form.comment}
              onChange={(event) => updateForm({ comment: event.currentTarget.value })}
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
        </Stack>
      </form>
    </Card>
  )
}

function createInitialForm(operationType: OutcomeOperationType, registerType: PaymentRegisterType): FormState {
  const now = new Date()

  return {
    amount: 0,
    comment: '',
    counterpartySearch: '',
    date: formatLocalDate(now),
    exchangeRate: 0,
    isAccounting: false,
    isManagementAccounting: true,
    movementSearch: '',
    operationType,
    organizationValue: '',
    paymentPurpose: '',
    paymentRegisterValue: '',
    registerType,
    searchType: getDefaultSearchType(operationType),
    selectedAgreementValue: '',
    selectedCurrencyValue: '',
    selectedMovementValue: '',
    time: toTimeValue(now),
    vatAmount: 0,
    vatRate: 0,
  }
}

function buildOutcomePayload({
  form,
  isOtherOutcome,
  operationType,
  selectedClient,
  selectedClientAgreement,
  selectedCurrencyRegister,
  selectedMovement,
  selectedOrganization,
  selectedRegister,
  selectedSupplyAgreement,
  selectedSupplyOrganization,
}: {
  form: FormState
  isOtherOutcome: boolean
  operationType: OutcomeOperationType
  selectedClient: Client | null
  selectedClientAgreement: ClientAgreement | null
  selectedCurrencyRegister: CreatePaymentCurrencyRegister
  selectedMovement: PaymentMovement
  selectedOrganization: Organization
  selectedRegister: CreatePaymentRegister
  selectedSupplyAgreement: SupplyOrganizationAgreement | null
  selectedSupplyOrganization: SupplyOrganization | null
}): OutcomePaymentOrderCreatePayload {
  const payload: OutcomePaymentOrderCreatePayload = {
    Amount: form.amount,
    Comment: form.comment.trim(),
    ExchangeRate: form.exchangeRate || undefined,
    FromDate: toIsoDateTime(form.date, form.time),
    IsAccounting: form.isAccounting,
    IsManagementAccounting: form.isManagementAccounting,
    IsUnderReport: false,
    OperationType: operationType,
    Organization: selectedOrganization,
    PaymentCurrencyRegister: selectedCurrencyRegister,
    PaymentMovementOperation: {
      PaymentMovement: selectedMovement,
    },
    PaymentPurpose: form.paymentPurpose.trim(),
    PaymentRegister: selectedRegister,
    VAT: form.vatAmount || 0,
    VatPercent: form.vatRate,
  }

  if (isOtherOutcome) {
    if (selectedSupplyOrganization && !selectedClient) {
      payload.ConsumableProductOrganization = selectedSupplyOrganization
    } else if (selectedClient && !selectedSupplyOrganization) {
      payload.Client = selectedClient
    }

    return payload
  }

  if (selectedSupplyOrganization) {
    payload.ConsumableProductOrganization = selectedSupplyOrganization
    payload.SupplyOrganizationAgreement = selectedSupplyAgreement || undefined
  } else if (selectedClient) {
    payload.ClientAgreement = selectedClientAgreement || undefined
  }

  return payload
}

function validateForm({
  activeMovement,
  amount,
  isOtherOutcome,
  isSupplierSearch,
  selectedClient,
  selectedClientAgreement,
  selectedCurrency,
  selectedOrganization,
  selectedRegister,
  selectedSupplyAgreement,
  selectedSupplyOrganization,
  t,
}: {
  activeMovement: PaymentMovement | null
  amount: number
  isOtherOutcome: boolean
  isSupplierSearch: boolean
  selectedClient: Client | null
  selectedClientAgreement: ClientAgreement | null
  selectedCurrency: Currency | null
  selectedOrganization: Organization | null
  selectedRegister: PaymentRegister | null
  selectedSupplyAgreement: SupplyOrganizationAgreement | null
  selectedSupplyOrganization: SupplyOrganization | null
  t: (value: string) => string
}): string | null {
  if (!amount || amount <= 0) {
    return t('Сума має бути більшою за нуль')
  }

  if (!activeMovement) {
    return t('Оберіть статтю руху коштів')
  }

  if (!isOtherOutcome && (isSupplierSearch ? !selectedSupplyOrganization : !selectedClient)) {
    return t('Оберіть отримувача')
  }

  if (!isOtherOutcome && (isSupplierSearch ? !selectedSupplyAgreement : !selectedClientAgreement)) {
    return t('Оберіть договір')
  }

  if (!selectedOrganization) {
    return t('Оберіть організацію')
  }

  if (!selectedRegister) {
    return t('Оберіть касу або рахунок')
  }

  if (!selectedCurrency) {
    return t('Оберіть валюту')
  }

  return null
}

function parseRegisterType(value: string | null): PaymentRegisterType {
  return value === String(PaymentRegisterType.Cash) ? PaymentRegisterType.Cash : PaymentRegisterType.Bank
}

function parseOperationType(value: string | null): OutcomeOperationType {
  if (value === String(OUTCOME_OPERATION_TYPE.BuyerReturn)) {
    return OUTCOME_OPERATION_TYPE.BuyerReturn
  }

  if (value === String(OUTCOME_OPERATION_TYPE.OtherOutcomeWithCounterparts)) {
    return OUTCOME_OPERATION_TYPE.OtherOutcomeWithCounterparts
  }

  if (value === String(OUTCOME_OPERATION_TYPE.OtherOutcome)) {
    return OUTCOME_OPERATION_TYPE.OtherOutcome
  }

  return OUTCOME_OPERATION_TYPE.PaymentToSupplier
}

function getTitle(operationType: OutcomeOperationType, registerType: PaymentRegisterType, t: (value: string) => string): string {
  const registerTitle = registerType === PaymentRegisterType.Bank ? t('банківський') : t('касовий')

  if (operationType === OUTCOME_OPERATION_TYPE.BuyerReturn) {
    return `${t('Повернення клієнту')}, ${registerTitle}`
  }

  if (operationType === OUTCOME_OPERATION_TYPE.OtherOutcomeWithCounterparts) {
    return `${t('Інші видатки з контрагентами')}, ${registerTitle}`
  }

  if (operationType === OUTCOME_OPERATION_TYPE.OtherOutcome) {
    return `${t('Інші видатки')}, ${registerTitle}`
  }

  return `${t('Оплата постачальнику')}, ${registerTitle}`
}

function getOperationOptions(t: (value: string) => string) {
  return [
    { label: t('Постачальнику'), value: String(OUTCOME_OPERATION_TYPE.PaymentToSupplier) },
    { label: t('Повернення клієнту'), value: String(OUTCOME_OPERATION_TYPE.BuyerReturn) },
    { label: t('Інші з контрагентами'), value: String(OUTCOME_OPERATION_TYPE.OtherOutcomeWithCounterparts) },
    { label: t('Інші кошти'), value: String(OUTCOME_OPERATION_TYPE.OtherOutcome) },
  ]
}

function getSearchTypeOptions(operationType: OutcomeOperationType, t: (value: string) => string) {
  if (operationType === OUTCOME_OPERATION_TYPE.BuyerReturn) {
    return [{ label: t('Клієнти'), value: String(IncomeCounterpartySearchType.Client) }]
  }

  if (operationType === OUTCOME_OPERATION_TYPE.PaymentToSupplier) {
    return [
      { label: t('Постачальники'), value: String(IncomeCounterpartySearchType.Supplier) },
      { label: t('Виробники'), value: String(IncomeCounterpartySearchType.Manufacturer) },
    ]
  }

  return [
    { label: t('Клієнти'), value: String(IncomeCounterpartySearchType.Client) },
    { label: t('Постачальники'), value: String(IncomeCounterpartySearchType.Supplier) },
    { label: t('Виробники'), value: String(IncomeCounterpartySearchType.Manufacturer) },
  ]
}

function getDefaultSearchType(operationType: OutcomeOperationType): IncomeCounterpartySearchType {
  if (operationType === OUTCOME_OPERATION_TYPE.PaymentToSupplier) {
    return IncomeCounterpartySearchType.Supplier
  }

  return IncomeCounterpartySearchType.Client
}

function pickOrganizationsByClientAgreements(organizations: Organization[], agreements: ClientAgreement[]) {
  const organizationIds = collectTruthyIds(
    agreements,
    (agreement) => agreement.Agreement?.OrganizationId || agreement.Agreement?.Organization?.Id,
  )

  return organizations.filter((organization) => organization.Id && organizationIds.has(organization.Id))
}

function pickOrganizationsBySupplyAgreements(organizations: Organization[], agreements: SupplyOrganizationAgreement[]) {
  const organizationIds = collectTruthyIds(agreements, (agreement) => agreement.Organization?.Id)

  return organizations.filter((organization) => organization.Id && organizationIds.has(organization.Id))
}

function collectTruthyIds<T>(items: T[], getId: (item: T) => number | undefined): Set<number> {
  const ids = new Set<number>()

  for (const item of items) {
    const id = getId(item)

    if (id) {
      ids.add(id)
    }
  }

  return ids
}

function filterClientAgreementsByOrganization(agreements: ClientAgreement[], organization: Organization): ClientAgreement[] {
  return agreements.filter(
    (agreement) => agreement.Agreement?.OrganizationId === organization.Id || agreement.Agreement?.Organization?.Id === organization.Id,
  )
}

function filterSupplyAgreementsByOrganization(
  agreements: SupplyOrganizationAgreement[],
  organization: Organization,
): SupplyOrganizationAgreement[] {
  return agreements.filter((agreement) => agreement.Organization?.Id === organization.Id)
}

function selectDefaultRegister(
  paymentRegisters: PaymentRegister[],
  organization: Organization | null,
  registerType: PaymentRegisterType,
): PaymentRegister | null {
  const organizationRegisters = paymentRegisters.filter((register) => matchesRegister(register, organization, registerType))

  return organizationRegisters.find((register) => register.IsMain) || organizationRegisters[0] || null
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

function getAgreementBalanceLabel({
  isSupplierSearch,
  selectedClientAgreement,
  selectedSupplyAgreement,
  t,
}: {
  isSupplierSearch: boolean
  selectedClientAgreement: ClientAgreement | null
  selectedSupplyAgreement: SupplyOrganizationAgreement | null
  t: (value: string) => string
}): string {
  if (isSupplierSearch && selectedSupplyAgreement && typeof selectedSupplyAgreement.CurrentAmount === 'number') {
    return `${t('Поточний договір')}: ${moneyFormatter.format(selectedSupplyAgreement.CurrentAmount)} ${selectedSupplyAgreement.Currency?.Code || ''}`
  }

  if (!isSupplierSearch && selectedClientAgreement && typeof selectedClientAgreement.CurrentAmount === 'number') {
    return `${t('Поточний договір')}: ${moneyFormatter.format(selectedClientAgreement.CurrentAmount)} ${selectedClientAgreement.Agreement?.Currency?.Code || ''}`
  }

  return ''
}
