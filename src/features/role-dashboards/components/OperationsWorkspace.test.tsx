import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { DashboardWorkspaceSummary } from '../types'
import { OperationsWorkspace } from './OperationsWorkspace'
import { WorkspaceSummary } from './WorkspaceSummary'

vi.mock('../../navigation/hooks/useNavigation', () => ({ useNavigation: () => ({ modules: [] }) }))
const summary: DashboardWorkspaceSummary = {
  workspace: 'warehouse', from: '2026-10-24', to: '2026-10-27', generatedAtUtc: '2026-10-24T08:00:00Z', cacheTtlSeconds: 30, dataFreshness: 'live',
  metrics: ['receipts', 'receipt-qty', 'awaiting-placement', 'negative-stock', 'transfers'].map((key) => ({ key, label: key, value: 0, hasData: true, coveragePercent: 100, tone: 'positive', unit: 'count', timeBasis: 'period', route: '/general-register' })),
}
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname + location.search}</output> }
function show(value: DashboardWorkspaceSummary | null, error: string | null = null) {
  return render(<MantineProvider><I18nProvider><MemoryRouter>
    <WorkspaceSummary state={{ summary: value, error, isRefreshing: false, reload: vi.fn() }} />
    <OperationsWorkspace summary={value} error={error} workspaceKey="warehouse" /><Location />
  </MemoryRouter></I18nProvider></MantineProvider>)
}

describe('operations dashboard evidence states', () => {
  it('qualifies a zero result to the metrics actually checked', () => {
    show(summary)
    expect(screen.getByText('Відхилень у доступних показниках немає')).toBeTruthy()
    expect(screen.getByText('Перевірено лише наведені показники')).toBeTruthy()
  })
  it('does not present missing or partial data as an all-clear', () => {
    show({ ...summary, metrics: summary.metrics.map((m) => m.key === 'receipts' ? { ...m, coveragePercent: 50 } : m) })
    expect(screen.getByText('Недостатньо даних для перевірки відхилень')).toBeTruthy()
    expect(screen.queryByText('Відхилень у доступних показниках немає')).toBeNull()
  })
  it('keeps an update error visible even with a previous zero summary', () => {
    show(summary, 'Refresh failed')
    expect(screen.getByText('Перевірку показників не завершено: помилка оновлення')).toBeTruthy()
    expect(screen.queryByText('Відхилень у доступних показниках немає')).toBeNull()
  })
  it('does not leave an initial failure as a permanent loading state', () => {
    show(null, 'Refresh failed')
    expect(screen.getByText('Перевірку показників не завершено: помилка оновлення')).toBeTruthy()
  })
  it('only navigates an exact transfer KPI and carries its selected period', () => {
    show(summary)
    expect(screen.queryByRole('button', { name: 'receipts: 0' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'transfers: 0' }))
    expect(screen.getByTestId('location').textContent).toBe('/products/transfers?dashboardFrom=2026-10-24&dashboardToExclusive=2026-10-27')
  })
})
