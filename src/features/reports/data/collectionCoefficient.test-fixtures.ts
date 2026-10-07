import {
  COLLECTION_COEFFICIENT_COLUMNS,
  COLLECTION_COEFFICIENT_SOURCE,
  COLLECTION_COEFFICIENT_TITLE,
  collectionCoefficientPeriods,
  type CollectionCoefficientCapabilities,
  type CollectionCoefficientReport,
} from './collectionCoefficient'
import type { ReportCatalogueEntry } from '../types'

export function collectionCoefficientCapability(): CollectionCoefficientCapabilities {
  return { Version: 1, SourceIdentity: { ...COLLECTION_COEFFICIENT_SOURCE }, Title: COLLECTION_COEFFICIENT_TITLE,
    Executable: true, Periodicity: 'Month', PreviousMonthOffset: -1,
    Columns: COLLECTION_COEFFICIENT_COLUMNS.map(column => ({ ...column })), Filters: [] }
}

export function collectionCoefficientReport(month = '2026-09'): CollectionCoefficientReport {
  const availableInput = { Available: true, RunId: '10000000-0000-4000-8000-000000000001',
    PhysicalRows: 2, ActiveRows: 2, IncludedRows: 2, GrainRows: 1, UnknownBuyerRows: 0, InvalidRows: 0, Code: 'available' }
  const values = ['0.5', '0.4', '25', '0.1']
  return { Version: 1, SourceIdentity: { ...COLLECTION_COEFFICIENT_SOURCE }, Month: month,
    ...collectionCoefficientPeriods(month), Columns: COLLECTION_COEFFICIENT_COLUMNS.map(column => ({ ...column })),
    Cells: COLLECTION_COEFFICIENT_COLUMNS.map((column, index) => ({ Key: column.Key, Value: values[index], Available: true })),
    Inputs: { Current: { ...availableInput, CoefficientSum: values[0] }, Previous: { ...availableInput, CoefficientSum: values[1] } },
    Complete: true, HasRows: true, Code: 'available',
    RequestSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64),
    DocumentURL: '/files/collection-coefficient.xlsx', PdfDocumentURL: '/files/collection-coefficient.pdf' }
}

export function collectionCoefficientCatalogueEntry(): ReportCatalogueEntry {
  return { Id: `custom:fenix:${COLLECTION_COEFFICIENT_SOURCE.SourceId}`, Name: COLLECTION_COEFFICIENT_TITLE,
    Title: COLLECTION_COEFFICIENT_TITLE, Kind: 'indicator',
    Sources: [{ World: 'fenix', SourceId: COLLECTION_COEFFICIENT_SOURCE.SourceId, DefinitionSha256: null, Attributes: [] }] }
}
