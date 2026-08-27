import { Alert, Button, Grid, Group, NumberInput, Select, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { SearchableSelect } from '../../../shared/ui/SearchableSelect'
import {
  getIncomeCashflowClientAgreements,
  getIncomeCashflowOrganizations,
  getIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentRegisters,
} from '../../income-cashflows/api/incomeCashflowsApi'
import type {
  IncomePaymentOrder,
  Organization,
  PaymentMovement,
  PaymentRegister,
} from '../../income-cashflows/types'
import {
  ACCOUNTING_COMMENT_MAX_LENGTH,
  buildPartnerAgreementPayload,
  getExternalDocumentPaymentDateBounds,
  isSupportedAccountingAmount,
  pickExternalDocumentPaymentCurrencyRegister,
} from '../../document-outcome-payment/externalDocumentPayment'
import type {
  ExternalClientAgreement,
  ExternalOrganizationClientAgreement,
} from '../../document-outcome-payment/types'
import { createIncomePaymentFromSad } from '../api/sadApi'
import type { Sad } from '../types'

const SEARCH_DEBOUNCE_MS = 300

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
})

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
}

type SadPaymentFromSadModalProps = {
  opened: boolean
  sad: Sad | null
  onClose: () => void
  onCreated?: () => void
}

export function SadPaymentFromSadModal({
  onClose,
  onCreated,
  opened,
  sad,
}: SadPaymentFromSadModalProps) {
  const { t } = useI18n()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [paymentRegisters, setPaymentRegisters] = useState<PaymentRegister[]>([])
  const [paymentMovements, setPaymentMovements] = useState<PaymentMovement[]>([])
  const [clientAgreements, setClientAgreements] = useState<ExternalClientAgreement[]>([])
  const [form, setForm] = useState<FormState>(() => createInitialForm())
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [isSaving, setSaving] = useState(false)

  const client = sad?.Client || null
  const isOrganizationClient = Boolean(sad?.OrganizationClient)

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => getEntityValue(organization) === form.organizationValue) || null,
    [form.organizationValue, organizations],
  )
  const selectedRegister = useMemo(
    () => paymentRegisters.find((register) => getEntityValue(register) === form.paymentRegisterValue) || null,
    [form.paymentRegisterValue, paymentRegisters],
  )
  const organizationClientAgreements = useMemo(
    () => isOrganizationClient
      ? dedupeAgreements([
          sad?.OrganizationClientAgreement,
          ...(sad?.OrganizationClient?.OrganizationClientAgreements || []),
        ]).map(toExternalOrganizationClientAgreement)
      : [],
    [isOrganizationClient, sad?.OrganizationClient, sad?.OrganizationClientAgreement],
  )
  const selectedClientAgreement = useMemo(
    () => clientAgreements.find((agreement) => getEntityValue(agreement) === form.selectedAgreementValue) || null,
    [clientAgreements, form.selectedAgreementValue],
  )
  const selectedOrganizationClientAgreement = useMemo(
    () => organizationClientAgreements.find((agreement) => getEntityValue(agreement) === form.selectedAgreementValue) || null,
    [form.selectedAgreementValue, organizationClientAgreements],
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
  const referenceAmount = sad?.TotalAmountLocal
  const dateBounds = useMemo(
    () => getExternalDocumentPaymentDateBounds(sad?.FromDate || sad?.Created),
    [sad?.Created, sad?.FromDate],
  )

  useEffect(() => {
    if (!opened || !sad) {
      return
    }

    let cancelled = false

    async function loadData(activeSad: Sad) {
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

                return [] as ExternalClientAgreement[]
              })
            : Promise.resolve([] as ExternalClientAgreement[]),
          searchIncomeCashflowPaymentRegisters(''),
          getIncomeCashflowPaymentMovements(),
        ])

        if (cancelled) {
          return
        }

        const nextClientAgreements = dedupeAgreements([
          isOrganizationClient ? null : activeSad.ClientAgreement,
          ...nextAgreements,
        ])
        const nextOrganizationClientAgreements = isOrganizationClient
          ? dedupeAgreements([
              activeSad.OrganizationClientAgreement,
              ...(activeSad.OrganizationClient?.OrganizationClientAgreements || []),
            ]).map(toExternalOrganizationClientAgreement)
          : []
        const plnPaymentRegisters = nextRegisters.filter(
          (register) =>
            pickExternalDocumentPaymentCurrencyRegister(register) !== null,
        )
        const defaultOrganization = nextOrganizations[0] || null
        const defaultAgreement = nextOrganizationClientAgreements[0] || nextClientAgreements[0] || null
        const defaultRegister = plnPaymentRegisters[0] || null
        const defaultMovement = nextMovements[0] || null

        setOrganizations(nextOrganizations)
        setClientAgreements(nextClientAgreements)
        setPaymentRegisters(plnPaymentRegisters)
        setPaymentMovements(nextMovements)
        setForm({
          ...createInitialForm(),
          amount: 0,
          fromDate: getInitialPaymentDate(activeSad),
          organizationValue: defaultOrganization ? getEntityValue(defaultOrganization) : '',
          paymentRegisterValue: defaultRegister ? getEntityValue(defaultRegister) : '',
          selectedAgreementValue: getEntityValue(defaultAgreement),
          selectedMovementValue: defaultMovement ? getEntityValue(defaultMovement) : '',
          movementSearch: defaultMovement?.OperationName || '',
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

    void loadData(sad)

    return () => {
      cancelled = true
    }
  }, [client?.NetUid, isOrganizationClient, opened, sad, t])

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
  }, [form.movementSearch, opened])

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

  async function handleSubmit() {
    if (!sad?.NetUid) {
      return
    }

    if (!selectedOrganization) {
      setError(t('Оберіть організацію'))
      return
    }

    const partnerAgreement = buildPartnerAgreementPayload(
      selectedClientAgreement,
      selectedOrganizationClientAgreement,
    )

    if (!partnerAgreement) {
      setError(t('Оберіть договір'))
      return
    }

    if (!isSupportedAccountingAmount(form.amount)) {
      setError(t('Сума має бути більшою за нуль'))
      return
    }

    if (form.comment.trim().length > ACCOUNTING_COMMENT_MAX_LENGTH) {
      setError(t('Коментар має бути до 450 символів'))
      return
    }

    if (isDateOutsideRange(form.fromDate, dateBounds?.min || '', dateBounds?.max || '')) {
      setError(t('Дата виходить за дозволений період'))
      return
    }

    if (!selectedRegister || !selectedCurrencyRegister || !activeMovement) {
      setError(t('Оберіть касу / рахунок, валюту та статтю руху коштів'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const order: IncomePaymentOrder = {
        ...partnerAgreement,
        Amount: form.amount,
        Comment: form.comment.trim(),
        Currency: selectedCurrencyRegister?.Currency || undefined,
        FromDate: toIsoDate(form.fromDate),
        Organization: selectedOrganization,
        PaymentCurrencyRegister: selectedCurrencyRegister,
        PaymentMovementOperation: {
          PaymentMovement: activeMovement,
        },
        PaymentRegister: selectedRegister,
      }

      await createIncomePaymentFromSad(sad.NetUid, order)

      notifications.show({ color: 'green', message: t('Прибутковий ордер створено') })
      onCreated?.()
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити платіж'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal centered opened={opened} size="lg" title={t('Створити прибутковий касовий ордер')} onClose={onClose}>
      <Stack gap="md">
        {client && (
          <Text size="sm">
            {t('Клієнт')}: {getEntityName(client)}
          </Text>
        )}

        {typeof referenceAmount === 'number' && (
          <Text size="sm">
            {t('Сума')}: <span className="app-money">{formatPln(referenceAmount)} <span className="app-money-meta">PLN</span></span>
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
              data={organizationClientAgreements.length
                ? toOrganizationClientAgreementOptions(organizationClientAgreements)
                : toAgreementOptions(clientAgreements)}
              disabled={!(clientAgreements.length || organizationClientAgreements.length) || isLoading || isSaving}
              label={t('Договір')}
              searchable
              value={form.selectedAgreementValue || null}
              onChange={(value) => updateForm({ selectedAgreementValue: value || '' })}
            />
          </Grid.Col>

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
              max={dateBounds?.max}
              min={dateBounds?.min}
              type="date"
              value={form.fromDate}
              onChange={(event) => updateForm({ fromDate: event.currentTarget.value })}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <SearchableSelect
              data={toUniqueLabels(paymentMovements)}
              disabled={isLoading || isSaving}
              label={t('Стаття руху коштів')}
              value={form.movementSearch}
              onChange={(value) => updateForm({ movementSearch: value, selectedMovementValue: '' })}
              onOptionSubmit={handleMovementSubmit}
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <Textarea
              disabled={isLoading || isSaving}
              label={t('Коментар')}
              maxLength={ACCOUNTING_COMMENT_MAX_LENGTH}
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

function pickCurrencyRegister(register: PaymentRegister | null) {
  return pickExternalDocumentPaymentCurrencyRegister(register)
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

function toAgreementOptions(agreements: ExternalClientAgreement[]) {
  return agreements.reduce<{ label: string; value: string }[]>((acc, clientAgreement) => {
    const agreement = clientAgreement.Agreement
    const currency = agreement?.Currency
    const value = getEntityValue(clientAgreement)

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

function toOrganizationClientAgreementOptions(agreements: ExternalOrganizationClientAgreement[]) {
  return agreements.reduce<{ label: string; value: string }[]>((options, agreement) => {
    const value = getEntityValue(agreement)

    if (value) {
      options.push({
        label: [
          agreement.Number || value,
          agreement.Currency?.Code || agreement.Currency?.Name,
        ].filter(Boolean).join(' '),
        value,
      })
    }

    return options
  }, [])
}

function dedupeAgreements<TAgreement extends { Id?: number; NetUid?: string }>(
  agreements: Array<TAgreement | null | undefined>,
): TAgreement[] {
  const seen = new Set<string>()

  return agreements.reduce<TAgreement[]>((result, agreement) => {
    const value = getEntityValue(agreement)

    if (agreement && value && !seen.has(value)) {
      seen.add(value)
      result.push(agreement)
    }

    return result
  }, [])
}

function toExternalOrganizationClientAgreement(
  agreement: ExternalOrganizationClientAgreement,
): ExternalOrganizationClientAgreement {
  return {
    Currency: agreement.Currency
      ? {
          Code: agreement.Currency.Code,
          Name: agreement.Currency.Name,
        }
      : null,
    Id: agreement.Id,
    NetUid: agreement.NetUid,
    Number: agreement.Number,
    OrganizationClientId: agreement.OrganizationClientId,
  }
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

function formatPln(value: number): string {
  return moneyFormatter.format(value)
}

function getInitialPaymentDate(sad: Sad): string {
  const today = formatLocalDate(new Date())

  const dateBounds = getExternalDocumentPaymentDateBounds(sad.FromDate || sad.Created)

  if (dateBounds?.max && today > dateBounds.max) {
    return dateBounds.max
  }

  if (dateBounds?.min && today < dateBounds.min) {
    return dateBounds.min
  }

  return today
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
