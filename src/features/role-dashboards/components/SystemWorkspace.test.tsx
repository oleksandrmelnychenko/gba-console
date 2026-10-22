import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { AI_FLEET_SERVICES, getAiFleetServicesSnapshot } from '../../ai-fleet/api/aiFleetApi'
import type { AiFleetServicesSnapshot } from '../../ai-fleet/types'
import { SystemWorkspace } from './SystemWorkspace'

vi.mock('./SyncSourceStatus', () => ({ SyncSourceStatus: () => null }))

vi.mock('../../ai-fleet/api/aiFleetApi', () => ({
  AI_FLEET_SERVICES: [{ id: 'test-api', name: 'Test API', source: 'Test', location: '/ai/test', description: 'Test service' }],
  getAiFleetServicesSnapshot: vi.fn(),
}))
// Inspect the analytics passed to the directory, without rendering unrelated charts.
vi.mock('../../ai-fleet/components/AiFleetAnalyticsDashboard', () => ({
  AiFleetAnalyticsDashboard: ({ analytics }: { analytics: { passedCheckCount: number } }) => (
    <output data-testid="analytics">{analytics.passedCheckCount}</output>
  ),
}))

const getSnapshot = vi.mocked(getAiFleetServicesSnapshot)
const successNote = 'Усі сервіси доступні, прогрів свіжий.'
function healthy(): AiFleetServicesSnapshot {
  return { statuses: AI_FLEET_SERVICES.map((service) => ({
    serviceId: service.id,
    health: { state: 'healthy' },
    warmup: { state: 'healthy', lastFinishedAtUtc: new Date().toISOString() },
  })) }
}
function show(showDirectory = false) {
  return render(<MantineProvider><I18nProvider><SystemWorkspace showDirectory={showDirectory} /></I18nProvider></MantineProvider>)
}
function checkedAt() { return screen.getByText('Перевірено').nextElementSibling?.textContent }

beforeEach(() => { vi.restoreAllMocks(); getSnapshot.mockReset() })
afterEach(() => { vi.useRealTimers() })

describe('system workspace telemetry evidence', () => {
  it('removes the previous all-clear and timestamp after refresh fails, and recovers on success', async () => {
    getSnapshot.mockResolvedValueOnce(healthy()).mockRejectedValueOnce(new Error('Refresh failed')).mockResolvedValueOnce(healthy())
    show()
    await screen.findByText(successNote)
    expect(checkedAt()).not.toBe('—')

    fireEvent.click(screen.getByRole('button', { name: 'Оновити' }))
    await screen.findByText('Refresh failed')
    expect(screen.queryByText(successNote)).toBeNull()
    expect(screen.getByText('Неповні дані')).toBeTruthy()
    expect(screen.queryAllByText('Працює')).toHaveLength(0)
    expect(checkedAt()).toBe('—')

    fireEvent.click(screen.getByRole('button', { name: 'Оновити' }))
    await screen.findByText(successNote)
    expect(screen.queryByText('Refresh failed')).toBeNull()
    expect(checkedAt()).not.toBe('—')
  })

  it('does not treat partial telemetry as complete even when returned service checks are healthy', async () => {
    getSnapshot.mockResolvedValue({ ...healthy(), telemetryError: 'Operation telemetry missing' })
    show()
    await screen.findByText('Operation telemetry missing')
    expect(screen.queryByText(successNote)).toBeNull()
    expect(screen.getByText('Неповні дані')).toBeTruthy()
    expect(checkedAt()).toBe('—')
  })

  it('requires a warmup completion timestamp before claiming fresh readiness', async () => {
    const snapshot = healthy()
    snapshot.statuses[0].warmup.lastFinishedAtUtc = undefined
    getSnapshot.mockResolvedValue(snapshot)
    show()
    await screen.findByText('Неповні дані')
    expect(screen.queryByText(successNote)).toBeNull()
    expect(screen.getByText('Немає даних')).toBeTruthy()
  })

  it('does not count stale warmup as a healthy service', async () => {
    const snapshot = healthy()
    snapshot.statuses[0].warmup.lastFinishedAtUtc = '2020-01-01T00:00:00Z'
    getSnapshot.mockResolvedValue(snapshot)
    show()
    await screen.findByText('Увага')
    expect(screen.queryByText(successNote)).toBeNull()
    expect(screen.getByText('Готовність флоту').parentElement?.querySelector('.role-dashboard-fleet-score strong')?.textContent).toBe('0')
  })

  it('shows an initial failure as unknown instead of remaining in loading', async () => {
    getSnapshot.mockRejectedValue(new Error('Initial failure'))
    show()
    await screen.findByText('Initial failure')
    expect(screen.getByText('Неповні дані')).toBeTruthy()
    expect(checkedAt()).toBe('—')
  })

  it.each(['rejected request', 'partial snapshot'])('removes old current analytics after %s in the directory', async (failure) => {
    let refresh: (() => void) | undefined
    const setInterval = window.setInterval.bind(window)
    vi.spyOn(window, 'setInterval').mockImplementation((callback, delay, ...args) => {
      if (delay === 60_000) {
        refresh = callback as () => void
        return 123
      }
      return setInterval(callback, delay, ...args)
    })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    getSnapshot.mockResolvedValueOnce(healthy())
    if (failure === 'rejected request') getSnapshot.mockRejectedValueOnce(new Error('Refresh failed'))
    else getSnapshot.mockResolvedValueOnce({ ...healthy(), telemetryError: 'Refresh failed' })
    getSnapshot.mockResolvedValueOnce(healthy())
    show(true)
    await waitFor(() => expect(screen.getByTestId('analytics').textContent).toBe('2'))
    await act(async () => { refresh?.() })
    await screen.findByText('Refresh failed')
    expect(screen.queryByTestId('analytics')).toBeNull()
    expect(screen.getByText('Поточна аналітика недоступна: перевірку телеметрії не завершено.')).toBeTruthy()
    await act(async () => { refresh?.() })
    await waitFor(() => expect(screen.getByTestId('analytics').textContent).toBe('2'))
    expect(screen.queryByText('Refresh failed')).toBeNull()
  })
})
