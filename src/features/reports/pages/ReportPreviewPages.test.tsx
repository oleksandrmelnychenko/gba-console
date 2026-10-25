import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { getStockReportPreviewPage } from '../api/reportsApi'
import { ReportPreviewPages } from './ReportPreviewPages'
import type { NativeReportPreview } from '../data/nativeReportPreview'
import type { ReportRequestBody } from '../types'
vi.mock('../api/reportsApi', () => ({ getStockReportPreviewPage: vi.fn() }))
const request: ReportRequestBody = { dataSource: 0, from: '', to: '', sorted: { Row: [], Col: [], Measurements: [] }, selections: [] }
const initial = (id = '11111111-2222-3333-4444-555555555555'): NativeReportPreview => ({ Version: 1, ResultSha256: 'a'.repeat(64), PresentationOnly: true, Request: null,
  ResultSession: { ResultId: id, RequestSha256: 'b'.repeat(64), ResultSha256: 'a'.repeat(64), ExpiresAtUtc: '2030-01-01T00:00:00Z' },
  Page: { Offset: 0, Limit: 50, TotalVisibleRows: 51, ReturnedRows: 1, HasMore: true }, RowSchema: [{ Caption: 'Товар' }], ColumnSchema: [],
  Rows: [{ Ordinal: 0, SourceIndex: 0, Values: [{ Caption: 'Перший товар' }] }], Columns: [], Cells: [],
})
const next = (): NativeReportPreview => ({ ...initial(), Page: { Offset: 50, Limit: 50, TotalVisibleRows: 51, ReturnedRows: 1, HasMore: false }, Rows: [{ Ordinal: 50, SourceIndex: 50, Values: [{ Caption: 'Наступний товар' }] }] })
beforeEach(() => vi.mocked(getStockReportPreviewPage).mockReset())
it('reads the next immutable page, renders range and enables previous without calculating a new report', async () => {
  vi.mocked(getStockReportPreviewPage).mockResolvedValue(next())
  render(<MantineProvider><ReportPreviewPages initial={initial()} request={request} /></MantineProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Наступні рядки' }))
  await screen.findByText('Наступний товар')
  expect(screen.getByText('51–51 із 51')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Наступні рядки' })).toHaveProperty('disabled', true)
  expect(screen.getByRole('button', { name: 'Попередні рядки' })).toHaveProperty('disabled', false)
  expect(getStockReportPreviewPage).toHaveBeenCalledWith(initial().ResultSession, request, 50, expect.any(AbortSignal))
})
it('retains the previous page on failure and cancels a pending page when the form/result is replaced', async () => {
  vi.mocked(getStockReportPreviewPage).mockRejectedValueOnce(new Error('Результат недоступний. Сформуйте повторно.'))
  const view = render(<MantineProvider><ReportPreviewPages key="first" initial={initial()} request={request} /></MantineProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Наступні рядки' }))
  await screen.findByText('Результат недоступний. Сформуйте повторно.')
  expect(screen.getByText('Перший товар')).toBeTruthy()
  let resolve!: (value: NativeReportPreview) => void
  vi.mocked(getStockReportPreviewPage).mockImplementationOnce(() => new Promise(done => { resolve = done }))
  fireEvent.click(screen.getByRole('button', { name: 'Наступні рядки' }))
  const signal = vi.mocked(getStockReportPreviewPage).mock.calls.at(-1)![3]!
  view.rerender(<MantineProvider><ReportPreviewPages key="second" initial={initial('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')} request={request} /></MantineProvider>)
  expect(signal.aborted).toBe(true)
  await act(async () => resolve(next()))
  await waitFor(() => expect(screen.queryByText('Наступний товар')).toBeNull())
  expect(screen.getByText('Перший товар')).toBeTruthy()
})


it('does not rebuild 3000 unchanged cells for a pending page or an error', async () => {
  const value = initial()
  value.Columns = Array.from({ length: 60 }, (_, index) => ({ Ordinal: index, SourceIndex: index, Values: [{ Caption: `Column ${index}` }] }))
  value.Rows = Array.from({ length: 50 }, (_, index) => ({ Ordinal: index, SourceIndex: index, Values: [{ Caption: `Row ${index}` }] }))
  value.Cells = value.Rows.flatMap(row => value.Columns.map(column => ({ RowSourceIndex: row.SourceIndex, ColumnSourceIndex: column.SourceIndex, Value: { Kind: 'decimal' as const, Value: '42.50', Provenance: 'producerCell' as const } })))
  const reads = vi.spyOn(value.Cells, 'map')
  let reject!: (reason: Error) => void
  vi.mocked(getStockReportPreviewPage).mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
  const view = render(<MantineProvider><ReportPreviewPages initial={value} request={request} /></MantineProvider>)
  expect(view.container.querySelectorAll('td')).toHaveLength(3000)
  reads.mockClear()
  fireEvent.click(screen.getByRole('button', { name: 'Наступні рядки' }))
  expect(screen.getByText('Завантаження…')).toBeTruthy()
  expect(reads).not.toHaveBeenCalled()
  await act(async () => reject(new Error('Retry this page')))
  expect(screen.getByText('Retry this page')).toBeTruthy()
  expect(reads).not.toHaveBeenCalled()
  vi.mocked(getStockReportPreviewPage).mockResolvedValueOnce(next())
  fireEvent.click(screen.getByRole('button', { name: 'Наступні рядки' }))
  await screen.findByText('Наступний товар')
  expect(screen.queryByText('Row 0')).toBeNull()
})
