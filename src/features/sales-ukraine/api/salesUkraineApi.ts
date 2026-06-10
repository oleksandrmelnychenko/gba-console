import { apiRequest } from '../../../shared/api/apiClient'
import type {
  SaleClientDebtTotal,
  SaleConsignmentDocument,
  SaleConsignmentNoteSetting,
  SaleDocumentResult,
  SalesUkraineClientAgreement,
  SalesUkraineClientOption,
  SalesUkraineFilters,
  SalesUkraineOrderItem,
  SalesUkraineOrganizationOption,
  SalesUkraineProduct,
  SalesUkraineRetailPaymentStatus,
  SalesUkraineSale,
  SalesUkraineTransporter,
  SalesUkraineTransporterType,
} from '../types'

const CONSIGNMENT_QUERY = { forReSale: false }

export async function getSalesUkraine(filters: SalesUkraineFilters): Promise<SalesUkraineSale[]> {
  const result = await apiRequest<unknown>('/sales/all/filtered', {
    query: {
      clientId: filters.clientId || undefined,
      fastEcommerce: false,
      forEcommerce: filters.forEcommerce,
      from: filters.from,
      fromShipments: false,
      limit: filters.limit,
      offset: filters.offset,
      organisationIds: filters.organisationIds.length ? filters.organisationIds : undefined,
      status: filters.status === 'all' ? 'All' : filters.status,
      to: filters.to,
      type: filters.type,
      value: filters.value.trim() || undefined,
    },
  })

  return normalizeArray(result) as SalesUkraineSale[]
}

export async function getSalesUkraineOrganizations(): Promise<SalesUkraineOrganizationOption[]> {
  const result = await apiRequest<unknown>('/organizations/all')

  return normalizeArray(result) as SalesUkraineOrganizationOption[]
}

export async function searchSalesUkraineClients(value: string): Promise<SalesUkraineClientOption[]> {
  const result = await apiRequest<unknown>('/search/by/query', {
    query: {
      filter: JSON.stringify({
        Table: 'Client',
        Offset: 0,
        Limit: 50,
        BooleanFilter: '',
        TypeRoleFilter: '',
        SortDescriptors: [],
        Filter: JSON.stringify({
          Value: value.trim(),
          FilterItem: {
            Name: '',
            SQL: 'RegionCode.Value/Client.FullName',
            Description: '',
            Type: 0,
            FilterOperationItem: {
              Name: '',
              SQL: 'Contains',
            },
          },
        }),
      }),
    },
  })

  return normalizeArray(result) as SalesUkraineClientOption[]
}

export async function unlockSale(netId: string): Promise<void> {
  await apiRequest<unknown>('/sales/unlock', {
    method: 'PATCH',
    query: { netId },
  })
}

export async function getSaleById(netId: string): Promise<SalesUkraineSale | null> {
  const result = await apiRequest<unknown>('/sales/get', {
    query: { netId },
  })

  return result && typeof result === 'object' ? (result as SalesUkraineSale) : null
}

export async function getShiftedSaleById(netId: string): Promise<SalesUkraineSale | null> {
  const result = await apiRequest<unknown>('/sales/get/shifted', {
    query: { netId },
  })

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return null
  }

  const sale = (result as { Sale?: unknown }).Sale

  if (sale && typeof sale === 'object' && !Array.isArray(sale)) {
    return sale as SalesUkraineSale
  }

  return result as SalesUkraineSale
}

export async function getCurrentSaleCart(clientAgreementNetId: string): Promise<SalesUkraineSale | null> {
  const result = await apiRequest<unknown>('/sales/get/current', {
    query: { netId: clientAgreementNetId },
  })

  return result && typeof result === 'object' ? (result as SalesUkraineSale) : null
}

export async function createSale(sale: SalesUkraineSale): Promise<SalesUkraineSale | null> {
  const result = await apiRequest<unknown>('/sales/new', {
    body: sale,
    method: 'POST',
  })

  return result && typeof result === 'object' ? (result as SalesUkraineSale) : null
}

export async function updateOrderItem(orderItem: SalesUkraineOrderItem): Promise<void> {
  await apiRequest<unknown>('/orders/items/update', {
    body: orderItem,
    method: 'POST',
  })
}

export async function deleteOrderItem(orderItemNetId: string): Promise<void> {
  await apiRequest<unknown>('/orders/items/delete', {
    method: 'DELETE',
    query: { orderItemNetId },
  })
}

export async function searchSaleProducts(value: string): Promise<SalesUkraineProduct[]> {
  const result = await apiRequest<unknown>('/products/search/vendorcode', {
    query: { limit: 20, offset: 0, value: value.trim() },
  })

  return normalizeArray(result) as SalesUkraineProduct[]
}

export async function addOrderItem(
  clientAgreementNetId: string,
  saleNetId: string,
  orderItem: SalesUkraineOrderItem,
): Promise<void> {
  await apiRequest<unknown>('/orders/items/new', {
    body: orderItem,
    method: 'POST',
    query: { clientAgreementNetId, saleNetId },
  })
}

