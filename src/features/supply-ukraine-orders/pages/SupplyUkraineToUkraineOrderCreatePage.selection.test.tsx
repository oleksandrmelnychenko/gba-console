import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { SupplyUkraineToUkraineOrderCreatePage } from './SupplyUkraineDirectOrderCreatePage'

const api = vi.hoisted(() => ({
  getSupplyOrderOrganizations: vi.fn(),
  getSupplyOrderCreateSuppliers: vi.fn(),
  uploadSupplyOrderUkraineFromSupplierFile: vi.fn(),
}))

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('../api/supplyUkraineOrdersApi', () => api)

const organization = { Culture: 'uk', Id: 10, Name: 'Фенікс', NetUid: 'organization-1' }
const agreement = {
  Agreement: { Id: 30, Name: 'Договір EUR', NetUid: 'agreement-1', Organization: organization },
  Id: 20,
  NetUid: 'client-agreement-1',
}
const supplier = { ClientAgreements: [agreement], Id: 40, Name: 'Постачальник QA', NetUid: 'supplier-1' }

function renderPage() {
  return render(<MantineProvider env="test"><I18nProvider><MemoryRouter initialEntries={['/orders/ukraine/to-ukraine/new']}>
    <SupplyUkraineToUkraineOrderCreatePage />
  </MemoryRouter></I18nProvider></MantineProvider>)
}

function select(label: string, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }))
  fireEvent.click(screen.getByRole('option', { name: option }))
}

describe('new supply to Ukraine selections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Element.prototype.scrollIntoView = vi.fn()
    api.getSupplyOrderOrganizations.mockResolvedValue([organization])
    api.getSupplyOrderCreateSuppliers.mockResolvedValue([supplier])
  })

  it('leaves all three selections empty after dictionaries load and blocks an unselected submission', async () => {
    renderPage()
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Постачальник' }) as HTMLInputElement).disabled).toBe(false))

    expect((screen.getByRole('combobox', { name: 'Постачальник' }) as HTMLInputElement).value).toBe('')
    expect((screen.getByRole('combobox', { name: 'Організація' }) as HTMLInputElement).value).toBe('')
    expect((screen.getByRole('combobox', { name: 'Договір' }) as HTMLInputElement).value).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))
    expect(await screen.findByText('Оберіть постачальника, організацію та договір')).toBeTruthy()
    expect(api.uploadSupplyOrderUkraineFromSupplierFile).not.toHaveBeenCalled()
  })

  it('requires the user to select each dependent field', async () => {
    const { container } = renderPage()
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Постачальник' }) as HTMLInputElement).disabled).toBe(false))

    select('Постачальник', 'Постачальник QA')
    expect((screen.getByRole('combobox', { name: 'Організація' }) as HTMLInputElement).value).toBe('')
    expect((screen.getByRole('combobox', { name: 'Договір' }) as HTMLInputElement).value).toBe('')

    select('Організація', 'Фенікс')
    expect((screen.getByRole('combobox', { name: 'Договір' }) as HTMLInputElement).value).toBe('')

    select('Договір', 'Договір EUR')
    expect((screen.getByRole('combobox', { name: 'Постачальник' }) as HTMLInputElement).value).toBe('Постачальник QA')
    expect((screen.getByRole('combobox', { name: 'Організація' }) as HTMLInputElement).value).toBe('Фенікс')
    expect((screen.getByRole('combobox', { name: 'Договір' }) as HTMLInputElement).value).toBe('Договір EUR')

    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['test'], 'supply.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })] },
    })
    fireEvent.change(screen.getByLabelText('Код товару'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Кількість'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('З рядка'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('До рядка'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Колонка ціни'), { target: { value: '3' } })
    api.uploadSupplyOrderUkraineFromSupplierFile.mockResolvedValue({ HasError: true })
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))

    await waitFor(() => expect(api.uploadSupplyOrderUkraineFromSupplierFile).toHaveBeenCalledWith(
      expect.objectContaining({ orderUkraine: expect.objectContaining({
        Supplier: supplier,
        Organization: organization,
        ClientAgreement: agreement,
      }) }),
    ))
  })
})
