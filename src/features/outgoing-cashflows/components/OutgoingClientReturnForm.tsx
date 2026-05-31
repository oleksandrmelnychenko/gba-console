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
import {
  createIncomeCashflowPaymentMovement,
  getIncomeCashflowClientAgreements,
  getIncomeCashflowOrganizations,
  getIncomeCashflowPaymentMovements,
  getIncomeCashflowSpecificExchangeRate,
  searchIncomeCashflowClientPayers,
  searchIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentRegisters,
} from '../../income-cashflows/api/incomeCashflowsApi'
import type {
  Client,
  ClientAgreement,
  Organization,
  PaymentMovement,
  PaymentRegister,
} from '../../income-cashflows/types'
import { createOutgoingCashflowOrder } from '../api/outgoingCashflowCreateApi'
import type {
  CreatePaymentCurrencyRegister,
  CreatePaymentRegister,
  OutcomePaymentOrderCreatePayload,
} from '../outgoingCreateTypes'
import {
  SEARCH_DEBOUNCE_MS,
  balanceLabelOf,
  defaultRegisterOf,
  getEntityName,
  getEntityValue,
  includeEntity,
  moneyFormatter,
  pickRegistersForOrganization,
  selectedCurrencyRegisterOf,
  toClientAgreementOptions,
  toCurrencyOptions,
  toEntityOptions,
  toIsoDateTime,
  toNumber,
  toTimeValue,
  toUniqueLabels,
} from './outgoingModeShared'

type OutgoingClientReturnFormProps = {
  onCancel: () => void
  onCreated: () => void
}

type FormState = {
  amount: number
  comment: string
  date: string
  exchangeRate: number
  isAccounting: boolean
  isManagementAccounting: boolean
  movementSearch: string
  organizationValue: string
  payerSearch: string
  paymentRegisterValue: string
  selectedAgreementValue: string
  selectedCurrencyValue: string
  selectedMovementValue: string
  time: string
}

