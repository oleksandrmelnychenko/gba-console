import { expect, it } from 'vitest'
import { CASH_AGGREGATE_BALANCE_COLUMNS, cashAggregateBalanceCellText, cashAggregateBalancePeriodError,
  cashAggregateBalancePeriods, createCashAggregateBalanceRequest, isCashAggregateBalanceCapabilities,
  isCashAggregateBalanceCatalogueEntry, normalizeCashAggregateBalanceReport } from './cashAggregateBalance'
import { cashAggregateCapability, cashAggregateCatalogueEntry, cashAggregateCells, cashAggregateReport, missingCashAggregatePoint } from './cashAggregateBalance.test-fixtures'

it('matches only the exact original source, quarter comparison and four retained captions without native aliases or filters', () => {
  const capability = cashAggregateCapability()
  expect(isCashAggregateBalanceCatalogueEntry(cashAggregateCatalogueEntry())).toBe(true)
  expect(isCashAggregateBalanceCatalogueEntry({ ...cashAggregateCatalogueEntry(), Id: 'native:40' })).toBe(false)
  expect(isCashAggregateBalanceCapabilities(capability)).toBe(true)
  expect(isCashAggregateBalanceCapabilities({ ...capability, Grouping: 'Organization' })).toBe(false)
  expect(isCashAggregateBalanceCapabilities({ ...capability, Filters: ['Account'] })).toBe(false)
  const request = createCashAggregateBalanceRequest(capability, '2026-09-30')
  expect(Object.keys(request)).toEqual(['Version', 'SourceIdentity', 'Period'])
  expect(CASH_AGGREGATE_BALANCE_COLUMNS.map(column => column.Caption)).toEqual([
    'Текущее значение', 'Значение предыдущего периода', 'Изменение %', 'Изменение (абс)',
  ])
})
it('uses the selected date and AddMonths minus three with calendar clamping rather than a quarter end or ninety days', () => {
  expect(cashAggregateBalancePeriods('2024-05-31')).toEqual({ CurrentPeriod: { Day: '2024-05-31', ThroughExclusive: '2024-06-01' },
    PreviousPeriod: { Day: '2024-02-29', ThroughExclusive: '2024-03-01' } })
  expect(cashAggregateBalancePeriods('2025-05-31').PreviousPeriod.Day).toBe('2025-02-28')
  expect(cashAggregateBalancePeriods('2026-08-17').PreviousPeriod.Day).toBe('2026-05-17')
  expect(cashAggregateBalancePeriodError('0001-03-31')).not.toBeNull()
  expect(cashAggregateBalancePeriodError('0001-04-01')).toBeNull()
  expect(cashAggregateBalancePeriodError('9999-12-30')).toBeNull()
  expect(cashAggregateBalancePeriodError('9999-12-31')).not.toBeNull()
  expect(cashAggregateBalancePeriodError('2025-02-29')).not.toBeNull()
  expect(cashAggregateBalancePeriodError('2030-01-15')).toBeNull()
})
it('retains account identity, raw decimal strings, independent point clocks and server recomputed totals', () => {
  const report = cashAggregateReport(), request = createCashAggregateBalanceRequest(cashAggregateCapability(), report.Period)
  const previousAlias = { ...report.Rows[0].Inputs.Previous.Currency!, SourceCurrencyRRef: 'D'.repeat(32) }
  report.Rows[0].Legs[0].Previous.ManagementCurrency = previousAlias
  report.Rows[0].Inputs.Previous.Currency = previousAlias; report.Totals.Inputs.Previous.Currency = previousAlias
  expect(normalizeCashAggregateBalanceReport(report, request)).toBe(report)
  expect(report.Rows[0].Account.Id).not.toBe(report.Rows[1].Account.Id)
  expect(report.Rows[0].Account.Name).toBe(report.Rows[1].Account.Name)
  expect(report.Totals.Cells[2].Value).toBe('68')
  expect(report.Rows[0].Legs[0].Current.CaptureCompletedAtUtc).not.toBe(report.Rows[0].Legs[0].Previous.CaptureCompletedAtUtc)
  const fractional = cashAggregateReport(), row = fractional.Rows[0]
  row.Legs = [row.Legs[0]]; row.Legs[0].Current.ManagementClosing = '13.7'; row.Legs[0].Previous.ManagementClosing = '11.3'
  row.Cells = cashAggregateCells(['13.7', '11.3', '21.238938053097345132743362832', '2.4'])
  row.Inputs.Current = { ...row.Inputs.Current, Amount: '13.7', IncludedLegs: 1, KnownLegs: 1 }
  row.Inputs.Previous = { ...row.Inputs.Previous, Amount: '11.3', IncludedLegs: 1, KnownLegs: 1 }
  fractional.Rows = [row]; fractional.Totals = { Cells: row.Cells, Inputs: row.Inputs, CalculationCode: 'available' }
  expect(normalizeCashAggregateBalanceReport(fractional, request)).toBe(fractional)
  expect(cashAggregateBalanceCellText(row.Cells[2].Value, 2)).toBe('21,24')
  expect(row.Cells[2].Value).toBe('21.238938053097345132743362832')
})
it('keeps a missing current point NULL while a proven previous zero supplies the original percent branch', () => {
  const report = cashAggregateReport(), row = report.Rows[0]
  row.Cells = cashAggregateCells([null, '0', '100', null])
  row.Inputs.Current = { Available: false, Amount: null, Currency: null, IncludedLegs: 2, KnownLegs: 1, Code: 'period_not_published' }
  row.Inputs.Previous.Amount = '0'; row.Legs[0].Current = missingCashAggregatePoint()
  row.Legs.forEach(item => { item.Previous.ManagementClosing = '0' })
  report.Totals.Cells = cashAggregateCells([null, '50', null, null])
  report.Totals.Inputs.Current = { ...row.Inputs.Current, IncludedLegs: 3, KnownLegs: 2 }
  report.Totals.Inputs.Previous.Amount = '50'; report.Totals.CalculationCode = 'period_coverage_unavailable'
  row.CalculationCode = 'period_coverage_unavailable'
  expect(normalizeCashAggregateBalanceReport(report, createCashAggregateBalanceRequest(cashAggregateCapability(), report.Period))).toBe(report)
  expect(cashAggregateBalanceCellText(row.Cells[0].Value, null)).toBe('—')
  expect(row.Cells[2].Value).toBe('100')
})
it('keeps an unconfirmed raw management point and genuinely missing native bindings local without an FX or identity substitute', () => {
  const report = cashAggregateReport(), row = report.Rows[0]
  row.Legs[0].Current.Code = 'management_currency_unconfirmed'; row.Legs[0].Current.ManagementCurrency = null
  row.Inputs.Current = { Available: false, Amount: null, Currency: null, IncludedLegs: 2, KnownLegs: 1, Code: 'management_currency_unconfirmed' }
  row.Cells = cashAggregateCells([null, '75', null, null]); row.CalculationCode = 'period_coverage_unavailable'
  report.Totals.Cells = cashAggregateCells([null, '125', null, null])
  report.Totals.Inputs.Current = { ...row.Inputs.Current, IncludedLegs: 3, KnownLegs: 2 }; report.Totals.CalculationCode = 'period_coverage_unavailable'
  const request = createCashAggregateBalanceRequest(cashAggregateCapability(), report.Period)
  expect(normalizeCashAggregateBalanceReport(report, request)).toBe(report)
  expect(row.Legs[0].Current.ManagementClosing).toBe('100'); expect(row.Cells[0].Value).toBeNull()
  const emptyUid = '00000000-0000-0000-0000-000000000000'
  row.Legs[0].Native.CurrencyId = '0'; row.Legs[0].Native.CurrencyNetUid = emptyUid
  row.Legs[0].Current = { ...missingCashAggregatePoint(), Code: 'native_binding_unavailable' }
  row.Legs[0].Previous = { ...missingCashAggregatePoint(), Code: 'native_binding_unavailable' }
  row.Inputs.Current.Code = 'native_binding_unavailable'
  row.Inputs.Previous = { ...row.Inputs.Current }
  row.Cells = cashAggregateCells([null, null, null, null])
  report.Totals.Cells = cashAggregateCells([null, null, null, null]); report.Totals.Inputs.Previous = { ...report.Totals.Inputs.Current }
  report.Totals.Inputs.Current.Code = 'native_binding_unavailable'; report.Totals.Inputs.Previous.Code = 'native_binding_unavailable'
  expect(normalizeCashAggregateBalanceReport(report, request)).toBe(report)
})
it('accepts genuine empty zero totals and mixed-unit or unknown totals as NULL without calculating a replacement', () => {
  const report = cashAggregateReport(); report.Rows = []
  const empty = { Available: true, Amount: '0', Currency: null, IncludedLegs: 0, KnownLegs: 0, Code: 'available' }
  report.Totals = { Cells: cashAggregateCells(['0', '0', '100', '0']), Inputs: { Current: empty, Previous: empty }, CalculationCode: 'available' }
  expect(normalizeCashAggregateBalanceReport(report, createCashAggregateBalanceRequest(cashAggregateCapability(), report.Period))).toBe(report)
  const mixed = cashAggregateReport()
  const changedCurrency = { ...mixed.Rows[1].Inputs.Current.Currency!, Id: '9', NetUid: '10000000-0000-4000-8000-000000000009', Code: '840', Name: 'Долар США', SourceCurrencyRRef: 'D'.repeat(32) }
  mixed.Rows[1].Inputs.Current.Currency = changedCurrency; mixed.Rows[1].Legs[0].Current.ManagementCurrency = changedCurrency
  mixed.Rows[1].Cells = cashAggregateCells(['60', '50', null, null]); mixed.Rows[1].CalculationCode = 'management_currency_changed'
  mixed.Totals.Cells = cashAggregateCells([null, '125', null, null])
  mixed.Totals.Inputs.Current = { Available: false, Amount: null, Currency: null, IncludedLegs: 3, KnownLegs: 3, Code: 'mixed_management_currency' }
  mixed.Totals.CalculationCode = 'period_coverage_unavailable'
  expect(normalizeCashAggregateBalanceReport(mixed, createCashAggregateBalanceRequest(cashAggregateCapability(), mixed.Period))).toBe(mixed)
})
it('rejects another date/grouping, repeated accounts, mismatched native owners or unknown points masquerading as zero', () => {
  const request = createCashAggregateBalanceRequest(cashAggregateCapability(), '2026-09-30')
  const bad = [cashAggregateReport('2026-09-29'), { ...cashAggregateReport(), Grouping: 'Organization' }]
  const duplicate = cashAggregateReport(); duplicate.Rows.push(duplicate.Rows[0]); bad.push(duplicate)
  const owner = cashAggregateReport(); owner.Rows[0].Legs[0].Native.Account = owner.Rows[1].Account; bad.push(owner)
  const fake = cashAggregateReport(); fake.Rows[0].Legs[0].Current = { ...missingCashAggregatePoint(), ManagementClosing: '0' }; bad.push(fake)
  for (const value of bad) expect(() => normalizeCashAggregateBalanceReport(value, request)).toThrow('некоректний результат')
})