export async function getSaleClientAgreements(clientNetId: string): Promise<SalesUkraineClientAgreement[]> {
  const result = await apiRequest<unknown>('/agreements/client/all', {
    query: { netId: clientNetId },
  })

  return normalizeArray(result) as SalesUkraineClientAgreement[]
}

export async function getSaleClientDebtTotal(clientNetId: string): Promise<SaleClientDebtTotal | null> {
  const result = await apiRequest<unknown>('/clients/get/debt/total', {
    query: { netId: clientNetId },
  })

  return result && typeof result === 'object' ? (result as SaleClientDebtTotal) : null
}

export async function getRetailPaymentStatusBySaleId(saleId: number): Promise<SalesUkraineRetailPaymentStatus | null> {
  const result = await apiRequest<unknown>('/retail/clients/paid/amount', {
    query: { saleId },
  })

  return result && typeof result === 'object' ? (result as SalesUkraineRetailPaymentStatus) : null
}

export async function switchSale(saleNetId: string, clientAgreementNetId: string): Promise<void> {
  await apiRequest<unknown>('/sales/switch', {
    method: 'PATCH',
    query: { clientAgreementNetId, saleNetId },
  })
}

export async function getMergedSales(saleNetId: string): Promise<SalesUkraineSale | null> {
  const result = await apiRequest<unknown>('/sales/get/merged', {
    query: { netId: saleNetId },
  })

  return result && typeof result === 'object' ? (result as SalesUkraineSale) : null
}

export async function getCurrentUnmergedSale(clientAgreementNetId: string): Promise<SalesUkraineSale | null> {
  const result = await apiRequest<unknown>('/sales/get/current/unmerged', {
    query: { netId: clientAgreementNetId },
  })

  return result && typeof result === 'object' ? (result as SalesUkraineSale) : null
}

export async function updateMergedSale(sale: SalesUkraineSale): Promise<void> {
  await apiRequest<unknown>('/sales/update/merged', {
    body: sale,
    method: 'POST',
  })
}

export async function updateSale(sale: SalesUkraineSale): Promise<void> {
  await apiRequest<unknown>('/sales/update', {
    body: sale,
    method: 'POST',
  })
}

export async function updateSaleDiscount(sale: SalesUkraineSale): Promise<void> {
  await apiRequest<unknown>('/sales/discount/update', {
    body: sale,
    method: 'POST',
  })
}

export async function getSaleTransporterTypes(): Promise<SalesUkraineTransporterType[]> {
  const result = await apiRequest<unknown>('/transporters/types/all')

  return normalizeArray(result) as SalesUkraineTransporterType[]
}

export async function getSaleTransportersByType(netId: string): Promise<SalesUkraineTransporter[]> {
  const result = await apiRequest<unknown>('/transporters/all/type/hidden', {
    query: { netId },
  })

  return normalizeArray(result) as SalesUkraineTransporter[]
}

export async function updateSaleFromData(sale: SalesUkraineSale, file: File | null): Promise<void> {
  const formData = new FormData()
  formData.append('sale', JSON.stringify(sale))

  if (file) {
    formData.append('file', file)
  }

  await apiRequest<unknown>('/sales/update/file', {
    body: formData,
    method: 'POST',
  })
}

export async function convertVatSaleAndGetPaymentDocument(
  sale: SalesUkraineSale,
  file: File | null,
): Promise<SaleDocumentResult> {
  const formData = new FormData()
  formData.append('sale', JSON.stringify(sale))

  if (file) {
    formData.append('file', file)
  }

  const result = await apiRequest<unknown>('/sales/update/get/payment/document', {
    body: formData,
    method: 'POST',
  })

  return extractDocumentResult(result)
}

export async function shiftOrderItemsCurrent(sale: SalesUkraineSale): Promise<SalesUkraineSale | null> {
  const result = await apiRequest<unknown>('/orders/items/shift/current', {
    body: sale,
    method: 'POST',
  })

  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>
    const nested = record.Sale

    if (nested && typeof nested === 'object') {
      return nested as SalesUkraineSale
    }

    return result as SalesUkraineSale
  }

  return null
}

export async function getSaleConsignmentNoteSettings(): Promise<SaleConsignmentNoteSetting[]> {
  const result = await apiRequest<unknown>('/consignment/note/settings/all/get', {
    query: CONSIGNMENT_QUERY,
  })

  return normalizeArray(result) as SaleConsignmentNoteSetting[]
}

export async function addSaleConsignmentNoteSetting(
  setting: SaleConsignmentNoteSetting,
): Promise<SaleConsignmentNoteSetting[]> {
  const result = await apiRequest<unknown>('/consignment/note/settings/add', {
    body: setting,
    method: 'POST',
    query: CONSIGNMENT_QUERY,
  })

  return normalizeArray(result) as SaleConsignmentNoteSetting[]
}

