import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  type OptionsFilter,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { CheckboxMultiSelect } from '../../../shared/ui/CheckboxMultiSelect'
import { CircleAlert, Plus, RefreshCw, RotateCcw, Save, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useMemo } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import type { TranslateFunction } from '../../../shared/i18n/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
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
  sanitizeReportTemplate,
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
  getEntityDisplayName,
  formatDate,
} from '../utils'
import './reports-pages.css'

const STORAGE_KEY = 'app_configs_reports_template'
const LOOKUP_SEARCH_DEBOUNCE_MS = 300
const LOOKUP_SEARCH_LIMIT = 30
const DATE_INPUT_DEBOUNCE_MS = 400
// A native <input type="date"> carries no bounds of its own and reports every intermediate value while the
// year is edited digit by digit («0002-07-18»), which the engine accepts and then walks for two millennia
// until the request dies of a timeout. Both ends are clamped, and the same range is re-checked here because
// min/max only style the input — they do not stop a typed value from reaching the form.
const REPORT_MIN_DATE = '2000-01-01'

// Only the sale-document lookup narrows its options by the report period; the rest ignore it.
const PERIOD_SCOPED_FILTER_FIELD_TYPES = new Set<number>([REPORT_FILTER_FIELD_TYPES.saleDocumentNumberDate])

const SALE_DOCUMENT_STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { value: 'All', label: 'Всі' },
  { value: 'New', label: 'SaleLifeCycleNew' },
  { value: 'Packaging', label: 'SaleLifeCyclePackaging' },
  { value: 'InvoiceChanged', label: 'InvoiceChanged' },
  { value: 'TransporterChanged', label: 'TransporterChanged' },
  { value: 'OrderClosed', label: 'OrderClosed' },
]

const defaultCondition = REPORT_FILTER_CONDITIONS[0]

