import { Alert, Autocomplete, Button, Grid, Group, NumberInput, Select, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconPlus } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
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
import type {
  ClientAgreement,
  IncomePaymentOrder,
  Organization,
  PaymentCurrencyRegister,
  PaymentMovement,
  PaymentRegister,
} from '../../income-cashflows/types'
import {
  createAdvancePaymentFromTaxFree,
  createIncomePaymentFromTaxFree,
  type TaxFreeAdvancePaymentPayload,
} from '../api/taxFreeDocumentsApi'
import type { TaxFreeDocument } from '../types'
import { TAX_FREE_CURRENCY_CODE, formatTaxFreeAmountPl, getTaxFreeClient } from '../utils'

const SEARCH_DEBOUNCE_MS = 300
const POLAND_CULTURE = 'pl'
const CASH_REGISTER_TYPE = 0

export type TaxFreePaymentAction = 'advance' | 'income'

type TaxFreePaymentRegister = PaymentRegister & {
  DefaultPaymentCurrencyRegister?: PaymentCurrencyRegister | null
}

type OrganizationWithCulture = Organization & {
  Culture?: string
}

type NameLikeEntity = {
  Code?: string
  FullName?: string
  Id?: number
  LastName?: string
  Name?: string
  NetUid?: string
  Number?: string
  OperationName?: string
}

type FormState = {
  amount: number
  comment: string
  fromDate: string
  movementSearch: string
  organizationValue: string
  paymentRegisterValue: string
  selectedAgreementValue: string
  selectedMovementValue: string
  vatAmount: number
  vatPercent: number
}

type TaxFreePaymentFromTaxFreeModalProps = {
  action: TaxFreePaymentAction | null
  document: TaxFreeDocument | null
  opened: boolean
  onClose: () => void
  onCreated?: () => void
}

