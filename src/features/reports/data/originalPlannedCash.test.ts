import { describe, expect, it } from 'vitest'
import { isPlannedCapability, normalizePlannedResult, plannedCatalogueVariant, plannedDefaultRows, plannedDefinitions, plannedFilterKey, plannedRequest, type PlannedVariant } from './originalPlannedCash'
import { plannedCsv, plannedExportError, plannedMatrix, plannedPdfDefinition, plannedValues } from './originalPlannedCashExport'
import { plannedCapabilityFixture, plannedResultFixture } from './originalPlannedCash.fixtures'
describe('exact original planned period delivery', () => {
  it.each(['receipts', 'payout-requests'] as PlannedVariant[])('keeps own %s definition default form and resource-major twelve measures', variant => {
    const capability = plannedCapabilityFixture(variant), definition = plannedDefinitions[variant]
    expect(isPlannedCapability(capability)).toBe(true)
    expect(plannedRequest(capability, '2026-09-01', '2026-09-30').Rows).toEqual(plannedDefaultRows)
    expect(plannedCatalogueVariant({ Id: `builtin:${definition.name}`, Name: definition.name, Title: '', Kind: 'builtin', Sources: [{ World: 'fenix', SourceId: definition.source, DefinitionSha256: definition.definition, Attributes: [] }] }, ['fenix'])).toBe(variant)
    expect(isPlannedCapability({ ...capability, ModuleSha256: plannedDefinitions[variant === 'receipts' ? 'payout-requests' : 'receipts'].module })).toBe(false)
  })
  it('does not launch a custom DDS alias AMG source or wrong retained definition', () => {
    const definition = plannedDefinitions.receipts, source = { World: 'amg', SourceId: definition.source, DefinitionSha256: definition.definition, Attributes: [] }
    expect(plannedCatalogueVariant({ Id: `builtin:${definition.name}`, Name: definition.name, Title: '', Kind: 'builtin', Sources: [source] }, ['amg'])).toBeNull()
    expect(plannedCatalogueVariant({ Id: 'custom:DDS', Name: definition.name, Title: '', Kind: 'custom', Sources: [{ ...source, World: 'fenix' }] }, ['fenix'])).toBeNull()
  })
  it('copies filters refuses bare compound refs and does not truncate more than256 selections', () => {
    const capability = plannedCapabilityFixture(), filters = [{ Field: 'Counterparty' as const, Type: null, Table: null, Reference: 'A'.repeat(32) }]
    const query = plannedRequest(capability, '2026-09-01', '2026-09-30', ['Counterparty'], filters)
    filters[0].Reference = 'B'.repeat(32); expect(query.Filters[0].Reference).toBe('A'.repeat(32))
    expect(() => plannedRequest(capability, query.From, query.Through, ['Counterparty'], Array(257).fill(filters[0]))).toThrow()
    expect(() => plannedRequest(capability, query.From, query.Through, ['Project'], [{ Field: 'Project', Reference: 'A'.repeat(32), Type: null, Table: null }])).toThrow()
  })
  it('keeps exact signed cents beyond JS precision for all resources and same full CSV PDF matrix', () => {
    const capability = plannedCapabilityFixture(), query = plannedRequest(capability, '2026-09-01', '2026-09-30', ['Counterparty'])
    const result = normalizePlannedResult(plannedResultFixture(), query), matrix = plannedMatrix(result)
    expect(matrix[0]).toHaveLength(14); expect(matrix.at(-1)?.slice(2)).toEqual(plannedValues(result.Totals!))
    expect(matrix[0].slice(2, 6)).toEqual(['Взаєморозрахунки · Початковий залишок', 'Взаєморозрахунки · Надходження', 'Взаєморозрахунки · Витрати', 'Взаєморозрахунки · Кінцевий залишок'])
    expect(plannedPdfDefinition(result).content.find(row => 'table' in row)?.table?.body).toEqual(matrix)
    expect(plannedCsv(result)).toContain('"-900719925474099290.97"'); expect(plannedCsv(result)).not.toContain('A'.repeat(32))
  })
  it('refuses partial month foreign role and missing header witness instead of zero or partial exports', () => {
    const query = plannedRequest(plannedCapabilityFixture(), '2026-09-01', '2026-09-30', ['Counterparty']), value = plannedResultFixture()
    expect(() => normalizePlannedResult({ ...value, NormalInputsComplete: false }, query)).toThrow()
    expect(() => normalizePlannedResult(plannedResultFixture('payout-requests'), query)).toThrow()
    const defaults = plannedRequest(plannedCapabilityFixture(), query.From, query.Through)
    expect(() => normalizePlannedResult({ ...value, Grouping: defaults.Rows }, defaults)).toThrow()
  })
  it('accepts complete empty relation only as no rows and null totals, retains genuine zero groups', () => {
    const query = plannedRequest(plannedCapabilityFixture(), '2026-09-01', '2026-09-30', ['Counterparty']), value = plannedResultFixture()
    const empty = normalizePlannedResult({ ...value, Rows: [], Choices: [], Totals: null }, query)
    expect(plannedMatrix(empty)).toHaveLength(1); expect(plannedExportError(empty)).toBeNull()
    expect(() => normalizePlannedResult({ ...empty, Totals: value.Totals }, query)).toThrow()
    const zero = { Opening: '0.00', Incoming: '0.00', Outgoing: '0.00', Closing: '0.00' }, resources = { Settlement: zero, Management: zero, Cash: zero }
    expect(normalizePlannedResult({ ...value, Rows: [{ ...value.Rows[0], ...resources }], Totals: resources }, query).Rows).toHaveLength(1)
  })
  it('detects duplicate complete key regardless of JSON member order or extra members', () => {
    const query = plannedRequest(plannedCapabilityFixture(), '2026-09-01', '2026-09-30', ['Counterparty']), value = plannedResultFixture(), first = value.Rows[0]
    const key = first.Key[0], reordered = { Reference: key.Reference, Caption: key.Caption, Table: key.Table, Field: key.Field, Type: key.Type, unused: 'extra' }
    value.Rows.push({ ...first, Key: [reordered] })
    expect(() => normalizePlannedResult(value, query)).toThrow()
    expect(plannedFilterKey(key)).toBe(plannedFilterKey(reordered))
  })
  it('refuses inconsistent closing and mismatched aggregate independently', () => {
    const query = plannedRequest(plannedCapabilityFixture(), '2026-09-01', '2026-09-30', ['Counterparty']), value = plannedResultFixture()
    expect(() => normalizePlannedResult({ ...value, Rows: [{ ...value.Rows[0], Cash: { ...value.Rows[0].Cash, Closing: '0.00' } }] }, query)).toThrow()
    const zero = { Opening: '0.00', Incoming: '0.00', Outgoing: '0.00', Closing: '0.00' }
    expect(() => normalizePlannedResult({ ...value, Totals: { ...value.Totals!, Cash: zero } }, query)).toThrow()
  })
  it('refuses wrong response filters and current-caption choices on unrelated fields', () => {
    const query = plannedRequest(plannedCapabilityFixture(), '2026-09-01', '2026-09-30', ['Counterparty']), value = plannedResultFixture()
    expect(() => normalizePlannedResult({ ...value, Filters: [{ Field: 'Counterparty', Type: null, Table: null, Reference: 'B'.repeat(32) }] }, query)).toThrow()
    expect(() => normalizePlannedResult({ ...value, Choices: [{ ...value.Choices[0], Field: 'FormOfPayment' }] }, query)).toThrow()
  })
  it('keeps unavailable payload closed with no financial rows or invented proof', () => {
    const query = plannedRequest(plannedCapabilityFixture(), '2026-09-01', '2026-09-30', ['Counterparty']), value = plannedResultFixture()
    const missing = { ...value, Available: false, Code: 'original_planned_cash_month_publication_unavailable', Rows: [], Choices: [], Totals: null, InputWitnessSha256: null, ResultSha256: null }
    expect(normalizePlannedResult(missing, query).Available).toBe(false)
    expect(() => plannedMatrix(missing)).toThrow(); expect(() => normalizePlannedResult({ ...missing, Rows: value.Rows }, query)).toThrow()
  })
  it('escapes human labels preserves negative numeric values and refuses an oversized complete matrix', () => {
    const value = plannedResultFixture(); value.Rows[0].Key[0].Caption = '=2+2'
    expect(plannedCsv(value)).toContain("'" + '=2+2'); expect(plannedCsv(value)).toContain('"-900719925474099290.97"')
    value.Rows = Array(71_428).fill(value.Rows[0]); expect(plannedExportError(value)).not.toBeNull(); expect(() => plannedMatrix(value)).toThrow()
  })
})
