import { expect, it } from 'vitest'
import { createPlannedCashRequest, isPlannedCashCapabilities, normalizePlannedCashReport, plannedCashCatalogueKind,
  plannedCashCatalogueMatches, plannedCashDefaultFilters, plannedCashFilterError, PLANNED_CASH_SCENARIO_PENDING } from './plannedCash'
import { plannedCashCapability, plannedCashCatalogueEntry, plannedCashCalendarKinds, plannedCashDdsKinds, plannedCashKinds,
  plannedCashFilters, plannedCashReport, plannedCashTestRequest, plannedCashEmptyReport, plannedCashPartialReport, plannedCashConflictReport } from './plannedCash.test-fixtures'

it.each(plannedCashKinds)('binds the original %s capability, catalogue identity, ordered columns and complete server response', kind => {
  const cap = plannedCashCapability(kind)
  expect(isPlannedCashCapabilities(cap)).toBe(true); expect(plannedCashCatalogueKind(plannedCashCatalogueEntry(kind))).toBe(kind)
  expect(plannedCashCatalogueMatches(plannedCashCatalogueEntry(kind), cap)).toBe(true)
  expect(normalizePlannedCashReport(plannedCashReport(kind), plannedCashTestRequest(kind))).toEqual(plannedCashReport(kind))
})
it.each(plannedCashCalendarKinds)('copies the actual opaque %s server identity and exact dates without a plan-horizon guess', kind => {
  const cap = plannedCashCapability(kind); cap.SourceIdentity.DefinitionSha256 = '0'.repeat(64)
  const req = createPlannedCashRequest(cap, plannedCashFilters())
  expect(req.SourceIdentity).toEqual(cap.SourceIdentity); expect(req.SourceIdentity).not.toBe(cap.SourceIdentity)
  expect(req).toEqual({ ...plannedCashTestRequest(kind), SourceIdentity: cap.SourceIdentity })
  expect(plannedCashDefaultFilters(cap, '2026-10-02').PlanEndpoint).toBe('')
})
it.each(plannedCashDdsKinds)('keeps %s scenario selection pending and refuses manual or invented selections before HTTP', kind => {
  const cap = plannedCashCapability(kind)
  expect(plannedCashFilterError(cap, plannedCashFilters())).toBe(PLANNED_CASH_SCENARIO_PENDING)
  expect(() => createPlannedCashRequest(cap, plannedCashFilters())).toThrow(PLANNED_CASH_SCENARIO_PENDING)
})
it.each(['2026-02-30','0000-01-01','8000-01-01','2026-9-01','2026-09-01T00:00:00Z',' 2026-09-01',''])('rejects dirty current date %s', From => {
  expect(() => createPlannedCashRequest(plannedCashCapability(), { ...plannedCashFilters(), From })).toThrow('межі періоду')
})
it.each(['3999-01-01','2026-02-30','2026-10-01Z',''])('rejects unsupported plan date %s rather than inventing a date', PlanEndpoint => {
  expect(() => createPlannedCashRequest(plannedCashCapability(), { ...plannedCashFilters(), PlanEndpoint })).toThrow('дату планового залишку')
})
it('preserves the calendar receipts quarter suggestion and payout month suggestion without changing explicit ranges', () => {
  expect(plannedCashDefaultFilters(plannedCashCapability('CalendarReceipts'), '2026-05-02')).toMatchObject({ From: '2026-04-01', ThroughExclusive: '2026-07-01' })
  expect(plannedCashDefaultFilters(plannedCashCapability(), '2026-05-02')).toMatchObject({ From: '2026-05-01', ThroughExclusive: '2026-06-01' })
  expect(createPlannedCashRequest(plannedCashCapability(), { ...plannedCashFilters(), From: '2026-09-15' }).CurrentPeriod.From).toBe('2026-09-15T00:00:00.000')
})
it.each(['SourceIdentity','Period','Endpoint','Kind','Columns','Value','Snapshot','Clock','Hash','DuplicateGroup','RawLabel','Url','Unit','Publication'])('refuses a stale or unbound %s delivery', field => {
  const r = plannedCashReport()
  if (field === 'SourceIdentity') r.SourceIdentity.DefinitionSha256 = '0'.repeat(64)
  if (field === 'Period') r.CurrentPeriod.From = '2026-09-02T00:00:00.000'
  if (field === 'Endpoint') r.PlanEndpoint = '2026-11-01T00:00:00.000'
  if (field === 'Kind') r.Kind = 'NetFlow'
  if (field === 'Columns') r.Columns.reverse()
  if (field === 'Value') Reflect.set(r.Totals[0], 'Value', 2)
  if (field === 'Snapshot') Reflect.set(r.Proof, 'SnapshotVerified', false)
  if (field === 'Clock') r.ObservationStartedAtUtc = '2026-10-02 01:02:03'
  if (field === 'Hash') r.ResultSha256 = 'wrong'
  if (field === 'DuplicateGroup') r.Rows.push({ ...r.Rows[0] })
  if (field === 'RawLabel') { r.Rows[0].NameAvailable = false; r.Rows[0].Name = 'raw-reference' }
  if (field === 'Url') r.DocumentURL = '//untrusted.test/file'
  if (field === 'Unit') Reflect.set(r.ResourceUnits[0], 'UnitAnnotation', 'EUR')
  if (field === 'Publication') r.Proof.Current.CompletePublication = false
  expect(() => normalizePlannedCashReport(r, plannedCashTestRequest())).toThrow('непідтверджений результат')
})
it.each(plannedCashKinds)('preserves confirmed-empty %s NULLs instead of inventing zero', kind => {
  const r = plannedCashEmptyReport(kind)
  expect(normalizePlannedCashReport(r, plannedCashTestRequest(kind))).toEqual(r)
  expect(r.Totals[0]).toMatchObject({ Available: true, Value: null, FormattedValue: null })
})
it('keeps missing current data independent of a genuine known plan without invented zero', () => {
  const r = plannedCashPartialReport(); expect(normalizePlannedCashReport(r, plannedCashTestRequest())).toEqual(r)
  expect(r.Totals[0].Available).toBe(false); expect(r.Totals[1].FormattedValue).toBe('10')
})
it('preserves signed money and exact server presentation without calculating ratios or totals', () => {
  const r = plannedCashReport(); r.Totals[0].FormattedValue = '-2.0000000000000000000000000000'
  expect(normalizePlannedCashReport(r, plannedCashTestRequest()).Totals[0].FormattedValue).toBe('-2.0000000000000000000000000000')
})
it('keeps known currency conflict independent scalars and closes only the server comparison cells', () => {
  const r = plannedCashConflictReport(); expect(normalizePlannedCashReport(r, plannedCashTestRequest('DdsPayouts'))).toEqual(r)
  r.Totals[2] = plannedCashReport('DdsPayouts').Totals[2]
  expect(() => normalizePlannedCashReport(r, plannedCashTestRequest('DdsPayouts'))).toThrow('непідтверджений результат')
})
it('does not expose an unsupported capability or change its flags to enable it', () => {
  const cap = plannedCashCapability(); cap.RuntimeImplemented = false
  expect(() => createPlannedCashRequest(cap, plannedCashFilters())).toThrow('Сервер не підтвердив')
  Reflect.set(cap, 'ScenarioSelectionLabelsAvailable', true); expect(isPlannedCashCapabilities(cap)).toBe(false)
})

