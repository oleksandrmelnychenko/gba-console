import actualPreview from './currentVparivanieAnalysis.preview-fixture.json'
import { describe, expect, it } from 'vitest'
import { analysisDataset, analysisPreview, analysisRequest } from './currentVparivanieAnalysis.test-fixtures'
import { currentVparivanieDataset, currentVparivanieRequest, exactSelection } from './currentVparivanie.test-fixtures'
import { currentVparivanieAnalysisCapability, currentVparivanieAnalysisLayoutError, currentVparivanieAnalysisScopeError, upgradeCurrentVparivanieAnalysis, bindAnalysisPreview, validAnalysisFilterValue } from './currentVparivanieAnalysis'
import { currentVparivanieConfigurationError, isCurrentVparivanieDataset } from './currentVparivanie'
import { datasetConfigurationError } from './reportDatasets'
import { normalizeNativeReportPreview } from './nativeReportPreview'
import { reportAxesPolicy } from './reportConfiguration'

describe('capability-bound flexible stock/sales analysis', () => {
  it('upgrades supported default and restored matrix requests without altering direct legacy definitions', () => {
    const old = currentVparivanieRequest(), copy = structuredClone(old)
    const request = upgradeCurrentVparivanieAnalysis(old, analysisDataset)
    expect(request).toMatchObject({ currentVparivanieAnalysis: { version: 1 }, currentVparivanieFullScope: true })
    expect(old).toEqual(copy)
    expect(request.sorted.Row.map(f => f.type)).toEqual([6, 5])
    expect(upgradeCurrentVparivanieAnalysis(analysisRequest(), analysisDataset).sorted.Row.map(f => f.type)).toEqual([5, 2])
    expect(upgradeCurrentVparivanieAnalysis(old, currentVparivanieDataset)).toEqual(old)
    expect(isCurrentVparivanieDataset(analysisDataset)).toBe(true)
    expect(currentVparivanieConfigurationError(request, analysisDataset)).toBeNull()
    expect(reportAxesPolicy(analysisDataset, request).fixed).toBe(false)
  })
  it('keeps field identities, actor meanings and conditions from server descriptors', () => {
    const cap = currentVparivanieAnalysisCapability(analysisDataset)!
    expect(cap.groupings.find(f => f.type === 79)?.name).toContain('Основний менеджер')
    expect(cap.groupings.some(f => f.type === 16)).toBe(false)
    expect(cap.filters.find(f => f.type === 3)?.valueKind).toBe('text')
    expect(cap.filters.find(f => f.type === 4)?.conditions).toEqual([0,1,2,3,4,5,6,7])
    expect(cap.filters.find(f => f.type === 21)?.conditions).toEqual([0,2])
    const request = analysisRequest(); request.selections.push({ ...exactSelection(4, 3), Values: exactSelection(4, 3).Values })
    expect(datasetConfigurationError(request, analysisDataset)).toBeNull()
  })
  it.each([
    { currentVparivanieAnalysis: null }, { currentVparivanieAnalysis: { version: 2 } },
    { currentVparivanieAnalysis: { version: 1, Version: 1 } }, { CurrentVparivanieAnalysis: { version: 1 } },
    { CURRENTVPARIVANIEANALYSIS: { version: 1 } }, { currentVparivanieFullScope: false },
  ])('refuses malformed aliases without repairing stored meaning: %j', extra => {
    const invalid = { ...analysisRequest(), ...extra }
    expect(currentVparivanieConfigurationError(upgradeCurrentVparivanieAnalysis(invalid, analysisDataset), analysisDataset)).not.toBeNull()
  })
  it('refuses unsupported capabilities, axes, duplicate filter fields and missing positive anchor', () => {
    const request = analysisRequest()
    expect(currentVparivanieAnalysisScopeError(request, currentVparivanieDataset)).toContain('не підтримує')
    expect(currentVparivanieAnalysisLayoutError({ ...request, sorted: { ...request.sorted, Col: [] } }, analysisDataset)).not.toBeNull()
    expect(currentVparivanieAnalysisLayoutError({ ...request, selections: [exactSelection(1, 1)] }, analysisDataset)).toContain('Оберіть товари')
    expect(currentVparivanieAnalysisLayoutError({ ...request, selections: [exactSelection(1), exactSelection(1)] }, analysisDataset)).toContain('одне правило')
    const noCapability = { ...analysisDataset, currentVparivanie: { ...analysisDataset.currentVparivanie as object, analysis: { ...(analysisDataset.currentVparivanie as Record<string, unknown>).analysis as object, physicalCalendar: 'UTC' } } }
    expect(currentVparivanieAnalysisCapability(noCapability)).toBeUndefined()
  })
})

