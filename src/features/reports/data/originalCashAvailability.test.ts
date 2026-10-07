import { expect, it } from 'vitest'
import { availabilityDateError, availabilityDateInput, availabilityRequest, availabilityCatalogueMatches, isAvailabilityCapability, normalizeAvailabilityResult, readAvailabilityFilter, availabilityOwnMeasures, availabilityManagementMeasures, availabilityFields, availabilityDefinition } from './originalCashAvailability'
import { availabilityDisplay, readAvailabilityNumber, readAvailabilityAmounts, sumAvailability } from './originalCashAvailabilityMoney'
import { availabilityCapabilityFixture, availabilityResultFixture, availabilityPartialFixture, availabilityPoint, availabilityNumberFixture } from './originalCashAvailability.fixtures'
const request = () => availabilityRequest(availabilityCapabilityFixture(), availabilityPoint, [], [], false)
it('default request preserves the exact native whole second and empty axes with five own measures', () => {
  const capability = availabilityCapabilityFixture(), value = request()
  expect(isAvailabilityCapability(capability)).toBe(true); expect(value).toMatchObject({ DateKon: availabilityPoint, Filters: [], RowDimensions: [], IncludeManagement: false })
  expect(normalizeAvailabilityResult(availabilityResultFixture(value), value).Table).toEqual({ Columns: [...availabilityOwnMeasures], Rows: [['100.00', '20.00', '5.00', '10.00', '75.00']] })
  expect(availabilityDateInput('2026-10-06T12:34')).toBe('2026-10-06T12:34:00'); expect(availabilityDateInput(availabilityPoint)).toBe(availabilityPoint)
})
it.each(['2026-02-29T12:00:00', '2026-10-06', '2026-10-06T12:34:56Z', '2026-10-06T12:34:56.001', '2026-10-06T24:00:00', '1899-12-31T23:59:59', '3999-01-01T00:00:00'])('refuses invalid or timezone-adapted native point %s', value => {
  expect(availabilityDateError(value)).not.toBeNull(); expect(() => availabilityRequest(availabilityCapabilityFixture(), value, [], [], false)).toThrow()
})
it('accepts real leap days without calendar end or timezone adjustments', () => { expect(availabilityDateError('2024-02-29T00:00:00')).toBeNull(); expect(availabilityDateError('2026-10-06T23:59:59')).toBeNull() })
it('typed bank and cash references remain distinct and detached while wrong aliases refuse', () => {
  const value = availabilityResultFixture().Choices[2].Value, cash = { ...value, Table: '00000038' }, filters = [value, cash], dimensions = [availabilityFields[2]]
  const result = availabilityRequest(availabilityCapabilityFixture(), availabilityPoint, filters, dimensions, true)
  expect(result.Filters).toEqual(filters); expect(result.Filters[0]).not.toBe(value); dimensions.length = 0; expect(result.RowDimensions).toEqual([availabilityFields[2]])
  expect(() => readAvailabilityFilter({ ...value, Type: '01' })).toThrow(); expect(() => readAvailabilityFilter({ ...value, Table: '00000001' })).toThrow()
  expect(() => readAvailabilityFilter({ ...value, Field: 'Unknown' })).toThrow(); expect(() => readAvailabilityFilter({ ...value, Reference: 'b'.repeat(32) })).toThrow()
})
it('duplicate selections axes and foreign capabilities cannot create requests', () => {
  const filter = availabilityResultFixture().Choices[0].Value
  expect(() => availabilityRequest(availabilityCapabilityFixture(), availabilityPoint, [filter, filter], [], false)).toThrow()
  expect(() => availabilityRequest(availabilityCapabilityFixture(), availabilityPoint, [], [availabilityFields[0], availabilityFields[0]], false)).toThrow()
  expect(isAvailabilityCapability({ ...availabilityCapabilityFixture(), DefaultMeasures: [...availabilityManagementMeasures] })).toBe(false)
  expect(isAvailabilityCapability({ ...availabilityCapabilityFixture(), NativeVirtualTableVerified: true })).toBe(false)
})
it('all four exact selectors and optional management measures retain returned grouping and unit', () => {
  const filters = availabilityResultFixture().Choices.map(v => v.Value), value = availabilityRequest(availabilityCapabilityFixture(), availabilityPoint, filters, [availabilityFields[2]], true)
  const result = normalizeAvailabilityResult(availabilityResultFixture(value), value)
  expect(result.Table.Columns).toEqual([availabilityFields[2], ...availabilityOwnMeasures, ...availabilityManagementMeasures]); expect(result.Table.Rows[0]).toEqual(['Наш рахунок', '100.00', '20.00', '5.00', '10.00', '75.00', '200.00', '40.00', '10.00', '20.00', '150.00'])
})
it('partial normal inputs preserve known amounts and null free value instead of zero', () => {
  const result = normalizeAvailabilityResult(availabilityPartialFixture(), request())
  expect(result.Available).toBe(false); expect(result.Table.Rows[0]).toEqual(['100.00', null, '5.00', '10.00', null]); expect(result.Rows[0].Own.Free).toBeNull()
})
it('unbound unavailable response cannot smuggle old rows or a completed export table', () => {
  const value = availabilityResultFixture(), missing = { ...value, Available: false, Code: 'original_cash_availability_family_unavailable', NormalInputsComplete: false,
    OurSnapshotVerified: false, InputWitnessSha256: null, ResultSha256: null, Rows: [], Choices: [], OwnTotals: null, ManagementTotals: null, Table: { Columns: [], Rows: [] } }
  expect(normalizeAvailabilityResult(missing, request()).Rows).toEqual([]); expect(() => normalizeAvailabilityResult({ ...missing, Table: value.Table }, request())).toThrow()
})
it('response must belong to exact point selection and complete returned table', () => {
  const value = availabilityResultFixture()
  expect(() => normalizeAvailabilityResult({ ...value, DateKon: '2026-10-06T12:34:57' }, request())).toThrow()
  expect(() => normalizeAvailabilityResult({ ...value, Table: { ...value.Table, Rows: [['100.00', '20.00', '5.00', '10.00', '76.00']] } }, request())).toThrow()
  expect(() => normalizeAvailabilityResult({ ...value, InputWitnessSha256: null }, request())).toThrow()
  const selected = availabilityRequest(availabilityCapabilityFixture(), availabilityPoint, [{ ...value.Choices[0].Value, Reference: 'F'.repeat(32) }], [], false)
  expect(() => normalizeAvailabilityResult({ ...value, Filters: selected.Filters }, selected)).toThrow()
})
it('native money uses exact large rational values and final half-away rounding', () => {
  expect(readAvailabilityNumber(availabilityNumberFixture('900719925474099298', '100'))?.Display).toBe('9007199254740992.98')
  expect(availabilityDisplay(-1n, 200n)).toBe('-0.01'); expect(availabilityDisplay(1n, 200n)).toBe('0.01')
  expect(sumAvailability([availabilityNumberFixture('1', '3'), availabilityNumberFixture('1', '6')])).toEqual({ Numerator: '1', Denominator: '2', Display: '0.50' })
  expect(() => readAvailabilityNumber({ Numerator: '1', Denominator: '0', Display: '0.00' })).toThrow()
  expect(() => readAvailabilityNumber({ Numerator: '1', Denominator: '200', Display: '0.00' })).toThrow()
  expect(() => readAvailabilityAmounts({ ...availabilityResultFixture().Rows[0].Own, Free: availabilityNumberFixture('76') })).toThrow()
})
it('only exact original Fenix catalogue identity can launch availability', () => {
  const report = { Id: `builtin:${availabilityDefinition.name}`, Name: availabilityDefinition.name, Title: 'Доступні кошти', Kind: 'builtin', Sources: [{ World: 'fenix', SourceId: availabilityDefinition.source, DefinitionSha256: availabilityDefinition.definition, Attributes: [] }] }
  expect(availabilityCatalogueMatches(report, ['fenix'])).toBe(true); expect(availabilityCatalogueMatches(report, ['amg'])).toBe(false)
  expect(availabilityCatalogueMatches({ ...report, Id: 'builtin:ДенежныеСредства' }, ['fenix'])).toBe(false)
})

