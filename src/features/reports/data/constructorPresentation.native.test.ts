import { expect, it } from 'vitest'
import type { ReportRequestBody } from '../types'
import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { buildReportBuilderRequest } from './reportBuilderRequest'
import { datasetMeasurements, datasetConfigurationError } from './reportDatasets'
import { salesConstructorError } from './salesConstructorProfiles'
import { reportWorkspaceDraftCompatibility } from './reportWorkspaceDraftCompatibility'
import { cloneConstructorPresentation, constructorPresentationError, constructorPresentationRequestSupported, constructorPresentationSupported, readConstructorPresentation } from './constructorPresentation'
import { ownPresentationDataset, ownPresentationRequest, ownPresentationSources, presentationCombinations } from './constructorPresentation.native.test-fixtures'

// .NET wire permits null mode aliases; the editor's boolean DTO intentionally stays narrower.
const supportsNullableWire = (wire: unknown) => constructorPresentationRequestSupported(wire as ReportRequestBody)
const validCases = ownPresentationSources.flatMap(source => presentationCombinations.map(flags => ({ source, flags })))
it.each(validCases)('admits explicit own-source $source presentation $flags without rewriting the request', ({ source, flags }) => {
  const data = { ...ownPresentationRequest(source), constructorPresentation: flags }, before = structuredClone(data)
  expect(constructorPresentationSupported(ownPresentationDataset(source))).toBe(true)
  expect(constructorPresentationRequestSupported(data)).toBe(true)
  expect(constructorPresentationError(data, ownPresentationDataset(source))).toBeNull()
  expect(data).toEqual(before)
})
it.each(ownPresentationSources)('keeps absent options absent through the real builder and clone for source%i', source => {
  const dataset = ownPresentationDataset(source), request = ownPresentationRequest(source)
  const values = { dataSource: source, from: request.from, to: request.to, ordering: undefined, filterExpression: undefined,
    topGroups: undefined, rowGroups: request.sorted.Row, colGroups: request.sorted.Col,
    measurements: datasetMeasurements(dataset, request.sorted.Measurements), selections: request.selections }
  const absent = buildReportBuilderRequest(values)
  expect(Object.hasOwn(absent, 'constructorPresentation')).toBe(false)
  expect(cloneConstructorPresentation(request)).toEqual({})
  expect(constructorPresentationError(absent, { ...dataset, constructorPresentation: undefined })).toBeNull()
  for (const flags of presentationCombinations) {
    const actual = buildReportBuilderRequest({ ...values, constructorPresentation: flags })
    expect(actual.constructorPresentation).toEqual(flags)
    expect(actual.sorted).toEqual(absent.sorted)
    expect(actual.selections).toEqual(absent.selections)
  }
})
it.each(ownPresentationSources)('refuses malformed, duplicate-alias and unknown request options for source%i while retaining raw data', source => {
  const request = ownPresentationRequest(source), flags = presentationCombinations[0]
  for (const value of [null, [], 1, {}, { ...flags, version: 2 }, { ...flags, negativeRed: 0 },
    { ...flags, grandTotals: 'false' }, { ...flags, details: true }, { negativeRed: true, grandTotals: false }]) {
    const data = { ...request, constructorPresentation: value }, before = structuredClone(data)
    expect(readConstructorPresentation(value)).toBeUndefined()
    expect(constructorPresentationError(data, ownPresentationDataset(source))).toBeTruthy()
    expect(cloneConstructorPresentation(data).constructorPresentation).toEqual(value)
    expect(data).toEqual(before)
  }
  expect(constructorPresentationError({ ...request, constructorPresentation: flags, ConstructorPresentation: flags })).toBeTruthy()
})
it.each(ownPresentationSources)('requires the exact owned capability for source%i without invalidating absent legacy options', source => {
  const dataset = ownPresentationDataset(source), data = { ...ownPresentationRequest(source), constructorPresentation: presentationCombinations[0] }
  for (const capability of [undefined, null, [], { version: 2, fields: ['negativeRed','grandTotals'] },
    { version: 1, fields: ['grandTotals','negativeRed'] }, { version: 1, fields: ['negativeRed','grandTotals','details'] },
    { version: 1, fields: ['negativeRed','negativeRed','grandTotals'] }, { version: 1, fields: ['negativeRed'] },
    { version: 1, fields: ['negativeRed','grandTotals'], details: true }]) {
    expect(constructorPresentationSupported({ ...dataset, constructorPresentation: capability })).toBe(false)
    expect(constructorPresentationError(data, { ...dataset, constructorPresentation: capability })).toBeTruthy()
  }
  expect(constructorPresentationError(data, { ...dataset, DataSource: source === 3 ? 45 : 3 })).toBeTruthy()
})
it.each(ownPresentationSources)('allows null profile/returns aliases but rejects any explicit mode override for source%i', source => {
  const request = { ...ownPresentationRequest(source), constructorPresentation: presentationCombinations[0] }
  expect(supportsNullableWire({ ...request, reportProfile: null, returnsOnly: null })).toBe(true)
  expect(supportsNullableWire({ ...request, ReportProfile: null, ReturnsOnly: null })).toBe(true)
  for (const mode of [{ reportProfile: 'sales' }, { ReportProfile: 'grossProfit' }, { reportProfile: '' },
    { returnsOnly: false }, { ReturnsOnly: false }, { returnsOnly: true }, { ReturnsOnly: true }])
    expect(constructorPresentationError({ ...request, ...mode }, ownPresentationDataset(source))).toBeTruthy()
})
it.each(ownPresentationSources)('retains exact presentation flags through saved templates, draft checks and a changed period for source%i', source => {
  const dataset = ownPresentationDataset(source), request = ownPresentationRequest(source)
  for (const flags of presentationCombinations) {
    const saved = normalizeSavedTemplate({ Id: 'native-presentation', Revision: 1, Name: 'Оформлення',
      UpdatedAtUtc: '2026-11-01T00:00:00Z', Data: { DataSource: source, From: request.from, To: request.to,
        Sorted: request.sorted, Selections: [], ConstructorPresentation: flags } })
    expect(saved.Data.constructorPresentation).toEqual(flags)
    const data = { ...saved.Data, from: '2026-10-10', to: '2026-10-25', ...cloneConstructorPresentation(saved.Data) }
    const snapshot = { name: 'Оформлення', data, measurements: datasetMeasurements(dataset, data.sorted.Measurements),
      activeTemplate: null, previousPeriod: { from: request.from, to: request.to } }
    const before = structuredClone(snapshot)
    expect(reportWorkspaceDraftCompatibility(snapshot, dataset)).toBeNull()
    expect(snapshot).toEqual(before)
    expect(data.constructorPresentation).toEqual(flags)
    expect(data.from).toBe('2026-10-10')
  }
})
it('keeps named2/source44 and foreign/legacy source behavior unchanged', () => {
  for (const source of [2, 44]) {
    const dataset = ownPresentationDataset(source)
    expect(constructorPresentationSupported({ ...dataset, constructorPresentation: { version: 1, fields: ['negativeRed','grandTotals'], future: true } })).toBe(true)
  }
  for (const profile of ['sales', 'grossProfit'])
    expect(constructorPresentationError({ ...ownPresentationRequest(2), reportProfile: profile, constructorPresentation: presentationCombinations[0] }, ownPresentationDataset(2))).toBeNull()
  expect(constructorPresentationError({ ...ownPresentationRequest(2), constructorPresentation: presentationCombinations[0] })).toBeTruthy()
  expect(constructorPresentationRequestSupported({ ...ownPresentationRequest(44), reportProfile: null })).toBe(false)
  for (const source of [0, 1, 35, 38, 39, 40, 41])
    expect(constructorPresentationSupported(ownPresentationDataset(source))).toBe(false)
})

