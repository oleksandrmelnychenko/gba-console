import { expect, it } from 'vitest'
import { cashMovementsFilters, cashMovementsRequest, cashMovementsRequestFields, emptyCashMovementsSelection, isCashMovementsCapability,
  normalizeCashMovements } from './originalCashMovements'
import { cashBank, cashBox, cashKind1, cashMovementsCapability, cashMovementsResponse, cashParty, cashRef, emptyCashMovements, unavailableCashMovements } from '../testing/originalCashMovementsFixtures'
const request = () => cashMovementsRequest(cashMovementsCapability, '2026-09-10', '2026-09-12')
it('binds the exact original default with eight filters, four levels, money-kind columns and both fixed resources', () => {
  expect(isCashMovementsCapability(cashMovementsCapability)).toBe(true)
  expect(request()).toEqual({ Version: 1, World: 'fenix', SourceId: cashMovementsCapability.SourceId, DefinitionSha256: cashMovementsCapability.DefinitionSha256,
    From: '2026-09-10', Through: '2026-09-12', Currencies: [], MoneyKinds: [], Directions: [], Organizations: [], Accounts: [], Articles: [], Projects: [], Counterparties: [] })
  expect(normalizeCashMovements(cashMovementsResponse(), request()).Rows[0].Key).toBe('NULL')
})
it.each(['World', 'SourceId', 'DefinitionSha256', 'ModuleSha256', 'UniversalModuleSha256', 'DefaultScopeCode', 'MoneyPolicy', 'DatePolicy', 'ZeroRowPolicy', 'EmptyCellPolicy', 'SourceParityVerified'])(
  'rejects foreign capability scope or unsupported policy %s', field => {
    expect(isCashMovementsCapability({ ...cashMovementsCapability, [field]: 'foreign' })).toBe(false)
  })
it('rejects missing filters, reordered source rows, altered resource semantics and extra comparisons', () => {
  expect(isCashMovementsCapability({ ...cashMovementsCapability, Filters: cashMovementsFilters.slice(0, 7) })).toBe(false)
  expect(isCashMovementsCapability({ ...cashMovementsCapability, DefaultRows: [...cashMovementsCapability.DefaultRows].reverse() })).toBe(false)
  expect(isCashMovementsCapability({ ...cashMovementsCapability, MeasureDefinitions: [] })).toBe(false)
  expect(isCashMovementsCapability({ ...cashMovementsCapability, ComparisonOperators: ['Equal', 'InList', 'Greater'] })).toBe(false)
  expect(() => cashMovementsRequest({ ...cashMovementsCapability, Executable: false }, '2026-09-10', '2026-09-12')).toThrow()
})
it('detaches and sorts all eight selectors while preserving full bank, cashbox and counterparty types', () => {
  const selected = emptyCashMovementsSelection()
  for (const field of cashMovementsFilters) selected[field] = cashMovementsResponse().Choices[field].map(c => c.Key).reverse()
  const value = cashMovementsRequest(cashMovementsCapability, '2026-09-10', '2026-09-12', selected)
  expect(value.Accounts).toEqual([cashBank, cashBox]); expect(value.Counterparties).toEqual([cashParty]); expect(value.Currencies).toContain('NULL')
  for (const field of cashMovementsFilters) { expect(value[cashMovementsRequestFields[field]]).toEqual([...selected[field]].sort()); selected[field].length = 0 }
  expect(value.Accounts).toEqual([cashBank, cashBox]); expect(value.MoneyKinds).toHaveLength(2)
})
it('NULL is an explicit currency only; collapsed or lower-case compound identities are rejected', () => {
  const selected = emptyCashMovementsSelection(); selected.ВалютаДенежныхСредств = ['NULL']
  expect(cashMovementsRequest(cashMovementsCapability, '2026-09-10', '2026-09-12', selected).Currencies).toEqual(['NULL'])
  selected.ВидДенежныхСредств = ['NULL']; expect(() => cashMovementsRequest(cashMovementsCapability, '2026-09-10', '2026-09-12', selected)).toThrow()
  selected.ВидДенежныхСредств = []; selected.БанковскийСчетКасса = [cashRef(1)]; expect(() => cashMovementsRequest(cashMovementsCapability, '2026-09-10', '2026-09-12', selected)).toThrow()
  selected.БанковскийСчетКасса = [cashBank.toLowerCase()]; expect(() => cashMovementsRequest(cashMovementsCapability, '2026-09-10', '2026-09-12', selected)).toThrow()
})
it('duplicate, excessive and unrecognized selectors fail before any API call', () => {
  const selected = emptyCashMovementsSelection(); selected.ВидДенежныхСредств = [cashKind1, cashKind1]
  expect(() => cashMovementsRequest(cashMovementsCapability, '2026-09-10', '2026-09-12', selected)).toThrow()
  selected.ВидДенежныхСредств = Array.from({ length: 257 }, (_, i) => cashRef(i))
  expect(() => cashMovementsRequest(cashMovementsCapability, '2026-09-10', '2026-09-12', selected)).toThrow()
  const unknown = Object.assign(emptyCashMovementsSelection(), { Unknown: [] })
  expect(() => cashMovementsRequest(cashMovementsCapability, '2026-09-10', '2026-09-12', unknown)).toThrow()
})
it.each([['2026-02-30', '2026-03-01'], ['2026-09-12', '2026-09-10'], ['2026-09-10', '2027-09-10'], ['1999-12-31', '2000-01-01']])(
  'rejects invalid or oversized calendar range %s through %s', (from, through) => {
    expect(() => cashMovementsRequest(cashMovementsCapability, from, through)).toThrow()
  })
