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
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy, IconPlus } from '@tabler/icons-react'
import { type FormEvent, useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  IncomePaymentOrderSale,
  NamedEntity,
  Organization,
  PaymentCurrencyRegister,
  PaymentMovement,
  PaymentRegister,
  RetailClient,
} from '../types'
import { IncomePaymentOperationType, IncomePaymentOrderType, PaymentRegisterType } from '../types'

type FormState = {
  amount: number
  autoAllocate: boolean
  comment: string
  date: string
  debtAmounts: Record<string, number>
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
  const activeMovement = useMemo(
    () => selectedMovement || paymentMovements.find((movement) => getEntityName(movement) === form.movementSearch.trim()) || null,
    [form.movementSearch, paymentMovements, selectedMovement],
  )
  const organizationOptions = useMemo(() => toEntityOptions(organizations), [organizations])
  const registerOptions = useMemo(() => toEntityOptions(filteredPaymentRegisters), [filteredPaymentRegisters])
  const currencyOptions = useMemo(() => toCurrencyOptions(selectedRegister), [selectedRegister])
  const agreementOptions = useMemo(() => toClientAgreementOptions(organizationAgreements), [organizationAgreements])
  const movementOptions = useMemo(() => toUniqueLabels(paymentMovements), [paymentMovements])
  const retailClientOptions = useMemo(() => toRetailClientLabels(retailClients), [retailClients])
  const selectedDebts = useMemo(
    () => visibleDebts.filter((debt) => form.selectedDebtValues.includes(getDebtValue(debt))),
    [form.selectedDebtValues, visibleDebts],
  )
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
      const nextDebtAmounts = nextSelectedDebtValues.length === 1 && amount && !autoAllocate
        ? { [nextSelectedDebtValues[0]]: amount }
        : {}

      setRetailAgreements(agreements)
      setSelectedRetailClient(retailClient || null)
      setForm((current) => ({
        ...current,
        amount: amount || current.amount,
        autoAllocate: Boolean(autoAllocate),
        debtAmounts: nextDebtAmounts,
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

        const defaultMovement = selectDefaultMovement(nextMovements)

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
    const timeoutId = window.setTimeout(() => {
      if (!value || getRetailClientLabel(selectedRetailClient) === value) {
        return
      }

      void searchIncomeCashflowRetailClients(value).then(setRetailClients).catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [form.retailClientSearch, selectedRetailClient, setRetailClients])

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

  async function loadRetailAgreements(netId: string, retailClient: RetailClient | null) {
    if (!netId) {
      return
    }

    setResolvingClient(true)
    setError(null)

    try {
      const agreements = await getIncomeCashflowRetailClientAgreements(netId)

      applyRetailAgreements({
        agreements,
        paymentRegisters,
        retailClient,
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити договори retail-клієнта'))
    } finally {
      setResolvingClient(false)
    }
  }

  function handleRetailClientSubmit(value: string) {
    const retailClient = retailClients.find((client) => getRetailClientLabel(client) === value) || null
    const netId = getEntityValue(retailClient)

    if (!retailClient || !netId) {
      return
    }

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
      debtAmounts: {},
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
      debtAmounts: {},
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

  function handleDebtChecked(debt: ClientInDebt, checked: boolean) {
    const debtValue = getDebtValue(debt)

    setForm((current) => {
      const selectedDebtValues = checked
        ? Array.from(new Set([...current.selectedDebtValues, debtValue]))
        : current.selectedDebtValues.filter((value) => value !== debtValue)
      const debtAmounts = { ...current.debtAmounts }

      if (checked && !debtAmounts[debtValue]) {
        debtAmounts[debtValue] = Math.min(readDebtTotal(debt), current.amount || readDebtTotal(debt))
      }

      if (!checked) {
        delete debtAmounts[debtValue]
      }

      return {
        ...current,
        debtAmounts,
        selectedDebtValues,
      }
    })
  }

  function handleDebtAmountChanged(debt: ClientInDebt, value: string | number) {
    const debtValue = getDebtValue(debt)

    setForm((current) => ({
      ...current,
      debtAmounts: {
        ...current.debtAmounts,
        [debtValue]: toNumber(value),
      },
    }))
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
    }) || validateDebtSelection({
      autoAllocate: form.autoAllocate,
      debtAmounts: form.debtAmounts,
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
      navigate(INCOME_CASHFLOWS_PATH, { replace: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити оплату магазину'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="md">
      <Card withBorder radius="md" shadow="sm">
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Group justify="space-between" wrap="wrap">
              <div>
                <Group gap="xs">
                  <Text fw={700} size="xl">
                    {t('Магазин')}
                  </Text>
                  <Badge color="green" variant="light">
                    {t('Прибутковий ордер')}
                  </Badge>
                </Group>
                <Text c="dimmed" size="sm">
                  {selectedPaymentClient ? getEntityName(selectedPaymentClient) : t('Оплата retail-клієнта')}
                </Text>
              </div>

              <Group gap="xs">
                <Button color="gray" leftSection={<IconArrowLeft size={16} />} type="button" variant="light" onClick={() => navigate(INCOME_CASHFLOWS_PATH)}>
                  {t('Назад')}
                </Button>
                <Button
                  color="violet"
                  disabled={isLoading || isResolvingClient || isSaving}
                  leftSection={<IconDeviceFloppy size={16} />}
                  loading={isSaving}
                  type="submit"
                >
                  {t('Зберегти')}
                </Button>
              </Group>
            </Group>

            {error && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {error}
              </Alert>
            )}

            <Autocomplete
              data={retailClientOptions}
              disabled={isLoading || isResolvingClient || isSaving}
              label={t('Retail-клієнт')}
              placeholder={t('Імʼя або телефон')}
              value={form.retailClientSearch}
              onChange={(value) => updateForm({ retailClientSearch: value, selectedRetailClientValue: '' })}
              onOptionSubmit={handleRetailClientSubmit}
            />

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

            {selectedCurrency && selectedAgreementCurrency && getEntityValue(selectedCurrency) !== getEntityValue(selectedAgreementCurrency) && (
              <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
                {t('Валюта рахунку відрізняється від валюти договору')}
              </Alert>
            )}

            {form.amount > 0 && selectedAgreementCurrency && selectedCurrency && (
              <Group gap="xs">
                <Badge color="blue" variant="light">
                  {t('Зарахування')}: {formatMoney(calculatedValue || form.amount)} {selectedAgreementCurrency.Code || selectedAgreementCurrency.Name}
                </Badge>
                <Badge color="gray" variant="light">
                  {selectedCurrency.Code || selectedCurrency.Name} → {selectedAgreementCurrency.Code || selectedAgreementCurrency.Name}
                </Badge>
              </Group>
            )}

            <Textarea
              disabled={isLoading || isSaving}
              label={t('Коментар')}
              minRows={2}
              value={form.comment}
              onChange={(event) => updateForm({ comment: event.currentTarget.value })}
            />

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

      {selectedPaymentClient && (
        <Card withBorder radius="md" shadow="sm">
          <Stack gap="sm">
            <Group justify="space-between" wrap="wrap">
              <div>
                <Text fw={700}>{t('Рахунки клієнта')}</Text>
                <Text c="dimmed" size="sm">
                  {getEntityName(selectedPaymentClient)}
                </Text>
              </div>
              <Group gap="xs">
                <Badge color="blue" variant="light">
                  {t('Поточний договір')}: {formatMoney(selectedAgreement?.CurrentAmount)}
                </Badge>
                <Badge color="gray" variant="light">
                  {t('Борги по договору')}: {formatMoney(debtTotal)}
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
                                aria-label={t('Вибрати рахунок')}
                                checked={checked}
                                disabled={isSaving}
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
                {selectedDebts.length > 0 && (
                  <Text c="dimmed" size="sm">
                    {t('Вибрано рахунків')}: {selectedDebts.length}
                  </Text>
                )}
              </>
            ) : (
              <Text c="dimmed" size="sm">
                {t('По вибраному договору рахунків немає')}
              </Text>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  )
}

function createInitialForm(queryAmount: number): FormState {
  const now = new Date()

  return {
    amount: queryAmount || 0,
    autoAllocate: false,
    comment: '',
    date: formatLocalDate(now),
    debtAmounts: {},
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
  const selectedClientDebts = pickSelectedDebts(debts, form)

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
    IncomeCashOrderType: selectedRegister.Type === PaymentRegisterType.Cash ? IncomePaymentOrderType.Cash : IncomePaymentOrderType.Transfer,
    IncomePaymentOrderSales: buildIncomePaymentOrderSales(debts, form),
    IsAccounting: form.isAccounting,
    IsManagementAccounting: form.isManagementAccounting,
    OperationType: String(IncomePaymentOperationType.ClientPayment),
    Organization: selectedOrganization,
    PaymentCurrencyRegister: selectedCurrencyRegister,
    PaymentMovementOperation: {
      PaymentMovement: activeMovement,
    },
    PaymentRegister: selectedRegister,
  }
}

function buildIncomePaymentOrderSales(debts: ClientInDebt[], form: FormState): IncomePaymentOrderSale[] {
  return pickSelectedDebts(debts, form).map((debt) => ({
    Amount: form.autoAllocate ? 0 : form.debtAmounts[getDebtValue(debt)] || 0,
    ReSale: debt.ReSale || undefined,
    Sale: debt.Sale || undefined,
  }))
}

function pickSelectedDebts(debts: ClientInDebt[], form: FormState): ClientInDebt[] {
  if (!form.selectedDebtValues.length) {
    return form.autoAllocate ? [] : debts
  }

  return debts.filter((debt) => form.selectedDebtValues.includes(getDebtValue(debt)))
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
  debtAmounts,
  selectedDebtValues,
  t,
  visibleDebts,
}: {
  autoAllocate: boolean
  debtAmounts: Record<string, number>
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

  if (autoAllocate) {
    return null
  }

  const totalPayment = selectedDebtValues.reduce((sum, debtValue) => sum + (debtAmounts[debtValue] || 0), 0)

  return totalPayment > 0 ? null : t('Сума платежу по рахунках має бути більшою за нуль')
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

function selectDefaultMovement(movements: PaymentMovement[]): PaymentMovement | null {
  return movements.find((movement) => movement.OperationName === 'Оплата покупця') || movements[0] || null
}

function matchesDebtSaleId(debt: ClientInDebt, saleId: string): boolean {
  return String(debt.SaleId || debt.Sale?.Id || debt.ReSaleId || debt.ReSale?.Id || '') === saleId
}

function getDebtValuesBySaleId(debts: ClientInDebt[], saleId: string): string[] {
  const values: string[] = []

  for (const debt of debts) {
    if (matchesDebtSaleId(debt, saleId)) {
      values.push(getDebtValue(debt))
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

function getDebtValue(debt: ClientInDebt): string {
  return String(debt.NetUid || debt.Id || debt.Sale?.NetUid || debt.ReSale?.NetUid || debt.Sale?.Id || debt.ReSale?.Id || '')
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
