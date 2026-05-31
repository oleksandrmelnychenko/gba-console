import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  FileInput,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconFileSpreadsheet,
  IconUpload,
} from '@tabler/icons-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatLocalDateTime } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  getSupplyOrderOrganizations,
  getSupplyOrderSuppliers,
  uploadDirectSupplyOrderFromFile,
} from '../api/supplyUkraineOrdersApi'
import type {
  Client,
  ClientAgreement,
  DirectSupplyOrderCreatePayload,
  Organization,
  SupplyOrderDocumentParseConfiguration,
  SupplyOrderFromFileResponse,
  SupplyTransportationTypeValue,
} from '../types'

type NumberFieldValue = number | ''

type DirectOrderForm = {
  clientAgreementKey: string
  comment: string
  dateFrom: string
  file: File | null
  organizationKey: string
  supplierKey: string
  transportationType: string
}

type ParseForm = {
  endRow: NumberFieldValue
  qtyColumnNumber: NumberFieldValue
  startRow: NumberFieldValue
  totalAmountColumnNumber: NumberFieldValue
  unitPriceColumnNumber: NumberFieldValue
  vendorCodeColumnNumber: NumberFieldValue
  withTotalAmount: boolean
}

const TARGET_ORGANIZATION_CULTURE_PREFIX = 'uk'
const SUPPLY_TRANSPORTATION_TYPES: Array<{ label: string, value: string }> = [
  { label: 'Авто', value: '0' },
  { label: 'Море', value: '1' },
  { label: 'Авіа', value: '2' },
]

const EMPTY_PARSE_FORM: ParseForm = {
  endRow: '',
  qtyColumnNumber: '',
  startRow: '',
  totalAmountColumnNumber: '',
  unitPriceColumnNumber: '',
  vendorCodeColumnNumber: '',
  withTotalAmount: false,
}

export function SupplyUkraineDirectOrderCreatePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [suppliers, setSuppliers] = useState<Client[]>([])
  const [supplierSearch, setSupplierSearch] = useState('')
  const [form, setForm] = useState<DirectOrderForm>(() => ({
    clientAgreementKey: '',
    comment: '',
    dateFrom: formatDateTimeInput(new Date()),
    file: null,
    organizationKey: '',
    supplierKey: '',
    transportationType: '0',
  }))
  const [parseForm, setParseForm] = useState<ParseForm>(EMPTY_PARSE_FORM)
  const [isLoading, setLoading] = useState(true)
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadResponse, setUploadResponse] = useState<SupplyOrderFromFileResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadDictionaries() {
      setLoading(true)
      setError(null)

      try {
        const [nextOrganizations, nextSuppliers] = await Promise.all([
          getSupplyOrderOrganizations(),
          getSupplyOrderSuppliers(),
        ])

        if (cancelled) {
          return
        }

        setOrganizations(nextOrganizations)
        setSuppliers(nextSuppliers)

        const defaultSupplier = nextSuppliers.find((supplier) => (supplier.ClientAgreements || []).length > 0) || nextSuppliers[0]
        const defaults = getDefaultsForSupplier(defaultSupplier || null, nextOrganizations)

        setForm((current) => ({
          ...current,
          clientAgreementKey: getClientAgreementKey(defaults.clientAgreement),
          organizationKey: getEntityKey(defaults.organization),
          supplierKey: getEntityKey(defaultSupplier),
        }))
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

    void loadDictionaries()

    return () => {
      cancelled = true
    }
  }, [t])

  const filteredSuppliers = useMemo(() => {
    const normalizedSearch = supplierSearch.trim().toLowerCase()
    const source = normalizedSearch
      ? suppliers.filter((supplier) => getClientLabel(supplier).toLowerCase().includes(normalizedSearch))
      : suppliers

    return source.slice(0, 60)
  }, [supplierSearch, suppliers])

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => getEntityKey(supplier) === form.supplierKey) || null,
    [form.supplierKey, suppliers],
  )

  const supplierAgreements = useMemo(
    () => getAvailableClientAgreements(selectedSupplier),
    [selectedSupplier],
  )

  const availableOrganizations = useMemo(
    () => getAvailableOrganizations(supplierAgreements, organizations),
    [organizations, supplierAgreements],
  )

  const selectedOrganization = useMemo(
    () => availableOrganizations.find((organization) => getEntityKey(organization) === form.organizationKey) || null,
    [availableOrganizations, form.organizationKey],
  )

  const availableAgreements = useMemo(
    () => filterAgreementsByOrganization(supplierAgreements, selectedOrganization),
    [selectedOrganization, supplierAgreements],
  )
  const supplierOptions = useMemo(() => toClientOptions(filteredSuppliers), [filteredSuppliers])
  const organizationOptions = useMemo(() => toOrganizationOptions(availableOrganizations), [availableOrganizations])
  const agreementOptions = useMemo(() => toAgreementOptions(availableAgreements), [availableAgreements])

  const selectedClientAgreement = useMemo(
    () => availableAgreements.find((agreement) => getClientAgreementKey(agreement) === form.clientAgreementKey) || null,
    [availableAgreements, form.clientAgreementKey],
  )

  function updateForm(patch: Partial<DirectOrderForm>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function updateParseForm(patch: Partial<ParseForm>) {
    setParseForm((current) => ({ ...current, ...patch }))
  }

  function changeSupplier(value: string | null) {
    const supplier = suppliers.find((item) => getEntityKey(item) === value) || null
    const defaults = getDefaultsForSupplier(supplier, organizations)

    setForm((current) => ({
      ...current,
      clientAgreementKey: getClientAgreementKey(defaults.clientAgreement),
      organizationKey: getEntityKey(defaults.organization),
      supplierKey: value || '',
    }))
    setUploadResponse(null)
  }

  function changeOrganization(value: string | null) {
    const organization = availableOrganizations.find((item) => getEntityKey(item) === value) || null
    const nextAgreement = filterAgreementsByOrganization(supplierAgreements, organization)[0] || null

    setForm((current) => ({
      ...current,
      clientAgreementKey: getClientAgreementKey(nextAgreement),
      organizationKey: value || '',
    }))
    setUploadResponse(null)
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parseConfiguration = toParseConfiguration(parseForm)

    if (!selectedSupplier || !selectedOrganization || !selectedClientAgreement) {
      setError(t('Оберіть постачальника, організацію та договір'))
      return
    }

    if (!form.file || !parseConfiguration) {
      setError(t('Заповніть файл і колонки імпорту'))
      return
    }

    const dateFrom = normalizeDateTimeInput(form.dateFrom)

    if (!dateFrom) {
      setError(t('Оберіть дату'))
      return
    }

    setSaving(true)
    setError(null)
    setUploadResponse(null)

    try {
      const supplyOrder: DirectSupplyOrderCreatePayload = {
        Client: selectedSupplier,
        ClientAgreement: selectedClientAgreement,
        Comment: form.comment.trim(),
        DateFrom: dateFrom,
        Organization: selectedOrganization,
        TransportationType: Number(form.transportationType) as SupplyTransportationTypeValue,
      }
      const response = await uploadDirectSupplyOrderFromFile({
        file: form.file,
        parseConfiguration,
        supplyOrder,
      })

      if (response.HasError) {
        setUploadResponse(response)
        notifications.show({ color: 'red', message: t('Файл містить помилки') })
        return
      }

      notifications.show({ color: 'green', message: t('Замовлення створено') })
      navigate(response.SupplyOrder?.NetUid ? `/orders/ukraine/all/edit/${response.SupplyOrder.NetUid}` : '/orders/ukraine/all')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити замовлення'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Stack gap={2}>
          <Text fw={700} size="xl">{t('Нове замовлення Україна')}</Text>
          <Text c="dimmed" size="sm">{t('Створення приходу від постачальника')}</Text>
        </Stack>
        <Button leftSection={<IconArrowLeft size={16} />} variant="light" onClick={() => navigate('/orders/ukraine/all')}>
          {t('До списку')}
        </Button>
      </Group>

      <Card withBorder radius="md" padding="lg">
        <form onSubmit={submitForm}>
          <Stack gap="md">
            {error && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {error}
              </Alert>
            )}

            {uploadResponse?.HasError && (
              <UploadErrorsAlert response={uploadResponse} />
            )}

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <Stack gap="sm">
                <Text fw={600}>{t('Замовлення')}</Text>
                <TextInput
                  disabled={isLoading || isSaving}
                  label={t('Дата')}
                  type="datetime-local"
                  value={form.dateFrom}
                  onChange={(event) => updateForm({ dateFrom: event.currentTarget.value })}
                />
                <SegmentedControl
                  data={SUPPLY_TRANSPORTATION_TYPES.map((item) => ({ ...item, label: t(item.label) }))}
                  disabled={isLoading || isSaving}
                  fullWidth
                  value={form.transportationType}
                  onChange={(value) => updateForm({ transportationType: value })}
                />
                <Select
                  data={supplierOptions}
                  disabled={isLoading || isSaving}
                  label={t('Постачальник')}
                  nothingFoundMessage={t('Нічого не знайдено')}
                  searchable
                  searchValue={supplierSearch}
                  value={form.supplierKey || null}
                  onChange={changeSupplier}
                  onSearchChange={setSupplierSearch}
                />
                <Select
                  data={organizationOptions}
                  disabled={isLoading || isSaving || !selectedSupplier}
                  label={t('Організація')}
                  searchable
                  value={form.organizationKey || null}
                  onChange={changeOrganization}
                />
                <Select
                  data={agreementOptions}
                  disabled={isLoading || isSaving || !selectedSupplier}
                  label={t('Договір')}
                  searchable
                  value={form.clientAgreementKey || null}
                  onChange={(value) => updateForm({ clientAgreementKey: value || '' })}
                />
                {selectedClientAgreement?.Agreement?.Currency && (
                  <Badge color="violet" variant="light">
                    {t('Валюта')}: {selectedClientAgreement.Agreement.Currency.Code || selectedClientAgreement.Agreement.Currency.Name || '-'}
                  </Badge>
                )}
                <Textarea
                  autosize
                  disabled={isSaving}
                  label={t('Коментар')}
                  minRows={3}
                  value={form.comment}
                  onChange={(event) => updateForm({ comment: event.currentTarget.value })}
                />
              </Stack>

              <Stack gap="sm">
                <Text fw={600}>{t('Імпорт')}</Text>
                <FileInput
                  clearable
                  accept=".xls,.xlsx,.csv"
                  disabled={isSaving}
                  label={t('Файл')}
                  leftSection={<IconFileSpreadsheet size={16} />}
                  placeholder={t('Оберіть файл')}
                  value={form.file}
                  onChange={(file) => {
                    updateForm({ file })
                    setUploadResponse(null)
                  }}
                />
                <SegmentedControl
                  data={[
                    { label: t('Ціна'), value: 'unit' },
                    { label: t('Сума'), value: 'total' },
                  ]}
                  disabled={isSaving}
                  fullWidth
                  value={parseForm.withTotalAmount ? 'total' : 'unit'}
                  onChange={(value) => updateParseForm({ withTotalAmount: value === 'total' })}
                />
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <NumberInput
                    allowDecimal={false}
                    disabled={isSaving}
                    label={t('Код товару')}
                    min={1}
                    value={parseForm.vendorCodeColumnNumber}
                    onChange={(value) => updateParseForm({ vendorCodeColumnNumber: toPositiveNumber(value) })}
                  />
                  <NumberInput
                    allowDecimal={false}
                    disabled={isSaving}
                    label={t('Кількість')}
                    min={1}
                    value={parseForm.qtyColumnNumber}
                    onChange={(value) => updateParseForm({ qtyColumnNumber: toPositiveNumber(value) })}
                  />
                  <NumberInput
                    allowDecimal={false}
                    disabled={isSaving}
                    label={t('З рядка')}
                    min={1}
                    value={parseForm.startRow}
                    onChange={(value) => updateParseForm({ startRow: toPositiveNumber(value) })}
                  />
                  <NumberInput
                    allowDecimal={false}
                    disabled={isSaving}
                    label={t('До рядка')}
                    min={1}
                    value={parseForm.endRow}
                    onChange={(value) => updateParseForm({ endRow: toPositiveNumber(value) })}
                  />
                  <NumberInput
                    allowDecimal={false}
                    disabled={isSaving || parseForm.withTotalAmount}
                    label={t('Колонка ціни')}
                    min={1}
                    value={parseForm.unitPriceColumnNumber}
                    onChange={(value) => updateParseForm({ unitPriceColumnNumber: toPositiveNumber(value) })}
                  />
                  <NumberInput
                    allowDecimal={false}
                    disabled={isSaving || !parseForm.withTotalAmount}
                    label={t('Колонка суми')}
                    min={1}
                    value={parseForm.totalAmountColumnNumber}
                    onChange={(value) => updateParseForm({ totalAmountColumnNumber: toPositiveNumber(value) })}
                  />
                </SimpleGrid>
              </Stack>
            </SimpleGrid>

            <Group justify="flex-end">
              <Button disabled={isSaving} variant="subtle" onClick={() => navigate('/orders/ukraine/all')}>
                {t('Скасувати')}
              </Button>
              <Button leftSection={<IconUpload size={16} />} loading={isSaving} type="submit">
                {t('Створити')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </Stack>
  )
}

function UploadErrorsAlert({ response }: { response: SupplyOrderFromFileResponse }) {
  const { t } = useI18n()
  const missingVendorCodes = response.MissingVendorCodes || []

  return (
    <Alert color="red" icon={<IconAlertCircle size={18} />} title={t('Файл містить помилки')} variant="light">
      <Stack gap="xs">
        {response.MissingVendorCodesFileUrl && (
          <Anchor href={response.MissingVendorCodesFileUrl} rel="noreferrer" target="_blank">
            {t('Завантажити файл')}
          </Anchor>
        )}
        {missingVendorCodes.length > 0 && (
          <Group gap={6}>
            {missingVendorCodes.slice(0, 24).map((vendorCode) => (
              <Badge key={vendorCode} color="red" variant="outline">{vendorCode}</Badge>
            ))}
            {missingVendorCodes.length > 24 && (
              <Badge color="gray" variant="light">+{missingVendorCodes.length - 24}</Badge>
            )}
          </Group>
        )}
      </Stack>
    </Alert>
  )
}

function getDefaultsForSupplier(supplier: Client | null, fallbackOrganizations: Organization[]) {
  const agreements = getAvailableClientAgreements(supplier)
  const organization = getAvailableOrganizations(agreements, fallbackOrganizations)[0] || null
  const clientAgreement = filterAgreementsByOrganization(agreements, organization)[0] || agreements[0] || null

  return { clientAgreement, organization }
}

function getAvailableClientAgreements(supplier: Client | null): ClientAgreement[] {
  return (supplier?.ClientAgreements || []).filter((clientAgreement) => {
    const culture = clientAgreement.Agreement?.Organization?.Culture

    return !culture || isTargetOrganizationCulture(culture)
  })
}

function getAvailableOrganizations(agreements: ClientAgreement[], fallbackOrganizations: Organization[]): Organization[] {
  const organizations: Organization[] = []

  agreements.forEach((clientAgreement) => {
    const organization = clientAgreement.Agreement?.Organization

    if (organization && isTargetOrganizationCulture(organization.Culture) && !organizations.some((item) => isSameEntity(item, organization))) {
      organizations.push(organization)
    }
  })

  return organizations.length ? organizations : fallbackOrganizations
}

function filterAgreementsByOrganization(agreements: ClientAgreement[], organization: Organization | null): ClientAgreement[] {
  if (!organization) {
    return agreements
  }

  return agreements.filter((clientAgreement) => {
    const agreementOrganization = clientAgreement.Agreement?.Organization

    return !agreementOrganization || isSameEntity(agreementOrganization, organization)
  })
}

function toParseConfiguration(form: ParseForm): SupplyOrderDocumentParseConfiguration | null {
  const baseConfiguration = {
    EndRow: form.endRow,
    QtyColumnNumber: form.qtyColumnNumber,
    StartRow: form.startRow,
    VendorCodeColumnNumber: form.vendorCodeColumnNumber,
  }

  if (!hasRequiredNumbers(baseConfiguration)) {
    return null
  }

  if (baseConfiguration.StartRow > baseConfiguration.EndRow) {
    return null
  }

  if (form.withTotalAmount && !form.totalAmountColumnNumber) {
    return null
  }

  if (!form.withTotalAmount && !form.unitPriceColumnNumber) {
    return null
  }

  const totalAmountColumnNumber = form.withTotalAmount ? Number(form.totalAmountColumnNumber) : 0
  const unitPriceColumnNumber = form.withTotalAmount ? 0 : Number(form.unitPriceColumnNumber)

  return {
    ...baseConfiguration,
    GrossWeightColumnNumber: 0,
    IsWeightPerUnit: false,
    NetWeightColumnNumber: 0,
    ProductIsImported: false,
    TotalAmountColumnNumber: totalAmountColumnNumber,
    UnitPriceColumnNumber: unitPriceColumnNumber,
    WithGrossWeight: false,
    WithNetWeight: false,
    WithTotalAmount: form.withTotalAmount,
  }
}

function hasRequiredNumbers(configuration: {
  EndRow: NumberFieldValue
  QtyColumnNumber: NumberFieldValue
  StartRow: NumberFieldValue
  VendorCodeColumnNumber: NumberFieldValue
}): configuration is {
  EndRow: number
  QtyColumnNumber: number
  StartRow: number
  VendorCodeColumnNumber: number
} {
  return Boolean(
    configuration.EndRow
      && configuration.QtyColumnNumber
      && configuration.StartRow
      && configuration.VendorCodeColumnNumber,
  )
}

function toPositiveNumber(value: number | string): NumberFieldValue {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : ''
}

function toClientOptions(clients: Client[]): Array<{ label: string, value: string }> {
  const options: Array<{ label: string, value: string }> = []

  clients.forEach((client) => {
    const value = getEntityKey(client)

    if (value) {
      options.push({ label: getClientLabel(client), value })
    }
  })

  return options
}

function toOrganizationOptions(organizations: Organization[]): Array<{ label: string, value: string }> {
  const options: Array<{ label: string, value: string }> = []

  organizations.forEach((organization) => {
    const value = getEntityKey(organization)

    if (value) {
      options.push({ label: getOrganizationLabel(organization), value })
    }
  })

  return options
}

function toAgreementOptions(clientAgreements: ClientAgreement[]): Array<{ label: string, value: string }> {
  const options: Array<{ label: string, value: string }> = []

  clientAgreements.forEach((clientAgreement) => {
    const value = getClientAgreementKey(clientAgreement)

    if (value) {
      options.push({ label: getClientAgreementLabel(clientAgreement), value })
    }
  })

  return options
}

function formatDateTimeInput(date: Date): string {
  return formatLocalDateTime(date).slice(0, 16)
}

function normalizeDateTimeInput(value: string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function getEntityKey(entity?: { Id?: number, NetUid?: string } | null): string {
  return entity?.NetUid || (entity?.Id ? String(entity.Id) : '')
}

function getClientAgreementKey(clientAgreement?: ClientAgreement | null): string {
  return clientAgreement?.NetUid
    || clientAgreement?.Agreement?.NetUid
    || (clientAgreement?.AgreementId ? String(clientAgreement.AgreementId) : '')
    || (clientAgreement?.Agreement?.Id ? String(clientAgreement.Agreement.Id) : '')
    || (clientAgreement?.Id ? String(clientAgreement.Id) : '')
}

function getClientLabel(client?: Client | null): string {
  return client?.FullName || client?.Name || client?.Code || client?.USREOU || '-'
}

function getOrganizationLabel(organization?: Organization | null): string {
  return organization?.Name || organization?.FullName || organization?.Code || '-'
}

function getClientAgreementLabel(clientAgreement: ClientAgreement): string {
  const agreement = clientAgreement.Agreement
  const currency = agreement?.Currency?.Code || agreement?.Currency?.Name
  const label = agreement?.Name || agreement?.FullName || agreement?.Code || String(agreement?.Id || clientAgreement.Id || '')

  return [label, currency].filter(Boolean).join(' · ')
}

function isSameEntity(left: { Id?: number, NetUid?: string }, right: { Id?: number, NetUid?: string }): boolean {
  const leftKey = getEntityKey(left)
  const rightKey = getEntityKey(right)

  return Boolean(leftKey && rightKey && leftKey === rightKey)
}

function isTargetOrganizationCulture(culture: string | undefined): boolean {
  return Boolean(culture?.toLowerCase().startsWith(TARGET_ORGANIZATION_CULTURE_PREFIX))
}