it.each(ownPresentationSources)('integrates a null profile only with explicit own-source presentation for source%i', source => {
  const dataset = ownPresentationDataset(source), base = ownPresentationRequest(source), flags = presentationCombinations[0]
  for (const aliases of [{ reportProfile: null, constructorPresentation: flags }, { ReportProfile: null, ConstructorPresentation: flags }]) {
    const data = { ...base, ...aliases }, before = structuredClone(data)
    expect(salesConstructorError(data, dataset)).toBeNull()
    expect(data).toEqual(before)
    expect(salesConstructorError({ ...data, returnsOnly: false }, dataset)).toBeTruthy()
    expect(salesConstructorError({ ...data, constructorPresentation: { ...flags, details: true } }, dataset)).toBeTruthy()
    expect(salesConstructorError(data, { ...dataset, DataSource: 44 })).toBeTruthy()
  }
  expect(salesConstructorError({ ...base, reportProfile: null }, dataset)).toMatch(/Невідомий профіль/)
  expect(salesConstructorError({ ...base, reportProfile: null, ReportProfile: null, constructorPresentation: flags }, dataset)).toMatch(/Невідомий профіль/)
  expect(salesConstructorError({ ...base, reportProfile: null, constructorPresentation: flags, ConstructorPresentation: flags }, dataset)).toBeTruthy()
  const detail = { ...base, reportProfile: null, constructorPresentation: flags,
    sorted: { ...base.sorted, Row: [...base.sorted.Row, { type: 84, key: 'DocumentDetail', label: 'Детальний запис' }] } }
  expect(salesConstructorError(detail, dataset)).toMatch(/Детальні записи/)
  expect(datasetConfigurationError({ ...base, reportProfile: null, constructorPresentation: flags,
    sorted: { ...base.sorted, Measurements: [{ Type: 9999, Name: 'Майбутнє', IsChecked: true, parentName: '' }] } }, dataset)).toBeTruthy()
  for (const legacy of [2, 44])
    expect(salesConstructorError({ ...base, dataSource: legacy, reportProfile: null, constructorPresentation: flags }, ownPresentationDataset(legacy))).toMatch(/Невідомий профіль/)
})


