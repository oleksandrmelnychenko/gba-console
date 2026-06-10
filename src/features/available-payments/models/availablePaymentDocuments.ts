import type { AvailablePaymentDocument, AvailablePaymentTaskModel } from '../types'

export function countActiveDocuments(documents: AvailablePaymentDocument[] = []): number {
  return documents.filter((document) => !document.Deleted).length
}

export function getTaskPaymentProofDocumentCount(model: AvailablePaymentTaskModel, files: File[] = []): number {
  return countActiveDocuments(model.task.SupplyPaymentTaskDocuments) + files.length
}
