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
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import {
  IconAlertCircle,
  IconDownload,
  IconFileTypePdf,
  IconFileTypeXls,
  IconPlus,
  IconPrinter,
  IconRefresh,
  IconRestore,
  IconTrash,
} from '@tabler/icons-react'
import { type FormEvent, useMemo } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { createStockReport } from '../api/reportsApi'
import {
  REPORT_FILTER_CONDITIONS,
  REPORT_FILTER_FIELD_GROUPS,
  createDefaultMeasurementGroups,
  flattenCheckedMeasurements,
  flattenGroupingOptions,
  getReportFieldLabel,
} from '../data/reportOptions'
import type {
  ReportFilterField,
  ReportGroupingItem,
  ReportMeasurementGroup,
  ReportRequestBody,
  ReportResult,
  ReportSelection,
} from '../types'
import {
  buildCsv,
  buildDateFileSuffix,
  displayValue,
  downloadTextFile,
  formatDate,
} from '../utils'

const STORAGE_KEY = 'app_configs_reports_template'

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
  const [templates, setTemplates] = useValueState<ReportRequestBody[]>([])
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

    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTemplates))
    setTemplates(nextTemplates.map((template) => template.Data))
  }

  function loadTemplates() {
    setTemplates(parseTemplates(localStorage.getItem(STORAGE_KEY)).map((template) => template.Data))
  }

  function applyTemplate(template: ReportRequestBody) {
    setFrom(template.from || today)
    setTo(template.to || today)
    setRowGroups(template.sorted?.Row || [])
    setColGroups(template.sorted?.Col || [])
    setSelections(template.selections?.length ? template.selections : [createEmptySelection()])
    setMeasurements(applyTemplateMeasurements(createDefaultMeasurementGroups(), template.sorted?.Measurements || []))
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
                  <Group key={index} gap="xs" align="end" wrap="wrap">
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
                    <TextInput
                      label={index === 0 ? t('Значення') : undefined}
                      placeholder={t('ID, назва або код')}
                      value={selection.Values.map((value) => value.Name).join(', ')}
                      w={260}
                      onChange={(event) => updateSelectionValue(selections, index, event.currentTarget.value, setSelections)}
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
              {templates.map((template, index) => (
                <Button key={index} size="xs" variant="default" onClick={() => applyTemplate(template)}>
                  {formatDate(template.from)} - {formatDate(template.to)}
                </Button>
              ))}
            </Group>
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
              <Group gap="xs"><IconFileTypeXls size={18} /> XLSX</Group>
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

function ReportPreview({ result }: { result: ReportResult }) {
  const { t } = useI18n()

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
            <Table.Tr key={rowIndex}>
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

function updateSelectionValue(
  selections: ReportSelection[],
  index: number,
  value: string,
  setter: (value: ReportSelection[]) => void,
) {
  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => ({
      Name: item,
      Value: 0,
      Data: {
        Name: item,
        Value: item,
      },
    }))

  updateSelection(selections, index, setter, { Values: values })
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