it.each([3, 45, 46, 2, 44])('restores valid presentation aliases but rejects ambiguous casing without changing source%i drafts', source => {
  const originalDataset = ownPresentationDataset(source)
  const dataset = source === 2 ? { ...originalDataset, reportProfiles: ['sales', 'grossProfit'],
    Measurements: originalDataset.Measurements.filter(field => [0, 2, 3].includes(field.Type)) } : originalDataset
  const originalRequest = ownPresentationRequest(source)
  const base = { ...originalRequest, ...(source === 2 ? { reportProfile: 'sales' } : {}),
    sorted: { ...originalRequest.sorted, Measurements: originalRequest.sorted.Measurements.filter(field => dataset.Measurements.some(allowed => allowed.Type === field.Type)) } }
  for (const flags of presentationCombinations) {
    for (const alias of ['constructorPresentation', 'ConstructorPresentation']) {
      const data = { ...base, [alias]: flags }
      const snapshot = { name: 'Оформлення', data, measurements: datasetMeasurements(dataset, data.sorted.Measurements),
        activeTemplate: null, previousPeriod: { from: data.from, to: data.to } }
      const before = structuredClone(snapshot)
      expect(reportWorkspaceDraftCompatibility(snapshot, dataset)).toBeNull()
      expect(snapshot).toEqual(before)
      expect(Object.keys(snapshot.data).filter(key => key.toLowerCase() === 'constructorpresentation')).toEqual([alias])
      for (const wrongCase of ['constructorpresentation', 'CONSTRUCTORPRESENTATION']) {
        const invalid = { ...snapshot, data: { ...base, [wrongCase]: flags } }, raw = structuredClone(invalid)
        expect(reportWorkspaceDraftCompatibility(invalid, dataset)).toMatch(/неоднозначні/)
        expect(invalid).toEqual(raw)
      }
    }
    const ambiguous = { name: 'Оформлення', data: { ...base, constructorPresentation: flags, ConstructorPresentation: flags },
      measurements: datasetMeasurements(dataset, base.sorted.Measurements), activeTemplate: null,
      previousPeriod: { from: base.from, to: base.to } }
    const raw = structuredClone(ambiguous)
    expect(reportWorkspaceDraftCompatibility(ambiguous, dataset)).not.toBeNull()
    expect(ambiguous).toEqual(raw)
  }
})
