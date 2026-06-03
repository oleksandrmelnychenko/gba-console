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
import {
  IconAlertCircle,
  IconDownload,
  IconPrinter,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconUpload,
} from '@tabler/icons-react'
import { type ChangeEvent, type ReactNode, useMemo } from 'react'
import readXlsxFile from 'read-excel-file/browser'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import type { SpreadsheetCellValue, SpreadsheetSheet } from '../types'
import {
  buildDateFileSuffix,
  buildSpreadsheetCsv,
  displayValue,
  downloadTextFile,
  parseNumericValue,
} from '../utils'

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
    <Stack gap="lg">
      <Group justify="flex-end" align="center">
        <Badge color={activeSheet ? 'gray' : 'violet'} variant="light">
          {isLoading ? t('Читання файлу') : activeSheet ? `${t('Рядків')}: ${visibleRows.length}` : t('Файл не вибрано')}
        </Badge>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
            <Button component="label" leftSection={<IconUpload size={16} />} loading={isLoading}>
              {t('Завантажити файл')}
              <input
                accept=".csv,.tsv,.txt,.xlsx,.xls"
                aria-label={t('Завантажити файл')}
                hidden
                type="file"
                onChange={handleFileChange}
              />
            </Button>
            {fileName ? <Text size="sm" c="dimmed">{fileName}</Text> : null}
            <Tooltip label={t('Експорт CSV')}>
              <ActionIcon aria-label={t('Експорт CSV')} disabled={!activeSheet} variant="subtle" onClick={exportCsv}>
                <IconDownload size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Друк')}>
              <ActionIcon aria-label={t('Друк')} disabled={!activeSheet} variant="subtle" onClick={() => window.print()}>
                <IconPrinter size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
            <TextInput
              leftSection={<IconSearch size={16} />}
              label={t('Пошук')}
              placeholder={t('Текст у будь-якій колонці')}
              value={searchDraft}
              onChange={(event) => updateSearch(event.currentTarget.value)}
            />
            <TextInput label={t('Дата з')} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.currentTarget.value)} />
            <TextInput label={t('Дата по')} type="date" value={dateTo} onChange={(event) => setDateTo(event.currentTarget.value)} />
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" variant="subtle" onClick={resetFilters}>
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Очистити файл')}>
              <ActionIcon
                aria-label={t('Очистити файл')}
                color="gray"
                variant="subtle"
                onClick={() => {
                  setSheets([])
                  setActiveSheetName(null)
                  setFileName('')
                  resetFilters()
                }}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Stack>
      </Card>

      {error ? <Alert color="red" icon={<IconAlertCircle size={18} />}>{error}</Alert> : null}

      {activeSheet ? (
        <Card withBorder radius="md" padding="md">
          <div>
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

            <Stack gap="md" pt="md">
              <TotalsBar totals={visibleTotals} />
              <SpreadsheetTable columns={activeSheet.columns} rows={visibleRows} totals={visibleTotals} />
            </Stack>
          </div>
        </Card>
      ) : (
        <Card withBorder radius="md" padding="xl">
          <Text c="dimmed" ta="center">{t('Завантажте CSV/TSV/TXT файл для перегляду')}</Text>
        </Card>
      )}
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
}: {
  columns: string[]
  rows: SpreadsheetCellValue[][]
  totals: Record<string, number>
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
    <Box>
      <DataTable
        columns={previewColumns}
        data={previewData}
        emptyText={t('Немає рядків для перегляду')}
        getRowId={(row) => row.key}
        layoutVersion={`reports-sale-spreadsheet:${columns.join('|')}`}
        maxHeight="calc(100vh - 320px)"
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

    return workbook
      .map((sheet) =>
        buildSpreadsheetSheet(sheet.sheet, sheet.data.map((row) => row.map(normalizeImportedCellValue))),
      )
      .filter((sheet) => sheet.dataRows.length > 0 || sheet.columns.length > 0)
  }

  if (extension === 'xls') {
    const { read, utils } = await import('xlsx')
    const workbook = read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })

    return workbook.SheetNames.map((sheetName) => {
      const worksheet = workbook.Sheets[sheetName]
      const rows = utils
        .sheet_to_json<unknown[]>(worksheet, { blankrows: false, header: 1 })
        .map((row) => (Array.isArray(row) ? row.map(normalizeImportedCellValue) : []))

      return buildSpreadsheetSheet(sheetName, rows)
    }).filter((sheet) => sheet.dataRows.length > 0 || sheet.columns.length > 0)
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
