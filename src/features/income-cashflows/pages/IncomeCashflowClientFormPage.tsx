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
  Table,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconDeviceFloppy, IconPlus } from '@tabler/icons-react'
import { type FormEvent, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  calculateIncomeCashflowExchange,
  createIncomeCashflow,
  createIncomeCashflowPaymentMovement,
  getIncomeCashflowClientAgreements,
  getIncomeCashflowClientDebtTotal,
  getIncomeCashflowOrganizations,
  getIncomeCashflowPaymentMovements,
  getIncomeCashflowSpecificExchangeRate,
  getIncomeCashflowSupplyOrganizationAgreements,
  searchIncomeCashflowClientPayers,
  searchIncomeCashflowCounterparties,
  searchIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentRegisters,
} from '../api/incomeCashflowsApi'
import type {
  Client,
  ClientAgreement,
  ClientDebtTotal,
  ClientInDebt,
  Currency,
  IncomePaymentOrder,
  IncomePaymentOrderSale,
  NamedEntity,
  Organization,
  OrganizationWithDefaults,
  PaymentCurrencyRegister,
  PaymentMovement,
  PaymentRegister,
  SupplyOrganization,
  SupplyOrganizationAgreement,
} from '../types'
import {
  IncomeCounterpartySearchType,
  IncomePaymentOperationType,
  IncomePaymentOrderType,
  PaymentRegisterType,
} from '../types'

type FormState = {
  amount: number
  autoAllocate: boolean
  calculatedValue: number
  comment: string
  counterpartySearch: string
  date: string
  debtAmounts: Record<string, number>
  entranceNumber: string
  exchangeRate: number
  isAccounting: boolean
  isManagementAccounting: boolean
  movementSearch: string
  organizationValue: string
  payerSearch: string
  paymentPurpose: string
  paymentRegisterValue: string
  searchType: IncomeCounterpartySearchType
  selectedAgreementValue: string
  selectedCurrencyValue: string
  selectedDebtValues: string[]
  selectedMovementValue: string
  time: string
  vatAmount: number
  vatRate: number
}

type SelectOption = {
  label: string
  value: string
}

type DebtSummary = {
  maxOverdueDays: number
  totalDebt: number
}

