import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { CircleAlert, Download, Printer, RefreshCw, RotateCcw, Search, Upload } from 'lucide-react'
import { type ChangeEvent, type ReactNode, useMemo } from 'react'
import readXlsxFile from 'read-excel-file/browser'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import type { DataTableColumn, DataTableDensity } from '../../../shared/ui/data-table/types'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { useAuth } from '../../auth/useAuth'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import {
  buildSheetExportRows,
  buildSpreadsheetSheet,
  calculateTotals,
  detectDelimiter,
  filterSheetRows,
  getAdditiveColumns,
  isFilledCell,
  normalizeImportedCellValue,
  parseDelimitedText,
} from '../spreadsheet'
import type {
  SpreadsheetCellValue,
  SpreadsheetReportHeader,
  SpreadsheetRow,
  SpreadsheetRowKind,
  SpreadsheetSheet,
} from '../types'
import { buildDateFileSuffix, buildReportFileName, buildSpreadsheetCsv, displayValue, downloadTextFile } from '../utils'
import './reports-pages.css'

const SEARCH_DEBOUNCE_MS = 400

export function ReportsSalePage() {
  const { t } = useI18n()

  return (
    <PermissionGate
      fallback={<Alert color="red">{t('Немає права переглядати файл звіту продажів')}</Alert>}
      permissionKey={PermissionKeys.ReportsSaleFile.Page.View}
    >
      <ReportsSalePageContent />
    </PermissionGate>
  )
}

