import {
  ACTIVE_CLIENTS_COLUMNS,
  ACTIVE_CLIENTS_SOURCE,
  ACTIVE_CLIENTS_TITLE,
  activeClientsPeriods,
  type ActiveClientsCapabilities,
  type ActiveClientsReport,
} from './activeClients'
import type { ReportCatalogueEntry } from '../types'

export function activeClientsCapability(): ActiveClientsCapabilities {
  return { Version: 1, SourceIdentity: { ...ACTIVE_CLIENTS_SOURCE }, Title: ACTIVE_CLIENTS_TITLE,
    Executable: true, Periodicity: 'Month', PreviousMonthOffset: -1,
    Columns: ACTIVE_CLIENTS_COLUMNS.map(column => ({ ...column })), Filters: [], IdentityBasis: 'CurrentOurClient',
    IncludesPostedSaleAndReturnLines: true, SourceParityVerified: false }
}

export function activeClientsReport(month = '2026-09'): ActiveClientsReport {
  const values = ['4', '3', '33.333333333333333333333333333', '1']
  return { Version: 1, SourceIdentity: { ...ACTIVE_CLIENTS_SOURCE }, Month: month,
    ...activeClientsPeriods(month), Columns: ACTIVE_CLIENTS_COLUMNS.map(column => ({ ...column })),
    Cells: ACTIVE_CLIENTS_COLUMNS.map((column, index) => ({ Key: column.Key, Value: values[index], Available: true })),
    Inputs: {
      Current: { Available: true, EligibleSaleLines: 3, EligibleReturnLines: 2, UnattributedLines: 0, DistinctClients: 4, Code: 'available' },
      Previous: { Available: true, EligibleSaleLines: 2, EligibleReturnLines: 2, UnattributedLines: 0, DistinctClients: 3, Code: 'available' },
    },
    IdentityBasis: 'CurrentOurClient', IncludesPostedSaleAndReturnLines: true, SourceParityVerified: false,
    ObservationStartedAtUtc: '2026-10-01T10:00:00.1234567Z', ObservationCompletedAtUtc: '2026-10-01T10:00:00.1244567Z',
    RequestSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64),
    DocumentURL: '/files/active-clients.xlsx', PdfDocumentURL: '/files/active-clients.pdf' }
}

export function activeClientsCatalogueEntry(): ReportCatalogueEntry {
  return { Id: `custom:fenix:${ACTIVE_CLIENTS_SOURCE.SourceId}`, Name: ACTIVE_CLIENTS_TITLE,
    Title: ACTIVE_CLIENTS_TITLE, Kind: 'indicator',
    Sources: [{ World: 'fenix', SourceId: ACTIVE_CLIENTS_SOURCE.SourceId, DefinitionSha256: null, Attributes: [] }] }
}
