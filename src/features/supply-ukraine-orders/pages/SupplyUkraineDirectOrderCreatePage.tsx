import {
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
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
import { CircleAlert, FileSpreadsheet, Upload } from 'lucide-react'
import { useEffect, useMemo, useReducer, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { formatLocalDateTime } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { EXCEL_FILE_ACCEPT, isExcelFile } from '../excelFiles'
import {
  prepareSupplyUkraineOrderCreateNavigation,
  type SupplyUkraineOrderCreateMode,
  type SupplyUkraineOrderUploadResponse,
} from '../supplyUkraineOrderCreateSuccess'
import {
  getSupplyOrderOrganizations,
  getSupplyOrderSuppliers,
  uploadDirectSupplyOrderFromFile,
  uploadSupplyOrderUkraineFromSupplierFile,
} from '../api/supplyUkraineOrdersApi'
import type {
  Client,
  ClientAgreement,
  DirectSupplyOrderCreatePayload,
  Organization,
  SupplyOrderDocumentParseConfiguration,
  SupplyOrderFromFileResponse,
  SupplyOrderUkraineFromFileResponse,
  SupplyOrderUkraineSupplierCreatePayload,
  SupplyTransportationTypeValue,
  UkraineOrderFromSupplierParseConfiguration,
} from '../types'

type NumberFieldValue = number | ''
type CreateMode = SupplyUkraineOrderCreateMode
type SelectOption = { label: string, value: string }
type UploadResponse = SupplyUkraineOrderUploadResponse

type DirectOrderForm = {
  clientAgreementKey: string
  comment: string
  dateFrom: string
  file: File | null
  invDate: string
  invNumber: string
  organizationKey: string
  supplierKey: string
  transportationType: string
}

type ParseForm = {
  endRow: NumberFieldValue
  grossWeightColumnNumber: NumberFieldValue
  isImportedProductColumnNumber: NumberFieldValue
  isWeightPerItem: boolean
  qtyColumnNumber: NumberFieldValue
  specificationCodeColumnNumber: NumberFieldValue
  startRow: NumberFieldValue
  totalAmountColumnNumber: NumberFieldValue
  unitPriceColumnNumber: NumberFieldValue
  vendorCodeColumnNumber: NumberFieldValue
  weightColumnNumber: NumberFieldValue
  withGrossWeight: boolean
  withImportedProduct: boolean
  withSpecificationCode: boolean
  withTotalAmount: boolean
  withWeight: boolean
}

type DirectOrderFormAction = { type: 'patch', patch: Partial<DirectOrderForm> }
type ParseFormAction = { type: 'patch', patch: Partial<ParseForm> }
type CreatePageState = {
  error: string | null
  isLoading: boolean
  isSaving: boolean
  organizations: Organization[]
  supplierSearch: string
  suppliers: Client[]
  uploadResponse: UploadResponse | null
}

type CreatePageAction =
  | { type: 'loadStart' }
  | { type: 'loadSuccess', organizations: Organization[], suppliers: Client[] }
  | { type: 'loadFailure', error: string }
  | { type: 'setError', error: string | null }
  | { type: 'setSaving', isSaving: boolean }
  | { type: 'setSupplierSearch', supplierSearch: string }
  | { type: 'setUploadResponse', uploadResponse: UploadResponse | null }

const TARGET_ORGANIZATION_CULTURE_PREFIX = 'uk'
const SUPPLY_TRANSPORTATION_TYPES: Array<{ label: string, value: string }> = [
  { label: 'Авто', value: '0' },
  { label: 'Море', value: '1' },
  { label: 'Авіа', value: '2' },
]

const INITIAL_CREATE_PAGE_STATE: CreatePageState = {
  error: null,
  isLoading: true,
  isSaving: false,
  organizations: [],
  supplierSearch: '',
  suppliers: [],
  uploadResponse: null,
}

const EMPTY_PARSE_FORM: ParseForm = {
  endRow: '',
  grossWeightColumnNumber: '',
  isImportedProductColumnNumber: '',
  isWeightPerItem: false,
  qtyColumnNumber: '',
  specificationCodeColumnNumber: '',
  startRow: '',
  totalAmountColumnNumber: '',
  unitPriceColumnNumber: '',
  vendorCodeColumnNumber: '',
  weightColumnNumber: '',
  withGrossWeight: false,
  withImportedProduct: false,
  withSpecificationCode: false,
  withTotalAmount: false,
  withWeight: false,
}

function createInitialDirectOrderForm(): DirectOrderForm {
  const currentDate = formatDateTimeInput(new Date())

  return {
    clientAgreementKey: '',
    comment: '',
    dateFrom: currentDate,
    file: null,
    invDate: currentDate,
    invNumber: '',
    organizationKey: '',
    supplierKey: '',
    transportationType: '0',
  }
}

function directOrderFormReducer(state: DirectOrderForm, action: DirectOrderFormAction): DirectOrderForm {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch }
    default:
      return state
  }
}

