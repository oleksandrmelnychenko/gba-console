import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import { SalesOnlineShopPage } from './SalesOnlineShopPage'

vi.mock('../../../shared/api/apiClient', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../shared/api/apiClient')>(),
  apiRequest: vi.fn(),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (key: string) => key === PermissionKeys.SystemPages.SalesOnlineShop.View,
    isLoading: false,
  }),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ session: null }),
}))

const sales = [
  {
    NetUid: 'e018dbe9-4c38-45f9-9420-c8dbd35bb785',
    SaleNumber: { Value: 'КОк00001756' },
    RetailClientId: 20246,
    RetailClient: { Name: 'Guest checkout' },
    ClientAgreement: { Client: { FullName: 'ShopClient' } },
    TotalCount: 1,
    TotalAmount: 1.95,
    TotalAmountLocal: 1.95,
    TotalRowsQty: 3,
    Order: { OrderSource: 0 },
  },
  {
    NetUid: '80d6f13c-d3b2-45bd-9463-82190e093b9f',
    SaleNumber: { Value: 'КОк00001755' },
    RetailClientId: null,
    ClientAgreement: { Client: { FullName: 'Authsep Verification 270588c7' } },
    TotalCount: 2,
    TotalAmount: 40.34,
    TotalAmountLocal: 40.34,
    TotalRowsQty: 3,
    Order: { OrderSource: 0 },
  },
  {
    NetUid: '05217472-247d-411e-9ce0-02ac49b1adcc',
    SaleNumber: { Value: 'КОк00001754' },
    RetailClientId: null,
    ClientAgreement: { Client: { FullName: 'Authsep Verification e54e699c' } },
    TotalCount: 2,
    TotalAmount: 40.34,
    TotalAmountLocal: 40.34,
    TotalRowsQty: 3,
    Order: { OrderSource: 0 },
  },
]

function renderRegistry() {
  return render(
    <MemoryRouter initialEntries={['/sales-online-shop']}>
      <MantineProvider theme={theme}>
        <I18nProvider>
          <SalesOnlineShopPage />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('BUG-1447 online-shop post-create registry', () => {
  it('renders registered and guest sales together with their unchanged numbers and amounts', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce(sales)
    const { container } = renderRegistry()

    await screen.findByText('КОк00001754')
    expect(container.querySelectorAll('.sales-grid-row')).toHaveLength(3)
    for (const sale of sales) {
      const row = screen.getByText(sale.SaleNumber.Value).closest('.sales-grid-row') as HTMLElement
      expect(within(row).getByText(sale.ClientAgreement.Client.FullName)).toBeTruthy()
      expect(within(row).getAllByText(sale.TotalAmount.toFixed(2).replace('.', ',')).length).toBeGreaterThan(0)
    }
    expect(screen.getByText('Guest checkout')).toBeTruthy()
    expect(screen.queryByText('Продажів не знайдено')).toBeNull()
    expect(apiRequest).toHaveBeenCalledWith('/sales/online-shop/registry', expect.objectContaining({
      query: expect.objectContaining({ forEcommerce: true, fastEcommerce: true, limit: 20, offset: 0 }),
    }))
  })

  it('shows the empty state only when the selected registry query returns no sales', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce([])
    const { container } = renderRegistry()

    expect(await screen.findByText('Продажів не знайдено')).toBeTruthy()
    expect(container.querySelectorAll('.sales-grid-row')).toHaveLength(0)
  })
})
