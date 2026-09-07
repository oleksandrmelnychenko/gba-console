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
  Modal,
  type OptionsFilter,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { CheckboxMultiSelect } from '../../../shared/ui/CheckboxMultiSelect'
import { CircleAlert, LayoutTemplate, Plus, RefreshCw, RotateCcw, Save, Trash2 } from 'lucide-react'
import { IconFileSpreadsheet } from '@tabler/icons-react'
import { TableRowAction } from '../../../shared/ui/table-row-action/TableRowAction'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import type { TranslateFunction } from '../../../shared/i18n/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useAuth } from '../../auth/useAuth'
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
  searchDatasetReportValues,
  searchReportProducts,
  searchReportUsers,
  searchSaleReturnReportDocuments,
  searchSalesReportDocuments,
} from '../api/reportsApi'
import {
  REPORT_FILTER_CONDITIONS,
  isMultiValueReportCondition,
  REPORT_FILTER_FIELD_TYPES,
  createDefaultMeasurementGroups,
  flattenCheckedMeasurements,
  getReportFieldLabel,
} from '../data/reportOptions'
import type {
  ReportDataset,
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
import { datasetConfigurationError, datasetFilters, datasetGroupings, datasetMeasurements, datasetPresetRequest, datasetPresets, defaultDatasetRequest, type DatasetReportPresetId } from '../data/reportDatasets'
import { useReportDatasets } from '../hooks/useReportDatasets'
import { isCurrentReportSource, usesNativeReportLookup } from '../data/nativeReportProfiles'
import { VALUATION_DATA_SOURCE } from '../data/reportValuation'
import { useValuationAgreement } from '../hooks/useValuationAgreement'
import { ValuationAgreementPicker } from './ValuationAgreementPicker'
import { ReportDatasetPicker } from './ReportDatasetPicker'
import { ReportQuickPresets } from './ReportQuickPresets'
import { ReportGroupingPanel } from './ReportGroupingPanel'
import { reorderReportGrouping, transferReportGrouping, type ReportGroupingAxis } from '../data/reportGroupingLayout'

import { useServerReportTemplates } from '../hooks/useServerReportTemplates'

import { ReportCatalogueControl } from './ReportCatalogueControl'
const LOOKUP_SEARCH_DEBOUNCE_MS = 300
const LOOKUP_SEARCH_LIMIT = 30
const DATE_INPUT_DEBOUNCE_MS = 400
// A native <input type="date"> carries no bounds of its own and reports every intermediate value while the
// year is edited digit by digit («0002-07-18»), which the engine accepts and then walks for two millennia
// until the request dies of a timeout. Both ends are clamped, and the same range is re-checked here because
// min/max only style the input — they do not stop a typed value from reaching the form.
const REPORT_MIN_DATE = '2000-01-01'

// Only the sale-document lookup narrows its options by the report period; the rest ignore it.
//
// «Повернення від клієнта» deliberately does NOT: the report attributes a sale line of the period to the document
// that returned it, and that document is dated whenever the return happened. Measured on the dev database, the
// four return documents the 5–6 June sale lines are attributed to are dated 2025-05-08, 2025-07-01, 2026-03-26
// and 2026-04-06 — every one of them outside the report's own window. A picker scoped to the period would offer
// none of the documents the report can actually show.
const PERIOD_SCOPED_FILTER_FIELD_TYPES = new Set<number>([REPORT_FILTER_FIELD_TYPES.saleDocument, REPORT_FILTER_FIELD_TYPES.saleDocumentNumberDate])

// The whole return-document catalogue, which is what «Повернення від клієнта» is picked from. The list endpoint
// takes a period and nothing else, so it is asked for the widest period the report form itself allows.
const RETURN_DOCUMENT_CATALOGUE_PAGE_SIZE = 500
const RETURN_DOCUMENT_CATALOGUE_MAX_ITEMS = 200_000

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
  periodSupported: boolean
  colGroupings: string[]
  from: string
  hasDocument: boolean
  measures: string[]
  name: string
  rowGroupings: string[]
  to: string
}

type StateSetter<T> = (value: T | ((current: T) => T)) => void

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
  const { user, session } = useAuth()
  return <ReportsStocksWorkspace key={user?.NetUid ?? session?.userNetUid ?? 'anonymous'} />
}

