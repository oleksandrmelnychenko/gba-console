import { expect, it } from 'vitest'
import { cloneConstructorPresentation, constructorPresentationError, constructorPresentationSupported, readConstructorPresentation } from './constructorPresentation'
import { defaultDatasetRequest } from './reportDatasets'
import { parseReportDatasets, normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import fixture from './customerGroupWarehouse.server-fixture.json'
const dataset = { ...parseReportDatasets([fixture.dataset])[0], constructorPresentation: { version: 1, fields: ['negativeRed', 'grandTotals'] } }
const request = defaultDatasetRequest(dataset, '2026-10-01', '2026-10-27')
const flags = { version: 1, negativeRed: false, grandTotals: true }
it('only admits explicit source44 and existing named sales profiles on advertised metadata', () => {
  expect(constructorPresentationSupported(dataset)).toBe(true)
  expect(constructorPresentationError({ ...request, constructorPresentation: flags }, dataset)).toBeNull()
  for (const change of [{ dataSource: 3 }, { dataSource: 45 }, { dataSource: 2 }, { reportProfile: 'sales' }, { ReportProfile: 'grossProfit' }, { returnsOnly: true }, { ReturnsOnly: true }, { returnsOnly: false }, { ReturnsOnly: false }])
    expect(constructorPresentationError({ ...request, ...change, constructorPresentation: flags }, dataset)).toBeTruthy()
  expect(constructorPresentationError({ ...request, constructorPresentation: flags }, { ...dataset, constructorPresentation: undefined })).toMatch(/Сервер ще/)
  for (const cap of [null, { version: 2, fields: ['negativeRed','grandTotals'] }, { version: 1, fields: ['negativeRed'] }])
    expect(constructorPresentationSupported({ ...dataset, constructorPresentation: cap })).toBe(false)
})
it('keeps absent legacy flags omitted and preserves raw malformed or unsupported saved values for explicit repair', () => {
  expect(cloneConstructorPresentation(request)).toEqual({})
  expect(constructorPresentationError(request, { ...dataset, constructorPresentation: undefined })).toBeNull()
  for (const value of [null, { ...flags, version: 2 }, { ...flags, negativeRed: 'false' }, { ...flags, extra: true }]) {
    const saved = normalizeSavedTemplate({ Id:'p', Revision:1, UpdatedAtUtc:'2026-10-30T00:00:00Z', Name:'Порівняння', Data:{ DataSource:44, From:request.from, To:request.to, Sorted:request.sorted, Selections:[], ConstructorPresentation:value } })
    expect(saved.Data.constructorPresentation).toEqual(value)
    expect(constructorPresentationError(saved.Data, dataset)).toBeTruthy()
    expect(readConstructorPresentation(value)).toBeUndefined()
  }
  expect(constructorPresentationError({ ...request, constructorPresentation:flags, ConstructorPresentation:flags },dataset)).toBeTruthy()
})
