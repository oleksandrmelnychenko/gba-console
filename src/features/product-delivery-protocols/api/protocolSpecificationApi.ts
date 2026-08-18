import { apiRequest } from '../../../shared/api/apiClient'
import { normalizeExportDocument } from '../../../shared/documents/exportDocument'
import type {
  ProductSpecificationParseConfiguration,
  ProductSpecificationEntity,
  SpecificationDownloadDocument,
  SpecificationPackingList,
  SpecificationProtocol,
  SpecificationSupplyInvoice,
  UploadProductSpecificationResult,
} from '../specificationTypes'

function normalizeProtocol(result: unknown): SpecificationProtocol | null {
  if (result && typeof result === 'object') {
    return result as SpecificationProtocol
  }

  return null
}

function normalizePackingList(result: unknown): SpecificationPackingList | null {
  if (result && typeof result === 'object') {
    return result as SpecificationPackingList
  }

  return null
}

export async function getPackingListSpecificationProducts(
  packListNetId: string,
): Promise<SpecificationPackingList | null> {
  const result = await apiRequest<unknown>('/supplies/packinglists/product-delivery-protocol/specification/products/get', {
    query: { netId: packListNetId },
  })

  return normalizePackingList(result)
}

export async function getSpecificationDownloadUrls(packListNetId: string): Promise<SpecificationDownloadDocument> {
  const result = await apiRequest<unknown>('/supplies/packinglists/product-delivery-protocol/specification/get', {
    query: { netId: packListNetId },
  })

  // Use the shared normalizer so the PDF download link surfaces whether the
  // backend returns it as `PdfDocumentURL` or the `PdfDocument` alias.
  return normalizeExportDocument(result)
}

export async function uploadProductSpecificationForInvoice(
  invoiceNetId: string,
  parseConfiguration: ProductSpecificationParseConfiguration,
  dateCustomDeclaration: string,
  file: File,
): Promise<UploadProductSpecificationResult | null> {
  const formData = new FormData()
  formData.append('parseConfiguration', JSON.stringify(parseConfiguration))
  formData.append('dateCustomDeclaration', dateCustomDeclaration)
  formData.append('file', file)

  const result = await apiRequest<unknown>('/supplies/invoices/product-delivery-protocol/specification/upload', {
    method: 'POST',
    body: formData,
    query: { invoiceNetId },
  })

  if (result && typeof result === 'object') {
    return result as UploadProductSpecificationResult
  }

  return null
}

export async function addDeliveryDocumentsToInvoice(
  invoice: SpecificationSupplyInvoice,
  documents: File[],
): Promise<SpecificationProtocol | null> {
  const formData = new FormData()
  formData.append('invoice', JSON.stringify(invoice))

  for (const document of documents) {
    formData.append('documents', document)
  }

  const result = await apiRequest<unknown>('/supplies/invoices/product-delivery-protocol/documents/add', {
    method: 'POST',
    body: formData,
  })

  return normalizeProtocol(result)
}

export async function addOrUpdateProductSpecification(
  supplyInvoiceNetId: string,
  body: Partial<ProductSpecificationEntity>,
): Promise<ProductSpecificationEntity | null> {
  const result = await apiRequest<unknown>('/specifications/product-delivery-protocol/update', {
    method: 'POST',
    query: { supplyInvoiceNetId },
    body,
  })

  if (result && typeof result === 'object') {
    return result as ProductSpecificationEntity
  }

  return null
}

export async function mergeSupplyInvoices(
  protocolNetId: string,
  invoiceNetIds: string[],
): Promise<void> {
  await apiRequest<unknown>('/delivery/product/protocol/specification/merge/supply/invoices', {
    method: 'POST',
    query: { invoiceNetIds, netId: protocolNetId },
  })
}
