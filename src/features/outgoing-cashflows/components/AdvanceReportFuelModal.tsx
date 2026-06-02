import {
  Alert,
  Autocomplete,
  Badge,
  Button,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconAlertCircle, IconDeviceFloppy, IconX } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { searchCompanyCars } from '../../company-cars/api/companyCarsApi'
import { getSupplyOrganizations, searchPaymentCostMovements } from '../../consumable-orders/api/consumableOrdersApi'
import {
  calculateAdvanceReportCompanyCarFueling,
  searchAdvanceReportSupplyOrganizations,
} from '../api/advanceReportApi'
import type {
  AdvanceReportOrder,
  CompanyCar,
  CompanyCarFueling,
  PaymentCostMovement,
  SupplyOrganization,
  SupplyOrganizationAgreement,
} from '../advanceReportTypes'

type FuelFormState = {
  companyCarSearch: string
  costMovementSearch: string
  fuelAmount: number
  pricePerLiter: number
  selectedAgreementValue: string
  selectedCompanyCarValue: string
  selectedCostMovementValue: string
  selectedSupplierValue: string
  supplierSearch: string
  totalPriceWithVat: number
  vatAmount: number
  vatPercent: number
}

type EntityOptionSource = {
  Code?: string
  FullName?: string
  Id?: number
  LastName?: string
  Name?: string
  NetUid?: string
  Number?: string
  OperationName?: string
}

