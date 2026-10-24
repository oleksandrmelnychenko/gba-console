import { expect, it } from 'vitest'
import wire from './currentVparivanieAnalysis.ua-capability-fixture.json'
import { analysisDataset } from './currentVparivanieAnalysis.test-fixtures'
import { ANALYSIS_GROUPS_ENDPOINT, currentVparivanieAnalysisCapability } from './currentVparivanieAnalysis'
const dataset = { ...analysisDataset, currentVparivanie: { ...analysisDataset.currentVparivanie as object, analysis: wire } }
it('accepts the actual compiled UA hierarchy/manual TOP descriptors without unlocking unrelated fields', () => {
  const cap = currentVparivanieAnalysisCapability(dataset)!
  expect(cap.filters.find(f => f.type === 4)?.hierarchyBrowse).toEqual({ version: 1, endpoint: ANALYSIS_GROUPS_ENDPOINT, maximumPageSize: 50 })
  expect(cap.filters.find(f => f.type === 3)?.textEntry).toEqual({ version: 1, allowedValues: ['A', 'B', 'C', 'D', 'O', 'X9', 'N'] })
  expect(cap.filters.filter(f => f.hierarchyBrowse).map(f => f.type)).toEqual([4])
  expect(currentVparivanieAnalysisCapability(analysisDataset)?.filters.find(f => f.type === 4)?.hierarchyBrowse).toBeUndefined()
})
it('rejects unsupported hierarchy endpoints rather than following arbitrary metadata URLs', () => {
  const invalid = structuredClone(dataset)
  invalid.currentVparivanie.analysis.filters.find(f => f.type === 4)!.hierarchyBrowse!.endpoint = '/wrong/route'
  expect(currentVparivanieAnalysisCapability(invalid)).toBeUndefined()
})
