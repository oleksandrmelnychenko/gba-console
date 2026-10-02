import { MANAGEMENT_ORDERS_COLUMNS, MANAGEMENT_ORDERS_NAME, MANAGEMENT_ORDERS_SOURCE, managementOrdersWindows,
  type ManagementOrdersCapabilities, type ManagementOrdersCell, type ManagementOrdersReport } from './managementOrders'
import type { ReportCatalogueEntry } from '../types'

export const MANAGEMENT_ORDERS_TEST_CALLER = '11111111-1111-1111-1111-111111111111'
export function managementOrdersCapability(): ManagementOrdersCapabilities {
  return { Version: 1, SourceIdentity: { ...MANAGEMENT_ORDERS_SOURCE }, ReportName: MANAGEMENT_ORDERS_NAME,
    DefaultPeriodicity: 'Month', ScopeKind: 'CurrentGbaMonthAndPreviousMonth',
    Grouping: 'Контрагент', ManagementCurrency: 'Управлінська валюта', DeclaredResourceUnit: '(Упр)',
    RecordKindMappingBasis: 'SharedFenixNonDocumentSettlementIncoming0Outgoing1', NativeVirtualTableZeroSuppressionVerified: false, InputBasis: 'NormalFenixBuyerOrders27',
    RawVisibilityPolicy: 'ActiveRecordKind0IncomingSignedResource', AgreementOwnerPolicy: 'PerQueryPeriodObservedAgreementOwner',
    Columns: MANAGEMENT_ORDERS_COLUMNS.map(column => ({ ...column })), Filters: ['Month'], RuntimeImplemented: true,
    RequiresCompleteNormalPublications: true, InputAvailability: 'CheckedByPreview', EffectiveSourcePeriodsVerified: false,
    SourceParityVerified: false, NativeCurrencyMappingVerified: false, AppliesFxConversion: false }
}
export function managementOrdersReport(): ManagementOrdersReport {
  const value = ['-5', '-10', '-50', '5']
  const cells: ManagementOrdersCell[] = MANAGEMENT_ORDERS_COLUMNS.map((column, index) => ({ Key: column.Key, Value: value[index], Available: true,
    ExactValue: { Numerator: value[index], Denominator: '1' }, FormattedValue: index === 2 ? '-50.00' : value[index] }))
  return { Version: 1, SourceIdentity: { ...MANAGEMENT_ORDERS_SOURCE }, Month: '2026-09', ...managementOrdersWindows('2026-09'),
    Grouping: 'Контрагент', ManagementCurrency: 'Управлінська валюта', DeclaredResourceUnit: '(Упр)',
    RecordKindMappingBasis: 'SharedFenixNonDocumentSettlementIncoming0Outgoing1', NativeVirtualTableZeroSuppressionVerified: false, InputBasis: 'NormalFenixBuyerOrders27', PresentationBasis: 'CurrentGbaClrDecimal',
    RawVisibilityPolicy: 'ActiveRecordKind0IncomingSignedResource', AgreementOwnerPolicy: 'PerQueryPeriodObservedAgreementOwner',
    EffectiveSourcePeriodsVerified: false, SourceParityVerified: false, NativeCurrencyMappingVerified: false, AppliesFxConversion: false,
    Columns: MANAGEMENT_ORDERS_COLUMNS.map(column => ({ ...column })), Totals: cells,
    Rows: [{ Key: 'a'.repeat(64), Caption: 'Контрагент із OUR', NameAvailable: true, SourceNull: false, Cells: structuredClone(cells) }],
    Inputs: { Current: { Available: true, IncludedRows: 1, Code: 'available' }, Previous: { Available: true, IncludedRows: 1, Code: 'available' } },
    Complete: true, HasRows: true, CounterpartyNamesComplete: true, Code: 'available',
    ObservationStartedAtUtc: '2026-10-02T01:02:03.0000000Z', ObservationCompletedAtUtc: '2026-10-02T01:02:04.0000000Z',
    Proof: { SnapshotVerified: true, ObservationSha256: 'b'.repeat(64), CounterpartyNamesSha256: 'c'.repeat(64), Publications: [
      { BusinessMonth: '2026-08-01', RunId: '22222222-2222-2222-2222-222222222222', Available: true, PhysicalRows: 1, PagesPerPass: 1, CompletePassSha256: 'd'.repeat(64), Code: 'available' },
      { BusinessMonth: '2026-09-01', RunId: '33333333-3333-3333-3333-333333333333', Available: true, PhysicalRows: 1, PagesPerPass: 1, CompletePassSha256: 'e'.repeat(64), Code: 'available' },
    ] }, RequestSha256: 'f'.repeat(64), ResultSha256: '0'.repeat(64), DocumentURL: '/reports/orders.xlsx', PdfDocumentURL: '/reports/orders.pdf' }
}
export function managementOrdersEmptyReport(): ManagementOrdersReport {
  const report = managementOrdersReport()
  return { ...report, Rows: [], Complete: true, HasRows: false, Code: 'query_empty',
    Inputs: { Current: { Available: true, IncludedRows: 0, Code: 'query_empty' }, Previous: { Available: true, IncludedRows: 0, Code: 'query_empty' } },
    Totals: report.Totals.map((cell, index) => ({ ...cell, Available: index < 2, Value: null, ExactValue: null, FormattedValue: null })),
    Proof: { ...report.Proof, Publications: report.Proof.Publications.map(parent => ({ ...parent, PhysicalRows: 0 })) } }
}
export function managementOrdersMissingReport(): ManagementOrdersReport {
  const report = managementOrdersEmptyReport()
  return { ...report, Complete: false, Code: 'order_incoming_query_input_unavailable',
    Inputs: { Current: { Available: false, IncludedRows: null, Code: 'period_publication_unavailable' },
      Previous: { Available: false, IncludedRows: null, Code: 'period_publication_unavailable' } },
    Totals: report.Totals.map(cell => ({ ...cell, Available: false })),
    Proof: { ...report.Proof, Publications: report.Proof.Publications.map(parent => ({ ...parent, Available: false, RunId: null,
      PhysicalRows: null, PagesPerPass: null, CompletePassSha256: null, Code: 'period_publication_unavailable' })) } }
}
export function managementOrdersUnknownCurrentReport(): ManagementOrdersReport {
  const report = managementOrdersReport()
  const cells = report.Totals.map((cell, index) => index === 1 ? cell : { ...cell, Available: false, Value: null, FormattedValue: null, ExactValue: null })
  return { ...report, Complete: false, Code: 'order_incoming_query_input_unavailable', Totals: cells, Rows: [{ ...report.Rows[0], Cells: structuredClone(cells) }],
    Inputs: { ...report.Inputs, Current: { Available: false, IncludedRows: null, Code: 'full_orders_owner_projection_unavailable' } },
    Proof: { ...report.Proof, Publications: [report.Proof.Publications[0], { ...report.Proof.Publications[1], Available: false,
      PhysicalRows: null, PagesPerPass: null, CompletePassSha256: null, Code: 'full_orders_owner_projection_unavailable' }] } }
}
export function managementOrdersCatalogueEntry(): ReportCatalogueEntry {
  return { Id: `custom:fenix:${MANAGEMENT_ORDERS_SOURCE.SourceId}`, Name: MANAGEMENT_ORDERS_NAME, Title: MANAGEMENT_ORDERS_NAME, Kind: 'indicator',
    Sources: [{ World: 'fenix', SourceId: MANAGEMENT_ORDERS_SOURCE.SourceId, DefinitionSha256: null, Attributes: [] }] }
}