export async function updateSaleConsignmentNoteSetting(
  setting: SaleConsignmentNoteSetting,
): Promise<SaleConsignmentNoteSetting[]> {
  const result = await apiRequest<unknown>('/consignment/note/settings/update', {
    body: setting,
    method: 'POST',
    query: CONSIGNMENT_QUERY,
  })

  return normalizeArray(result) as SaleConsignmentNoteSetting[]
}

export async function removeSaleConsignmentNoteSetting(netId: string): Promise<SaleConsignmentNoteSetting[]> {
  const result = await apiRequest<unknown>('/consignment/note/settings/remove', {
    body: {},
    method: 'POST',
    query: { ...CONSIGNMENT_QUERY, netId },
  })

  return normalizeArray(result) as SaleConsignmentNoteSetting[]
}

export async function printSaleConsignmentNoteDocument(
  saleNetId: string,
  setting: SaleConsignmentNoteSetting,
): Promise<SaleConsignmentDocument> {
  const result = await apiRequest<unknown>('/consignment/note/settings/print/document', {
    body: setting,
    method: 'POST',
    query: { ...CONSIGNMENT_QUERY, netId: saleNetId },
  })

  return (result && typeof result === 'object' ? result : {}) as SaleConsignmentDocument
}

async function fetchSaleDocument(path: string, query: Record<string, string>): Promise<SaleDocumentResult> {
  const result = await apiRequest<unknown>(path, { query })

  return extractDocumentResult(result)
}

export function getSaleInvoiceDocument(netId: string): Promise<SaleDocumentResult> {
  return fetchSaleDocument('/sales/get/last/document', { netId })
}

export function getSaleShipmentListDocument(netId: string): Promise<SaleDocumentResult> {
  return fetchSaleDocument('/sales/shipment/list/print/documents', { netId })
}

export function getSalePaymentDocument(netId: string): Promise<SaleDocumentResult> {
  return fetchSaleDocument('/sales/get/payment/document', { netId })
}

export function getSalePzDocument(netId: string): Promise<SaleDocumentResult> {
  return fetchSaleDocument('/sales/get/document/pz', { netId })
}

export function getSaleInvoiceHistoryDocument(netId: string, historyNetId: string): Promise<SaleDocumentResult> {
  return fetchSaleDocument('/sales/get/document/history', { historyNetId, netId })
}

export function getSaleActProtocolEditDocument(netId: string): Promise<SaleDocumentResult> {
  return fetchSaleDocument('/sales/get/shifted/document', { netId })
}

export function getSaleActForEditingHistoryDocument(netId: string, historyNetId: string): Promise<SaleDocumentResult> {
  return fetchSaleDocument('/sales/get/shifted/hisotry/document', { historyNetId, netId })
}

export function getSaleShipmentListHistoryDocument(netId: string, historyNetId: string): Promise<SaleDocumentResult> {
  return fetchSaleDocument('/sales/shipment/list/print/documents/history', { historyNetId, netId })
}

function extractDocumentResult(result: unknown): SaleDocumentResult {
  if (typeof result === 'string') {
    return {
      excelUrl: toSecureUrl(result.trim() || null),
      pdfUrl: null,
      invoiceExcelUrl: null,
      invoicePdfUrl: null,
      isAcceptedToPacking: false,
    }
  }

  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>
    const excel = record.DocumentURL ?? record.DocumentUrl ?? record.Url ?? record.url
    const pdf = record.PdfDocumentURL ?? record.PdfDocumentUrl
    const invoiceExcel = record.InvoiceDocumentURL ?? record.InvoiceDocumentUrl
    const invoicePdf = record.PdfInvoiceDocumentURL ?? record.PdfInvoiceDocumentUrl

    return {
      excelUrl: typeof excel === 'string' ? toSecureUrl(excel.trim() || null) : null,
      pdfUrl: typeof pdf === 'string' ? toSecureUrl(pdf.trim() || null) : null,
      invoiceExcelUrl: typeof invoiceExcel === 'string' ? toSecureUrl(invoiceExcel.trim() || null) : null,
      invoicePdfUrl: typeof invoicePdf === 'string' ? toSecureUrl(invoicePdf.trim() || null) : null,
      isAcceptedToPacking: record.IsAcceptedToPacking === true,
    }
  }

  return { excelUrl: null, pdfUrl: null, invoiceExcelUrl: null, invoicePdfUrl: null, isAcceptedToPacking: false }
}

function toSecureUrl(url: string | null): string | null {
  if (!url) {
    return null
  }

  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url
}

function normalizeArray(result: unknown): unknown[] {
  const parsed = typeof result === 'string' ? safeParse(result) : result

  if (Array.isArray(parsed)) {
    return parsed
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>

    for (const key of [
      'Items',
      'Sales',
      'Clients',
      'Organizations',
      'Organisations',
      'Transporters',
      'TransporterTypes',
      'ClientAgreements',
      'Agreements',
      'Data',
      'Collection',
    ]) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[]
      }
    }
  }

  return []
}

function safeParse(value: string): unknown {
  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  try {
    return JSON.parse(normalized) as unknown
  } catch {
    return null
  }
}
