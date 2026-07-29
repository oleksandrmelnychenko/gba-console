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

// The engine now writes the request into the file, above the table: the period, the groupings of both axes, the
// measures, every filter that was applied — and, when a measure could not be answered, the «немає даних» line that
// says how many cells were left empty and why. That block is the only thing in a saved workbook that says which
// question it answers, so the viewer reads it, shows it, and carries it into its own export rather than skipping
// past it to the numbers.
export type SpreadsheetReportHeader = {
  columnGroupings: string[]
  // every line of the block, in file order, exactly as the file carries it
  lines: string[]
  rowGroupings: string[]
  // the lines a reader must not scroll past: a filter that was not applied, a measure with no data behind it
  warnings: string[]
}

export type SpreadsheetSheet = {
  columns: string[]
  // null for anything that is not one of our report engine's files — a plain CSV, or a workbook produced before
  // the engine started recording its request.
  header: SpreadsheetReportHeader | null
  name: string
  rows: SpreadsheetRow[]
}
