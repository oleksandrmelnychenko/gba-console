import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import type { ContactEvent } from '../contactTypes'
import { getContactHistory, getContacts, recordContact } from './contactsApi'
vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
const event: ContactEvent = { event_id: 'uuid', client_id: 42, client_name: 'Client', client_net_uid: 'client', manager_id: 1, manager_name: 'Seller', result: 'reached', note: null, next_contact_at: '2026-10-22T09:00:00Z', next_action: 'Call', at: '2026-10-21T09:00:00Z' }
function page() { return { manager_id: 1, manager_net_uid: 'manager', as_of: '2026-10-22', timezone: 'Europe/Kyiv', bucket: 'today', search: 'A.*[', offset: 0, limit: 20, count: 1, total: 1, counts: { all: 1, overdue: 0, today: 1, upcoming: 0, unscheduled: 0 }, contacts: [event] } }
describe('contact contract', () => {
  beforeEach(() => vi.clearAllMocks())
  it('sends plain search and server pagination with cancellation', async () => {
    vi.mocked(apiRequest).mockResolvedValue(page())
    const signal = new AbortController().signal
    expect((await getContacts('today', 'A.*[', 0, signal)).contacts).toEqual([event])
    expect(apiRequest).toHaveBeenCalledWith('/sales/cockpit/contacts', { query: { bucket: 'today', search: 'A.*[', offset: 0, limit: 20 }, signal })
  })
  it.each([
    { ...page(), contacts: [{ ...event, manager_id: 99 }] },
    { ...page(), contacts: [{ ...event, at: '2026-10-21T09:00:00' }] },
    { ...page(), total: 99 },
    { ...page(), total: 99, counts: { all: 99, today: 99, overdue: 0, upcoming: 0, unscheduled: 0 } },
    { ...page(), contacts: [event, event], count: 2 },
    { ...page(), counts: { all: 5, today: 1, overdue: 0, upcoming: 0, unscheduled: 0 } },
  ])('rejects incomplete or contradictory queue response %#', async (data) => {
    vi.mocked(apiRequest).mockResolvedValue(data)
    await expect(getContacts('today', 'A.*[', 0)).rejects.toThrow('Некоректна відповідь')
  })
  it('rejects history for another client', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ manager_id: 1, client_id: 43, offset: 0, limit: 20, count: 1, total: 1, events: [{ ...event, client_id: 43 }] })
    await expect(getContactHistory(42, 0)).rejects.toThrow('Некоректна відповідь')
  })
  it('only acknowledges the same event and exact saved payload', async () => {
    const body = { EventId: 'uuid', ClientId: 42, Result: 'reached' as const, Note: null, NextContactAt: '2026-10-22T09:00:00.000Z', NextAction: 'Call' }
    vi.mocked(apiRequest).mockResolvedValue({ manager_id: 1, event })
    expect(await recordContact(body)).toEqual(event)
    vi.mocked(apiRequest).mockResolvedValue({ manager_id: 1, event: { ...event, event_id: 'other-event' } })
    await expect(recordContact(body)).rejects.toThrow('Некоректна відповідь')
  })
})