function ReportsSalePageContent() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const [sheets, setSheets] = useValueState<SpreadsheetSheet[]>([])
  const [activeSheetName, setActiveSheetName] = useValueState<string | null>(null)
  const [fileName, setFileName] = useValueState('')
  const [search, setSearch] = useValueState('')
  const [dateFrom, setDateFrom] = useValueState('')
  const [dateTo, setDateTo] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const { density, toggleDensity } = useDataTableDensity('reports-sale-spreadsheet', 'normal')
  const [debouncedSearch] = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)
  const activeSheet = sheets.find((sheet) => sheet.name === activeSheetName) || sheets[0] || null
  const visibleRows = useMemo(
    () => filterSheetRows(activeSheet, debouncedSearch, dateFrom, dateTo),
    [activeSheet, dateFrom, dateTo, debouncedSearch],
  )
  const visibleDataRows = useMemo(() => visibleRows.filter((row) => row.kind === 'data'), [visibleRows])
  const additiveColumns = useMemo(() => getAdditiveColumns(activeSheet), [activeSheet])
  const visibleTotals = useMemo(
    () => calculateTotals(visibleDataRows, additiveColumns),
    [additiveColumns, visibleDataRows],
  )
  // While the sheet still carries its own «Загальний підсумок» there is nothing to add: a second, differently
  // computed total under it would only invite the reader to pick one. A filter drops those rows (they describe
  // the whole sheet, not the selection), and a plain CSV never had them, so the viewer totals what is on screen.
  // The badges and the table row must agree on whether a total exists at all, or a sheet with nothing addable
  // gets a bold «Разом» line with no numbers in it.
  const showComputedTotals =
    visibleTotals.some((total) => total !== null && total !== undefined)
    && !visibleRows.some((row) => row.kind === 'total')

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]

    event.currentTarget.value = ''

    if (!file) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const parsedSheets = await parseSpreadsheetFile(file)

      setFileName(file.name)
      setSheets(parsedSheets)
      setActiveSheetName(parsedSheets[0]?.name || null)
      setSearch('')
    } catch (parseError) {
      setFileName(file.name)
      setSheets([])
      setActiveSheetName(null)
      setError(parseError instanceof Error ? parseError.message : t('Не вдалося прочитати файл'))
    } finally {
      setLoading(false)
    }
  }

  function resetFilters() {
    setSearch('')
    setDateFrom('')
    setDateTo('')
  }

  function exportCsv() {
    if (
      !activeSheet ||
      !hasPermission(PermissionKeys.ReportsSaleFile.Document.Export)
    ) {
      return
    }

    // The export is what the screen shows. Under a filter the sheet's own subtotals are gone and the viewer
    // computes a «Разом» of the selection instead — leaving it out of the file would hand the reader a column
    // of numbers whose total is nowhere, and a different total from the one they were just looking at.
    const totalsRow = showComputedTotals
      ? activeSheet.columns.map((_, columnIndex) => (columnIndex === 0 ? t('Разом') : visibleTotals[columnIndex] ?? ''))
      : null

    downloadTextFile(
      buildReportFileName([fileName.replace(/\.[^.]+$/, ''), activeSheet.name, buildDateFileSuffix()], 'csv'),
      buildSpreadsheetCsv(buildSheetExportRows(activeSheet, visibleRows, totalsRow)),
    )
  }

  function printReport() {
    if (!hasPermission(PermissionKeys.ReportsSaleFile.Document.Print)) {
      return
    }

    window.print()
  }

  return (
    <Stack className="reports-sale-page" gap={6}>
      <Card withBorder radius="md" padding={0} className="app-data-card reports-sale-shell">
        <div className="app-filter-bar reports-sale-filter-bar">
          <div className="app-filter-date-range">
            <TextInput label={t('Від')} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.currentTarget.value)} />
            <TextInput label={t('До')} type="date" value={dateTo} onChange={(event) => setDateTo(event.currentTarget.value)} />
          </div>
          <TextInput
            className="reports-sale-search"
            leftSection={<Search size={16} />}
            label={t('Пошук')}
            placeholder={t('Текст у будь-якій колонці')}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <div className="reports-sale-meta">
            {fileName ? <Text className="reports-sale-file-name" size="sm">{fileName}</Text> : null}
            <Badge className={activeSheet ? 'app-role-pill is-gray' : 'app-role-pill is-orange'} variant="light">
              {isLoading
                ? t('Читання файлу')
                : activeSheet
                  ? `${t('Рядків')}: ${visibleDataRows.length}`
                  : t('Файл не вибрано')}
            </Badge>
          </div>
          <div className="app-filter-actions reports-sale-actions">
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={resetFilters}>
                <RotateCcw size={17} />
              </ActionIcon>
            </Tooltip>
            {hasPermission(PermissionKeys.ReportsSaleFile.Document.Export) && (
              <Tooltip label={t('Експорт CSV')}>
                <ActionIcon aria-label={t('Експорт CSV')} color="gray" disabled={!activeSheet} size={34} variant="light" onClick={exportCsv}>
                  <Download size={17} />
                </ActionIcon>
              </Tooltip>
            )}
            {hasPermission(PermissionKeys.ReportsSaleFile.Document.Print) && (
              <Tooltip label={t('Друк')}>
                <ActionIcon aria-label={t('Друк')} color="gray" disabled={!activeSheet} size={34} variant="light" onClick={printReport}>
                  <Printer size={17} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label={t('Очистити файл')}>
              <ActionIcon
                aria-label={t('Очистити файл')}
                color="gray"
                size={34}
                variant="light"
                onClick={() => {
                  setSheets([])
                  setActiveSheetName(null)
                  setFileName('')
                  resetFilters()
                }}
              >
                <RefreshCw size={17} />
              </ActionIcon>
            </Tooltip>
          </div>
          <div className="app-filter-table-toolbar-slot">
            <DataTableDensityToggle density={density} onToggle={toggleDensity} size="md" />
          </div>
          <Button color={CREATE_ACTION_COLOR} component="label" leftSection={<Upload size={16} />} loading={isLoading}>
            {t('Завантажити файл')}
            <input
              accept=".csv,.tsv,.txt,.xlsx,.xls"
              aria-label={t('Завантажити файл')}
              hidden
              type="file"
              onChange={handleFileChange}
            />
          </Button>
        </div>

        {error ? <Alert className="reports-page-alert" color="red" icon={<CircleAlert size={18} />}>{error}</Alert> : null}

        <div className="reports-sale-result-body">
          {activeSheet ? (
            <div className="reports-sale-result-layout">
              <div className="pill-tabs">
                {sheets.map((sheet) => (
                  <button
                    key={sheet.name}
                    type="button"
                    className={`pill-tab${activeSheet.name === sheet.name ? ' is-active' : ''}`}
                    aria-pressed={activeSheet.name === sheet.name}
                    onClick={() => setActiveSheetName(sheet.name)}
                  >
                    {sheet.name}
                  </button>
                ))}
              </div>

              <Stack className="reports-sale-result-content" gap="md" pt="md">
                {activeSheet.header ? <ReportHeaderBlock header={activeSheet.header} /> : null}
                {showComputedTotals ? <TotalsBar columns={activeSheet.columns} totals={visibleTotals} /> : null}
                <SpreadsheetTable
                  columns={activeSheet.columns}
                  isReport={Boolean(activeSheet.header)}
                  rows={visibleRows}
                  showComputedTotals={showComputedTotals}
                  totals={visibleTotals}
                  density={density}
                />
              </Stack>
            </div>
          ) : (
            <div className="reports-sale-empty-state">
              <Text c="dimmed" ta="center">{t('Завантажте файл звіту (XLSX/XLS) або CSV/TSV/TXT для перегляду')}</Text>
            </div>
          )}
        </div>
      </Card>
    </Stack>
  )
}

