import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
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

const data = { dataSource: 2, from: '2026-11-01', to: '2026-11-17', sorted: { Row: [], Col: [], Measurements: [] }, selections: [] }
const entry = (id: string, user: string, name: string) => ({ id, formedAtUtc: '2026-11-17T08:30:00Z', dataSource: 2, output: 'excel' as const,
  rowCount: 12, userNetId: user, userName: name, own: false, kind: 'report' as const, report: '2', data, movement: null })

beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear()
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
  const entries = await screen.findAllByTestId('report-history-entry')
  expect(entries).toHaveLength(2)
  expect(within(entries[0]).getByText('Продажі з поверненнями')).toBeTruthy()
  expect(within(entries[0]).getByText(/Рядків: 12/)).toBeTruthy()
  expect(within(entries[0]).getByText(/Іван Петренко \(u-1\)/)).toBeTruthy()
  expect(vi.mocked(getReportHistory).mock.calls.some(([query]) => query.from === '2026-11-17' && query.to === '2026-11-17')).toBe(true)
})

it('rebuilds an entry on the reports page with its settings', async () => {
  render(page())
  const entries = await screen.findAllByTestId('report-history-entry')
  fireEvent.click(within(entries[0]).getByRole('button', { name: 'Excel' }))
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
  expect(screen.getAllByText('Продажі з поверненнями').length).toBeGreaterThan(0)
  await waitFor(() => expect(vi.mocked(getReportHistory).mock.calls.some(([query]) =>
    query.reports?.length === 1 && query.reports[0] === '2' && query.from !== query.to && query.limit === 50)).toBe(true))
})
