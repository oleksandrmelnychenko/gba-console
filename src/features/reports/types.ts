import type { ReactNode } from 'react'

export type ReportEntity = {
  [key: string]: unknown
  Code?: string
  FullName?: string
  Id?: number
  Name?: string
  NetUid?: string
  Value?: number | string
}

export type ReportGroupingItem = {
  key: string
  label: string
  type: number
}

export type ReportGroupingGroup = {
  categoryKey: string
  categoryLabel: string
  items: ReportGroupingItem[]
}

export type ReportMeasurementItem = {
  IsChecked: boolean
  Name: string
  Type: number
}

export type ReportMeasurementGroup = {
  IsChecked: boolean
  Name: string
  SubList: ReportMeasurementItem[]
}

export type ReportMeasurementSelection = ReportMeasurementItem & {
  parentName: string
}

export type ReportFilterCondition = {
  Name: string
  Type: number
}

export type ReportFilterField = {
  Name: string
  ParentType?: string
  Type: number
}

export type ReportSelectedValue = {
  Data: ReportEntity
  Name: string
  Value: number
}

export type ReportSelection = {
  FilterCondition: ReportFilterCondition
  IsChecked: boolean
  SelectedField: ReportFilterField
  Values: ReportSelectedValue[]
}

export type ReportFilterFieldOption = {
  label: string
  type: number
}

export type ReportFilterFieldGroup = {
  children: ReportFilterFieldOption[]
  label: string
  type: number
}

export type ReportRequestBody = {
  from: string
  selections: ReportSelection[]
  sorted: {
    Col: ReportGroupingItem[]
    Measurements: ReportMeasurementSelection[]
    Row: ReportGroupingItem[]
  }
  to: string
}

export type ReportDocument = {
  DocumentURL?: string
  PdfDocumentURL?: string
}

export type ReportCellValue = boolean | number | ReactNode | string | null | undefined

// «/report/get/all/filtered» answers with the two file links and nothing else (ReportController returns
// «new { DocumentURL, PdfDocumentURL }»), so there is no row collection to model here. The report is read
// from the file, in «Перегляд звіту з файла».
export type ReportResult = {
  document: ReportDocument
  raw: unknown
}

export type ReportSearchParams = {
  limit: number
  offset: number
  value: string
}

export type SalesReportSearchParams = ReportSearchParams & {
  clientId?: number | string
  fastEcommerce?: boolean
  forEcommerce?: boolean
  from: string
  fromShipments?: boolean
  organisationIds?: number[]
  status: string
  to: string
  type: 'All' | 'Self'
}

export type SaleReturnsReportSearchParams = ReportSearchParams & {
  from: string
  to: string
}

export type ReportTemplate = {
  Data: ReportRequestBody
  Name: string
}

export type SpreadsheetCellValue = boolean | number | string | null

// Our own report engine writes a pivot, not a table: «Підсумок: …» closes every group and «Загальний
// підсумок» closes the sheet. Those rows carry the same measures as the data rows, so a viewer has to
// tell them apart before it counts or sums anything.
export type SpreadsheetRowKind = 'data' | 'subtotal' | 'total'

export type SpreadsheetRow = {
  cells: SpreadsheetCellValue[]
  kind: SpreadsheetRowKind
}

export type SpreadsheetSheet = {
  columns: string[]
  name: string
  rows: SpreadsheetRow[]
}
