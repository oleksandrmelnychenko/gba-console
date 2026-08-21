import {
  ActionIcon,
  Alert,
  Button,
  Checkbox,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Plus, Save } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { SearchableSelect } from '../../../shared/ui/SearchableSelect'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  ACCOUNTING_OPERATION_ID,
  getAccountingOperation,
  getAccountingOperationByPayloadType,
  getAccountingOperationLabel,
} from '../../accounting/accountingOperationCatalog'
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
  PaymentRegisterType,
} from '../types'
import { PaymentPurposeAutocomplete } from '../components/PaymentPurposeAutocomplete'
import {
  getAllowedIncomeCounterpartySearchTypes,
  resolveIncomeCounterpartyPayloadKind,
  resolveIncomePaymentOrderType,
  selectDefaultIncomePaymentMovement,
  shouldAllocateIncomePaymentToSales,
} from '../incomeCashflowMutationPolicy'
import {
  attachIncomeCounterpartyToOrder,
  validateIncomeCounterpartySelection,
} from '../incomeCashflowCounterpartyContract'
import { getPaymentPurposeSuggestionScope } from '../paymentPurposeSuggestionScope'
import {
  buildIncomeCashflowSaleTargets,
  getIncomeCashflowDebtTargetValue,
  selectIncomeCashflowDebtTargets,
} from '../incomeCashflowDebtTargets'
import {
  INCOME_CASHFLOW_TEXT_LIMITS,
  validateIncomeCashflowContract,
  validateIncomeCashflowMovementName,
} from '../incomeCashflowFormValidation'
import { createLatestRequestGuard } from '../latestRequestGuard'
import { createAutocompleteOptionSubmitGuard } from '../autocompleteOptionSubmitGuard'
import './income-cashflows-page.css'

