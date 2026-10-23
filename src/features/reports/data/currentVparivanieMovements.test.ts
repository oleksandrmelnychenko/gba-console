import serverPreview from './currentVparivanieMovements.server-fixture.json'
import { movementDataset, movementPreview } from './currentVparivanieMovements.test-fixtures'
import { describe, expect, it } from 'vitest'
import { currentVparivanieDataset, currentVparivaniePreview, currentVparivanieRequest } from './currentVparivanie.test-fixtures'
import { currentVparivanieConfigurationError } from './currentVparivanie'
import { bindMovementPreview, cloneMovementSelection, currentVparivanieMovementsAvailable, movementSelection } from './currentVparivanieMovements'
import { normalizeNativeReportPreview } from './nativeReportPreview'
import { retainStoredTemplateFields } from './reportTemplateDraft'

describe('physical movement selection', () => {
  it('requires explicit paired capability and preserves independent incoming/outgoing choices', () => {
    expect(currentVparivanieMovementsAvailable(currentVparivanieDataset)).toBe(false)
    expect(currentVparivanieMovementsAvailable(movementDataset)).toBe(true)
    const request = { ...currentVparivanieRequest(), currentVparivanieMovements: { Incoming: true, Outgoing: false } }
    expect(currentVparivanieConfigurationError(request, movementDataset)).toBeNull()
    expect(currentVparivanieConfigurationError(request, currentVparivanieDataset)).toMatch(/не підтримує/)
    expect(currentVparivanieConfigurationError({ ...request, dataSource: 2 })).toMatch(/лише/)
  })
  it.each([{}, { Incoming: true }, { Incoming: false, Outgoing: false }, { Incoming: 'true', Outgoing: false },
    { Incoming: true, Outgoing: false, Cost: true }])('refuses malformed selection %j', value => {
    expect(currentVparivanieConfigurationError({ ...currentVparivanieRequest(), currentVparivanieMovements: value })).toMatch(/Некоректний/)
  })
  it('restores saved selection exactly and removes it when toggled off or changing report', () => {
    const selected = { Incoming: true, Outgoing: false }
    const clone = cloneMovementSelection({ DataSource: 39, CurrentVparivanieMovements: selected })
    expect(clone).toEqual({ currentVparivanieMovements: selected })
    expect(movementSelection(clone)).toEqual(selected)
    expect(() => movementSelection({ ...clone, CurrentVparivanieMovements: selected })).toThrow()
    expect(retainStoredTemplateFields({ ...currentVparivanieRequest(), ...clone }, currentVparivanieRequest()).currentVparivanieMovements).toBeUndefined()
  })
})

describe('movement result evidence', () => {
  it('reads the real server HTTP serializer output including UTC capture metadata', () => {
    const preview = normalizeNativeReportPreview({ Preview: serverPreview })
    expect(preview.CurrentVparivanieMovements?.OldestCapturedAtUtc).toBe('2026-10-23T10:00:00Z')
    expect(preview.CurrentVparivanieMovements?.IncompleteProducts).toBe(1)
    expect(() => bindMovementPreview({ ...currentVparivanieRequest(), currentVparivanieMovements: { Incoming: true, Outgoing: true } }, preview)).not.toThrow()
  })
  it('accepts null optional metadata only when no movement measures are selected', () => {
    const old = { ...currentVparivaniePreview(), CurrentVparivanieMovements: null }
    expect(() => normalizeNativeReportPreview({ Preview: old })).not.toThrow()
    const selected = { ...movementPreview(), CurrentVparivanieMovements: null }
    expect(() => normalizeNativeReportPreview({ Preview: selected })).toThrow(/покриття/)
  })
  it('keeps incomplete quantities null and binds selected columns to requested measures', () => {
    const preview = normalizeNativeReportPreview({ Preview: movementPreview() })
    expect(preview.CurrentVparivanieMovements?.IncompleteProducts).toBe(1)
    expect(preview.Cells.slice(-2).every(cell => cell.Value.Kind === 'null')).toBe(true)
    expect(() => bindMovementPreview({ ...currentVparivanieRequest(), currentVparivanieMovements: { Incoming: true, Outgoing: true } }, preview)).not.toThrow()
    expect(() => bindMovementPreview({ ...currentVparivanieRequest(), currentVparivanieMovements: { Incoming: true, Outgoing: false } }, preview)).toThrow()
  })
  it('rejects unknown history represented as zero, wrong product and mismatched result hash', () => {
    const zero = movementPreview(); zero.Cells[4].Value = { Kind: 'decimal', Value: '0', Provenance: 'producerCell' }
    expect(() => normalizeNativeReportPreview({ Preview: zero })).toThrow(/покриття/)
    const otherProduct = movementPreview(); otherProduct.CurrentVparivanieMovements.ProductCoverage[0].ProductId = 999
    expect(() => normalizeNativeReportPreview({ Preview: otherProduct })).toThrow(/покриття/)
    const otherResult = movementPreview(); otherResult.CurrentVparivanieMovements.ResultSha256 = 'b'.repeat(64)
    expect(() => normalizeNativeReportPreview({ Preview: otherResult })).toThrow(/покриття/)
  })
  it('rejects missing metadata or selected columns rather than accepting an old server response', () => {
    const missing = movementPreview(); delete (missing as Partial<typeof missing>).CurrentVparivanieMovements
    expect(() => normalizeNativeReportPreview({ Preview: missing })).toThrow(/покриття/)
    const missingColumn = movementPreview(); missingColumn.Columns.pop(); missingColumn.Cells.pop()
    expect(() => normalizeNativeReportPreview({ Preview: missingColumn })).toThrow(/покриття/)
    expect(() => bindMovementPreview({ ...currentVparivanieRequest(), currentVparivanieMovements: { Incoming: true, Outgoing: false } }, normalizeNativeReportPreview({ Preview: currentVparivaniePreview() }))).toThrow()
  })
})
