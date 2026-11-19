import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PageHeaderActionsProvider, PageSubmenuActionsSlot } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getReportHistory, getReportHistoryUsers } from '../api/reportHistoryApi'
import { getReportDatasets } from '../api/reportWorkspaceApi'
import { netDataset } from '../data/reportDatasets.test-fixtures'
import { REPORT_HISTORY_RUN_KEY } from '../data/reportHistory'
import { ReportHistoryPage } from './ReportHistoryPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/reportWorkspaceApi', async original => ({ ...await original<typeof import('../api/reportWorkspaceApi')>(), getReportDatasets: vi.fn() }))
vi.mock('../api/reportHistoryApi', async original => ({ ...await original<typeof import('../api/reportHistoryApi')>(),
  getReportHistory: vi.fn(), getReportHistoryUsers: vi.fn() }))

const getRowCountCells = () => Array.from(document.querySelectorAll('td[data-column-id="rowCount"]'))
const findEntryRows = async () => (await screen.findAllByRole('button', { name: 'Відкрити' })).map(button => button.closest('tr')!)

const data = { dataSource: 2, from: '2026-11-01', to: '2026-11-17', sorted: { Row: [], Col: [], Measurements: [] }, selections: [] }
const entry = (id: string, user: string, name: string) => ({ id, formedAtUtc: '2026-11-17T08:30:00Z', dataSource: 2, output: 'excel' as const,
  rowCount: 12, userNetId: user, userName: name, own: false, kind: 'report' as const, report: '2', data, movement: null, names: {} })

beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear()
  // DataTable waits for its viewport to be measured before revealing the rows.
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(1000)
  vi.mocked(getReportDatasets).mockResolvedValue([netDataset])
  vi.mocked(getReportHistoryUsers).mockResolvedValue([
    { userNetId: 'u-1', userName: 'Іван Петренко', own: false }, { userNetId: 'u-2', userName: 'Іван Петренко', own: false }])
  vi.mocked(getReportHistory).mockImplementation(async query => query.limit === 1
    ? { isHead: true, total: 3, days: [{ day: '2026-11-17', count: 2 }, { day: '2026-11-16', count: 1 }],
      reports: [{ report: '2', dataSource: 2, profile: null, kind: 'report' as const, count: 2 },
        { report: '1001', dataSource: 1001, profile: null, kind: 'movement' as const, count: 1 }], items: [] }
    : { isHead: true, total: 2, days: [{ day: query.from, count: 2 }], reports: [],
      items: [entry('11111111-1111-1111-1111-111111111111', 'u-1', 'Іван Петренко'), entry('44444444-4444-4444-4444-444444444444', 'u-2', 'Іван Петренко')] })
})

afterEach(() => vi.restoreAllMocks())

function page() {
  return <MantineProvider env="test"><I18nProvider><PageHeaderActionsProvider>
    <MemoryRouter initialEntries={['/reports/history']}>
      <PageSubmenuActionsSlot className="test-header-strip" />
      <Routes>
        <Route path="/reports/history" element={<ReportHistoryPage />} />
        <Route path="/reports/stocks" element={<div>reports page</div>} />
      </Routes>
    </MemoryRouter>
  </PageHeaderActionsProvider></I18nProvider></MantineProvider>
}

it('groups the last 30 days by day with counts and opens the newest day', async () => {
  render(page())
  expect(await screen.findByText('17 листопада 2026')).toBeTruthy()
  expect(screen.getByText('16 листопада 2026')).toBeTruthy()
  const first = vi.mocked(getReportHistory).mock.calls[0][0]
  expect(first).toMatchObject({ to: first.to, limit: 1 })
  expect(first.from < first.to).toBe(true)
  const entries = await findEntryRows()
  expect(entries).toHaveLength(2)
  expect(within(entries[0]).getByText('Продажі з поверненнями')).toBeTruthy()
  expect(within(entries[0]).getByRole('cell', { name: '12' })).toBeTruthy()
  expect(await within(entries[0]).findByRole('cell', { name: 'Іван Петренко (u-1)' })).toBeTruthy()
  expect(vi.mocked(getReportHistory).mock.calls.some(([query]) => query.from === '2026-11-17' && query.to === '2026-11-17')).toBe(true)
  const newest = screen.getByRole('button', { name: /17 листопада 2026/ })
  expect(newest.getAttribute('aria-expanded')).toBe('true')
  fireEvent.click(newest)
  expect(getRowCountCells()).toHaveLength(0)
  fireEvent.click(newest)
  expect(getRowCountCells()).toHaveLength(2)
})

it('rebuilds an entry on the reports page with its settings', async () => {
  render(page())
  const entries = await findEntryRows()
  fireEvent.click(within(entries[0]).getByRole('button', { name: 'Завантажити Excel' }))
  await screen.findByText('reports page')
  expect(JSON.parse(sessionStorage.getItem(REPORT_HISTORY_RUN_KEY)!)).toMatchObject({ id: '11111111-1111-1111-1111-111111111111', action: 'excel' })
})

it('shows the history item in the reports menu right after the special reports', async () => {
  const view = render(page())
  await screen.findByText('17 листопада 2026')
  const strip = view.container.querySelector('.test-header-strip') as HTMLElement
  await waitFor(() => expect(within(strip).getAllByRole('button').map(button => button.textContent)).toEqual([
    'Продажі', 'Залишки', 'Закупи', 'Грошові кошти', 'Особливі звіти', 'Історія звітів']))
  expect(within(strip).getByRole('button', { name: 'Історія звітів' }).getAttribute('aria-pressed')).toBe('true')
})

