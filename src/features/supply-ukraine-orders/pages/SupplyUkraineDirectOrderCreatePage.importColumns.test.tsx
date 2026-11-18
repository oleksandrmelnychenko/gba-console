import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { SupplyUkraineDirectOrderCreatePage } from './SupplyUkraineDirectOrderCreatePage'

const apiMocks = vi.hoisted(() => ({
  getSupplyOrderOrganizations: vi.fn(),
  getSupplyOrderCreateSuppliers: vi.fn(),
  uploadDirectSupplyOrderFromFile: vi.fn(),
  uploadSupplyOrderUkraineFromSupplierFile: vi.fn(),
}))

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/supplyUkraineOrdersApi', () => apiMocks)

function renderPage() {
  render(
    <MantineProvider env="test">
      <I18nProvider>
        <MemoryRouter initialEntries={['/orders/ukraine/all/new']}>
          <SupplyUkraineDirectOrderCreatePage />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('direct Ukraine order import columns (w1-11)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getSupplyOrderOrganizations.mockResolvedValue([])
    apiMocks.getSupplyOrderCreateSuppliers.mockResolvedValue([])
  })

  it('keeps garbage as typed with an inline error instead of turning it into digits', async () => {
    renderPage()
    const vendorCode = await screen.findByRole('textbox', { name: 'Код товару' }) as HTMLInputElement
    const qty = screen.getByRole('textbox', { name: 'Кількість' }) as HTMLInputElement
    const startRow = screen.getByRole('textbox', { name: 'З рядка' }) as HTMLInputElement

    fireEvent.change(vendorCode, { target: { value: 'abc-1e99' } })
    fireEvent.change(qty, { target: { value: '-5' } })
    fireEvent.change(startRow, { target: { value: '2' } })

    expect(vendorCode.value).toBe('abc-1e99')
    expect(qty.value).toBe('-5')
    expect(startRow.value).toBe('2')
    expect(screen.getByText('Введіть ціле число від 1, наприклад 3')).toBeTruthy()
    expect(screen.getByText('Номер не може бути від’ємним')).toBeTruthy()
    expect(vendorCode.getAttribute('aria-invalid')).toBe('true')
    expect(startRow.getAttribute('aria-invalid')).not.toBe('true')

    fireEvent.change(qty, { target: { value: '5' } })
    await waitFor(() => expect(screen.queryByText('Номер не може бути від’ємним')).toBeNull())
    expect(qty.value).toBe('5')
  })
})
