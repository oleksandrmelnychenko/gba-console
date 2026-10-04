import { describe, expect, it } from 'vitest'
import { cashCatalogueMatches, cashDefinition, cashFilterKey, cashRequest, isCashCapability, normalizeCashResult } from './originalCashStatement'
import { cashCapabilityFixture, cashResultFixture } from './originalCashStatement.fixtures'
import { cashCsv, cashExportError, cashMatrix, cashPdfDefinition, cashValues, cashXlsx } from './originalCashStatementExport'
import * as XLSX from 'xlsx'
describe('exact original977 cash period', () => {
  it('negotiates its own default8 optional2 and four filters without borrowing dataset40 or FX', () => {
    const capability = cashCapabilityFixture()
    expect(isCashCapability(capability)).toBe(true); expect(capability.DefaultMeasures).toHaveLength(8); expect(capability.TurnoverMeasures).toHaveLength(2)
    expect(isCashCapability({ ...capability, AppliesFxConversion: true })).toBe(false)
    expect(isCashCapability({ ...capability, DefaultRow: 'Currency' })).toBe(false)
    const report = { Id: `builtin:${cashDefinition.name}`, Name: cashDefinition.name, Title: '', Kind: 'builtin' as const,
      Sources: [{ World: 'fenix', SourceId: cashDefinition.source, DefinitionSha256: cashDefinition.definition, Attributes: [] }] }
    expect(cashCatalogueMatches(report, ['fenix'])).toBe(true)
    expect(cashCatalogueMatches({ ...report, Id: 'custom:DDS' }, ['fenix'])).toBe(false)
    expect(cashCatalogueMatches(report, ['amg'])).toBe(false)
  })
  it('copies all four full typed filters and refuses bare compound account duplicates or malformed periods', () => {
    const cap = cashCapabilityFixture(), choices = cashResultFixture().Choices, filters = choices.map(choice => ({ ...choice.Value })), query = cashRequest(cap, '2026-09-01', '2026-09-30', filters, true)
    filters[0].Reference = 'F'.repeat(32); expect(query.Filters[0].Reference).toBe('B'.repeat(32)); expect(query.Filters).toHaveLength(4); expect(query.IncludeTurnover).toBe(true)
    expect(() => cashRequest(cap, query.From, query.Through, [{ ...query.Filters[0], Type: null }], false)).toThrow()
    expect(() => cashRequest(cap, query.From, query.Through, [query.Filters[1], query.Filters[1]], false)).toThrow()
    expect(() => cashRequest(cap, '2026-02-30', query.Through, [], false)).toThrow()
  })
  it('keeps exact signed cents beyond JS precision and all exports use the full same calculation', async () => {
    const query = cashRequest(cashCapabilityFixture(), '2026-09-01', '2026-09-30', [], true), value = { ...cashResultFixture(), IncludeTurnover: true }, result = normalizeCashResult(value, query)
    const matrix = cashMatrix(result); expect(matrix[0]).toHaveLength(11); expect(matrix.at(-1)?.slice(1)).toEqual(cashValues(result.Totals!, true))
    expect(cashPdfDefinition(result).content.find(part => 'table' in part)?.table?.body).toEqual(matrix)
    expect(cashCsv(result)).toContain('"9007199254740990.97"'); expect(cashCsv(result)).toContain('"-2.01"'); expect(cashCsv(result)).not.toContain('B'.repeat(32))
    const blob = await cashXlsx(result), buffer = await new Promise<ArrayBuffer>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => { if (reader.result !== null && typeof reader.result !== 'string') resolve(reader.result); else reject(new Error('Expected workbook bytes')) }; reader.onerror = () => reject(reader.error); reader.readAsArrayBuffer(blob) }), workbook = XLSX.read(buffer, { type: 'array' })
    expect(XLSX.utils.sheet_to_json(workbook.Sheets['Відомість коштів'], { header: 1 })).toEqual(matrix)
  })
  it('detects duplicate full account grain regardless of JSON member order while different kinds remain distinct', () => {
    const query = cashRequest(cashCapabilityFixture(), '2026-09-01', '2026-09-30', [], false), value = cashResultFixture(), first = value.Rows[0]
    const reordered = { Reference: first.Account.Reference, Table: first.Account.Table, Type: first.Account.Type, unused: 'extra' }
    expect(() => normalizeCashResult({ ...value, Rows: [first, { ...first, Account: reordered }] }, query)).toThrow()
    const second = { ...first, Account: { ...first.Account, Table: '00000038' }, Caption: null }, doubled = { Own: { Opening: '18014398509481985.96', Incoming: '-6.04', Outgoing: '-2.02', Closing: '18014398509481981.94', Turnover: '-4.02' },
      Management: { Opening: '-16.00', Incoming: '4.08', Outgoing: '-0.04', Closing: '-11.88', Turnover: '4.12' } }
    expect(normalizeCashResult({ ...value, Rows: [first, second], Totals: doubled }, query).Rows).toHaveLength(2)
  })
  it('rejects wrong filter identity incomplete currency coverage and forged closing or aggregate independently', () => {
    const value = cashResultFixture(), filter = value.Choices[2].Value, query = cashRequest(cashCapabilityFixture(), value.From, value.Through, [filter], false)
    expect(() => normalizeCashResult(value, query)).toThrow()
    expect(() => normalizeCashResult({ ...value, Filters: [filter], CurrencyAttributeScopeComplete: false }, query)).toThrow()
    const raw = cashRequest(cashCapabilityFixture(), value.From, value.Through, [], false)
    expect(() => normalizeCashResult({ ...value, Rows: [{ ...value.Rows[0], Amounts: { ...value.Rows[0].Amounts, Own: { ...value.Rows[0].Amounts.Own, Closing: '0.00' } } }] }, raw)).toThrow()
    const zero = { Opening: '0.00', Incoming: '0.00', Outgoing: '0.00', Closing: '0.00', Turnover: '0.00' }
    expect(() => normalizeCashResult({ ...value, Totals: { Own: zero, Management: zero } }, raw)).toThrow()
  })
  it('complete empty means no rows/null totals and unavailable never invents financial rows or proof', () => {
    const value = cashResultFixture(), query = cashRequest(cashCapabilityFixture(), value.From, value.Through, [], false)
    expect(cashMatrix(normalizeCashResult({ ...value, Rows: [], Totals: null, Choices: [] }, query))).toHaveLength(1)
    expect(() => normalizeCashResult({ ...value, Rows: [] }, query)).toThrow()
    const missing = { ...value, Available: false, Code: 'original_cash_statement_month_publication_unavailable', NormalInputsComplete: false, Rows: [], Totals: null, Choices: [], InputWitnessSha256: null, ResultSha256: null }
    expect(normalizeCashResult(missing, query).Available).toBe(false); expect(() => cashMatrix(missing)).toThrow()
    expect(() => normalizeCashResult({ ...missing, Code: 'original_cash_statement_borrowed' }, query)).toThrow()
    expect(() => normalizeCashResult({ ...missing, Rows: value.Rows }, query)).toThrow()
  })
  it('keeps genuine labels tied to full tuples and never lets a forged caption replace an account name', () => {
    const value = cashResultFixture(), query = cashRequest(cashCapabilityFixture(), value.From, value.Through, [], false)
    expect(() => normalizeCashResult({ ...value, Rows: [{ ...value.Rows[0], Caption: 'Forged' }] }, query)).toThrow()
    const choice = value.Choices[0]; expect(cashFilterKey(choice.Value)).not.toBe(cashFilterKey({ ...choice.Value, Table: '00000038' }))
    expect(() => normalizeCashResult({ ...value, Choices: [choice, { ...choice, Caption: 'Second' }] }, query)).toThrow()
  })
  it('counts actual full export width before allocation and protects human labels without changing negative amounts', () => {
    const value = cashResultFixture(); value.Rows[0].Caption = '=2+2'
    expect(cashCsv(value)).toContain("'=2+2"); expect(cashCsv(value)).toContain('"-3.02"')
    value.IncludeTurnover = true; value.Rows = Array(90_909).fill(value.Rows[0])
    expect(cashExportError(value)).not.toBeNull(); expect(() => cashMatrix(value)).toThrow()
  })
})
