import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { getDashboardQueue } from '../api/dashboardQueuesApi'
import type { WorkspaceQueue } from '../queueTypes'
import { WorkspaceQueueModal } from './WorkspaceQueueModal'

vi.mock('../api/dashboardQueuesApi', () => ({ getDashboardQueue: vi.fn() }))
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../navigation/hooks/useNavigation', () => ({ useNavigation: () => ({ modules: [] }) }))
vi.mock('../../navigation/navigationUtils', () => ({ isNavigationPathAllowed: () => false }))
const data: WorkspaceQueue = { workspace: 'driver', key: 'pending', from: '2026-10-01', to: '2026-11-01', asOfUtc: '2026-10-22T12:00:00Z', readAtUtc: '2026-10-22T12:00:00Z', offset: 0, limit: 50, total: 1, aggregateValue: 1, label: 'Очікують відправлення', unit: 'count', timeBasis: 'period', formula: 'Невідправлені листи', source: 'ShipmentList', grain: 'Лист', scope: 'Лише поточний водій', rows: [{ id: 17, netUid: null, number: 'Лист-17', documentDate: null, quantity: null, route: '/warehouse/ukraine', description: 'Очікує' }] }
const location = '/dashboard?view=driver&queue=pending&queueFrom=2026-10-01&queueTo=2026-11-01&queueAsOf=2026-10-22T12%3A00%3A00Z&queueValue=1'
function draw(url = location) { return render(<MantineProvider env="test"><MemoryRouter initialEntries={[url]}><WorkspaceQueueModal workspace="driver" /></MemoryRouter></MantineProvider>) }
beforeEach(() => { vi.resetAllMocks(); vi.mocked(getDashboardQueue).mockResolvedValue(data) })

it('opens the exact scoped queue and does not offer a general link without navigation permission', async () => {
  draw()
  await screen.findByText('Лист-17')
  expect(getDashboardQueue).toHaveBeenCalledWith(expect.objectContaining({ workspace: 'driver', key: 'pending', offset: 0, from: '2026-10-01', to: '2026-11-01', asOf: '2026-10-22T12:00:00Z' }), expect.any(AbortSignal))
  expect(screen.queryByRole('link')).toBeNull()
  expect(screen.getByText(/не відновлює історичний стан бази/)).toBeTruthy()
})
it('clears stale records on refresh failure and recovers using the same scope', async () => {
  draw(); await screen.findByText('Лист-17')
  vi.mocked(getDashboardQueue).mockRejectedValueOnce(new Error('Черга недоступна'))
  fireEvent.click(screen.getByRole('button', { name: 'Оновити чергу' }))
  await screen.findByText('Черга недоступна')
  expect(screen.queryByText('Лист-17')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Оновити чергу' }))
  await screen.findByText('Лист-17')
})
it('explains changed data instead of pretending the cached KPI is a historical snapshot', async () => {
  vi.mocked(getDashboardQueue).mockResolvedValue({ ...data, aggregateValue: 0, total: 0, rows: [] })
  draw(); await screen.findByText('Записів у цій черзі немає')
  expect(screen.getByText(/Дані змінилися після розрахунку дашборда/)).toBeTruthy()
})
it('preserves a route back after the second page shrinks', async () => {
  vi.mocked(getDashboardQueue).mockImplementation(async request => request.offset === 0 ? { ...data, total: 51 } : { ...data, offset: 50, total: 1, rows: [] })
  draw(); await screen.findByText('Лист-17')
  fireEvent.click(screen.getByRole('button', { name: '2' }))
  await screen.findByText(/На цій сторінці записів більше немає/)
  fireEvent.click(screen.getByRole('button', { name: '1' }))
  await screen.findByText('Лист-17')
  await waitFor(() => expect(getDashboardQueue).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0 }), expect.any(AbortSignal)))
})
it('rejects malformed queue dates without querying', async () => {
  draw(location.replace('queueFrom=2026-10-01', 'queueFrom=2026-02-30'))
  await screen.findByText('Некоректні параметри черги')
  expect(getDashboardQueue).not.toHaveBeenCalled()
})

it('shows underlying documents for an unknown financial total without comparing it to zero', async () => {
  vi.mocked(getDashboardQueue).mockResolvedValue({ ...data, aggregateValue: null, unit: 'EUR', rows: [{ ...data.rows[0], quantity: null, description: 'Історична собівартість не підтверджена' }] })
  draw(location.replace('&queueValue=1', ''))
  await screen.findByText('Лист-17')
  expect(screen.getByText(/Значення показника.*Не визначено/)).toBeTruthy()
  expect(screen.getByText('Історична собівартість не підтверджена')).toBeTruthy()
  expect(screen.queryByText(/Дані змінилися після розрахунку/)).toBeNull()
})

it.each([
  [-0.0001, '0', false],
  [-0.01, '0', true],
  [311324.4742, '311324.47', false],
  [232175.276, '232175.28', false],
  [-20596.779, '-20596.78', false],
  [1.005, '1.01', false],
  [-1.005, '-1.01', false],
  [1.005, '1.00', true],
  [-1.005, '-1.00', true],
  [311324.486, '311324.47', true],
])('compares EUR source %s with cached cents %s using the same monetary precision', async (aggregateValue, expected, changed) => {
  vi.mocked(getDashboardQueue).mockResolvedValue({ ...data, aggregateValue, unit: 'EUR' })
  draw(location.replace('queueValue=1', `queueValue=${expected}`))
  await screen.findByText('Лист-17')
  expect(Boolean(screen.queryByText(/Дані змінилися після розрахунку/))).toBe(changed)
})

it('keeps quantity comparison exact instead of hiding a sub-cent-sized stock change', async () => {
  vi.mocked(getDashboardQueue).mockResolvedValue({ ...data, aggregateValue: 1.0001, unit: 'qty' })
  draw()
  await screen.findByText('Лист-17')
  expect(screen.getByText(/Дані змінилися після розрахунку/)).toBeTruthy()
})
