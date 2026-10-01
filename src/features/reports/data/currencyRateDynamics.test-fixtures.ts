import type { ReportCatalogueEntry } from '../types'
import { CURRENCY_RATE_DYNAMICS_COLUMNS, CURRENCY_RATE_DYNAMICS_SOURCE, CURRENCY_RATE_DYNAMICS_TITLE,
  currencyRateDynamicsPeriods, type CurrencyRateDynamicsCapabilities, type CurrencyRateDynamicsDefinition,
  type CurrencyRateDynamicsReport } from './currencyRateDynamics'

export function currencyDynamicsCapability(): CurrencyRateDynamicsCapabilities {
  return { Version: 1, SourceIdentity: { ...CURRENCY_RATE_DYNAMICS_SOURCE }, Title: CURRENCY_RATE_DYNAMICS_TITLE,
    Executable: true, Periodicity: 'Month', PreviousMonthOffset: -1, Columns: CURRENCY_RATE_DYNAMICS_COLUMNS.map(column => ({ ...column })),
    Filters: [], Parameters: [{ Key: 'RateDefinitionId', Caption: 'Валюта', IdentityBasis: 'CurrentOurOrderedPair' }],
    RateKind: 'commercial', InputBasis: 'CurrentOurRateHistory', DateSemantics: 'stored-calendar-month-end', SourceParityVerified: false }
}
export function currencyDynamicsDefinition(second = false): CurrencyRateDynamicsDefinition {
  return { RateDefinitionId: second ? '9007199254740994' : '9007199254740993', RateKind: 'commercial',
    BaseCurrencyId: second ? '18' : '17', BaseCode: second ? 'EUR' : 'USD', BaseName: second ? 'Євро' : 'Долар США',
    TargetCurrencyId: '1', TargetCode: 'UAH', TargetName: 'Гривня' }
}
export function currencyDynamicsReport(month = '2026-09', definition = currencyDynamicsDefinition()): CurrencyRateDynamicsReport {
  const periods = currencyRateDynamicsPeriods(month), values = ['13.7', '11.3', '21.238938053097345132743362832', '2.4']
  return { Version: 1, SourceIdentity: { ...CURRENCY_RATE_DYNAMICS_SOURCE }, Month: month, ...periods,
    RateDefinition: definition, Columns: CURRENCY_RATE_DYNAMICS_COLUMNS.map(column => ({ ...column })),
    Cells: CURRENCY_RATE_DYNAMICS_COLUMNS.map((column, index) => ({ Key: column.Key, Value: values[index], Available: true })),
    Inputs: {
      Current: { Available: true, HistoryId: '121', Created: `${month}-20T12:00:00.1234567`, Amount: values[0], Code: 'available' },
      Previous: { Available: true, HistoryId: '120', Created: `${periods.PreviousPeriod.From.slice(0, 7)}-20T12:00:00`, Amount: values[1], Code: 'available' },
    }, InputBasis: 'CurrentOurRateHistory', DateSemantics: 'stored-calendar-month-end', SourceParityVerified: false,
    CalculationCode: 'available', ObservationStartedAtUtc: '2026-10-01T10:00:00.1234567Z', ObservationCompletedAtUtc: '2026-10-01T10:00:00.1244567Z',
    RequestSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), DocumentURL: '/files/currency-dynamics.xlsx', PdfDocumentURL: '/files/currency-dynamics.pdf' }
}
export function currencyDynamicsCatalogueEntry(): ReportCatalogueEntry {
  return { Id: `custom:fenix:${CURRENCY_RATE_DYNAMICS_SOURCE.SourceId}`, Name: CURRENCY_RATE_DYNAMICS_TITLE,
    Title: CURRENCY_RATE_DYNAMICS_TITLE, Kind: 'indicator',
    Sources: [{ World: 'fenix', SourceId: CURRENCY_RATE_DYNAMICS_SOURCE.SourceId, DefinitionSha256: null, Attributes: [] }] }
}
