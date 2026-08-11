import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import type { ShoppingCartReserveItem } from '../types'
import { CartReserveTable } from './CartReserveCard'

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../../products/components/ProductCardModal', () => ({
  ProductCardModal: () => null,
}))

describe('CartReserveTable currency output', () => {
  it('shows the API UAH total instead of relabelling the EUR total as UAH', () => {
    renderTable(cart())

    expect(screen.getByText('11 089,25')).not.toBeNull()
    expect(screen.getByText('213,46')).not.toBeNull()
  })

  it('shows the EUR agreement amount, its UAH conversion and the applied live rate', () => {
    renderTable(cart())

    fireEvent.click(screen.getByLabelText('Розгорнути позиції'))

    expect(screen.getAllByText(/51,95/).length).toBeGreaterThan(0)
    expect(screen.getByText('Курс EUR→UAH: 51,9500')).not.toBeNull()
  })
})

function renderTable(carts: ShoppingCartReserveItem[]) {
  return render(
    <MantineProvider theme={theme}>
      <CartReserveTable carts={carts} isLoading={false} onOpenClient={vi.fn()} />
    </MantineProvider>,
  )
}

function cart(): ShoppingCartReserveItem[] {
  return [{
    Id: 10115,
    NetUid: 'cart-10115',
    TotalAmount: 213.46,
    TotalAmountEurToUah: 11_089.25,
    TotalLocalAmount: 213.46,
    ClientAgreement: {
      Client: { FullName: 'Тестовий клієнт', NetUid: 'client-1' },
      Agreement: { Currency: { Code: 'EUR' } },
    },
    OrderItems: [{
      Id: 4004433,
      NetUid: 'item-4004433',
      Qty: 1,
      TotalAmount: 51.08,
      TotalAmountLocal: 51.08,
      TotalAmountEurToUah: 2_653.61,
      Product: {
        CurrentEurToUahExchangeRate: 51.95,
        Name: 'Тестовий товар',
        NetUid: 'product-1',
        VendorCode: '900260-AL',
      },
    }],
  }]
}
