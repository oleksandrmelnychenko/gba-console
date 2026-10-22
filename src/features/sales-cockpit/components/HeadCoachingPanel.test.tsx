import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getHeadCoaching, assignHeadTask, type CoachingPage } from '../api/headCoachingApi'
import { HeadCoachingPanel } from './HeadCoachingPanel'

const permissions = vi.hoisted(() => ({ allowed: true }))
vi.mock('../hooks/useCockpitRealtimeReload', () => ({ useCockpitRealtimeReload: (reload: () => void) => reload }))
vi.mock('../../auth/usePermissions', () => ({ usePermissions: () => ({ can: () => permissions.allowed }) }))
vi.mock('../api/headCoachingApi', () => ({ getHeadCoaching: vi.fn(), assignHeadTask: vi.fn() }))
vi.mock('../../../shared/ui/ToolbarDateRangeFilter', () => ({ ToolbarDateRangeFilter: ({ onChange }: { onChange: (r: { from: string; to: string }) => void }) => <button onClick={() => onChange({ from: '2026-10-01', to: '2026-10-22' })}>Set range</button> }))
const row = { key: 'task-1', task_key: 'task-1', client_id: 7, client_name: 'Клієнт', manager_id: 1, manager_name: 'Іван', title: 'Передзвонити', status: 'open', task_type: 'manual', due_at: '2026-10-21T10:00:00Z', updated_at: '2026-10-22T10:00:00Z', contact_at: null, assignment_history: [] }
const managers = [{ id: 1, name: 'Іван' }, { id: 2, name: 'Олена' }]
function panel(managerId: number | null = null, onChanged = vi.fn()) { return <MantineProvider><HeadCoachingPanel managerId={managerId} managers={managers} onChanged={onChanged} /></MantineProvider> }
beforeEach(() => {
  permissions.allowed = true
  vi.mocked(assignHeadTask).mockReset()
  vi.mocked(getHeadCoaching).mockReset()
  vi.mocked(getHeadCoaching).mockImplementation(async params => ({ as_of: '2026-10-22T12:00:00Z', requested_manager_id: params.managerId ?? null, bucket: params.bucket, status: params.status, date_from: params.dateFrom ?? null, date_to: params.dateTo ?? null, offset: params.offset, limit: params.limit, total: 41, count: 1, rows: [row], managers, counts: { workload: 41, repeat_tasks: 3, overdue_promises: 2, without_next_contact: 7 } } as CoachingPage))
})
describe('head coaching queues', () => {
  it('resets page on manager/date changes and preserves selected category', async () => {
    const view = render(panel())
    fireEvent.click(await screen.findByRole('button', { name: '2' }))
    await waitFor(() => expect(getHeadCoaching).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 20 }), expect.any(AbortSignal)))
    view.rerender(panel(2))
    await waitFor(() => expect(getHeadCoaching).toHaveBeenLastCalledWith(expect.objectContaining({ managerId: 2, offset: 0, bucket: 'overdue_promises' }), expect.any(AbortSignal)))
    fireEvent.click(screen.getByRole('button', { name: 'Set range' }))
    await waitFor(() => expect(getHeadCoaching).toHaveBeenLastCalledWith(expect.objectContaining({ dateFrom: '2026-10-01', dateTo: '2026-10-22', offset: 0 }), expect.any(AbortSignal)))
  })
  it('sends the captured assignment version and requires clarification', async () => {
    vi.mocked(assignHeadTask).mockResolvedValue({})
    const changed = vi.fn()
    render(panel(null, changed))
    fireEvent.click(await screen.findByRole('button', { name: 'Передати / уточнити' }))
    expect((screen.getByRole('button', { name: 'Зберегти призначення' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/Уточнення \/ причина/), { target: { value: 'Уточнений дзвінок' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти призначення' }))
    await waitFor(() => expect(assignHeadTask).toHaveBeenCalledWith(row, 1, 'Уточнений дзвінок'))
    await waitFor(() => expect(changed).toHaveBeenCalledOnce())
  })
  it('keeps conflict visible and does not announce success', async () => {
    vi.mocked(assignHeadTask).mockRejectedValue(new Error('task_changed_or_closed'))
    const changed = vi.fn(); render(panel(null, changed))
    fireEvent.click(await screen.findByRole('button', { name: 'Передати / уточнити' }))
    fireEvent.change(screen.getByLabelText(/Уточнення \/ причина/), { target: { value: 'Контакт' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти призначення' }))
    expect(await screen.findByText('task_changed_or_closed')).toBeTruthy()
    expect(changed).not.toHaveBeenCalled()
  })
  it('clears obsolete counts on refresh failure', async () => {
    render(panel())
    await screen.findByText('Клієнт')
    vi.mocked(getHeadCoaching).mockRejectedValue(new Error('source unavailable'))
    fireEvent.click(screen.getByRole('button', { name: 'Оновити черги' }))
    expect(await screen.findByText('source unavailable')).toBeTruthy()
    expect(screen.queryByText('Клієнт')).toBeNull()
    expect(screen.queryByText('Активні задачі · 41')).toBeNull()
  })
  it('hides assignment actions without permission', async () => {
    permissions.allowed = false; render(panel())
    await screen.findByText('Клієнт')
    expect(screen.queryByRole('button', { name: 'Передати / уточнити' })).toBeNull()
  })
})