const SEARCH_DEBOUNCE_MS = 300

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function AdvanceReportFuelModal({
  onAdd,
  onClose,
  opened,
  outcomeOrder,
}: {
  onAdd: (fueling: CompanyCarFueling) => void
  onClose: () => void
  opened: boolean
  outcomeOrder: AdvanceReportOrder
}) {
  const { t } = useI18n()
  const [form, setForm] = useValueState<FuelFormState>(() => createEmptyForm())
  const [suppliers, setSuppliers] = useValueState<SupplyOrganization[]>([])
  const [companyCars, setCompanyCars] = useValueState<CompanyCar[]>([])
  const [costMovements, setCostMovements] = useValueState<PaymentCostMovement[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [confirmCloseOpen, setConfirmCloseOpen] = useValueState(false)
  const supplierSearchSeq = useRef(0)
  const companyCarSearchSeq = useRef(0)
  const costMovementSearchSeq = useRef(0)
  const submitSeq = useRef(0)

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => getEntityValue(supplier) === form.selectedSupplierValue) || null,
    [form.selectedSupplierValue, suppliers],
  )
  const selectedAgreement = useMemo(
    () =>
      filterAgreementsForOutcome(selectedSupplier?.SupplyOrganizationAgreements || [], outcomeOrder).find(
        (agreement) => getEntityValue(agreement) === form.selectedAgreementValue,
      ) || null,
    [form.selectedAgreementValue, outcomeOrder, selectedSupplier],
  )
  const selectedCompanyCar = useMemo(
    () => companyCars.find((companyCar) => getEntityValue(companyCar) === form.selectedCompanyCarValue) || null,
    [companyCars, form.selectedCompanyCarValue],
  )
  const selectedCostMovement = useMemo(
    () => costMovements.find((movement) => getEntityValue(movement) === form.selectedCostMovementValue) || null,
    [costMovements, form.selectedCostMovementValue],
  )
  const agreementOptions = useMemo(
    () => toAgreementOptions(filterAgreementsForOutcome(selectedSupplier?.SupplyOrganizationAgreements || [], outcomeOrder)),
    [outcomeOrder, selectedSupplier],
  )
  const supplierOptions = useMemo(() => toEntityOptions(suppliers), [suppliers])
  const companyCarOptions = useMemo(() => toCompanyCarOptions(companyCars), [companyCars])
  const costMovementOptions = useMemo(
    () => toEntityOptions(costMovements, (movement) => movement.OperationName || ''),
    [costMovements],
  )
  const previewFueling = useMemo(
    () =>
      normalizeFueling({
        FuelAmount: form.fuelAmount,
        PricePerLiter: form.pricePerLiter,
        TotalPriceWithVat: form.totalPriceWithVat,
        VatAmount: form.vatAmount,
        VatPercent: form.vatPercent,
      }),
    [form.fuelAmount, form.pricePerLiter, form.totalPriceWithVat, form.vatAmount, form.vatPercent],
  )

  const invalidatePendingRequests = useCallback(() => {
    submitSeq.current += 1
    supplierSearchSeq.current += 1
    companyCarSearchSeq.current += 1
    costMovementSearchSeq.current += 1
  }, [])

  const resetModalState = useCallback(() => {
    setForm(createEmptyForm())
    setCompanyCars([])
    setCostMovements([])
    setError(null)
    setConfirmCloseOpen(false)
    setSaving(false)
    setLoading(true)
  }, [setCompanyCars, setConfirmCloseOpen, setCostMovements, setError, setForm, setLoading, setSaving])

  useEffect(() => {
    invalidatePendingRequests()

    if (!opened) {
      return undefined
    }

    let cancelled = false

    resetModalState()

    async function loadSuppliers() {
      try {
        const nextSuppliers = await getSupplyOrganizations()

        if (!cancelled) {
          setSuppliers(nextSuppliers)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити постачальників'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSuppliers()

    return () => {
      invalidatePendingRequests()
      cancelled = true
    }
  }, [invalidatePendingRequests, opened, resetModalState, setError, setLoading, setSuppliers, t])

  useEffect(() => {
    if (!opened) {
      return undefined
    }

    const value = form.supplierSearch.trim()
    const requestId = (supplierSearchSeq.current += 1)
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchAdvanceReportSupplyOrganizations(value, outcomeOrder.Organization?.NetUid)
        .then((nextSuppliers) => {
          if (supplierSearchSeq.current !== requestId) {
            return
          }

          setSuppliers((current) =>
            includeEntity(nextSuppliers, current.find((item) => getEntityValue(item) === form.selectedSupplierValue) || null),
          )
        })
        .catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [form.selectedSupplierValue, form.supplierSearch, opened, outcomeOrder.Organization?.NetUid, setSuppliers])

  useEffect(() => {
    if (!opened) {
      return undefined
    }

    const value = form.companyCarSearch.trim()
    const requestId = (companyCarSearchSeq.current += 1)
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchCompanyCars(value)
        .then((nextCompanyCars) => {
          if (companyCarSearchSeq.current !== requestId) {
            return
          }

          setCompanyCars((current) =>
            includeEntity(
              nextCompanyCars as CompanyCar[],
              current.find((item) => getEntityValue(item) === form.selectedCompanyCarValue) || null,
            ),
          )
        })
        .catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [form.companyCarSearch, form.selectedCompanyCarValue, opened, setCompanyCars])

  useEffect(() => {
    if (!opened) {
      return undefined
    }

    const value = form.costMovementSearch.trim()
    const requestId = (costMovementSearchSeq.current += 1)
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        return
      }

      void searchPaymentCostMovements(value)
        .then((nextMovements) => {
          if (costMovementSearchSeq.current === requestId) {
            setCostMovements(nextMovements)
          }
        })
        .catch(() => undefined)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [form.costMovementSearch, opened, setCostMovements])

  function updateForm(patch: Partial<FuelFormState>) {
    setForm((current) => ({ ...current, ...patch }))
    setError(null)
  }

  function handleSupplierSubmit(value: string) {
    const supplier = suppliers.find((item) => getEntityValue(item) === value)

    if (!supplier) {
      return
    }

    updateForm({
      selectedAgreementValue: '',
      selectedSupplierValue: getEntityValue(supplier),
      supplierSearch: getEntityLabel(supplier),
    })
  }

  function handleCompanyCarSubmit(value: string) {
    const companyCar = companyCars.find((item) => getEntityValue(item) === value)

    if (!companyCar) {
      return
    }

    updateForm({
      companyCarSearch: getCompanyCarLabel(companyCar),
      selectedCompanyCarValue: getEntityValue(companyCar),
    })
  }

  function handleCostMovementSubmit(value: string) {
    const movement = costMovements.find((item) => getEntityValue(item) === value)

    if (!movement) {
      return
    }

    updateForm({
      costMovementSearch: movement.OperationName || '',
      selectedCostMovementValue: getEntityValue(movement),
    })
  }

  async function submitFueling() {
    if (isSaving) {
      return
    }

    const payload = buildFuelingPayload({
      form,
      previewFueling,
      selectedAgreement,
      selectedCompanyCar,
      selectedCostMovement,
      selectedSupplier,
    })
    const validationError = validateFueling(payload, outcomeOrder, t)

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    const requestId = submitSeq.current + 1
    submitSeq.current = requestId
    const isCurrentSubmit = () => submitSeq.current === requestId

    try {
      const calculated = await calculateAdvanceReportCompanyCarFueling(payload).catch((calcError) => {
        if (isCurrentSubmit()) {
          setError(calcError instanceof Error ? calcError.message : t('Не вдалося розрахувати'))
        }

        return null
      })

      if (isCurrentSubmit() && calculated) {
        onAdd({ ...payload, ...calculated })
        onClose()
      }
    } finally {
      if (isCurrentSubmit()) {
        setSaving(false)
      }
    }
  }

  function requestClose() {
    if (isSaving) {
      return
    }

    if (hasFuelDraft(form)) {
      setConfirmCloseOpen(true)
      return
    }

    onClose()
  }

  function confirmClose() {
    if (isSaving) {
      return
    }

    setConfirmCloseOpen(false)
    onClose()
  }

  return (
    <AppModal centered opened={opened} size="xl" title={t('Додати пальне')} onClose={requestClose}>
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <TextInput disabled label={t('Організація')} value={getEntityLabel(outcomeOrder.Organization)} />
          <Autocomplete
            data={supplierOptions}
            disabled={isLoading}
            label={t('Постачальник послуг')}
            placeholder={t('Почніть вводити назву')}
            value={form.supplierSearch}
            onChange={(value) => updateForm({ selectedAgreementValue: '', selectedSupplierValue: '', supplierSearch: value })}
            onOptionSubmit={handleSupplierSubmit}
          />
          <Select
            data={agreementOptions}
            disabled={!selectedSupplier || isLoading}
            label={t('Договір')}
            placeholder={t('Оберіть договір')}
            searchable
            value={form.selectedAgreementValue || null}
            onChange={(value) => updateForm({ selectedAgreementValue: value || '' })}
          />
          <Autocomplete
            data={companyCarOptions}
            disabled={isLoading}
            label={t('Автомобіль компанії')}
            placeholder={t('Номер або модель')}
            value={form.companyCarSearch}
            onChange={(value) => updateForm({ companyCarSearch: value, selectedCompanyCarValue: '' })}
            onOptionSubmit={handleCompanyCarSubmit}
          />
          <Autocomplete
            data={costMovementOptions}
            disabled={isLoading}
            label={t('Стаття витрат')}
            value={form.costMovementSearch}
            onChange={(value) => updateForm({ costMovementSearch: value, selectedCostMovementValue: '' })}
            onOptionSubmit={handleCostMovementSubmit}
          />
          <NumberInput
            allowNegative={false}
            decimalScale={3}
            disabled={isLoading}
            label={t('Ціна за літр')}
            min={0}
            value={form.pricePerLiter}
            onChange={(value) => updateForm({ pricePerLiter: toNumber(value), totalPriceWithVat: 0 })}
          />
          <NumberInput
            allowNegative={false}
            decimalScale={3}
            disabled={isLoading}
            label={t('Кількість пального')}
            min={0}
            value={form.fuelAmount}
            onChange={(value) => updateForm({ fuelAmount: toNumber(value) })}
          />
          <NumberInput
            allowNegative={false}
            decimalScale={2}
            disabled={isLoading}
            label={t('Загальна сума з ПДВ')}
            min={0}
            value={form.totalPriceWithVat}
            onChange={(value) => updateForm({ pricePerLiter: 0, totalPriceWithVat: toNumber(value) })}
          />
          <NumberInput
            allowNegative={false}
            decimalScale={2}
            disabled={isLoading}
            label={`${t('ПДВ')} %`}
            min={0}
            value={form.vatPercent}
            onChange={(value) => {
              const vatPercent = toNumber(value)
              updateForm({ vatAmount: vatPercent > 0 ? form.vatAmount : 0, vatPercent })
            }}
          />
          <NumberInput
            allowNegative={false}
            decimalScale={2}
            disabled={isLoading}
            label={t('Сума ПДВ')}
            min={0}
            value={form.vatAmount}
            onChange={(value) => updateForm({ vatAmount: toNumber(value) })}
          />
        </SimpleGrid>

        <Group gap="xs">
          <Badge color="gray" variant="light">
            {t('Сума')}: {formatMoney(previewFueling.TotalPrice)}
          </Badge>
          <Badge color="gray" variant="light">
            {t('ПДВ')}: {formatMoney(previewFueling.VatAmount)}
          </Badge>
          <Badge color="blue" variant="light">
            {t('Разом')}: {formatMoney(previewFueling.TotalPriceWithVat)}
          </Badge>
        </Group>

        <Group justify="flex-end">
          <Button color="gray" disabled={isSaving} leftSection={<IconX size={16} />} variant="light" onClick={requestClose}>
            {t('Скасувати')}
          </Button>
          <Button leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} onClick={() => void submitFueling()}>
            {t('Додати')}
          </Button>
        </Group>

        <AppModal
          centered
          opened={confirmCloseOpen}
          title={t('Є незбережені зміни')}
          onClose={() => {
            if (!isSaving) {
              setConfirmCloseOpen(false)
            }
          }}
        >
          <Stack gap="md">
            <Text>{t('Якщо закрити форму, введені дані не будуть додані до авансового звіту.')}</Text>
            <Group justify="flex-end">
              <Button color="gray" disabled={isSaving} variant="light" onClick={() => setConfirmCloseOpen(false)}>
                {t('Залишитися')}
              </Button>
              <Button color="red" disabled={isSaving} onClick={confirmClose}>
                {t('Закрити без збереження')}
              </Button>
            </Group>
          </Stack>
        </AppModal>
      </Stack>
    </AppModal>
  )
}

function createEmptyForm(): FuelFormState {
  return {
    companyCarSearch: '',
    costMovementSearch: '',
    fuelAmount: 0,
    pricePerLiter: 0,
    selectedAgreementValue: '',
    selectedCompanyCarValue: '',
    selectedCostMovementValue: '',
    selectedSupplierValue: '',
    supplierSearch: '',
    totalPriceWithVat: 0,
    vatAmount: 0,
    vatPercent: 0,
  }
}

function hasFuelDraft(form: FuelFormState): boolean {
  return (
    Boolean(form.companyCarSearch.trim()) ||
    Boolean(form.costMovementSearch.trim()) ||
    Boolean(form.selectedAgreementValue) ||
    Boolean(form.selectedCompanyCarValue) ||
    Boolean(form.selectedCostMovementValue) ||
    Boolean(form.selectedSupplierValue) ||
    Boolean(form.supplierSearch.trim()) ||
    form.fuelAmount > 0 ||
    form.pricePerLiter > 0 ||
    form.totalPriceWithVat > 0 ||
    form.vatAmount > 0 ||
    form.vatPercent > 0
  )
}

function buildFuelingPayload({
  form,
  previewFueling,
  selectedAgreement,
  selectedCompanyCar,
  selectedCostMovement,
  selectedSupplier,
}: {
  form: FuelFormState
  previewFueling: CompanyCarFueling
  selectedAgreement: SupplyOrganizationAgreement | null
  selectedCompanyCar: CompanyCar | null
  selectedCostMovement: PaymentCostMovement | null
  selectedSupplier: SupplyOrganization | null
}): CompanyCarFueling {
  return {
    ...previewFueling,
    CompanyCar: selectedCompanyCar,
    ConsumableProductOrganization: selectedSupplier,
    Id: 0,
    PaymentCostMovementOperation: {
      PaymentCostMovement: selectedCostMovement,
    },
    SupplyOrganizationAgreement: selectedAgreement,
    TotalPriceWithVat: previewFueling.TotalPriceWithVat || form.totalPriceWithVat,
  }
}

function validateFueling(
  fueling: CompanyCarFueling,
  outcomeOrder: AdvanceReportOrder,
  t: (value: string) => string,
): string | null {
  if (!fueling.ConsumableProductOrganization) {
    return t('Оберіть постачальника послуг')
  }

  if (!fueling.SupplyOrganizationAgreement?.Organization) {
    return t('Оберіть договір з організацією')
  }

  if (
    outcomeOrder.Organization?.NetUid &&
    fueling.SupplyOrganizationAgreement.Organization.NetUid !== outcomeOrder.Organization.NetUid
  ) {
    return t('Договір має бути для організації авансового звіту')
  }

  if (!fueling.CompanyCar) {
    return t('Оберіть автомобіль компанії')
  }

  if (!fueling.PaymentCostMovementOperation?.PaymentCostMovement) {
    return t('Оберіть статтю витрат')
  }

  if (!fueling.FuelAmount || fueling.FuelAmount <= 0) {
    return t('Вкажіть кількість пального')
  }

  if ((!fueling.PricePerLiter || fueling.PricePerLiter <= 0) && (!fueling.TotalPrice || fueling.TotalPrice <= 0)) {
    return t('Вкажіть ціну за літр або загальну суму')
  }

  return null
}

function normalizeFueling(fueling: CompanyCarFueling): CompanyCarFueling {
  const fuelAmount = fueling.FuelAmount || 0
  let pricePerLiter = fueling.PricePerLiter || 0
  let totalPriceWithVat = fueling.TotalPriceWithVat || 0
  const vatPercent = fueling.VatPercent || 0
  let vatAmount = fueling.VatAmount || 0
  let totalPrice = fueling.TotalPrice || 0

  if (fuelAmount > 0 && (pricePerLiter > 0 || totalPriceWithVat > 0)) {
    if (pricePerLiter > 0) {
      totalPriceWithVat = roundMoney(pricePerLiter * fuelAmount)
    } else {
      pricePerLiter = roundMoney(totalPriceWithVat / fuelAmount)
    }

    if (vatPercent > 0) {
      vatAmount = roundMoney((totalPriceWithVat * vatPercent) / (100 + vatPercent))
      totalPrice = roundMoney(totalPriceWithVat - vatAmount)
    } else if (vatAmount > 0 && totalPriceWithVat > vatAmount) {
      totalPrice = roundMoney(totalPriceWithVat - vatAmount)
    } else {
      totalPrice = totalPriceWithVat
      vatAmount = 0
    }
  }

  return {
    ...fueling,
    FuelAmount: fuelAmount,
    PricePerLiter: pricePerLiter,
    TotalPrice: totalPrice,
    TotalPriceWithVat: totalPriceWithVat,
    VatAmount: vatAmount,
    VatPercent: vatPercent,
  }
}

function filterAgreementsForOutcome(
  agreements: SupplyOrganizationAgreement[],
  outcomeOrder: AdvanceReportOrder,
): SupplyOrganizationAgreement[] {
  const organizationNetUid = outcomeOrder.Organization?.NetUid

  if (!organizationNetUid) {
    return agreements
  }

  return agreements.filter((agreement) => agreement.Organization?.NetUid === organizationNetUid)
}

function toEntityOptions<T extends EntityOptionSource>(
  entities: T[],
  labelGetter: (entity: T) => string = (entity) => getEntityLabel(entity),
) {
  return entities.reduce<Array<{ label: string; value: string }>>((options, entity) => {
    const value = getEntityValue(entity)

    if (!value) {
      return options
    }

    options.push({
      label: labelGetter(entity) || value,
      value,
    })

    return options
  }, [])
}

function toCompanyCarOptions(companyCars: CompanyCar[]) {
  return companyCars.reduce<Array<{ label: string; value: string }>>((options, companyCar) => {
    const value = getEntityValue(companyCar)

    if (!value) {
      return options
    }

    options.push({
      label: getCompanyCarLabel(companyCar) || value,
      value,
    })

    return options
  }, [])
}

function toAgreementOptions(agreements: SupplyOrganizationAgreement[]) {
  return agreements.reduce<Array<{ label: string; value: string }>>((options, agreement) => {
    const value = getEntityValue(agreement)

    if (!value) {
      return options
    }

    const parts = [agreement.Name || agreement.Number, agreement.Currency?.Code || agreement.Currency?.Name, agreement.Organization?.Name].filter(Boolean)

    options.push({
      label: parts.join(' / ') || value,
      value,
    })

    return options
  }, [])
}

function includeEntity<T extends EntityOptionSource>(entities: T[], entity: T | null): T[] {
  if (!entity) {
    return entities
  }

  const entityValue = getEntityValue(entity)

  if (!entityValue || entities.some((item) => getEntityValue(item) === entityValue)) {
    return entities
  }

  return [entity, ...entities]
}

function getEntityValue(entity?: EntityOptionSource | null): string {
  return String(entity?.NetUid || entity?.Id || '')
}

function getEntityLabel(entity?: EntityOptionSource | null): string {
  return entity?.FullName || entity?.LastName || entity?.Name || entity?.OperationName || entity?.Code || entity?.Number || ''
}

function getCompanyCarLabel(companyCar?: CompanyCar | null): string {
  if (!companyCar) {
    return ''
  }

  const brand = 'CarBrand' in companyCar && typeof companyCar.CarBrand === 'string' ? companyCar.CarBrand : ''

  return [companyCar.LicensePlate, brand].filter(Boolean).join(' / ')
}

function toNumber(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value.replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '—'
}
