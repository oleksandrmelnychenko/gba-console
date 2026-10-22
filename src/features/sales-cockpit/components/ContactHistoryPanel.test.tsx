import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { getContactHistory } from '../api/contactsApi'
import { ContactHistoryPanel } from './ContactHistoryPanel'
const mocks = vi.hoisted(() => ({ t: (key: string) => key }))
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.t }) }))
vi.mock('../api/contactsApi', () => ({ getContactHistory: vi.fn() }))
it('pages preserved previous notes and promises separately from the latest agreement', async () => {
  vi.mocked(getContactHistory).mockResolvedValue({ manager_id: 1, manager_net_uid: 'manager', client_id: 42, offset: 0, limit: 20, count: 2, total: 21, events: [
    { event_id: 'new', client_id: 42, client_name: 'Client', client_net_uid: 'client', manager_id: 1, manager_name: 'Seller', result: 'no_answer', note: 'No answer today', next_contact_at: null, next_action: null, at: '2026-10-22T09:00:00Z' },
    { event_id: 'old', client_id: 42, client_name: 'Client', client_net_uid: 'client', manager_id: 1, manager_name: 'Seller', result: 'promised_payment', note: 'Old promise retained', next_contact_at: '2026-10-22T09:00:00Z', next_action: 'Payment followup', at: '2026-10-21T09:00:00Z' },
  ] })
  render(<MantineProvider theme={theme}><ContactHistoryPanel clientId={42} /></MantineProvider>)
  expect(await screen.findByText('Old promise retained')).toBeTruthy()
  expect(screen.getByText('No answer today')).toBeTruthy()
  expect(screen.getByText(/Payment followup/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '2' }))
  await waitFor(() => expect(getContactHistory).toHaveBeenLastCalledWith(42, 20, expect.any(AbortSignal)))
})