it('switches to grouping by report and loads a report group for the whole period', async () => {
  render(page())
  await screen.findByText('17 листопада 2026')
  fireEvent.click(screen.getByText('за звітами'))
  expect(await screen.findByText('Рух товару')).toBeTruthy()
  const history = screen.getByRole('region', { name: 'Історія звітів' })
  const entries = await findEntryRows()
  expect(within(history).getAllByText('Продажі з поверненнями')).toHaveLength(1)
  expect(within(entries[0]).queryByText('Продажі з поверненнями')).toBeNull()
  await waitFor(() => expect(vi.mocked(getReportHistory).mock.calls.some(([query]) =>
    query.reports?.length === 1 && query.reports[0] === '2' && query.from !== query.to && query.limit === 50)).toBe(true))
})

it('makes the result region separately focusable from the filters', async () => {
  render(page())
  await findEntryRows()
  const history = screen.getByRole('region', { name: 'Історія звітів' })
  expect(screen.queryByRole('heading', { name: 'Історія звітів' })).toBeNull()
  expect(within(history).getByRole('table')).toBeTruthy()
  expect(within(history).queryByRole('button', { name: /^Дата формування:/ })).toBeNull()
  expect(history.tabIndex).toBe(0)
  history.focus()
  expect(document.activeElement).toBe(history)
})

it('applies and resets the formation date separately from the report data period', async () => {
  render(page())
  const entries = await findEntryRows()
  expect(screen.getByRole('columnheader', { name: 'Період звіту' })).toBeTruthy()
  const chip = within(entries[0]).getByText(/01\.11\.2026.*17\.11\.2026/)
  expect(chip.closest('.app-table-chip')?.classList.contains('is-document')).toBe(true)
  const range = screen.getByRole('button', { name: /^Дата формування:/ })
  const originalRange = range.textContent
  fireEvent.click(range)
  const calendar = await screen.findByRole('dialog', { name: 'Дата формування' })
  fireEvent.click(within(calendar).getByRole('button', { name: 'Сьогодні' }))
  fireEvent.click(within(calendar).getByRole('button', { name: 'Застосувати' }))
  await waitFor(() => {
    const lastSummary = vi.mocked(getReportHistory).mock.calls.findLast(([query]) => query.limit === 1)?.[0]
    expect(lastSummary?.from).toBe(lastSummary?.to)
    expect(range.textContent).not.toBe(originalRange)
  })
  fireEvent.click(screen.getByRole('button', { name: 'Скинути фільтри' }))
  expect(range.textContent).toBe(originalRange)
  await findEntryRows()
})

it('shows all saved history when clearing a report selection', async () => {
  render(page())
  await findEntryRows()
  fireEvent.click(screen.getByLabelText('Звіт'))
  fireEvent.click(await screen.findByRole('option', { name: 'Продажі з поверненнями' }))
  const summary = () => vi.mocked(getReportHistory).mock.calls.findLast(([query]) => query.limit === 1)?.[0]
  await waitFor(() => expect(summary()?.reports).toEqual(['2']))
  const filtered = summary()
  fireEvent.click(screen.getByRole('option', { name: 'Усі звіти' }))
  await waitFor(() => expect(summary()).toMatchObject({ from: filtered?.from, to: filtered?.to, reports: [] }))
  await findEntryRows()
})

it.each(['day', 'report'] as const)('loads all 238 reports without losing entries when grouped by %s', async grouping => {
  const items = Array.from({ length: 238 }, (_, index) => ({
    ...entry(`11111111-1111-1111-1111-${String(index + 1).padStart(12, '0')}`, 'u-1', 'Іван Петренко'),
    rowCount: index + 1,
  }))
  vi.mocked(getReportHistory).mockImplementation(async query => ({
    isHead: true, total: items.length,
    days: [{ day: '2026-11-17', count: items.length }],
    reports: [{ report: '2', dataSource: 2, profile: null, kind: 'report', count: items.length }],
    items: items.slice(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? 25)),
  }))
  render(page())
  await waitFor(() => expect(getRowCountCells()).toHaveLength(50))
  if (grouping === 'report') {
    fireEvent.click(screen.getByText('за звітами'))
    await waitFor(() => expect(vi.mocked(getReportHistory).mock.calls.some(([query]) => query.reports?.[0] === '2' && query.limit === 50)).toBe(true))
    await waitFor(() => expect(getRowCountCells()).toHaveLength(50))
  }
  for (const offset of [50, 100, 150, 200]) {
    fireEvent.click(screen.getByRole('button', { name: 'Показати ще' }))
    await waitFor(() => expect(getRowCountCells()).toHaveLength(Math.min(offset + 50, 238)))
    expect(getReportHistory).toHaveBeenCalledWith(expect.objectContaining({
      offset, limit: 50, ...(grouping === 'report' ? { reports: ['2'] } : { from: '2026-11-17', to: '2026-11-17' }),
    }))
  }
  expect(screen.queryByRole('button', { name: 'Показати ще' })).toBeNull()
  const cells = getRowCountCells()
  expect(cells.map(cell => cell.textContent)).toEqual(items.map(item => String(item.rowCount)))
  const last = within(cells[237].closest('tr')!)
  expect(last.getByRole('button', { name: 'Відкрити' })).toHaveProperty('disabled', false)
  expect(last.getByRole('button', { name: 'Завантажити Excel' })).toHaveProperty('disabled', false)
})

it('shows an explicit empty state without pagination when no history is visible', async () => {
  vi.mocked(getReportHistory).mockResolvedValue({ isHead: false, total: 0, days: [], reports: [], items: [] })
  render(page())
  expect(await screen.findByText('За вибраний період звітів не формували.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Показати ще' })).toBeNull()
  expect(getRowCountCells()).toHaveLength(0)
})
