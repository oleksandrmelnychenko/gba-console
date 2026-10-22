import { apiRequest } from '../../../shared/api/apiClient'
import { CONTACT_RESULTS, type ContactBody, type ContactBucket, type ContactEvent, type ContactHistory, type ContactPage } from '../contactTypes'

const contractError = () => new Error('Некоректна відповідь сервісу контактів. Оновіть дані або зверніться до адміністратора')
function validDate(value: unknown): value is string {
  return typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
}
function checkEvent(event: ContactEvent, managerId: number) {
  if (!event || typeof event.event_id !== 'string' || !Number.isInteger(event.client_id) || event.client_id <= 0
    || event.manager_id !== managerId || typeof event.client_name !== 'string' || typeof event.manager_name !== 'string'
    || !Object.hasOwn(CONTACT_RESULTS, event.result) || !validDate(event.at)
    || (event.note !== null && typeof event.note !== 'string')
    || (event.next_contact_at === null ? event.next_action !== null : !validDate(event.next_contact_at) || typeof event.next_action !== 'string' || !event.next_action.trim())) throw contractError()
}
function checkPage(data: ContactHistory | ContactPage, rows: ContactEvent[], offset: number) {
  if (!data || !Number.isInteger(data.manager_id) || data.manager_id <= 0 || data.offset !== offset || data.limit !== 20
    || !Number.isInteger(data.total) || data.total < 0 || !Array.isArray(rows) || data.count !== rows.length
    || rows.length !== Math.min(20, Math.max(0, data.total - offset))) throw contractError()
  rows.forEach((event) => checkEvent(event, data.manager_id))
}
export async function getContacts(bucket: ContactBucket, search: string, offset: number, signal?: AbortSignal): Promise<ContactPage> {
  const data = await apiRequest<ContactPage>('/sales/cockpit/contacts', { query: { bucket, search, offset, limit: 20 }, signal })
  checkPage(data, data?.contacts, offset)
  if (data.bucket !== bucket || data.search !== search || data.timezone !== 'Europe/Kyiv'
    || !/^\d{4}-\d{2}-\d{2}$/.test(data.as_of) || !data.counts
    || ['all', 'overdue', 'today', 'upcoming', 'unscheduled'].some((key) => !Number.isInteger(data.counts[key as ContactBucket]) || data.counts[key as ContactBucket] < 0)
    || data.total !== data.counts[bucket] || data.counts.all !== data.counts.overdue + data.counts.today + data.counts.upcoming + data.counts.unscheduled
    || new Set(data.contacts.map((event) => event.client_id)).size !== data.contacts.length) throw contractError()
  return data
}
export async function getContactHistory(clientId: number, offset: number, signal?: AbortSignal): Promise<ContactHistory> {
  const data = await apiRequest<ContactHistory>('/sales/cockpit/contacts/history', { query: { clientId, offset, limit: 20 }, signal })
  checkPage(data, data?.events, offset)
  if (data.client_id !== clientId || data.events.some((event) => event.client_id !== clientId)
    || new Set(data.events.map((event) => event.event_id)).size !== data.events.length) throw contractError()
  return data
}
export async function recordContact(body: ContactBody): Promise<ContactEvent> {
  const response = await apiRequest<{ manager_id: number; event: ContactEvent }>('/sales/cockpit/contacts', { method: 'POST', body })
  if (!response || !Number.isInteger(response.manager_id) || response.manager_id <= 0) throw contractError()
  checkEvent(response.event, response.manager_id)
  const event = response.event
  if (event.event_id !== body.EventId || event.client_id !== body.ClientId || event.result !== body.Result
    || event.note !== body.Note || event.next_action !== body.NextAction
    || (event.next_contact_at === null ? body.NextContactAt !== null : body.NextContactAt === null || Date.parse(event.next_contact_at) !== Date.parse(body.NextContactAt))) throw contractError()
  return event
}