function ReportsStocksWorkspace() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const canGenerateReport = hasPermission(
    PermissionKeys.ReportsStocks.Report.Generate,
  )
  const today = useMemo(() => formatKyivBusinessDate(), [])
  const [from, setFrom] = useValueState(today)
  const [to, setTo] = useValueState(today)
  const previousPeriod = useRef({ from: today, to: today })
  const datasetStorage = useReportDatasets(canGenerateReport)
  const [dataSource, setDataSource] = useValueState(0)
  const [valuationClientAgreementId, setValuationAgreementId] = useValueState<number | undefined>(undefined)
  const valuation = useValuationAgreement(valuationClientAgreementId, canGenerateReport && dataSource === VALUATION_DATA_SOURCE)
  const dataset = datasetStorage.datasets.find(item => item.DataSource === dataSource)
  const periodSupported = dataset?.PeriodSupported !== false
  const [selectedMeasurements, setMeasurements] = useValueState<ReportMeasurementGroup[]>(createDefaultMeasurementGroups)
  const measurements = useMemo(() => datasetMeasurements(dataset, flattenCheckedMeasurements(selectedMeasurements)), [dataset, selectedMeasurements])
  const presets = useMemo(() => datasetPresets(dataset), [dataset])
  const [rowGroups, setRowGroups] = useValueState<ReportGroupingItem[]>([])
  const [colGroups, setColGroups] = useValueState<ReportGroupingItem[]>([])
  const [selections, setSelections] = useValueState<ReportSelection[]>([])
  const [result, setResult] = useValueState<ReportResult | null>(null)
  const [lastRun, setLastRun] = useValueState<ReportRunOutcome | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [templateName, setTemplateName] = useValueState('')
  const templateStorage = useServerReportTemplates(canGenerateReport)
  const templates = templateStorage.templates
  const [templateNotice, setTemplateNotice] = useValueState<string | null>(null)
  const groupingOptions = useMemo(() => datasetGroupings(dataset), [dataset])
  const groupingSelectData = useMemo(
    () =>
      groupingOptions.map((item) => ({
        assignedTo: [
          ...(rowGroups.some((group) => group.type === item.type) ? ['rows' as const] : []),
          ...(colGroups.some((group) => group.type === item.type) ? ['columns' as const] : []),
        ],
        label: item.label,
        value: String(item.type),
      }) satisfies GroupingOption),
    [colGroups, groupingOptions, rowGroups],
  )
  const filterFieldOptions = useMemo(() => datasetFilters(dataset), [dataset])
  const maxDate = useMemo(() => `${today.slice(0, 4)}-12-31`, [today])
  const [debouncedFrom] = useDebouncedValue(from, DATE_INPUT_DEBOUNCE_MS)
  const [debouncedTo] = useDebouncedValue(to, DATE_INPUT_DEBOUNCE_MS)
  const periodError = periodSupported ? getPeriodError(from, to, maxDate, t) : null
  // The value lookups re-query on every keystroke in the date fields, half-typed years included. They follow the
  // period on a pause, and only once it is a period the server can answer for.
  const hasLookupPeriod = !getPeriodError(debouncedFrom, debouncedTo, maxDate, t)
  const reportBody = useMemo<ReportRequestBody>(
    () => ({
      dataSource,
      ...(valuationClientAgreementId !== undefined ? { valuationClientAgreementId } : {}),
      from,
      to,
      sorted: {
        Col: colGroups,
        Row: rowGroups,
        Measurements: flattenCheckedMeasurements(measurements),
      },
      selections: selections.filter((selection) => selection.IsChecked && selection.SelectedField.Name),
    }),
    [colGroups, dataSource, from, measurements, rowGroups, selections, to, valuationClientAgreementId],
  )
  const templateBody = { ...reportBody, selections }
  const configurationError = datasetStorage.error ?? (!datasetStorage.loaded ? t('Завантаження наборів даних…') : datasetConfigurationError(templateBody, dataset))
    ?? (dataSource === VALUATION_DATA_SOURCE && valuation.agreement?.Id !== valuationClientAgreementId ? 'Підтвердіть доступний договір оцінки.' : null)
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
  const reportIsReady = !configurationError && !periodError && !incompleteSelectionMessage && checkedMeasurements > 0 && !missingRowGrouping
  const canSubmit = canGenerateReport && reportIsReady
  const submitBlockedReason = !canGenerateReport
    ? t('Немає права формувати звіт залишків')
    : configurationError
      ? configurationError
      : periodError
      ? periodError
      : checkedMeasurements === 0
        ? t('Виберіть хоча б один показник')
        : missingRowGrouping
          ? t('Додайте хоча б одне групування рядків')
          : incompleteSelectionMessage
  const emptyRunNotice =
    lastRun && !lastRun.hasDocument
      ? !lastRun.periodSupported ? t(dataSource === 11 ? 'Сервер не повернув файл записаних залишків рахунків. Спробуйте послабити умови відбору.' : dataSource === 10 ? 'Сервер не повернув файл поточної заборгованості. Спробуйте послабити умови відбору.' : 'Сервер не повернув файл поточних залишків. Спробуйте послабити умови відбору.')
      : t('За період {from} – {to} сервер не повернув файл звіту. Спробуйте інший період або послабте умови відбору.', {
          from: formatDate(lastRun.from),
          to: formatDate(lastRun.to),
        })
      : null
  const resultPlaceholder = describeResultPlaceholder(lastRun, Boolean(error), t)


  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canGenerateReport || !reportIsReady) {
      return
    }

    setLoading(true)
    setError(null)
    setLastRun(null)

    try {
      const nextResult = await createStockReport(reportBody)
      const outcome: ReportRunOutcome = {
        periodSupported,
        colGroupings: colGroups.map((group) => group.label || getReportFieldLabel(group.key)),
        from,
        hasDocument: Boolean(nextResult.document.DocumentURL || nextResult.document.PdfDocumentURL),
        measures: reportBody.sorted.Measurements.map((measurement) => measurement.Label || getReportFieldLabel(measurement.Name)),
        name: templateName.trim(),
        rowGroupings: rowGroups.map((group) => group.label || getReportFieldLabel(group.key)),
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
    const snapshotDefaults = dataset && !periodSupported ? defaultDatasetRequest(dataset, '', '') : null
    setFrom(periodSupported ? today : '')
    setTo(periodSupported ? today : '')
    setMeasurements(snapshotDefaults ? datasetMeasurements(dataset, snapshotDefaults.sorted.Measurements) : createDefaultMeasurementGroups())
    setRowGroups(snapshotDefaults?.sorted.Row ?? [])
    setColGroups([])
    setSelections([])
    setValuationAgreementId(undefined)
    setResult(null)
    setLastRun(null)
    setError(null)
    setTemplateNotice(null)
  }

  function saveTemplate() {
    setTemplateNotice(null)
    if (!configurationError) void templateStorage.save(templateName, templateBody)
  }

  function loadTemplates() {
    setTemplateNotice(null)
    templateStorage.reload()
  }

  function updateTemplate(id: string) {
    setTemplateNotice(null)
    if (!configurationError) void templateStorage.save(templateName, templateBody, id)
  }

  function deleteTemplate(id: string) {
    setTemplateNotice(null)
    void templateStorage.remove(id)
  }

  function applyTemplate(template: ReportTemplate): boolean {
    const nextDataset = datasetStorage.datasets.find(item => item.DataSource === (template.Data.dataSource ?? 0))
    const incompatible = datasetConfigurationError(template.Data, nextDataset)
    if (incompatible || !nextDataset) {
      setTemplateNotice(incompatible)
      return false
    }
    applyConfiguration(template, nextDataset)
    return true
  }

  function applyConfiguration(template: ReportTemplate, nextDataset: ReportDataset) {
    const data = template.Data
    const nextAgreementId = data.valuationClientAgreementId ?? undefined
    setValuationAgreementId(nextAgreementId)
    const groupingByType = new Map(datasetGroupings(nextDataset).map(item => [item.type, item]))
    if (periodSupported && !getPeriodError(from, to, maxDate, t)) previousPeriod.current = { from, to }
    setDataSource(nextDataset.DataSource)
    setTemplateName(template.Name)
    setFrom(nextDataset.PeriodSupported === false ? '' : data.from || today)
    setTo(nextDataset.PeriodSupported === false ? '' : data.to || today)
    setRowGroups(data.sorted.Row.map(item => groupingByType.get(item.type)!))
    setColGroups(data.sorted.Col.map(item => groupingByType.get(item.type)!))
    setSelections(structuredClone(data.selections))
    setMeasurements(datasetMeasurements(nextDataset, data.sorted.Measurements))
    setTemplateNotice(null)
    setResult(null)
    setLastRun(null)
    setError(null)
  }

  function changeDataset(nextDataset: ReportDataset) {
    const period = periodSupported ? { from, to } : previousPeriod.current
    applyConfiguration({ Name: '', Data: defaultDatasetRequest(nextDataset, period.from, period.to) }, nextDataset)
  }

  function applyPreset(id: DatasetReportPresetId) {
    if (!dataset) return
    const preset = datasetPresetRequest(dataset, id, templateBody)
    if (preset) applyConfiguration(preset, dataset)
  }


  return (
    <Stack className="reports-stocks-page" gap={6}>
      <ReportCatalogueControl enabled={canGenerateReport} />
      <ReportDatasetPicker datasets={datasetStorage.datasets} selected={dataSource} disabled={!canGenerateReport || isLoading}
        loaded={datasetStorage.loaded} error={datasetStorage.error} onChange={changeDataset} onRetry={datasetStorage.retry} />
      {dataSource === VALUATION_DATA_SOURCE ? <ValuationAgreementPicker value={valuationClientAgreementId} enabled={canGenerateReport} disabled={isLoading}
        agreement={valuation.agreement} validating={valuation.loading} validationError={valuation.error}
        onChange={setValuationAgreementId} onRetry={valuation.retry} /> : null}
      <ReportBuilderForm
        dataSource={dataSource}
        periodSupported={periodSupported}
        presets={presets}
        configurationReady={!configurationError}
        onApplyPreset={applyPreset}
        canSubmit={canSubmit}
        colGroups={colGroups}
        filterFieldOptions={filterFieldOptions}
        from={from}
        groupingOptions={groupingOptions}
        groupingSelectData={groupingSelectData}
        incompleteSelectionMessage={incompleteSelectionMessage}
        isLoading={isLoading}
        lastRun={lastRun}
        lookupFrom={hasLookupPeriod ? debouncedFrom : ''}
        lookupTo={hasLookupPeriod ? debouncedTo : ''}
        maxDate={maxDate}
        measurements={measurements}
        notices={{ emptyRun: emptyRunNotice, error, period: periodError }}
        resultHasFiles={Boolean(result?.document.DocumentURL || result?.document.PdfDocumentURL)}
        resultPlaceholder={resultPlaceholder}
        rowGroups={rowGroups}
        selections={selections}
        submitBlockedReason={submitBlockedReason}
        templateName={templateName}
        templateNotice={templateNotice ?? templateStorage.notice}
        templateStorage={templateStorage}
        templates={templates}
        to={to}
        onApplyTemplate={applyTemplate}
        onDeleteTemplate={deleteTemplate}
        onFromChange={setFrom}
        onMeasurementsChange={setMeasurements}
        onOpenFiles={() => setDownloadModalOpened(true)}
        onRefreshTemplates={loadTemplates}
        onReset={resetReport}
        onRowGroupsChange={setRowGroups}
        onColGroupsChange={setColGroups}
        onSaveTemplate={saveTemplate}
        onSelectionsChange={setSelections}
        onSubmit={submitReport}
        onTemplateNameChange={setTemplateName}
        onToChange={setTo}
        onUpdateTemplate={updateTemplate}
      />

      <DocumentExportModal
        document={result?.document}
        notice={
          lastRun ? (
            <Text c="gray.9" size="xs">
              {describeReportRun(lastRun, t)}
            </Text>
          ) : null
        }
        opened={downloadModalOpened}
        title={lastRun?.name || dataset?.Name || t('Звіт')}
        onClose={() => setDownloadModalOpened(false)}
      />
    </Stack>
  )
}

