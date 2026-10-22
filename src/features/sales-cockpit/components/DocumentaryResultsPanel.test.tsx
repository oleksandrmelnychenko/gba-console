import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import type { ContactEvent } from '../contactTypes'
import { getAttributionCandidates, getAttributionLinks, linkAttribution, type AttributionLink, type AttributedDocument } from '../api/attributionApi'
import { getContactHistory } from '../api/contactsApi'
import { DocumentaryResultsPanel, TaskDocumentaryResults } from './DocumentaryResultsPanel'

vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../api/attributionApi', () => ({ getAttributionCandidates: vi.fn(), getAttributionLinks: vi.fn(), linkAttribution: vi.fn() }))
vi.mock('../api/contactsApi', () => ({ getContactHistory: vi.fn() }))
const document: AttributedDocument = { sale_id: 1, sale_net_uid: 'sale-1', client_id: 7, number: 'INV-1', document_date: '2026-10-22', date_basis: 'native_invoice_kyiv', shipment_date: null, order_id: 8, offer_net_uid: null, document_currency: 'UAH', canceled: false, merged: false, is_invoice: true, retained_lines: 2, payments: [], returns: [] }
const row: AttributionLink = { sale_net_uid: 'sale-1', task_key: 'task-a', client_id: 7, manager_id: 1, manager_name: 'Колишній менеджер', linked_at: '2026-10-22T12:00:00Z', contact_event_id: null, contact_manager_id: null, policy: 'explicit_primary_task_v1', evidence: { state: 'confirmed', document, allocated_payment_eur: 25.12, recorded_return_credit_eur: null, return_credit_coverage_complete: false } }
const page = { offset: 0, limit: 20, count: 1, total: 1, rows: [row] }
const draw = (element: React.ReactNode) => render(<MantineProvider env="test">{element}</MantineProvider>)
beforeEach(() => {
  vi.resetAllMocks()
  HTMLElement.prototype.scrollIntoView = vi.fn()
  vi.mocked(getAttributionLinks).mockResolvedValue(page)
  vi.mocked(getAttributionCandidates).mockResolvedValue({ ...page, rows: [document] })
  vi.mocked(getContactHistory).mockResolvedValue({ manager_id: 1, manager_net_uid: 'manager', client_id: 7, offset: 0, limit: 20, count: 0, total: 0, events: [] })
  vi.mocked(linkAttribution).mockResolvedValue(undefined)
})

it('keeps historical owner and unknown refund separate from documented payment', async () => {
  draw(<DocumentaryResultsPanel head />)
  await screen.findByText('Колишній менеджер', { exact: false })
  expect(screen.getByText(/Розподілена оплата:/).textContent).toContain('25,12')
  expect(screen.getByText(/Зараховано за поверненнями:/).textContent).toContain('Немає підтверджених даних')
  expect(screen.getByText(/це не чиста виручка/)).toBeTruthy()
})

it('clears previously displayed financial evidence after a refresh failure', async () => {
  draw(<DocumentaryResultsPanel />)
  await screen.findByText('INV-1', { exact: false })
  vi.mocked(getAttributionLinks).mockRejectedValueOnce(new Error('Джерело недоступне'))
  fireEvent.click(screen.getByRole('button', { name: 'Оновити документи' }))
  await screen.findByText('Джерело недоступне')
  expect(screen.queryByText('INV-1', { exact: false })).toBeNull()
})

it('does not offer a write action without permission', async () => {
  draw(<TaskDocumentaryResults task={{ task_key: 'task-a', client_id: 7 }} canLink={false} />)
  fireEvent.click(screen.getByRole('button', { name: 'Документи результату' }))
  await screen.findByText('Пов’язаних продажів: 1')
  expect(getAttributionCandidates).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Пов’язати з цією задачею' })).toBeNull()
})

it('links only after an explicit action and surfaces exclusive sale conflicts', async () => {
  vi.mocked(linkAttribution).mockRejectedValueOnce(new Error('Продаж уже пов’язаний з іншою задачею'))
  draw(<TaskDocumentaryResults task={{ task_key: 'task-a', client_id: 7 }} canLink />)
  fireEvent.click(screen.getByRole('button', { name: 'Документи результату' }))
  const button = await screen.findByRole('button', { name: 'Пов’язати з цією задачею' })
  expect(linkAttribution).not.toHaveBeenCalled()
  fireEvent.click(button)
  await screen.findByText('Продаж уже пов’язаний з іншою задачею')
  expect(linkAttribution).toHaveBeenCalledExactlyOnceWith('task-a', 'sale-1', null)
})