it.each([...cashMovementsFilters])('binds the complete response to the current %s selector echo', field => {
  const changed = cashMovementsResponse(); changed.Selectors[field] = [changed.Choices[field][0].Key]
  expect(() => normalizeCashMovements(changed, request())).toThrow()
})
it('retains numeric zero after cancellation while keeping absent money-kind cells NULL', () => {
  const result = normalizeCashMovements(cashMovementsResponse(), request())
  expect(result.Rows[0].Values).toEqual({ СуммаОборот: '0.00', СуммаУпрОборот: '0.00' })
  expect(result.Rows[0].ByMoneyKind[cashMovementsResponse().Columns[1].Key]).toEqual({ СуммаОборот: null, СуммаУпрОборот: null })
  expect(result.ManagementCurrency).toEqual({ Reference: cashRef(10), Code: '980', Marked: '01' })
})
it('validates exact money strings without rounding large totals or recalculating server subtotals', () => {
  const value = cashMovementsResponse(); value.Totals!.Values.СуммаОборот = '-1234567890123456789.01'
  expect(normalizeCashMovements(value, request()).Totals!.Values.СуммаОборот).toBe('-1234567890123456789.01')
})
it.each(['-0.00', '01.00', '1e3', '12.3', '12', ' 12.00'])(
  'rejects noncanonical stored money %s', value => {
    const changed = cashMovementsResponse(); changed.Rows[0].Values.СуммаОборот = value
    expect(() => normalizeCashMovements(changed, request())).toThrow()
  })
it('refuses missing pivot cells, mismatched NULL pairs and unknown resource fields', () => {
  const absent = cashMovementsResponse(); delete absent.Rows[0].ByMoneyKind[cashKind1]; expect(() => normalizeCashMovements(absent, request())).toThrow()
  const mixed = cashMovementsResponse(); mixed.Rows[0].ByMoneyKind[cashKind1].СуммаОборот = null; expect(() => normalizeCashMovements(mixed, request())).toThrow()
  const extra = cashMovementsResponse(); Object.assign(extra.Totals!.Values, { Other: '1.00' }); expect(() => normalizeCashMovements(extra, request())).toThrow()
})
it('validates four levels and full sibling tuples without conflating a bank and cashbox sharing one RRef', () => {
  const changed = cashMovementsResponse(), row = changed.Rows[0]
  row.Children[0].Field = 'СтатьяДвиженияДенежныхСредств'; expect(() => normalizeCashMovements(changed, request())).toThrow()
  const duplicate = cashMovementsResponse(); duplicate.Rows.push(structuredClone(duplicate.Rows[0])); expect(() => normalizeCashMovements(duplicate, request())).toThrow()
  const truncated = cashMovementsResponse(); truncated.Rows[0].Children = []; expect(() => normalizeCashMovements(truncated, request())).toThrow()
  expect(cashBank.slice(12)).toBe(cashBox.slice(12)); expect(cashBank).not.toBe(cashBox)
})
it('selected hierarchy and money-kind keys cannot admit foreign rows despite a matching filter echo', () => {
  const selected = emptyCashMovementsSelection(); selected.БанковскийСчетКасса = [cashBank]
  const scoped = cashMovementsRequest(cashMovementsCapability, '2026-09-10', '2026-09-12', selected), changed = cashMovementsResponse()
  changed.Selectors = selected; expect(() => normalizeCashMovements(changed, scoped)).toThrow()
  selected.БанковскийСчетКасса = []; selected.ВидДенежныхСредств = [cashKind1]
  expect(() => normalizeCashMovements(changed, cashMovementsRequest(cashMovementsCapability, '2026-09-10', '2026-09-12', selected))).toThrow()
})
it('complete empty, unavailable parents and numeric cancellation are three distinct states', () => {
  expect(normalizeCashMovements(emptyCashMovements(), request()).Totals!.Values.СуммаОборот).toBeNull()
  expect(normalizeCashMovements(unavailableCashMovements(), request()).Totals).toBeNull()
  const fabricated = unavailableCashMovements(); fabricated.Totals = emptyCashMovements().Totals
  expect(() => normalizeCashMovements(fabricated, request())).toThrow()
  const invalidEmpty = emptyCashMovements(); invalidEmpty.Totals!.Values.СуммаОборот = '0.00'; invalidEmpty.Totals!.Values.СуммаУпрОборот = '0.00'
  expect(() => normalizeCashMovements(invalidEmpty, request())).toThrow()
})
it('keeps missing normal captions and all amounts, then detaches the completed result', () => {
  const value = cashMovementsResponse(); value.Rows[0].Caption = 'Назва недоступна'; value.Rows[0].CaptionAvailable = false; value.MissingCaptionMappings = ['ВалютаДенежныхСредств']
  const result = normalizeCashMovements(value, request()); value.Rows.length = 0
  expect(result.Rows).toHaveLength(2); expect(result.Rows[0].CaptionAvailable).toBe(false); expect(result.Rows[0].Values.СуммаОборот).toBe('0.00')
})
it('requires genuine complete Snapshot witness and management currency before displaying any money', () => {
  for (const patch of [{ OurSnapshotVerified: false }, { InputWitnessSha256: null }, { ManagementCurrency: null }, { NormalInputsComplete: false }, { Dependency: { Kind: 'missing', MissingMonth: null } }])
    expect(() => normalizeCashMovements({ ...cashMovementsResponse(), ...patch }, request())).toThrow()
})