export function managementOrdersZeroReport(): ManagementOrdersReport {
  const report = managementOrdersReport()
  const values = ['0','0','100','0']
  const cells = report.Totals.map((cell,index) => ({...cell,Value:values[index],FormattedValue:index===2?'100.00':values[index],ExactValue:{Numerator:values[index],Denominator:'1'}}))
  return {...report,Totals:cells,Rows:[{...report.Rows[0],Cells:structuredClone(cells)}]}
}
export function managementOrdersNullPreviousReport(): ManagementOrdersReport {
  const report = managementOrdersReport()
  const cells = report.Totals.map((cell,index) => index===1 ? {...cell,Value:null,FormattedValue:null,ExactValue:null}
    : index===2 ? {...cell,Value:'100',FormattedValue:'100.00',ExactValue:{Numerator:'100',Denominator:'1'}}
    : index===3 ? {...cell,Value:'-5',FormattedValue:'-5',ExactValue:{Numerator:'-5',Denominator:'1'}} : cell)
  return {...report,Totals:cells,Rows:[{...report.Rows[0],Cells:structuredClone(cells)}],
    Inputs:{...report.Inputs,Previous:{Available:true,IncludedRows:0,Code:'query_empty'}},
    Proof:{...report.Proof,Publications:[{...report.Proof.Publications[0],PhysicalRows:0},report.Proof.Publications[1]]}}
}
export function managementOrdersUnknownCurrentZeroPreviousReport(): ManagementOrdersReport {
  const report = managementOrdersUnknownCurrentReport()
  const cells = report.Totals.map((cell,index) => index===1 ? {...cell,Value:'0',FormattedValue:'0',ExactValue:{Numerator:'0',Denominator:'1'}}
    : index===2 ? {...cell,Available:true,Value:'100',FormattedValue:'100.00',ExactValue:{Numerator:'100',Denominator:'1'}} : cell)
  return {...report,Totals:cells,Rows:[{...report.Rows[0],Cells:structuredClone(cells)}]}
}
