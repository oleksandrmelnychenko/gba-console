import { translate } from '../../shared/i18n/translate'
import type {
  ReportCellValue,
  ReportDocument,
  ReportEntity,
  ReportResult,
  ReportResultRow,
  ReportResultTable,
  SpreadsheetCellValue,
} from './types'

const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const numberFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
})

export function displayValue(value: ReportCellValue): string {
  if (typeof value === 'boolean') {
    return value ? translate('Так') : translate('Ні')
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? numberFormatter.format(value) : '-'
  }

  if (typeof value === 'string') {
    return value.trim() || '-'
  }

  return '-'
}

export function getEntityDisplayName(entity?: ReportEntity | null): string {
  if (!entity) {
    return translate('Без назви')
  }

  const nestedName = readNestedName(entity)
  const rawName =
    entity.Name
    || entity.FullName
    || entity.Value
    || entity.Code
    || nestedName
    || entity.NetUid
    || entity.Id

  return typeof rawName === 'number' ? String(rawName) : String(rawName || translate('Без назви'))
}

export function getEntityId(entity: ReportEntity, fallback: string): string {
  return String(entity.NetUid || entity.Id || fallback)
}

export function formatDate(value?: Date | string | null): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return dateFormatter.format(date)
}

export function formatDateTime(value?: Date | string | null): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return dateTimeFormatter.format(date)
}

export function parseNumericValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .replace(/\s/g, '')
    .replace(',', '.')
    .trim()

  if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null
  }

  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeReportResult(result: unknown): ReportResult {
  const document = normalizeDocument(result)
  const table = normalizeResultTable(result)

  return {
    document,
    raw: result,
    table,
    totals: calculateResultTotals(table),
  }
}

export function normalizeDocument(result: unknown): ReportDocument {
  const payload = unwrapSingleObject(result)

  if (!payload) {
    return {}
  }

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL: typeof payload.PdfDocumentURL === 'string' ? payload.PdfDocumentURL : '',
  }
}

export function normalizeResultTable(result: unknown): ReportResultTable {
  const rows = findRows(result)
  const columns = findColumns(result, rows)

  return {
    columns,
    rows,
  }
}

export function calculateResultTotals(table: ReportResultTable): Record<string, number> {
  return table.columns.reduce<Record<string, number>>((totals, column) => {
    const values = table.rows
      .map((row) => parseNumericValue(row[column]))
      .filter((value): value is number => typeof value === 'number')

    if (values.length > 0) {
      totals[column] = values.reduce((sum, value) => sum + value, 0)
    }

    return totals
  }, {})
}

export function buildCsv(columns: string[], rows: Array<Record<string, unknown>>): string {
  return [
    columns.map(escapeCsvValue).join(','),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(',')),
  ].join('\n')
}

export function buildSpreadsheetCsv(rows: SpreadsheetCellValue[][]): string {
  return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n')
}

export function downloadTextFile(fileName: string, content: string, mimeType = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export function buildDateFileSuffix(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}${month}${day}-${hours}${minutes}`
}

function unwrapSingleObject(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return null
  }

  return result as Record<string, unknown>
}

function findRows(result: unknown): ReportResultRow[] {
  if (Array.isArray(result)) {
    return normalizeRowArray(result)
  }

  if (!result || typeof result !== 'object') {
    return []
  }

  const payload = result as Record<string, unknown>
  const candidates = [
    payload.Rows,
    payload.rows,
    payload.Items,
    payload.items,
    payload.Collection,
    payload.collection,
    payload.Data,
    payload.data,
    payload.Result,
    payload.result,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return normalizeRowArray(candidate)
    }
  }

  return []
}

function findColumns(result: unknown, rows: ReportResultRow[]): string[] {
  const explicitColumns = readExplicitColumns(result)

  if (explicitColumns.length > 0) {
    return explicitColumns
  }

  const columnSet = new Set<string>()

  rows.forEach((row) => {
    Object.keys(row).forEach((column) => columnSet.add(column))
  })

  return Array.from(columnSet)
}

function readExplicitColumns(result: unknown): string[] {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return []
  }

  const payload = result as Record<string, unknown>
  const candidates = [payload.Columns, payload.columns, payload.Headers, payload.headers]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
        .map((item) => {
          if (typeof item === 'string') {
            return item
          }

          if (item && typeof item === 'object') {
            const column = item as Record<string, unknown>
            const value = column.key || column.field || column.name || column.title || column.label

            return typeof value === 'string' ? value : ''
          }

          return ''
        })
        .filter(Boolean)
    }
  }

  return []
}

function normalizeRowArray(rows: unknown[]): ReportResultRow[] {
  return rows
    .map((row) => {
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        return row as ReportResultRow
      }

      if (Array.isArray(row)) {
        return row.reduce<ReportResultRow>((record, value, index) => {
          record[`C${index + 1}`] = value as ReportCellValue
          return record
        }, {})
      }

      return null
    })
    .filter((row): row is ReportResultRow => Boolean(row))
}

function escapeCsvValue(value: unknown): string {
  const text = typeof value === 'undefined' || value === null ? '' : String(value)

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function readNestedName(entity: ReportEntity): string | number | undefined {
  const agreement = entity.Agreement
  const client = entity.Client
  const saleNumber = entity.SaleNumber

  if (agreement && typeof agreement === 'object' && 'Name' in agreement) {
    const name = (agreement as { Name?: unknown }).Name

    if (typeof name === 'string' || typeof name === 'number') {
      return name
    }
  }

  if (client && typeof client === 'object' && 'FullName' in client) {
    const fullName = (client as { FullName?: unknown }).FullName

    if (typeof fullName === 'string') {
      return fullName
    }
  }

  if (saleNumber && typeof saleNumber === 'object' && 'Value' in saleNumber) {
    const value = (saleNumber as { Value?: unknown }).Value

    if (typeof value === 'string' || typeof value === 'number') {
      return value
    }
  }

  return undefined
}
