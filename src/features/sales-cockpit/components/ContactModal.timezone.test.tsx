import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import { recordContact } from '../api/contactsApi'
import type { ContactEvent } from '../contactTypes'
import { ContactModal } from './ContactModal'
const mocks = vi.hoisted(() => ({ t: (key: string) => key }))
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.t }) }))
vi.mock('../api/contactsApi', () => ({ recordContact: vi.fn() }))
vi.mock('./ContactHistoryPanel', () => ({ ContactHistoryPanel: () => null }))
afterEach(() => vi.restoreAllMocks())
it('real date input and raw time display match submitted Kyiv agreement across browser DST gaps', async () => {
  Element.prototype.scrollIntoView = vi.fn()
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-22T00:00:00Z'))
  vi.mocked(recordContact).mockResolvedValue({} as ContactEvent)
  render(<MantineProvider theme={theme}><ContactModal client={{ client_id: 42, client_name: 'Client' }} canRecord onClose={vi.fn()} onSaved={vi.fn()} /></MantineProvider>)
  fireEvent.click(screen.getByRole('combobox', { name: 'Наступна домовленість' }))
  fireEvent.click(screen.getByRole('option', { name: 'Запланувати наступний контакт' }))
  const date = screen.getByLabelText(/Наступний контакт — дата/) as HTMLInputElement
  const time = screen.getByLabelText(/Час \(Київ\)/) as HTMLInputElement
  fireEvent.change(date, { target: { value: '14.03.2027' } })
  fireEvent.blur(date)
  fireEvent.change(time, { target: { value: '02:30' } })
  fireEvent.change(screen.getByLabelText(/Наступна дія/), { target: { value: 'Call' } })
  expect(date.value).toBe('14.03.2027')
  expect(time.value).toBe('02:30')
  fireEvent.submit(screen.getByRole('button', { name: 'Зберегти контакт' }).closest('form')!)
  await waitFor(() => expect(recordContact).toHaveBeenCalledTimes(1))
  expect(vi.mocked(recordContact).mock.calls[0][0].NextContactAt).toBe('2027-03-14T00:30:00.000Z')
})