type FormState = {
  amount: number
  autoAllocate: boolean
  calculatedValue: number
  comment: string
  counterpartySearch: string
  date: string
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

type AgreementsLoadState = 'idle' | 'loading' | 'loaded' | 'failed'

const INCOME_CASHFLOWS_PATH = '/accounting/income-cashflows'
const SEARCH_DEBOUNCE_MS = 300
const CLIENT_DEBTS_TABLE_DEFAULT_LAYOUT = {
  density: 'normal',
} satisfies DataTableDefaultLayout

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
  const [agreementsLoadState, setAgreementsLoadState] =
    useValueState<AgreementsLoadState>('idle')
  const [form, setForm] = useValueState<FormState>(() => createInitialForm(operationType))
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isResolvingCounterparty, setResolvingCounterparty] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [counterpartySelectionRequestGuard] = useState(
    () => createLatestRequestGuard<string>(),
  )
  const [counterpartyOptionSubmitGuard] = useState(
    createAutocompleteOptionSubmitGuard,
  )
  const [movementOptionSubmitGuard] = useState(
    createAutocompleteOptionSubmitGuard,
  )

  const counterpartyPayloadKind = resolveIncomeCounterpartyPayloadKind(
    operationType,
    form.searchType,
  )
  const isSupplierSearch = counterpartyPayloadKind === 'supplier'
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
  const activeMovement = selectedMovement
  const paymentPurposeSuggestionScope = getPaymentPurposeSuggestionScope({
    clientAgreementNetId: selectedClientAgreement?.NetUid,
    clientNetId: selectedClient?.NetUid,
    counterpartySearch: form.counterpartySearch,
    selectedClientName: selectedClient ? getEntityName(selectedClient) : '',
  })
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
        const defaultMovement = selectDefaultIncomePaymentMovement(
          nextMovements,
          operationType,
        )

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
        setAgreementsLoadState('idle')
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
    setAgreementsLoadState,
    setSupplyOrganizationAgreements,
    t,
  ])

  useEffect(() => {
    const value = form.counterpartySearch.trim()
    let cancelled = false
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        setCounterparties([])
        return
      }

      void searchIncomeCashflowCounterparties(
        value,
        form.searchType,
        controller.signal,
      )
        .then((nextCounterparties) => {
          if (!cancelled) {
            setCounterparties(nextCounterparties)
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
    if (operationType !== IncomePaymentOperationType.ClientPayment) {
      return
    }

    const value = form.payerSearch.trim()
    let cancelled = false
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        setPayerClients([])
        return
      }

      void searchIncomeCashflowClientPayers(value, controller.signal)
        .then((nextPayers) => {
          if (!cancelled) {
            setPayerClients(nextPayers)
          }
        })
        .catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [form.payerSearch, operationType, setPayerClients])

  useEffect(() => {
    const value = form.movementSearch.trim()
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchIncomeCashflowPaymentMovements(value)
        .then((nextMovements) => {
          if (!cancelled) {
            setPaymentMovements(nextMovements)
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
    counterpartyOptionSubmitGuard.clear()
    counterpartySelectionRequestGuard.invalidate()
    setResolvingCounterparty(false)
    navigate(`${INCOME_CASHFLOWS_PATH}/new/client?type=${value}&operationType=${operationType}`, { replace: true })
  }

  function handleOperationChanged(value: string) {
    counterpartyOptionSubmitGuard.clear()
    counterpartySelectionRequestGuard.invalidate()
    setResolvingCounterparty(false)
    navigate(`${INCOME_CASHFLOWS_PATH}/new/client?type=${registerType}&operationType=${value}`, { replace: true })
  }

  function handleSearchTypeChanged(value: string) {
    counterpartyOptionSubmitGuard.clear()
    setCounterparties([])
    setPayerClients([])
    clearCounterpartySelection({
      counterpartySearch: '',
      payerSearch: '',
      searchType: Number(value) as IncomeCounterpartySearchType,
    })
  }

  function handleCounterpartySearchChanged(value: string) {
    if (counterpartyOptionSubmitGuard.consumeChange(value)) {
      updateForm({ counterpartySearch: value })
      return
    }

    clearCounterpartySelection({
      counterpartySearch: value,
      payerSearch: '',
    })
  }

  function handlePayerSearchChanged(value: string) {
    if (counterpartyOptionSubmitGuard.consumeChange(value)) {
      updateForm({ payerSearch: value })
      return
    }

    clearCounterpartySelection({
      counterpartySearch: '',
      payerSearch: value,
    })
  }

  function clearCounterpartySelection(patch: Partial<FormState> = {}) {
    counterpartyOptionSubmitGuard.clear()
    counterpartySelectionRequestGuard.invalidate()
    setResolvingCounterparty(false)
    setSelectedClient(null)
    setSelectedSupplyOrganization(null)
    setClientAgreements([])
    setSupplyOrganizationAgreements([])
    setClientDebtTotal(null)
    setAgreementsLoadState('idle')
    setAvailableOrganizations(organizations)
    setForm((current) => ({
      ...current,
      selectedAgreementValue: '',
      selectedDebtValues: [],
      ...patch,
    }))
  }

  async function handleCounterpartySubmit(value: string) {
    const counterparty = [...counterparties, ...payerClients].find((item) => getEntityName(item) === value)

    if (!counterparty) {
      return
    }

    const payloadKind = resolveIncomeCounterpartyPayloadKind(
      operationType,
      form.searchType,
    )

    if (payloadKind === 'supplier') {
      counterpartyOptionSubmitGuard.markSubmitted(value)
      await selectSupplyOrganization(counterparty as SupplyOrganization, value)
    } else if (payloadKind === 'client') {
      counterpartyOptionSubmitGuard.markSubmitted(value)
      await selectClient(counterparty, value)
    }
  }

  async function selectClient(client: Client, label: string) {
    const clientNetId = client.NetUid
    const request = counterpartySelectionRequestGuard.start(
      `client:${getEntityValue(client)}`,
    )

    setResolvingCounterparty(true)
    setAgreementsLoadState('loading')
    setError(null)
    setSelectedClient(null)
    setSelectedSupplyOrganization(null)
    setClientAgreements([])
    setSupplyOrganizationAgreements([])
    setClientDebtTotal(null)
    setForm((current) => ({
      ...current,
      counterpartySearch: label,
      selectedAgreementValue: '',
      selectedDebtValues: [],
    }))

    try {
      const [nextAgreements, nextDebtTotal] = await Promise.all([
        clientNetId
          ? getIncomeCashflowClientAgreements(clientNetId)
          : Promise.resolve(client.ClientAgreements || []),
        clientNetId ? getIncomeCashflowClientDebtTotal(clientNetId).catch(() => null) : Promise.resolve(null),
      ])

      if (!counterpartySelectionRequestGuard.isCurrent(request)) {
        return
      }

      const debts = collectClientDebts(client, nextAgreements)
      const nextOrganizations = pickOrganizationsByClientAgreements(organizations, nextAgreements)
      const organizationCandidates = nextOrganizations.length ? nextOrganizations : organizations
      const nextOrganization = selectPreferredOrganization(
        organizationCandidates,
        form.organizationValue,
      )
      const nextClientAgreements = nextOrganization ? filterClientAgreementsByOrganization(nextAgreements, nextOrganization) : nextAgreements
      const nextAgreement = selectDefaultClientAgreement(nextClientAgreements)
      const nextRegister = selectDefaultRegister(paymentRegisters, nextOrganization, registerType)
      const nextCurrency = nextRegister?.PaymentCurrencyRegisters?.[0]?.Currency || null

      setSelectedClient({
        ...client,
        ClientAgreements: nextAgreements,
        ClientInDebts: debts,
      })
      setSelectedSupplyOrganization(null)
      setClientAgreements(nextClientAgreements)
      setSupplyOrganizationAgreements([])
      setAvailableOrganizations(nextOrganizations.length ? nextOrganizations : organizations)
      setClientDebtTotal(nextDebtTotal)
      setAgreementsLoadState('loaded')
      setForm((current) => ({
        ...current,
        counterpartySearch: label,
        organizationValue: nextOrganization ? getEntityValue(nextOrganization) : '',
        paymentRegisterValue: nextRegister ? getEntityValue(nextRegister) : '',
        selectedAgreementValue: nextAgreement?.Agreement ? getEntityValue(nextAgreement.Agreement) : '',
        selectedCurrencyValue: nextCurrency ? getEntityValue(nextCurrency) : '',
        selectedDebtValues: [],
      }))
    } catch (selectError) {
      if (counterpartySelectionRequestGuard.isCurrent(request)) {
        setAgreementsLoadState('failed')
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
    setAgreementsLoadState('loading')
    setError(null)
    setSelectedClient(null)
    setSelectedSupplyOrganization(null)
    setClientAgreements([])
    setSupplyOrganizationAgreements([])
    setClientDebtTotal(null)
    setForm((current) => ({
      ...current,
      counterpartySearch: label,
      selectedAgreementValue: '',
      selectedDebtValues: [],
    }))

    try {
      const nextAgreements = supplyOrganization.Id
        ? await getIncomeCashflowSupplyOrganizationAgreements(supplyOrganization.Id)
        : supplyOrganization.SupplyOrganizationAgreements || []

      if (!counterpartySelectionRequestGuard.isCurrent(request)) {
        return
      }

      const nextOrganizations = pickOrganizationsBySupplyAgreements(organizations, nextAgreements)
      const organizationCandidates = nextOrganizations.length ? nextOrganizations : organizations
      const nextOrganization = selectPreferredOrganization(
        organizationCandidates,
        form.organizationValue,
      )
      const nextSupplyAgreements = nextOrganization ? filterSupplyAgreementsByOrganization(nextAgreements, nextOrganization) : nextAgreements
      const nextAgreement = nextSupplyAgreements[0] || null
      const nextRegister = selectDefaultRegister(paymentRegisters, nextOrganization, registerType)
      const nextCurrency = nextRegister?.PaymentCurrencyRegisters?.[0]?.Currency || null

      setSelectedSupplyOrganization({
        ...supplyOrganization,
        SupplyOrganizationAgreements: nextAgreements,
      })
      setSelectedClient(null)
      setClientAgreements([])
      setSupplyOrganizationAgreements(nextSupplyAgreements)
      setAvailableOrganizations(nextOrganizations.length ? nextOrganizations : organizations)
      setClientDebtTotal(null)
      setAgreementsLoadState('loaded')
      setForm((current) => ({
        ...current,
        counterpartySearch: label,
        organizationValue: nextOrganization ? getEntityValue(nextOrganization) : '',
        paymentRegisterValue: nextRegister ? getEntityValue(nextRegister) : '',
        selectedAgreementValue: nextAgreement ? getEntityValue(nextAgreement) : '',
        selectedCurrencyValue: nextCurrency ? getEntityValue(nextCurrency) : '',
        selectedDebtValues: [],
      }))
    } catch (selectError) {
      if (counterpartySelectionRequestGuard.isCurrent(request)) {
        setAgreementsLoadState('failed')
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

    setClientAgreements(nextClientAgreements)
    updateForm({
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

    updateForm({
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
    const debtValue = getIncomeCashflowDebtTargetValue(debt)
    const selectedDebtValues = checked
      ? Array.from(new Set([...form.selectedDebtValues, debtValue]))
      : form.selectedDebtValues.filter((value) => value !== debtValue)

    updateForm({
      selectedDebtValues,
    })
  }

  function handleMovementSubmit(value: string) {
    const movement = paymentMovements.find((item) => getEntityName(item) === value)

    if (!movement) {
      return
    }

    movementOptionSubmitGuard.markSubmitted(value)
    updateForm({
      movementSearch: getEntityName(movement),
      selectedMovementValue: getEntityValue(movement),
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

  async function handleCreateMovement() {
    const operationName = form.movementSearch.trim()

    if (!operationName) {
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

    const validationError = validateForm({
      activeMovement,
      agreementsLoadState,
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
        arrivalNumber: form.entranceNumber,
        comment: form.comment,
        date: form.date,
        paymentPurpose: form.paymentPurpose,
        time: form.time,
        vatAmount: form.vatAmount,
        vatRate: form.vatRate,
      },
      t,
    ) || validateDebtSelection({
      autoAllocate: form.autoAllocate,
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
      counterpartyPayloadKind,
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
      await createIncomeCashflow(
        payload,
        operationType === IncomePaymentOperationType.ClientPayment &&
          form.autoAllocate,
      )
      notifications.show({
        color: 'green',
        message: t('Прибутковий ордер створено'),
      })
      navigate(INCOME_CASHFLOWS_PATH, { replace: true, state: { mutated: true } })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити прибутковий ордер'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppDrawer
      className="income-cashflow-client-form-drawer"
      opened
      position="right"
      size="wide"
      title={
        <Group className="income-cashflow-client-form__titlebar" gap="sm" wrap="nowrap">
          <span className="income-cashflow-client-form__title">{title}</span>
          <SegmentedControl
            aria-label={t('Тип оплати')}
            className="income-cashflow-client-form__tabs income-cashflow-client-form__register-tabs"
            data={[
              { label: t('Каса'), value: String(PaymentRegisterType.Cash) },
              { label: t('Банк'), value: String(PaymentRegisterType.Bank) },
            ]}
            disabled={isLoading || isSaving}
            value={String(registerType)}
            onChange={handleRegisterTypeChanged}
          />
        </Group>
      }
      onClose={() => navigate(INCOME_CASHFLOWS_PATH)}
      footer={
        <Button
          color={CREATE_ACTION_COLOR}
          disabled={isLoading || isResolvingCounterparty || isSaving}
          form="income-cashflow-client-form"
          leftSection={<Save size={16} />}
          loading={isSaving}
          type="submit"
        >
          {t('Зберегти')}
        </Button>
      }
    >
      <form className="income-cashflow-client-form" id="income-cashflow-client-form" onSubmit={handleSubmit}>
        <Stack gap="md">
          <Stack gap={6}>
            <Text className="app-section-title" fw={600} size="sm">
              {t('Тип надходження')}
            </Text>
            <div className="income-cashflow-client-form__tabs-scroll">
              <SegmentedControl
                aria-label={t('Тип надходження')}
                className="income-cashflow-client-form__tabs income-cashflow-client-form__operation-tabs"
                data={operationOptions}
                disabled={isLoading || isSaving}
                value={String(operationType)}
                onChange={handleOperationChanged}
              />
            </div>
          </Stack>

          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <Stack gap="sm">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Організація та контрагент')}
            </Text>

            <SimpleGrid
              className="income-cashflow-client-form__primary-fields"
              cols={{ base: 1, md: 2 }}
              style={{ alignItems: 'end' }}
            >
              <Select
                data={organizationOptions}
                disabled={!organizationOptions.length || isLoading || isResolvingCounterparty || isSaving}
                label={t('Організація')}
                required
                searchable
                value={form.organizationValue || null}
                onChange={handleOrganizationChanged}
              />
              <SearchableSelect
                data={counterpartyOptions}
                disabled={isLoading || isResolvingCounterparty || isSaving}
                label={t('Контрагент')}
                placeholder={t('Почніть вводити назву')}
                required
                value={form.counterpartySearch}
                onChange={handleCounterpartySearchChanged}
                onOptionSubmit={handleCounterpartySubmit}
              />
            </SimpleGrid>

            {operationType === IncomePaymentOperationType.ClientPayment && (
              <SearchableSelect
                data={payerOptions}
                disabled={isLoading || isResolvingCounterparty || isSaving}
                label={t('Пошук за платниками')}
                placeholder={t('Почніть вводити платника')}
                value={form.payerSearch}
                onChange={handlePayerSearchChanged}
                onOptionSubmit={handleCounterpartySubmit}
              />
            )}

            <Stack gap={6}>
              <Text className="income-cashflow-client-form__field-label" size="sm">
                {t('Тип контрагента')}
              </Text>
              <div className="income-cashflow-client-form__tabs-scroll">
                <SegmentedControl
                  aria-label={t('Тип контрагента')}
                  className="income-cashflow-client-form__tabs income-cashflow-client-form__counterparty-tabs"
                  data={searchTypeOptions}
                  disabled={isLoading || isResolvingCounterparty || isSaving}
                  value={String(form.searchType)}
                  onChange={handleSearchTypeChanged}
                />
              </div>
            </Stack>
          </Stack>

          <Stack gap="sm">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Реквізити надходження')}
            </Text>

            <SimpleGrid cols={{ base: 1, md: 3 }} style={{ alignItems: 'end' }}>
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Вхідний номер')}
                maxLength={INCOME_CASHFLOW_TEXT_LIMITS.arrivalNumber}
                value={form.entranceNumber}
                onChange={(event) => updateForm({ entranceNumber: event.currentTarget.value })}
              />
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
                data={registerOptions}
                disabled={!selectedOrganization || isLoading || isSaving}
                label={t('Каса / рахунок')}
                required
                searchable
                value={form.paymentRegisterValue || null}
                onChange={handleRegisterChanged}
              />
              <Select
                data={currencyOptions}
                disabled={!selectedRegister || isLoading || isSaving}
                label={t('Валюта')}
                required
                searchable
                value={form.selectedCurrencyValue || null}
                onChange={(value) => updateForm({ selectedCurrencyValue: value || '' })}
              />
              <Select
                data={agreementOptions}
                disabled={!agreementOptions.length || isLoading || isSaving}
                label={t('Договір')}
                required
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
                  onChange={handleMovementSearchChanged}
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

          {form.amount > 0 && agreementCurrency && selectedCurrency && (
            <div className="income-cashflow-client-form__exchange-summary">
              <span>{t('До зарахування')}</span>
              <strong className="app-money">
                {formatMoney(form.calculatedValue || form.amount)} {agreementCurrency.Code || agreementCurrency.Name}
              </strong>
              <small>
                {selectedCurrency.Code || selectedCurrency.Name} → {agreementCurrency.Code || agreementCurrency.Name}
              </small>
            </div>
          )}

          <Stack gap="sm">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Деталі та облік')}
            </Text>

            <SimpleGrid cols={{ base: 1, md: 2 }} style={{ alignItems: 'start' }}>
              <PaymentPurposeAutocomplete
                {...paymentPurposeSuggestionScope}
                disabled={isLoading || isResolvingCounterparty || isSaving}
                label={t('Призначення платежу')}
                value={form.paymentPurpose}
                onChange={(value) => updateForm({ paymentPurpose: value })}
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

            <Group className="income-cashflow-client-form__accounting-flags" gap="lg">
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

          {!isSupplierSearch && selectedClient && (
            <Stack className="income-cashflow-client-form__debts" gap="sm">
              <Group align="flex-start" className="income-cashflow-client-form__debts-header" justify="space-between" wrap="wrap">
                <div className="income-cashflow-client-form__debts-identity">
                  <Text className="app-section-title" fw={600} size="sm">{t('Борги та рахунки клієнта')}</Text>
                </div>

                <div className="income-cashflow-client-form__debt-metrics">
                  {maxOverdueDays > 0 && (
                    <div className="income-cashflow-client-form__debt-metric is-danger">
                      <span>{t('Прострочено')}</span>
                      <strong>{maxOverdueDays} {t('днів')}</strong>
                    </div>
                  )}
                  {clientDebtTotal?.TotalEuro ? (
                    <div className="income-cashflow-client-form__debt-metric">
                      <span>{t('Загальний борг')}</span>
                      <strong className="app-money">{formatMoney(clientDebtTotal.TotalEuro)} EUR</strong>
                    </div>
                  ) : null}
                  {clientDebtTotal?.TotalLocal ? (
                    <div className="income-cashflow-client-form__debt-metric">
                      <span>{t('Загальний борг')}</span>
                      <strong className="app-money">{formatMoney(clientDebtTotal.TotalLocal)} UAH</strong>
                    </div>
                  ) : null}
                  {selectedClientAgreement?.CurrentAmount ? (
                    <div className="income-cashflow-client-form__debt-metric">
                      <span>{t('Баланс договору')}</span>
                      <strong className="app-money">
                        {formatMoney(selectedClientAgreement.CurrentAmount)} {agreementCurrency?.Code || ''}
                      </strong>
                    </div>
                  ) : null}
                  {totalDebt > 0 && (
                    <div className="income-cashflow-client-form__debt-metric is-accent">
                      <span>{t('Борг за договором')}</span>
                      <strong className="app-money">{formatMoney(totalDebt)} {agreementCurrency?.Code || ''}</strong>
                    </div>
                  )}
                </div>
              </Group>

              {visibleDebts.length > 0 ? (
                <>
                  <Checkbox
                    className="income-cashflow-client-form__auto-allocate"
                    checked={form.autoAllocate}
                    disabled={isSaving}
                    label={t('Автоматично рознести оплату по боргах')}
                    onChange={(event) => updateForm({ autoAllocate: event.currentTarget.checked })}
                  />
                  <div className="income-cashflow-client-form__debts-table-shell">
                    <IncomeCashflowDebtTable
                      currencyCode={agreementCurrency?.Code || ''}
                      debts={visibleDebts}
                      disabled={isSaving}
                      selectedDebtValues={form.selectedDebtValues}
                      onChecked={handleDebtChecked}
                    />
                  </div>
                </>
              ) : (
                <Text className="income-cashflow-client-form__debts-empty" size="sm">
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

function IncomeCashflowDebtTable({
  currencyCode,
  debts,
  disabled,
  selectedDebtValues,
  onChecked,
}: {
  currencyCode: string
  debts: ClientInDebt[]
  disabled: boolean
  selectedDebtValues: string[]
  onChecked: (debt: ClientInDebt, checked: boolean) => void
}) {
  const { t } = useI18n()
  const selectedValues = useMemo(
    () => new Set(selectedDebtValues),
    [selectedDebtValues],
  )
  const columns = useMemo<DataTableColumn<ClientInDebt>[]>(
    () => [
      {
        id: 'selected',
        header: t('Сплатити'),
        width: 76,
        minWidth: 76,
        maxWidth: 76,
        align: 'center',
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (debt) => {
          const debtValue = getIncomeCashflowDebtTargetValue(debt)

          return (
            <Checkbox
              aria-label={t('Вибрати борг')}
              checked={selectedValues.has(debtValue)}
              disabled={disabled}
              onChange={(event) => onChecked(debt, event.currentTarget.checked)}
            />
          )
        },
      },
      {
        id: 'document',
        header: t('Рахунок'),
        width: 280,
        minWidth: 200,
        fill: true,
        numeric: true,
        accessor: getDebtDocumentNumber,
        cell: getDebtDocumentNumber,
      },
      {
        id: 'date',
        header: t('Дата'),
        width: 180,
        minWidth: 160,
        numeric: true,
        accessor: getDebtDate,
        cell: (debt) => formatDate(getDebtDate(debt)),
      },
      {
        id: 'days',
        header: t('Днів'),
        width: 110,
        minWidth: 96,
        align: 'right',
        numeric: true,
        accessor: (debt) => debt.Debt?.Days,
        cell: (debt) => debt.Debt?.Days || '',
      },
      {
        id: 'debt',
        header: currencyCode ? `${t('Борг')} (${currencyCode})` : t('Борг'),
        width: 170,
        minWidth: 140,
        align: 'right',
        numeric: true,
        accessor: readDebtTotal,
        cell: (debt) => {
          const value = readDebtTotal(debt)

          return value ? formatMoney(value) : ''
        },
      },
    ],
    [currencyCode, disabled, onChecked, selectedValues, t],
  )

  return (
    <DataTable
      columns={columns}
      data={debts}
      defaultLayout={CLIENT_DEBTS_TABLE_DEFAULT_LAYOUT}
      emptyText={t('По вибраному договору боргів немає')}
      enablePinning={false}
      getRowId={(debt, index) => getIncomeCashflowDebtTargetValue(debt) || String(index)}
      layoutVersion="income-cashflow-client-debts-1"
      minWidth={720}
      showDensityToggle={false}
      showLayoutControls={false}
      tableId="income-cashflow-client-debts"
    />
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
  counterpartyPayloadKind,
  debts,
  form,
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
  counterpartyPayloadKind: 'client' | 'supplier' | null
  debts: ClientInDebt[]
  form: FormState
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
  const shouldAllocateSales = shouldAllocateIncomePaymentToSales(
    operationType,
    counterpartyPayloadKind !== 'client',
  )
  const selectedClientDebts = shouldAllocateSales
    ? selectIncomeCashflowDebtTargets(debts, form.selectedDebtValues)
    : []
  const order: IncomePaymentOrder = {
    Amount: form.amount,
    ArrivalNumber: form.entranceNumber.trim(),
    Comment: form.comment.trim(),
    Currency: selectedCurrency,
    ExchangeRate: form.exchangeRate || undefined,
    FromDate: toIsoDateTime(form.date, form.time),
    IncomePaymentOrderType: resolveIncomePaymentOrderType(
      selectedRegister.Type ?? registerType,
    ),
    IncomePaymentOrderSales: shouldAllocateSales
      ? buildIncomeCashflowSaleTargets(debts, form.selectedDebtValues)
      : [],
    IsAccounting: form.isAccounting,
    IsManagementAccounting: form.isManagementAccounting,
    OperationType: operationType,
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

  return attachIncomeCounterpartyToOrder(order, {
    counterpartyPayloadKind,
    selectedClient,
    selectedClientAgreement,
    selectedClientDebts,
    selectedSupplyAgreement,
    selectedSupplyOrganization,
  })
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

function validateForm({
  activeMovement,
  agreementsLoadState,
  amount,
  operationType,
  searchType,
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
  agreementsLoadState: AgreementsLoadState
  amount: number
  operationType: IncomePaymentOperationType
  searchType: IncomeCounterpartySearchType
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

  const counterpartyError = validateIncomeCounterpartySelection({
    agreementsLoaded: agreementsLoadState === 'loaded',
    operationType,
    searchType,
    selectedClient,
    selectedClientAgreement,
    selectedSupplyAgreement,
    selectedSupplyOrganization,
    t,
  })

  if (counterpartyError) {
    return counterpartyError
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
  operationType,
  selectedDebtValues,
  t,
  visibleDebts,
}: {
  autoAllocate: boolean
  operationType: IncomePaymentOperationType
  selectedDebtValues: string[]
  t: (value: string) => string
  visibleDebts: ClientInDebt[]
}): string | null {
  if (
    operationType !== IncomePaymentOperationType.ClientPayment ||
    !visibleDebts.length
  ) {
    return null
  }

  if (!selectedDebtValues.length) {
    return autoAllocate
      ? t('Оберіть рахунок для автоматичного рознесення')
      : null
  }

  const visibleDebtValues = new Set(
    visibleDebts.map(getIncomeCashflowDebtTargetValue),
  )

  if (selectedDebtValues.some((value) => !visibleDebtValues.has(value))) {
    return t('Оберіть рахунок для оплати')
  }

  const selectedDebts = selectIncomeCashflowDebtTargets(
    visibleDebts,
    selectedDebtValues,
  )
  const serializedTargets = buildIncomeCashflowSaleTargets(
    visibleDebts,
    selectedDebtValues,
  )

  return selectedDebts.length === serializedTargets.length
    ? null
    : t('Не вдалося визначити продаж для вибраного боргу')
}

function parseRegisterType(value: string | null): PaymentRegisterType {
  return value === String(PaymentRegisterType.Bank) ? PaymentRegisterType.Bank : PaymentRegisterType.Cash
}

function parseOperationType(value: string | null): IncomePaymentOperationType {
  const operationType = Number(value)
  const operation = getAccountingOperationByPayloadType('income', operationType)

  if (
    operation?.id === ACCOUNTING_OPERATION_ID.IncomeSupplierReturn
    || operation?.id === ACCOUNTING_OPERATION_ID.IncomeOtherWithCounterparties
    || operation?.id === ACCOUNTING_OPERATION_ID.IncomeClientPayment
  ) {
    return operationType as IncomePaymentOperationType
  }

  return IncomePaymentOperationType.ClientPayment
}

function getTitle(operationType: IncomePaymentOperationType, registerType: PaymentRegisterType, t: (value: string) => string): string {
  const registerTitle = registerType === PaymentRegisterType.Bank ? t('банківський') : t('касовий')
  const operation = getAccountingOperationByPayloadType('income', operationType)
  const operationId = operation?.id || ACCOUNTING_OPERATION_ID.IncomeClientPayment

  return `${t(getAccountingOperationLabel(operationId, registerType, 'form'))}, ${registerTitle}`
}

function getOperationOptions(registerType: PaymentRegisterType, t: (value: string) => string) {
  const suffix = registerType === PaymentRegisterType.Bank ? t('банк') : t('каса')

  return [
    ACCOUNTING_OPERATION_ID.IncomeClientPayment,
    ACCOUNTING_OPERATION_ID.IncomeSupplierReturn,
    ACCOUNTING_OPERATION_ID.IncomeOtherWithCounterparties,
  ].map((operationId) => {
    const operation = getAccountingOperation(operationId)

    return {
      label: `${t(getAccountingOperationLabel(operationId, registerType))} (${suffix})`,
      value: String(operation.payloadOperationTypes[0]),
    }
  })
}

function getSearchTypeOptions(operationType: IncomePaymentOperationType, t: (value: string) => string) {
  return getAllowedIncomeCounterpartySearchTypes(operationType).map((searchType) => ({
    label:
      searchType === IncomeCounterpartySearchType.Supplier
        ? t('Постачальники')
        : searchType === IncomeCounterpartySearchType.Manufacturer
          ? t('Виробники')
          : t('Клієнти'),
    value: String(searchType),
  }))
}

function pickOrganizationsByClientAgreements(organizations: OrganizationWithDefaults[], agreements: ClientAgreement[]) {
  const organizationIds = collectTruthyIds(agreements, (agreement) => agreement.Agreement?.OrganizationId)

  return organizations.filter((organization) => organization.Id && organizationIds.has(organization.Id))
}

function pickOrganizationsBySupplyAgreements(organizations: OrganizationWithDefaults[], agreements: SupplyOrganizationAgreement[]) {
  const organizationIds = collectTruthyIds(agreements, (agreement) => agreement.Organization?.Id)

  return organizations.filter((organization) => organization.Id && organizationIds.has(organization.Id))
}

function selectPreferredOrganization(
  organizations: OrganizationWithDefaults[],
  selectedValue: string,
): OrganizationWithDefaults | null {
  return organizations.find(
    (organization) => getEntityValue(organization) === selectedValue,
  ) || organizations[0] || null
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
    (debt) => {
      if (debt.AgreementId !== clientAgreement.AgreementId) {
        return false
      }

      const debtOrganizationId =
        debt.Agreement?.OrganizationId ??
        debt.Agreement?.Organization?.Id

      return debtOrganizationId == null ||
        debtOrganizationId === organization.Id
    },
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

function getDebtDocumentNumber(debt: ClientInDebt): string {
  return debt.Sale?.SaleNumber?.Value || debt.ReSale?.SaleNumber?.Value || debt.Sale?.NetUid || debt.ReSale?.NetUid || ''
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
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return dateTimeFormatter.format(date)
}
