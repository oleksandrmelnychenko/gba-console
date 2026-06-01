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
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { AppModal } from '../../../shared/ui/AppModal'
import {
  IconAlertCircle,
  IconDeviceFloppy,
  IconDownload,
  IconFileTypePdf,
  IconPlus,
  IconPrinter,
  IconRefresh,
  IconRestore,
  IconTrash,
} from '@tabler/icons-react'
import { type FormEvent, useEffect, useMemo } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  createStockReport,
  getReportClientTypes,
  getReportOrganizations,
  getReportPricings,
  getReportProductGroups,
  getReportProductTop,
  getReportRegions,
  searchReportClients,
  searchReportProducts,
  searchReportUsers,
  searchSaleReturnReportDocuments,
  searchSalesReportDocuments,
} from '../api/reportsApi'
import {
  REPORT_FILTER_CONDITIONS,
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
  ReportResultRow,
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

const STORAGE_KEY = 'app_configs_reports_template'
const LOOKUP_SEARCH_DEBOUNCE_MS = 300
const LOOKUP_SEARCH_LIMIT = 30

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
    <Stack gap="lg">
      <Group justify="flex-end" align="center">
        <Badge color={isLoading ? 'violet' : 'gray'} variant="light">
          {isLoading ? t('Формується') : `${t('Показників')}: ${checkedMeasurements}`}
        </Badge>
      </Group>

      <Card withBorder radius="md" padding="md">
        <form onSubmit={submitReport}>
          <Stack gap="md">
            <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
              <TextInput label={t('З')} type="date" value={from} onChange={(event) => setFrom(event.currentTarget.value)} />
              <TextInput label={t('По')} type="date" value={to} onChange={(event) => setTo(event.currentTarget.value)} />
              <Tooltip label={t('Сформувати')}>
                <Button loading={isLoading} disabled={!canSubmit} type="submit">
                  {t('Сформувати')}
                </Button>
              </Tooltip>
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} variant="subtle" color="gray" onClick={resetReport}>
                  <IconRestore size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Друк')}>
                <ActionIcon aria-label={t('Друк')} variant="subtle" color="gray" onClick={() => window.print()}>
                  <IconPrinter size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            {filterError ? (
              <Alert color="red" icon={<IconAlertCircle size={18} />}>{filterError}</Alert>
            ) : null}

            <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={700}>{t('Показники')}</Text>
                  <Group gap={6}>
                    <Button size="xs" variant="light" onClick={() => setAllMeasurements(setMeasurements, true)}>
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
                  leftSection={<IconPlus size={16} />}
                  size="xs"
                  variant="light"
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
                        updateSelection(selections, index, setSelections, { FilterCondition: condition })
                      }}
                    />
                    <SelectionValuePicker
                      from={from}
                      label={index === 0 ? t('Значення') : undefined}
                      selection={selection}
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
                        <IconTrash size={18} />
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
              <Button variant="light" onClick={saveTemplate}>{t('Зберегти шаблон')}</Button>
              <Button leftSection={<IconRefresh size={16} />} variant="subtle" color="gray" onClick={loadTemplates}>
                {t('Показати шаблони')}
              </Button>
            </Group>
            {templates.length ? (
              <Stack gap={6}>
                {templates.map((template) => (
                  <Group key={template.Name} gap={6} wrap="nowrap">
                    <Button
                      leftSection={<IconRestore size={16} />}
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
                        <IconDeviceFloppy size={16} />
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
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                ))}
              </Stack>
            ) : null}
          </Stack>
        </form>
      </Card>

      {error ? <Alert color="red" icon={<IconAlertCircle size={18} />}>{error}</Alert> : null}

      <Card withBorder radius="md" padding="md">
        <Group justify="space-between" mb="sm">
          <Box>
            <Text fw={700}>{t('Результат')}</Text>
            <Text size="xs" c="dimmed">
              {result ? `${t('Рядків')}: ${result.table.rows.length}` : t('Після формування тут буде preview відповіді API')}
            </Text>
          </Box>
          <Group gap={6}>
            <Button
              leftSection={<IconDownload size={16} />}
              disabled={!result?.table.rows.length}
              size="xs"
              variant="light"
              onClick={exportPreviewCsv}
            >
              CSV
            </Button>
            <Button
              disabled={!result?.document.DocumentURL && !result?.document.PdfDocumentURL}
              size="xs"
              variant="light"
              onClick={() => setDownloadModalOpened(true)}
            >
              {t('Файли')}
            </Button>
          </Group>
        </Group>

        {result?.table.rows.length ? <ReportPreview result={result} /> : <Text c="dimmed">{t('Даних ще немає')}</Text>}
      </Card>

      <AppModal centered opened={downloadModalOpened} title={t('Експорт звіту')} onClose={() => setDownloadModalOpened(false)}>
        <Stack>
          {result?.document.DocumentURL ? (
            <Anchor href={result.document.DocumentURL} target="_blank" rel="noreferrer">
              <Group gap="xs"><ExcelIcon size={18} /> XLSX</Group>
            </Anchor>
          ) : null}
          {result?.document.PdfDocumentURL ? (
            <Anchor href={result.document.PdfDocumentURL} target="_blank" rel="noreferrer">
              <Group gap="xs"><IconFileTypePdf size={18} /> PDF</Group>
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
  to: string
  onChange: (values: ReportSelectedValue[]) => void
}

function SelectionValuePicker({ from, label, selection, to, onChange }: SelectionValuePickerProps) {
  const { t } = useI18n()
  const [search, setSearch] = useValueState('')
  const [manualValue, setManualValue] = useValueState('')
  const [options, setOptions] = useValueState<ReportEntity[]>([])
  const [isLoading, setLoading] = useValueState(false)
  const [debouncedSearch] = useDebouncedValue(search, LOOKUP_SEARCH_DEBOUNCE_MS)
  const lookupMode = getSelectionLookupMode(selection.SelectedField.Type)
  const normalizedSearch = lookupMode === 'search' ? debouncedSearch.trim() : ''
  const minSearchLength = getSelectionLookupMinLength(selection.SelectedField.Type)
  const selectOptions = useMemo(
    () =>
      mergeReportEntities([...selection.Values.map((value) => value.Data), ...options]).map((entity, index) => ({
        label: getEntityDisplayName(entity),
        value: getReportEntityKey(entity, String(index)),
      })),
    [options, selection.Values],
  )

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

    let cancelled = false

    async function loadOptions() {
      setLoading(true)

      try {
        const nextOptions = await loadSelectionLookupOptions(selection.SelectedField.Type, normalizedSearch, from, to)

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
    }
  }, [
    from,
    lookupMode,
    minSearchLength,
    normalizedSearch,
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
      {lookupMode === 'manual' ? (
        <Group align="end" gap={6} wrap="nowrap">
          <TextInput
            label={label}
            placeholder={t('Значення')}
            value={manualValue}
            onChange={(event) => setManualValue(event.currentTarget.value)}
          />
          <Button size="sm" type="button" variant="light" onClick={addManualValue}>
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
                  <IconTrash size={12} />
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
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ))}
        {!groups.length ? <Text size="sm" c="dimmed">{t('Не задано')}</Text> : null}
      </Stack>
    </Stack>
  )
}