// What the finished run was asked for, kept because the response carries none of it back.
type ReportRunOutcome = {
  colGroupings: string[]
  from: string
  hasDocument: boolean
  measures: string[]
  name: string
  rowGroupings: string[]
  to: string
}

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
  const [lastRun, setLastRun] = useValueState<ReportRunOutcome | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [templateName, setTemplateName] = useValueState('')
  const [templates, setTemplates] = useValueState<ReportTemplate[]>([])
  const [templateNotice, setTemplateNotice] = useValueState<string | null>(null)
  const groupingOptions = useMemo(() => flattenGroupingOptions(), [])
  // One dimension can hold one axis position only: repeated in «Рядки» it splits the sheet against itself, and
  // in both axes at once it asks the engine to lay the same key out horizontally and vertically. Both are two
  // clicks away, so the taken dimensions leave the picker disabled rather than merely being rejected on submit.
  const usedGroupingTypes = useMemo(
    () => new Set([...rowGroups, ...colGroups].map((item) => item.type)),
    [colGroups, rowGroups],
  )
  const groupingSelectData = useMemo(
    () =>
      groupingOptions.map((item) => ({
        disabled: usedGroupingTypes.has(item.type),
        label: `${item.group}: ${getReportFieldLabel(item.key)}`,
        value: String(item.type),
      })),
    [groupingOptions, usedGroupingTypes],
  )
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
  const maxDate = useMemo(() => `${today.slice(0, 4)}-12-31`, [today])
  const [debouncedFrom] = useDebouncedValue(from, DATE_INPUT_DEBOUNCE_MS)
  const [debouncedTo] = useDebouncedValue(to, DATE_INPUT_DEBOUNCE_MS)
  const periodError = getPeriodError(from, to, maxDate, t)
  // The value lookups re-query on every keystroke in the date fields, half-typed years included. They follow the
  // period on a pause, and only once it is a period the server can answer for.
  const hasLookupPeriod = !getPeriodError(debouncedFrom, debouncedTo, maxDate, t)
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
  // The report engine lays the sheet out from the row groupings; without one it fails deep
  // inside the spreadsheet writer («Column out of range»), so the form has to require it.
  const missingRowGrouping = rowGroups.length === 0
  // A row whose field is chosen but whose value list is still empty is not «no filter»: the engine compares the
  // column against nothing, so «Дорівнює» empties the report and «Не дорівнює» drops the filter altogether. The
  // sheet that comes back looks plausible either way, so the row has to be finished before the request goes out.
  const incompleteSelectionIndex = selections.findIndex(isIncompleteSelection)
  const incompleteSelectionMessage =
    incompleteSelectionIndex < 0
      ? ''
      : t('Умова відбору {position} ({field}): додайте значення або зніміть галочку', {
          field: getReportFieldLabel(selections[incompleteSelectionIndex].SelectedField.Name),
          position: incompleteSelectionIndex + 1,
        })
  const canSubmit = !periodError && !incompleteSelectionMessage && checkedMeasurements > 0 && !missingRowGrouping
  const submitBlockedReason = periodError
    ? periodError
    : checkedMeasurements === 0
      ? t('Виберіть хоча б один показник')
      : missingRowGrouping
        ? t('Додайте хоча б одне групування рядків')
        : incompleteSelectionMessage
  const emptyRunNotice =
    lastRun && !lastRun.hasDocument
      ? t('За період {from} – {to} сервер не повернув файл звіту. Спробуйте інший період або послабте умови відбору.', {
          from: formatDate(lastRun.from),
          to: formatDate(lastRun.to),
        })
      : null
  const resultPlaceholder = describeResultPlaceholder(lastRun, Boolean(error), t)

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
    setLastRun(null)

    try {
      const nextResult = await createStockReport(reportBody)
      const outcome: ReportRunOutcome = {
        colGroupings: colGroups.map((group) => getReportFieldLabel(group.key)),
        from,
        hasDocument: Boolean(nextResult.document.DocumentURL || nextResult.document.PdfDocumentURL),
        measures: reportBody.sorted.Measurements.map((measurement) => getReportFieldLabel(measurement.Name)),
        name: templateName.trim(),
        rowGroupings: rowGroups.map((group) => getReportFieldLabel(group.key)),
        to,
      }

      setResult(nextResult)
      setLastRun(outcome)

      if (outcome.hasDocument) {
        setDownloadModalOpened(true)
      }
    } catch (submitError) {
      setResult(null)
      setError(describeReportError(submitError, t))
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
    setLastRun(null)
    setError(null)
    setTemplateNotice(null)
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
    // A template stored before an option was withdrawn would otherwise put a grouping the server projects as NULL
    // (or a condition it drops) straight back into the request.
    const { data, removedCount } = sanitizeReportTemplate(template.Data)
    // A saved template can still carry the same dimension twice — the axes only started refusing duplicates now,
    // and remapping a withdrawn grouping onto its equivalent can land on one the other axis already holds.
    const templateRowGroups = dedupeGroupings(data.sorted.Row)
    const templateColGroups = dedupeGroupings(data.sorted.Col, templateRowGroups)

    setTemplateName(template.Name)
    setFrom(data.from || today)
    setTo(data.to || today)
    setRowGroups(templateRowGroups)
    setColGroups(templateColGroups)
    setSelections(data.selections.length ? data.selections : [createEmptySelection()])
    setMeasurements(applyTemplateMeasurements(createDefaultMeasurementGroups(), data.sorted.Measurements))
    setTemplateNotice(
      removedCount
        ? t('З шаблону прибрано налаштування, які звіт більше не підтримує: {count}', { count: removedCount })
        : null,
    )
  }

  return (
    <Stack className="reports-stocks-page" gap={6}>
      <Card className="app-data-card reports-stocks-shell" withBorder radius="md" padding={0}>
        <form className="reports-stocks-form" onSubmit={submitReport}>
          <div className="app-filter-bar reports-stocks-filter-bar">
            <div className="app-filter-date-range">
              <TextInput
                label={t('Від')}
                max={to || maxDate}
                min={REPORT_MIN_DATE}
                type="date"
                value={from}
                onChange={(event) => setFrom(event.currentTarget.value)}
              />
              <TextInput
                label={t('До')}
                max={maxDate}
                min={from || REPORT_MIN_DATE}
                type="date"
                value={to}
                onChange={(event) => setTo(event.currentTarget.value)}
              />
            </div>
            <Stack className="reports-stocks-title" gap={0}>
              <Text className="app-section-title" component="h1" fw={600} size="sm">
                {t('Конструктор звітів')}
              </Text>
              <Text c="dimmed" size="xs">
                {t('Продажі за період у розрізі обраних групувань')}
              </Text>
            </Stack>
            <Badge
              className={`app-role-pill reports-stocks-status ${isLoading ? 'is-orange' : 'is-gray'}`}
              variant="light"
            >
              {isLoading ? t('Формується') : `${t('Показників')}: ${checkedMeasurements}`}
            </Badge>
            {/* «Друк» is gone: the console has no print stylesheet, so window.print() put the builder form on
                paper rather than the report. The sheet itself is the printable artefact — «Файли» hands over the
                engine's PDF, and CSV covers the preview. */}
            <div className="app-filter-actions reports-stocks-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} variant="default" size={34} type="button" onClick={resetReport}>
                  <RotateCcw size={17} />
                </ActionIcon>
              </Tooltip>
            </div>
            <Tooltip label={t('Сформувати')}>
              <Button
                color={CREATE_ACTION_COLOR}
                loading={isLoading}
                disabled={!canSubmit}
                title={submitBlockedReason}
                type="submit"
              >
                {t('Сформувати')}
              </Button>
            </Tooltip>
          </div>

          <div className="reports-stocks-body">
            <Stack className="reports-stocks-content" gap={6}>
              {periodError || incompleteSelectionMessage ? (
                <Alert color={periodError ? 'red' : 'yellow'} icon={<CircleAlert size={18} />}>
                  {periodError || incompleteSelectionMessage}
                </Alert>
              ) : null}

              <div className="reports-stocks-builder-grid">
                <Card className="app-section-card reports-stocks-measurements" withBorder radius="md" padding="md">
                  <Group className="reports-stocks-section-header" justify="space-between" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap">
                      <Text className="app-section-title" component="h2" fw={600}>
                        {t('Показники')}
                      </Text>
                      <Badge className="app-role-pill is-orange" variant="light">
                        {checkedMeasurements}
                      </Badge>
                    </Group>
                    <Group gap={6} wrap="nowrap">
                      <Button
                        color={CREATE_ACTION_COLOR}
                        size="compact-xs"
                        type="button"
                        variant="outline"
                        onClick={() => setAllMeasurements(setMeasurements, true)}
                      >
                        {t('Усі')}
                      </Button>
                      <Button
                        color="gray"
                        size="compact-xs"
                        type="button"
                        variant="subtle"
                        onClick={() => setAllMeasurements(setMeasurements, false)}
                      >
                        {t('Очистити')}
                      </Button>
                    </Group>
                  </Group>

                  <div className="reports-stocks-measurement-groups">
                    {measurements.map((group, groupIndex) => {
                      const groupLabel = getReportFieldLabel(group.Name)
                      const hasDistinctChildren =
                        group.SubList.length > 1
                        || getReportFieldLabel(group.SubList[0]?.Name ?? '') !== groupLabel

                      return (
                        <div className="reports-stocks-measurement-group" key={group.Name}>
                          <Checkbox
                            checked={group.IsChecked}
                            className="reports-stocks-measurement-group__toggle"
                            label={groupLabel}
                            onChange={() => toggleMeasurementGroup(measurements, groupIndex, setMeasurements)}
                          />
                          {hasDistinctChildren ? (
                            <div className="reports-stocks-measurement-items">
                              {group.SubList.map((item, itemIndex) => (
                                <Checkbox
                                  key={item.Name}
                                  checked={item.IsChecked}
                                  label={getReportFieldLabel(item.Name)}
                                  size="sm"
                                  onChange={() => toggleMeasurementItem(measurements, groupIndex, itemIndex, setMeasurements)}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </Card>

                <Stack className="reports-stocks-configuration" gap={6}>
                  <SimpleGrid className="reports-stocks-grouping-grid" cols={{ base: 1, sm: 2 }} spacing={6}>
                    <GroupingEditor
                      title={t('Рядки')}
                      groups={rowGroups}
                      options={groupingSelectData}
                      onAdd={(item) => setRowGroups((current) => addGrouping(current, item, colGroups))}
                      onRemove={(index) => setRowGroups((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      resolveItem={(value) => groupingOptions.find((item) => String(item.type) === value)}
                    />

                    <GroupingEditor
                      title={t('Колонки')}
                      groups={colGroups}
                      options={groupingSelectData}
                      onAdd={(item) => setColGroups((current) => addGrouping(current, item, rowGroups))}
                      onRemove={(index) => setColGroups((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      resolveItem={(value) => groupingOptions.find((item) => String(item.type) === value)}
                    />
                  </SimpleGrid>

                  <Card className="app-section-card reports-stocks-selection-card" withBorder radius="md" padding="md">
                    <Group className="reports-stocks-section-header" justify="space-between" wrap="nowrap">
                      <Group gap="xs" wrap="nowrap">
                        <Text className="app-section-title" component="h2" fw={600}>
                          {t('Умови відбору')}
                        </Text>
                        <Badge className="app-role-pill is-gray" variant="light">
                          {selections.length}
                        </Badge>
                      </Group>
                      <Button
                        color={CREATE_ACTION_COLOR}
                        leftSection={<Plus size={15} />}
                        size="compact-xs"
                        type="button"
                onClick={() => setSelections((current) => [...current, createEmptySelection()])}
                      >
                        {t('Додати')}
                      </Button>
                    </Group>

                    <div className="reports-stocks-selection-list">
                      {selections.map((selection, index) => (
                        <div className="reports-stocks-selection-row" key={getSelectionRenderKey(selection, index)}>
                          <Checkbox
                            aria-label={`${t('Умова відбору')} ${index + 1}`}
                            checked={selection.IsChecked}
                            onChange={() => updateSelection(selections, index, setSelections, { IsChecked: !selection.IsChecked })}
                          />
                          <Select
                            data={filterFieldOptions}
                            label={t('Поле')}
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
                            label={t('Умова')}
                            value={String(selection.FilterCondition.Type)}
                            w={180}
                            onChange={(value) => {
                              const condition = REPORT_FILTER_CONDITIONS.find((item) => String(item.Type) === value) || defaultCondition
                              const nextValues =
                                !isMultiValueReportCondition(condition.Type) && selection.Values.length > 1
                                  ? selection.Values.slice(0, 1)
                                  : selection.Values
                              updateSelection(selections, index, setSelections, { FilterCondition: condition, Values: nextValues })
                            }}
                          />
                          <SelectionValuePicker
                            error={isIncompleteSelection(selection) ? t('Додайте значення') : undefined}
                            from={hasLookupPeriod ? debouncedFrom : ''}
                            label={t('Значення')}
                            selection={selection}
                            selections={selections}
                            to={hasLookupPeriod ? debouncedTo : ''}
                            onChange={(values) => updateSelection(selections, index, setSelections, { Values: values })}
                          />
                          <Tooltip label={t('Видалити')}>
                            <ActionIcon
                              aria-label={t('Видалити')}
                              color="red"
                              size={34}
                              type="button"
                              variant="subtle"
                              onClick={() => setSelections((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                            >
                              <Trash2 size={17} />
                            </ActionIcon>
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="app-section-card reports-stocks-template-card" withBorder radius="md" padding="md">
                    <Text className="app-section-title" component="h2" fw={600}>
                      {t('Шаблони')}
                    </Text>
                    <Group align="end" className="reports-stocks-template-form" gap={10} wrap="nowrap">
                      <TextInput
                        label={t('Назва шаблону')}
                        placeholder={t('Наприклад, щоденні залишки')}
                        value={templateName}
                        onChange={(event) => setTemplateName(event.currentTarget.value)}
                      />
                      <Button color={CREATE_ACTION_COLOR} type="button" variant="outline" onClick={saveTemplate}>
                        {t('Зберегти')}
                      </Button>
                      <Button
                        color="gray"
                        leftSection={<RefreshCw size={16} />}
                        type="button"
                        variant="subtle"
                        onClick={loadTemplates}
                      >
                        {t('Оновити список')}
                      </Button>
                    </Group>
                    {templateNotice ? (
                      <Alert color="yellow" icon={<CircleAlert size={18} />}>{templateNotice}</Alert>
                    ) : null}
                    {templates.length ? (
                      <div className="reports-stocks-template-list">
                        {templates.map((template) => (
                          <Group className="reports-stocks-template-item" key={template.Name} gap={6} wrap="nowrap">
                            <Button
                              className="reports-stocks-template-open"
                              leftSection={<RotateCcw size={15} />}
                              size="compact-sm"
                              type="button"
                              variant="default"
                              onClick={() => applyTemplate(template)}
                            >
                              {template.Name} · {formatDate(template.Data.from)}–{formatDate(template.Data.to)}
                            </Button>
                            <Tooltip label={t('Оновити')}>
                              <ActionIcon
                                aria-label={t('Оновити')}
                                color={CREATE_ACTION_COLOR}
                                size={28}
                                type="button"
                                variant="subtle"
                                onClick={() => updateTemplate(template.Name)}
                              >
                                <Save size={15} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label={t('Видалити')}>
                              <ActionIcon
                                aria-label={t('Видалити')}
                                color="red"
                                size={28}
                                type="button"
                                variant="subtle"
                                onClick={() => deleteTemplate(template.Name)}
                              >
                                <Trash2 size={15} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        ))}
                      </div>
                    ) : null}
                  </Card>
                </Stack>
              </div>
            </Stack>

            {error ? <Alert className="reports-page-alert" color="red" icon={<CircleAlert size={18} />}>{error}</Alert> : null}

            {emptyRunNotice ? (
              <Alert className="reports-page-alert" color="yellow" icon={<CircleAlert size={18} />}>{emptyRunNotice}</Alert>
            ) : null}

            <section className="app-section-card reports-stocks-result">
              <Group className="reports-stocks-result-header" justify="space-between" wrap="nowrap">
                <Box>
                  <Text className="app-section-title" component="h2" fw={600}>
                    {t('Результат')}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {lastRun
                      ? `${formatDate(lastRun.from)} – ${formatDate(lastRun.to)} · ${t('Показників')}: ${lastRun.measures.length}`
                      : t('Тут з’явиться посилання на сформований файл звіту')}
                  </Text>
                </Box>
                <Group className="reports-stocks-result-actions" gap={6} wrap="nowrap">
                  <Button
                    color={CREATE_ACTION_COLOR}
                    disabled={!result?.document.DocumentURL && !result?.document.PdfDocumentURL}
                    leftSection={<ExcelIcon size={15} />}
                    size="compact-sm"
                    type="button"
                    variant="outline"
                    onClick={() => setDownloadModalOpened(true)}
                  >
                    {t('Файли')}
                  </Button>
                </Group>
              </Group>

              {/* «/report/get/all/filtered» answers with DocumentURL/PdfDocumentURL and nothing else, so this
                  screen has no rows to draw. The table that used to stand here could never render; the report
                  itself is read from the file, in «Перегляд звіту з файла». */}
              <div className="reports-stocks-empty-state" role="status">
                <Box>
                  <Text className="reports-stocks-empty-title" fw={600}>
                    {resultPlaceholder.title}
                  </Text>
                  <Text c="dimmed" size="sm">
                    {resultPlaceholder.description}
                  </Text>
                </Box>
              </div>
            </section>
          </div>
        </form>
      </Card>

      <DocumentExportModal
        document={result?.document}
        notice={
          lastRun ? (
            <Text c="dimmed" size="xs">
              {describeReportRun(lastRun, t)}
            </Text>
          ) : null
        }
        opened={downloadModalOpened}
        title={lastRun?.name || t('Звіт продажів')}
        onClose={() => setDownloadModalOpened(false)}
      />
    </Stack>
  )
}

type SelectionValuePickerProps = {
  error?: string
  from: string
  label?: string
  selection: ReportSelection
  selections: ReportSelection[]
  to: string
  onChange: (values: ReportSelectedValue[]) => void
}

function SelectionValuePicker({ error, from, label, selection, selections, to, onChange }: SelectionValuePickerProps) {
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
  const needsPeriod = PERIOD_SCOPED_FILTER_FIELD_TYPES.has(selection.SelectedField.Type)
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

    if (needsPeriod && (!from || !to)) {
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
    needsPeriod,
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
            error={error}
            label={label}
            placeholder={t('Значення')}
            value={manualValue}
            onChange={(event) => setManualValue(event.currentTarget.value)}
          />
          <Button color={CREATE_ACTION_COLOR} size="sm" type="button" onClick={addManualValue}>
            {t('Додати')}
          </Button>
        </Group>
      ) : (
        <Select
          clearable
          searchable
          data={selectOptions}
          error={error}
          filter={lookupMode === 'search' ? keepServerLookupResults : undefined}
          label={label}
          nothingFoundMessage={
            needsPeriod && (!from || !to)
              ? t('Спочатку вкажіть коректний період')
              : lookupMode === 'search' && normalizedSearch.length < minSearchLength
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
              className="app-role-pill is-gray reports-stocks-selected-value"
              key={`${getReportEntityKey(value.Data, value.Name)}-${valueIndex}`}
              radius="sm"
              rightSection={(
                <ActionIcon
                  aria-label={t('Видалити')}
                  color="gray"
                  size="xs"
                  type="button"
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
  options: Array<{ disabled?: boolean; label: string; value: string }>
  title: string
  onAdd: (item: ReportGroupingItem) => void
  onRemove: (index: number) => void
  resolveItem: (value: string) => ReportGroupingItem | undefined
}

function GroupingEditor({ groups, options, title, onAdd, onRemove, resolveItem }: GroupingEditorProps) {
  const { t } = useI18n()

  return (
    <Card className="app-section-card reports-stocks-grouping-card" withBorder radius="md" padding="md">
      <Stack gap={10}>
        <Group className="reports-stocks-section-header" justify="space-between" wrap="nowrap">
          <Text className="app-section-title" component="h2" fw={600}>
            {title}
          </Text>
          <Badge className="app-role-pill is-gray" variant="light">
            {groups.length}
          </Badge>
        </Group>
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
        <div className="reports-stocks-group-list">
          {groups.map((group, index) => (
            <div className="reports-stocks-group-item" key={`${group.type}-${index}`}>
              <Text size="sm">{getReportFieldLabel(group.key)}</Text>
              <ActionIcon
                aria-label={t('Видалити')}
                color="red"
                size={28}
                type="button"
                variant="subtle"
                onClick={() => onRemove(index)}
              >
                <Trash2 size={15} />
              </ActionIcon>
            </div>
          ))}
          {!groups.length ? (
            <Text className="reports-stocks-group-empty" size="xs" c="dimmed">
              {t('Групування не додано')}
            </Text>
          ) : null}
        </div>
      </Stack>
    </Card>
  )
}

function getPeriodError(from: string, to: string, maxDate: string, t: TranslateFunction): string | null {
  if (!from || !to) {
    return t('Оберіть період')
  }

  if (!isSupportedReportDate(from, maxDate) || !isSupportedReportDate(to, maxDate)) {
    return t('Дата має бути в межах {min} – {max}', { max: formatDate(maxDate), min: formatDate(REPORT_MIN_DATE) })
  }

  if (from > to) {
    return t('Дата початку не може бути пізніше дати завершення')
  }

  return null
}

function isSupportedReportDate(value: string, maxDate: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= REPORT_MIN_DATE && value <= maxDate
}

function isIncompleteSelection(selection: ReportSelection): boolean {
  return selection.IsChecked && Boolean(selection.SelectedField.Name) && selection.Values.length === 0
}

function addGrouping(
  current: ReportGroupingItem[],
  item: ReportGroupingItem,
  otherAxis: ReportGroupingItem[],
): ReportGroupingItem[] {
  const isTaken = [...current, ...otherAxis].some((group) => group.type === item.type)

  return isTaken ? current : [...current, item]
}

function dedupeGroupings(items: ReportGroupingItem[], taken: ReportGroupingItem[] = []): ReportGroupingItem[] {
  const seenTypes = new Set(taken.map((item) => item.type))
  const result: ReportGroupingItem[] = []

  for (const item of items) {
    if (!seenTypes.has(item.type)) {
      seenTypes.add(item.type)
      result.push(item)
    }
  }

  return result
}

// The analytics controller answers every failure — a period the engine cannot represent included — with HTTP 400
// and the raw .NET exception text in the envelope Message. That text is English, tells the user nothing they can
// act on, and is not ours to show, so nothing but the status is read here.
function describeReportError(error: unknown, t: TranslateFunction): string {
  if (error instanceof ApiError) {
    // Status 0 is the client's own network/timeout message, already translated.
    if (error.status === 0) {
      return error.message
    }

    if (error.status === 401 || error.status === 403) {
      return t('Сесію завершено. Увійдіть повторно.')
    }

    if (error.status >= 500) {
      return t('Сервер звітів недоступний. Спробуйте ще раз пізніше.')
    }

    return t('Сервер не зміг сформувати звіт із такими параметрами. Спробуйте вужчий період або менше групувань.')
  }

  return t('Не вдалося сформувати звіт')
}

// Names the run for the export modal, where the only other identity on offer is the engine's «Reports_MM.yyyy_
// <guid>.xlsx» file name.
function describeReportRun(run: ReportRunOutcome, t: TranslateFunction): string {
  const parts = [`${formatDate(run.from)} – ${formatDate(run.to)}`]

  if (run.rowGroupings.length) {
    parts.push(`${t('Рядки')}: ${run.rowGroupings.join(', ')}`)
  }

  if (run.colGroupings.length) {
    parts.push(`${t('Колонки')}: ${run.colGroupings.join(', ')}`)
  }

  if (run.measures.length) {
    parts.push(`${t('Показники')}: ${run.measures.join(', ')}`)
  }

  return parts.join(' · ')
}

function describeResultPlaceholder(
  lastRun: ReportRunOutcome | null,
  hasError: boolean,
  t: TranslateFunction,
): { description: string; title: string } {
  if (hasError) {
    return {
      description: t('Причина — у повідомленні вище. Змініть параметри та сформуйте звіт ще раз.'),
      title: t('Звіт не сформовано'),
    }
  }

  if (!lastRun) {
    return {
      description: t('Оберіть показники, додайте групування рядків і сформуйте звіт.'),
      title: t('Результат ще не сформовано'),
    }
  }

  const period = `${formatDate(lastRun.from)} – ${formatDate(lastRun.to)}`
  const measures = lastRun.measures.join(', ')

  if (!lastRun.hasDocument) {
    return {
      description: t('Період {period}. Показники: {measures}. Спробуйте інший період або послабте умови відбору.', {
        measures,
        period,
      }),
      title: t('Файл звіту не сформовано'),
    }
  }

  // The file itself records neither the period nor the measures it was built from, so the screen keeps them.
  // Whether the period actually held any data is visible only inside the sheet: «/report/get/all/filtered» hands
  // back the two file links and nothing else, and the writer closes even a data-less sheet with «Загальний
  // підсумок», so the screen must not claim either way — it says where the answer is instead.
  return {
    description: t('Період {period}. Показники: {measures}. Дані — у файлі: сервер не повертає рядки для перегляду.', {
      measures,
      period,
    }),
    title: t('Звіт сформовано у файл'),
  }
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

// The searched lookups match on fields the option label never shows — a user's по батькові, e-mail or phone
// number, a client's ЄДРПОУ or code of region — and Mantine's default filter then drops those very rows because
// the typed text is not in the label, so a hit the server just found reads as «Нічого не знайдено». Everything
// the server returned is already the answer to the query; show it unfiltered. The static lists keep the default
// filter — there the whole catalogue is in the browser and the filtering is the search.
const keepServerLookupResults: OptionsFilter = ({ options }) => options

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
    case REPORT_FILTER_FIELD_TYPES.saleDocumentNumberDate:
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
