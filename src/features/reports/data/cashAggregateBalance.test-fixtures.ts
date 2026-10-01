import type { ReportCatalogueEntry } from '../types'
import { CASH_AGGREGATE_BALANCE_COLUMNS, CASH_AGGREGATE_BALANCE_SOURCE, CASH_AGGREGATE_BALANCE_TITLE,
  cashAggregateBalancePeriods, type CashAggregateBalanceAccount, type CashAggregateBalanceCapabilities,
  type CashAggregateBalanceCell, type CashAggregateBalanceCurrency, type CashAggregateBalanceInputs,
  type CashAggregateBalanceLeg, type CashAggregateBalancePoint, type CashAggregateBalanceReport } from './cashAggregateBalance'

export function cashAggregateCapability(): CashAggregateBalanceCapabilities {
  return { Version: 1, SourceIdentity: { ...CASH_AGGREGATE_BALANCE_SOURCE }, Title: CASH_AGGREGATE_BALANCE_TITLE,
    Executable: true, Periodicity: 'Quarter', PreviousPeriodOffset: -1, PeriodParameterType: 'Date', Grouping: 'БанковскийСчетКасса',
    Columns: CASH_AGGREGATE_BALANCE_COLUMNS.map(column => ({ ...column })), Filters: [],
    InputBasis: 'CurrentOurCashManagementClosing', SourceParityVerified: false }
}
const guid = (index: number) => `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`
export function cashAggregateCurrency(): CashAggregateBalanceCurrency {
  return { Id: '1', NetUid: guid(10), Code: '980', Name: 'Гривня', SourceCurrencyRRef: 'A'.repeat(32) }
}
export function cashAggregateCells(values: Array<string | null>): CashAggregateBalanceCell[] {
  return CASH_AGGREGATE_BALANCE_COLUMNS.map((column, index) => ({ Key: column.Key, Value: values[index], Available: values[index] !== null }))
}
function inputs(current: string, previous: string, included: number): CashAggregateBalanceInputs {
  const input = (amount: string) => ({ Available: true, Amount: amount, Currency: cashAggregateCurrency(),
    IncludedLegs: included, KnownLegs: included, Code: 'available' })
  return { Current: input(current), Previous: input(previous) }
}
export function missingCashAggregatePoint(): CashAggregateBalancePoint {
  return { Code: 'period_not_published', PublicationId: null, ManagementClosing: null, ManagementCurrency: null,
    SourceGrain: null, CaptureStartedAtUtc: null, CaptureCompletedAtUtc: null, Day: null }
}
export function cashAggregateReport(period = '2026-09-30'): CashAggregateBalanceReport {
  const periods = cashAggregateBalancePeriods(period)
  const account = (index: number): CashAggregateBalanceAccount => ({ Id: String(9007199254740993n + BigInt(index)), NetUid: guid(index), Name: 'Основний рахунок' })
  const first = account(1), second = account(2)
  const leg = (bound: CashAggregateBalanceAccount, index: number, current: string, previous: string): CashAggregateBalanceLeg => {
    const point = (prior: boolean): CashAggregateBalancePoint => ({ Code: 'available', PublicationId: guid(index + (prior ? 100 : 200)),
      ManagementClosing: prior ? previous : current, ManagementCurrency: cashAggregateCurrency(),
      SourceGrain: { CashKindRRef: 'B'.repeat(32), AccountTRef: '0000000F', AccountRRef: String(index).padStart(32, '0'), OrganizationRRef: 'C'.repeat(32) },
      CaptureStartedAtUtc: prior ? '2026-07-01T11:00:00Z' : '2026-10-01T10:00:00Z',
      CaptureCompletedAtUtc: prior ? '2026-07-01T11:00:01Z' : '2026-10-01T10:00:01Z', Day: prior ? periods.PreviousPeriod.Day : periods.CurrentPeriod.Day })
    return { Native: { Account: bound, CurrencyRegisterId: String(index), CurrencyRegisterNetUid: guid(index + 300),
      CurrencyId: '1', CurrencyNetUid: guid(10), OrganizationId: '23', OrganizationNetUid: guid(23) }, Current: point(false), Previous: point(true) }
  }
  return { Version: 1, SourceIdentity: { ...CASH_AGGREGATE_BALANCE_SOURCE }, Period: period, ...periods, Grouping: 'БанковскийСчетКасса',
    Columns: CASH_AGGREGATE_BALANCE_COLUMNS.map(column => ({ ...column })),
    Rows: [
      { Account: first, Cells: cashAggregateCells(['150', '75', '100', '75']), Inputs: inputs('150', '75', 2),
        Legs: [leg(first, 1, '100', '50'), leg(first, 2, '50', '25')], CalculationCode: 'available' },
      { Account: second, Cells: cashAggregateCells(['60', '50', '20', '10']), Inputs: inputs('60', '50', 1),
        Legs: [leg(second, 3, '60', '50')], CalculationCode: 'available' },
    ], Totals: { Cells: cashAggregateCells(['210', '125', '68', '85']), Inputs: inputs('210', '125', 3), CalculationCode: 'available' },
    InputBasis: 'CurrentOurCashManagementClosing', SourceParityVerified: false,
    ObservationStartedAtUtc: '2026-10-01T12:00:00.1234567Z', ObservationCompletedAtUtc: '2026-10-01T12:00:00.1244567Z',
    RequestSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), DocumentURL: '/files/cash-aggregate.xlsx', PdfDocumentURL: '/files/cash-aggregate.pdf' }
}
export function cashAggregateCatalogueEntry(): ReportCatalogueEntry {
  return { Id: `custom:fenix:${CASH_AGGREGATE_BALANCE_SOURCE.SourceId}`, Name: CASH_AGGREGATE_BALANCE_TITLE,
    Title: CASH_AGGREGATE_BALANCE_TITLE, Kind: 'indicator',
    Sources: [{ World: 'fenix', SourceId: CASH_AGGREGATE_BALANCE_SOURCE.SourceId, DefinitionSha256: null, Attributes: [] }] }
}
