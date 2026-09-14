import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { theme } from '../../../shared/theme/theme'
import { SaleExpandContent } from './SaleExpandContent'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../types'

vi.mock('../../products/api/productsApi', () => ({
  getProductByNetId: vi.fn(async () => ({ NetUid: 'product-1', VendorCode: 'PART', NameUA: 'Товар', CurrentPrice: 999, CurrentLocalPrice: 999 })),
}))
vi.mock('../../products/components/ShopImageGallery', () => ({ ShopImageGallery: () => null }))
beforeEach(() => { HTMLElement.prototype.scrollIntoView = vi.fn() })

function host(currencyCode: string, isVatSale: boolean, lines: Partial<SalesUkraineOrderItem>[]) {
  const sale: SalesUkraineSale = {
    IsVatSale: isVatSale,
    ClientAgreement: { Agreement: { Currency: { Code: currencyCode } } },
    Order: { OrderItems: lines.map((line, index) => ({ Id: index + 1, Product: { NetUid: 'product-1', VendorCode: `PART-${index}`, NameUA: 'Товар' }, ...line })) },
  }
  return <MantineProvider theme={theme}><I18nProvider><SaleExpandContent sale={sale} onOpenItemDiscount={vi.fn()} /></I18nProvider></MantineProvider>
}
async function open(index = 0) {
  fireEvent.click(screen.getByRole('button', { name: `PART-${index}` }))
  const dialog = await screen.findByRole('dialog', { name: 'Картка товару' })
  await within(dialog).findByText('Ціна за одиницю з урахуванням знижок у вибраному продажі.')
  return dialog
}
function price(dialog: HTMLElement, currency: string) {
  const label = within(dialog).getByText(`Ціна продажу (${currency})`)
  return label.parentElement?.textContent?.replace(/\s/g, '')
}

describe('sale line prices in the actual product card', () => {
  it('uses the selected line and final discounts, divides by quantity, and preserves the EUR/UAH conversion', async () => {
    render(host('EUR', false, [
      { Qty: 1, TotalAmountLocal: 100, TotalAmountEurToUah: 5200 },
      { Qty: 2, PricePerItem: 32, Discount: 20, TotalAmountLocal: 51.2, TotalAmount: 51.2, TotalAmountEurToUah: 2662.9 },
    ]))
    const dialog = await open(1)
    expect(price(dialog, 'EUR')).toContain('25,60')
    expect(price(dialog, 'UAH')).toContain('1331,45')
    expect(within(dialog).queryByText('999,00')).toBeNull()
    expect(within(dialog).queryByText('Ціна (локальна)')).toBeNull()
  })
  it('uses local UAH and base EUR for VAT sales', async () => {
    render(host('UAH', true, [{ Qty: 2, TotalAmountLocal: 1200, TotalAmount: 24, TotalAmountEurToUah: 9999 }]))
    const dialog = await open()
    expect(price(dialog, 'UAH')).toContain('600,00')
    expect(price(dialog, 'EUR')).toContain('12,00')
  })
  it('does not duplicate the EUR currency for a VAT sale in EUR', async () => {
    render(host('EUR', true, [{ Qty: 1, TotalAmountLocal: 4.3, TotalAmount: 4.3 }]))
    const dialog = await open()
    expect(price(dialog, 'EUR')).toContain('4,30')
    expect(within(dialog).queryByText('Ціна продажу (UAH)')).toBeNull()
  })
  it('distinguishes an actual zero sale price from a missing amount', async () => {
    render(host('UAH', true, [{ Qty: 1, TotalAmountLocal: 0 }]))
    const dialog = await open()
    expect(price(dialog, 'UAH')).toContain('0,00')
    expect(price(dialog, 'EUR')).toContain('Немаєданих')
  })
  it('does not invent a unit price when quantity is zero', async () => {
    render(host('EUR', false, [{ Qty: 0, TotalAmountLocal: 25.6, TotalAmountEurToUah: 1331.45 }]))
    const dialog = await open()
    expect(price(dialog, 'EUR')).toContain('Немаєданих')
    expect(price(dialog, 'UAH')).toContain('Немаєданих')
  })
})