const INCOME_CASHFLOWS_PATH = '/accounting/income-cashflows'
const SEARCH_DEBOUNCE_MS = 300

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function IncomeCashflowClientFormPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const registerType = parseRegisterType(searchParams.get('type'))
  const operationType = parseOperationType(searchParams.get('operationType'))
  const [organizations, setOrganizations] = useValueState<OrganizationWithDefaults[]>([])
  const [availableOrganizations, setAvailableOrganizations] = useValueState<OrganizationWithDefaults[]>([])
  const [paymentRegisters, setPaymentRegisters] = useValueState<PaymentRegister[]>([])
  const [paymentMovements, setPaymentMovements] = useValueState<PaymentMovement[]>([])
  const [counterparties, setCounterparties] = useValueState<Client[]>([])
  const [payerClients, setPayerClients] = useValueState<Client[]>([])
  const [selectedClient, setSelectedClient] = useValueState<Client | null>(null)
  const [selectedSupplyOrganization, setSelectedSupplyOrganization] = useValueState<SupplyOrganization | null>(null)
  const [clientAgreements, setClientAgreements] = useValueState<ClientAgreement[]>([])
  const [supplyOrganizationAgreements, setSupplyOrganizationAgreements] = useValueState<SupplyOrganizationAgreement[]>([])
  const [clientDebtTotal, setClientDebtTotal] = useValueState<ClientDebtTotal | null>(null)
  const [form, setForm] = useValueState<FormState>(() => createInitialForm(operationType))
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isResolvingCounterparty, setResolvingCounterparty] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)

  const isSupplierSearch = form.searchType === IncomeCounterpartySearchType.Supplier
  const selectedOrganization = useMemo(
    () => availableOrganizations.find((organization) => getEntityValue(organization) === form.organizationValue) || null,
    [availableOrganizations, form.organizationValue],
  )
  const filteredPaymentRegisters = useMemo(
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
    () => supplyOrganizationAgreements.find((agreement) => getEntityValue(agreement) === form.selectedAgreementValue) || null,
    [form.selectedAgreementValue, supplyOrganizationAgreements],
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
  const visibleDebts = useMemo(() => {
    if (!selectedClient || !selectedClientAgreement?.Agreement) {
      return []
    }

    return filterClientDebts(selectedClient.ClientInDebts || [], selectedOrganization, selectedClientAgreement)
  }, [selectedClient, selectedClientAgreement, selectedOrganization])
  const debtSummary = useMemo(() => summarizeClientDebts(visibleDebts), [visibleDebts])
  const totalDebt = debtSummary.totalDebt
  const maxOverdueDays = debtSummary.maxOverdueDays
  const title = getTitle(operationType, registerType, t)
  const operationOptions = useMemo(() => getOperationOptions(registerType, t), [registerType, t])
  const searchTypeOptions = useMemo(() => getSearchTypeOptions(operationType, t), [operationType, t])
  const organizationOptions = useMemo(() => toEntityOptions(availableOrganizations), [availableOrganizations])
  const registerOptions = useMemo(() => toEntityOptions(filteredPaymentRegisters), [filteredPaymentRegisters])
  const currencyOptions = useMemo(() => toCurrencyOptions(selectedRegister), [selectedRegister])
  const agreementOptions = useMemo(
    () => (isSupplierSearch ? toSupplyAgreementOptions(supplyOrganizationAgreements) : toClientAgreementOptions(clientAgreements)),
    [clientAgreements, isSupplierSearch, supplyOrganizationAgreements],
  )
  const counterpartyOptions = useMemo(() => toUniqueLabels(counterparties), [counterparties])
  const payerOptions = useMemo(() => toUniqueLabels(payerClients), [payerClients])
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

        const defaultOrganization = (nextOrganizations[0] as OrganizationWithDefaults | undefined) || null
        const defaultRegister = selectDefaultRegister(nextRegisters, defaultOrganization, registerType)
        const defaultCurrency = defaultRegister?.PaymentCurrencyRegisters?.[0]?.Currency || null
        const defaultMovement = nextMovements.find((movement) => movement.OperationName === 'Оплата покупця') || nextMovements[0] || null

        setOrganizations(nextOrganizations as OrganizationWithDefaults[])
        setAvailableOrganizations(nextOrganizations as OrganizationWithDefaults[])
        setPaymentRegisters(nextRegisters)
        setPaymentMovements(nextMovements)
        setForm(() => ({
          ...createInitialForm(operationType),
          organizationValue: defaultOrganization ? getEntityValue(defaultOrganization) : '',
          paymentRegisterValue: defaultRegister ? getEntityValue(defaultRegister) : '',
          selectedCurrencyValue: defaultCurrency ? getEntityValue(defaultCurrency) : '',
          selectedMovementValue: defaultMovement ? getEntityValue(defaultMovement) : '',
          movementSearch: defaultMovement?.OperationName || '',
        }))
        setSelectedClient(null)
        setSelectedSupplyOrganization(null)
        setClientAgreements([])
        setSupplyOrganizationAgreements([])
        setClientDebtTotal(null)
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
  }, [
    operationType,
    registerType,
    setAvailableOrganizations,
    setClientAgreements,
    setClientDebtTotal,
    setError,
    setForm,
    setLoading,
    setOrganizations,
    setPaymentMovements,
    setPaymentRegisters,
    setSelectedClient,
    setSelectedSupplyOrganization,
    setSupplyOrganizationAgreements,
    t,
  ])

  useEffect(() => {
    const value = form.counterpartySearch.trim()
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        setCounterparties([])
        return
      }

      void searchIncomeCashflowCounterparties(value, form.searchType).then(setCounterparties).catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [form.counterpartySearch, form.searchType, setCounterparties])

  useEffect(() => {
    if (operationType !== IncomePaymentOperationType.ClientPayment) {
      return
    }

    const value = form.payerSearch.trim()
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        setPayerClients([])
        return
      }

      void searchIncomeCashflowClientPayers(value).then(setPayerClients).catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [form.payerSearch, operationType, setPayerClients])

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

  useEffect(() => {
    const amount = form.amount
    const fromCurrencyId = selectedCurrency?.Id
    const toCurrencyId = agreementCurrency?.Id

    if (!amount || !fromCurrencyId || !toCurrencyId) {
      setForm((current) => ({ ...current, calculatedValue: 0 }))
      return
    }

    let cancelled = false

    void calculateIncomeCashflowExchange({
      amount,
      exchangeRate: form.exchangeRate || undefined,
      fromCurrencyId,
      toCurrencyId,
    })
      .then((calculation) => {
        if (!cancelled) {
          setForm((current) => ({ ...current, calculatedValue: calculation?.ConvertedAmount || 0 }))
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [agreementCurrency?.Id, form.amount, form.exchangeRate, selectedCurrency?.Id, setForm])

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function handleRegisterTypeChanged(value: string) {
    navigate(`${INCOME_CASHFLOWS_PATH}/new/client?type=${value}&operationType=${operationType}`, { replace: true })
  }

  function handleOperationChanged(value: string) {
    navigate(`${INCOME_CASHFLOWS_PATH}/new/client?type=${registerType}&operationType=${value}`, { replace: true })
  }

  function handleSearchTypeChanged(value: string) {
    updateForm({
      counterpartySearch: '',
      payerSearch: '',
      searchType: Number(value) as IncomeCounterpartySearchType,
    })
    resetCounterpartyState()
  }

  function resetCounterpartyState() {
    setCounterparties([])
    setPayerClients([])
    setSelectedClient(null)
    setSelectedSupplyOrganization(null)
    setClientAgreements([])
    setSupplyOrganizationAgreements([])
    setClientDebtTotal(null)
    setAvailableOrganizations(organizations)
    setForm((current) => ({
      ...current,
      debtAmounts: {},
      selectedAgreementValue: '',
      selectedDebtValues: [],
    }))
  }

  async function handleCounterpartySubmit(value: string) {
    const counterparty = [...counterparties, ...payerClients].find((item) => getEntityName(item) === value)

    if (!counterparty) {
      return
    }

    if (form.searchType === IncomeCounterpartySearchType.Supplier) {
      await selectSupplyOrganization(counterparty as SupplyOrganization, value)
    } else {
      await selectClient(counterparty, value)
    }
  }

  async function selectClient(client: Client, label: string) {
    const clientNetId = client.NetUid

    setResolvingCounterparty(true)
    setError(null)

    try {
      const [nextAgreements, nextDebtTotal] = await Promise.all([
        clientNetId ? getIncomeCashflowClientAgreements(clientNetId).catch(() => client.ClientAgreements || []) : Promise.resolve(client.ClientAgreements || []),
        clientNetId ? getIncomeCashflowClientDebtTotal(clientNetId).catch(() => null) : Promise.resolve(null),
      ])
      const debts = collectClientDebts(client, nextAgreements)
      const nextOrganizations = pickOrganizationsByClientAgreements(organizations, nextAgreements)
      const nextOrganization = nextOrganizations[0] || organizations[0] || null
      const nextClientAgreements = nextOrganization ? filterClientAgreementsByOrganization(nextAgreements, nextOrganization) : nextAgreements
      const nextAgreement = selectDefaultClientAgreement(nextClientAgreements)
      const nextRegister = selectDefaultRegister(paymentRegisters, nextOrganization, registerType)
      const nextCurrency = nextRegister?.PaymentCurrencyRegisters?.[0]?.Currency || null

      setSelectedClient({
        ...client,
        ClientAgreements: nextClientAgreements,
        ClientInDebts: filterClientDebts(debts, nextOrganization, nextAgreement),
      })
      setSelectedSupplyOrganization(null)
      setClientAgreements(nextClientAgreements)
      setSupplyOrganizationAgreements([])
      setAvailableOrganizations(nextOrganizations.length ? nextOrganizations : organizations)
      setClientDebtTotal(nextDebtTotal)
      setForm((current) => ({
        ...current,
        counterpartySearch: label,
        debtAmounts: {},
        organizationValue: nextOrganization ? getEntityValue(nextOrganization) : '',
        paymentRegisterValue: nextRegister ? getEntityValue(nextRegister) : '',
        selectedAgreementValue: nextAgreement?.Agreement ? getEntityValue(nextAgreement.Agreement) : '',
        selectedCurrencyValue: nextCurrency ? getEntityValue(nextCurrency) : '',
        selectedDebtValues: [],
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
      setSupplyOrganizationAgreements(nextSupplyAgreements)
      setAvailableOrganizations(nextOrganizations.length ? nextOrganizations : organizations)
      setClientDebtTotal(null)
      setForm((current) => ({
        ...current,
        counterpartySearch: label,
        debtAmounts: {},
        organizationValue: nextOrganization ? getEntityValue(nextOrganization) : '',
        paymentRegisterValue: nextRegister ? getEntityValue(nextRegister) : '',
        selectedAgreementValue: nextAgreement ? getEntityValue(nextAgreement) : '',
        selectedCurrencyValue: nextCurrency ? getEntityValue(nextCurrency) : '',
        selectedDebtValues: [],
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
      const nextAgreements = organization ? filterSupplyAgreementsByOrganization(selectedSupplyOrganization?.SupplyOrganizationAgreements || [], organization) : []
      const nextAgreement = nextAgreements[0] || null

      setSupplyOrganizationAgreements(nextAgreements)
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
    const nextAgreement = selectDefaultClientAgreement(nextClientAgreements)
    const nextDebts = filterClientDebts(collectClientDebts(selectedClient, sourceAgreements), organization, nextAgreement)

    setClientAgreements(nextClientAgreements)
    setSelectedClient((current) => (current ? { ...current, ClientInDebts: nextDebts } : current))
    updateForm({
      debtAmounts: {},
      organizationValue: value || '',
      paymentRegisterValue: nextRegister ? getEntityValue(nextRegister) : '',
      selectedAgreementValue: nextAgreement?.Agreement ? getEntityValue(nextAgreement.Agreement) : '',
      selectedCurrencyValue: nextCurrency ? getEntityValue(nextCurrency) : '',
      selectedDebtValues: [],
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

  function handleAgreementChanged(value: string | null) {
    if (isSupplierSearch) {
      updateForm({
        selectedAgreementValue: value || '',
      })
      return
    }

    const agreement = clientAgreements.find((item) => getEntityValue(item.Agreement) === value) || null
    const debts = filterClientDebts(collectClientDebts(selectedClient, clientAgreements), selectedOrganization, agreement)

    setSelectedClient((current) => (current ? { ...current, ClientInDebts: debts } : current))
    updateForm({
      debtAmounts: {},
      selectedAgreementValue: value || '',
      selectedDebtValues: [],
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

  function handleDebtChecked(debt: ClientInDebt, checked: boolean) {
    const debtValue = getDebtValue(debt)
    const selectedDebtValues = checked
      ? Array.from(new Set([...form.selectedDebtValues, debtValue]))
      : form.selectedDebtValues.filter((value) => value !== debtValue)

    updateForm({
      selectedDebtValues,
    })
  }

  function handleDebtAmountChanged(debt: ClientInDebt, value: string | number) {
    const debtValue = getDebtValue(debt)

    updateForm({
      debtAmounts: {
        ...form.debtAmounts,
        [debtValue]: toNumber(value),
      },
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateForm({
      activeMovement,
      amount: form.amount,
      isSupplierSearch,
      selectedClient,
      selectedCurrency,
      selectedOrganization,
      selectedRegister,
      selectedSupplyOrganization,
      t,
    }) || validateDebtSelection({
      autoAllocate: form.autoAllocate,
      debtAmounts: form.debtAmounts,
      isSupplierSearch,
      operationType,
      selectedDebtValues: form.selectedDebtValues,
      t,
      visibleDebts,
    })

    if (validationError) {
      setError(validationError)
      return
    }

    const payload = buildIncomePaymentOrder({
      debts: visibleDebts,
      form,
      isSupplierSearch,
      operationType,
      registerType,
      selectedClient,
      selectedClientAgreement,
      selectedCurrency: selectedCurrency as Currency,
      selectedCurrencyRegister: selectedCurrencyRegister as PaymentCurrencyRegister,
      selectedMovement: activeMovement as PaymentMovement,
      selectedOrganization: selectedOrganization as Organization,
      selectedRegister: selectedRegister as PaymentRegister,
      selectedSupplyAgreement,
      selectedSupplyOrganization,
    })

    setSaving(true)
    setError(null)

    try {
      await createIncomeCashflow(payload, form.autoAllocate)
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
      size="wide"
      title={title}
      onClose={() => navigate(INCOME_CASHFLOWS_PATH)}
      footer={
        <Button
          color={CREATE_ACTION_COLOR}
          disabled={isLoading || isResolvingCounterparty || isSaving}
          form="income-cashflow-client-form"
          leftSection={<IconDeviceFloppy size={16} />}
          loading={isSaving}
          type="submit"
        >
          {t('Зберегти')}
        </Button>
      }
    >
      <form id="income-cashflow-client-form" onSubmit={handleSubmit}>
        <Stack gap="md">
          <Group justify="flex-end" gap="xs" wrap="wrap">
            <SegmentedControl
              data={[
                { label: t('Каса'), value: String(PaymentRegisterType.Cash) },
                { label: t('Банк'), value: String(PaymentRegisterType.Bank) },
              ]}
              disabled={isLoading || isSaving}
              value={String(registerType)}
              onChange={handleRegisterTypeChanged}
            />
          </Group>

          <Group gap="xs">
            <Badge color={registerType === PaymentRegisterType.Bank ? 'indigo' : 'green'} variant="light">
              {registerType === PaymentRegisterType.Bank ? t('Банк') : t('Каса')}
            </Badge>
            <Text c="dimmed" size="sm">
              {t('Новий прибутковий ордер по контрагенту')}
            </Text>
          </Group>

          <SegmentedControl data={operationOptions} disabled={isLoading || isSaving} value={String(operationType)} onChange={handleOperationChanged} />

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          {operationType === IncomePaymentOperationType.ClientPayment && (
            <Autocomplete
              data={payerOptions}
              disabled={isLoading || isSaving}
              label={t('Пошук за платниками')}
              placeholder={t('Почніть вводити платника')}
              value={form.payerSearch}
              onChange={(value) => updateForm({ payerSearch: value })}
              onOptionSubmit={handleCounterpartySubmit}
            />
          )}

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <SegmentedControl data={searchTypeOptions} disabled={isLoading || isSaving} value={String(form.searchType)} onChange={handleSearchTypeChanged} />
            <Autocomplete
              data={counterpartyOptions}
              disabled={isLoading || isSaving}
              label={t('Контрагент')}
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
              label={t('Вхідний номер')}
              value={form.entranceNumber}
              onChange={(event) => updateForm({ entranceNumber: event.currentTarget.value })}
            />
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
              disabled={!selectedRegister || isLoading || isSaving}
              label={t('Валюта')}
              searchable
              value={form.selectedCurrencyValue || null}
              onChange={(value) => updateForm({ selectedCurrencyValue: value || '' })}
            />
            <Select
              data={agreementOptions}
              disabled={!agreementOptions.length || isLoading || isSaving}
              label={t('Договір')}
              searchable
              value={form.selectedAgreementValue || null}
              onChange={handleAgreementChanged}
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
              leftSection={<IconPlus size={16} />}
              mt={24}
              type="button"
              variant="light"
              onClick={() => void handleCreateMovement()}
            >
              {t('Створити статтю')}
            </Button>
          </SimpleGrid>

          {form.amount > 0 && agreementCurrency && selectedCurrency && (
            <Group gap="xs">
              <Badge color="violet" variant="light">
                {t('Зарахування')}: {formatMoney(form.calculatedValue || form.amount)} {agreementCurrency.Code || agreementCurrency.Name}
              </Badge>
              <Badge color="gray" variant="light">
                {selectedCurrency.Code || selectedCurrency.Name} → {agreementCurrency.Code || agreementCurrency.Name}
              </Badge>
            </Group>
          )}

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

          {!isSupplierSearch && selectedClient && (
            <Stack gap="sm">
              <Group justify="space-between" wrap="wrap">
                <div>
                  <Text fw={700}>{t('Борги та рахунки клієнта')}</Text>
                  <Text c="dimmed" size="sm">
                    {getEntityName(selectedClient)}
                  </Text>
                </div>
                <Group gap="xs">
                  {maxOverdueDays > 0 && (
                    <Badge color="red" variant="light">
                      {t('Прострочено')}: {maxOverdueDays} {t('днів')}
                    </Badge>
                  )}
                  {clientDebtTotal?.TotalEuro ? (
                    <Badge color="gray" variant="light">
                      {t('Борг EUR')}: {formatMoney(clientDebtTotal.TotalEuro)}
                    </Badge>
                  ) : null}
                  {clientDebtTotal?.TotalLocal ? (
                    <Badge color="gray" variant="light">
                      {t('Борг UAH')}: {formatMoney(clientDebtTotal.TotalLocal)}
                    </Badge>
                  ) : null}
                  <Badge color="violet" variant="light">
                    {t('Поточний договір')}: {formatMoney(selectedClientAgreement?.CurrentAmount)}
                  </Badge>
                  <Badge color="violet" variant="light">
                    {t('Борги по договору')}: {formatMoney(totalDebt)}
                  </Badge>
                </Group>
              </Group>

              {visibleDebts.length > 0 ? (
                <>
                  <Checkbox
                    checked={form.autoAllocate}
                    disabled={isSaving}
                    label={t('Автоматично рознести оплату по боргах')}
                    onChange={(event) => updateForm({ autoAllocate: event.currentTarget.checked })}
                  />
                  <Table.ScrollContainer minWidth={860}>
                    <Table highlightOnHover verticalSpacing="xs">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th w={58}>{t('Вибір')}</Table.Th>
                          <Table.Th>{t('Рахунок')}</Table.Th>
                          <Table.Th>{t('Дата')}</Table.Th>
                          <Table.Th>{t('Днів')}</Table.Th>
                          <Table.Th>{t('Борг')}</Table.Th>
                          <Table.Th>{t('Сума платежу')}</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {visibleDebts.map((debt) => {
                          const debtValue = getDebtValue(debt)
                          const checked = form.selectedDebtValues.includes(debtValue)

                          return (
                            <Table.Tr key={debtValue}>
                              <Table.Td>
                                <Checkbox
                                  aria-label={t('Вибрати борг')}
                                  checked={checked}
                                  disabled={form.autoAllocate || isSaving}
                                  onChange={(event) => handleDebtChecked(debt, event.currentTarget.checked)}
                                />
                              </Table.Td>
                              <Table.Td>{getDebtDocumentNumber(debt)}</Table.Td>
                              <Table.Td>{formatDate(getDebtDate(debt))}</Table.Td>
                              <Table.Td>{debt.Debt?.Days || 0}</Table.Td>
                              <Table.Td>{formatMoney(readDebtTotal(debt))}</Table.Td>
                              <Table.Td>
                                <NumberInput
                                  allowNegative={false}
                                  decimalScale={2}
                                  disabled={form.autoAllocate || !checked || isSaving}
                                  min={0}
                                  value={form.debtAmounts[debtValue] || 0}
                                  onChange={(value) => handleDebtAmountChanged(debt, value)}
                                />
                              </Table.Td>
                            </Table.Tr>
                          )
                        })}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </>
              ) : (
                <Text c="dimmed" size="sm">
                  {t('По вибраному договору боргів немає')}
                </Text>
              )}
            </Stack>
          )}
        </Stack>
      </form>
    </AppDrawer>
  )
}

function createInitialForm(operationType: IncomePaymentOperationType): FormState {
  const now = new Date()

  return {
    amount: 0,
    autoAllocate: false,
    calculatedValue: 0,
    comment: '',
    counterpartySearch: '',
    date: formatLocalDate(now),
    debtAmounts: {},
    entranceNumber: '',
    exchangeRate: 0,
    isAccounting: false,
    isManagementAccounting: true,
    movementSearch: '',
    organizationValue: '',
    payerSearch: '',
    paymentPurpose: '',
    paymentRegisterValue: '',
    searchType: operationType === IncomePaymentOperationType.SupplierReturn ? IncomeCounterpartySearchType.Supplier : IncomeCounterpartySearchType.Client,
    selectedAgreementValue: '',
    selectedCurrencyValue: '',
    selectedDebtValues: [],
    selectedMovementValue: '',
    time: toTimeValue(now),
    vatAmount: 0,
    vatRate: 0,
  }
}

function buildIncomePaymentOrder({
  debts,
  form,
  isSupplierSearch,
  operationType,
  registerType,
  selectedClient,
  selectedClientAgreement,
  selectedCurrency,
  selectedCurrencyRegister,
  selectedMovement,
  selectedOrganization,
  selectedRegister,
  selectedSupplyAgreement,
  selectedSupplyOrganization,
}: {
  debts: ClientInDebt[]
  form: FormState
  isSupplierSearch: boolean
  operationType: IncomePaymentOperationType
  registerType: PaymentRegisterType
  selectedClient: Client | null
  selectedClientAgreement: ClientAgreement | null
  selectedCurrency: Currency
  selectedCurrencyRegister: PaymentCurrencyRegister
  selectedMovement: PaymentMovement
  selectedOrganization: Organization
  selectedRegister: PaymentRegister
  selectedSupplyAgreement: SupplyOrganizationAgreement | null
  selectedSupplyOrganization: SupplyOrganization | null
}): IncomePaymentOrder {
  const selectedClientDebts = form.autoAllocate ? debts : pickSelectedDebts(debts, form)
  const order: IncomePaymentOrder = {
    Amount: form.amount,
    ArrivalNumber: form.entranceNumber.trim(),
    Comment: form.comment.trim(),
    Currency: selectedCurrency,
    ExchangeRate: form.exchangeRate || undefined,
    FromDate: toIsoDateTime(form.date, form.time),
    IncomeCashOrderType: registerType === PaymentRegisterType.Cash ? IncomePaymentOrderType.Cash : IncomePaymentOrderType.Transfer,
    IncomePaymentOrderSales: isSupplierSearch ? [] : buildIncomePaymentOrderSales(debts, form),
    IsAccounting: form.isAccounting,
    IsManagementAccounting: form.isManagementAccounting,
    OperationType: String(operationType),
    Organization: selectedOrganization,
    PaymentCurrencyRegister: selectedCurrencyRegister,
    PaymentMovementOperation: {
      PaymentMovement: selectedMovement,
    },
    PaymentPurpose: form.paymentPurpose.trim(),
    PaymentRegister: selectedRegister,
    VAT: form.vatAmount,
    VatPercent: form.vatRate,
  }

  if (isSupplierSearch && selectedSupplyOrganization) {
    order.SupplyOrganization = selectedSupplyOrganization
    order.SupplyOrganizationAgreement = selectedSupplyAgreement || undefined
  } else if (selectedClient) {
    order.Client = {
      ...selectedClient,
      ClientAgreements: selectedClientAgreement ? [selectedClientAgreement] : selectedClient.ClientAgreements,
      ClientInDebts: selectedClientDebts,
    }
    order.ClientAgreement = selectedClientAgreement || undefined
  }

  return order
}

function summarizeClientDebts(debts: ClientInDebt[]): DebtSummary {
  const summary: DebtSummary = {
    maxOverdueDays: 0,
    totalDebt: 0,
  }

  for (const debt of debts) {
    summary.totalDebt += readDebtTotal(debt)
    summary.maxOverdueDays = Math.max(summary.maxOverdueDays, debt.Debt?.Days || 0)
  }

  return summary
}

function buildIncomePaymentOrderSales(debts: ClientInDebt[], form: FormState): IncomePaymentOrderSale[] {
  if (form.autoAllocate) {
    return []
  }

  return pickSelectedDebts(debts, form).map((debt) => {
    const debtValue = getDebtValue(debt)

    return {
      Amount: form.debtAmounts[debtValue] || 0,
      ReSale: debt.ReSale || undefined,
      Sale: debt.Sale || undefined,
    }
  })
}

function pickSelectedDebts(debts: ClientInDebt[], form: FormState): ClientInDebt[] {
  if (!form.selectedDebtValues.length) {
    return []
  }

  const selectedDebtValueSet = new Set(form.selectedDebtValues)

  return debts.filter((debt) => selectedDebtValueSet.has(getDebtValue(debt)))
}

function validateForm({
  activeMovement,
  amount,
  isSupplierSearch,
  selectedClient,
  selectedCurrency,
  selectedOrganization,
  selectedRegister,
  selectedSupplyOrganization,
  t,
}: {
  activeMovement: PaymentMovement | null
  amount: number
  isSupplierSearch: boolean
  selectedClient: Client | null
  selectedCurrency: Currency | null
  selectedOrganization: Organization | null
  selectedRegister: PaymentRegister | null
  selectedSupplyOrganization: SupplyOrganization | null
  t: (value: string) => string
}): string | null {
  if (!amount || amount <= 0) {
    return t('Сума має бути більшою за нуль')
  }

  if (!activeMovement) {
    return t('Оберіть статтю руху коштів')
  }

  if (isSupplierSearch ? !selectedSupplyOrganization : !selectedClient) {
    return t('Оберіть контрагента')
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

function validateDebtSelection({
  autoAllocate,
  debtAmounts,
  isSupplierSearch,
  operationType,
  selectedDebtValues,
  t,
  visibleDebts,
}: {
  autoAllocate: boolean
  debtAmounts: Record<string, number>
  isSupplierSearch: boolean
  operationType: IncomePaymentOperationType
  selectedDebtValues: string[]
  t: (value: string) => string
  visibleDebts: ClientInDebt[]
}): string | null {
  if (isSupplierSearch || operationType !== IncomePaymentOperationType.ClientPayment || autoAllocate || !visibleDebts.length) {
    return null
  }

  if (!selectedDebtValues.length) {
    return t('Оберіть рахунок для оплати')
  }

  const visibleDebtValues = new Set(visibleDebts.map(getDebtValue))
  const totalPayment = selectedDebtValues
    .filter((debtValue) => visibleDebtValues.has(debtValue))
    .reduce((sum, debtValue) => sum + (debtAmounts[debtValue] || 0), 0)

  return totalPayment > 0 ? null : t('Сума платежу по рахунках має бути більшою за нуль')
}

function parseRegisterType(value: string | null): PaymentRegisterType {
  return value === String(PaymentRegisterType.Bank) ? PaymentRegisterType.Bank : PaymentRegisterType.Cash
}

function parseOperationType(value: string | null): IncomePaymentOperationType {
  if (value === String(IncomePaymentOperationType.SupplierReturn)) {
    return IncomePaymentOperationType.SupplierReturn
  }

  if (value === String(IncomePaymentOperationType.OtherAccountingWithCounterparts)) {
    return IncomePaymentOperationType.OtherAccountingWithCounterparts
  }

  return IncomePaymentOperationType.ClientPayment
}

function getTitle(operationType: IncomePaymentOperationType, registerType: PaymentRegisterType, t: (value: string) => string): string {
  const registerTitle = registerType === PaymentRegisterType.Bank ? t('банківський') : t('касовий')

  if (operationType === IncomePaymentOperationType.SupplierReturn) {
    return `${t('Повернення від постачальника')}, ${registerTitle}`
  }

  if (operationType === IncomePaymentOperationType.OtherAccountingWithCounterparts) {
    return `${t('Інші надходження з контрагентами')}, ${registerTitle}`
  }

  return `${t('Оплата покупця')}, ${registerTitle}`
}

function getOperationOptions(registerType: PaymentRegisterType, t: (value: string) => string) {
  const suffix = registerType === PaymentRegisterType.Bank ? t('банк') : t('каса')

  return [
    { label: `${t('Оплата покупця')} (${suffix})`, value: String(IncomePaymentOperationType.ClientPayment) },
    { label: `${t('Повернення постачальника')} (${suffix})`, value: String(IncomePaymentOperationType.SupplierReturn) },
    { label: `${t('Інші з контрагентами')} (${suffix})`, value: String(IncomePaymentOperationType.OtherAccountingWithCounterparts) },
  ]
}

function getSearchTypeOptions(operationType: IncomePaymentOperationType, t: (value: string) => string) {
  if (operationType === IncomePaymentOperationType.ClientPayment) {
    return [{ label: t('Клієнти'), value: String(IncomeCounterpartySearchType.Client) }]
  }

  if (operationType === IncomePaymentOperationType.SupplierReturn) {
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

function pickOrganizationsByClientAgreements(organizations: OrganizationWithDefaults[], agreements: ClientAgreement[]) {
  const organizationIds = collectTruthyIds(agreements, (agreement) => agreement.Agreement?.OrganizationId)

  return organizations.filter((organization) => organization.Id && organizationIds.has(organization.Id))
}

function pickOrganizationsBySupplyAgreements(organizations: OrganizationWithDefaults[], agreements: SupplyOrganizationAgreement[]) {
  const organizationIds = collectTruthyIds(agreements, (agreement) => agreement.Organization?.Id)

  return organizations.filter((organization) => organization.Id && organizationIds.has(organization.Id))
}

function collectTruthyIds<T>(items: T[], readId: (item: T) => number | undefined): Set<number> {
  const ids = new Set<number>()

  for (const item of items) {
    const id = readId(item)

    if (id) {
      ids.add(id)
    }
  }

  return ids
}

function filterClientAgreementsByOrganization(agreements: ClientAgreement[], organization: Organization): ClientAgreement[] {
  return agreements.filter((agreement) => agreement.Agreement?.OrganizationId === organization.Id)
}

function filterSupplyAgreementsByOrganization(
  agreements: SupplyOrganizationAgreement[],
  organization: Organization,
): SupplyOrganizationAgreement[] {
  return agreements.filter((agreement) => agreement.Organization?.Id === organization.Id)
}

function selectDefaultClientAgreement(agreements: ClientAgreement[]): ClientAgreement | null {
  const agreementsWithDebt = agreements.filter((agreement) => (agreement.Agreement?.ClientInDebts || []).length > 0)

  return agreementsWithDebt.length === 1 ? agreementsWithDebt[0] : agreements[0] || null
}

function collectClientDebts(client: Client | null, agreements: ClientAgreement[]): ClientInDebt[] {
  if (client?.ClientInDebts?.length) {
    return client.ClientInDebts
  }

  const debts: ClientInDebt[] = []

  for (const agreement of agreements) {
    for (const debt of agreement.Agreement?.ClientInDebts || []) {
      debts.push(debt)
    }
  }

  return debts
}

function filterClientDebts(
  debts: ClientInDebt[],
  organization: Organization | null,
  clientAgreement: ClientAgreement | null,
): ClientInDebt[] {
  if (!organization || !clientAgreement?.Agreement) {
    return []
  }

  return debts.filter(
    (debt) =>
      debt.AgreementId === clientAgreement.AgreementId &&
      (debt.Agreement?.OrganizationId === organization.Id || debt.Agreement?.Organization?.Id === organization.Id),
  )
}

function selectDefaultRegister(
  paymentRegisters: PaymentRegister[],
  organization: OrganizationWithDefaults | Organization | null,
  registerType: PaymentRegisterType,
): PaymentRegister | null {
  const mainRegister = (organization as OrganizationWithDefaults | null)?.MainPaymentRegister
  let firstRegister: PaymentRegister | null = null

  for (const register of paymentRegisters) {
    if (!matchesRegister(register, organization, registerType)) {
      continue
    }

    if (!firstRegister) {
      firstRegister = register
    }

    if (register.NetUid && register.NetUid === mainRegister?.NetUid) {
      return register
    }
  }

  return firstRegister
}

function matchesRegister(register: PaymentRegister, organization: OrganizationWithDefaults | Organization | null, registerType: PaymentRegisterType): boolean {
  if (Number(register.Type) !== registerType) {
    return false
  }

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

function toClientAgreementOptions(agreements: ClientAgreement[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const clientAgreement of agreements) {
    const agreement = clientAgreement.Agreement
    const currency = agreement?.Currency
    const value = getEntityValue(agreement)

    if (!value) {
      continue
    }

    options.push({
      label: joinTruthyParts([agreement?.Name || agreement?.Number || value, currency?.Code || currency?.Name]),
      value,
    })
  }

  return options
}

function toSupplyAgreementOptions(agreements: SupplyOrganizationAgreement[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const agreement of agreements) {
    const currency = agreement.Currency
    const value = getEntityValue(agreement)

    if (!value) {
      continue
    }

    options.push({
      label: joinTruthyParts([agreement.Name || agreement.Number || value, currency?.Code || currency?.Name]),
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

function getEntityValue(entity?: NamedEntity | null): string {
  return String(entity?.NetUid || entity?.Id || '')
}

function getEntityName(entity?: NamedEntity | null): string {
  return entity?.FullName || entity?.LastName || entity?.Name || entity?.OperationName || entity?.Code || entity?.Number || ''
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

function getDebtValue(debt: ClientInDebt): string {
  return String(debt.NetUid || debt.Id || debt.Sale?.NetUid || debt.ReSale?.NetUid || debt.Sale?.Id || debt.ReSale?.Id || '')
}

function getDebtDocumentNumber(debt: ClientInDebt): string {
  return debt.Sale?.SaleNumber?.Value || debt.ReSale?.SaleNumber?.Value || debt.Sale?.NetUid || debt.ReSale?.NetUid || '—'
}

function getDebtDate(debt: ClientInDebt): string | undefined {
  return debt.Sale?.ChangedToInvoice || debt.ReSale?.ChangedToInvoice || debt.Sale?.Created || debt.ReSale?.Created
}

function readDebtTotal(debt: ClientInDebt): number {
  return debt.Debt?.Total || debt.Sale?.TotalAmount || debt.ReSale?.TotalAmount || 0
}

function calculateVatAmount(amount: number, vatRate: number): number {
  if (!amount || !vatRate) {
    return 0
  }

  return Math.round((amount * vatRate * 100) / (100 + vatRate)) / 100
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

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '—'
}

function formatDate(value?: string): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateTimeFormatter.format(date)
}
