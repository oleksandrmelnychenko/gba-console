import {
  ActionIcon,
  Alert,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { ArrowLeft, CircleAlert, Plus, Save } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawerFooter } from '../../../shared/ui/AppDrawer'
import { SearchableSelect } from '../../../shared/ui/SearchableSelect'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  getAccountingOperationLabel,
} from '../../accounting/accountingOperationCatalog'
import { getUnpaidConsumableOrdersByOrganization } from '../../consumable-orders/api/consumableOrdersApi'
import type { ConsumablesOrder } from '../../consumable-orders/types'
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
import { createAutocompleteOptionSubmitGuard } from '../../income-cashflows/autocompleteOptionSubmitGuard'
import {
  INCOME_CASHFLOW_TEXT_LIMITS,
  validateIncomeCashflowContract,
  validateIncomeCashflowMovementName,
} from '../../income-cashflows/incomeCashflowFormValidation'
import { createLatestRequestGuard } from '../../income-cashflows/latestRequestGuard'
import {
  IncomeCounterpartySearchType,
  PaymentRegisterType,
  type Client,
  type ClientAgreement,
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
} from '../outgoingCreateTypes'
import { buildOutgoingPaymentGroupPayload } from '../outgoingPaymentGroupPayload'
import {
  getAllowedOutgoingCounterpartySearchTypes,
  getDefaultOutgoingCounterpartySearchType,
  getOutgoingPaymentGroupOperations,
  resolveOutgoingCounterpartyPayloadKind,
  validateOutgoingPaymentGroupForm,
} from '../outgoingPaymentGroupPolicy'
import {
  getOutgoingPaymentGroupTitle,
  parseOutgoingPaymentOperationType,
  parseOutgoingPaymentRegisterType,
} from '../outgoingPaymentGroupTitle'
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
import { SupplierUnpaidConsumableOrdersPicker } from './SupplierUnpaidConsumableOrdersPicker'
import {
  getConsumableOrdersRemainingAmount,
  getSelectedConsumableOrders,
} from './supplierUnpaidConsumableOrders'

type OutgoingPaymentGroupFormProps = {
  onCancel: () => void
  onCreated: () => void
  onTitleChange: (title: string) => void
}

const FORM_ID = 'outgoing-payment-group-form'

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

