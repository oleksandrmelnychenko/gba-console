import { apiRequest } from '../../../shared/api/apiClient'
import type { RegisterInvoicesResponse, Sale, WarehouseUkraineExportDocument } from '../types'
import { normalizeExportDocument, readArrayPayload, readNumber } from './salesApi'

export type InvoiceRegisterSearchParams = {
  value: string
  date: string
  limit: number
  offset: number
}

function buildDayBounds(date: string): { from: Date; to: Date } {
  const [year = NaN, month = NaN, day = NaN] = date.split('-').map(Number)
  const isDateInputValue = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
  const from = isDateInputValue ? new Date(year, month - 1, day) : new Date(date)
  from.setHours(0, 0, 0, 0)

  const to = isDateInputValue ? new Date(year, month - 1, day) : new Date(date)
  to.setHours(23, 59, 59, 999)

  return { from, to }
}

export async function getInvoiceRegister(
  params: InvoiceRegisterSearchParams,
): Promise<RegisterInvoicesResponse> {
  const { from, to } = buildDayBounds(params.date)

  const result = await apiRequest<unknown>('/sales/get/register/invoice', {
    query: {
      value: params.value.trim(),
      limit: params.limit,
      offset: params.offset,
      to,
      from,
    },
  })

  return normalizeRegisterResponse(result)
}

export async function getInvoiceRegisterPrintDocument(
  params: InvoiceRegisterSearchParams,
): Promise<WarehouseUkraineExportDocument> {
  const { from, to } = buildDayBounds(params.date)

  const result = await apiRequest<unknown>('/sales/get/register/invoice/document', {
    query: {
      value: params.value.trim(),
      limit: params.limit,
      offset: params.offset,
      to,
      from,
    },
  })

  return normalizeExportDocument(result)
}

function normalizeRegisterResponse(result: unknown): RegisterInvoicesResponse {
  const items = readArrayPayload(result, ['Items', 'Sales_RegisterInvoice', 'Sales', 'Data']) as Sale[]
  const payload = result && typeof result === 'object' ? (result as Record<string, unknown>) : {}
  const totalQty =
    readNumber(payload.TotalRowsQty) ??
    readNumber(payload.Total) ??
    readNumber(items[0]?.TotalRowsQty) ??
    items.length

  return { items, totalQty }
}
