export type PaymentExpenseArticle = {
  Id?: number
  NetUid?: string
  NetUidSimple?: string
  OperationName?: string
  PaymentCostMovementOperations?: unknown[]
  [key: string]: unknown
}

export type PaymentExpenseArticlePayload = PaymentExpenseArticle & {
  OperationName: string
}