export function OutgoingClientReturnForm({ onCancel, onCreated }: OutgoingClientReturnFormProps) {
  const { t } = useI18n()
  const [organizations, setOrganizations] = useValueState<Organization[]>([])
  const [paymentRegisters, setPaymentRegisters] = useValueState<PaymentRegister[]>([])
  const [paymentMovements, setPaymentMovements] = useValueState<PaymentMovement[]>([])
  const [payerClients, setPayerClients] = useValueState<Client[]>([])
  const [selectedClient, setSelectedClient] = useValueState<Client | null>(null)
  const [clientAgreements, setClientAgreements] = useValueState<ClientAgreement[]>([])
  const [form, setForm] = useValueState<FormState>(() => createInitialForm())
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isResolving, setResolving] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => getEntityValue(organization) === form.organizationValue) || null,
    [form.organizationValue, organizations],
  )
  const organizationRegisters = useMemo(
    () => pickRegistersForOrganization(paymentRegisters, selectedOrganization),
    [paymentRegisters, selectedOrganization],
  )
  const selectedRegister = useMemo(
    () => organizationRegisters.find((register) => getEntityValue(register) === form.paymentRegisterValue) || null,
    [form.paymentRegisterValue, organizationRegisters],
  )
  const selectedCurrencyRegister = useMemo(
    () => selectedCurrencyRegisterOf(selectedRegister, form.selectedCurrencyValue),
    [form.selectedCurrencyValue, selectedRegister],
  )
  const selectedCurrency = selectedCurrencyRegister?.Currency || null
  const selectedClientAgreement = useMemo(
    () => clientAgreements.find((agreement) => getEntityValue(agreement.Agreement) === form.selectedAgreementValue) || null,
    [clientAgreements, form.selectedAgreementValue],
  )
  const agreementCurrency = selectedClientAgreement?.Agreement?.Currency || null
  const selectedMovement = useMemo(
    () => paymentMovements.find((movement) => getEntityValue(movement) === form.selectedMovementValue) || null,
    [form.selectedMovementValue, paymentMovements],
  )
  const activeMovement = useMemo(
    () => selectedMovement || paymentMovements.find((movement) => getEntityName(movement) === form.movementSearch.trim()) || null,
    [form.movementSearch, paymentMovements, selectedMovement],
  )

  const organizationOptions = useMemo(() => toEntityOptions(organizations), [organizations])
  const registerOptions = useMemo(() => toEntityOptions(organizationRegisters), [organizationRegisters])
  const currencyOptions = useMemo(() => toCurrencyOptions(selectedRegister), [selectedRegister])
  const agreementOptions = useMemo(() => toClientAgreementOptions(clientAgreements), [clientAgreements])
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

        const defaultOrganization = nextOrganizations[0] || null
        const defaultRegister = defaultRegisterOf(pickRegistersForOrganization(nextRegisters, defaultOrganization))
        const defaultCurrency = defaultRegister?.PaymentCurrencyRegisters?.[0]?.Currency || null

        setOrganizations(nextOrganizations)
        setPaymentRegisters(nextRegisters)
        setPaymentMovements(nextMovements)
        setForm((current) => ({
          ...current,
          organizationValue: defaultOrganization ? getEntityValue(defaultOrganization) : '',
          paymentRegisterValue: defaultRegister ? getEntityValue(defaultRegister) : '',
          selectedCurrencyValue: defaultCurrency ? getEntityValue(defaultCurrency) : '',
        }))
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
  }, [setError, setForm, setLoading, setOrganizations, setPaymentMovements, setPaymentRegisters, t])

  useEffect(() => {
    const value = form.payerSearch.trim()
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        setPayerClients([])
        return
      }

      void searchIncomeCashflowClientPayers(value).then(setPayerClients).catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [form.payerSearch, setPayerClients])

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

  function handleOrganizationChanged(value: string | null) {
    const organization = organizations.find((item) => getEntityValue(item) === value) || null
    const nextRegister = defaultRegisterOf(pickRegistersForOrganization(paymentRegisters, organization))
    const nextCurrency = nextRegister?.PaymentCurrencyRegisters?.[0]?.Currency || null

    updateForm({
      organizationValue: value || '',
      paymentRegisterValue: nextRegister ? getEntityValue(nextRegister) : '',
      selectedCurrencyValue: nextCurrency ? getEntityValue(nextCurrency) : '',
    })
  }

  function handleRegisterChanged(value: string | null) {
    const register = organizationRegisters.find((item) => getEntityValue(item) === value) || null
    const nextCurrency = register?.PaymentCurrencyRegisters?.[0]?.Currency || null

    updateForm({
      paymentRegisterValue: value || '',
      selectedCurrencyValue: nextCurrency ? getEntityValue(nextCurrency) : '',
    })
  }

  async function handlePayerSubmit(value: string) {
    const client = payerClients.find((item) => getEntityName(item) === value)

    if (!client) {
      return
    }

    setResolving(true)
    setError(null)

    try {
      const nextAgreements = client.NetUid
        ? await getIncomeCashflowClientAgreements(client.NetUid).catch(() => client.ClientAgreements || [])
        : client.ClientAgreements || []
      const nextAgreement = nextAgreements[0] || null

      setSelectedClient(client)
      setClientAgreements(nextAgreements)
      updateForm({
        payerSearch: value,
        selectedAgreementValue: nextAgreement?.Agreement ? getEntityValue(nextAgreement.Agreement) : '',
      })
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : t('Не вдалося виконати запит'))
    } finally {
      setResolving(false)
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
      setError(createError instanceof Error ? createError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedOrganization) {
      setError(t('Організація'))
      return
    }

    if (!selectedRegister) {
      setError(t('Грошові рахунки'))
      return
    }

    if (!selectedCurrencyRegister) {
      setError(t('Валюта'))
      return
    }

    if (!selectedClient) {
      setError(t('Оберіть контрагента'))
      return
    }

    if (!selectedClientAgreement) {
      setError(t('Договір'))
      return
    }

    if (!form.amount || form.amount <= 0) {
      setError(t('Сума'))
      return
    }

    if (!activeMovement) {
      setError(t('Виберіть статтю грошових витрат'))
      return
    }

    const payload: OutcomePaymentOrderCreatePayload = {
      Amount: form.amount,
      ClientAgreement: selectedClientAgreement,
      Comment: form.comment.trim(),
      ExchangeRate: form.exchangeRate || undefined,
      FromDate: toIsoDateTime(form.date, form.time),
      IsAccounting: form.isAccounting,
      IsManagementAccounting: form.isManagementAccounting,
      IsUnderReport: false,
      Organization: selectedOrganization,
      PaymentCurrencyRegister: selectedCurrencyRegister as CreatePaymentCurrencyRegister,
      PaymentMovementOperation: {
        PaymentMovement: activeMovement,
      },
      PaymentRegister: selectedRegister as CreatePaymentRegister,
    }

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

  const balanceLabel = balanceLabelOf(selectedCurrencyRegister, t('Залишки'))

  return (
    <Card withBorder radius="md" shadow="sm">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <Text fw={700} size="xl">
              {t('Повернення клієнту')}
            </Text>
            <Group gap="xs">
              <Button color="gray" leftSection={<IconArrowLeft size={16} />} type="button" variant="light" onClick={onCancel}>
                {t('Скасувати')}
              </Button>
              <Button
                color="violet"
                disabled={isLoading || isResolving || isSaving}
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
              onChange={(value) => updateForm({ amount: toNumber(value) })}
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
              data={payerOptions}
              disabled={isLoading || isSaving}
              label={t('Клієнт')}
              value={form.payerSearch}
              onChange={(value) => updateForm({ payerSearch: value })}
              onOptionSubmit={(value) => void handlePayerSubmit(value)}
            />
            <Select
              data={agreementOptions}
              description={
                selectedClientAgreement && typeof selectedClientAgreement.AccountBalance === 'number'
                  ? `${t('Залишок по рахунку')}: ${moneyFormatter.format(selectedClientAgreement.AccountBalance)}`
                  : undefined
              }
              disabled={!agreementOptions.length || isLoading || isSaving}
              label={t('Договір')}
              searchable
              value={form.selectedAgreementValue || null}
              onChange={(value) => updateForm({ selectedAgreementValue: value || '' })}
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

          <TextInput
            disabled={isLoading || isSaving}
            label={t('Коментар')}
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
    payerSearch: '',
    paymentRegisterValue: '',
    selectedAgreementValue: '',
    selectedCurrencyValue: '',
    selectedMovementValue: '',
    time: toTimeValue(now),
  }
}
