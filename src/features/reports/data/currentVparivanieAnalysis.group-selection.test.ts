import { encodeReportWorkspaceDraft, decodeReportWorkspaceDraft } from './reportWorkspaceDraft'
import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { expect, it } from 'vitest'
import { analysisDataset, analysisRequest } from './currentVparivanieAnalysis.test-fixtures'
import { exactSelection } from './currentVparivanie.test-fixtures'
import { analysisFilterConditions, analysisGroupIdentity, analysisSelectionValueError, analysisValueIdentity, changeAnalysisSelectionCondition, currentVparivanieAnalysisLayoutError, validAnalysisFilterValue } from './currentVparivanieAnalysis'
import { isMultiValueReportCondition, REPORT_FILTER_CONDITIONS } from './reportOptions'

import { mixedDataset, groupDescriptor } from './currentVparivanieAnalysis.group-selection.test-fixtures'

it('offers four flat operators and eight real group operators only from capability', () => {
  expect(analysisFilterConditions(mixedDataset, 21).map(c => c.Type)).toEqual([0, 1, 2, 4])
  expect(analysisFilterConditions(mixedDataset, 4).map(c => c.Type)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  expect(analysisFilterConditions(analysisDataset, 21).map(c => c.Type)).toEqual([0, 2])
  expect(REPORT_FILTER_CONDITIONS.map(c => c.Type)).toEqual([0, 1, 2, 4])
  expect(Array.from({ length: 8 }, (_, i) => isMultiValueReportCondition(i))).toEqual([false, false, true, true, true, true, false, false])
})
it.each([3, 5])('keeps mixed condition %i identities through validation and saved templates', condition => {
  const selection = exactSelection(4, condition)
  selection.Values = [
    { Data: { kind: 'product', id: '9223372036854775807' }, Name: 'Product', Value: 0 },
    { Data: { kind: 'productGroup', id: 1 }, Name: 'Group', Value: 0 },
    { Data: { Id: 2, Name: 'Legacy group' }, Name: 'Legacy group', Value: 0 },
  ]
  const request = { ...analysisRequest(), selections: [exactSelection(1), selection] }
  expect(currentVparivanieAnalysisLayoutError(request, mixedDataset)).toBeNull()
  const restored = normalizeSavedTemplate({ Id: 'mixed', Revision: 1, Name: 'Mixed groups', Data: {
    From: request.from, To: request.to, DataSource: 39, Sorted: request.sorted, Selections: request.selections,
    CurrentVparivanieAnalysis: { version: 1 }, CurrentVparivanieFullScope: true,
  } })
  expect(restored.Data.selections).toEqual(request.selections)
  const draft = { version: 1 as const, ownerId: 'test-owner', savedAt: '2026-10-24T07:00:00.000Z',
    snapshot: { name: 'Mixed', data: restored.Data, measurements: [], activeTemplate: restored, previousPeriod: { from: '', to: '' } } }
  const encoded = encodeReportWorkspaceDraft(draft)
  expect(encoded.ok).toBe(true)
  if (encoded.ok) expect(decodeReportWorkspaceDraft(encoded.value, 'test-owner')).toEqual({ ok: true, data: draft })
  expect(currentVparivanieAnalysisLayoutError(restored.Data, mixedDataset)).toBeNull()
  expect(currentVparivanieAnalysisLayoutError(request, analysisDataset)).not.toBeNull()
})
it.each([
  { kind: 'Product', id: 1 }, { kind: 'product', id: '9223372036854775808' },
  { kind: 'product', id: 9007199254740992 }, { kind: 'product', id: 1, Id: 1 },
  { kind: 'product', Kind: 'product', id: 1 }, { kind: 'product', id: 1, extra: true },
  { kind: 'warehouse', id: 1 }, { kind: 'product', id: '1e3' }, { Id: 1, id: 1 },
])('rejects malformed typed identity %j without falling back to a group', value => {
  expect(validAnalysisFilterValue(4, value, groupDescriptor, 3)).toBe(false)
})
it('preserves int64 strings and separates product/group identities while recognizing legacy groups', () => {
  expect(analysisGroupIdentity({ KIND: 'product', ID: '9223372036854775807' })).toEqual({ kind: 'product', id: '9223372036854775807', typed: true })
  expect(validAnalysisFilterValue(4, { kind: 'product', id: '000000000000000000000001' }, groupDescriptor, 3)).toBe(true)
  expect(analysisValueIdentity(4, { kind: 'product', id: '00001' })).toBe(analysisValueIdentity(4, { kind: 'product', id: 1 }))
  expect(analysisValueIdentity(4, { Id: 1, Name: 'Legacy' })).toBe(analysisValueIdentity(4, { kind: 'productGroup', id: '1' }))
  expect(analysisValueIdentity(4, { kind: 'product', id: 1 })).not.toBe(analysisValueIdentity(4, { kind: 'productGroup', id: 1 }))
})
it('preserves every value when switching to one group and requires explicit correction', () => {
  const selection = exactSelection(4, 3)
  selection.Values = [
    { Data: { kind: 'product', id: 1 }, Name: 'Product', Value: 0 },
    { Data: { kind: 'productGroup', id: '2' }, Name: 'Group', Value: 0 },
  ]
  const changed = changeAnalysisSelectionCondition(selection, { Type: 6, Name: 'У групі' })
  expect(changed.Values).toEqual([selection.Values[0], { ...selection.Values[1], Data: { Id: '2' } }])
  expect(analysisSelectionValueError(changed, groupDescriptor)).toContain('одну групу')
  expect(analysisSelectionValueError({ ...changed, Values: [changed.Values[0]] }, groupDescriptor)).toContain('окремі товари')
  expect(analysisSelectionValueError({ ...changed, Values: [changed.Values[1]] }, groupDescriptor)).toBeNull()
  expect(selection.Values[1].Data).toEqual({ kind: 'productGroup', id: '2' })
})