it.each(['2026-09-01', '2026-08-31'])('rejects equal/reversed exclusive end %s', ThroughExclusive => {
  expect(() => createPlannedCashRequest(plannedCashCapability(), { ...plannedCashFilters(), ThroughExclusive })).toThrow('межі періоду')
})
it('refuses a fabricated available current zero while its normal input is missing', () => {
  const r = plannedCashPartialReport(); r.Totals[0] = { ...r.Totals[0], Available: true, Value: '0', ExactValue: { Numerator: '0', Denominator: '1' }, FormattedValue: '0' }
  expect(() => normalizePlannedCashReport(r, plannedCashTestRequest())).toThrow('непідтверджений результат')
})
it('retains a genuine unnamed NULL group independently from a missing human caption', () => {
  const r = plannedCashReport(); r.Rows[0].GroupIsNull = true; r.Rows[0].Name = 'Без значення'
  expect(normalizePlannedCashReport(r, plannedCashTestRequest()).Rows[0].GroupIsNull).toBe(true)
})

it('accepts a valid 121-month period and complete planned prefix without imposing a ten-year limit', () => {
  const request = createPlannedCashRequest(plannedCashCapability(), {
    ...plannedCashFilters(), From: '2016-01-01', ThroughExclusive: '2026-02-01', PlanEndpoint: '2026-02-01',
  })
  const report = plannedCashReport()
  report.CurrentPeriod = { ...request.CurrentPeriod }; report.PlanEndpoint = request.PlanEndpoint
  report.Proof.Current.CompletedMovementMonths = 121
  if (report.Proof.Requests === null) throw new Error('The payout fixture requires its planned-balance proof')
  report.Proof.Requests.CompletedMovementMonths = 121
  expect(normalizePlannedCashReport(report, request)).toEqual(report)
})