describe('analysis preview identities and coverage', () => {
  it('reads grouped rows without impersonating the seven product attributes', () => {
    const preview = normalizeNativeReportPreview({ Preview: analysisPreview() }, true)
    expect(preview.CurrentVparivanieProducts).toBeUndefined()
    expect(preview.Rows[0].Values[1].Identity?.Value).toBe('analysis:na')
    expect(() => bindAnalysisPreview(analysisRequest(), preview)).not.toThrow()
    expect(() => bindAnalysisPreview(currentVparivanieRequest(), preview)).toThrow('інший режим')
  })
  it('refuses missing or mismatched coverage, wrong movement selection and legacy-shaped replies', () => {
    const badHash = analysisPreview(); badHash.currentVparivanieAnalysis.resultSha256 = 'b'.repeat(64)
    expect(() => normalizeNativeReportPreview({ Preview: badHash }, true)).toThrow('покриття')
    const missing = analysisPreview(); missing.currentVparivanieAnalysis.fieldCoverage.pop()
    const preview = normalizeNativeReportPreview({ Preview: missing }, true)
    expect(() => bindAnalysisPreview(analysisRequest(), preview)).toThrow('відборів')
    const unknown = analysisPreview(); unknown.currentVparivanieAnalysis.fieldCoverage[0].unknownFacts = 1
    expect(() => normalizeNativeReportPreview({ Preview: unknown }, true)).toThrow('покриття')
    const moved = analysisPreview(); moved.currentVparivanieAnalysis.incoming = true
    expect(() => bindAnalysisPreview(analysisRequest(), normalizeNativeReportPreview({ Preview: moved }, true))).toThrow('руху')
  })
})

it('accepts an actual HTTP serializer fixture with namespaced axes and independent sales branches', () => {
  const preview = normalizeNativeReportPreview({ Preview: actualPreview }, true)
  expect(preview.currentVparivanieAnalysis?.allSalesFilterScope).toBe(true)
  expect(preview.Rows[0].Values[0].Identity?.Value).toBe('product:1')
  expect(preview.Cells.map(c => c.Value.Value)).toEqual(['7', '3'])
})

it('supports positive group unions and refuses the unavailable immutable creator filter', () => {
  const request = analysisRequest()
  for (const condition of [2, 3]) {
    const group = exactSelection(4, condition)
    group.Values.push({ ...group.Values[0], Data: { Id: '2' } })
    expect(currentVparivanieAnalysisLayoutError({ ...request, selections: [group] }, analysisDataset)).toBeNull()
  }
  const creator = currentVparivanieAnalysisCapability(analysisDataset)!.filters.find(f => f.type === 15)!
  expect(creator.available).toBe(false)
  expect(currentVparivanieAnalysisLayoutError({ ...request, selections: [...request.selections, exactSelection(15)] }, analysisDataset)).toBe(creator.unavailabilityReason)
})

it.each(['value', 'Value', 'name', 'Name'])('preserves the server-compatible text key %s for Top and article', key => {
  for (const field of [2, 3]) {
    expect(validAnalysisFilterValue(field, { [key]: 'A' })).toBe(true)
    expect(validAnalysisFilterValue(field, { [key]: 'A', extra: 'A' })).toBe(false)
  }
  expect(validAnalysisFilterValue(3, { value: 'A', Name: 'A' })).toBe(false)
})