const TOTALS_ROW_FLAG = '__reportTotalsRow'

type ReportPreviewRow = ReportResultRow & { [TOTALS_ROW_FLAG]?: boolean }

function ReportPreview({ result }: { result: ReportResult }) {
  const { t } = useI18n()

  const columns = useMemo<DataTableColumn<ReportPreviewRow>[]>(
    () =>
      result.table.columns.map((column, columnIndex) => ({
        id: `${columnIndex}:${column}`,
        header: column,
        minWidth: 140,
        accessor: (row) => row[column],
        cell: (row) =>
          row[TOTALS_ROW_FLAG] ? (
            <Text component="span" fw={700}>
              {columnIndex === 0 ? t('Разом') : displayValue(result.totals[column])}
            </Text>
          ) : (
            displayValue(row[column])
          ),
      })),
    [result.table.columns, result.totals, t],
  )

  const data = useMemo<ReportPreviewRow[]>(() => {
    const rows: ReportPreviewRow[] = result.table.rows.slice(0, 100)

    if (Object.keys(result.totals).length) {
      return [...rows, { [TOTALS_ROW_FLAG]: true }]
    }

    return rows
  }, [result.table.rows, result.totals])

  return (
    <Box style={{ overflowX: 'auto' }}>
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

function getSelectionLookupMode(fieldType: number): 'manual' | 'search' | 'static' {
  switch (fieldType) {
    case REPORT_FILTER_FIELD_TYPES.organization:
    case REPORT_FILTER_FIELD_TYPES.customer:
    case REPORT_FILTER_FIELD_TYPES.customerRegion:
    case REPORT_FILTER_FIELD_TYPES.customerRegionCode:
    case REPORT_FILTER_FIELD_TYPES.customerPriceType:
    case REPORT_FILTER_FIELD_TYPES.productTop:
      return 'static'
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

async function loadSelectionLookupOptions(
  fieldType: number,
  value: string,
  from: string,
  to: string,
): Promise<ReportEntity[]> {
  switch (fieldType) {
    case REPORT_FILTER_FIELD_TYPES.organization:
      return getReportOrganizations()
    case REPORT_FILTER_FIELD_TYPES.customer:
      return getReportClientTypes()
    case REPORT_FILTER_FIELD_TYPES.customerRegion:
    case REPORT_FILTER_FIELD_TYPES.customerRegionCode:
      return getReportRegions()
    case REPORT_FILTER_FIELD_TYPES.customerPriceType:
      return getReportPricings()
    case REPORT_FILTER_FIELD_TYPES.productTop:
      return getReportProductTop()
    case REPORT_FILTER_FIELD_TYPES.productGroup:
      return getReportProductGroups(value)
    case REPORT_FILTER_FIELD_TYPES.productArticle:
      return searchReportProducts({ limit: LOOKUP_SEARCH_LIMIT, offset: 0, value })
    case REPORT_FILTER_FIELD_TYPES.customerName:
      return searchReportClients({ limit: LOOKUP_SEARCH_LIMIT, offset: 0, value })
    case REPORT_FILTER_FIELD_TYPES.customerManager:
    case REPORT_FILTER_FIELD_TYPES.saleDocumentManagerInput:
    case REPORT_FILTER_FIELD_TYPES.saleDocumentManagerPosted:
      return searchReportUsers({ limit: LOOKUP_SEARCH_LIMIT, offset: 0, value })
    case REPORT_FILTER_FIELD_TYPES.saleDocumentNumberDate:
      return searchSalesReportDocuments({
        from,
        limit: LOOKUP_SEARCH_LIMIT,
        offset: 0,
        organisationIds: [],
        status: '',
        to,
        type: 'All',
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
