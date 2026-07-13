import type { PackingList, SupplyInvoiceDeliveryDocument } from './types'

export type PackListMetadataSavePlan = {
  metadataDraft: PackingList
  pendingDocuments: SupplyInvoiceDeliveryDocument[]
}

export function createPackListMetadataSavePlan(draft: PackingList): PackListMetadataSavePlan {
  const documents = draft.InvoiceDocuments || []

  return {
    metadataDraft: {
      ...draft,
      InvoiceDocuments: documents.filter((document) => Boolean(document.Id)),
    },
    pendingDocuments: documents.filter((document) => !document.Id && !document.Deleted),
  }
}
