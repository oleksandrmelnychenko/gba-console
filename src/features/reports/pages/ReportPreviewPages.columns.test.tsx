import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { getStockReportPreviewPage } from '../api/reportsApi'
import { normalizeNativeReportPreview, previewAmountText, type NativeReportPreview } from '../data/nativeReportPreview'
import { WIDE_RESULT, wideTotalValue, widePreview } from '../data/reportWideColumns.test-fixtures'
import type { ReportRequestBody } from '../types'
import { ReportPreviewPages } from './ReportPreviewPages'
import { ReportInlinePreview } from './ReportInlinePreview'
vi.mock('../api/reportsApi', () => ({ getStockReportPreviewPage: vi.fn() }))

const request: ReportRequestBody = { dataSource: 35, from: '2026-10-01', to: '2026-10-31', sorted: { Row: [], Col: [], Measurements: [] }, selections: [] }
const session = { ResultId: WIDE_RESULT.ResultId, RequestSha256: WIDE_RESULT.RequestSha256, ResultSha256: WIDE_RESULT.ResultSha256, ExpiresAtUtc: WIDE_RESULT.ExpiresAtUtc }
const page = (offset: number, returned: number, rowOffset = 0): NativeReportPreview => ({
  ...normalizeNativeReportPreview({ Preview: widePreview({ total: 3660, offset, returned, rowOffset, rows: 2 }) }), ResultSession: session })
const totals = (container: HTMLElement) => [...container.querySelectorAll('tfoot td')].map(cell => cell.textContent)
const show = (initial: NativeReportPreview) => render(<MantineProvider><ReportPreviewPages initial={initial} request={request} /></MantineProvider>)

beforeEach(() => {
  vi.mocked(getStockReportPreviewPage).mockReset()
  vi.mocked(getStockReportPreviewPage).mockImplementation(async (_session, _request, rows, _signal, columns) =>
    page(columns?.offset ?? 0, columns?.offset === 256 ? 200 : 256, rows))
})

it('renders a 256-column window with sticky row headings and the server totals of that window', () => {
  const view = show(page(0, 256))
  expect(screen.getAllByText('Колонки 1–256 з 3 660').length).toBeGreaterThan(0)
  expect(view.container.querySelector('.report-inline-preview--wide')).toBeTruthy()
  const headings = [...view.container.querySelectorAll('thead th.is-sticky-row-header')] as HTMLElement[]
  expect(headings.map(cell => cell.style.left)).toEqual(['0rem', '12rem'])
  const bodyHeadings = [...view.container.querySelectorAll('tbody tr:not(.report-inline-preview__group-total) th.is-sticky-row-header')] as HTMLElement[]
  expect(bodyHeadings.map(cell => cell.style.left)).toEqual(['0rem', '12rem', '0rem', '12rem'])
  expect(view.container.querySelectorAll('thead th.report-inline-preview__value-heading')).toHaveLength(256)
  const grand = totals(view.container)
  expect(grand).toHaveLength(256)
  expect(grand[0]).toBe(previewAmountText(wideTotalValue(0)))
  expect(grand[255]).toBe(previewAmountText(wideTotalValue(255)))
  expect(screen.getByRole('button', { name: 'Попередні колонки' })).toHaveProperty('disabled', true)
  expect(screen.getByRole('button', { name: 'Наступні колонки' })).toHaveProperty('disabled', false)
})

it('advances by the returned columns, keeps the window while paging rows and goes back through the visited windows', async () => {
  const view = show(page(0, 256))
  fireEvent.click(screen.getByRole('button', { name: 'Наступні колонки' }))
  await screen.findAllByText('Колонки 257–456 з 3 660')
  expect(getStockReportPreviewPage).toHaveBeenLastCalledWith(session, request, 0, expect.any(AbortSignal), { offset: 256, limit: 256 })
  expect(totals(view.container)[0]).toBe(previewAmountText(wideTotalValue(256)))
  expect(totals(view.container)).toHaveLength(200)
  fireEvent.click(screen.getByRole('button', { name: 'Наступні колонки' }))
  await screen.findAllByText('Колонки 457–712 з 3 660')
  expect(getStockReportPreviewPage).toHaveBeenLastCalledWith(session, request, 0, expect.any(AbortSignal), { offset: 456, limit: 256 })
  fireEvent.click(screen.getByRole('button', { name: 'Наступні рядки' }))
  await waitFor(() => expect(getStockReportPreviewPage).toHaveBeenLastCalledWith(session, request, 50, expect.any(AbortSignal), { offset: 456, limit: 256 }))
  await screen.findByText('51–52 із 120')
  expect(screen.getAllByText('Колонки 457–712 з 3 660').length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'Попередні колонки' }))
  await screen.findAllByText('Колонки 257–456 з 3 660')
  expect(getStockReportPreviewPage).toHaveBeenLastCalledWith(session, request, 50, expect.any(AbortSignal), { offset: 256, limit: 256 })
  fireEvent.click(screen.getByRole('button', { name: 'Перші колонки' }))
  await screen.findAllByText('Колонки 1–256 з 3 660')
  expect(getStockReportPreviewPage).toHaveBeenLastCalledWith(session, request, 50, expect.any(AbortSignal), { offset: 0, limit: 256 })
})

it('shows group totals only for the window columns and states the window when there is no live session', () => {
  const preview = normalizeNativeReportPreview({ Preview: widePreview({ total: 3660, offset: 512, returned: 256, rows: 2 }) })
  const view = render(<MantineProvider><ReportInlinePreview preview={preview} /></MantineProvider>)
  const group = view.container.querySelector('.report-inline-preview__group-total')!
  const groupCells = [...group.querySelectorAll('td')].map(cell => cell.textContent)
  expect(groupCells).toHaveLength(256)
  expect(groupCells.slice(0, 3)).toEqual(['512,25', '513,25', '514,25'])
  expect(groupCells.slice(3).every(text => text === '')).toBe(true)
  expect(screen.getByText('Колонки 513–768 з 3 660. Решта колонок — у Excel.')).toBeTruthy()
})

it('keeps the classic layout for a complete column window', () => {
  const preview = normalizeNativeReportPreview({ Preview: widePreview({ total: 30, offset: 0, returned: 30, limit: 256, rows: 2 }) })
  const view = render(<MantineProvider><ReportInlinePreview preview={preview} /></MantineProvider>)
  expect(view.container.querySelector('.report-inline-preview--wide')).toBeNull()
  expect(view.container.querySelectorAll('.is-sticky-row-header')).toHaveLength(0)
  expect(screen.queryByTestId('report-preview-column-window')).toBeNull()
})
