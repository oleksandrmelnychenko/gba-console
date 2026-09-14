import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import type { SalesUkraineSale } from '../types'
import { SaleExpandContent } from './SaleExpandContent'

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../../products/components/ProductCardModal', () => ({
  ProductCardModal: () => null,
}))

describe('SaleExpandContent currencies', () => {
  it('does not repeat EUR for a VAT sale in EUR', () => {
    renderSale(createSale({ currencyCode: 'EUR', isVatSale: true }))

    expect(columnHeaders()).toEqual(['Товар', 'К-сть', 'EUR', 'ПДВ', 'Знижки'])
    expect(screen.getAllByRole('cell')).toHaveLength(5)
  })

  it('keeps both currencies when the agreement currency differs from EUR', () => {
    renderSale(createSale({ currencyCode: 'UAH', isVatSale: true }))

    expect(columnHeaders()).toEqual(['Товар', 'К-сть', 'UAH', 'EUR', 'ПДВ', 'Знижки'])
    expect(screen.getAllByRole('cell')).toHaveLength(6)
  })

  it('keeps the UAH conversion for a non-VAT EUR sale', () => {
    renderSale(createSale({ currencyCode: 'EUR', isVatSale: false }))

    expect(columnHeaders()).toEqual(['Товар', 'К-сть', 'EUR', 'UAH', 'Знижки'])
    expect(screen.getAllByRole('cell')).toHaveLength(5)
  })

  it('renders expanded sale data but no discount action when edit is denied', () => {
    const { container } = renderSale(createSale({ currencyCode: 'EUR', isVatSale: false }), false)

    expect(screen.getByText('Ввід боргів')).toBeTruthy()
    expect(container.querySelector('.sale-expand-discount-action')).toBeNull()
  })
})

function renderSale(sale: SalesUkraineSale, canEditDiscount = true) {
  return render(
    <MantineProvider theme={theme}>
      <SaleExpandContent
        canEditDiscount={canEditDiscount}
        sale={sale}
        onOpenItemDiscount={vi.fn()}
      />
    </MantineProvider>,
  )
}

function columnHeaders(): string[] {
  return screen.getAllByRole('columnheader').map((header) => header.textContent || '')
}

function createSale({
  currencyCode,
  isVatSale,
}: {
  currencyCode: string
  isVatSale: boolean
}): SalesUkraineSale {
  return {
    BaseLifeCycleStatus: { Name: 'New', SaleLifeCycleType: 0 },
    ClientAgreement: {
      Agreement: {
        Currency: { Code: currencyCode },
      },
    },
    IsVatSale: isVatSale,
    Order: {
      OrderItems: [
        {
          Id: 1,
          Product: {
            NameUA: 'Ввід боргів',
            VendorCode: 'Борг',
          },
          Qty: 1,
          TotalAmount: 453.31,
          TotalAmountEurToUah: 23_300.13,
          TotalAmountLocal: 453.31,
          TotalVat: 0,
        },
      ],
    },
  }
}