it.each([
  ['CalendarPayouts', 'Requests'], ['CalendarReceipts', 'Receipts'], ['NetFlow', 'Receipts'], ['NetFlow', 'Requests'],
] as const)('rejects an available %s %s balance without its genuine dated opening', (kind, role) => {
  const report = plannedCashReport(kind), balance = report.Proof[role]
  if (balance === null) throw new Error('The selected form requires this planned-balance proof')
  balance.DatedOpeningVerified = false
  expect(() => normalizePlannedCashReport(report, plannedCashTestRequest(kind))).toThrow('непідтверджений результат')
})

it.each(['Current', 'Previous', 'Scenario'] as const)('rejects an invented dated opening for the %s turnover relation', role => {
  const report = plannedCashReport('DdsPayouts'), turnover = report.Proof[role]
  if (turnover === null) throw new Error('The DDS fixture requires this turnover proof')
  turnover.DatedOpeningVerified = true
  expect(() => normalizePlannedCashReport(report, plannedCashTestRequest('DdsPayouts'))).toThrow('непідтверджений результат')
})

it('also rejects an invented opening for unavailable current turnover', () => {
  const report = plannedCashPartialReport(); report.Proof.Current.DatedOpeningVerified = true
  expect(() => normalizePlannedCashReport(report, plannedCashTestRequest())).toThrow('непідтверджений результат')
})

it('preserves a verified planned opening and partial month prefix while plan values remain unavailable', () => {
  const report = plannedCashReport()
  if (report.Proof.Requests === null) throw new Error('The payout fixture requires its planned-balance proof')
  report.Proof.Requests = { Available: false, CompletePublication: false, DatedOpeningVerified: true, CompletedMovementMonths: 3 }
  report.PlanAvailable = false; report.Complete = false; report.Code = 'planned_cash_input_unavailable'
  report.AvailabilityMessage = 'Дані синку ще не готові для формування повного звіту.'
  report.Totals[1] = { ...report.Totals[1], Available: false, Value: null, ExactValue: null, FormattedValue: null }
  report.Rows = report.Rows.map(row => ({ ...row, Cells: row.Cells.map((cell, i) => i === 1
    ? { ...cell, Available: false, Value: null, ExactValue: null, FormattedValue: null } : cell) }))
  const result = normalizePlannedCashReport(report, plannedCashTestRequest())
  expect(result.Proof.Requests).toEqual(report.Proof.Requests)
  expect(result.Totals[1]).toMatchObject({ Available: false, Value: null, ExactValue: null, FormattedValue: null })
  expect(result.CurrentAvailable).toBe(true)
})

it.each([-1, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])('refuses an invalid completed-month count %s', count => {
  const report = plannedCashReport(); report.Proof.Current.CompletedMovementMonths = count
  expect(() => normalizePlannedCashReport(report, plannedCashTestRequest())).toThrow('непідтверджений результат')
})
