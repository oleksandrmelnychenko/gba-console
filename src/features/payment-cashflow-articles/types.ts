export type PaymentCashflowArticle = {
  Id?: number
  NetUid?: string
  NetUidSimple?: string
  OperationName?: string
  PaymentMovementOperations?: unknown[]
  [key: string]: unknown
}

export type PaymentCashflowArticlePayload = {
  NetUid?: string
  OperationName: string
}