export function OutgoingPaymentGroupForm({
  onCancel,
  onCreated,
  onTitleChange,
}: OutgoingPaymentGroupFormProps) {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const initialOperationType =
    parseOutgoingPaymentOperationType(
      searchParams.get('operationType'),
    )
  const initialRegisterType =
    parseOutgoingPaymentRegisterType(searchParams.get('type'))
  const [organizations, setOrganizations] = useValueState<Organization[]>([])
  const [availableOrganizations, setAvailableOrganizations] = useValueState<Organization[]>([])
  const [paymentRegisters, setPaymentRegisters] = useValueState<PaymentRegister[]>([])
  const [paymentMovements, setPaymentMovements] = useValueState<PaymentMovement[]>([])
  const [counterparties, setCounterparties] = useValueState<Client[]>([])
  const [selectedClient, setSelectedClient] = useValueState<Client | null>(null)
  const [selectedSupplyOrganization, setSelectedSupplyOrganization] = useValueState<SupplyOrganization | null>(null)
  const [clientAgreements, setClientAgreements] = useValueState<ClientAgreement[]>([])
  const [supplyAgreements, setSupplyAgreements] = useValueState<SupplyOrganizationAgreement[]>([])
  const [unpaidConsumableOrders, setUnpaidConsumableOrders] = useValueState<ConsumablesOrder[]>([])
  const [selectedUnpaidOrderValues, setSelectedUnpaidOrderValues] = useValueState<string[]>([])
  const [form, setForm] = useValueState<FormState>(() => createInitialForm(initialOperationType, initialRegisterType))
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isLoadingUnpaidOrders, setLoadingUnpaidOrders] = useValueState(false)
  const [isResolvingCounterparty, setResolvingCounterparty] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [counterpartySelectionRequestGuard] = useState(
    () => createLatestRequestGuard<string>(),
  )
  const [counterpartyOptionSubmitGuard] = useState(
    createAutocompleteOptionSubmitGuard,
  )

  const operationType = form.operationType
  const registerType = form.registerType
  const isSupplierSearch =
    resolveOutgoingCounterpartyPayloadKind(
      operationType,
      form.searchType,
    ) === 'supplier'
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
  const selectedUnpaidOrders = useMemo(
    () => getSelectedConsumableOrders(unpaidConsumableOrders, selectedUnpaidOrderValues),
    [selectedUnpaidOrderValues, unpaidConsumableOrders],
  )
  const selectedUnpaidOrdersAmount = useMemo(
    () => getConsumableOrdersRemainingAmount(selectedUnpaidOrders),
    [selectedUnpaidOrders],
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
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        setCounterparties([])
        return
      }

      void searchIncomeCashflowCounterparties(value, form.searchType, controller.signal)
        .then((items) => {
          if (!cancelled) {
            setCounterparties(items)
          }
        })
        .catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [form.counterpartySearch, form.searchType, setCounterparties])

  useEffect(() => {
    const value = form.movementSearch.trim()
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchIncomeCashflowPaymentMovements(value)
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
    const organizationNetId = selectedSupplyOrganization?.NetUid || ''

    setSelectedUnpaidOrderValues([])

    if (!isSupplierSearch || !organizationNetId) {
      setUnpaidConsumableOrders([])
      return
    }

    let cancelled = false

    setLoadingUnpaidOrders(true)
    void getUnpaidConsumableOrdersByOrganization(organizationNetId)
      .then((orders) => {
        if (!cancelled) {
          setUnpaidConsumableOrders(orders)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUnpaidConsumableOrders([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingUnpaidOrders(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    isSupplierSearch,
    selectedSupplyOrganization?.NetUid,
    setLoadingUnpaidOrders,
    setSelectedUnpaidOrderValues,
    setUnpaidConsumableOrders,
  ])

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
    onTitleChange(
      getOutgoingPaymentGroupTitle(
        operationType,
        nextRegisterType,
        t,
      ),
    )
  }

  function handleOperationChanged(value: string) {
    const nextOperationType = Number(value) as OutcomeOperationType

    counterpartyOptionSubmitGuard.clear()
    counterpartySelectionRequestGuard.invalidate()
    setResolvingCounterparty(false)
    updateForm({
      counterpartySearch: '',
      operationType: nextOperationType,
      organizationValue: '',
      paymentRegisterValue: '',
      searchType: getDefaultOutgoingCounterpartySearchType(nextOperationType),
      selectedAgreementValue: '',
      selectedCurrencyValue: '',
    })
    setCounterparties([])
    setSelectedClient(null)
    setSelectedSupplyOrganization(null)
    setClientAgreements([])
    setSupplyAgreements([])
    setAvailableOrganizations(organizations)
    onTitleChange(
      getOutgoingPaymentGroupTitle(
        nextOperationType,
        registerType,
        t,
      ),
    )
  }

  function handleSearchTypeChanged(value: string) {
    const nextSearchType = Number(value) as IncomeCounterpartySearchType

    counterpartyOptionSubmitGuard.clear()
    counterpartySelectionRequestGuard.invalidate()
    setResolvingCounterparty(false)
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

  function handleCounterpartySearchChanged(value: string) {
    if (counterpartyOptionSubmitGuard.consumeChange(value)) {
      updateForm({ counterpartySearch: value })
      return
    }

    counterpartySelectionRequestGuard.invalidate()
    setResolvingCounterparty(false)
    setSelectedClient(null)
    setSelectedSupplyOrganization(null)
    setClientAgreements([])
    setSupplyAgreements([])
    setUnpaidConsumableOrders([])
    setSelectedUnpaidOrderValues([])
    setAvailableOrganizations(organizations)
    updateForm({
      counterpartySearch: value,
      selectedAgreementValue: '',
    })
  }

  async function handleCounterpartySubmit(value: string) {
    const counterparty = counterparties.find((item) => getEntityName(item) === value)

    if (!counterparty) {
      return
    }

    const payloadKind = resolveOutgoingCounterpartyPayloadKind(
      operationType,
      form.searchType,
    )

    if (payloadKind === 'supplier') {
      counterpartyOptionSubmitGuard.markSubmitted(value)
      await selectSupplyOrganization(counterparty as SupplyOrganization, value)
      return
    }

    if (payloadKind === 'client') {
      counterpartyOptionSubmitGuard.markSubmitted(value)
      await selectClient(counterparty, value)
    }
  }

  async function selectClient(client: Client, label: string) {
    const request = counterpartySelectionRequestGuard.start(
      `client:${getEntityValue(client)}`,
    )

    setResolvingCounterparty(true)
    setError(null)
    setSelectedClient(null)
    setSelectedSupplyOrganization(null)
    setClientAgreements([])
    setSupplyAgreements([])
    setForm((current) => ({
      ...current,
      counterpartySearch: label,
      selectedAgreementValue: '',
    }))

    try {
      const nextAgreements = client.NetUid
        ? await getIncomeCashflowClientAgreements(client.NetUid).catch(() => client.ClientAgreements || [])
        : client.ClientAgreements || []
      if (!counterpartySelectionRequestGuard.isCurrent(request)) {
        return
      }
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
      if (counterpartySelectionRequestGuard.isCurrent(request)) {
        setError(selectError instanceof Error ? selectError.message : t('Не вдалося завантажити контрагента'))
      }
    } finally {
      if (counterpartySelectionRequestGuard.finish(request)) {
        setResolvingCounterparty(false)
      }
    }
  }

  async function selectSupplyOrganization(supplyOrganization: SupplyOrganization, label: string) {
    const request = counterpartySelectionRequestGuard.start(
      `supplier:${getEntityValue(supplyOrganization)}`,
    )

    setResolvingCounterparty(true)
    setError(null)
    setSelectedClient(null)
    setSelectedSupplyOrganization(null)
    setClientAgreements([])
    setSupplyAgreements([])
    setForm((current) => ({
      ...current,
      counterpartySearch: label,
      selectedAgreementValue: '',
    }))

    try {
      const nextAgreements = supplyOrganization.Id
        ? await getIncomeCashflowSupplyOrganizationAgreements(supplyOrganization.Id).catch(
            () => supplyOrganization.SupplyOrganizationAgreements || [],
          )
        : supplyOrganization.SupplyOrganizationAgreements || []
      if (!counterpartySelectionRequestGuard.isCurrent(request)) {
        return
      }
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
      if (counterpartySelectionRequestGuard.isCurrent(request)) {
        setError(selectError instanceof Error ? selectError.message : t('Не вдалося завантажити постачальника'))
      }
    } finally {
      if (counterpartySelectionRequestGuard.finish(request)) {
        setResolvingCounterparty(false)
      }
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

  function handleUnpaidOrdersChanged(values: string[]) {
    const nextOrders = getSelectedConsumableOrders(unpaidConsumableOrders, values)
    const nextAmount = getConsumableOrdersRemainingAmount(nextOrders)

    setSelectedUnpaidOrderValues(values)

    if (nextAmount > 0) {
      updateForm({
        amount: nextAmount,
        vatAmount: calculateVat(nextAmount, form.vatRate),
      })
    }
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

    const validationError = validateIncomeCashflowMovementName(operationName, t)

    if (validationError) {
      setError(validationError)
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

    const validationError = validateOutgoingPaymentGroupForm({
      activeMovement,
      amount: form.amount,
      operationType,
      searchType: form.searchType,
      selectedClient,
      selectedClientAgreement,
      selectedCurrency,
      selectedOrganization,
      selectedRegister,
      selectedSupplyAgreement,
      selectedSupplyOrganization,
      t,
    }) || validateIncomeCashflowContract(
      {
        amount: form.amount,
        comment: form.comment,
        date: form.date,
        paymentPurpose: form.paymentPurpose,
        time: form.time,
        vatAmount: form.vatAmount,
        vatRate: form.vatRate,
      },
      t,
    )

    if (validationError) {
      setError(validationError)
      return
    }

    const payload = buildOutgoingPaymentGroupPayload({
      form,
      operationType,
      selectedClient,
      selectedClientAgreement,
      selectedCurrencyRegister: selectedCurrencyRegister as CreatePaymentCurrencyRegister,
      selectedMovement: activeMovement as PaymentMovement,
      selectedOrganization: selectedOrganization as Organization,
      selectedRegister: selectedRegister as CreatePaymentRegister,
      selectedSupplyAgreement,
      selectedSupplyOrganization,
      selectedUnpaidOrders: isSupplierSearch ? selectedUnpaidOrders : [],
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

  const balanceLabel = balanceLabelOf(selectedCurrencyRegister, t('Залишки'))
  const agreementBalance = getAgreementBalanceLabel({
    isSupplierSearch,
    selectedClientAgreement,
    selectedSupplyAgreement,
    t,
  })

  return (
    <>
      <form className="outgoing-cashflow-create-form" id={FORM_ID} onSubmit={handleSubmit}>
        <Stack gap="md">
          <Stack gap="sm">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Параметри операції')}
            </Text>
            <Group align="flex-end" gap="sm" justify="space-between" wrap="wrap">
              <SegmentedControl
                className="outgoing-cashflow-create-form__tabs"
                data={[
                  { label: t('Каса'), value: String(PaymentRegisterType.Cash) },
                  { label: t('Банк'), value: String(PaymentRegisterType.Bank) },
                ]}
                disabled={isLoading || isSaving}
                value={String(registerType)}
                onChange={handleRegisterTypeChanged}
              />
              <div className="outgoing-cashflow-create-form__tabs-scroll">
                <SegmentedControl
                  className="outgoing-cashflow-create-form__tabs"
                  data={operationOptions}
                  disabled={isLoading || isSaving}
                  value={String(operationType)}
                  onChange={handleOperationChanged}
                />
              </div>
            </Group>
          </Stack>

          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}

          {!isOtherOutcome && (
            <Stack gap="sm">
              <Text className="app-section-title" fw={600} size="sm">
                {t('Отримувач')}
              </Text>
              <SimpleGrid cols={{ base: 1, md: 2 }} style={{ alignItems: 'end' }}>
                <SegmentedControl
                  className="outgoing-cashflow-create-form__tabs"
                  data={searchTypeOptions}
                  disabled={isLoading || isSaving}
                  value={String(form.searchType)}
                  onChange={handleSearchTypeChanged}
                />
                <SearchableSelect
                  data={counterpartyOptions}
                  disabled={isLoading || isSaving}
                  label={t('Отримувач')}
                  placeholder={t('Почніть вводити назву')}
                  required
                  value={form.counterpartySearch}
                  onChange={handleCounterpartySearchChanged}
                  onOptionSubmit={handleCounterpartySubmit}
                />
              </SimpleGrid>
            </Stack>
          )}

          <Stack gap="sm">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Реквізити виплати')}
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
              <Select
                data={organizationOptions}
                disabled={!organizationOptions.length || isLoading || isSaving}
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
                value={form.selectedCurrencyValue || null}
                onChange={(value) => updateForm({ selectedCurrencyValue: value || '' })}
              />
              {!isOtherOutcome && (
                <Select
                  className="app-input-description-below"
                  data={agreementOptions}
                  description={agreementBalance || undefined}
                  disabled={!agreementOptions.length || isLoading || isSaving}
                  label={t('Договір')}
                  required
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
                required
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
                max={100}
                min={0}
                value={form.vatRate}
                onChange={handleVatRateChanged}
              />
              <NumberInput
                allowNegative={false}
                decimalScale={2}
                disabled={isLoading || isSaving}
                label={t('Сума ПДВ')}
                max={form.amount}
                min={0}
                value={form.vatAmount}
                onChange={(value) => updateForm({ vatAmount: toNumber(value) })}
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
                  onChange={(value) => updateForm({ movementSearch: value, selectedMovementValue: '' })}
                  onOptionSubmit={handleMovementSubmit}
                />
                <Tooltip label={t('Створити статтю')} withArrow>
                  <ActionIcon
                    aria-label={t('Створити статтю')}
                    color={CREATE_ACTION_COLOR}
                    disabled={Boolean(activeMovement) || !form.movementSearch.trim() || isLoading || isSaving}
                    size={36}
                    type="button"
                    variant="outline"
                    onClick={() => void handleCreateMovement()}
                  >
                    <Plus size={17} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </SimpleGrid>
          </Stack>

          {isSupplierSearch && selectedSupplyOrganization && (
            <SupplierUnpaidConsumableOrdersPicker
              disabled={isLoading || isSaving}
              isLoading={isLoadingUnpaidOrders}
              orders={unpaidConsumableOrders}
              selectedAmount={selectedUnpaidOrdersAmount}
              selectedCount={selectedUnpaidOrders.length}
              selectedValues={selectedUnpaidOrderValues}
              onChange={handleUnpaidOrdersChanged}
            />
          )}

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
          <Button color="gray" leftSection={<ArrowLeft size={16} />} type="button" variant="light" onClick={onCancel}>
            {t('Назад')}
          </Button>
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={isLoading || isResolvingCounterparty || isSaving}
            form={FORM_ID}
            leftSection={<Save size={16} />}
            loading={isSaving}
            type="submit"
          >
            {t('Створити')}
          </Button>
        </Group>
      </AppDrawerFooter>
    </>
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
    searchType: getDefaultOutgoingCounterpartySearchType(operationType),
    selectedAgreementValue: '',
    selectedCurrencyValue: '',
    selectedMovementValue: '',
    time: toTimeValue(now),
    vatAmount: 0,
    vatRate: 0,
  }
}

function getOperationOptions(t: (value: string) => string) {
  return getOutgoingPaymentGroupOperations().map((operation) => {
    return {
      label: t(getAccountingOperationLabel(operation.id, undefined, 'option')),
      value: String(operation.payloadOperationTypes[0]),
    }
  })
}

function getSearchTypeOptions(operationType: OutcomeOperationType, t: (value: string) => string) {
  return getAllowedOutgoingCounterpartySearchTypes(operationType).map((searchType) => ({
    label:
      searchType === IncomeCounterpartySearchType.Supplier
        ? t('Постачальники')
        : searchType === IncomeCounterpartySearchType.Manufacturer
          ? t('Виробники')
          : t('Клієнти'),
    value: String(searchType),
  }))
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
