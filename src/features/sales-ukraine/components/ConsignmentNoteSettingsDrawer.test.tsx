import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import type { SaleConsignmentNoteSetting, SalesUkraineSale } from '../types'
import { ConsignmentNoteSettingsDrawer, type ConsignmentNoteSettingsApi } from './ConsignmentNoteSettingsDrawer'
import { applyConsignmentDocumentDefaults, getConsignmentValidationError } from './consignmentNoteSettingRules'

const stableT = (key: string) => key
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: stableT }) }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))
vi.mock('../../auth/usePermissions', () => ({ usePermissions: () => ({ can: () => true }) }))

const sale = { NetUid: 'sale-1', SaleNumber: { Value: 'QAUНо00000003' } } as SalesUkraineSale
const stored: SaleConsignmentNoteSetting = {
  BrandAndNumberCar: 'MAN AA1234', Driver: 'Водій', Id: 5, LoadingPoint: 'Львів', Name: 'Львів-Київ', NetUid: 'setting-5',
  UnloadingPoint: 'Київ',
} as SaleConsignmentNoteSetting

function renderDrawer(api: Partial<ConsignmentNoteSettingsApi>) {
  const full = {
    add: vi.fn(), getAll: vi.fn(async () => [stored]), print: vi.fn(), remove: vi.fn(async () => []), update: vi.fn(), ...api,
  } as unknown as ConsignmentNoteSettingsApi
  render(
    <MantineProvider theme={theme}>
      <ConsignmentNoteSettingsDrawer api={full} opened sale={sale} onClose={vi.fn()} />
    </MantineProvider>,
  )
  return full
}

beforeEach(() => {
  Object.defineProperty(document, 'fonts', { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } })
})
afterEach(cleanup)

describe('TTN settings round trip', () => {
  it('loads the stored loading point back and keeps the document number typed for this TTN', () => {
    const defaults = { LoadingPoint: '', Number: 'P3' } as SaleConsignmentNoteSetting

    expect(applyConsignmentDocumentDefaults({ ...stored }, defaults, '123')).toMatchObject({ LoadingPoint: 'Львів', Number: '123' })
    expect(applyConsignmentDocumentDefaults({ ...stored, Number: '777' }, defaults, '123')).toMatchObject({ Number: '777' })
    expect(applyConsignmentDocumentDefaults({ ...stored, LoadingPoint: '' }, { ...defaults, LoadingPoint: 'Адреса організації' }))
      .toMatchObject({ LoadingPoint: 'Адреса організації', Number: 'P3' })
  })

  it('rejects out-of-range vehicle values before any request', () => {
    const t = (key: string) => key

    expect(getConsignmentValidationError({ ...stored, CarLength: -5 }, t)).toBe('Розміри мають бути від 0 до 100000 мм')
    expect(getConsignmentValidationError({ ...stored, TrailerWidth: 999_999_999_999 }, t)).toBe('Розміри мають бути від 0 до 100000 мм')
    expect(getConsignmentValidationError({ ...stored, CarGrossWeight: 5000 }, t)).toBe('Вага має бути від 0 до 1000 т')
    expect(getConsignmentValidationError({ ...stored, Number: '1'.repeat(300) }, t)).toBe('Номер ТТН не може бути довшим за 50 символів')
    expect(getConsignmentValidationError({ ...stored, Number: '123' }, t)).toBeNull()
    expect(getConsignmentValidationError({ ...stored, Name: '   ' }, t)).toBe('Вкажіть назву')
  })

  it('asks for confirmation before deleting a saved setting', async () => {
    const api = renderDrawer({})
    const select = (await screen.findAllByLabelText('Існуючі налаштування')).find((element) => element.tagName === 'INPUT')!
    await waitFor(() => expect(api.getAll).toHaveBeenCalled())

    fireEvent.focus(select)
    fireEvent.click(select)
    fireEvent.click(await screen.findByText('Львів-Київ', {}, { timeout: 5000 }))
    await waitFor(() => expect((screen.getByLabelText('Пункт завантаження') as HTMLInputElement).value).toBe('Львів'))

    fireEvent.click(screen.getByRole('button', { name: 'Видалити' }))
    expect(api.remove).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('dialog', { name: 'Видалити налаштування ТТН?' })
    fireEvent.click(Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent === 'Видалити')!)

    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('setting-5'))
  })
})
