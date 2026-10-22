import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { recordContact } from '../api/contactsApi'
import type { ContactEvent } from '../contactTypes'
import { ContactModal } from './ContactModal'

const mocks = vi.hoisted(() => ({ t: (key: string) => key }))
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.t }) }))
vi.mock('../api/contactsApi', () => ({ recordContact: vi.fn() }))
vi.mock('./ContactHistoryPanel', () => ({ ContactHistoryPanel: ({ clientId }: { clientId: number }) => <div>History {clientId}</div> }))
vi.mock('../../../shared/ui/AppDateInput', () => ({ AppDateInput: ({ label, ...props }: { label: string }) => <label>{label}<input {...props} /></label> }))
const saved = vi.fn(), close = vi.fn()
function mount(canRecord = true) {
  return render(<MantineProvider theme={theme}><ContactModal client={{ client_id: 42, client_name: 'Клієнт' }} canRecord={canRecord} onClose={close} onSaved={saved} /></MantineProvider>)
}
function choose(label: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Наступна домовленість' }))
  fireEvent.click(screen.getByRole('option', { name: label }))
}
function submit() { fireEvent.submit(screen.getByRole('button', { name: 'Зберегти контакт' }).closest('form')!) }

describe('contact logging', () => {
  beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); vi.clearAllMocks(); vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-22T00:00:00Z')) })
  afterEach(() => vi.restoreAllMocks())
  it('requires explicit next-agreement choice so no-answer cannot silently erase a promise', async () => {
    mount(); submit()
    expect(await screen.findByText('Оберіть наступну домовленість', { selector: '.mantine-Alert-message' })).toBeTruthy()
    expect(recordContact).not.toHaveBeenCalled()
    expect(screen.getByText('History 42')).toBeTruthy()
  })
  it('preserves UUID on transport retry, including after next time passes', async () => {
    vi.mocked(recordContact).mockRejectedValueOnce(new Error('Network interrupted')).mockResolvedValue({} as ContactEvent)
    mount(); choose('Запланувати наступний контакт')
    fireEvent.change(screen.getByLabelText('Наступний контакт — дата (Київ)'), { target: { value: '2026-10-22' } })
    fireEvent.change(screen.getByLabelText(/Час \(Київ\)/), { target: { value: '04:00' } })
    fireEvent.change(screen.getByLabelText(/Наступна дія/), { target: { value: '  Подзвонити  ' } })
    submit(); await screen.findByText('Network interrupted')
    const body = vi.mocked(recordContact).mock.calls[0][0]
    expect(body).toMatchObject({ ClientId: 42, NextContactAt: '2026-10-22T01:00:00.000Z', NextAction: 'Подзвонити' })
    expect(body.EventId).toMatch(/^[a-f0-9-]{36}$/)
    vi.mocked(Date.now).mockReturnValue(Date.parse('2026-10-23T00:00:00Z'))
    submit(); await waitFor(() => expect(saved).toHaveBeenCalledTimes(1))
    expect(vi.mocked(recordContact).mock.calls[1][0]).toEqual(body)
  })
  it('keeps Kyiv wall time raw even when the browser would treat it as a DST gap', async () => {
    vi.mocked(recordContact).mockResolvedValue({} as ContactEvent)
    mount(); choose('Запланувати наступний контакт')
    fireEvent.change(screen.getByLabelText('Наступний контакт — дата (Київ)'), { target: { value: '2027-03-14' } })
    fireEvent.change(screen.getByLabelText(/Час \(Київ\)/), { target: { value: '02:30' } })
    fireEvent.change(screen.getByLabelText(/Наступна дія/), { target: { value: 'Call' } })
    submit(); await waitFor(() => expect(recordContact).toHaveBeenCalledTimes(1))
    expect(vi.mocked(recordContact).mock.calls[0][0].NextContactAt).toBe('2027-03-14T00:30:00.000Z')
  })
  it('uses a new UUID when failed payload changes and warns before clearing agreement', async () => {
    vi.mocked(recordContact).mockRejectedValue(new Error('Network interrupted'))
    mount(); choose('Без наступної домовленості')
    expect(screen.getByText(/Попередня наступна домовленість буде замінена/)).toBeTruthy()
    submit(); await screen.findByText('Network interrupted')
    fireEvent.change(screen.getByLabelText('Нотатка'), { target: { value: 'New outcome' } })
    submit(); await waitFor(() => expect(recordContact).toHaveBeenCalledTimes(2))
    const [first, second] = vi.mocked(recordContact).mock.calls.map(([body]) => body)
    expect(first.EventId).not.toBe(second.EventId)
    expect(second).toMatchObject({ Note: 'New outcome', NextContactAt: null, NextAction: null })
  })
  it('rejects blank action and prevents simultaneous duplicate submissions', async () => {
    mount(); choose('Запланувати наступний контакт')
    fireEvent.change(screen.getByLabelText('Наступний контакт — дата (Київ)'), { target: { value: '2026-10-22' } })
    fireEvent.change(screen.getByLabelText(/Час \(Київ\)/), { target: { value: '04:00' } })
    fireEvent.change(screen.getByLabelText(/Наступна дія/), { target: { value: '   ' } })
    submit(); await screen.findByText('Вкажіть наступну дію')
    expect(recordContact).not.toHaveBeenCalled()
    vi.mocked(recordContact).mockReturnValue(new Promise(() => {}))
    fireEvent.change(screen.getByLabelText(/Наступна дія/), { target: { value: 'Call' } })
    submit(); submit()
    expect(recordContact).toHaveBeenCalledTimes(1)
  })
  it('retains history without mutation controls for read-only users', () => {
    mount(false)
    expect(screen.getByText('History 42')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Зберегти контакт' })).toBeNull()
  })
})
