import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { InvoiceRegisterTab } from './InvoiceRegisterTab'

vi.mock('../../../shared/api/apiClient', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../shared/api/apiClient')>(),
  apiRequest: vi.fn(),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ data, emptyText }: { data: Array<{ Number?: string }>; emptyText: string }) => (
    <div data-testid="register-table">
      {data.length === 0 ? emptyText : data.map((sale) => <span key={sale.Number}>{sale.Number}</span>)}
    </div>
  ),
}))

function renderTab() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <InvoiceRegisterTab canExport />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('InvoiceRegisterTab', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset()
    vi.mocked(apiRequest).mockImplementation(async (path: string) =>
      path.endsWith('/export')
        ? { DocumentURL: '/Data/register.pdf' }
        : { Sales_RegisterInvoice: [{ Number: 'INV-1', NetUid: 'sale-1' }], TotalRowsQty: 1 },
    )
  })

  it('marks an impossible typed date and stops showing the rows of the previous date', async () => {
    renderTab()
    expect(await screen.findByText('INV-1')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('На дату'), { target: { value: '31.02.2026' } })

    expect(await screen.findByText('Некоректна дата')).toBeTruthy()
    expect(screen.queryByText('INV-1')).toBeNull()
    expect(screen.getByText('Вкажіть коректну дату у форматі дд.мм.рррр')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Роздрукувати' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('prints the whole filtered register without grid paging', async () => {
    renderTab()
    expect(await screen.findByText('INV-1')).toBeTruthy()

    const print = screen.getByRole('button', { name: 'Роздрукувати' })
    await waitFor(() => expect((print as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(print)

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      '/sales/warehouse-ukraine/invoice-register/export',
      expect.anything(),
    ))
    const exportCall = vi.mocked(apiRequest).mock.calls.find(([path]) => path.endsWith('/export'))
    const query = (exportCall?.[1] as { query: Record<string, unknown> }).query
    expect(query).not.toHaveProperty('limit')
    expect(query).not.toHaveProperty('offset')
  })
})
