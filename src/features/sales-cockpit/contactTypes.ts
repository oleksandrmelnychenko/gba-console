export type ContactResult = 'reached' | 'no_answer' | 'proposal' | 'declined' | 'promised_payment'
export type ContactBucket = 'all' | 'overdue' | 'today' | 'upcoming' | 'unscheduled'
export type ContactClient = { client_id: number; client_name: string }
export type ContactEvent = ContactClient & {
  event_id: string; client_net_uid: string | null; manager_id: number; manager_name: string
  result: ContactResult; note: string | null; next_contact_at: string | null; next_action: string | null; at: string
}
export type ContactBody = {
  EventId: string; ClientId: number; Result: ContactResult; Note: string | null
  NextContactAt: string | null; NextAction: string | null
}
export type ContactPage = {
  manager_id: number; manager_net_uid: string; as_of: string; timezone: 'Europe/Kyiv'
  bucket: ContactBucket; search: string; offset: number; limit: number; count: number; total: number
  counts: Record<ContactBucket, number>; contacts: ContactEvent[]
}
export type ContactHistory = {
  manager_id: number; manager_net_uid: string; client_id: number
  offset: number; limit: number; count: number; total: number; events: ContactEvent[]
}
export const CONTACT_RESULTS: Record<ContactResult, string> = {
  reached: 'Поспілкувалися', no_answer: 'Немає відповіді', proposal: 'Обговорили пропозицію',
  declined: 'Відмова', promised_payment: 'Домовилися про оплату',
}
export const CONTACT_BUCKETS: Record<ContactBucket, string> = {
  all: 'Усі', overdue: 'Прострочені', today: 'Сьогодні', upcoming: 'Заплановані', unscheduled: 'Без наступної дати',
}
