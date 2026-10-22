import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { getHeadTasks } from '../api/salesCockpitApi'
import { HeadTaskBoard } from './HeadTaskBoard'

const mocks = vi.hoisted(() => ({ translate: (key: string) => key }))
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.translate }) }))
vi.mock('../../auth/usePermissions', () => ({ usePermissions: () => ({ can: () => false }) }))
vi.mock('../hooks/useCockpitRealtimeReload', () => ({ useCockpitRealtimeReload: (reload: () => void) => reload }))
vi.mock('../api/salesCockpitApi', () => ({ getHeadTasks: vi.fn(), addHeadTaskNote: vi.fn(), dismissHeadTask: vi.fn(), regenerateHeadCockpit: vi.fn() }))
vi.mock('./NewHeadTaskModal', () => ({ NewHeadTaskModal: () => null }))
vi.mock('./HeadDismissalsPanel', () => ({ HeadDismissalsPanel: () => null }))
vi.mock('./HeadTaskBoardModals', () => ({ BoardCancelModal: () => null, BoardNoteModal: () => null }))

function board(managerId: number | null) {
  return <MantineProvider theme={theme}><HeadTaskBoard managerId={managerId} onManagerChange={() => {}} /></MantineProvider>
}

describe('Head task board manager scope', () => {
  beforeEach(() => {
    vi.mocked(getHeadTasks).mockReset()
    vi.mocked(getHeadTasks).mockImplementation(async (params = {}) => ({
      IsHead: true, RequestedManagerNetUid: '', RequestedStatuses: [], RequestedManagerId: params.managerId ?? null,
      RequestedUrgency: null, RequestedTaskType: null, Skip: params.skip ?? 0, Limit: 50, ReturnedCount: 0,
      Total: params.managerId ? 1 : 80, Tasks: [],
      ByStatus: { Open: 80, InProgress: 0, Done: 0, Snoozed: 0, Dismissed: 0 },
      Managers: [{ ManagerId: 1, Name: 'Manager One' }],
    }))
  })

  it('opens page one when the team monitor changes manager from a later page', async () => {
    const view = render(board(null))
    const secondPage = await screen.findByRole('button', { name: '2' })
    fireEvent.click(secondPage)
    await waitFor(() => expect(getHeadTasks).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 50 })))

    view.rerender(board(1))
    await waitFor(() => expect(getHeadTasks).toHaveBeenLastCalledWith(expect.objectContaining({ managerId: 1, skip: 0 })))

    view.rerender(board(null))
    await waitFor(() => expect(getHeadTasks).toHaveBeenLastCalledWith(expect.objectContaining({ managerId: undefined, skip: 0 })))
  })
})