it('missing management FX does not erase a complete own-only result and optional conversion stays unknown', () => {
  const value = availabilityResultFixture(), unknown = { Current: null, Writeoff: null, Receipts: null, Reserve: null, Free: null }
  const ownOnly = { ...value, ManagementCurrencyId: null, ManagementCurrencySourceReference: null, ManagementCurrency: null,
    Rows: [{ ...value.Rows[0], Management: unknown }], ManagementTotals: { ...value.ManagementTotals!, Amounts: unknown }, UnavailableInputs: ['normal_cash_management_currency_unknown'] }
  expect(normalizeAvailabilityResult(ownOnly, request()).Available).toBe(true)
  const managed = availabilityRequest(availabilityCapabilityFixture(), availabilityPoint, [], [], true)
  const incomplete = { ...ownOnly, ...managed, Available: false, Code: 'original_cash_availability_inputs_incomplete', Table: { Columns: [...availabilityOwnMeasures, ...availabilityManagementMeasures], Rows: [['100.00', '20.00', '5.00', '10.00', '75.00', null, null, null, null, null]] } }
  expect(normalizeAvailabilityResult(incomplete, managed).ManagementTotals?.Amounts.Free).toBeNull()
})
it('complete empty server census may return zero while incomplete empty census remains null', () => {
  const value = availabilityResultFixture(), zero = { Current: availabilityNumberFixture('0'), Writeoff: availabilityNumberFixture('0'), Receipts: availabilityNumberFixture('0'), Reserve: availabilityNumberFixture('0'), Free: availabilityNumberFixture('0') }
  const empty = { ...value, Rows: [], Choices: [], OwnTotals: { Amounts: zero, MixedOwnCurrencies: false, Currencies: [] }, ManagementTotals: { Amounts: zero, MixedOwnCurrencies: false, Currencies: [] }, Table: { Columns: [...availabilityOwnMeasures], Rows: [['0.00', '0.00', '0.00', '0.00', '0.00']] } }
  expect(normalizeAvailabilityResult(empty, request()).OwnTotals?.Amounts.Free?.Display).toBe('0.00')
  const unknown = { Current: null, Writeoff: null, Receipts: null, Reserve: null, Free: null }
  const incomplete = { ...empty, Available: false, NormalInputsComplete: false, Code: 'original_cash_availability_inputs_incomplete', OwnTotals: { ...empty.OwnTotals, Amounts: unknown }, ManagementTotals: { ...empty.ManagementTotals, Amounts: unknown }, Table: { Columns: [...availabilityOwnMeasures], Rows: [[null, null, null, null, null]] } }
  expect(normalizeAvailabilityResult(incomplete, request()).Table.Rows[0]).toEqual([null, null, null, null, null])
})

it('total currency witnesses cannot erase or substitute the account unit or mixed-currency attribution', () => {
  const value = availabilityResultFixture()
  expect(() => normalizeAvailabilityResult({ ...value, OwnTotals: { ...value.OwnTotals!, Currencies: [] } }, request())).toThrow()
  expect(() => normalizeAvailabilityResult({ ...value, OwnTotals: { ...value.OwnTotals!, MixedOwnCurrencies: true } }, request())).toThrow()
  expect(() => normalizeAvailabilityResult({ ...value, ManagementTotals: { ...value.ManagementTotals!, Currencies: [{ ...value.ManagementTotals!.Currencies[0], Code: 'EUR' }] } }, request())).toThrow()
})
