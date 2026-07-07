import { Alert, Autocomplete, Button, Grid, Group, NumberInput, Select, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Plus } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import {
  createIncomeCashflowPaymentMovement,
  getIncomeCashflowClientAgreements,
  getIncomeCashflowOrganizations,
  getIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentRegisters,
} from '../../income-cashflows/api/incomeCashflowsApi'
import type { ClientAgreement, NamedEntity, PaymentMovement } from '../../income-cashflows/types'
import { createOutcomeOrderFromSad, createOutcomeOrderFromTaxFree } from '../api/documentOutcomePaymentApi'
import type {
  DocumentOutcomePaymentSource,
  OutcomeOrganization,
  OutcomePaymentOrder,
  OutcomePaymentRegister,
} from '../types'

const SEARCH_DEBOUNCE_MS = 300
const SELECT_PAYMENT_MOVEMENT = 'Виберіть статтю грошових витрат'

type FormState = {
  amount: number
  comment: string
  fromDate: string
  movementSearch: string
  organizationValue: string
  paymentRegisterValue: string
  selectedAgreementValue: string
  selectedMovementValue: string
}

export function DocumentOutcomePaymentModal({
  onClose,
  onCreated,
  opened,
  source,
}: {
  onClose: () => void
  onCreated?: () => void
  opened: boolean
  source: DocumentOutcomePaymentSource | null
}) {
  const { t } = useI18n()
  const [organizations, setOrganizations] = useValueState<OutcomeOrganization[]>([])
  const [paymentRegisters, setPaymentRegisters] = useValueState<OutcomePaymentRegister[]>([])
  const [paymentMovements, setPaymentMovements] = useValueState<PaymentMovement[]>([])
  const [clientAgreements, setClientAgreements] = useValueState<ClientAgreement[]>([])
  const [form, setForm] = useValueState<FormState>(() => createInitialForm())
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)

  const documentNetId = source?.documentNetId || ''
  const minDate = getMinPaymentDate(source)
  const maxDate = getMaxPaymentDate(source)

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => getEntityValue(organization) === form.organizationValue) || null,
    [form.organizationValue, organizations],
  )
  const selectedRegister = useMemo(
    () => paymentRegisters.find((register) => getEntityValue(register) === form.paymentRegisterValue) || null,
    [form.paymentRegisterValue, paymentRegisters],
  )
  const selectedAgreement = useMemo(
    () => clientAgreements.find((agreement) => getEntityValue(agreement.Agreement) === form.selectedAgreementValue) || null,
    [clientAgreements, form.selectedAgreementValue],
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
  const registerOptions = useMemo(() => toEntityOptions(paymentRegisters), [paymentRegisters])
  const agreementOptions = useMemo(() => toAgreementOptions(clientAgreements), [clientAgreements])
  const movementOptions = useMemo(() => toUniqueLabels(paymentMovements), [paymentMovements])
  const currencyRegister = useMemo(() => pickCurrencyRegister(selectedRegister), [selectedRegister])
  const currencyLabel = currencyRegister?.Currency?.Code || currencyRegister?.Currency?.Name || ''

  useEffect(() => {
    if (!opened || !source) {
      return
    }

    let cancelled = false

    async function loadData(activeSource: DocumentOutcomePaymentSource) {
      setLoading(true)
      setError(null)

      try {
        const [nextOrganizations, nextRegisters, nextMovements, nextAgreements] = await Promise.all([
          getIncomeCashflowOrganizations() as Promise<OutcomeOrganization[]>,
          searchIncomeCashflowPaymentRegisters('') as Promise<OutcomePaymentRegister[]>,
          getIncomeCashflowPaymentMovements(),
          activeSource.clientNetId
            ? getIncomeCashflowClientAgreements(activeSource.clientNetId).catch((agreementsError) => {
                if (!cancelled) {
                  setError(agreementsError instanceof Error ? agreementsError.message : t('Не вдалося завантажити договори'))
                }

                return [] as ClientAgreement[]
              })
            : Promise.resolve([] as ClientAgreement[]),
        ])

        if (cancelled) {
          return
        }

        const defaultOrganization = pickDefaultOrganization(nextOrganizations)
        const defaultRegister = nextRegisters[0] || null
        const defaultAgreement = nextAgreements[0] || null

        setOrganizations(nextOrganizations)
        setPaymentRegisters(nextRegisters)
        setPaymentMovements(nextMovements)
        setClientAgreements(nextAgreements)
        setForm(() => ({
          ...createInitialForm(),
          amount: activeSource.amount || 0,
          fromDate: getInitialPaymentDate(activeSource),
          organizationValue: defaultOrganization ? getEntityValue(defaultOrganization) : '',
          paymentRegisterValue: defaultRegister ? getEntityValue(defaultRegister) : '',
          selectedAgreementValue: defaultAgreement?.Agreement ? getEntityValue(defaultAgreement.Agreement) : '',
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

    void loadData(source)

    return () => {
      cancelled = true
    }
  }, [
    opened,
    source,
    setClientAgreements,
    setError,
    setForm,
    setLoading,
    setOrganizations,
    setPaymentMovements,
    setPaymentRegisters,
    t,
  ])

  useEffect(() => {
    if (!opened) {
      return
    }

    const value = form.movementSearch.trim()
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchIncomeCashflowPaymentMovements(value).then(setPaymentMovements).catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [form.movementSearch, opened, setPaymentMovements])

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }))
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

  async function handleSubmit() {
    if (!source) {
      return
    }

    if (!selectedOrganization) {
      setError(t('Оберіть організацію'))
      return
    }

    if (!selectedRegister || !currencyRegister) {
      setError(t('Оберіть касу / рахунок і валюту'))
      return
    }

    if (source.type === 'taxfree' && !selectedAgreement) {
      setError(t('Оберіть договір'))
      return
    }

    if (!form.amount || form.amount <= 0) {
      setError(t('Сума має бути більшою за нуль'))
      return
    }

    if (isDateOutsideRange(form.fromDate, minDate, maxDate)) {
      setError(t('Дата виходить за дозволений період'))
      return
    }

    if (!activeMovement) {
      setError(t(SELECT_PAYMENT_MOVEMENT))
      return
    }

    const order: OutcomePaymentOrder = {
      Amount: form.amount,
      ClientAgreement: selectedAgreement,
      Comment: form.comment.trim(),
      FromDate: toIsoDate(form.fromDate),
      Organization: selectedOrganization,
      PaymentCurrencyRegister: currencyRegister,
      PaymentMovementOperation: {
        PaymentMovement: activeMovement,
      },
    }

    setSaving(true)
    setError(null)

    try {
      if (source.type === 'taxfree') {
        await createOutcomeOrderFromTaxFree(documentNetId, order)
      } else {
        await createOutcomeOrderFromSad(documentNetId, order)
      }

      notifications.show({ color: 'green', message: t('Видатковий ордер створено') })
      onCreated?.()
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити видатковий ордер'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal centered opened={opened} size="lg" title={t('Створити видатковий ордер')} onClose={onClose}>
      <Stack gap="md">
        {source?.clientName && (
          <Text size="sm">
            {t('Клієнт')}: {source.clientName}
          </Text>
        )}

        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <Grid gap="sm">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              data={organizationOptions}
              disabled={!organizationOptions.length || isLoading || isSaving}
              label={t('Організація')}
              searchable
              value={form.organizationValue || null}
              onChange={(value) => updateForm({ organizationValue: value || '' })}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              data={registerOptions}
              disabled={!registerOptions.length || isLoading || isSaving}
              label={t('Каса / рахунок')}
              searchable
              value={form.paymentRegisterValue || null}
              onChange={(value) => updateForm({ paymentRegisterValue: value || '' })}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput disabled label={t('Валюта')} value={currencyLabel} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <NumberInput
              allowNegative={false}
              decimalScale={2}
              disabled={isLoading || isSaving}
              label={t('Сума')}
              min={0}
              value={form.amount}
              onChange={(value) => updateForm({ amount: toNumber(value) })}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              data={agreementOptions}
              disabled={!agreementOptions.length || isLoading || isSaving}
              label={t('Договір')}
              searchable
              value={form.selectedAgreementValue || null}
              onChange={(value) => updateForm({ selectedAgreementValue: value || '' })}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              disabled={isLoading || isSaving}
              label={t('Дата')}
              max={maxDate || undefined}
              min={minDate || undefined}
              type="date"
              value={form.fromDate}
              onChange={(event) => updateForm({ fromDate: event.currentTarget.value })}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 9 }}>
            <Autocomplete
              data={movementOptions}
              disabled={isLoading || isSaving}
              label={t('Стаття руху коштів')}
              value={form.movementSearch}
              onChange={(value) => updateForm({ movementSearch: value, selectedMovementValue: '' })}
              onOptionSubmit={handleMovementSubmit}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 3 }}>
            <Button
              disabled={Boolean(activeMovement) || !form.movementSearch.trim() || isLoading || isSaving}
              fullWidth
              leftSection={<Plus size={16} />}
              mt={24}
              type="button"
              variant="outline"
              onClick={() => void handleCreateMovement()}
            >
              {t('Створити статтю')}
            </Button>
          </Grid.Col>
          <Grid.Col span={12}>
            <Textarea
              disabled={isLoading || isSaving}
              label={t('Коментар')}
              minRows={2}
              value={form.comment}
              onChange={(event) => updateForm({ comment: event.currentTarget.value })}
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end">
          <Button color="gray" disabled={isSaving} variant="subtle" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button disabled={isLoading} loading={isSaving} onClick={() => void handleSubmit()}>
            {t('Створити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function createInitialForm(): FormState {
  return {
    amount: 0,
    comment: '',
    fromDate: formatLocalDate(new Date()),
    movementSearch: '',
    organizationValue: '',
    paymentRegisterValue: '',
    selectedAgreementValue: '',
    selectedMovementValue: '',
  }
}

function pickDefaultOrganization(organizations: OutcomeOrganization[]): OutcomeOrganization | null {
  return organizations[0] || null
}

function getInitialPaymentDate(source: DocumentOutcomePaymentSource): string {
  const today = formatLocalDate(new Date())
  const minDate = getMinPaymentDate(source)
  const maxDate = getMaxPaymentDate(source)

  if (maxDate && today > maxDate) {
    return maxDate
  }

  if (minDate && today < minDate) {
    return minDate
  }

  return today
}

function getMinPaymentDate(source: DocumentOutcomePaymentSource | null): string {
  if (!source?.created) {
    return ''
  }

  const createdDate = new Date(source.created)

  return Number.isNaN(createdDate.getTime()) ? '' : formatLocalDate(createdDate)
}

function getMaxPaymentDate(source: DocumentOutcomePaymentSource | null): string {
  if (source?.type !== 'taxfree' || !source.created) {
    return ''
  }

  const createdDate = new Date(source.created)

  if (Number.isNaN(createdDate.getTime())) {
    return ''
  }

  const maxDate = new Date(createdDate)
  maxDate.setMonth(maxDate.getMonth() + 3)

  return formatLocalDate(maxDate)
}

function isDateOutsideRange(value: string, minDate: string, maxDate: string): boolean {
  if (!value) {
    return true
  }

  if (minDate && value < minDate) {
    return true
  }

  return Boolean(maxDate && value > maxDate)
}

function pickCurrencyRegister(register: OutcomePaymentRegister | null) {
  if (!register) {
    return null
  }

  const currencyRegisters = register.PaymentCurrencyRegisters || []
  return register.DefaultPaymentCurrencyRegister || currencyRegisters[0] || null
}

function toAgreementOptions(agreements: ClientAgreement[]) {
  const options: Array<{ label: string; value: string }> = []

  for (const clientAgreement of agreements) {
    const agreement = clientAgreement.Agreement
    const currency = agreement?.Currency
    const value = getEntityValue(agreement)

    if (!value) {
      continue
    }

    const baseLabel = agreement?.Name || agreement?.Number || clientAgreement.Name || value
    const currencyLabel = currency?.Code || currency?.Name

    options.push({
      label: currencyLabel ? `${baseLabel} ${currencyLabel}` : baseLabel,
      value,
    })
  }

  return options
}

function toEntityOptions<T extends NamedEntity>(entities: T[]) {
  const options: Array<{ label: string; value: string }> = []

  for (const entity of entities) {
    const value = getEntityValue(entity)

    if (!value) {
      continue
    }

    options.push({
      label: getEntityName(entity) || getEntityValue(entity),
      value,
    })
  }

  return options
}

function toUniqueLabels<T extends NamedEntity>(entities: T[]): string[] {
  const labels = new Set<string>()

  for (const entity of entities) {
    const label = getEntityName(entity)

    if (label) {
      labels.add(label)
    }
  }

  return Array.from(labels)
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

function toNumber(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value.replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : 0
}

function toIsoDate(dateValue: string): string {
  const date = new Date(`${dateValue || formatLocalDate(new Date())}T00:00`)

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}
