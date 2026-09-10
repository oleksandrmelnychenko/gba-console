import { describe, expect, it } from 'vitest'
import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { actualPaymentRequestWire } from './paymentComparison.test-fixtures'
import { decodeReportWorkspaceDraft, encodeReportWorkspaceDraft, encodeReportWorkspaceSnapshot,
  reportWorkspaceDraftKey, REPORT_WORKSPACE_DRAFT_MAX_BYTES, type ReportWorkspaceDraft, type ReportWorkspaceSnapshot } from './reportWorkspaceDraft'

export function workspaceSnapshot(): ReportWorkspaceSnapshot {
  const data = { dataSource: 8, from: '', to: '2026-0', valuationClientAgreementId: 456246,
    sorted: { Row: [], Col: [], Measurements: [] }, selections: [{ IsChecked: false,
      SelectedField: { Name: '', Type: 0 }, FilterCondition: { Name: 'InGroup', Type: 6 }, Values: [] }],
    filterExpression: { Version: 77, Root: null, future: { enabled: false, id: 9007199254740991 } },
    threshold: { Version: 1, Percent: '' }, comparison: { from: '', to: '' }, future: [null, false, 0, ''] }
  return { name: '', data, measurements: [{ Name: 'Amount', IsChecked: false, SubList: [{ Name: 'Count', Type: 17, IsChecked: false }] }],
    activeTemplate: { Id: 'template-42', Revision: 7, Name: 'Договір', Data: structuredClone(data) }, previousPeriod: { from: '', to: '2026-' } }
}
function envelope(): ReportWorkspaceDraft { return { version: 1, ownerId: 'owner-42', savedAt: '2026-09-10T10:00:00.000Z', snapshot: workspaceSnapshot() } }