// The block the engine writes above the table, shown where the reader meets it before the numbers. The «немає
// даних» lines are lifted out of it: they are the reason a money column on this sheet is blank, and a reader who
// does not see them reads a blank cost as nothing sold rather than as nothing known.
function ReportHeaderBlock({ header }: { header: SpreadsheetReportHeader }) {
  const warnings = new Set(header.warnings)
  const warningLines = addOccurrenceKeys(header.warnings)
  const details = addOccurrenceKeys(header.lines.filter((line) => !warnings.has(line)))

  return (
    <Stack gap={6}>
      {warningLines.length ? (
        <Alert className="reports-page-alert" color="yellow" icon={<CircleAlert size={18} />}>
          <Stack gap={2}>
            {warningLines.map(({ key, line }) => (
              <Text key={key} size="xs">{line}</Text>
            ))}
          </Stack>
        </Alert>
      ) : null}
      {details.map(({ key, line }) => (
        <Text key={key} c="dimmed" size="xs">{line}</Text>
      ))}
    </Stack>
  )
}

// Two filter bullets can legitimately have the same text. Their occurrence within that text is stable while
// unrelated lines move, unlike the array index, and still gives React a unique identity for every rendered line.
function addOccurrenceKeys(lines: string[]): Array<{ key: string; line: string }> {
  const occurrences = new Map<string, number>()

  return lines.map((line) => {
    const occurrence = (occurrences.get(line) ?? 0) + 1
    occurrences.set(line, occurrence)

    return { key: JSON.stringify([line, occurrence]), line }
  })
}

function TotalsBar({ columns, totals }: { columns: string[]; totals: Array<number | null> }) {
  const totalEntries = columns
    .map((column, columnIndex) => ({ column, total: totals[columnIndex] }))
    .filter((entry): entry is { column: string; total: number } => entry.total !== null && entry.total !== undefined)
    .slice(0, 8)

  if (!totalEntries.length) {
    return null
  }

  return (
    <Group gap="xs">
      {totalEntries.map((entry) => (
        <Badge key={entry.column} color="gray" variant="light">
          {entry.column}: {displayValue(entry.total)}
        </Badge>
      ))}
    </Group>
  )
}

type SpreadsheetPreviewRowKind = SpreadsheetRowKind | 'computed'

type SpreadsheetPreviewRow = {
  key: string
  cells: SpreadsheetCellValue[]
  kind: SpreadsheetPreviewRowKind
}

