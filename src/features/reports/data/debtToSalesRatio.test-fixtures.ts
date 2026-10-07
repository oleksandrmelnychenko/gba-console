import {
  DEBT_TO_SALES_RATIO_COLUMNS,
  DEBT_TO_SALES_RATIO_SOURCE,
  DEBT_TO_SALES_RATIO_TITLE,
  debtToSalesRatioPeriods,
  type DebtToSalesRatioCapabilities,
  type DebtToSalesRatioReport,
} from './debtToSalesRatio'
import type { ReportCatalogueEntry } from '../types'

export function debtRatioCapability(): DebtToSalesRatioCapabilities {
  return { Version: 1, SourceIdentity: { ...DEBT_TO_SALES_RATIO_SOURCE }, Title: DEBT_TO_SALES_RATIO_TITLE,
    Executable: true, Periodicity: 'Month', PreviousMonthOffset: -1,
    Columns: DEBT_TO_SALES_RATIO_COLUMNS.map(column => ({ ...column })), Filters: [] }
}

export function debtRatioReport(month = '2026-09'): DebtToSalesRatioReport {
  const availableInput = { Available: true, RunId: '10000000-0000-4000-8000-000000000001',
    ActiveRows: 1, IncludedRows: 1, UnknownKindRows: 0, Code: 'available' }
  const values = ['0.5', '0.4', '25.00', '0.1']
  return { Version: 1, SourceIdentity: { ...DEBT_TO_SALES_RATIO_SOURCE }, Month: month,
    ...debtToSalesRatioPeriods(month), Columns: DEBT_TO_SALES_RATIO_COLUMNS.map(column => ({ ...column })),
    Cells: DEBT_TO_SALES_RATIO_COLUMNS.map((column, index) => ({ Key: column.Key, Value: values[index], Available: true })),
    Inputs: { CurrentDebt: { ...availableInput }, PreviousDebt: { ...availableInput }, CurrentSales: { ...availableInput } },
    RequestSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64),
    DocumentURL: '/files/debt-ratio.xlsx', PdfDocumentURL: '/files/debt-ratio.pdf' }
}

export function debtRatioCatalogueEntry(): ReportCatalogueEntry {
  return { Id: `custom:fenix:${DEBT_TO_SALES_RATIO_SOURCE.SourceId}`, Name: DEBT_TO_SALES_RATIO_TITLE,
    Title: DEBT_TO_SALES_RATIO_TITLE, Kind: 'indicator',
    Sources: [{ World: 'fenix', SourceId: DEBT_TO_SALES_RATIO_SOURCE.SourceId, DefinitionSha256: null, Attributes: [] }] }
}