function parseFormReducer(state: ParseForm, action: ParseFormAction): ParseForm {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch }
    default:
      return state
  }
}

function createPageReducer(state: CreatePageState, action: CreatePageAction): CreatePageState {
  switch (action.type) {
    case 'loadStart':
      return { ...state, error: null, isLoading: true }
    case 'loadSuccess':
      return {
        ...state,
        error: null,
        isLoading: false,
        organizations: action.organizations,
        suppliers: action.suppliers,
      }
    case 'loadFailure':
      return { ...state, error: action.error, isLoading: false }
    case 'setError':
      return { ...state, error: action.error }
    case 'setSaving':
      return { ...state, isSaving: action.isSaving }
    case 'setSupplierSearch':
      return { ...state, supplierSearch: action.supplierSearch }
    case 'setUploadResponse':
      return { ...state, uploadResponse: action.uploadResponse }
    default:
      return state
  }
}

export function SupplyUkraineDirectOrderCreatePage() {
  return <SupplyUkraineOrderFileCreatePage mode="direct" />
}

export function SupplyUkraineToUkraineOrderCreatePage() {
  return <SupplyUkraineOrderFileCreatePage mode="toUkraine" />
}

function SupplyUkraineOrderFileCreatePage({ mode }: { mode: CreateMode }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const isToUkraineMode = mode === 'toUkraine'
  const [pageState, dispatchPage] = useReducer(createPageReducer, INITIAL_CREATE_PAGE_STATE)
  const [form, dispatchForm] = useReducer(directOrderFormReducer, undefined, createInitialDirectOrderForm)
  const [parseForm, dispatchParseForm] = useReducer(parseFormReducer, EMPTY_PARSE_FORM)
  const { error, isLoading, isSaving, organizations, supplierSearch, suppliers, uploadResponse } = pageState

  useEffect(() => {
    let cancelled = false

    async function loadDictionaries() {
      dispatchPage({ type: 'loadStart' })

      try {
        const [nextOrganizations, nextSuppliers] = await Promise.all([
          getSupplyOrderOrganizations(),
          getSupplyOrderSuppliers(),
        ])

        if (cancelled) {
          return
        }

        dispatchPage({
          type: 'loadSuccess',
          organizations: nextOrganizations,
          suppliers: nextSuppliers,
        })

        const defaultSupplier = nextSuppliers.find((supplier) => (supplier.ClientAgreements || []).length > 0) || nextSuppliers[0]
        const defaults = getDefaultsForSupplier(defaultSupplier || null, nextOrganizations)

        dispatchForm({
          type: 'patch',
          patch: {
            clientAgreementKey: getClientAgreementKey(defaults.clientAgreement),
            organizationKey: getEntityKey(defaults.organization),
            supplierKey: getEntityKey(defaultSupplier),
          },
        })
      } catch (loadError) {
        if (!cancelled) {
          dispatchPage({
            type: 'loadFailure',
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити довідники'),
          })
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
    dispatchForm({ type: 'patch', patch })
  }

  function updateParseForm(patch: Partial<ParseForm>) {
    dispatchParseForm({ type: 'patch', patch })
  }

  function changeSupplier(value: string | null) {
    const supplier = suppliers.find((item) => getEntityKey(item) === value) || null
    const defaults = getDefaultsForSupplier(supplier, organizations)

    updateForm({
      clientAgreementKey: getClientAgreementKey(defaults.clientAgreement),
      organizationKey: getEntityKey(defaults.organization),
      supplierKey: value || '',
    })
    dispatchPage({ type: 'setUploadResponse', uploadResponse: null })
  }

  function changeOrganization(value: string | null) {
    const organization = availableOrganizations.find((item) => getEntityKey(item) === value) || null
    const nextAgreement = filterAgreementsByOrganization(supplierAgreements, organization)[0] || null

    updateForm({
      clientAgreementKey: getClientAgreementKey(nextAgreement),
      organizationKey: value || '',
    })
    dispatchPage({ type: 'setUploadResponse', uploadResponse: null })
  }

  function changeFile(file: File | null) {
    updateForm({ file })
    dispatchPage({ type: 'setUploadResponse', uploadResponse: null })
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedSupplier || !selectedOrganization || !selectedClientAgreement) {
      dispatchPage({ type: 'setError', error: t('Оберіть постачальника, організацію та договір') })
      return
    }

    const dateFrom = normalizeDateTimeInput(form.dateFrom)

    if (!dateFrom) {
      dispatchPage({ type: 'setError', error: t('Оберіть дату') })
      return
    }

    if (!form.file || !isExcelFile(form.file)) {
      dispatchPage({ type: 'setError', error: t('Оберіть Excel файл') })
      return
    }

    const directParseConfiguration = isToUkraineMode ? null : toDirectParseConfiguration(parseForm)
    const toUkraineParseConfiguration = isToUkraineMode ? toUkraineParseConfigurationFromForm(parseForm) : null

    if ((isToUkraineMode && !toUkraineParseConfiguration) || (!isToUkraineMode && !directParseConfiguration)) {
      dispatchPage({ type: 'setError', error: t('Заповніть колонки імпорту') })
      return
    }

    dispatchPage({ type: 'setSaving', isSaving: true })
    dispatchPage({ type: 'setError', error: null })
    dispatchPage({ type: 'setUploadResponse', uploadResponse: null })

    try {
      const response = isToUkraineMode
        ? await createToUkraineOrderFromFile({
            dateFrom,
            file: form.file,
            form,
            parseConfiguration: toUkraineParseConfiguration!,
            selectedClientAgreement,
            selectedOrganization,
            selectedSupplier,
          })
        : await createDirectOrderFromFile({
            dateFrom,
            file: form.file,
            form,
            parseConfiguration: directParseConfiguration!,
            selectedClientAgreement,
            selectedOrganization,
            selectedSupplier,
          })

      const successNavigation = prepareSupplyUkraineOrderCreateNavigation(response, mode)

      if (!successNavigation) {
        dispatchPage({ type: 'setUploadResponse', uploadResponse: response })
        notifications.show({ color: 'red', message: t('Файл містить помилки') })
        return
      }

      notifications.show({ color: 'green', message: t('Замовлення створено') })
      navigate(successNavigation.path, { state: successNavigation.state })
    } catch (saveError) {
      dispatchPage({
        type: 'setError',
        error: saveError instanceof Error ? saveError.message : t('Не вдалося створити замовлення'),
      })
    } finally {
      dispatchPage({ type: 'setSaving', isSaving: false })
    }
  }

  return (
    <AppDrawer
      opened
      position="right"
      size="wide"
      title={<span className="app-sheet-title-mono">{isToUkraineMode ? t('Нова поставка в Україну') : t('Нове замовлення Україна')}</span>}
      onClose={() => navigate('/orders/ukraine/all')}
      footer={
        <Button
          color={CREATE_ACTION_COLOR}
          form="supply-ukraine-order-create-form"
          leftSection={<Upload size={16} />}
          loading={isSaving}
          type="submit"
        >
          {t('Створити')}
        </Button>
      }
    >
      <form id="supply-ukraine-order-create-form" onSubmit={submitForm}>
        <Stack gap="md">
          <Text c="dimmed" size="sm">
            {isToUkraineMode ? t('Створення поставки від постачальника') : t('Створення замовлення з файлу')}
          </Text>

          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}

          {uploadResponse?.HasError && (
            <UploadErrorsAlert response={uploadResponse} />
          )}

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <OrderDetailsSection
              agreementOptions={agreementOptions}
              form={form}
              isLoading={isLoading}
              isSaving={isSaving}
              isToUkraineMode={isToUkraineMode}
              organizationOptions={organizationOptions}
              selectedClientAgreement={selectedClientAgreement}
              selectedSupplier={selectedSupplier}
              supplierOptions={supplierOptions}
              supplierSearch={supplierSearch}
              onAgreementChange={(value) => updateForm({ clientAgreementKey: value || '' })}
              onFormChange={updateForm}
              onOrganizationChange={changeOrganization}
              onSupplierChange={changeSupplier}
              onSupplierSearchChange={(value) => dispatchPage({ type: 'setSupplierSearch', supplierSearch: value })}
            />

            <ImportConfigurationSection
              file={form.file}
              isSaving={isSaving}
              isToUkraineMode={isToUkraineMode}
              parseForm={parseForm}
              onFileChange={changeFile}
              onParseFormChange={updateParseForm}
            />
          </SimpleGrid>
        </Stack>
      </form>
    </AppDrawer>
  )
}

function OrderDetailsSection({
  agreementOptions,
  form,
  isLoading,
  isSaving,
  isToUkraineMode,
  organizationOptions,
  selectedClientAgreement,
  selectedSupplier,
  supplierOptions,
  supplierSearch,
  onAgreementChange,
  onFormChange,
  onOrganizationChange,
  onSupplierChange,
  onSupplierSearchChange,
}: {
  agreementOptions: SelectOption[]
  form: DirectOrderForm
  isLoading: boolean
  isSaving: boolean
  isToUkraineMode: boolean
  organizationOptions: SelectOption[]
  selectedClientAgreement: ClientAgreement | null
  selectedSupplier: Client | null
  supplierOptions: SelectOption[]
  supplierSearch: string
  onAgreementChange: (value: string | null) => void
  onFormChange: (patch: Partial<DirectOrderForm>) => void
  onOrganizationChange: (value: string | null) => void
  onSupplierChange: (value: string | null) => void
  onSupplierSearchChange: (value: string) => void
}) {
  const { t } = useI18n()

  return (
    <Stack gap="md">
      <Text className="app-section-title" fw={600} size="sm">{t('Замовлення')}</Text>
      <TextInput
        disabled={isLoading || isSaving}
        label={t('Дата')}
        type="datetime-local"
        value={form.dateFrom}
        onChange={(event) => onFormChange({ dateFrom: event.currentTarget.value })}
      />
      {isToUkraineMode ? (
        <>
          <TextInput
            disabled={isLoading || isSaving}
            label={t('Номер накладної')}
            value={form.invNumber}
            onChange={(event) => onFormChange({ invNumber: event.currentTarget.value })}
          />
          <TextInput
            disabled={isLoading || isSaving}
            label={t('Дата накладної')}
            type="datetime-local"
            value={form.invDate}
            onChange={(event) => onFormChange({ invDate: event.currentTarget.value })}
          />
        </>
      ) : (
        <SegmentedControl
          data={SUPPLY_TRANSPORTATION_TYPES.map((item) => ({ ...item, label: t(item.label) }))}
          disabled={isLoading || isSaving}
          fullWidth
          value={form.transportationType}
          onChange={(value) => onFormChange({ transportationType: value })}
        />
      )}
      <Select
        data={supplierOptions}
        disabled={isLoading || isSaving}
        label={t('Постачальник')}
        nothingFoundMessage={t('Нічого не знайдено')}
        searchable
        searchValue={supplierSearch}
        value={form.supplierKey || null}
        onChange={onSupplierChange}
        onSearchChange={onSupplierSearchChange}
      />
      <Select
        data={organizationOptions}
        disabled={isLoading || isSaving || !selectedSupplier}
        label={t('Організація')}
        searchable
        value={form.organizationKey || null}
        onChange={onOrganizationChange}
      />
      <Select
        data={agreementOptions}
        disabled={isLoading || isSaving || !selectedSupplier}
        label={t('Договір')}
        searchable
        value={form.clientAgreementKey || null}
        onChange={onAgreementChange}
      />
      {selectedClientAgreement?.Agreement?.Currency && (
        <Badge className="app-role-pill is-gray" variant="light">
          {t('Валюта')}: {selectedClientAgreement.Agreement.Currency.Code || selectedClientAgreement.Agreement.Currency.Name || '-'}
        </Badge>
      )}
      <Textarea
        autosize
        disabled={isSaving}
        label={t('Коментар')}
        minRows={3}
        value={form.comment}
        onChange={(event) => onFormChange({ comment: event.currentTarget.value })}
      />
    </Stack>
  )
}

function ImportConfigurationSection({
  file,
  isSaving,
  isToUkraineMode,
  parseForm,
  onFileChange,
  onParseFormChange,
}: {
  file: File | null
  isSaving: boolean
  isToUkraineMode: boolean
  parseForm: ParseForm
  onFileChange: (file: File | null) => void
  onParseFormChange: (patch: Partial<ParseForm>) => void
}) {
  const { t } = useI18n()

  return (
    <Stack gap="md">
      <Text className="app-section-title" fw={600} size="sm">{t('Імпорт')}</Text>
      <FileInput
        clearable
        accept={EXCEL_FILE_ACCEPT}
        disabled={isSaving}
        label={t('Файл')}
        leftSection={<FileSpreadsheet size={16} />}
        placeholder={t('Оберіть файл')}
        value={file}
        onChange={onFileChange}
      />
      <SegmentedControl
        data={[
          { label: t('Ціна'), value: 'unit' },
          { label: t('Сума'), value: 'total' },
        ]}
        disabled={isSaving}
        fullWidth
        value={parseForm.withTotalAmount ? 'total' : 'unit'}
        onChange={(value) => onParseFormChange({ withTotalAmount: value === 'total' })}
      />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <NumberInput
          allowDecimal={false}
          disabled={isSaving}
          label={t('Код товару')}
          min={1}
          value={parseForm.vendorCodeColumnNumber}
          onChange={(value) => onParseFormChange({ vendorCodeColumnNumber: toPositiveNumber(value) })}
        />
        <NumberInput
          allowDecimal={false}
          disabled={isSaving}
          label={t('Кількість')}
          min={1}
          value={parseForm.qtyColumnNumber}
          onChange={(value) => onParseFormChange({ qtyColumnNumber: toPositiveNumber(value) })}
        />
        <NumberInput
          allowDecimal={false}
          disabled={isSaving}
          label={t('З рядка')}
          min={1}
          value={parseForm.startRow}
          onChange={(value) => onParseFormChange({ startRow: toPositiveNumber(value) })}
        />
        <NumberInput
          allowDecimal={false}
          disabled={isSaving}
          label={t('До рядка')}
          min={1}
          value={parseForm.endRow}
          onChange={(value) => onParseFormChange({ endRow: toPositiveNumber(value) })}
        />
        <NumberInput
          allowDecimal={false}
          disabled={isSaving || parseForm.withTotalAmount}
          label={t('Колонка ціни')}
          min={1}
          value={parseForm.unitPriceColumnNumber}
          onChange={(value) => onParseFormChange({ unitPriceColumnNumber: toPositiveNumber(value) })}
        />
        <NumberInput
          allowDecimal={false}
          disabled={isSaving || !parseForm.withTotalAmount}
          label={t('Колонка суми')}
          min={1}
          value={parseForm.totalAmountColumnNumber}
          onChange={(value) => onParseFormChange({ totalAmountColumnNumber: toPositiveNumber(value) })}
        />
        <Checkbox
          checked={parseForm.withWeight}
          disabled={isSaving}
          label={t('Вага нетто')}
          onChange={(event) => onParseFormChange({
            isWeightPerItem: event.currentTarget.checked ? parseForm.isWeightPerItem : false,
            weightColumnNumber: event.currentTarget.checked ? parseForm.weightColumnNumber : '',
            withWeight: event.currentTarget.checked,
          })}
        />
        <NumberInput
          allowDecimal={false}
          disabled={isSaving || !parseForm.withWeight}
          label={t('Колонка ваги нетто')}
          min={1}
          value={parseForm.weightColumnNumber}
          onChange={(value) => onParseFormChange({ weightColumnNumber: toPositiveNumber(value) })}
        />
        <Checkbox
          checked={parseForm.withGrossWeight}
          disabled={isSaving}
          label={t('Вага брутто')}
          onChange={(event) => onParseFormChange({
            grossWeightColumnNumber: event.currentTarget.checked ? parseForm.grossWeightColumnNumber : '',
            isWeightPerItem: event.currentTarget.checked ? parseForm.isWeightPerItem : false,
            withGrossWeight: event.currentTarget.checked,
          })}
        />
        <NumberInput
          allowDecimal={false}
          disabled={isSaving || !parseForm.withGrossWeight}
          label={t('Колонка ваги брутто')}
          min={1}
          value={parseForm.grossWeightColumnNumber}
          onChange={(value) => onParseFormChange({ grossWeightColumnNumber: toPositiveNumber(value) })}
        />
        <Checkbox
          checked={parseForm.isWeightPerItem}
          disabled={isSaving || (!parseForm.withWeight && !parseForm.withGrossWeight)}
          label={parseForm.isWeightPerItem ? t('Вага за одиницю') : t('Вага загальна')}
          onChange={(event) => onParseFormChange({ isWeightPerItem: event.currentTarget.checked })}
        />
        {isToUkraineMode && (
          <SupplierImportExtraFields
            isSaving={isSaving}
            parseForm={parseForm}
            onParseFormChange={onParseFormChange}
          />
        )}
      </SimpleGrid>
    </Stack>
  )
}

function SupplierImportExtraFields({
  isSaving,
  parseForm,
  onParseFormChange,
}: {
  isSaving: boolean
  parseForm: ParseForm
  onParseFormChange: (patch: Partial<ParseForm>) => void
}) {
  const { t } = useI18n()

  return (
    <>
      <Checkbox
        checked={parseForm.withSpecificationCode}
        disabled={isSaving}
        label={t('Код специфікації')}
        onChange={(event) => onParseFormChange({
          specificationCodeColumnNumber: event.currentTarget.checked ? parseForm.specificationCodeColumnNumber : '',
          withSpecificationCode: event.currentTarget.checked,
        })}
      />
      <NumberInput
        allowDecimal={false}
        disabled={isSaving || !parseForm.withSpecificationCode}
        label={t('Колонка коду специфікації')}
        min={1}
        value={parseForm.specificationCodeColumnNumber}
        onChange={(value) => onParseFormChange({ specificationCodeColumnNumber: toPositiveNumber(value) })}
      />
      <Checkbox
        checked={parseForm.withImportedProduct}
        disabled={isSaving}
        label={t('Імпортний товар')}
        onChange={(event) => onParseFormChange({
          isImportedProductColumnNumber: event.currentTarget.checked ? parseForm.isImportedProductColumnNumber : '',
          withImportedProduct: event.currentTarget.checked,
        })}
      />
      <NumberInput
        allowDecimal={false}
        disabled={isSaving || !parseForm.withImportedProduct}
        label={t('Колонка ознаки імпорту')}
        min={1}
        value={parseForm.isImportedProductColumnNumber}
        onChange={(value) => onParseFormChange({ isImportedProductColumnNumber: toPositiveNumber(value) })}
      />
    </>
  )
}

function UploadErrorsAlert({ response }: { response: UploadResponse }) {
  const { t } = useI18n()
  const missingVendorCodes = response.MissingVendorCodes || []

  return (
    <Alert color="red" icon={<CircleAlert size={18} />} title={t('Файл містить помилки')} variant="light">
      <Stack gap="xs">
        {response.MissingVendorCodesFileUrl && (
          <Anchor href={response.MissingVendorCodesFileUrl} rel="noreferrer" target="_blank">
            {t('Завантажити файл')}
          </Anchor>
        )}
        {missingVendorCodes.length > 0 && (
          <Group gap={6} mah={220} style={{ overflowY: 'auto' }}>
            {missingVendorCodes.map((vendorCode, index) => (
              <Badge key={`${vendorCode}-${index}`} color="red" variant="outline">{vendorCode}</Badge>
            ))}
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

async function createDirectOrderFromFile({
  dateFrom,
  file,
  form,
  parseConfiguration,
  selectedClientAgreement,
  selectedOrganization,
  selectedSupplier,
}: {
  dateFrom: string
  file: File
  form: DirectOrderForm
  parseConfiguration: SupplyOrderDocumentParseConfiguration
  selectedClientAgreement: ClientAgreement
  selectedOrganization: Organization
  selectedSupplier: Client
}): Promise<SupplyOrderFromFileResponse> {
  const supplyOrder: DirectSupplyOrderCreatePayload = {
    Client: selectedSupplier,
    ClientAgreement: selectedClientAgreement,
    Comment: form.comment.trim(),
    DateFrom: dateFrom,
    Organization: selectedOrganization,
    TransportationType: Number(form.transportationType) as SupplyTransportationTypeValue,
  }

  return uploadDirectSupplyOrderFromFile({
    file,
    parseConfiguration,
    supplyOrder,
  })
}

async function createToUkraineOrderFromFile({
  dateFrom,
  file,
  form,
  parseConfiguration,
  selectedClientAgreement,
  selectedOrganization,
  selectedSupplier,
}: {
  dateFrom: string
  file: File
  form: DirectOrderForm
  parseConfiguration: UkraineOrderFromSupplierParseConfiguration
  selectedClientAgreement: ClientAgreement
  selectedOrganization: Organization
  selectedSupplier: Client
}): Promise<SupplyOrderUkraineFromFileResponse> {
  const invDate = normalizeDateTimeInput(form.invDate)

  if (!invDate) {
    throw new Error('Оберіть дату накладної')
  }

  const orderUkraine: SupplyOrderUkraineSupplierCreatePayload = {
    ClientAgreement: selectedClientAgreement,
    Comment: form.comment.trim(),
    FromDate: dateFrom,
    InvDate: invDate,
    InvNumber: form.invNumber.trim(),
    IsDirectFromSupplier: true,
    Organization: selectedOrganization,
    Supplier: selectedSupplier,
  }

  return uploadSupplyOrderUkraineFromSupplierFile({
    file,
    orderUkraine,
    parseConfiguration,
  })
}

function toDirectParseConfiguration(form: ParseForm): SupplyOrderDocumentParseConfiguration | null {
  const baseConfiguration = getBaseParseConfiguration(form)

  if (!baseConfiguration || !hasBaseParseConfiguration(baseConfiguration) || !hasValidParseConfiguration(form, baseConfiguration)) {
    return null
  }

  const totalAmountColumnNumber = form.withTotalAmount ? Number(form.totalAmountColumnNumber) : 0
  const unitPriceColumnNumber = form.withTotalAmount ? 0 : Number(form.unitPriceColumnNumber)

  return {
    EndRow: baseConfiguration.EndRow,
    GrossWeightColumnNumber: form.withGrossWeight ? Number(form.grossWeightColumnNumber) : 0,
    IsWeightPerUnit: form.withWeight || form.withGrossWeight ? form.isWeightPerItem : false,
    NetWeightColumnNumber: form.withWeight ? Number(form.weightColumnNumber) : 0,
    ProductIsImported: false,
    QtyColumnNumber: baseConfiguration.QtyColumnNumber,
    StartRow: baseConfiguration.StartRow,
    TotalAmountColumnNumber: totalAmountColumnNumber,
    UnitPriceColumnNumber: unitPriceColumnNumber,
    VendorCodeColumnNumber: baseConfiguration.VendorCodeColumnNumber,
    WithGrossWeight: form.withGrossWeight,
    WithNetWeight: form.withWeight,
    WithTotalAmount: form.withTotalAmount,
  }
}

function toUkraineParseConfigurationFromForm(form: ParseForm): UkraineOrderFromSupplierParseConfiguration | null {
  const baseConfiguration = getBaseParseConfiguration(form)

  if (!baseConfiguration || !hasBaseParseConfiguration(baseConfiguration) || !hasValidParseConfiguration(form, baseConfiguration)) {
    return null
  }

  if (form.withSpecificationCode && !form.specificationCodeColumnNumber) {
    return null
  }

  if (form.withImportedProduct && !form.isImportedProductColumnNumber) {
    return null
  }

  const totalAmountColumnNumber = form.withTotalAmount ? Number(form.totalAmountColumnNumber) : 0
  const unitPriceColumnNumber = form.withTotalAmount ? 0 : Number(form.unitPriceColumnNumber)

  return {
    EndRow: baseConfiguration.EndRow,
    GrossWeightColumnNumber: form.withGrossWeight ? Number(form.grossWeightColumnNumber) : 0,
    IsImportedProduct: form.withImportedProduct ? Number(form.isImportedProductColumnNumber) : 0,
    IsPricePerItem: !form.withTotalAmount,
    IsWeightPerItem: form.withWeight || form.withGrossWeight ? form.isWeightPerItem : false,
    QtyColumnNumber: baseConfiguration.QtyColumnNumber,
    SpecificationCodeColumnNumber: form.withSpecificationCode ? Number(form.specificationCodeColumnNumber) : 0,
    StartRow: baseConfiguration.StartRow,
    TotalAmountColumnNumber: totalAmountColumnNumber,
    UnitPriceColumnNumber: unitPriceColumnNumber,
    VendorCodeColumnNumber: baseConfiguration.VendorCodeColumnNumber,
    WeightColumnNumber: form.withWeight ? Number(form.weightColumnNumber) : 0,
    WithTotalAmount: form.withTotalAmount,
    WithGrossWeight: form.withGrossWeight,
    WithIsImportedProduct: form.withImportedProduct,
    WithSpecificationCode: form.withSpecificationCode,
    WithWeight: form.withWeight,
  }
}

function getBaseParseConfiguration(form: ParseForm) {
  const baseConfiguration = {
    EndRow: form.endRow,
    QtyColumnNumber: form.qtyColumnNumber,
    StartRow: form.startRow,
    VendorCodeColumnNumber: form.vendorCodeColumnNumber,
  }

  return baseConfiguration
}

function hasValidParseConfiguration(
  form: ParseForm,
  baseConfiguration: {
    EndRow: number
    QtyColumnNumber: number
    StartRow: number
    VendorCodeColumnNumber: number
  },
): boolean {
  if (baseConfiguration.StartRow > baseConfiguration.EndRow) {
    return false
  }

  if (form.withTotalAmount && !form.totalAmountColumnNumber) {
    return false
  }

  if (!form.withTotalAmount && !form.unitPriceColumnNumber) {
    return false
  }

  if (form.withWeight && !form.weightColumnNumber) {
    return false
  }

  return !(form.withGrossWeight && !form.grossWeightColumnNumber)
}

function hasBaseParseConfiguration(configuration: {
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
