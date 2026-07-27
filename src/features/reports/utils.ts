import { translate } from '../../shared/i18n/translate'
import type {
  ReportCellValue,
  ReportDocument,
  ReportEntity,
  ReportResult,
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
  return {
    document: normalizeDocument(result),
    raw: result,
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

// The engine names every file it builds «Reports_MM.yyyy_<guid>.xlsx», so a folder of exports says nothing about
// what is in them. The console's own export carries the run instead — the file it was read from, the sheet, the
// date — so a second export does not overwrite the first and the name survives the download folder.
export function buildReportFileName(parts: Array<string | null | undefined>, extension: string): string {
  const name = parts.map(toFileNamePart).filter(Boolean).join('_')

  return `${name || 'report'}.${extension}`
}

function toFileNamePart(value?: string | null): string {
  return (value || '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
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
