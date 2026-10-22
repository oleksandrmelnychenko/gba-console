import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { getContacts } from '../api/contactsApi'
import type { ContactPage } from '../contactTypes'
import { ContactsPanel } from './ContactsPanel'
const mocks = vi.hoisted(() => ({ t: (key: string) => key }))
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.t }) }))
vi.mock('../api/contactsApi', () => ({ getContacts: vi.fn() }))
const response: ContactPage = {
  manager_id: 1, manager_net_uid: 'manager', as_of: '2026-10-22', timezone: 'Europe/Kyiv',
  bucket: 'today', search: '', offset: 0, limit: 20, count: 1, total: 241,
  counts: { all: 301, today: 241, overdue: 30, upcoming: 20, unscheduled: 10 },
  contacts: [{ event_id: 'event', client_id: 42, client_name: 'Last promise', client_net_uid: 'client', manager_id: 1, manager_name: 'Manager', result: 'no_answer', note: null, next_contact_at: '2026-10-22T09:00:00Z', next_action: 'Call', at: '2026-10-21T07:00:00Z' }],
}
function mount() { return render(<MantineProvider theme={theme}><ContactsPanel revision={0} onOpen={vi.fn()} /></MantineProvider>) }
describe('server paginated contact commitments', () => {
  afterEach(() => vi.useRealTimers())
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(getContacts).mockResolvedValue(response) })
  it('shows counts beyond 200 from the server and requests a new page without loading the entire book', async () => {
    mount()
    expect(await screen.findByRole('button', { name: 'Сьогодні (241)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Усі (301)' })).toBeTruthy()
    expect(screen.getByText('22.10.26, 12:00 (Київ) — Call')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    await waitFor(() => expect(getContacts).toHaveBeenLastCalledWith('today', '', 20, expect.any(AbortSignal)))
  })
  it('sends escaped search input as plain text to server and resets page on bucket changes', async () => {
    mount(); await screen.findByText('Last promise')
    fireEvent.change(screen.getByLabelText('Пошук контакту'), { target: { value: 'A.*[' } })
    await waitFor(() => expect(getContacts).toHaveBeenLastCalledWith('today', 'A.*[', 0, expect.any(AbortSignal)))
    fireEvent.click(screen.getByRole('button', { name: 'Прострочені (30)' }))
    await waitFor(() => expect(getContacts).toHaveBeenLastCalledWith('overdue', 'A.*[', 0, expect.any(AbortSignal)))
  })
  it('refreshes visible-day counts without overlapping a slow request', async () => {
    vi.useFakeTimers()
    vi.mocked(getContacts).mockReturnValue(new Promise(() => {}))
    const view = mount()
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    expect(getContacts).toHaveBeenCalledTimes(1)
    view.unmount()
  })
  it('refreshes on minute and visibility re-entry so yesterday counts do not persist', async () => {
    vi.useFakeTimers()
    const view = mount()
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(getContacts).toHaveBeenCalledTimes(2)
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(getContacts).toHaveBeenCalledTimes(3)
    view.unmount()
  })
  it('recovers an out-of-range page after a saved commitment leaves its bucket', async () => {
    const view = mount()
    await screen.findByText('Last promise')
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    await waitFor(() => expect(getContacts).toHaveBeenLastCalledWith('today', '', 20, expect.any(AbortSignal)))
    vi.mocked(getContacts).mockResolvedValue({ ...response, total: 1 })
    view.rerender(<MantineProvider theme={theme}><ContactsPanel revision={1} onOpen={vi.fn()} /></MantineProvider>)
    await waitFor(() => expect(getContacts).toHaveBeenLastCalledWith('today', '', 0, expect.any(AbortSignal)))
    expect(await screen.findByText('Last promise')).toBeTruthy()
  })
  it('aborts outstanding requests on unmount', () => {
    vi.mocked(getContacts).mockReturnValue(new Promise(() => {}))
    const view = mount()
    const signal = vi.mocked(getContacts).mock.calls[0][3]!
    expect(signal.aborted).toBe(false)
    view.unmount()
    expect(signal.aborted).toBe(true)
  })
  it('shows load failures instead of an empty success state', async () => {
    vi.mocked(getContacts).mockRejectedValue(new Error('Contacts unavailable'))
    mount(); expect(await screen.findByText('Contacts unavailable')).toBeTruthy()
    expect(screen.queryByText('Контактів за цими умовами немає')).toBeNull()
  })
})