type ReportBuilderFormProps = {
  dataSource: number
  periodSupported: boolean
  presets: ReturnType<typeof datasetPresets>
  configurationReady: boolean
  templateStorage: ReturnType<typeof useServerReportTemplates>
  onApplyPreset: (id: DatasetReportPresetId) => void
  canSubmit: boolean
  colGroups: ReportGroupingItem[]
  filterFieldOptions: FilterFieldOption[]
  from: string
  groupingOptions: ReportGroupingItem[]
  groupingSelectData: GroupingOption[]
  incompleteSelectionMessage: string
  isLoading: boolean
  lastRun: ReportRunOutcome | null
  lookupFrom: string
  lookupTo: string
  maxDate: string
  measurements: ReportMeasurementGroup[]
  notices: { emptyRun: string | null; error: string | null; period: string | null }
  resultHasFiles: boolean
  resultPlaceholder: { description: string; title: string }
  rowGroups: ReportGroupingItem[]
  selections: ReportSelection[]
  submitBlockedReason: string
  templateName: string
  templateNotice: string | null
  templates: ReportTemplate[]
  to: string
  onApplyTemplate: (template: ReportTemplate) => boolean
  onColGroupsChange: StateSetter<ReportGroupingItem[]>
  onDeleteTemplate: (name: string) => void
  onFromChange: StateSetter<string>
  onMeasurementsChange: StateSetter<ReportMeasurementGroup[]>
  onOpenFiles: () => void
  onRefreshTemplates: () => void
  onReset: () => void
  onRowGroupsChange: StateSetter<ReportGroupingItem[]>
  onSaveTemplate: () => void
  onSelectionsChange: StateSetter<ReportSelection[]>
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onTemplateNameChange: StateSetter<string>
  onToChange: StateSetter<string>
  onUpdateTemplate: (name: string) => void
}

function ReportBuilderForm({
  dataSource,
  periodSupported,
  presets,
  configurationReady,
  onApplyPreset,
  canSubmit,
  colGroups,
  filterFieldOptions,
  from,
  groupingOptions,
  groupingSelectData,
  incompleteSelectionMessage,
  isLoading,
  lastRun,
  lookupFrom,
  lookupTo,
  maxDate,
  measurements,
  notices,
  resultHasFiles,
  resultPlaceholder,
  rowGroups,
  selections,
  submitBlockedReason,
  templateName,
  templateNotice,
  templates,
  templateStorage,
  to,
  onApplyTemplate,
  onColGroupsChange,
  onDeleteTemplate,
  onFromChange,
  onMeasurementsChange,
  onOpenFiles,
  onRefreshTemplates,
  onReset,
  onRowGroupsChange,
  onSaveTemplate,
  onSelectionsChange,
  onSubmit,
  onTemplateNameChange,
  onToChange,
  onUpdateTemplate,
}: ReportBuilderFormProps) {
  const { t } = useI18n()
  const [templatesOpened, setTemplatesOpened] = useValueState(false)

  return (
    <Card className="reports-stocks-shell" radius="md" padding={0}>
      <form className="reports-stocks-form" onSubmit={onSubmit}>
        <div className="reports-stocks-filter-scroll">
        <div className="app-filter-bar reports-stocks-filter-bar">
          {periodSupported ? <div className="app-filter-date-range">
            <TextInput
              label={t('Від')}
              max={to || maxDate}
              min={REPORT_MIN_DATE}
              type="date"
              value={from}
              onChange={(event) => onFromChange(event.currentTarget.value)}
            />
            <TextInput
              label={t('До')}
              max={maxDate}
              min={from || REPORT_MIN_DATE}
              type="date"
              value={to}
              onChange={(event) => onToChange(event.currentTarget.value)}
            />
          </div> : <Text size="sm">{t('Поточний стан на час читання даних. Історичний період не застосовується.')}</Text>}
          <div className="app-filter-actions reports-stocks-actions">
            <Button
              color="gray"
              disabled={isLoading}
              leftSection={<LayoutTemplate size={16} />}
              type="button"
              variant="default"
              onClick={() => setTemplatesOpened(true)}
            >
              {t('Шаблони')}
            </Button>
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} disabled={isLoading} variant="default" size={34} type="button" onClick={onReset}>
                <RotateCcw size={17} />
              </ActionIcon>
            </Tooltip>
          </div>
          <Tooltip label={t('Сформувати')}>
            <Button
              className="reports-stocks-generate"
              color={CREATE_ACTION_COLOR}
              leftSection={<IconFileSpreadsheet size={16} />}
              loading={isLoading}
              disabled={!canSubmit}
              title={submitBlockedReason}
              type="submit"
            >
              {t('Сформувати')}
            </Button>
          </Tooltip>
        </div>
        </div>

        {presets.length ? <ReportQuickPresets disabled={isLoading || !configurationReady} presets={presets} onApply={onApplyPreset} /> : null}

        <div className="reports-stocks-body">
          {notices.period || incompleteSelectionMessage ? (
            <Alert className="reports-page-alert" color={notices.period ? 'red' : 'yellow'} icon={<CircleAlert size={18} />}>
              {notices.period || incompleteSelectionMessage}
            </Alert>
          ) : null}

          {notices.error ? (
            <Alert className="reports-page-alert" color="red" icon={<CircleAlert size={18} />}>{notices.error}</Alert>
          ) : null}
          {notices.emptyRun ? (
            <Alert className="reports-page-alert" color="yellow" icon={<CircleAlert size={18} />}>
              {notices.emptyRun}
            </Alert>
          ) : null}
          <LegacyReportBuilder
            dataSource={dataSource}
            colGroups={colGroups}
            filterFieldOptions={filterFieldOptions}
            groupingOptions={groupingOptions}
            groupingSelectData={groupingSelectData}
            lookupFrom={lookupFrom}
            lookupTo={lookupTo}
            measurements={measurements}
            rowGroups={rowGroups}
            selections={selections}
            onColGroupsChange={onColGroupsChange}
            onMeasurementsChange={onMeasurementsChange}
            onRowGroupsChange={onRowGroupsChange}
            onSelectionsChange={onSelectionsChange}
          />
          <ReportResultSection
            hasFiles={resultHasFiles}
            lastRun={lastRun}
            placeholder={resultPlaceholder}
            onOpenFiles={onOpenFiles}
          />
        </div>

        <Modal
          centered
          classNames={{ body: 'reports-stocks-template-modal__body', title: 'reports-stocks-modal-title' }}
          opened={templatesOpened}
          size="lg"
          title={t('Шаблони звіту')}
          onClose={() => setTemplatesOpened(false)}
        >
          <ReportTemplatesCard
            storage={templateStorage}
            configurationReady={configurationReady}
            notice={templateNotice}
            templateName={templateName}
            templates={templates}
            onApply={(template) => {
              if (onApplyTemplate(template)) setTemplatesOpened(false)
            }}
            onDelete={onDeleteTemplate}
            onNameChange={onTemplateNameChange}
            onRefresh={onRefreshTemplates}
            onSave={onSaveTemplate}
            onUpdate={onUpdateTemplate}
          />
        </Modal>
      </form>
    </Card>
  )
}