describe('bounded per-owner workspace draft codec', () => {
  it('round-trips incomplete settings, unknown versions, exact contract IDs, unchecked measurements and original template revision', () => {
    const value = envelope(); value.previousSnapshot = { ...workspaceSnapshot(), name: 'Перед заміною' }
    const encoded = encodeReportWorkspaceDraft(value)
    expect(encoded.ok).toBe(true)
    if (!encoded.ok) return
    expect(decodeReportWorkspaceDraft(encoded.value, 'owner-42')).toEqual({ ok: true, data: value })
    expect(encoded.data.snapshot).not.toBe(value.snapshot)
    expect(encoded.data.snapshot.activeTemplate).toMatchObject({ Id: 'template-42', Revision: 7 })
  })
  it('keeps routes out of the storage key and separates exact owner identities', () => {
    expect(reportWorkspaceDraftKey('a/b')).toBe('report-workspace-draft:v1:a%2Fb')
    expect(reportWorkspaceDraftKey('a/b')).not.toBe(reportWorkspaceDraftKey('a%2Fb'))
  })
  it('retains the actual normalized payment wire nulls and legacy exact string IDs, including disabled incomplete selections', () => {
    const source = { Id: 'payment-template', Revision: 8, Name: 'Платежі', UpdatedAtUtc: '2026-09-10T10:00:00Z', Data: {
      ...structuredClone(actualPaymentRequestWire), Selections: [
        { SelectedField: { Type: 9, Name: 'Contract' }, FilterCondition: { Type: 0, Name: 'Дорівнює' },
          IsChecked: null, Values: [{ Data: '{"Id":"9223372036854775807"}', Name: 'Точний договір' }] },
        { IsChecked: false, SelectedField: { Type: 1000 } },
      ],
    } }
    const normalized = normalizeSavedTemplate(source as unknown as Parameters<typeof normalizeSavedTemplate>[0])
    const value = envelope(); value.snapshot.activeTemplate = normalized
    value.snapshot.data.selections = [structuredClone(source.Data.Selections[0])] as unknown as typeof value.snapshot.data.selections
    const encoded = encodeReportWorkspaceDraft(value)
    expect(encoded.ok).toBe(true)
    if (!encoded.ok) return
    expect(decodeReportWorkspaceDraft(encoded.value, 'owner-42')).toEqual({ ok: true, data: value })
    expect(encoded.data.snapshot.activeTemplate?.Data.sorted.Measurements[0]).toMatchObject({ IsChecked: null, Name: null, ParentName: null })
    expect(encoded.data.snapshot.data.selections[0].Values[0]).toEqual(source.Data.Selections[0].Values![0])
    const rawMeasurements = structuredClone(value.snapshot); rawMeasurements.measurements[0].IsChecked = null as unknown as boolean
    expect(encodeReportWorkspaceSnapshot(rawMeasurements).ok).toBe(false)
    const unrenderable = structuredClone(value.snapshot); unrenderable.data = normalized.Data
    expect(encodeReportWorkspaceSnapshot(unrenderable).ok).toBe(false)
  })
  it('rejects unknown versions and owner mismatch without returning a candidate to apply', () => {
    expect(decodeReportWorkspaceDraft(JSON.stringify({ ...envelope(), version: 2 }), 'owner-42')).toEqual({ ok: false, reason: 'unsupported' })
    expect(decodeReportWorkspaceDraft(JSON.stringify(envelope()), 'other-owner')).toEqual({ ok: false, reason: 'owner-mismatch' })
  })
  it.each(['NaN', 'Infinity', '1e999', '9007199254740993', '9007199254740991.1', '-0', '1e-999'])('rejects nonfinite, lossy or signed-zero numeric token %s', token => {
    const raw = JSON.stringify(envelope()).replace('456246', token)
    expect(decodeReportWorkspaceDraft(raw, 'owner-42').ok).toBe(false)
  })
  it('rejects duplicate keys, sparse arrays, trailing input and malformed required structure', () => {
    const raw = JSON.stringify(envelope())
    for (const invalid of [raw.replace('"version":1', '"version":2,"version":1'), `${raw}null`, raw.replace('"Row":[]', '"Row":[,]'), raw.replace('"Row":[]', '"Row":null')]) {
      expect(decodeReportWorkspaceDraft(invalid, 'owner-42').ok).toBe(false)
    }
  })
  it('refuses report file URLs, executable/custom objects, cyclic values, getters and nonfinite state instead of sanitizing', () => {
    const cases: unknown[] = [NaN, Infinity, BigInt(1), new Date(), () => 1, Symbol('x'), { DocumentURL: '/files/private.xlsx' }, { PdfDocumentURL: '/files/private.pdf' }]
    const cycle: Record<string, unknown> = {}; cycle.self = cycle; cases.push(cycle)
    const getter = Object.defineProperty({}, 'x', { enumerable: true, get: () => { throw new Error('must not execute') } }); cases.push(getter)
    for (const future of cases) expect(encodeReportWorkspaceSnapshot({ ...workspaceSnapshot(), data: { ...workspaceSnapshot().data, future } } as ReportWorkspaceSnapshot).ok).toBe(false)
  })
  it('rejects unsafe array shapes while allowing omitted optional object properties', () => {
    const sparse = new Array(1)
    const shadowed = Object.assign(new Array(1), { hidden: false })
    for (const future of [sparse, shadowed, [undefined]]) expect(encodeReportWorkspaceSnapshot({ ...workspaceSnapshot(), data: { ...workspaceSnapshot().data, future } } as ReportWorkspaceSnapshot).ok).toBe(false)
    const valid = workspaceSnapshot(); valid.data.ordering = undefined
    const encoded = encodeReportWorkspaceSnapshot(valid)
    expect(encoded.ok).toBe(true)
    if (encoded.ok) expect(encoded.data.data).not.toHaveProperty('ordering')
  })
  it('bounds UTF-8 bytes for the complete envelope including the undo copy', () => {
    const value = envelope(); value.snapshot.name = 'ї'.repeat(300_000)
    expect(encodeReportWorkspaceDraft(value).ok).toBe(true)
    value.previousSnapshot = structuredClone(value.snapshot)
    expect(encodeReportWorkspaceDraft(value)).toEqual({ ok: false, reason: 'too-large' })
    expect(decodeReportWorkspaceDraft(' '.repeat(REPORT_WORKSPACE_DRAFT_MAX_BYTES + 1), 'owner-42')).toEqual({ ok: false, reason: 'too-large' })
  })
  it('rejects excessive depth, oversized arrays and forged envelope/result properties', () => {
    const value = envelope(); let future: unknown = null
    for (let depth = 0; depth < 70; depth++) future = { child: future }
    expect(decodeReportWorkspaceDraft(JSON.stringify({ ...value, snapshot: { ...value.snapshot, data: { ...value.snapshot.data, future } } }), 'owner-42').ok).toBe(false)
    expect(encodeReportWorkspaceSnapshot({ ...value.snapshot, data: { ...value.snapshot.data, future: Array(10001).fill(false) } } as ReportWorkspaceSnapshot).ok).toBe(false)
    expect(decodeReportWorkspaceDraft(JSON.stringify({ ...value, result: {} }), 'owner-42').ok).toBe(false)
    expect(decodeReportWorkspaceDraft(JSON.stringify({ ...value, savedAt: '2026-02-30T00:00:00.000Z' }), 'owner-42').ok).toBe(false)
    expect(decodeReportWorkspaceDraft(JSON.stringify(value).replace('"name":""', '"name":"","__proto__":{}'), 'owner-42').ok).toBe(false)
  })
})
