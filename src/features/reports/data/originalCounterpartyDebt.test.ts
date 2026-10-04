import { expect, it } from 'vitest'
import { debtCapability, debtResponse, emptyDebt, org1, org2, party1, party2 } from '../testing/counterpartyDebtFixtures'
import { debtInstantError, debtRequest, isDebtCapability, normalizeDebt } from './originalCounterpartyDebt'
import { debtCsv, debtMatrix, debtPdfDefinition } from './originalCounterpartyDebtExport'
it('own original keeps management alone enabled and settlement explicitly optional', () => {
  expect(isDebtCapability(debtCapability)).toBe(true)
  expect(isDebtCapability({ ...debtCapability, DefaultMeasures: ['СуммаУпр', 'СуммаВзаиморасчетов'] })).toBe(false)
  expect(isDebtCapability({ ...debtCapability, World: 'amg' })).toBe(false)
})
it('explicit whole-second request carries both full binary equality filters and right-side switch', () => {
  const r = debtRequest(debtCapability, '2026-09-15T10:20:30', 2, true, [org1], [party1])
  expect(r).toMatchObject({ Organizations: [org1], Counterparties: [party1], DebtSwitch: 2, IncludeSettlement: true })
  expect(() => debtRequest(debtCapability, r.AsOf, 3)).toThrow()
  expect(() => debtRequest(debtCapability, r.AsOf, 0, false, [org1, org1])).toThrow()
})
it('invalid calendar, inferred timezone and subsecond endpoint are refused', () => {
  for (const v of ['2026-02-30T10:00:00', '2026-09-01', '2026-09-01T10:00:00Z', '2026-09-01T10:00:00.001']) expect(debtInstantError(v)).not.toBeNull()
  expect(debtInstantError('2024-02-29T23:59:59')).toBeNull()
})
it('complete result retains every signed unknown-caption row and both resource sums', () => {
  const r = normalizeDebt(debtResponse(), debtRequest(debtCapability, debtResponse().AsOf))
  expect(r.Rows).toHaveLength(2); expect(r.Rows[1].CaptionAvailable).toBe(false); expect(r.Totals?.Settlement).toBe('4.00')
})
it('nested conservation detects changed management or hidden settlement contribution', () => {
  for (const key of ['Management', 'Settlement'] as const) {
    const r = debtResponse(); r.Rows[0].Counterparties[0].Amounts = { ...r.Rows[0].Amounts, [key]: '999.00' }
    expect(() => normalizeDebt(r, debtRequest(debtCapability, r.AsOf))).toThrow()
  }
})
it('complete zero is admitted but missing monthly prefix cannot masquerade as a partial balance', () => {
  const zero = emptyDebt(); expect(normalizeDebt(zero, debtRequest(debtCapability, zero.AsOf)).Available).toBe(true)
  const missing = { ...zero, Available: false, NormalInputsComplete: false, Code: 'original_counterparty_debt_month_publication_unavailable',
    InputWitnessSha256: null, ResultSha256: null, Dependency: { OpeningRegister: 0, MovementBranch: 0, RequestedEndpoint: zero.AsOf, MissingMonth: '2026-09' } }
  expect(() => normalizeDebt(missing, debtRequest(debtCapability, zero.AsOf))).toThrow()
  expect(normalizeDebt({ ...missing, Totals: null }, debtRequest(debtCapability, zero.AsOf)).Dependency?.MovementBranch).toBe(0)
})
it('foreign date selector or new native parity assertion cannot reuse an old valid payload', () => {
  const r = debtResponse(), request = debtRequest(debtCapability, r.AsOf)
  for (const patch of [{ DebtSwitch: 1 }, { AsOf: '2026-09-16T10:20:30' }, { SourceParityVerified: true }, { AppliesFxConversion: true }])
    expect(() => normalizeDebt({ ...r, ...patch }, request)).toThrow()
})
it('same full matrix feeds screen and exports with optional resource only when selected', () => {
  const ordinary = debtResponse(), optional = debtResponse(true)
  expect(debtMatrix(ordinary)[0]).toHaveLength(3); expect(debtMatrix(optional)[0]).toHaveLength(4)
  expect(debtMatrix(optional).at(-1)).toEqual(['Разом', '', '60.00', '4.00'])
  expect(debtPdfDefinition(optional).content).toContainEqual(expect.objectContaining({ table: expect.objectContaining({ body: debtMatrix(optional) }) }))
  expect(debtCsv(optional)).toContain(optional.ResultSha256)
})
it('export escapes label formulas while preserving exact signed monetary text', () => {
  const r = debtResponse(true); r.Rows[0].Caption = '=unsafe'
  expect(debtCsv(r)).toContain(`"'=unsafe"`); expect(debtCsv(r)).toContain('"-6.00"')
})
it('large exact sums never pass through floating point arithmetic', () => {
  const r = emptyDebt(), amount = { Management: '999999999999999999999.00', Settlement: '-1.00' }
  r.Rows = [{ Organization: org1, Caption: 'Наша організація', CaptionAvailable: true, Amounts: amount, Counterparties: [{ Counterparty: party1, Caption: 'Наш контрагент', CaptionAvailable: true, Amounts: amount }] }]; r.Totals = amount
  expect(normalizeDebt(r, debtRequest(debtCapability, r.AsOf)).Totals).toEqual(amount)
})

it('same-time complete empty and missing payloads cannot substitute either selected equality filter', () => {
  const base = debtResponse(), request = debtRequest(debtCapability, base.AsOf, base.DebtSwitch, base.IncludeSettlement, [org1], [party1])
  base.Rows = [base.Rows[0]]; base.Totals = base.Rows[0].Amounts
  base.FilterSummary = ['Організації: Наша організація', 'Контрагенти: Наш контрагент', 'Вид заборгованості: усі', 'Типова управлінська сума']
  const missing = { ...emptyDebt(), Available: false, NormalInputsComplete: false, Code: 'original_counterparty_debt_month_publication_unavailable',
    Totals: null, InputWitnessSha256: null, ResultSha256: null,
    Dependency: { OpeningRegister: 0 as const, MovementBranch: 0 as const, RequestedEndpoint: request.AsOf, MissingMonth: '2026-09' } }
  for (const original of [base, emptyDebt(), missing]) {
    const bound = { ...original, Organizations: [...request.Organizations], Counterparties: [...request.Counterparties] }
    expect(normalizeDebt(bound, request)).toEqual(bound)
    for (const patch of [{ Organizations: [org2] }, { Counterparties: [party2] }, { Organizations: [] }, { Counterparties: undefined }])
      expect(() => normalizeDebt({ ...bound, ...patch }, request)).toThrow()
  }
})