function SpreadsheetTable({
  columns,
  isReport,
  rows,
  showComputedTotals,
  totals,
  density,
}: {
  columns: string[]
  isReport: boolean
  rows: SpreadsheetRow[]
  showComputedTotals: boolean
  totals: Array<number | null>
  density: DataTableDensity
}) {
  const { t } = useI18n()

  const previewColumns = useMemo<DataTableColumn<SpreadsheetPreviewRow>[]>(
    () =>
      columns.map((column, columnIndex) => {
        const header = column || `C${columnIndex + 1}`

        return {
          id: `c${columnIndex}`,
          header,
          minWidth: 140,
          accessor: (row) => row.cells[columnIndex],
          cell: (row): ReactNode => {
            if (row.kind === 'computed') {
              return (
                <Text component="span" fw={600}>
                  {columnIndex === 0 ? t('Разом') : formatSpreadsheetCell(totals[columnIndex] ?? null)}
                </Text>
              )
            }

            if (row.kind === 'data') {
              // On a report sheet an empty cell is a STATEMENT — the engine could not read the cost behind that
              // measure and says so at the top of the file — and it is already printed empty on the subtotal and
              // total rows below. A «-» in the data rows only would read as two different kinds of nothing in one
              // column. Anywhere else «-» stays: an empty cell in an arbitrary spreadsheet says nothing at all.
              return isReport ? formatSpreadsheetCell(row.cells[columnIndex]) : displayValue(row.cells[columnIndex])
            }

            return (
              <Text component="span" fw={600}>
                {formatSpreadsheetCell(row.cells[columnIndex])}
              </Text>
            )
          },
        }
      }),
    [columns, isReport, t, totals],
  )

  const previewData = useMemo<SpreadsheetPreviewRow[]>(() => {
    const previewRows: SpreadsheetPreviewRow[] = rows.slice(0, 500).map((row, index) => ({
      key: `${getSpreadsheetRowKey(row.cells)}-${index}`,
      cells: row.cells,
      kind: row.kind,
    }))

    if (showComputedTotals && previewRows.length) {
      previewRows.push({ key: '__totals__', cells: [], kind: 'computed' })
    }

    return previewRows
  }, [rows, showComputedTotals])

  return (
    <Box className="reports-sale-table">
      <DataTable
        columns={previewColumns}
        data={previewData}
        density={density}
        emptyText={t('Немає рядків для перегляду')}
        getRowId={(row) => row.key}
        layoutVersion={`reports-sale-spreadsheet:${columns.join('|')}`}
        height="100%"
        minWidth={Math.max(640, columns.length * 160)}
        rowClassName={(row) => (row.kind === 'data' ? undefined : `reports-sale-row-${row.kind}`)}
        tableId="reports-sale-spreadsheet"
      />
      {rows.length > 500 ? (
        <Text c="dimmed" size="xs" mt="xs">
          {t('Показано перші 500 рядків. CSV export містить усі відфільтровані рядки.')}
        </Text>
      ) : null}
    </Box>
  )
}

async function parseSpreadsheetFile(file: File): Promise<SpreadsheetSheet[]> {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension === 'xlsx') {
    const workbook = await readXlsxFile(file)

    return workbook.reduce<SpreadsheetSheet[]>((acc, sheet) => {
      const built = buildSpreadsheetSheet(
        sheet.sheet,
        sheet.data.map((row) => row.map(normalizeImportedCellValue)),
      )
      if (built.rows.length > 0 || built.columns.length > 0) {
        acc.push(built)
      }
      return acc
    }, [])
  }

  if (extension === 'xls') {
    const { read, utils } = await import('xlsx')
    const workbook = read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })

    return workbook.SheetNames.reduce<SpreadsheetSheet[]>((acc, sheetName) => {
      const worksheet = workbook.Sheets[sheetName]
      const rows = utils
        .sheet_to_json<unknown[]>(worksheet, { blankrows: false, header: 1 })
        .map((row) => (Array.isArray(row) ? row.map(normalizeImportedCellValue) : []))

      const built = buildSpreadsheetSheet(sheetName, rows)
      if (built.rows.length > 0 || built.columns.length > 0) {
        acc.push(built)
      }
      return acc
    }, [])
  }

  const text = await file.text()
  const delimiter = detectDelimiter(text)
  const rows = parseDelimitedText(text, delimiter)

  return [buildSpreadsheetSheet(file.name, rows)]
}

function formatSpreadsheetCell(value: SpreadsheetCellValue): string {
  return isFilledCell(value) ? displayValue(value) : ''
}

function getSpreadsheetRowKey(row: SpreadsheetCellValue[]): string {
  return row.map((cell) => String(cell ?? '')).join('|') || 'empty-row'
}
