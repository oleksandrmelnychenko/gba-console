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
  function directionalPreview(incoming: boolean, outgoing: boolean) {
    const preview = movementPreview()
    Object.assign(preview.CurrentVparivanieMovements.ProductCoverage[0], {
      IncomingComplete: incoming, OutgoingComplete: outgoing, Reasons: ['UnconfirmedBatch'],
    })
    if (incoming) preview.Cells[4].Value = { Kind: 'decimal', Value: '12.5', Provenance: 'producerCell' }
    if (outgoing) preview.Cells[5].Value = { Kind: 'decimal', Value: '7', Provenance: 'producerCell' }
    return preview
  }
  it.each([[true, false], [false, true], [false, false]])('preserves independently known incoming=%s outgoing=%s without completing the product', (incoming, outgoing) => {
    const preview = normalizeNativeReportPreview({ Preview: directionalPreview(incoming, outgoing) })
    expect(preview.Cells[4].Value).toMatchObject(incoming ? { Kind: 'decimal', Value: '12.5' } : { Kind: 'null', Value: null })
    expect(preview.Cells[5].Value).toMatchObject(outgoing ? { Kind: 'decimal', Value: '7' } : { Kind: 'null', Value: null })
    expect(preview.CurrentVparivanieMovements?.IncompleteProducts).toBe(1)
    expect(preview.CurrentVparivanieMovements?.ProductCoverage[0]).toMatchObject({ Complete: false, IncomingComplete: incoming, OutgoingComplete: outgoing })
  })
  it.each([4, 5])('refuses fabricated zero in unknown direction column %s', index => {
    const preview = directionalPreview(index !== 4, index !== 5)
    preview.Cells[index].Value = { Kind: 'decimal', Value: '0', Provenance: 'producerCell' }
    expect(() => normalizeNativeReportPreview({ Preview: preview })).toThrow(/покриття/)
  })
  it.each([{}, { IncomingComplete: null, OutgoingComplete: null }, { IncomingComplete: null }])('keeps legacy absent/null flags conservative %j', flags => {
    const preview = movementPreview()
    Object.assign(preview.CurrentVparivanieMovements.ProductCoverage[0], flags, { Reasons: ['UnconfirmedBatch'] })
    expect(() => normalizeNativeReportPreview({ Preview: preview })).not.toThrow()
    preview.Cells[4].Value = { Kind: 'decimal', Value: '12.5', Provenance: 'producerCell' }
    expect(() => normalizeNativeReportPreview({ Preview: preview })).toThrow(/покриття/)
  })
  it.each([
    { IncomingComplete: true }, { OutgoingComplete: false },
    { IncomingComplete: true, OutgoingComplete: null },
    { IncomingComplete: 'true', OutgoingComplete: false },
    { IncomingComplete: true, OutgoingComplete: true },
    { IncomingComplete: true, OutgoingComplete: false, Complete: true, Reasons: [] },
  ])('refuses malformed or stale directional completeness %j', flags => {
    const preview = movementPreview()
    Object.assign(preview.CurrentVparivanieMovements.ProductCoverage[0], flags)
    expect(() => normalizeNativeReportPreview({ Preview: preview })).toThrow(/покриття/)
  })
  it.each([['history_period_uncovered'], ['UnconfirmedBatch', 'history_period_uncovered'], [], ['unconfirmed_batch']].map(reasons => ({ reasons })))('refuses partial known quantities for unapproved reason sets $reasons', ({ reasons }) => {
    const preview = directionalPreview(true, false)
    preview.CurrentVparivanieMovements.ProductCoverage[0].Reasons = reasons
    expect(() => normalizeNativeReportPreview({ Preview: preview })).toThrow(/покриття/)
  })
  it('retains complete paired evidence and rejects stale incomplete reasons', () => {
    const preview = directionalPreview(true, true)
    Object.assign(preview.CurrentVparivanieMovements.ProductCoverage[0], { Complete: true, Reasons: [] })
    preview.CurrentVparivanieMovements.IncompleteProducts = 0
    expect(() => normalizeNativeReportPreview({ Preview: preview })).not.toThrow()
    preview.CurrentVparivanieMovements.ProductCoverage[0].Reasons = ['UnconfirmedBatch']
    expect(() => normalizeNativeReportPreview({ Preview: preview })).toThrow(/покриття/)
  })
  it('retains explicit legacy bounded-preview parsing including UTC capture metadata', () => {
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
