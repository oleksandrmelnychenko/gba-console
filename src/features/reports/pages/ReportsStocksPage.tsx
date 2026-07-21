import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { AppModal } from '../../../shared/ui/AppModal'
import { CheckboxMultiSelect } from '../../../shared/ui/CheckboxMultiSelect'
import { CircleAlert, Download, FileSpreadsheet, FileText, Plus, Printer, RefreshCw, RotateCcw, Save, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useMemo } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  createStockReport,
  getReportClientAgreements,
  getReportClientTypes,
  getReportOrganizations,
  getReportPricings,
  getReportProductGroups,
  getReportProductTop,
  getReportRegions,
  getReportRegionCodes,
  searchReportClients,
  searchReportProducts,
  searchReportUsers,
  searchSaleReturnReportDocuments,
  searchSalesReportDocuments,
} from '../api/reportsApi'
import {
  REPORT_FILTER_CONDITIONS,
  isMultiValueReportCondition,
  REPORT_FILTER_FIELD_GROUPS,
  REPORT_FILTER_FIELD_TYPES,
  createDefaultMeasurementGroups,
  flattenCheckedMeasurements,
  flattenGroupingOptions,
  getReportFieldLabel,
} from '../data/reportOptions'
import type {
  ReportEntity,
  ReportFilterField,
  ReportGroupingItem,
  ReportMeasurementGroup,
  ReportRequestBody,
  ReportResult,
  ReportSelection,
  ReportSelectedValue,
  ReportTemplate,
} from '../types'
import {
  buildCsv,
  buildDateFileSuffix,
  displayValue,
  downloadTextFile,
  getEntityDisplayName,
  formatDate,
} from '../utils'
import './reports-pages.css'

const STORAGE_KEY = 'app_configs_reports_template'
const LOOKUP_SEARCH_DEBOUNCE_MS = 300
const LOOKUP_SEARCH_LIMIT = 30

const SALE_DOCUMENT_STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { value: 'All', label: 'Всі' },
  { value: 'New', label: 'SaleLifeCycleNew' },
  { value: 'Packaging', label: 'SaleLifeCyclePackaging' },
  { value: 'InvoiceChanged', label: 'InvoiceChanged' },
  { value: 'TransporterChanged', label: 'TransporterChanged' },
  { value: 'OrderClosed', label: 'OrderClosed' },
]

const defaultCondition = REPORT_FILTER_CONDITIONS[0]

function createEmptySelection(): ReportSelection {
  return {
    IsChecked: true,
    SelectedField: {
      Name: '',
      Type: 0,
    },
    FilterCondition: {
      Name: defaultCondition.Name,
      Type: defaultCondition.Type,
    },
    Values: [],
  }
}

