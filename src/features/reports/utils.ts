import { translate } from '../../shared/i18n/translate'
import type {
  ReportDocument,
  ReportEntity,
  ReportResult,
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

export function normalizeReportResult(result: unknown): ReportResult {
  return {
    document: normalizeDocument(result),
    raw: result,
  }
}

function normalizeDocument(result: unknown): ReportDocument {
  const payload = unwrapSingleObject(result)

  if (!payload) {
    return {}
  }

  return {
    DocumentURL: typeof payload.DocumentURL === 'string' ? payload.DocumentURL : '',
    PdfDocumentURL: typeof payload.PdfDocumentURL === 'string' ? payload.PdfDocumentURL : '',
  }
}

function unwrapSingleObject(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return null
  }

  return result as Record<string, unknown>
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