type LegacyReportBuilderProps = {
  dataSource: number
  colGroups: ReportGroupingItem[]
  filterFieldOptions: FilterFieldOption[]
  groupingOptions: ReportGroupingItem[]
  groupingSelectData: GroupingOption[]
  lookupFrom: string
  lookupTo: string
  measurements: ReportMeasurementGroup[]
  rowGroups: ReportGroupingItem[]
  selections: ReportSelection[]
  onColGroupsChange: StateSetter<ReportGroupingItem[]>
  onMeasurementsChange: StateSetter<ReportMeasurementGroup[]>
  onRowGroupsChange: StateSetter<ReportGroupingItem[]>
  onSelectionsChange: StateSetter<ReportSelection[]>
}

function LegacyReportBuilder({
  dataSource,
  colGroups,
  filterFieldOptions,
  groupingOptions,
  groupingSelectData,
  lookupFrom,
  lookupTo,
  measurements,
  rowGroups,
  selections,
  onColGroupsChange,
  onMeasurementsChange,
  onRowGroupsChange,
  onSelectionsChange,
}: LegacyReportBuilderProps) {
  const { t } = useI18n()
  const [groupingPickerTarget, setGroupingPickerTarget] = useState<'rows' | 'columns' | null>(null)
  const checkedMeasurements = flattenCheckedMeasurements(measurements).length
  const groupingLayout = { Row: rowGroups, Col: colGroups }
  const allowedGroupingTypes = new Set(groupingOptions.map(item => item.type))
  const selectedGroupingTypes = new Set([...rowGroups, ...colGroups].map(item => item.type))

  const transferGrouping = (axis: ReportGroupingAxis, type: number) => {
    const next = transferReportGrouping(groupingLayout, axis, type, allowedGroupingTypes)
    if (next === groupingLayout) return
    onRowGroupsChange(next.Row)
    onColGroupsChange(next.Col)
  }

  const closeGroupingPicker = () => setGroupingPickerTarget(null)

  const addGroupingFromPicker = (value: string) => {
    const item = groupingOptions.find((option) => String(option.type) === value)
    if (!item || !groupingPickerTarget || selectedGroupingTypes.has(item.type)) return

    if (groupingPickerTarget === 'rows') {
      onRowGroupsChange((current) => addGrouping(current, item))
    } else {
      onColGroupsChange((current) => addGrouping(current, item))
    }

    closeGroupingPicker()
  }

  return (
    <section className="reports-stocks-legacy" aria-label="Налаштування звіту">
      <div className="reports-stocks-legacy__columns">
        <section className="app-section-card reports-stocks-legacy-panel reports-stocks-legacy-measurements">
          <div className="reports-stocks-legacy-panel__header">
            <Group className="reports-stocks-legacy-panel__title" gap={6} wrap="nowrap">
              <Text className="app-section-title" component="h2" fw={600} size="sm">{t('Показники')}</Text>
              <Text className="reports-stocks-count" size="xs">{checkedMeasurements || ''}</Text>
            </Group>
            <Group gap={4} wrap="nowrap">
              <Button
                color={CREATE_ACTION_COLOR}
                size="compact-xs"
                type="button"
                variant="subtle"
                onClick={() => setAllMeasurements(onMeasurementsChange, true)}
              >
                Усі
              </Button>
              <Button
                color="gray"
                size="compact-xs"
                type="button"
                variant="subtle"
                onClick={() => setAllMeasurements(onMeasurementsChange, false)}
              >
                Очистити
              </Button>
            </Group>
          </div>

          <div className="reports-stocks-legacy-measurements__list">
            <div className="reports-stocks-measurement-columns" aria-hidden="true">
              <span>{t('Показник')}</span>
              <span>{t('Без ПДВ')}</span>
              <span>{t('ПДВ')}</span>
              <span>{t('З ПДВ')}</span>
            </div>
            {measurements.map((group, groupIndex) => {
              const groupLabel = group.Label || getReportFieldLabel(group.Name)
              const hasDistinctChildren =
                group.SubList.length > 1
                || (group.SubList[0]?.Label || getReportFieldLabel(group.SubList[0]?.Name ?? '')) !== groupLabel

              return (
                <div className="reports-stocks-legacy-measurement" key={group.Name}>
                  <Checkbox
                    checked={group.IsChecked}
                    indeterminate={!group.IsChecked && group.SubList.some((item) => item.IsChecked)}
                    aria-label={groupLabel}
                    label={group.Name === 'Profitability' ? `${groupLabel}, %` : groupLabel}
                    onChange={() => toggleMeasurementGroup(measurements, groupIndex, onMeasurementsChange)}
                  />
                  {hasDistinctChildren ? group.SubList.map((item, itemIndex) => (
                    <Checkbox
                      className="reports-stocks-measurement-value"
                      style={{ gridColumn: item.Name.endsWith('WithoutVAT') ? 2 : item.Name.endsWith('WithVAT') ? 4 : 3 }}
                      aria-label={(item.Label || getReportFieldLabel(item.Name))}
                      title={(item.Label || getReportFieldLabel(item.Name))}
                      checked={item.IsChecked}
                      key={item.Name}
                      size="sm"
                      onChange={() => toggleMeasurementItem(measurements, groupIndex, itemIndex, onMeasurementsChange)}
                    />
                  )) : <Text className="reports-stocks-measurement-unit" size="xs">{t('Без поділу за ПДВ')}</Text>}
                </div>
              )
            })}
          </div>
        </section>

        <section className="app-section-card reports-stocks-structure">
          <Text className="app-section-title" component="h2" fw={600} size="sm">{t('Групування')}</Text>
          <ReportGroupingPanel layout={groupingLayout} axis="Row" allowed={allowedGroupingTypes}
            onOpenPicker={() => setGroupingPickerTarget('rows')}
            onRemove={(index) => onRowGroupsChange((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            onReorder={(type, direction) => onRowGroupsChange(current => reorderReportGrouping(current, type, direction, allowedGroupingTypes))}
            onTransfer={type => transferGrouping('Row', type)} />
          <ReportGroupingPanel layout={groupingLayout} axis="Col" allowed={allowedGroupingTypes}
            onOpenPicker={() => setGroupingPickerTarget('columns')}
            onRemove={(index) => onColGroupsChange((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            onReorder={(type, direction) => onColGroupsChange(current => reorderReportGrouping(current, type, direction, allowedGroupingTypes))}
            onTransfer={type => transferGrouping('Col', type)} />
        </section>
        <section className="reports-stocks-legacy__selections">
          <ReportSelectionsCard
            dataSource={dataSource}
            description={null}
            filterFieldOptions={filterFieldOptions}
            from={lookupFrom}
            selections={selections}
            title={t('Умови відбору')}
            to={lookupTo}
            onChange={onSelectionsChange}
          />
        </section>
      </div>

      <LegacyGroupingPickerModal
        opened={groupingPickerTarget !== null}
        options={groupingSelectData.filter(item => !selectedGroupingTypes.has(Number(item.value)))}
        target={groupingPickerTarget}
        title={groupingPickerTarget === 'rows' ? 'Групування рядків' : 'Групування стовпців'}
        onAdd={addGroupingFromPicker}
        onClose={closeGroupingPicker}
      />

    </section>
  )
}

type LegacyGroupingPickerModalProps = {
  opened: boolean
  options: GroupingOption[]
  target: 'rows' | 'columns' | null
  title: string
  onAdd: (value: string) => void
  onClose: () => void
}

function LegacyGroupingPickerModal({
  opened,
  options,
  target,
  title,
  onAdd,
  onClose,
}: LegacyGroupingPickerModalProps) {
  const [pickerQuery, setPickerQuery] = useState('')
  const normalizedPickerQuery = pickerQuery.trim().toLocaleLowerCase('uk-UA')
  const visibleOptions = useMemo(
    () =>
      normalizedPickerQuery
        ? options.filter((option) => option.label.toLocaleLowerCase('uk-UA').includes(normalizedPickerQuery))
        : options,
    [normalizedPickerQuery, options],
  )

  const closePicker = () => {
    setPickerQuery('')
    onClose()
  }

  const addOption = (value: string) => {
    setPickerQuery('')
    onAdd(value)
  }

  return (
    <Modal
      centered
      classNames={{ title: 'reports-stocks-modal-title' }}
      opened={opened}
      size="lg"
      title={`Додати поле · ${title}`}
      onClose={closePicker}
    >
      <Stack gap="sm">
        <TextInput
          aria-label={`Пошук поля: ${title}`}
          autoFocus
          placeholder="Назва поля"
          value={pickerQuery}
          onChange={(event) => setPickerQuery(event.currentTarget.value)}
        />
        {visibleOptions.length ? (
          <div className="reports-stocks-group-picker">
            {visibleOptions.map((option) => {
              const [groupLabel, ...fieldLabelParts] = option.label.split(': ')
              const fieldLabel = fieldLabelParts.join(': ') || groupLabel
              const isAssignedToTarget = target ? option.assignedTo.includes(target) : false

              return (
                <button
                  className="reports-stocks-group-picker__option"
                  disabled={isAssignedToTarget}
                  key={option.value}
                  type="button"
                  onClick={() => addOption(option.value)}
                >
                  <span className="reports-stocks-group-picker__copy">
                    <span className="reports-stocks-group-picker__group">{groupLabel}</span>
                    <span className="reports-stocks-group-picker__label">{fieldLabel}</span>
                  </span>
                  {isAssignedToTarget ? (
                    <Badge
                      className="app-role-pill is-orange"
                      variant="light"
                    >
                      {target === 'rows' ? 'У рядках' : 'У колонках'}
                    </Badge>
                  ) : (
                    <Plus aria-hidden="true" size={15} />
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="reports-stocks-group-picker__empty">
            <Text c="gray.9" size="sm">Нічого не знайдено</Text>
          </div>
        )}
      </Stack>
    </Modal>
  )
}

type GroupingOption = {
  assignedTo: Array<'rows' | 'columns'>
  label: string
  value: string
}

type FilterFieldOption = {
  field: ReportFilterField
  label: string
  value: string
}

type ReportSelectionsCardProps = {
  dataSource: number
  description?: string | null
  filterFieldOptions: FilterFieldOption[]
  from: string
  selections: ReportSelection[]
  title?: string
  to: string
  onChange: StateSetter<ReportSelection[]>
}

function ReportSelectionsCard({
  dataSource,
  description,
  filterFieldOptions,
  from,
  selections,
  title,
  to,
  onChange,
}: ReportSelectionsCardProps) {
  const { t } = useI18n()
  const [editorIndex, setEditorIndex] = useState<number | null>(null)
  const [draftSelection, setDraftSelection] = useState<ReportSelection | null>(null)
  const resolvedDescription = description === undefined
    ? t('Необов’язково: звузьте звіт до клієнта, товару, документа або іншої ознаки.')
    : description
  const editorSelections = draftSelection
    ? editorIndex === -1
      ? [...selections, draftSelection]
      : selections.map((selection, index) => (index === editorIndex ? draftSelection : selection))
    : selections

  function closeEditor() {
    setDraftSelection(null)
    setEditorIndex(null)
  }

  function openEditor(index: number, selection: ReportSelection) {
    setEditorIndex(index)
    setDraftSelection(cloneReportSelection(selection))
  }

  function saveDraft() {
    if (!draftSelection || editorIndex === null || !draftSelection.SelectedField.Name || !draftSelection.Values.length) {
      return
    }

    const savedSelection = cloneReportSelection(draftSelection)
    onChange((current) =>
      editorIndex === -1
        ? [...current, savedSelection]
        : current.map((selection, index) => (index === editorIndex ? savedSelection : selection)),
    )
    closeEditor()
  }

  return (
    <>
      <Card className="app-section-card reports-stocks-selection-card" withBorder radius="md" padding="md">
        <div className="reports-stocks-legacy-panel__header">
          <div className="reports-stocks-legacy-panel__title">
            <Group gap={6} wrap="nowrap">
              <Text className="app-section-title" component="h2" fw={600} size="sm">
                {title ?? t('Умови відбору')}
              </Text>
              {selections.length ? <Badge className="app-role-pill is-gray" variant="light">{selections.length}</Badge> : null}
            </Group>
          </div>
          <Button
            className="reports-stocks-legacy-panel__add"
            color={CREATE_ACTION_COLOR}
            leftSection={<Plus size={14} />}
            size="xs"
            type="button"
            onClick={() => openEditor(-1, createEmptySelection())}
          >
            {t('Додати умову')}
          </Button>
        </div>

        {resolvedDescription ? <Text className="reports-stocks-panel-description">{resolvedDescription}</Text> : null}
        {selections.length ? (
          <div className="reports-stocks-selection-list">
            {selections.map((selection, index) => {
              const fieldLabel = getSelectionFieldSummary(selection, filterFieldOptions, t)

              return (
                <div className="reports-stocks-selection-summary" key={getSelectionRenderKey(selection, index)}>
                  <Checkbox
                    aria-label={`${t('Умова відбору')} ${index + 1}`}
                    checked={selection.IsChecked}
                    onChange={() => updateSelection(selections, index, onChange, { IsChecked: !selection.IsChecked })}
                  />
                  <Text className="reports-stocks-selection-summary__copy">
                    <span className="reports-stocks-selection-summary__field">{fieldLabel}</span>
                    <span className="reports-stocks-selection-summary__condition">
                      {selection.FilterCondition.Name}
                    </span>
                    <span className="reports-stocks-selection-summary__value">
                      {getSelectionValuesSummary(selection, t)}
                    </span>
                  </Text>
                  <Group className="reports-stocks-selection-summary__actions" gap={4} wrap="nowrap">
                    <TableRowAction
                      action="edit"
                      label={t('Редагувати')}
                      onClick={() => openEditor(index, selection)}
                    />
                    <TableRowAction
                      action="delete"
                      label={t('Видалити')}
                      onClick={() => onChange((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    />
                  </Group>
                </div>
              )
            })}
          </div>
        ) : null}
      </Card>

      <AppModal
        centered
        className="reports-stocks-selection-modal"
        opened={Boolean(draftSelection)}
        size="lg"
        title={editorIndex === -1 ? t('Додати умову відбору') : t('Редагувати умову відбору')}
        onClose={closeEditor}
      >
        {draftSelection ? (
          <Stack gap="md">
            <Select
              data={filterFieldOptions}
              label={t('Поле')}
              placeholder={t('Оберіть поле')}
              searchable
              value={draftSelection.SelectedField.Name ? String(draftSelection.SelectedField.Type) : null}
              onChange={(value) => {
                const option = filterFieldOptions.find((item) => item.value === value)
                setDraftSelection((current) => current ? {
                  ...current,
                  SelectedField: option?.field || { Name: '', Type: 0 },
                  Values: [],
                } : current)
              }}
            />
            <div className="reports-stocks-selection-modal__controls">
              <Select
                allowDeselect={false}
                data={REPORT_FILTER_CONDITIONS.map((condition) => ({
                  label: condition.Name,
                  value: String(condition.Type),
                }))}
                label={t('Умова')}
                value={String(draftSelection.FilterCondition.Type)}
                onChange={(value) => {
                  const condition = REPORT_FILTER_CONDITIONS.find((item) => String(item.Type) === value) || defaultCondition
                  setDraftSelection((current) => current ? {
                    ...current,
                    FilterCondition: condition,
                    Values: !isMultiValueReportCondition(condition.Type) && current.Values.length > 1
                      ? current.Values.slice(0, 1)
                      : current.Values,
                  } : current)
                }}
              />
              <SelectionValuePicker
                dataSource={dataSource}
                from={from}
                label={t('Значення')}
                selection={draftSelection}
                selections={editorSelections}
                to={to}
                width="100%"
                onChange={(values) => setDraftSelection((current) => current ? { ...current, Values: values } : current)}
              />
            </div>
            <AppModalFooter>
              <Button color="gray" type="button" variant="light" onClick={closeEditor}>{t('Скасувати')}</Button>
              <Button
                color={CREATE_ACTION_COLOR}
                disabled={!draftSelection.SelectedField.Name || !draftSelection.Values.length}
                leftSection={<Save size={16} />}
                type="button"
                onClick={saveDraft}
              >
                {t('Зберегти')}
              </Button>
            </AppModalFooter>
          </Stack>
        ) : null}
      </AppModal>
    </>
  )
}

function cloneReportSelection(selection: ReportSelection): ReportSelection {
  return {
    ...selection,
    FilterCondition: { ...selection.FilterCondition },
    SelectedField: { ...selection.SelectedField },
    Values: selection.Values.map((value) => ({ ...value, Data: { ...value.Data } })),
  }
}

function getSelectionValuesSummary(selection: ReportSelection, t: TranslateFunction) {
  if (!selection.Values.length) {
    return t('Значення не вибрано')
  }

  const visibleValues = selection.Values.slice(0, 2).map((value) => value.Name).join(', ')
  const hiddenCount = selection.Values.length - 2

  return hiddenCount > 0 ? `${visibleValues} · +${hiddenCount}` : visibleValues
}

function getSelectionFieldSummary(
  selection: ReportSelection,
  filterFieldOptions: FilterFieldOption[],
  t: TranslateFunction,
) {
  const label = filterFieldOptions.find((option) => option.value === String(selection.SelectedField.Type))?.label

  if (!label) {
    return t('Поле не вибрано')
  }

  const separatorIndex = label.indexOf(':')

  if (separatorIndex === -1) {
    return label
  }

  const groupLabel = label.slice(0, separatorIndex).trim()
  const fieldLabel = label.slice(separatorIndex + 1).trim()

  return groupLabel === fieldLabel ? fieldLabel : label
}

type ReportTemplatesCardProps = {
  configurationReady: boolean
  storage: ReturnType<typeof useServerReportTemplates>
  notice: string | null
  templateName: string
  templates: ReportTemplate[]
  onApply: (template: ReportTemplate) => void
  onDelete: (name: string) => void
  onNameChange: (name: string) => void
  onRefresh: () => void
  onSave: () => void
  onUpdate: (name: string) => void
}

function ReportTemplatesCard({
  configurationReady,
  storage,
  notice,
  templateName,
  templates,
  onApply,
  onDelete,
  onNameChange,
  onRefresh,
  onSave,
  onUpdate,
}: ReportTemplatesCardProps) {
  const { t } = useI18n()

  return (
    <div className="reports-stocks-template-card">
      <section className="reports-stocks-template-create">
        <Group align="end" className="reports-stocks-template-form" gap={10} wrap="nowrap">
          <TextInput
            className="reports-stocks-template-name"
            label={t('Назва шаблону')}
            placeholder={t('Наприклад, продажі за регіонами')}
            value={templateName}
            onChange={(event) => onNameChange(event.currentTarget.value)}
          />
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={!configurationReady || !templateName.trim() || !storage.ready || storage.busy}
            leftSection={<Save size={16} />}
            type="button"
            onClick={onSave}
          >
            {t('Зберегти')}
          </Button>
        </Group>
      </section>
      {notice ? <Alert color="yellow" icon={<CircleAlert size={18} />}>{notice}</Alert> : null}
      <Text size="xs" c="dimmed">{t('Особисті шаблони зберігаються на сервері та доступні з інших браузерів.')}</Text>
      <section className="reports-stocks-template-saved">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Text className="reports-stocks-template-section-title" fw={600}>
              {t('Збережені шаблони')}
            </Text>
            <Badge className="app-role-pill is-gray" variant="light">
              {templates.length}
            </Badge>
          </Group>
          <Tooltip label={t('Оновити список')}>
            <ActionIcon aria-label={t('Оновити список')} size={32} type="button" variant="default" onClick={onRefresh}>
              <RefreshCw size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
        {templates.length ? (
          <div className="reports-stocks-template-list">
            {templates.map((template) => (
              <div className="reports-stocks-template-item" key={template.Id ?? template.Name}>
              <Button
                className="reports-stocks-template-open"
                leftSection={<RotateCcw size={15} />}
                justify="flex-start"
                type="button"
                variant="subtle"
                onClick={() => onApply(template)}
              >
                <span className="reports-stocks-template-open__content">
                  <span className="reports-stocks-template-open__name">{template.Name}</span>
                  <span className="reports-stocks-template-open__period">
                    {isCurrentReportSource(template.Data.dataSource) && !template.Data.from && !template.Data.to
                      ? t('Поточний стан') : `${formatDate(template.Data.from)}–${formatDate(template.Data.to)}`}
                  </span>
                </span>
              </Button>
                <Group className="reports-stocks-template-item__actions" gap={2} wrap="nowrap">
                  <Tooltip label={t('Оновити шаблон')}>
                    <ActionIcon
                      aria-label={t('Оновити шаблон')}
                      color={CREATE_ACTION_COLOR}
                      size={30}
                      type="button"
                      variant="subtle"
                      disabled={!configurationReady || storage.busy || !storage.ready}
                      onClick={() => onUpdate(template.Id!)}
                    >
                      <Save size={15} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={t('Видалити')}>
                    <ActionIcon
                      aria-label={t('Видалити')}
                      color="red"
                      size={30}
                      type="button"
                      variant="subtle"
                      disabled={storage.busy || !storage.ready}
                      onClick={() => onDelete(template.Id!)}
                    >
                      <Trash2 size={15} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </div>
            ))}
          </div>
        ) : (
          <div className="reports-stocks-template-empty">
            <LayoutTemplate size={20} />
            <Text c="gray.9" size="sm">{t('Збережених шаблонів ще немає')}</Text>
          </div>
        )}
      </section>
      {storage.browserTemplates.length > 0 && <Stack gap="xs">
        <Text fw={600} size="sm">{t('Шаблони цього браузера')}</Text>
        <Text size="xs" c="dimmed">{t('Імпортуйте потрібні шаблони у свій обліковий запис. Оригінали залишаться в браузері.')}</Text>
        {storage.browserTemplates.map(template => <Group key={JSON.stringify({ Name: template.Name, Data: template.Data })} justify="space-between">
          <Text size="sm">{template.Name}</Text>
          <Button size="xs" variant="light" disabled={storage.busy || !storage.ready}
            onClick={() => void storage.importBrowserTemplate(template)}>{t('Імпортувати на сервер')}</Button>
        </Group>)}
      </Stack>}
    </div>
  )
}

type ReportResultSectionProps = {
  hasFiles: boolean
  lastRun: ReportRunOutcome | null
  placeholder: { description: string; title: string }
  onOpenFiles: () => void
}

function ReportResultSection({
  hasFiles,
  lastRun,
  placeholder,
  onOpenFiles,
}: ReportResultSectionProps) {
  const { t } = useI18n()
  const resultRows = useMemo(() => (lastRun ? [lastRun] : []), [lastRun])
  const resultColumns = useMemo<DataTableColumn<ReportRunOutcome>[]>(
    () => [
      {
        id: 'period',
        header: lastRun?.periodSupported === false ? t('Стан') : t('Період'),
        minWidth: 180,
        accessor: (row) => row.periodSupported ? `${formatDate(row.from)} – ${formatDate(row.to)}` : t('Поточний стан'),
        cell: (row) => (
          <span className="reports-stocks-result__period">
            {row.periodSupported ? `${formatDate(row.from)} – ${formatDate(row.to)}` : t('Поточний стан')}
          </span>
        ),
      },
      {
        id: 'measures',
        header: t('Показники'),
        minWidth: 260,
        fill: true,
        accessor: (row) => row.measures.join(', '),
        cell: (row) => row.measures.join(', '),
      },
      {
        id: 'rowGroupings',
        header: t('Групування рядків'),
        minWidth: 220,
        accessor: (row) => row.rowGroupings.join(', '),
        cell: (row) => (
          <span className="reports-stocks-result__grouping">
            {row.rowGroupings.join(', ')}
          </span>
        ),
      },
      {
        id: 'colGroupings',
        header: t('Групування стовпців'),
        minWidth: 220,
        accessor: (row) => row.colGroupings.join(', '),
        cell: (row) => (
          <span className="reports-stocks-result__grouping">
            {row.colGroupings.join(', ')}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('Статус'),
        minWidth: 150,
        align: 'center',
        accessor: (row) => row.hasDocument,
        cell: (row) => (
          <Badge className={`app-role-pill ${row.hasDocument ? 'is-green' : 'is-orange'}`} variant="light">
            {row.hasDocument ? t('Готово') : t('Файл не сформовано')}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        width: 170,
        rowActions: true,
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        cell: (row) => (
          <TableRowAction
            action="download"
            disabled={!row.hasDocument || !hasFiles}
            label={t('Завантажити')}
            onClick={onOpenFiles}
          />
        ),
      },
    ],
    [hasFiles, lastRun?.periodSupported, onOpenFiles, t],
  )

  if (!lastRun) return null

  return (
    <section className="app-section-card reports-stocks-result reports-stocks-panel" aria-labelledby="reports-stocks-result-title">
      <Group className="reports-stocks-result__header" justify="space-between" wrap="nowrap">
        <Box className="reports-stocks-result__heading">
          <Text className="app-section-title" component="h2" fw={600} size="sm" id="reports-stocks-result-title">
            {t('Результат')}
          </Text>
          <Text className="reports-stocks-result__meta" size="xs" c="gray.9">
            {lastRun
              ? `${formatDate(lastRun.from)} – ${formatDate(lastRun.to)} · ${t('Показників')}: ${lastRun.measures.length}`
              : t('Після формування тут з’являться файли Excel і PDF.')}
          </Text>
        </Box>
      </Group>
      <DataTable
        columns={resultColumns}
        data={resultRows}
        density="normal"
        distributeAvailableWidth
        emptyText={(
          <Box className="reports-stocks-result__empty" role="status">
            <Text fw={600}>{placeholder.title}</Text>
            <Text c="gray.9" size="sm">{placeholder.description}</Text>
          </Box>
        )}
        getRowId={(row) => `${row.from}-${row.to}`}
        height={156}
        layoutVersion="reports-stocks-result-v1"
        minWidth={1080}
        showDensityToggle={false}
        showLayoutControls={false}
        tableId="reports-stocks-result"
      />
    </section>
  )
}

type SelectionValuePickerProps = {
  dataSource: number
  error?: string
  from: string
  label?: string
  selection: ReportSelection
  selections: ReportSelection[]
  to: string
  width?: number | string
  onChange: (values: ReportSelectedValue[]) => void
}

function SelectionValuePicker({ dataSource, error, from, label, selection, selections, to, width = 320, onChange }: SelectionValuePickerProps) {
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
  const nativeLookup = usesNativeReportLookup(dataSource)
  // Current reservations resolve exact ClientAgreement identities from their own
  // facts; the sales-only dependent customer-agreement picker must not run here.
  const lookupMode = nativeLookup ? 'search' : getSelectionLookupMode(selection.SelectedField.Type)
  const isSaleDocumentFilter = !nativeLookup && PERIOD_SCOPED_FILTER_FIELD_TYPES.has(selection.SelectedField.Type)
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
      organizationOptions.flatMap((organization) =>
        typeof organization.Id === 'number'
          ? [{ label: getEntityDisplayName(organization), value: String(organization.Id) }]
          : [],
      ),
    [organizationOptions],
  )
  const normalizedSearch = lookupMode === 'search' ? debouncedSearch.trim() : ''
  const minSearchLength = nativeLookup ? 0 : getSelectionLookupMinLength(selection.SelectedField.Type)
  const needsPeriod = isSaleDocumentFilter
  const dependentClientNetId = lookupMode === 'dependent' ? getDependentClientNetId(selections) : ''
  const selectOptions = useMemo(
    () =>
      mergeReportEntities([...selection.Values.map((value) => value.Data), ...options]).map((entity) => ({
        label: getEntityDisplayName(entity),
        value: getReportEntityKey(entity, getEntityDisplayName(entity)),
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
                dataSource, selection.SelectedField.Type, normalizedSearch, from, to,
                controller.signal, saleDocumentFilters,
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
    dataSource,
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
        w={width}
      />
    )
  }

  return (
    <Stack gap={4} w={width}>
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
                  .find((option) => getReportEntityKey(option, getEntityDisplayName(option)) === value)
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
              key={getReportEntityKey(value.Data, value.Name)}
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

function addGrouping(current: ReportGroupingItem[], item: ReportGroupingItem): ReportGroupingItem[] {
  const isTaken = current.some((group) => group.type === item.type)

  return isTaken ? current : [...current, item]
}

// The controller used to answer EVERY failure — its own crashes included — with HTTP 400 and the raw .NET
// exception text, so the status said nothing and the text was «Value cannot be null. (Parameter 'key')»: not
// ours to show, and not something anyone could act on. Nothing but the status was read here, and the screen
// offered a guess instead — «спробуйте вужчий період або менше групувань» — which for the commonest refusals is
// the opposite of the fix: a date typed as «01.06.2026», a filter row with no values, an unticked measure. None
// of those get better with a narrower period.
//
// The server now separates the two: 400 carries an authored Ukrainian sentence naming the row, the field and
// what to do about it, and its own faults come back as 500 with the detail in the log. So a 400 is shown as the
// server wrote it. The Cyrillic test is what tells the new contract from the old one — against a server that
// still answers 400 with a .NET stack message the screen keeps its own words rather than publishing that.
function describeReportError(error: unknown, t: TranslateFunction): string {
  if (error instanceof ApiError) {
    // Status 0 is the client's own network/timeout message, already translated.
    if (error.status === 0) {
      return error.message
    }

    if (error.status === 401) {
      return t('Сесію завершено. Увійдіть повторно.')
    }

    if (error.status === 403) {
      return t('Недостатньо прав для формування звіту. Зверніться до адміністратора щодо доступу до конструктора звітів.')
    }

    if (error.status >= 500) {
      return t('Сервер звітів недоступний. Спробуйте ще раз пізніше.')
    }

    if (isAuthoredServerMessage(error.message)) {
      return error.message
    }

    return t('Сервер не зміг сформувати звіт із такими параметрами. Спробуйте вужчий період або менше групувань.')
  }

  return t('Не вдалося сформувати звіт')
}

function isAuthoredServerMessage(message: string): boolean {
  return /\p{Script=Cyrillic}/u.test(message || '')
}

// Names the run for the export modal, where the only other identity on offer is the engine's «Reports_MM.yyyy_
// <guid>.xlsx» file name.
function describeReportRun(run: ReportRunOutcome, t: TranslateFunction): string {
  const parts = [run.periodSupported ? `${formatDate(run.from)} – ${formatDate(run.to)}` : t('Поточний стан на час читання даних')]

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

  if (!lastRun.periodSupported) {
    return {
      description: lastRun.hasDocument
        ? t('Поточний стан. Показники: {measures}. Час читання даних і залишки — у файлі звіту.', { measures })
        : t('Поточний стан. Показники: {measures}. Спробуйте послабити умови відбору.', { measures }),
      title: lastRun.hasDocument ? t('Звіт сформовано у файл') : t('Файл звіту не сформовано'),
    }
  }

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
    case REPORT_FILTER_FIELD_TYPES.saleReturnDocument:
      // «Повернення від клієнта» is fetched whole and filtered in the browser rather than searched on the
      // server: the list endpoint's `value` matches the client, the region code, the two users, the product
      // codes and the storage — everything except the document NUMBER, which is the only thing this picker
      // shows. Typing a number into that search returns nothing at all, so the typing has to filter here.
      return 'static'
    case REPORT_FILTER_FIELD_TYPES.customerContract:
      return 'dependent'
    case REPORT_FILTER_FIELD_TYPES.product:
    case REPORT_FILTER_FIELD_TYPES.productArticle:
    case REPORT_FILTER_FIELD_TYPES.productGroup:
    case REPORT_FILTER_FIELD_TYPES.customerName:
    case REPORT_FILTER_FIELD_TYPES.saleDocument:
    case REPORT_FILTER_FIELD_TYPES.saleDocumentNumberDate:
    case REPORT_FILTER_FIELD_TYPES.supplier:
    case REPORT_FILTER_FIELD_TYPES.supplierContract:
    case REPORT_FILTER_FIELD_TYPES.purchaseDocument:
    case REPORT_FILTER_FIELD_TYPES.productMeasureUnit:
    case REPORT_FILTER_FIELD_TYPES.warehouse:
    case REPORT_FILTER_FIELD_TYPES.customerManager:
    case REPORT_FILTER_FIELD_TYPES.saleDocumentManagerInput:
    case REPORT_FILTER_FIELD_TYPES.saleDocumentManagerPosted:
      return 'search'
    default:
      return 'manual'
  }
}

function getSelectionLookupMinLength(fieldType: number): number {
  return fieldType === REPORT_FILTER_FIELD_TYPES.productGroup || fieldType === REPORT_FILTER_FIELD_TYPES.productMeasureUnit ? 0 : 2
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
  dataSource: number,
  fieldType: number,
  value: string,
  from: string,
  to: string,
  signal?: AbortSignal,
  saleDocumentFilters?: SaleDocumentLookupFilters,
): Promise<ReportEntity[]> {
  if (usesNativeReportLookup(dataSource)) {
    return searchDatasetReportValues(dataSource, fieldType, { limit: LOOKUP_SEARCH_LIMIT, offset: 0, value }, signal)
  }
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
    case REPORT_FILTER_FIELD_TYPES.product:
    case REPORT_FILTER_FIELD_TYPES.productArticle:
      return searchReportProducts({ limit: LOOKUP_SEARCH_LIMIT, offset: 0, value })
    case REPORT_FILTER_FIELD_TYPES.customerName:
      return searchReportClients({ limit: LOOKUP_SEARCH_LIMIT, offset: 0, value }, signal)
    case REPORT_FILTER_FIELD_TYPES.customerManager:
    case REPORT_FILTER_FIELD_TYPES.saleDocumentManagerInput:
    case REPORT_FILTER_FIELD_TYPES.saleDocumentManagerPosted:
      return searchReportUsers({ limit: LOOKUP_SEARCH_LIMIT, offset: 0, value })
    // The report filters on the return document a sale line is ATTRIBUTED to, and captions the grouping from the
    // same column, so «Повернення від клієнта» as a filter and as a dimension answer the same question — and the
    // document can be of any date, which is why the catalogue is asked for whole rather than for the period.
    case REPORT_FILTER_FIELD_TYPES.saleReturnDocument:
      return loadSaleReturnDocumentCatalogue()
    case REPORT_FILTER_FIELD_TYPES.supplier:
    case REPORT_FILTER_FIELD_TYPES.supplierContract:
    case REPORT_FILTER_FIELD_TYPES.purchaseDocument:
    case REPORT_FILTER_FIELD_TYPES.productMeasureUnit:
      return searchDatasetReportValues(dataSource, fieldType, { limit: LOOKUP_SEARCH_LIMIT, offset: 0, value }, signal)
    case REPORT_FILTER_FIELD_TYPES.saleDocument:
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

async function loadSaleReturnDocumentCatalogue(): Promise<ReportEntity[]> {
  let offset = 0
  let documents: ReportEntity[] = []

  while (offset < RETURN_DOCUMENT_CATALOGUE_MAX_ITEMS) {
    const page = await searchSaleReturnReportDocuments({
      from: REPORT_MIN_DATE,
      limit: RETURN_DOCUMENT_CATALOGUE_PAGE_SIZE,
      offset,
      to: `${new Date().getFullYear()}-12-31`,
      value: '',
    })

    if (!page.length) {
      break
    }

    const previousCount = documents.length
    documents = mergeReportEntities([...documents, ...page])

    // Also protects the picker from an older endpoint that ignores offset and repeats its first page.
    if (documents.length === previousCount || page.length < RETURN_DOCUMENT_CATALOGUE_PAGE_SIZE) {
      break
    }

    offset += page.length
  }

  return documents
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