export function ReportsStocksPage() {
  const { t } = useI18n()
  const today = useMemo(() => formatLocalDate(new Date()), [])
  const [from, setFrom] = useValueState(today)
  const [to, setTo] = useValueState(today)
  const [measurements, setMeasurements] = useValueState<ReportMeasurementGroup[]>(createDefaultMeasurementGroups)
  const [rowGroups, setRowGroups] = useValueState<ReportGroupingItem[]>([])
  const [colGroups, setColGroups] = useValueState<ReportGroupingItem[]>([])
  const [selections, setSelections] = useValueState<ReportSelection[]>([createEmptySelection()])
  const [result, setResult] = useValueState<ReportResult | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [templateName, setTemplateName] = useValueState('')
  const [templates, setTemplates] = useValueState<ReportTemplate[]>([])
  const groupingOptions = useMemo(() => flattenGroupingOptions(), [])
  const groupingSelectData = groupingOptions.map((item) => ({
    label: `${item.group}: ${getReportFieldLabel(item.key)}`,
    value: String(item.type),
  }))
  const filterFieldOptions = useMemo(
    () =>
      REPORT_FILTER_FIELD_GROUPS.flatMap((group) =>
        group.children.map((child) => ({
          label: `${getReportFieldLabel(group.label)}: ${getReportFieldLabel(child.label)}`,
          value: `${child.type}`,
          field: {
            Name: child.label,
            Type: child.type,
            ParentType: group.label,
          } satisfies ReportFilterField,
        })),
      ),
    [],
  )
  const filterError = getFilterError(from, to)
  const reportBody = useMemo<ReportRequestBody>(
    () => ({
      from,
      to,
      sorted: {
        Col: colGroups,
        Row: rowGroups,
        Measurements: flattenCheckedMeasurements(measurements),
      },
      selections: selections.filter((selection) => selection.IsChecked && selection.SelectedField.Name),
    }),
    [colGroups, from, measurements, rowGroups, selections, to],
  )
  const checkedMeasurements = reportBody.sorted.Measurements.length
  const canSubmit = !filterError && checkedMeasurements > 0

  useEffect(() => {
    setTemplates(parseTemplates(localStorage.getItem(STORAGE_KEY)))
  }, [setTemplates])

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSubmit) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const nextResult = await createStockReport(reportBody)

      setResult(nextResult)
      if (nextResult.document.DocumentURL || nextResult.document.PdfDocumentURL) {
        setDownloadModalOpened(true)
      }
    } catch (submitError) {
      setResult(null)
      setError(submitError instanceof Error ? submitError.message : t('Не вдалося сформувати звіт'))
    } finally {
      setLoading(false)
    }
  }

  function resetReport() {
    setFrom(today)
    setTo(today)
    setMeasurements(createDefaultMeasurementGroups())
    setRowGroups([])
    setColGroups([])
    setSelections([createEmptySelection()])
    setResult(null)
    setError(null)
  }

  function saveTemplate() {
    const normalizedName = templateName.trim()

    if (!normalizedName) {
      return
    }

    const rawTemplates = localStorage.getItem(STORAGE_KEY)
    const parsedTemplates = parseTemplates(rawTemplates)
    const nextTemplates = [
      ...parsedTemplates.filter((template) => template.Name !== normalizedName),
      { Name: normalizedName, Data: reportBody },
    ]

    persistTemplates(nextTemplates)
  }

  function loadTemplates() {
    setTemplates(parseTemplates(localStorage.getItem(STORAGE_KEY)))
  }

  function persistTemplates(nextTemplates: ReportTemplate[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTemplates))
    setTemplates(nextTemplates)
  }

  function updateTemplate(name: string) {
    const nextTemplates = parseTemplates(localStorage.getItem(STORAGE_KEY)).map((template) =>
      template.Name === name ? { ...template, Data: reportBody } : template,
    )

    persistTemplates(nextTemplates)
  }

  function deleteTemplate(name: string) {
    persistTemplates(parseTemplates(localStorage.getItem(STORAGE_KEY)).filter((template) => template.Name !== name))
  }

  function applyTemplate(template: ReportTemplate) {
    setTemplateName(template.Name)
    setFrom(template.Data.from || today)
    setTo(template.Data.to || today)
    setRowGroups(template.Data.sorted?.Row || [])
    setColGroups(template.Data.sorted?.Col || [])
    setSelections(template.Data.selections?.length ? template.Data.selections : [createEmptySelection()])
    setMeasurements(applyTemplateMeasurements(createDefaultMeasurementGroups(), template.Data.sorted?.Measurements || []))
  }

  function exportPreviewCsv() {
    if (!result?.table.rows.length) {
      return
    }

    downloadTextFile(
      `reports-stocks-${buildDateFileSuffix()}.csv`,
      buildCsv(result.table.columns, result.table.rows),
    )
  }

  return (
    <Stack className="reports-stocks-page" gap={6}>
      <Card className="app-data-card reports-stocks-shell" withBorder radius="md" padding={0}>
        <form className="reports-stocks-form" onSubmit={submitReport}>
          <div className="app-filter-bar reports-stocks-filter-bar">
            <div className="app-filter-date-range">
              <TextInput label={t('Від')} type="date" value={from} onChange={(event) => setFrom(event.currentTarget.value)} />
              <TextInput label={t('До')} type="date" value={to} onChange={(event) => setTo(event.currentTarget.value)} />
            </div>
            <Badge className="reports-stocks-status" color={isLoading ? 'blue' : 'gray'} variant="light">
              {isLoading ? t('Формується') : `${t('Показників')}: ${checkedMeasurements}`}
            </Badge>
            <div className="app-filter-actions reports-stocks-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} variant="light" color="gray" size={34} onClick={resetReport}>
                  <RotateCcw size={17} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Друк')}>
                <ActionIcon aria-label={t('Друк')} variant="light" color="gray" size={34} onClick={() => window.print()}>
                  <Printer size={17} />
                </ActionIcon>
              </Tooltip>
            </div>
            <Tooltip label={t('Сформувати')}>
              <Button color={CREATE_ACTION_COLOR} loading={isLoading} disabled={!canSubmit} type="submit">
                {t('Сформувати')}
              </Button>
            </Tooltip>
          </div>

          <div className="reports-stocks-body">
            <Stack className="reports-stocks-content" gap="md" p="md">

            {filterError ? (
              <Alert color="red" icon={<CircleAlert size={18} />}>{filterError}</Alert>
            ) : null}

            <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={700}>{t('Показники')}</Text>
                  <Group gap={6}>
                    <Button size="xs" variant="outline" onClick={() => setAllMeasurements(setMeasurements, true)}>
                      {t('Усі')}
                    </Button>
                    <Button size="xs" variant="subtle" color="gray" onClick={() => setAllMeasurements(setMeasurements, false)}>
                      {t('Очистити')}
                    </Button>
                  </Group>
                </Group>
                <Stack gap={8}>
                  {measurements.map((group, groupIndex) => (
                    <Stack key={group.Name} gap={4}>
                      <Checkbox
                        checked={group.IsChecked}
                        label={getReportFieldLabel(group.Name)}
                        onChange={() => toggleMeasurementGroup(measurements, groupIndex, setMeasurements)}
                      />
                      <Stack gap={4} pl="lg">
                        {group.SubList.map((item, itemIndex) => (
                          <Checkbox
                            key={item.Name}
                            checked={item.IsChecked}
                            label={getReportFieldLabel(item.Name)}
                            size="sm"
                            onChange={() => toggleMeasurementItem(measurements, groupIndex, itemIndex, setMeasurements)}
                          />
                        ))}
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </Stack>

              <GroupingEditor
                title={t('Рядки')}
                groups={rowGroups}
                options={groupingSelectData}
                onAdd={(item) => setRowGroups((current) => [...current, item])}
                onRemove={(index) => setRowGroups((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                resolveItem={(value) => groupingOptions.find((item) => String(item.type) === value)}
              />

              <GroupingEditor
                title={t('Колонки')}
                groups={colGroups}
                options={groupingSelectData}
                onAdd={(item) => setColGroups((current) => [...current, item])}
                onRemove={(index) => setColGroups((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                resolveItem={(value) => groupingOptions.find((item) => String(item.type) === value)}
              />
            </SimpleGrid>

            <Divider />

            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={700}>{t('Умови відбору')}</Text>
                <Button
                  leftSection={<Plus size={16} />}
                  size="xs"
                  variant="outline"
                  onClick={() => setSelections((current) => [...current, createEmptySelection()])}
                >
                  {t('Додати')}
                </Button>
              </Group>

              <Stack gap="xs">
                {selections.map((selection, index) => (
                  <Group key={getSelectionRenderKey(selection, index)} gap="xs" align="end" wrap="wrap">
                    <Checkbox
                      checked={selection.IsChecked}
                      onChange={() => updateSelection(selections, index, setSelections, { IsChecked: !selection.IsChecked })}
                    />
                    <Select
                      data={filterFieldOptions}
                      label={index === 0 ? t('Поле') : undefined}
                      placeholder={t('Оберіть поле')}
                      searchable
                      value={selection.SelectedField.Name ? String(selection.SelectedField.Type) : null}
                      w={260}
                      onChange={(value) => {
                        const option = filterFieldOptions.find((item) => item.value === value)
                        updateSelection(selections, index, setSelections, {
                          SelectedField: option?.field || { Name: '', Type: 0 },
                          Values: [],
                        })
                      }}
                    />
                    <Select
                      data={REPORT_FILTER_CONDITIONS.map((condition) => ({
                        label: condition.Name,
                        value: String(condition.Type),
                      }))}
                      label={index === 0 ? t('Умова') : undefined}
                      value={String(selection.FilterCondition.Type)}
                      w={180}
                      onChange={(value) => {
                        const condition = REPORT_FILTER_CONDITIONS.find((item) => String(item.Type) === value) || defaultCondition
                        // Switching to a single-value condition drops the extra accumulated values.
                        const nextValues =
                          !isMultiValueReportCondition(condition.Type) && selection.Values.length > 1
                            ? selection.Values.slice(0, 1)
                            : selection.Values
                        updateSelection(selections, index, setSelections, { FilterCondition: condition, Values: nextValues })
                      }}
                    />
                    <SelectionValuePicker
                      from={from}
                      label={index === 0 ? t('Значення') : undefined}
                      selection={selection}
                      selections={selections}
                      to={to}
                      onChange={(values) => updateSelection(selections, index, setSelections, { Values: values })}
                    />
                    <Tooltip label={t('Видалити')}>
                      <ActionIcon
                        aria-label={t('Видалити')}
                        color="red"
                        variant="subtle"
                        onClick={() => setSelections((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        <Trash2 size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                ))}
              </Stack>
            </Stack>

            <Divider />

            <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
              <TextInput
                label={t('Шаблон')}
                placeholder={t('Назва шаблону')}
                value={templateName}
                onChange={(event) => setTemplateName(event.currentTarget.value)}
              />
              <Button variant="outline" onClick={saveTemplate}>{t('Зберегти шаблон')}</Button>
              <Button leftSection={<RefreshCw size={16} />} variant="subtle" color="gray" onClick={loadTemplates}>
                {t('Показати шаблони')}
              </Button>
            </Group>
            {templates.length ? (
              <Stack gap={6}>
                {templates.map((template) => (
                  <Group key={template.Name} gap={6} wrap="nowrap">
                    <Button
                      leftSection={<RotateCcw size={16} />}
                      size="xs"
                      variant="default"
                      onClick={() => applyTemplate(template)}
                    >
                      {template.Name} ({formatDate(template.Data.from)} - {formatDate(template.Data.to)})
                    </Button>
                    <Tooltip label={t('Оновити')}>
                      <ActionIcon
                        aria-label={t('Оновити')}
                        color="blue"
                        size="sm"
                        variant="subtle"
                        onClick={() => updateTemplate(template.Name)}
                      >
                        <Save size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={t('Видалити')}>
                      <ActionIcon
                        aria-label={t('Видалити')}
                        color="red"
                        size="sm"
                        variant="subtle"
                        onClick={() => deleteTemplate(template.Name)}
                      >
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                ))}
              </Stack>
            ) : null}
            </Stack>

            {error ? <Alert className="reports-page-alert" color="red" icon={<CircleAlert size={18} />}>{error}</Alert> : null}

            <section className="reports-stocks-result">
              <Group className="reports-stocks-result-header" justify="space-between">
                <Box>
                  <Text fw={700}>{t('Результат')}</Text>
                  <Text size="xs" c="dimmed">
                    {result ? `${t('Рядків')}: ${result.table.rows.length}` : t('Після формування тут буде preview відповіді API')}
                  </Text>
                </Box>
                <Group gap={6}>
                  <Button
                    leftSection={<Download size={16} />}
                    disabled={!result?.table.rows.length}
                    size="xs"
                    type="button"
                    variant="outline"
                    onClick={exportPreviewCsv}
                  >
                    CSV
                  </Button>
                  <Button
                    disabled={!result?.document.DocumentURL && !result?.document.PdfDocumentURL}
                    size="xs"
                    type="button"
                    variant="outline"
                    onClick={() => setDownloadModalOpened(true)}
                  >
                    {t('Файли')}
                  </Button>
                </Group>
              </Group>

              {result?.table.rows.length ? (
                <ReportPreview result={result} />
              ) : (
                <div className="reports-stocks-empty-state">
                  <Text c="dimmed">{t('Даних ще немає')}</Text>
                </div>
              )}
            </section>
          </div>
        </form>
      </Card>

      <AppModal centered opened={downloadModalOpened} title={t('Експорт звіту')} onClose={() => setDownloadModalOpened(false)}>
        <Stack>
          {result?.document.DocumentURL ? (
            <Anchor href={getDocumentHref(result.document.DocumentURL)} target="_blank" rel="noreferrer">
              <Group gap="xs"><FileSpreadsheet size={18} /> XLSX</Group>
            </Anchor>
          ) : null}
          {result?.document.PdfDocumentURL ? (
            <Anchor href={getDocumentHref(result.document.PdfDocumentURL)} target="_blank" rel="noreferrer">
              <Group gap="xs"><FileText size={18} /> PDF</Group>
            </Anchor>
          ) : null}
          {!result?.document.DocumentURL && !result?.document.PdfDocumentURL ? <Text c="dimmed">{t('Файл не повернувся з API')}</Text> : null}
        </Stack>
      </AppModal>
    </Stack>
  )
}

type SelectionValuePickerProps = {
  from: string
  label?: string
  selection: ReportSelection
  selections: ReportSelection[]
  to: string
  onChange: (values: ReportSelectedValue[]) => void
}

function SelectionValuePicker({ from, label, selection, selections, to, onChange }: SelectionValuePickerProps) {
  const { t } = useI18n()
  const [search, setSearch] = useValueState('')
  const [manualValue, setManualValue] = useValueState('')
  const [options, setOptions] = useValueState<ReportEntity[]>([])
  const [isLoading, setLoading] = useValueState(false)
  const [docStatus, setDocStatus] = useValueState('All')
  const [docOrganisationIds, setDocOrganisationIds] = useValueState<string[]>([])
  const [docSelfSales, setDocSelfSales] = useValueState(false)
  const [organizationOptions, setOrganizationOptions] = useValueState<ReportEntity[]>([])
  const [debouncedSearch] = useDebouncedValue(search, LOOKUP_SEARCH_DEBOUNCE_MS)
  const lookupMode = getSelectionLookupMode(selection.SelectedField.Type)
  const isSaleDocumentFilter = selection.SelectedField.Type === REPORT_FILTER_FIELD_TYPES.saleDocumentNumberDate
  const saleDocumentFilters = useMemo(
    () => ({
      organisationIds: docOrganisationIds.map((id) => Number(id)),
      status: docStatus,
      type: docSelfSales ? ('Self' as const) : ('All' as const),
    }),
    [docOrganisationIds, docSelfSales, docStatus],
  )
  const organizationSelectData = useMemo(
    () =>
      organizationOptions
        .filter((organization) => typeof organization.Id === 'number')
        .map((organization) => ({ label: getEntityDisplayName(organization), value: String(organization.Id) })),
    [organizationOptions],
  )
  const normalizedSearch = lookupMode === 'search' ? debouncedSearch.trim() : ''
  const minSearchLength = getSelectionLookupMinLength(selection.SelectedField.Type)
  const dependentClientNetId = lookupMode === 'dependent' ? getDependentClientNetId(selections) : ''
  const selectOptions = useMemo(
    () =>
      mergeReportEntities([...selection.Values.map((value) => value.Data), ...options]).map((entity, index) => ({
        label: getEntityDisplayName(entity),
        value: getReportEntityKey(entity, String(index)),
      })),
    [options, selection.Values],
  )

  useEffect(() => {
    if (!isSaleDocumentFilter) {
      return
    }

    let cancelled = false

    async function loadOrganizations() {
      try {
        const organizations = await getReportOrganizations()

        if (!cancelled) {
          setOrganizationOptions(organizations)
        }
      } catch {
        if (!cancelled) {
          setOrganizationOptions([])
        }
      }
    }

    void loadOrganizations()

    return () => {
      cancelled = true
    }
  }, [isSaleDocumentFilter, setOrganizationOptions])

  useEffect(() => {
    if (!selection.SelectedField.Name || lookupMode === 'manual') {
      setOptions([])
      setLoading(false)

      return
    }

    if (lookupMode === 'search' && normalizedSearch.length < minSearchLength) {
      setOptions([])
      setLoading(false)

      return
    }

    if (lookupMode === 'dependent' && !dependentClientNetId) {
      setOptions([])
      setLoading(false)

      return
    }

    let cancelled = false
    const controller = new AbortController()

    async function loadOptions() {
      setLoading(true)

      try {
        const nextOptions =
          lookupMode === 'dependent'
            ? await getReportClientAgreements(dependentClientNetId)
            : await loadSelectionLookupOptions(
                selection.SelectedField.Type,
                normalizedSearch,
                from,
                to,
                controller.signal,
                saleDocumentFilters,
              )

        if (!cancelled) {
          setOptions(nextOptions)
        }
      } catch {
        if (!cancelled) {
          setOptions([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadOptions()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    dependentClientNetId,
    from,
    lookupMode,
    minSearchLength,
    normalizedSearch,
    saleDocumentFilters,
    selection.SelectedField.Name,
    selection.SelectedField.Type,
    setLoading,
    setOptions,
    to,
  ])

  function addEntity(entity: ReportEntity) {
    const key = getReportEntityKey(entity, getEntityDisplayName(entity))

    if (selection.Values.some((value) => getReportEntityKey(value.Data, value.Name) === key)) {
      return
    }

    // Equals/NotEquals (and single-group) conditions hold exactly one value — replace rather than accumulate;
    // only the list conditions build up multiple values (legacy parity).
    if (!isMultiValueReportCondition(selection.FilterCondition.Type)) {
      onChange([createSelectedValue(entity)])
      return
    }

    onChange([...selection.Values, createSelectedValue(entity)])
  }

  function addManualValue() {
    const value = manualValue.trim()

    if (!value) {
      return
    }

    addEntity({ Name: value, Value: value })
    setManualValue('')
  }

  function removeValue(valueIndex: number) {
    onChange(selection.Values.filter((_, index) => index !== valueIndex))
  }

  if (!selection.SelectedField.Name) {
    return (
      <TextInput
        disabled
        label={label}
        placeholder={t('Спочатку оберіть поле')}
        value=""
        w={320}
      />
    )
  }

  return (
    <Stack gap={4} w={320}>
      {isSaleDocumentFilter ? (
        <Stack gap={6}>
          <Select
            allowDeselect={false}
            data={SALE_DOCUMENT_STATUS_OPTIONS.map((option) => ({ label: t(option.label), value: option.value }))}
            label={t('Статус')}
            value={docStatus}
            onChange={(value) => setDocStatus(value || 'All')}
          />
          <CheckboxMultiSelect
            data={organizationSelectData}
            label={t('Організація')}
            placeholder={t('Всі')}
            value={docOrganisationIds}
            onChange={setDocOrganisationIds}
          />
          <Switch
            checked={docSelfSales}
            label={t('Власні продажі')}
            onChange={(event) => setDocSelfSales(event.currentTarget.checked)}
          />
        </Stack>
      ) : null}
      {lookupMode === 'manual' ? (
        <Group align="end" gap={6} wrap="nowrap">
          <TextInput
            label={label}
            placeholder={t('Значення')}
            value={manualValue}
            onChange={(event) => setManualValue(event.currentTarget.value)}
          />
          <Button size="sm" type="button" variant="outline" onClick={addManualValue}>
            {t('Додати')}
          </Button>
        </Group>
      ) : (
        <Select
          clearable
          searchable
          data={selectOptions}
          label={label}
          nothingFoundMessage={
            lookupMode === 'search' && normalizedSearch.length < minSearchLength
              ? t('Введіть мінімум 2 символи')
              : lookupMode === 'dependent' && !dependentClientNetId
                ? t('Спочатку оберіть клієнта')
                : t('Нічого не знайдено')
          }
          placeholder={t('Пошук значення')}
          rightSection={isLoading ? <Loader size="xs" /> : null}
          searchValue={search}
          value={null}
          onChange={(value) => {
            const entity = value
              ? mergeReportEntities([...selection.Values.map((selectedValue) => selectedValue.Data), ...options])
                  .find((option, index) => getReportEntityKey(option, String(index)) === value)
              : undefined

            if (entity) {
              addEntity(entity)
              setSearch('')
            }
          }}
          onSearchChange={setSearch}
        />
      )}
      {selection.Values.length ? (
        <Group gap={4}>
          {selection.Values.map((value, valueIndex) => (
            <Badge
              key={`${getReportEntityKey(value.Data, value.Name)}-${valueIndex}`}
              color="blue"
              radius="sm"
              rightSection={(
                <ActionIcon
                  aria-label={t('Видалити')}
                  color="blue"
                  size="xs"
                  variant="transparent"
                  onClick={() => removeValue(valueIndex)}
                >
                  <Trash2 size={12} />
                </ActionIcon>
              )}
              variant="light"
            >
              {value.Name}
            </Badge>
          ))}
        </Group>
      ) : null}
    </Stack>
  )
}

type GroupingEditorProps = {
  groups: ReportGroupingItem[]
  options: Array<{ label: string; value: string }>
  title: string
  onAdd: (item: ReportGroupingItem) => void
  onRemove: (index: number) => void
  resolveItem: (value: string) => ReportGroupingItem | undefined
}

function GroupingEditor({ groups, options, title, onAdd, onRemove, resolveItem }: GroupingEditorProps) {
  const { t } = useI18n()

  return (
    <Stack gap="sm">
      <Text fw={700}>{title}</Text>
      <Select
        clearable
        data={options}
        placeholder={t('Додати групування')}
        searchable
        value={null}
        onChange={(value) => {
          const item = value ? resolveItem(value) : undefined

          if (item) {
            onAdd(item)
          }
        }}
      />
      <Stack gap={6}>
        {groups.map((group, index) => (
          <Group key={`${group.type}-${index}`} justify="space-between" wrap="nowrap">
            <Text size="sm">{getReportFieldLabel(group.key)}</Text>
            <ActionIcon aria-label={t('Видалити')} color="red" size="sm" variant="subtle" onClick={() => onRemove(index)}>
              <Trash2 size={16} />
            </ActionIcon>
          </Group>
        ))}
        {!groups.length ? <Text size="sm" c="dimmed">{t('Не задано')}</Text> : null}
      </Stack>
    </Stack>
  )
}

function ReportPreview({ result }: { result: ReportResult }) {
  const { t } = useI18n()

  return (
    <Box className="reports-stocks-preview">
      <Table striped highlightOnHover withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            {result.table.columns.map((column) => (
              <Table.Th key={column}>{column}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {result.table.rows.slice(0, 100).map((row, rowIndex) => (
            <Table.Tr key={getResultRowKey(result.table.columns, row, rowIndex)}>
              {result.table.columns.map((column) => (
                <Table.Td key={column}>{displayValue(row[column])}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
        {Object.keys(result.totals).length ? (
          <Table.Tfoot>
            <Table.Tr>
              {result.table.columns.map((column, index) => (
                <Table.Th key={column}>{index === 0 ? t('Разом') : displayValue(result.totals[column])}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Tfoot>
        ) : null}
      </Table>
    </Box>
  )
}

function getFilterError(from: string, to: string): string | null {
  if (!from || !to) {
    return 'Оберіть період'
  }

  if (from > to) {
    return 'Дата початку не може бути пізніше дати завершення'
  }

  return null
}

function setAllMeasurements(
  setter: (value: ReportMeasurementGroup[] | ((current: ReportMeasurementGroup[]) => ReportMeasurementGroup[])) => void,
  checked: boolean,
) {
  setter((current) =>
    current.map((group) => ({
      ...group,
      IsChecked: checked,
      SubList: group.SubList.map((item) => ({ ...item, IsChecked: checked })),
    })),
  )
}

function toggleMeasurementGroup(
  groups: ReportMeasurementGroup[],
  groupIndex: number,
  setter: (value: ReportMeasurementGroup[]) => void,
) {
  setter(groups.map((group, index) => {
    if (index !== groupIndex) {
      return group
    }

    const checked = !group.IsChecked

    return {
      ...group,
      IsChecked: checked,
      SubList: group.SubList.map((item) => ({ ...item, IsChecked: checked })),
    }
  }))
}

function toggleMeasurementItem(
  groups: ReportMeasurementGroup[],
  groupIndex: number,
  itemIndex: number,
  setter: (value: ReportMeasurementGroup[]) => void,
) {
  setter(groups.map((group, index) => {
    if (index !== groupIndex) {
      return group
    }

    const subList = group.SubList.map((item, subIndex) =>
      subIndex === itemIndex ? { ...item, IsChecked: !item.IsChecked } : item,
    )

    return {
      ...group,
      IsChecked: subList.every((item) => item.IsChecked),
      SubList: subList,
    }
  }))
}

function updateSelection(
  selections: ReportSelection[],
  index: number,
  setter: (value: ReportSelection[]) => void,
  patch: Partial<ReportSelection>,
) {
  setter(selections.map((selection, itemIndex) => (itemIndex === index ? { ...selection, ...patch } : selection)))
}

function parseTemplates(raw: string | null): Array<{ Data: ReportRequestBody; Name: string }> {
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown

    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is { Data: ReportRequestBody; Name: string } =>
        Boolean(item && typeof item === 'object' && 'Data' in item && 'Name' in item),
      )
    }
  } catch {
    return []
  }

  return []
}

function getSelectionLookupMode(fieldType: number): 'manual' | 'search' | 'static' | 'dependent' {
  switch (fieldType) {
    case REPORT_FILTER_FIELD_TYPES.organization:
    case REPORT_FILTER_FIELD_TYPES.customer:
    case REPORT_FILTER_FIELD_TYPES.customerRegion:
    case REPORT_FILTER_FIELD_TYPES.customerRegionCode:
    case REPORT_FILTER_FIELD_TYPES.customerPriceType:
    case REPORT_FILTER_FIELD_TYPES.productTop:
      return 'static'
    case REPORT_FILTER_FIELD_TYPES.customerContract:
      return 'dependent'
    case REPORT_FILTER_FIELD_TYPES.productArticle:
    case REPORT_FILTER_FIELD_TYPES.productGroup:
    case REPORT_FILTER_FIELD_TYPES.customerName:
    case REPORT_FILTER_FIELD_TYPES.customerManager:
    case REPORT_FILTER_FIELD_TYPES.saleDocumentNumberDate:
    case REPORT_FILTER_FIELD_TYPES.saleReturnDocument:
    case REPORT_FILTER_FIELD_TYPES.saleDocumentManagerInput:
    case REPORT_FILTER_FIELD_TYPES.saleDocumentManagerPosted:
      return 'search'
    default:
      return 'manual'
  }
}

function getSelectionLookupMinLength(fieldType: number): number {
  return fieldType === REPORT_FILTER_FIELD_TYPES.productGroup ? 0 : 2
}

function getDependentClientNetId(selections: ReportSelection[]): string {
  const customerNameSelection = selections.find(
    (selection) => selection.IsChecked && selection.SelectedField.Type === REPORT_FILTER_FIELD_TYPES.customerName,
  )

  const clientValue = customerNameSelection?.Values.find((value) => value.Data && value.Data.NetUid)

  return clientValue?.Data.NetUid ? String(clientValue.Data.NetUid) : ''
}

type SaleDocumentLookupFilters = {
  organisationIds: number[]
  status: string
  type: 'All' | 'Self'
}

async function loadSelectionLookupOptions(
  fieldType: number,
  value: string,
  from: string,
  to: string,
  signal?: AbortSignal,
  saleDocumentFilters?: SaleDocumentLookupFilters,
): Promise<ReportEntity[]> {
  switch (fieldType) {
    case REPORT_FILTER_FIELD_TYPES.organization:
      return getReportOrganizations()
    case REPORT_FILTER_FIELD_TYPES.customer:
      return getReportClientTypes()
    case REPORT_FILTER_FIELD_TYPES.customerRegion:
      return getReportRegions()
    case REPORT_FILTER_FIELD_TYPES.customerRegionCode:
      return getReportRegionCodes()
    case REPORT_FILTER_FIELD_TYPES.customerPriceType:
      return getReportPricings()
    case REPORT_FILTER_FIELD_TYPES.productTop:
      return getReportProductTop()
    case REPORT_FILTER_FIELD_TYPES.productGroup:
      return getReportProductGroups(value)
    case REPORT_FILTER_FIELD_TYPES.productArticle:
      return searchReportProducts({ limit: LOOKUP_SEARCH_LIMIT, offset: 0, value })
    case REPORT_FILTER_FIELD_TYPES.customerName:
      return searchReportClients({ limit: LOOKUP_SEARCH_LIMIT, offset: 0, value }, signal)
    case REPORT_FILTER_FIELD_TYPES.customerManager:
    case REPORT_FILTER_FIELD_TYPES.saleDocumentManagerInput:
    case REPORT_FILTER_FIELD_TYPES.saleDocumentManagerPosted:
      return searchReportUsers({ limit: LOOKUP_SEARCH_LIMIT, offset: 0, value })
    case REPORT_FILTER_FIELD_TYPES.saleDocumentNumberDate:
      return searchSalesReportDocuments({
        from,
        limit: LOOKUP_SEARCH_LIMIT,
        offset: 0,
        organisationIds: saleDocumentFilters?.organisationIds ?? [],
        status: saleDocumentFilters?.status ?? 'All',
        to,
        type: saleDocumentFilters?.type ?? 'All',
        value,
      })
    case REPORT_FILTER_FIELD_TYPES.saleReturnDocument:
      return searchSaleReturnReportDocuments({ from, limit: LOOKUP_SEARCH_LIMIT, offset: 0, to, value })
    default:
      return []
  }
}

function mergeReportEntities(entities: ReportEntity[]): ReportEntity[] {
  const seen = new Set<string>()
  const result: ReportEntity[] = []

  for (const entity of entities) {
    const key = getReportEntityKey(entity, getEntityDisplayName(entity))

    if (!seen.has(key)) {
      seen.add(key)
      result.push(entity)
    }
  }

  return result
}

function createSelectedValue(entity: ReportEntity): ReportSelectedValue {
  return {
    Data: entity,
    Name: getEntityDisplayName(entity),
    Value: getReportEntityNumericValue(entity),
  }
}

function getReportEntityKey(entity: ReportEntity, fallback = ''): string {
  return [
    entity.NetUid,
    entity.Id,
    entity.Code,
    entity.Value,
    entity.Name,
    entity.FullName,
    fallback,
  ].filter((value) => value !== undefined && value !== null && value !== '').join(':')
}

function getReportEntityNumericValue(entity: ReportEntity): number {
  if (typeof entity.Value === 'number') {
    return entity.Value
  }

  if (typeof entity.Id === 'number') {
    return entity.Id
  }

  return 0
}

function getSelectionRenderKey(selection: ReportSelection, index: number): string {
  const values = selection.Values.map((value) => getReportEntityKey(value.Data, value.Name)).join('|')

  return [
    selection.SelectedField.ParentType,
    selection.SelectedField.Name,
    selection.SelectedField.Type,
    selection.FilterCondition.Type,
    values,
    index,
  ].filter((value) => value !== undefined && value !== null && value !== '').join(':')
}

function getResultRowKey(columns: string[], row: ReportResult['table']['rows'][number], index: number): string {
  const values = columns.map((column) => displayValue(row[column])).join('|')

  return values ? `${values}:${index}` : `row-${index}`
}

function applyTemplateMeasurements(
  groups: ReportMeasurementGroup[],
  selectedMeasurements: ReportRequestBody['sorted']['Measurements'],
): ReportMeasurementGroup[] {
  const selectedTypes = new Set(selectedMeasurements.map((item) => item.Type))

  return groups.map((group) => {
    const subList = group.SubList.map((item) => ({ ...item, IsChecked: selectedTypes.has(item.Type) }))

    return {
      ...group,
      IsChecked: subList.every((item) => item.IsChecked),
      SubList: subList,
    }
  })
}
