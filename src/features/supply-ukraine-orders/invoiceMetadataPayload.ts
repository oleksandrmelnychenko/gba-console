import type {
  SupplyInvoice,
  SupplyInvoiceDeliveryDocument,
} from './types'

type NumberFieldValue = number | ''

export type InvoiceMetadataForm = {
  dateFrom: string
  deliveryAmount: NumberFieldValue
  discountAmount: NumberFieldValue
  documents: SupplyInvoiceDeliveryDocument[]
  files: File[]
  number: string
}

export function createInvoiceMetadataPayload(
  invoice: SupplyInvoice,
  form: InvoiceMetadataForm,
): SupplyInvoice {
  return {
    ...stripEntityGraph(invoice),
    DateFrom: normalizeDateTimeInput(form.dateFrom),
    DeliveryAmount: toAmountNumber(form.deliveryAmount),
    DiscountAmount: toAmountNumber(form.discountAmount),
    InformationDeliveryProtocols: invoice.InformationDeliveryProtocols || [],
    InvoiceDocuments: form.documents,
    Number: form.number.trim(),
    PackingLists: invoice.PackingLists || [],
    // Metadata edits must not re-submit the financial subgraph. The shared
    // invoice actor processes every supplied protocol as a payment-task
    // mutation, while an empty collection preserves the persisted protocols.
    PaymentDeliveryProtocols: [],
    SupplyInvoiceDeliveryDocuments: invoice.SupplyInvoiceDeliveryDocuments || [],
    SupplyInvoiceOrderItems: invoice.SupplyInvoiceOrderItems || [],
    SupplyOrder: null,
  }
}

function normalizeDateTimeInput(value: string): string {
  return value.length === 16 ? `${value}:00` : value
}

function toAmountNumber(value: NumberFieldValue): number {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0
}

function stripEntityGraph<T extends object>(entity: T): T {
  const result = { ...entity } as Record<string, unknown>

  delete result.SupplyOrder
  delete result.SupplyInvoice
  delete result.PackingList
  delete result.PackingListPackage

  return result as T
}
