export type ProductMovementHistoryRequestPaths = {
  movement: string
  income: string
  outcome: string
  historicalSource: string
  informational: string
  movementExport: string
  incomeExport: string
  outcomeExport: string
}

export const legacyMovementRequestPaths: ProductMovementHistoryRequestPaths = {
  movement: '/consignments/info/movement/filtered',
  income: '/consignments/info/income/filtered',
  outcome: '/consignments/info/outcome/filtered',
  historicalSource: '/consignments/info/movement/historical-source/filtered',
  informational: '/consignments/info/movement/informational/filtered',
  movementExport: '/consignments/info/movement/document/export',
  incomeExport: '/consignments/info/income/document/export',
  outcomeExport: '/consignments/info/outcome/document/export',
}

export const assortmentMovementRequestPaths: ProductMovementHistoryRequestPaths = {
  movement: '/consignments/info/assortment/movement/filtered',
  income: '/consignments/info/assortment/income/filtered',
  outcome: '/consignments/info/assortment/outcome/filtered',
  historicalSource: '/consignments/info/assortment/movement/historical-source/filtered',
  informational: '/consignments/info/assortment/movement/informational/filtered',
  movementExport: '/consignments/info/assortment/movement/document/export',
  incomeExport: '/consignments/info/assortment/income/document/export',
  outcomeExport: '/consignments/info/assortment/outcome/document/export',
}
