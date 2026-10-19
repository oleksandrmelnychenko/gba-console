import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { SaleSummaryDrawer } from './SalesUkrainePage'
import type { SalesUkraineSale } from '../types'

vi.mock('../../../shared/ui/data-table/useElementClientWidth', () => ({ useElementClientWidth: () => 1000 }))

vi.mock('../../../shared/ui/AppDrawer', () => ({ AppDrawer: ({ children }: { children: ReactNode }) => <div>{children}</div> }))

const sale: SalesUkraineSale = {
  NetUid: 'sale-1',
  TotalAmountLocal: 60,
  TotalAmountEurToUah: 3000,
  ClientAgreement: { Agreement: { Currency: { Code: 'EUR' } } },
  Order: { OrderItems: [
    { NetUid: 'one', Qty: 2, TotalAmountLocal: 20, TotalAmountEurToUah: 900, Product: { Name: 'Перший товар', VendorCode: 'ART-1' } },
    { NetUid: 'two', Qty: 4, TotalAmountLocal: 40, Product: { Name: 'Другий товар', VendorCode: 'ART-2' } },
  ] },
}

function mount(value: SalesUkraineSale) {
  render(<MantineProvider><I18nProvider><SaleSummaryDrawer opened sale={value} onClose={() => {}} /></I18nProvider></MantineProvider>)
}

describe('sale detail products', () => {
  it('shows source amounts and UAH amounts together in the shared table', () => {
    mount(sale)
    expect(screen.getByText('Товари · 2 позиції')).toBeTruthy()
    const table = screen.getByRole('table')
    const first = within(table).getByRole('row', { name: /Перший товар/ })
    expect(first.textContent).toContain('10,00')
    expect(first.textContent).toContain('450,00')
    expect(first.textContent).toContain('900,00')
    expect(first.textContent).toContain('EUR')
    expect(first.textContent).toContain('UAH')
    const second = within(table).getByRole('row', { name: /Другий товар/ })
    expect(second.textContent?.replace(/\s/g, '')).toContain('2000,00')
    expect(screen.getByText('ART-1').closest('.app-table-chip')?.className).toContain('is-product')
  })
  it('does not duplicate UAH prices for a UAH agreement', () => {
    mount({ ...sale, ClientAgreement: { Agreement: { Currency: { Code: 'UAH' } } } })
    expect(screen.queryByRole('columnheader', { name: /Ціна EUR/ })).toBeNull()
    expect(screen.getAllByRole('columnheader', { name: /Ціна UAH/ })).toHaveLength(1)
  })
})
