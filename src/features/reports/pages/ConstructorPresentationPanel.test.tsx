import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { normalizeSavedTemplate } from '../api/reportWorkspaceApi'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { workbookPreview } from '../data/workbookPresentation.test-fixtures'
import { cloneConstructorPresentation, constructorPresentationError, readConstructorPresentation } from '../data/constructorPresentation'
import { defaultDatasetRequest } from '../data/reportDatasets'
import { netDataset } from '../data/reportDatasets.test-fixtures'
import { ReportInlinePreview } from './ReportInlinePreview'

afterEach(cleanup)
it.each([true, false])('applies saved negative color and grand-total visibility without changing groups or values (%s)', enabled => {
  const fixture = workbookPreview()
  const flags = { version: 1 as const, negativeRed: enabled, grandTotals: enabled }
  const value = { Kind: 'decimal', Value: '-5', Provenance: 'producerCell' }
  const preview = normalizeNativeReportPreview({ Preview: { ...fixture, workbookPresentation: undefined,
    Request: { ...fixture.Request, DataSource: 'NativeSalesNet' }, constructorPresentation: flags,
    Cells: [{ RowSourceIndex: 12, ColumnSourceIndex: 0, Value: value }],
    Totals: { State: 'materialized', Values: [{ RowSourceIndex: -1, ColumnSourceIndex: 0, Value: { ...value, Provenance: 'presentationTotal' } }],
      Groups: [{ Level: 0, RowSourceIndex: 12, RowCount: 1, Values: [{ RowSourceIndex: 12, ColumnSourceIndex: 0, Value: { ...value, Provenance: 'presentationTotal' } }] }] } } })
  const { container } = render(<MantineProvider env="test"><ReportInlinePreview preview={preview} /></MantineProvider>)
  expect(container.querySelector('tfoot') !== null).toBe(enabled)
  expect(container.querySelector('.is-negative') !== null).toBe(enabled)
  expect(container.querySelector('.report-inline-preview__group-total')).toBeTruthy()
  expect(preview.Cells[0].Value.Value).toBe('-5')
})
it('preserves flags through template casing and refuses details or use in legacy reports', () => {
  const flags = { version: 1, negativeRed: false, grandTotals: false }
  const request = { ...defaultDatasetRequest(netDataset, '2026-10-01', '2026-10-27'), reportProfile: 'sales', ...cloneConstructorPresentation({ ConstructorPresentation: flags }) }
  expect(constructorPresentationError(request)).toBeNull()
  expect(request.constructorPresentation).toEqual(flags)
  const saved = normalizeSavedTemplate({ Id: 'presentation', Revision: 1, Name: 'Продажі', UpdatedAtUtc: '2026-10-28T00:00:00Z',
    Data: { DataSource: 2, ReportProfile: 'sales', ConstructorPresentation: flags, From: request.from, To: request.to, Sorted: request.sorted, Selections: [] } })
  expect(saved.Data.constructorPresentation).toEqual(flags)
  expect(constructorPresentationError({ ...request, dataSource: 35 })).toBeTruthy()
  expect(readConstructorPresentation({ ...flags, details: true })).toBeUndefined()
  expect(constructorPresentationError({ ...request, ConstructorPresentation: flags })).toBeTruthy()
})
