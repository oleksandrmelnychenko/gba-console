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
import type { SpreadsheetCellValue, SpreadsheetSheet } from '../types'
import {
  buildDateFileSuffix,
  buildSpreadsheetCsv,
  displayValue,
  downloadTextFile,
  parseNumericValue,
} from '../utils'
import './reports-pages.css'

export function ReportsSalePage() {
  const { t } = useI18n()
  const [sheets, setSheets] = useValueState<SpreadsheetSheet[]>([])
  const [activeSheetName, setActiveSheetName] = useValueState<string | null>(null)
  const [fileName, setFileName] = useValueState('')
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue, setSearchValue] = useValueState('')
  const [dateFrom, setDateFrom] = useValueState('')
  const [dateTo, setDateTo] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const { density, toggleDensity } = useDataTableDensity('reports-sale-spreadsheet', 'normal')
  const activeSheet = sheets.find((sheet) => sheet.name === activeSheetName) || sheets[0] || null
  const visibleRows = useMemo(
    () => filterRows(activeSheet, searchValue, dateFrom, dateTo),
    [activeSheet, dateFrom, dateTo, searchValue],
  )
  const visibleTotals = useMemo(
    () => calculateTotals(activeSheet?.columns || [], visibleRows),
    [activeSheet?.columns, visibleRows],
  )

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
      setSearchDraft('')
      setSearchValue('')
    } catch (parseError) {
      setFileName(file.name)
      setSheets([])
      setActiveSheetName(null)
      setError(parseError instanceof Error ? parseError.message : t('Не вдалося прочитати файл'))
    } finally {
      setLoading(false)
    }
  }

  function updateSearch(nextSearchValue: string) {
    setSearchDraft(nextSearchValue)
    setSearchValue(nextSearchValue.trim())
  }

  function resetFilters() {
    setSearchDraft('')
    setSearchValue('')
    setDateFrom('')
    setDateTo('')
  }

  function exportCsv() {
    if (!activeSheet) {
      return
    }

    downloadTextFile(
      `reports-sale-${buildDateFileSuffix()}.csv`,
      buildSpreadsheetCsv([activeSheet.columns, ...visibleRows]),
    )
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
            value={searchDraft}
            onChange={(event) => updateSearch(event.currentTarget.value)}
          />
          <div className="reports-sale-meta">
            {fileName ? <Text className="reports-sale-file-name" size="sm">{fileName}</Text> : null}
            <Badge className={activeSheet ? 'app-role-pill is-gray' : 'app-role-pill is-orange'} variant="light">
              {isLoading ? t('Читання файлу') : activeSheet ? `${t('Рядків')}: ${visibleRows.length}` : t('Файл не вибрано')}
            </Badge>
          </div>
          <div className="app-filter-actions reports-sale-actions">
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={resetFilters}>
                <RotateCcw size={17} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Експорт CSV')}>
              <ActionIcon aria-label={t('Експорт CSV')} color="gray" disabled={!activeSheet} size={34} variant="light" onClick={exportCsv}>
                <Download size={17} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Друк')}>
              <ActionIcon aria-label={t('Друк')} color="gray" disabled={!activeSheet} size={34} variant="light" onClick={() => window.print()}>
                <Printer size={17} />
              </ActionIcon>
            </Tooltip>
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
              <div className="pill-tabs" style={{ width: 'fit-content' }}>
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
                <TotalsBar totals={visibleTotals} />
                <SpreadsheetTable columns={activeSheet.columns} rows={visibleRows} totals={visibleTotals} density={density} />
              </Stack>
            </div>
          ) : (
            <div className="reports-sale-empty-state">
              <Text c="dimmed" ta="center">{t('Завантажте CSV/TSV/TXT файл для перегляду')}</Text>
            </div>
          )}
        </div>
      </Card>
    </Stack>
  )
}

function TotalsBar({ totals }: { totals: Record<string, number> }) {
  const totalEntries = Object.entries(totals).slice(0, 8)

  if (!totalEntries.length) {
    return null
  }

  return (
    <Group gap="xs">
      {totalEntries.map(([column, total]) => (
        <Badge key={column} color="gray" variant="light">
          {column}: {displayValue(total)}
        </Badge>
      ))}
    </Group>
  )
}

type SpreadsheetPreviewRow = {
  key: string
  cells: SpreadsheetCellValue[]
  isTotals: boolean
}