it('blocks draft and merged candidates', async () => {
  vi.mocked(getAttributionCandidates).mockResolvedValue({ ...page, count: 2, total: 2, rows: [{ ...document, is_invoice: false }, { ...document, sale_net_uid: 'sale-2', merged: true }] })
  draw(<TaskDocumentaryResults task={{ task_key: 'task-a', client_id: 7 }} canLink />)
  fireEvent.click(screen.getByRole('button', { name: 'Документи результату' }))
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Пов’язати з цією задачею' })).toHaveLength(2))
  expect(screen.getAllByRole('button', { name: 'Пов’язати з цією задачею' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true)
})


it.each(['sales', 'contacts'])('retries a failed %s source from the modal without waiting for polling', async (source) => {
  const request = source === 'sales' ? vi.mocked(getAttributionCandidates) : vi.mocked(getContactHistory)
  request.mockRejectedValueOnce(new Error('Список недоступний'))
  draw(<TaskDocumentaryResults task={{ task_key: 'task-a', client_id: 7 }} canLink />)
  fireEvent.click(screen.getByRole('button', { name: 'Документи результату' }))
  await screen.findByText('Список недоступний')
  expect(screen.queryByRole('button', { name: 'Пов’язати з цією задачею' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Оновити продажі та контакти' }))
  await screen.findByRole('button', { name: 'Пов’язати з цією задачею' })
  expect(getAttributionCandidates).toHaveBeenCalledTimes(2)
  expect(getContactHistory).toHaveBeenCalledTimes(2)
  expect(linkAttribution).not.toHaveBeenCalled()
})

it('preserves the selected contact label and exact identity when refreshed history pushes it off the page', async () => {
  const user = userEvent.setup()
  const selected: ContactEvent = { event_id: 'contact-selected', client_id: 7, client_name: 'Клієнт', client_net_uid: null, manager_id: 1, manager_name: 'Марія', result: 'promised_payment', note: null, next_contact_at: null, next_action: null, at: '2026-10-22T09:00:00Z' }
  const history = { manager_id: 1, manager_net_uid: 'manager', client_id: 7, offset: 0, limit: 20, count: 20, total: 20, events: Array.from({ length: 20 }, (_, i) => ({ ...selected, event_id: i === 19 ? selected.event_id : `contact-${i}`, manager_name: i === 19 ? selected.manager_name : `Контакт ${i}` })) }
  vi.mocked(getContactHistory).mockResolvedValue(history)
  draw(<TaskDocumentaryResults task={{ task_key: 'task-a', client_id: 7 }} canLink />)
  await user.click(screen.getByRole('button', { name: 'Документи результату' }))
  const selector = await screen.findByRole('combobox', { name: 'Пов’язаний контакт (необов’язково)' })
  await user.click(selector)
  await user.click(await screen.findByRole('option', { name: /Марія · Домовилися про оплату/ }))
  expect((selector as HTMLInputElement).value).toContain('Марія · Домовилися про оплату')
  vi.mocked(getContactHistory).mockResolvedValue({ ...history, total: 21, events: [{ ...selected, event_id: 'contact-new', manager_name: 'Новий контакт' }, ...history.events.slice(0, 19)] })
  await user.click(screen.getByRole('button', { name: 'Оновити продажі та контакти' }))
  await waitFor(() => expect(getContactHistory).toHaveBeenCalledTimes(2))
  expect((await screen.findByRole('combobox', { name: 'Пов’язаний контакт (необов’язково)' }) as HTMLInputElement).value).toContain('Марія · Домовилися про оплату')
  await user.click(screen.getByRole('button', { name: 'Пов’язати з цією задачею' }))
  await waitFor(() => expect(linkAttribution).toHaveBeenCalledExactlyOnceWith('task-a', 'sale-1', 'contact-selected'))
})

it('keeps an escape to page one when the candidate population shrinks on page two', async () => {
  vi.mocked(getAttributionCandidates).mockImplementation(async (_task, offset) => ({ ...page, offset, total: 21, rows: offset === 0 ? [document] : [{ ...document, number: 'INV-21' }] }))
  draw(<TaskDocumentaryResults task={{ task_key: 'task-a', client_id: 7 }} canLink />)
  fireEvent.click(screen.getByRole('button', { name: 'Документи результату' }))
  fireEvent.click(within(await screen.findByRole('navigation', { name: 'Сторінки документів клієнта' })).getByRole('button', { name: '2' }))
  await screen.findByText('INV-21', { exact: false })
  vi.mocked(getAttributionCandidates).mockImplementation(async (_task, offset) => ({ ...page, offset, total: 1, count: offset === 0 ? 1 : 0, rows: offset === 0 ? [document] : [] }))
  fireEvent.click(screen.getByRole('button', { name: 'Оновити продажі та контакти' }))
  await waitFor(() => expect(screen.queryByText('INV-21', { exact: false })).toBeNull())
  fireEvent.click(within(await screen.findByRole('navigation', { name: 'Сторінки документів клієнта' })).getByRole('button', { name: '1' }))
  await screen.findByRole('button', { name: 'Пов’язати з цією задачею' })
  expect(getAttributionCandidates).toHaveBeenLastCalledWith('task-a', 0, expect.any(AbortSignal))
})

it('resets the linked-document page when the task context changes', async () => {
  vi.mocked(getAttributionLinks).mockImplementation(async (task, _head, offset) => ({ ...page, offset, total: task === 'task-a' ? 21 : 1, rows: [{ ...row, task_key: task }] }))
  const view = draw(<DocumentaryResultsPanel taskKey="task-a" />)
  fireEvent.click(within(await screen.findByRole('navigation', { name: 'Сторінки пов’язаних продажів' })).getByRole('button', { name: '2' }))
  await waitFor(() => expect(getAttributionLinks).toHaveBeenLastCalledWith('task-a', false, 20, expect.any(AbortSignal)))
  view.rerender(<MantineProvider env="test"><DocumentaryResultsPanel taskKey="task-b" /></MantineProvider>)
  await screen.findByText('Задача: task-b')
  expect(getAttributionLinks).toHaveBeenLastCalledWith('task-b', false, 0, expect.any(AbortSignal))
})


it('marks stored dates without a confirmed source timezone in both evidence and candidates', async () => {
  const uncertain = { ...document, date_basis: 'stored_sale_date_unverified' as const }
  vi.mocked(getAttributionCandidates).mockResolvedValue({ ...page, rows: [uncertain] })
  vi.mocked(getAttributionLinks).mockResolvedValue({ ...page, rows: [{ ...row, evidence: { ...row.evidence, document: uncertain } }] })
  draw(<TaskDocumentaryResults task={{ task_key: 'task-a', client_id: 7 }} canLink />)
  fireEvent.click(screen.getByRole('button', { name: 'Документи результату' }))
  await waitFor(() => expect(screen.getAllByText('Збережена дата; часовий пояс джерела не підтверджено')).toHaveLength(2))
})