export function TaxFreePaymentFromTaxFreeModal({
  action,
  document,
  onClose,
  onCreated,
  opened,
}: TaxFreePaymentFromTaxFreeModalProps) {
  const { t } = useI18n()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [paymentRegisters, setPaymentRegisters] = useState<TaxFreePaymentRegister[]>([])
  const [paymentMovements, setPaymentMovements] = useState<PaymentMovement[]>([])
  const [clientAgreements, setClientAgreements] = useState<ClientAgreement[]>([])
  const [form, setForm] = useState<FormState>(() => createInitialForm())
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [isSaving, setSaving] = useState(false)

  const client = document?.TaxFreePackList?.Client || null
  const isIncome = action === 'income'
  const minDate = isIncome ? toDateFieldValue(document?.Created) : ''
  const maxDate = isIncome ? getMaxPaymentDate(document?.Created) : ''

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
  const selectedCurrencyRegister = useMemo(() => pickCurrencyRegister(selectedRegister), [selectedRegister])
  const currencyLabel = selectedCurrencyRegister?.Currency?.Code || selectedCurrencyRegister?.Currency?.Name || ''

  useEffect(() => {
    if (!opened || !document || !action) {
      return
    }

    let cancelled = false

    async function loadData(activeDocument: TaxFreeDocument) {
      setLoading(true)
      setError(null)

      try {
        const [nextOrganizations, nextAgreements, nextRegisters, nextMovements] = await Promise.all([
          getIncomeCashflowOrganizations(),
          client?.NetUid
            ? getIncomeCashflowClientAgreements(client.NetUid).catch((agreementsError) => {
                if (!cancelled) {
                  setError(agreementsError instanceof Error ? agreementsError.message : t('Не вдалося завантажити договори'))
                }

                return [] as ClientAgreement[]
              })
            : Promise.resolve([] as ClientAgreement[]),
          isIncome ? searchIncomeCashflowPaymentRegisters('') : Promise.resolve([] as PaymentRegister[]),
          isIncome ? getIncomeCashflowPaymentMovements() : Promise.resolve([] as PaymentMovement[]),
        ])

        if (cancelled) {
          return
        }

        const taxFreeRegisters = filterTaxFreeRegisters(nextRegisters)
        const defaultOrganization = pickDefaultOrganization(nextOrganizations)
        const defaultAgreement = nextAgreements[0] || null
        const defaultRegister = taxFreeRegisters[0] || null
        const defaultMovement = nextMovements[0] || null

        setOrganizations(nextOrganizations)
        setClientAgreements(nextAgreements)
        setPaymentRegisters(taxFreeRegisters)
        setPaymentMovements(nextMovements)
        setForm({
          ...createInitialForm(),
          amount: activeDocument.VatAmountPl ?? 0,
          fromDate: getInitialPaymentDate(activeDocument, isIncome),
          organizationValue: defaultOrganization ? getEntityValue(defaultOrganization) : '',
          paymentRegisterValue: defaultRegister ? getEntityValue(defaultRegister) : '',
          selectedAgreementValue: defaultAgreement?.Agreement ? getEntityValue(defaultAgreement.Agreement) : '',
          selectedMovementValue: defaultMovement ? getEntityValue(defaultMovement) : '',
          movementSearch: defaultMovement?.OperationName || '',
          vatPercent: activeDocument.VatPercent ?? 23,
        })
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити довідники'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadData(document)

    return () => {
      cancelled = true
    }
  }, [action, client?.NetUid, document, isIncome, opened, t])

  useEffect(() => {
    if (!opened || !isIncome) {
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
  }, [form.movementSearch, isIncome, opened])

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
    if (!document?.NetUid || !action) {
      return
    }

    const validationError = validateForm({
      activeMovement,
      form,
      isIncome,
      maxDate,
      minDate,
      selectedAgreement,
      selectedCurrencyRegister,
      selectedOrganization,
      selectedRegister,
      t,
    })

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (isIncome) {
        const order: IncomePaymentOrder = {
          Amount: form.amount,
          ClientAgreement: selectedAgreement || undefined,
          Comment: form.comment.trim(),
          Currency: selectedCurrencyRegister?.Currency || undefined,
          FromDate: toIsoDate(form.fromDate),
          Organization: selectedOrganization,
          PaymentMovementOperation: {
            PaymentMovement: activeMovement,
          },
          PaymentRegister: selectedCurrencyRegister?.PaymentRegister || undefined,
        }

        await createIncomePaymentFromTaxFree(document.NetUid, order)
      } else {
        const advancePayment: TaxFreeAdvancePaymentPayload = {
          Amount: form.amount,
          ClientAgreement: selectedAgreement || undefined,
          Comment: form.comment.trim(),
          FromDate: toIsoDate(form.fromDate),
          Organization: selectedOrganization,
          VatAmount: form.vatAmount,
          VatPercent: form.vatPercent,
        }

        await createAdvancePaymentFromTaxFree(document.NetUid, advancePayment)
      }

      notifications.show({ color: 'green', message: isIncome ? t('Прибутковий ордер створено') : t('Авансовий платіж створено') })
      onCreated?.()
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити платіж'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal centered opened={opened} size="lg" title={getTitle(action, t)} onClose={onClose}>
      <Stack gap="md">
        {document ? (
          <Stack gap={2}>
            <Text size="sm">
              {t('Клієнт')}: {getTaxFreeClient(document)}
            </Text>
            <Text size="sm" c="dimmed">
              {t('Tax Free')}: {document.Number || document.NetUid}
            </Text>
            <Text size="sm">
              {t('Сума')}: {formatTaxFreeAmountPl(document.VatAmountPl)}
            </Text>
          </Stack>
        ) : null}

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <Grid gap="sm">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              data={toEntityOptions(organizations)}
              disabled={!organizations.length || isLoading || isSaving}
              label={t('Організація')}
              searchable
              value={form.organizationValue || null}
              onChange={(value) => updateForm({ organizationValue: value || '' })}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              data={toAgreementOptions(clientAgreements)}
              disabled={!clientAgreements.length || isLoading || isSaving}
              label={t('Договір')}
              searchable
              value={form.selectedAgreementValue || null}
              onChange={(value) => updateForm({ selectedAgreementValue: value || '' })}
            />
          </Grid.Col>

          {isIncome && (
            <>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Select
                  data={toEntityOptions(paymentRegisters)}
                  disabled={!paymentRegisters.length || isLoading || isSaving}
                  label={t('Каса / рахунок')}
                  searchable
                  value={form.paymentRegisterValue || null}
                  onChange={(value) => updateForm({ paymentRegisterValue: value || '' })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput disabled label={t('Валюта')} value={currencyLabel} />
              </Grid.Col>
            </>
          )}

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

          {!isIncome && (
            <>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <NumberInput
                  allowNegative={false}
                  decimalScale={2}
                  disabled={isLoading || isSaving}
                  label={t('ПДВ %')}
                  min={0}
                  value={form.vatPercent}
                  onChange={(value) => updateForm({ vatPercent: toNumber(value) })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <NumberInput
                  allowNegative={false}
                  decimalScale={2}
                  disabled={isLoading || isSaving}
                  label={t('Сума з ПДВ')}
                  min={0}
                  value={form.vatAmount}
                  onChange={(value) => updateForm({ vatAmount: toNumber(value) })}
                />
              </Grid.Col>
            </>
          )}

          {isIncome && (
            <>
              <Grid.Col span={{ base: 12, sm: 9 }}>
                <Autocomplete
                  data={toUniqueLabels(paymentMovements)}
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
                  leftSection={<IconPlus size={16} />}
                  mt={24}
                  type="button"
                  variant="light"
                  onClick={() => void handleCreateMovement()}
                >
                  {t('Створити статтю')}
                </Button>
              </Grid.Col>
            </>
          )}

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
    vatAmount: 0,
    vatPercent: 23,
  }
}

function validateForm({
  activeMovement,
  form,
  isIncome,
  maxDate,
  minDate,
  selectedAgreement,
  selectedCurrencyRegister,
  selectedOrganization,
  selectedRegister,
  t,
}: {
  activeMovement: PaymentMovement | null
  form: FormState
  isIncome: boolean
  maxDate: string
  minDate: string
  selectedAgreement: ClientAgreement | null
  selectedCurrencyRegister: PaymentCurrencyRegister | null
  selectedOrganization: Organization | null
  selectedRegister: TaxFreePaymentRegister | null
  t: (key: string) => string
}): string | null {
  if (!selectedOrganization) {
    return t('Оберіть організацію')
  }

  if (!selectedAgreement) {
    return t('Оберіть договір')
  }

  if (!form.amount || form.amount <= 0) {
    return t('Сума має бути більшою за нуль')
  }

  if (form.vatAmount < 0 || form.vatPercent < 0) {
    return t('ПДВ не може бути відʼємним')
  }

  if (isDateOutsideRange(form.fromDate, minDate, maxDate)) {
    return t('Дата виходить за дозволений період')
  }

  if (isIncome && (!selectedRegister || !selectedCurrencyRegister || !activeMovement)) {
    return t('Оберіть касу / рахунок, валюту та статтю руху коштів')
  }

  return null
}

function getTitle(action: TaxFreePaymentAction | null, t: (key: string) => string): string {
  return action === 'income' ? t('Створити прибутковий касовий ордер') : t('Створити авансовий платіж')
}

function pickCurrencyRegister(register: TaxFreePaymentRegister | null) {
  if (!register) {
    return null
  }

  return register.DefaultPaymentCurrencyRegister || register.PaymentCurrencyRegisters?.[0] || null
}

function filterTaxFreeRegisters(registers: PaymentRegister[]): TaxFreePaymentRegister[] {
  return registers.reduce<TaxFreePaymentRegister[]>((acc, register) => {
    if (
      register.Type === CASH_REGISTER_TYPE
      && (register.PaymentCurrencyRegisters || []).some((currencyRegister) => currencyRegister.Currency?.Code === TAX_FREE_CURRENCY_CODE)
    ) {
      acc.push({
        ...register,
        DefaultPaymentCurrencyRegister:
          (register.PaymentCurrencyRegisters || []).find((currencyRegister) => currencyRegister.Currency?.Code === TAX_FREE_CURRENCY_CODE) || null,
      })
    }

    return acc
  }, [])
}

function pickDefaultOrganization(organizations: Organization[]): Organization | null {
  return (
    organizations.find((organization) => (organization as OrganizationWithCulture).Culture === POLAND_CULTURE)
    || organizations[0]
    || null
  )
}

function getInitialPaymentDate(document: TaxFreeDocument, withBounds: boolean): string {
  const today = formatLocalDate(new Date())

  if (!withBounds) {
    return today
  }

  const minDate = toDateFieldValue(document.Created)
  const maxDate = getMaxPaymentDate(document.Created)

  if (maxDate && today > maxDate) {
    return maxDate
  }

  if (minDate && today < minDate) {
    return minDate
  }

  return today
}

function getMaxPaymentDate(created?: string): string {
  const createdDate = toValidDate(created)

  if (!createdDate) {
    return ''
  }

  const maxDate = new Date(createdDate)
  maxDate.setMonth(maxDate.getMonth() + 3)

  return formatLocalDate(maxDate)
}

function toDateFieldValue(value?: string): string {
  const date = toValidDate(value)

  return date ? formatLocalDate(date) : ''
}

function toValidDate(value?: string): Date | null {
  if (!value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
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

function toEntityOptions<T extends NameLikeEntity>(entities: T[]) {
  return entities.reduce<{ label: string; value: string }[]>((acc, entity) => {
    const option = {
      label: getEntityName(entity) || getEntityValue(entity),
      value: getEntityValue(entity),
    }

    if (option.value) {
      acc.push(option)
    }

    return acc
  }, [])
}

function toAgreementOptions(agreements: ClientAgreement[]) {
  return agreements.reduce<{ label: string; value: string }[]>((acc, clientAgreement) => {
    const agreement = clientAgreement.Agreement
    const currency = agreement?.Currency
    const value = getEntityValue(agreement)

    const option = {
      label: [agreement?.Name || agreement?.Number || clientAgreement.Name || value, currency?.Code || currency?.Name]
        .filter(Boolean)
        .join(' '),
      value,
    }

    if (option.value) {
      acc.push(option)
    }

    return acc
  }, [])
}

function toUniqueLabels<T extends NameLikeEntity>(entities: T[]): string[] {
  return Array.from(
    new Set(
      entities.flatMap((entity) => {
        const name = getEntityName(entity)

        return name ? [name] : []
      }),
    ),
  )
}

function includeEntity<T extends NameLikeEntity>(entities: T[], entity: T): T[] {
  const entityValue = getEntityValue(entity)

  if (!entityValue || entities.some((item) => getEntityValue(item) === entityValue)) {
    return entities
  }

  return [entity, ...entities]
}

function getEntityValue(entity?: { Id?: number; NetUid?: string } | null): string {
  return String(entity?.NetUid || entity?.Id || '')
}

function getEntityName(entity?: NameLikeEntity | null): string {
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