function SpreadsheetTable({
  columns,
  rows,
  totals,
  density,
}: {
  columns: string[]
  rows: SpreadsheetCellValue[][]
  totals: Record<string, number>
  density: DataTableDensity
}) {
  const { t } = useI18n()
  const hasTotals = Object.keys(totals).length > 0

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
            if (row.isTotals) {
              return (
                <Text component="span" fw={600}>
                  {columnIndex === 0 ? t('Разом') : displayValue(totals[column])}
                </Text>
              )
            }

            return displayValue(row.cells[columnIndex])
          },
        }
      }),
    [columns, t, totals],
  )

  const previewData = useMemo<SpreadsheetPreviewRow[]>(() => {
    const dataRows: SpreadsheetPreviewRow[] = rows.slice(0, 500).map((row, index) => ({
      key: `${getSpreadsheetRowKey(row)}-${index}`,
      cells: row,
      isTotals: false,
    }))

    if (hasTotals) {
      dataRows.push({ key: '__totals__', cells: [], isTotals: true })
    }

    return dataRows
  }, [hasTotals, rows])

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
      if (built.dataRows.length > 0 || built.columns.length > 0) {
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
      if (built.dataRows.length > 0 || built.columns.length > 0) {
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

function buildSpreadsheetSheet(name: string, rows: SpreadsheetCellValue[][]): SpreadsheetSheet {
  const firstDataRowIndex = rows.findIndex((row) => row.some((cell) => String(cell || '').trim()))

  if (firstDataRowIndex === -1) {
    return { name, columns: [], dataRows: [], rows: [], totals: {} }
  }

  const columns = rows[firstDataRowIndex].map((cell, index) => String(cell || `C${index + 1}`))
  const dataRows = rows.slice(firstDataRowIndex + 1)

  return {
    name,
    columns,
    dataRows,
    rows,
    totals: calculateTotals(columns, dataRows),
  }
}

function detectDelimiter(text: string): ',' | '\t' | ';' {
  const sample = text.split(/\r?\n/, 1)[0] || ''
  const candidates: Array<',' | '\t' | ';'> = [',', '\t', ';']

  return candidates.reduce((best, delimiter) =>
    countOccurrences(sample, delimiter) > countOccurrences(sample, best) ? delimiter : best,
  )
}

function parseDelimitedText(text: string, delimiter: string): SpreadsheetCellValue[][] {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => parseDelimitedLine(line, delimiter).map(normalizeCellValue))
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const nextChar = line[index + 1]

    if (char === '"' && quoted && nextChar === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === delimiter && !quoted) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }

  cells.push(current)

  return cells
}

function normalizeCellValue(value: string): SpreadsheetCellValue {
  const numericValue = parseNumericValue(value)

  if (numericValue !== null) {
    return numericValue
  }

  return value.trim()
}

function normalizeImportedCellValue(value: unknown): SpreadsheetCellValue {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string' || value === null) {
    return value
  }

  return String(value || '').trim()
}

function filterRows(
  sheet: SpreadsheetSheet | null,
  searchValue: string,
  dateFrom: string,
  dateTo: string,
): SpreadsheetCellValue[][] {
  if (!sheet) {
    return []
  }

  const normalizedSearch = searchValue.trim().toLowerCase()

  return sheet.dataRows.filter((row) => {
    const matchesSearch = normalizedSearch
      ? row.some((cell) => String(cell || '').toLowerCase().includes(normalizedSearch))
      : true
    const rowDate = extractRowDate(row)
    const matchesDateFrom = dateFrom && rowDate ? rowDate >= dateFrom : true
    const matchesDateTo = dateTo && rowDate ? rowDate <= dateTo : true

    return matchesSearch && matchesDateFrom && matchesDateTo
  })
}

function calculateTotals(columns: string[], rows: SpreadsheetCellValue[][]): Record<string, number> {
  return columns.reduce<Record<string, number>>((totals, column, columnIndex) => {
    const values = rows
      .map((row) => (typeof row[columnIndex] === 'number' ? row[columnIndex] : parseNumericValue(row[columnIndex])))
      .filter((value): value is number => typeof value === 'number')

    if (values.length > 0) {
      totals[column] = values.reduce((sum, value) => sum + value, 0)
    }

    return totals
  }, {})
}

function extractRowDate(row: SpreadsheetCellValue[]): string | null {
  for (const cell of row) {
    const value = String(cell || '').trim()
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    const localMatch = value.match(/^(\d{2})\.(\d{2})\.(\d{4})/)

    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
    }

    if (localMatch) {
      return `${localMatch[3]}-${localMatch[2]}-${localMatch[1]}`
    }
  }

  return null
}

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1
}

function getSpreadsheetRowKey(row: SpreadsheetCellValue[]): string {
  return row.map((cell) => String(cell ?? '')).join('|') || 'empty-row'
}
