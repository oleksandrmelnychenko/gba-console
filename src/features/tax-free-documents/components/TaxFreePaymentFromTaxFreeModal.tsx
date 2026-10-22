import { TableChip } from '../../../shared/ui/TableChip'
import { Alert, Button, Card, Group, NumberInput, Select, Stack, Text, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { usePermissions } from '../../auth/usePermissions'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import { SearchableSelect } from '../../../shared/ui/SearchableSelect'
import {
  ACCOUNTING_COMMENT_MAX_LENGTH,
  buildPartnerAgreementPayload,
  getExternalDocumentPaymentDateBounds,
  isSupportedAccountingAmount,
  pickExternalDocumentPaymentCurrencyRegister,
} from '../../document-outcome-payment/externalDocumentPayment'
import {
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
import { createIncomePaymentFromTaxFree, createTaxFreeCashflowArticle } from '../api/taxFreeDocumentsApi'
import type { TaxFreeDocument } from '../types'
import { formatTaxFreeAmountPl, getTaxFreeClient } from '../utils'
import { AppDateInput } from '../../../shared/ui/AppDateInput'

const SEARCH_DEBOUNCE_MS = 300
const POLAND_CULTURE = 'pl'
const CASH_REGISTER_TYPE = 0

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
}

type TaxFreePaymentFromTaxFreeModalProps = {
  document: TaxFreeDocument | null
  opened: boolean
  onClose: () => void
  onCreated?: () => void
}

export function TaxFreePaymentFromTaxFreeModal({
  document,
  onClose,
  onCreated,
  opened,
}: TaxFreePaymentFromTaxFreeModalProps) {
  const { t } = useI18n()
  const { can } = usePermissions()
  const canCreateIncome = can(PermissionKeys.TaxFreeDocuments.Accounting.CreateIncome)
  const canCreateCashflowArticle = can(PermissionKeys.FinancialAdministration.CashflowArticles.Article.Create)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [paymentRegisters, setPaymentRegisters] = useState<TaxFreePaymentRegister[]>([])
  const [paymentMovements, setPaymentMovements] = useState<PaymentMovement[]>([])
  const [clientAgreements, setClientAgreements] = useState<ClientAgreement[]>([])
  const [form, setForm] = useState<FormState>(() => createInitialForm())
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [isSaving, setSaving] = useState(false)

  const client = document?.TaxFreePackList?.Client || null
  const dateBounds =
    getExternalDocumentPaymentDateBounds(document?.FormedDate || document?.Created)

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => getEntityValue(organization) === form.organizationValue) || null,
    [form.organizationValue, organizations],
  )
  const selectedRegister = useMemo(
    () => paymentRegisters.find((register) => getEntityValue(register) === form.paymentRegisterValue) || null,
    [form.paymentRegisterValue, paymentRegisters],
  )
  const selectedAgreement = useMemo(
    () => clientAgreements.find((agreement) => getEntityValue(agreement) === form.selectedAgreementValue) || null,
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
    if (!opened || !document || !canCreateIncome) {
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
          searchIncomeCashflowPaymentRegisters(''),
          getIncomeCashflowPaymentMovements(),
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
          fromDate: getInitialPaymentDate(activeDocument),
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

    void loadData(document)

    return () => {
      cancelled = true
    }
  }, [canCreateIncome, client?.NetUid, document, opened, t])

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

  async function handleCreateMovement() {
    const operationName = form.movementSearch.trim()

    if (!canCreateCashflowArticle || !operationName) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const createdMovement = await createTaxFreeCashflowArticle(operationName)

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
    if (!canCreateIncome || !document?.NetUid) {
      return
    }

    const validationError = validateForm({
      activeMovement,
      form,
      maxDate: dateBounds?.max || '',
      minDate: dateBounds?.min || '',
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
      const partnerAgreement = buildPartnerAgreementPayload(selectedAgreement, null)

      if (!partnerAgreement) {
        setError(t('Оберіть договір'))
        return
      }

      const order: IncomePaymentOrder = {
        ...partnerAgreement,
        Amount: form.amount,
        Comment: form.comment.trim(),
        Currency: selectedCurrencyRegister?.Currency || undefined,
        FromDate: toIsoDate(form.fromDate),
        Organization: selectedOrganization as Organization,
        PaymentMovementOperation: {
          PaymentMovement: activeMovement,
        },
        PaymentRegister: selectedRegister || undefined,
      }

      await createIncomePaymentFromTaxFree(document.NetUid, order)

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
    <AppModal className="app-compact-form" centered opened={opened} size={760} title={t('Створити прибутковий касовий ордер')} onClose={onClose}>
      <Stack gap={10}>
        {document ? (
          <Stack gap={2}>
            <Text size="sm">
              {t('Клієнт')}: {getTaxFreeClient(document)}
            </Text>
            <Group gap={6}><Text size="xs" c="gray.9">{t('Tax Free')}</Text><TableChip tone="document" value={document.Number || document.NetUid} /></Group>
            <Text size="sm">
              {t('Сума')}: <span className="app-money">{formatTaxFreeAmountPl(document.VatAmountPl)}</span>
            </Text>
          </Stack>
        ) : null}

        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <Card className="app-section-card" withBorder padding={12} radius="md">
          <Stack gap={10}>
            <Group align="end" gap={10}>
              <Select w={220} maw="100%"
                data={toEntityOptions(organizations)}
                disabled={!organizations.length || isLoading || isSaving}
                label={t('Організація')}
                searchable
                value={form.organizationValue || null}
                onChange={(value) => updateForm({ organizationValue: value || '' })}
              />
              <Select w={220} maw="100%"
                data={toAgreementOptions(clientAgreements)}
                disabled={!clientAgreements.length || isLoading || isSaving}
                label={t('Договір')}
                searchable
                value={form.selectedAgreementValue || null}
                onChange={(value) => updateForm({ selectedAgreementValue: value || '' })}
              />
              <Select w={220} maw="100%"
                data={toEntityOptions(paymentRegisters)}
                disabled={!paymentRegisters.length || isLoading || isSaving}
                label={t('Каса / рахунок')}
                searchable
                value={form.paymentRegisterValue || null}
                onChange={(value) => updateForm({ paymentRegisterValue: value || '' })}
              />
            </Group>
            <Group align="end" gap={10}>
              <NumberInput w={160} maw="100%"
                allowNegative={false}
                decimalScale={2}
                disabled={isLoading || isSaving}
                label={t('Сума')}
                min={0}
                value={form.amount}
                onChange={(value) => updateForm({ amount: toNumber(value) })}
              />
              <AppDateInput w={170} maw="100%"
                disabled={isLoading || isSaving}
                label={t('Дата')}
                max={dateBounds?.max}
                min={dateBounds?.min}
                type="date"
                value={form.fromDate}
                onChange={(event) => updateForm({ fromDate: event.currentTarget.value })}
              />
              <div>
                <Text c="gray.9" size="xs" fw={500} mb={4}>{t('Валюта')}</Text>
                <TableChip tone="source" value={currencyLabel} />
              </div>
            </Group>
            <Group align="end" gap={10}>
              <SearchableSelect w={360} maw="100%"
                data={toUniqueLabels(paymentMovements)}
                disabled={isLoading || isSaving}
                label={t('Стаття руху коштів')}
                value={form.movementSearch}
                onChange={(value) => updateForm({ movementSearch: value, selectedMovementValue: '' })}
                onOptionSubmit={handleMovementSubmit}
              />
              {canCreateCashflowArticle && (
                <Button variant="default"
                  disabled={Boolean(activeMovement) || !form.movementSearch.trim() || isLoading || isSaving}
                  leftSection={<Plus size={16} />}
                  type="button"
                  onClick={() => void handleCreateMovement()}
                >
                  {t('Створити статтю')}
                </Button>
              )}
            </Group>
            <Textarea
              disabled={isLoading || isSaving}
              label={t('Коментар')}
              maxLength={ACCOUNTING_COMMENT_MAX_LENGTH}
              minRows={2}
              value={form.comment}
              onChange={(event) => updateForm({ comment: event.currentTarget.value })}
            />
          </Stack>
        </Card>

        <AppModalFooter>
          <Button color="gray" disabled={isSaving} variant="default" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button disabled={isLoading || !canCreateIncome} loading={isSaving} onClick={() => void handleSubmit()}>
            {t('Створити')}
          </Button>
        </AppModalFooter>
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

function validateForm({
  activeMovement,
  form,
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

  if (!isSupportedAccountingAmount(form.amount)) {
    return t('Сума має бути більшою за нуль')
  }

  if (form.comment.trim().length > ACCOUNTING_COMMENT_MAX_LENGTH) {
    return t('Коментар має бути до 450 символів')
  }

  if (isDateOutsideRange(form.fromDate, minDate, maxDate)) {
    return t('Дата виходить за дозволений період')
  }

  if (!selectedRegister || !selectedCurrencyRegister || !activeMovement) {
    return t('Оберіть касу / рахунок, валюту та статтю руху коштів')
  }

  return null
}

function pickCurrencyRegister(register: TaxFreePaymentRegister | null) {
  return register?.DefaultPaymentCurrencyRegister
    || pickExternalDocumentPaymentCurrencyRegister(register)
}

function filterTaxFreeRegisters(registers: PaymentRegister[]): TaxFreePaymentRegister[] {
  return registers.reduce<TaxFreePaymentRegister[]>((acc, register) => {
    const plnCurrencyRegister =
      pickExternalDocumentPaymentCurrencyRegister(register)

    if (register.Type === CASH_REGISTER_TYPE && plnCurrencyRegister) {
      acc.push({
        ...register,
        DefaultPaymentCurrencyRegister: plnCurrencyRegister,
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

function getInitialPaymentDate(document: TaxFreeDocument): string {
  const today = formatLocalDate(new Date())

  const dateBounds = getExternalDocumentPaymentDateBounds(document.FormedDate || document.Created)
  const minDate = dateBounds?.min || ''
  const maxDate = dateBounds?.max || ''

  if (maxDate && today > maxDate) {
    return maxDate
  }

  if (minDate && today < minDate) {
    return minDate
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
