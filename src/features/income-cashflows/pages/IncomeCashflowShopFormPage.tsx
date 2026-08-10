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
import { notifications } from '@mantine/notifications'
import { CircleAlert, Plus, Save } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
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
  calculateIncomeCashflowExchange,
  createIncomeCashflow,
  createIncomeCashflowPaymentMovement,
  getIncomeCashflowPaymentMovements,
  getIncomeCashflowRetailClientAgreements,
  getIncomeCashflowSpecificExchangeRate,
  searchIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentRegisters,
  searchIncomeCashflowRetailClients,
} from '../api/incomeCashflowsApi'
import type {
  Client,
  ClientAgreement,
  ClientInDebt,
  Currency,
  IncomePaymentOrder,
  NamedEntity,
  Organization,
  PaymentCurrencyRegister,
  PaymentMovement,
  PaymentRegister,
  RetailClient,
} from '../types'
import { IncomePaymentOperationType } from '../types'
import {
  resolveIncomePaymentOrderType,
  selectDefaultIncomePaymentMovement,
} from '../incomeCashflowMutationPolicy'
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
  comment: string
  date: string
  exchangeRate: number
  isAccounting: boolean
  isManagementAccounting: boolean
  movementSearch: string
  organizationValue: string
  paymentRegisterValue: string
  retailClientSearch: string
  selectedAgreementValue: string
  selectedCurrencyValue: string
  selectedDebtValues: string[]
  selectedMovementValue: string
  selectedRetailClientValue: string
  time: string
}

type ExchangeCalculationState = {
  key: string
  value: number
}

type ApplyRetailAgreementsParams = {
  agreements: ClientAgreement[]
  amount?: number
  autoAllocate?: boolean
  paymentRegisters: PaymentRegister[]
  retailClient?: RetailClient | null
  selectedAgreementId?: string
  selectedSaleId?: string
}

const INCOME_CASHFLOWS_PATH = '/accounting/income-cashflows'
const SEARCH_DEBOUNCE_MS = 300
const SHOP_DEBTS_TABLE_DEFAULT_LAYOUT = {
  density: 'normal',
} satisfies DataTableDefaultLayout

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
})

type SelectOption = {
  label: string
  value: string
}

export function IncomeCashflowShopFormPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const retailClientId = searchParams.get('retailClientId') || ''
  const saleId = searchParams.get('saleId') || ''
  const agreementId = searchParams.get('caId') || ''
  const queryAmount = toNumber(searchParams.get('sum') || '')

  const [paymentRegisters, setPaymentRegisters] = useValueState<PaymentRegister[]>([])
  const [paymentMovements, setPaymentMovements] = useValueState<PaymentMovement[]>([])
  const [retailClients, setRetailClients] = useValueState<RetailClient[]>([])
  const [selectedRetailClient, setSelectedRetailClient] = useValueState<RetailClient | null>(null)
  const [retailAgreements, setRetailAgreements] = useValueState<ClientAgreement[]>([])
  const [form, setForm] = useValueState<FormState>(() => createInitialForm(queryAmount))
  const [exchangeCalculation, setExchangeCalculation] = useValueState<ExchangeCalculationState | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isResolvingClient, setResolvingClient] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [retailClientSelectionRequestGuard] = useState(
    () => createLatestRequestGuard<string>(),
  )
  const [retailClientOptionSubmitGuard] = useState(
    createAutocompleteOptionSubmitGuard,
  )
  const [movementOptionSubmitGuard] = useState(
    createAutocompleteOptionSubmitGuard,
  )

  const organizations = useMemo(() => collectOrganizations(retailAgreements), [retailAgreements])
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
  const organizationAgreements = useMemo(
    () => (selectedOrganization ? filterClientAgreementsByOrganization(retailAgreements, selectedOrganization) : retailAgreements),
    [retailAgreements, selectedOrganization],
  )
  const selectedAgreement = useMemo(
    () => organizationAgreements.find((agreement) => getEntityValue(agreement.Agreement) === form.selectedAgreementValue) || null,
    [form.selectedAgreementValue, organizationAgreements],
  )
  const selectedAgreementCurrency = selectedAgreement?.Agreement?.Currency || null
  const selectedPaymentClient = useMemo(
    () => selectedAgreement?.Client || selectedAgreement?.Agreement?.Client || selectedRetailClient?.Client || null,
    [selectedAgreement, selectedRetailClient],
  )
  const allClientDebts = useMemo(
    () => collectClientDebts(selectedPaymentClient, retailAgreements),
    [retailAgreements, selectedPaymentClient],
  )
  const visibleDebts = useMemo(
    () => filterClientDebts(allClientDebts, selectedOrganization, selectedAgreement),
    [allClientDebts, selectedAgreement, selectedOrganization],
  )
  const selectedMovement = useMemo(
    () => paymentMovements.find((movement) => getEntityValue(movement) === form.selectedMovementValue) || null,
    [form.selectedMovementValue, paymentMovements],
  )
  const activeMovement = selectedMovement
  const organizationOptions = useMemo(() => toEntityOptions(organizations), [organizations])
  const registerOptions = useMemo(() => toEntityOptions(filteredPaymentRegisters), [filteredPaymentRegisters])
  const currencyOptions = useMemo(() => toCurrencyOptions(selectedRegister), [selectedRegister])
  const agreementOptions = useMemo(() => toClientAgreementOptions(organizationAgreements), [organizationAgreements])
  const movementOptions = useMemo(() => toUniqueLabels(paymentMovements), [paymentMovements])
  const retailClientOptions = useMemo(() => toRetailClientLabels(retailClients), [retailClients])
  const debtTotal = useMemo(() => visibleDebts.reduce((sum, debt) => sum + readDebtTotal(debt), 0), [visibleDebts])
  const exchangeCalculationKey = createExchangeCalculationKey({
    amount: form.amount,
    exchangeRate: form.exchangeRate,
    fromCurrencyId: selectedCurrency?.Id,
    toCurrencyId: selectedAgreementCurrency?.Id,
  })
  const calculatedValue = resolveCalculatedValue({
    amount: form.amount,
    calculation: exchangeCalculation,
    calculationKey: exchangeCalculationKey,
    fromCurrencyId: selectedCurrency?.Id,
    toCurrencyId: selectedAgreementCurrency?.Id,
  })

  const applyRetailAgreements = useCallback(
    ({
      agreements,
      amount,
      autoAllocate,
      paymentRegisters: nextPaymentRegisters,
      retailClient,
      selectedAgreementId,
      selectedSaleId,
    }: ApplyRetailAgreementsParams) => {
      const nextAgreement = selectClientAgreement(agreements, selectedAgreementId)
      const nextOrganization = nextAgreement?.Agreement?.Organization || collectOrganizations(agreements)[0] || null
      const nextRegister = selectDefaultRegister(nextPaymentRegisters, nextOrganization, Boolean(selectedAgreementId || selectedSaleId))
      const nextCurrency = nextRegister?.PaymentCurrencyRegisters?.[0]?.Currency || null
      const nextDebts = filterClientDebts(collectClientDebts(readPaymentClient(nextAgreement, retailClient), agreements), nextOrganization, nextAgreement)
      const nextSelectedDebtValues = selectedSaleId ? getDebtValuesBySaleId(nextDebts, selectedSaleId) : []

      setRetailAgreements(agreements)
      setSelectedRetailClient(retailClient || null)
      setForm((current) => ({
        ...current,
        amount: amount || current.amount,
        autoAllocate: Boolean(autoAllocate),
        organizationValue: nextOrganization ? getEntityValue(nextOrganization) : '',
        paymentRegisterValue: nextRegister ? getEntityValue(nextRegister) : '',
        retailClientSearch: retailClient ? getRetailClientLabel(retailClient) : current.retailClientSearch || retailClientId,
        selectedAgreementValue: nextAgreement?.Agreement ? getEntityValue(nextAgreement.Agreement) : '',
        selectedCurrencyValue: nextCurrency ? getEntityValue(nextCurrency) : '',
        selectedDebtValues: nextSelectedDebtValues,
        selectedRetailClientValue: retailClient ? getEntityValue(retailClient) : current.selectedRetailClientValue || retailClientId,
      }))
    },
    [retailClientId, setForm, setRetailAgreements, setSelectedRetailClient],
  )

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        const [nextRegisters, nextMovements] = await Promise.all([
          searchIncomeCashflowPaymentRegisters(''),
          getIncomeCashflowPaymentMovements(),
        ])

        if (cancelled) {
          return
        }

        const defaultMovement = selectDefaultIncomePaymentMovement(
          nextMovements,
          IncomePaymentOperationType.ClientPayment,
        )

        setPaymentRegisters(nextRegisters)
        setPaymentMovements(nextMovements)
        setForm((current) => ({
          ...current,
          movementSearch: defaultMovement?.OperationName || '',
          selectedMovementValue: defaultMovement ? getEntityValue(defaultMovement) : '',
        }))

        if (retailClientId) {
          const agreements = await getIncomeCashflowRetailClientAgreements(retailClientId)

          if (!cancelled) {
            applyRetailAgreements({
              agreements,
              amount: queryAmount,
              autoAllocate: Boolean(saleId),
              paymentRegisters: nextRegisters,
              selectedAgreementId: agreementId,
              selectedSaleId: saleId,
            })
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити дані для оплати магазину'))
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
    agreementId,
    queryAmount,
    retailClientId,
    saleId,
    applyRetailAgreements,
    setError,
    setForm,
    setLoading,
    setPaymentMovements,
    setPaymentRegisters,
    t,
  ])

  useEffect(() => {
    const value = form.retailClientSearch.trim()
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      if (!value || getRetailClientLabel(selectedRetailClient) === value) {
        return
      }

      void searchIncomeCashflowRetailClients(value)
        .then((nextClients) => {
          if (!cancelled) {
            setRetailClients(nextClients)
          }
        })
        .catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [form.retailClientSearch, selectedRetailClient, setRetailClients])

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
    const toCurrencyNetId = selectedAgreementCurrency?.NetUid

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
  }, [form.date, form.time, selectedAgreementCurrency?.NetUid, selectedCurrency?.NetUid, setForm])

  useEffect(() => {
    const amount = form.amount
    const fromCurrencyId = selectedCurrency?.Id
    const toCurrencyId = selectedAgreementCurrency?.Id

    if (!amount || !fromCurrencyId || !toCurrencyId || fromCurrencyId === toCurrencyId) {
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
          setExchangeCalculation({
            key: exchangeCalculationKey,
            value: calculation?.ConvertedAmount || 0,
          })
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [
    exchangeCalculationKey,
    form.amount,
    form.exchangeRate,
    selectedAgreementCurrency?.Id,
    selectedCurrency?.Id,
    setExchangeCalculation,
  ])

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function handleRetailClientSearchChanged(value: string) {
    if (retailClientOptionSubmitGuard.consumeChange(value)) {
      updateForm({ retailClientSearch: value })
      return
    }

    retailClientSelectionRequestGuard.invalidate()
    setResolvingClient(false)
    setSelectedRetailClient(null)
    setRetailAgreements([])
    setForm((current) => ({
      ...current,
      organizationValue: '',
      paymentRegisterValue: '',
      retailClientSearch: value,
      selectedAgreementValue: '',
      selectedCurrencyValue: '',
      selectedDebtValues: [],
      selectedRetailClientValue: '',
    }))
  }

  async function loadRetailAgreements(netId: string, retailClient: RetailClient | null) {
    if (!netId) {
      return
    }

    const request =
      retailClientSelectionRequestGuard.start(netId)

    setResolvingClient(true)
    setError(null)
    setSelectedRetailClient(null)
    setRetailAgreements([])
    setForm((current) => ({
      ...current,
      organizationValue: '',
      paymentRegisterValue: '',
      selectedAgreementValue: '',
      selectedCurrencyValue: '',
      selectedDebtValues: [],
    }))

    try {
      const agreements = await getIncomeCashflowRetailClientAgreements(netId)

      if (retailClientSelectionRequestGuard.isCurrent(request)) {
        applyRetailAgreements({
          agreements,
          paymentRegisters,
          retailClient,
        })
      }
    } catch (loadError) {
      if (retailClientSelectionRequestGuard.isCurrent(request)) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити договори retail-клієнта'))
      }
    } finally {
      if (retailClientSelectionRequestGuard.finish(request)) {
        setResolvingClient(false)
      }
    }
  }

  function handleRetailClientSubmit(value: string) {
    const retailClient = retailClients.find((client) => getRetailClientLabel(client) === value) || null
    const netId = getEntityValue(retailClient)

    if (!retailClient || !netId) {
      return
    }

    retailClientOptionSubmitGuard.markSubmitted(value)
    updateForm({
      retailClientSearch: getRetailClientLabel(retailClient),
      selectedRetailClientValue: netId,
    })
    void loadRetailAgreements(netId, retailClient)
  }

  function handleOrganizationChanged(value: string | null) {
    const organization = organizations.find((item) => getEntityValue(item) === value) || null
    const agreements = organization ? filterClientAgreementsByOrganization(retailAgreements, organization) : retailAgreements
    const agreement = selectDefaultClientAgreement(agreements)
    const register = selectDefaultRegister(paymentRegisters, organization, false)
    const currency = register?.PaymentCurrencyRegisters?.[0]?.Currency || null

    updateForm({
      organizationValue: value || '',
      paymentRegisterValue: register ? getEntityValue(register) : '',
      selectedAgreementValue: agreement?.Agreement ? getEntityValue(agreement.Agreement) : '',
      selectedCurrencyValue: currency ? getEntityValue(currency) : '',
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
    updateForm({
      selectedAgreementValue: value || '',
      selectedDebtValues: [],
    })
  }

  function handleAmountChanged(value: string | number) {
    updateForm({ amount: toNumber(value) })
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

  function handleDebtChecked(debt: ClientInDebt, checked: boolean) {
    const debtValue = getIncomeCashflowDebtTargetValue(debt)

    setForm((current) => {
      const selectedDebtValues = checked
        ? Array.from(new Set([...current.selectedDebtValues, debtValue]))
        : current.selectedDebtValues.filter((value) => value !== debtValue)

      return {
        ...current,
        selectedDebtValues,
      }
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateForm({
      activeMovement,
      amount: form.amount,
      selectedAgreement,
      selectedCurrency,
      selectedCurrencyRegister,
      selectedOrganization,
      selectedPaymentClient,
      selectedRegister,
      t,
    }) || validateIncomeCashflowContract(
      {
        amount: form.amount,
        comment: form.comment,
        date: form.date,
        time: form.time,
      },
      t,
    ) || validateDebtSelection({
      autoAllocate: form.autoAllocate,
      selectedDebtValues: form.selectedDebtValues,
      t,
      visibleDebts,
    })

    if (validationError) {
      setError(validationError)
      return
    }

    const payload = buildIncomePaymentOrder({
      activeMovement: activeMovement as PaymentMovement,
      debts: visibleDebts,
      form,
      selectedAgreement: selectedAgreement as ClientAgreement,
      selectedCurrency: selectedCurrency as Currency,
      selectedCurrencyRegister: selectedCurrencyRegister as PaymentCurrencyRegister,
      selectedOrganization: selectedOrganization as Organization,
      selectedPaymentClient: selectedPaymentClient as Client,
      selectedRegister: selectedRegister as PaymentRegister,
    })

    setSaving(true)
    setError(null)

    try {
      await createIncomeCashflow(payload, form.autoAllocate)
      notifications.show({
        color: 'green',
        message: t('Оплату магазину створено'),
      })
      navigate(INCOME_CASHFLOWS_PATH, { replace: true, state: { mutated: true } })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити оплату магазину'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppDrawer
      className="income-cashflow-shop-form-drawer"
      opened
      position="right"
      size="wide"
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Оплата retail-клієнта')}</span>}
      onClose={() => navigate(INCOME_CASHFLOWS_PATH)}
      footer={
        <Button
          color={CREATE_ACTION_COLOR}
          disabled={isLoading || isResolvingClient || isSaving}
          form="income-cashflow-shop-form"
          leftSection={<Save size={16} />}
          loading={isSaving}
          type="submit"
        >
          {t('Зберегти')}
        </Button>
      }
    >
      <form className="income-cashflow-shop-form" id="income-cashflow-shop-form" onSubmit={handleSubmit}>
        <Stack gap="md">
          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <Stack gap="sm">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Клієнт магазину')}
            </Text>
            <SearchableSelect
              data={retailClientOptions}
              disabled={isLoading || isResolvingClient || isSaving}
              label={t('Retail-клієнт')}
              placeholder={t('Імʼя або телефон')}
              value={form.retailClientSearch}
              onChange={handleRetailClientSearchChanged}
              onOptionSubmit={handleRetailClientSubmit}
            />
          </Stack>

          <Stack gap="sm">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Реквізити оплати')}
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
              <Group align="flex-end" gap="xs" wrap="nowrap">
                <SearchableSelect
                  data={movementOptions}
                  disabled={isLoading || isSaving}
                  label={t('Стаття руху коштів')}
                  maxLength={INCOME_CASHFLOW_TEXT_LIMITS.movementName}
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

          {selectedCurrency && selectedAgreementCurrency && getEntityValue(selectedCurrency) !== getEntityValue(selectedAgreementCurrency) && (
            <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
              {t('Валюта рахунку відрізняється від валюти договору')}
            </Alert>
          )}

          {form.amount > 0 && selectedAgreementCurrency && selectedCurrency && (
            <div className="income-cashflow-client-form__exchange-summary">
              <span>{t('До зарахування')}</span>
              <strong className="app-money">
                {formatMoney(calculatedValue || form.amount)} {selectedAgreementCurrency.Code || selectedAgreementCurrency.Name}
              </strong>
              <small>
                {selectedCurrency.Code || selectedCurrency.Name} → {selectedAgreementCurrency.Code || selectedAgreementCurrency.Name}
              </small>
            </div>
          )}

          <Stack gap="sm">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Деталі та облік')}
            </Text>
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

          {selectedPaymentClient && (
            <Stack className="income-cashflow-client-form__debts" gap="sm">
              <Group className="income-cashflow-client-form__debts-header" justify="space-between" wrap="wrap">
                <Text className="app-section-title" fw={600} size="sm">
                  {t('Рахунки клієнта')}
                </Text>
                {(Boolean(selectedAgreement?.CurrentAmount) || debtTotal > 0) && (
                  <div className="income-cashflow-client-form__debt-metrics">
                    {selectedAgreement?.CurrentAmount ? (
                      <div className="income-cashflow-client-form__debt-metric">
                        <span>{t('Баланс договору')}</span>
                        <strong className="app-money">
                          {formatMoney(selectedAgreement.CurrentAmount)} {selectedAgreementCurrency?.Code || ''}
                        </strong>
                      </div>
                    ) : null}
                    {debtTotal > 0 && (
                      <div className="income-cashflow-client-form__debt-metric is-accent">
                        <span>{t('Борг за договором')}</span>
                        <strong className="app-money">{formatMoney(debtTotal)} {selectedAgreementCurrency?.Code || ''}</strong>
                      </div>
                    )}
                  </div>
                )}
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
                    <IncomeCashflowShopDebtTable
                      currencyCode={selectedAgreementCurrency?.Code || ''}
                      debts={visibleDebts}
                      disabled={isSaving}
                      selectedDebtValues={form.selectedDebtValues}
                      onChecked={handleDebtChecked}
                    />
                  </div>
                </>
              ) : (
                <Text className="income-cashflow-client-form__debts-empty" size="sm">
                  {t('По вибраному договору рахунків немає')}
                </Text>
              )}
            </Stack>
          )}
        </Stack>
      </form>
    </AppDrawer>
  )
}

function IncomeCashflowShopDebtTable({
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
              aria-label={t('Вибрати рахунок')}
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
      defaultLayout={SHOP_DEBTS_TABLE_DEFAULT_LAYOUT}
      emptyText={t('По вибраному договору рахунків немає')}
      enablePinning={false}
      getRowId={(debt, index) => getIncomeCashflowDebtTargetValue(debt) || String(index)}
      layoutVersion="income-cashflow-shop-debts-1"
      minWidth={720}
      showDensityToggle={false}
      showLayoutControls={false}
      tableId="income-cashflow-shop-debts"
    />
  )
}

function createInitialForm(queryAmount: number): FormState {
  const now = new Date()

  return {
    amount: queryAmount || 0,
    autoAllocate: false,
    comment: '',
    date: formatLocalDate(now),
    exchangeRate: 0,
    isAccounting: false,
    isManagementAccounting: true,
    movementSearch: '',
    organizationValue: '',
    paymentRegisterValue: '',
    retailClientSearch: '',
    selectedAgreementValue: '',
    selectedCurrencyValue: '',
    selectedDebtValues: [],
    selectedMovementValue: '',
    selectedRetailClientValue: '',
    time: toTimeValue(now),
  }
}

function createExchangeCalculationKey({
  amount,
  exchangeRate,
  fromCurrencyId,
  toCurrencyId,
}: {
  amount: number
  exchangeRate: number
  fromCurrencyId?: number
  toCurrencyId?: number
}): string {
  return [amount, exchangeRate || 0, fromCurrencyId || 0, toCurrencyId || 0].join(':')
}

function resolveCalculatedValue({
  amount,
  calculation,
  calculationKey,
  fromCurrencyId,
  toCurrencyId,
}: {
  amount: number
  calculation: ExchangeCalculationState | null
  calculationKey: string
  fromCurrencyId?: number
  toCurrencyId?: number
}): number {
  if (!amount || !fromCurrencyId || !toCurrencyId) {
    return 0
  }

  if (fromCurrencyId === toCurrencyId) {
    return amount
  }

  return calculation?.key === calculationKey ? calculation.value : 0
}

function buildIncomePaymentOrder({
  activeMovement,
  debts,
  form,
  selectedAgreement,
  selectedCurrency,
  selectedCurrencyRegister,
  selectedOrganization,
  selectedPaymentClient,
  selectedRegister,
}: {
  activeMovement: PaymentMovement
  debts: ClientInDebt[]
  form: FormState
  selectedAgreement: ClientAgreement
  selectedCurrency: Currency
  selectedCurrencyRegister: PaymentCurrencyRegister
  selectedOrganization: Organization
  selectedPaymentClient: Client
  selectedRegister: PaymentRegister
}): IncomePaymentOrder {
  const selectedClientDebts = selectIncomeCashflowDebtTargets(
    debts,
    form.selectedDebtValues,
  )

  return {
    Amount: form.amount,
    Client: {
      ...selectedPaymentClient,
      ClientAgreements: [selectedAgreement],
      ClientInDebts: selectedClientDebts,
    },
    ClientAgreement: selectedAgreement,
    Comment: form.comment.trim(),
    Currency: selectedCurrency,
    ExchangeRate: form.exchangeRate || undefined,
    FromDate: toIsoDateTime(form.date, form.time),
    IncomePaymentOrderType: resolveIncomePaymentOrderType(
      selectedRegister.Type,
    ),
    IncomePaymentOrderSales: buildIncomeCashflowSaleTargets(
      debts,
      form.selectedDebtValues,
    ),
    IsAccounting: form.isAccounting,
    IsManagementAccounting: form.isManagementAccounting,
    OperationType: IncomePaymentOperationType.ClientPayment,
    Organization: selectedOrganization,
    PaymentCurrencyRegister: selectedCurrencyRegister,
    PaymentMovementOperation: {
      PaymentMovement: activeMovement,
    },
    PaymentRegister: selectedRegister,
  }
}

function validateForm({
  activeMovement,
  amount,
  selectedAgreement,
  selectedCurrency,
  selectedCurrencyRegister,
  selectedOrganization,
  selectedPaymentClient,
  selectedRegister,
  t,
}: {
  activeMovement: PaymentMovement | null
  amount: number
  selectedAgreement: ClientAgreement | null
  selectedCurrency: Currency | null
  selectedCurrencyRegister: PaymentCurrencyRegister | null
  selectedOrganization: Organization | null
  selectedPaymentClient: Client | null
  selectedRegister: PaymentRegister | null
  t: (value: string) => string
}): string | null {
  if (!amount || amount <= 0) {
    return t('Сума має бути більшою за нуль')
  }

  if (!selectedPaymentClient) {
    return t('Оберіть retail-клієнта')
  }

  if (!selectedAgreement?.Agreement) {
    return t('Оберіть договір')
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

  if (!activeMovement) {
    return t('Оберіть статтю руху коштів')
  }

  return null
}

function validateDebtSelection({
  autoAllocate,
  selectedDebtValues,
  t,
  visibleDebts,
}: {
  autoAllocate: boolean
  selectedDebtValues: string[]
  t: (value: string) => string
  visibleDebts: ClientInDebt[]
}): string | null {
  if (!visibleDebts.length) {
    return null
  }

  if (!selectedDebtValues.length) {
    return autoAllocate ? t('Оберіть рахунок для автоматичного рознесення') : t('Оберіть рахунок для оплати')
  }

  const visibleDebtValues = new Set(
    visibleDebts.map(getIncomeCashflowDebtTargetValue),
  )

  return selectedDebtValues.some((value) => visibleDebtValues.has(value))
    ? null
    : t('Оберіть рахунок для оплати')
}

function collectOrganizations(agreements: ClientAgreement[]): Organization[] {
  const organizations = new Map<string, Organization>()

  agreements.forEach((clientAgreement) => {
    const organization = clientAgreement.Agreement?.Organization
    const value = getEntityValue(organization)

    if (organization && value && !organizations.has(value)) {
      organizations.set(value, organization)
    }
  })

  return Array.from(organizations.values())
}

function filterClientAgreementsByOrganization(agreements: ClientAgreement[], organization: Organization): ClientAgreement[] {
  return agreements.filter(
    (agreement) =>
      agreement.Agreement?.OrganizationId === organization.Id ||
      getEntityValue(agreement.Agreement?.Organization) === getEntityValue(organization),
  )
}

function selectClientAgreement(agreements: ClientAgreement[], selectedAgreementId?: string): ClientAgreement | null {
  if (selectedAgreementId) {
    const agreement = agreements.find(
      (item) =>
        String(item.Id || '') === selectedAgreementId ||
        String(item.AgreementId || '') === selectedAgreementId ||
        getEntityValue(item.Agreement) === selectedAgreementId,
    )

    if (agreement) {
      return agreement
    }
  }

  return selectDefaultClientAgreement(agreements)
}

function selectDefaultClientAgreement(agreements: ClientAgreement[]): ClientAgreement | null {
  const agreementsWithDebt = agreements.filter((agreement) => (agreement.Agreement?.ClientInDebts || []).length > 0)

  return agreementsWithDebt.length === 1 ? agreementsWithDebt[0] : agreements[0] || null
}

function readPaymentClient(agreement: ClientAgreement | null, retailClient?: RetailClient | null): Client | null {
  return agreement?.Client || agreement?.Agreement?.Client || retailClient?.Client || null
}

function collectClientDebts(client: Client | null, agreements: ClientAgreement[]): ClientInDebt[] {
  if (client?.ClientInDebts?.length) {
    return client.ClientInDebts
  }

  return agreements.flatMap((agreement) => agreement.Agreement?.ClientInDebts || [])
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
      (!debt.Agreement ||
        debt.Agreement.OrganizationId === organization.Id ||
        getEntityValue(debt.Agreement.Organization) === getEntityValue(organization)),
  )
}

function selectDefaultRegister(paymentRegisters: PaymentRegister[], organization: Organization | null, preferMain: boolean): PaymentRegister | null {
  const organizationRegisters = paymentRegisters.filter((register) => matchesRegister(register, organization))
  const mainRegister = preferMain ? organizationRegisters.find((register) => register.IsMain) : null

  return mainRegister || organizationRegisters[0] || null
}

function matchesRegister(register: PaymentRegister, organization: Organization | null): boolean {
  if (!organization) {
    return true
  }

  return getEntityValue(register.Organization) === getEntityValue(organization) || register.OrganizationId === organization.Id
}

function matchesDebtSaleId(debt: ClientInDebt, saleId: string): boolean {
  return String(debt.SaleId || debt.Sale?.Id || debt.ReSaleId || debt.ReSale?.Id || '') === saleId
}

function getDebtValuesBySaleId(debts: ClientInDebt[], saleId: string): string[] {
  const values: string[] = []

  for (const debt of debts) {
    if (matchesDebtSaleId(debt, saleId)) {
      values.push(getIncomeCashflowDebtTargetValue(debt))
    }
  }

  return values
}

function toEntityOptions<T extends NamedEntity>(entities: T[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const entity of entities) {
    const value = getEntityValue(entity)

    if (value) {
      options.push({
        label: getEntityName(entity) || value,
        value,
      })
    }
  }

  return options
}

function toCurrencyOptions(register?: PaymentRegister | null): SelectOption[] {
  const options: SelectOption[] = []

  for (const currencyRegister of register?.PaymentCurrencyRegisters || []) {
    const currency = currencyRegister.Currency
    const value = getEntityValue(currency)

    if (value) {
      const balance = typeof currencyRegister.Amount === 'number' ? ` (${moneyFormatter.format(currencyRegister.Amount)})` : ''

      options.push({
        label: `${currency?.Code || currency?.Name || value}${balance}`,
        value,
      })
    }
  }

  return options
}

function toClientAgreementOptions(agreements: ClientAgreement[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const clientAgreement of agreements) {
    const agreement = clientAgreement.Agreement
    const currency = agreement?.Currency
    const value = getEntityValue(agreement)

    if (value) {
      options.push({
        label: joinTruthyParts(agreement?.Name || agreement?.Number || value, currency?.Code || currency?.Name),
        value,
      })
    }
  }

  return options
}

function toRetailClientLabels(clients: RetailClient[]): string[] {
  const labels: string[] = []
  const seenLabels = new Set<string>()

  for (const client of clients) {
    appendUniqueTruthyLabel(labels, seenLabels, getRetailClientLabel(client))
  }

  return labels
}

function toUniqueLabels<T extends NamedEntity>(entities: T[]): string[] {
  const labels: string[] = []
  const seenLabels = new Set<string>()

  for (const entity of entities) {
    appendUniqueTruthyLabel(labels, seenLabels, getEntityName(entity))
  }

  return labels
}

function appendUniqueTruthyLabel(labels: string[], seenLabels: Set<string>, label: string): void {
  if (label && !seenLabels.has(label)) {
    seenLabels.add(label)
    labels.push(label)
  }
}

function joinTruthyParts(...parts: Array<string | undefined>): string {
  const labels: string[] = []

  for (const part of parts) {
    if (part) {
      labels.push(part)
    }
  }

  return labels.join(' ')
}

function includeEntity<T extends NamedEntity>(entities: T[], entity: T): T[] {
  const entityValue = getEntityValue(entity)

  if (!entityValue || entities.some((item) => getEntityValue(item) === entityValue)) {
    return entities
  }

  return [entity, ...entities]
}

function getRetailClientLabel(client?: RetailClient | null): string {
  if (!client) {
    return ''
  }

  return joinTruthyParts(client.Name || client.FullName || getEntityName(client), client.PhoneNumber || '')
}

function getEntityValue(entity?: NamedEntity | null): string {
  return String(entity?.NetUid || entity?.Id || '')
}

function getEntityName(entity?: NamedEntity | null): string {
  return joinTruthyParts(entity?.FirstName || '', entity?.LastName || '') || entity?.FullName || entity?.Name || entity?.OperationName || entity?.Code || entity?.Number || ''
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

function formatMoney(value?: number): string {
  return moneyFormatter.format(value || 0)
}

function formatDate(value?: string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
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

function toNumber(value: string | number | null): number {
  if (value == null) {
    return 0
  }

  const parsed = typeof value === 'number' ? value : Number(value.replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : 0
}
