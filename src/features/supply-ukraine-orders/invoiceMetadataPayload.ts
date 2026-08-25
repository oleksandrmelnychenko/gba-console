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
    ...createInvoiceMutationSnapshot(invoice),
    DateFrom: normalizeDateTimeInput(form.dateFrom),
    DeliveryAmount: toAmountNumber(form.deliveryAmount),
    DiscountAmount: toAmountNumber(form.discountAmount),
    InformationDeliveryProtocols: invoice.InformationDeliveryProtocols || [],
    InvoiceDocuments: form.documents,
    Number: form.number.trim(),
  }
}

/** Actor-safe full invoice snapshot for the inline discount editor. */
export function createInvoiceDiscountPayload(
  invoice: SupplyInvoice,
  discountAmount: NumberFieldValue,
): SupplyInvoice {
  return {
    ...createInvoiceMutationSnapshot(invoice),
    DiscountAmount: toAmountNumber(discountAmount),
  }
}

/**
 * The invoice actor expects collection properties to be present, but treats
 * supplied protocols as mutations. Preserve the entity snapshot while keeping
 * protocol collections empty unless a dedicated editor explicitly overrides one.
 */
function createInvoiceMutationSnapshot(invoice: SupplyInvoice): SupplyInvoice {
  return {
    ...stripEntityGraph(invoice),
    InformationDeliveryProtocols: [],
    InvoiceDocuments: invoice.InvoiceDocuments || [],
    PackingLists: invoice.PackingLists || [],
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
