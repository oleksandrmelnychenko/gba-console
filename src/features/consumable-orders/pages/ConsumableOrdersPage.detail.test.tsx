import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { ConsumableOrderRow } from '../types'
import { ConsumableOrderDetailDrawer } from './ConsumableOrdersPage'

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <div>{children}</div> : null,
}))

const row = {
  id: 'receipt-1',
  itemCount: 1,
  organization: 'Організація',
  currency: 'EUR',
  totalAmountWithoutVat: 10,
  amount: 12,
  order: {
    Number: 'CO-1',
    ConsumablesOrderItems: [
      { NetUid: 'active', ConsumableProduct: { VendorCode: 'P-1', Name: 'Папір' }, Qty: 2, PricePerItem: 5, TotalPrice: 10, VatPercent: 20, VAT: 2, TotalPriceWithVAT: 12 },
      { NetUid: 'deleted', Deleted: true, ConsumableProduct: { VendorCode: 'REMOVED', Name: 'Вилучений товар' }, TotalPriceWithVAT: 999 },
    ],
    OutcomePaymentOrderConsumablesOrders: [],
  },
} as ConsumableOrderRow

function renderDetail(value = row) {
  return render(<MantineProvider env="test"><I18nProvider><ConsumableOrderDetailDrawer row={value} onClose={vi.fn()} /></I18nProvider></MantineProvider>)
}

describe('consumable receipt detail', () => {
  it('keeps active line quantities and all monetary fields visible, excluding deleted lines', () => {
    renderDetail()
    const table = screen.getByRole('region', { name: 'Позиції' })
    expect(within(table).getByText('P-1')).toBeTruthy()
    expect(within(table).getByText('Папір')).toBeTruthy()
    expect(within(table).getByText('5,00')).toBeTruthy()
    expect(within(table).getByText('10,00')).toBeTruthy()
    expect(within(table).getByText('12,00')).toBeTruthy()
    expect(within(table).getByText('20')).toBeTruthy()
    expect(screen.queryByText('REMOVED')).toBeNull()
    expect(screen.queryByText('Вилучений товар')).toBeNull()
    expect(screen.getByText('EUR')).toBeTruthy()
  })

  it('keeps absent payment data explicit and does not invent edit/payment capabilities', () => {
    renderDetail()
    expect(screen.getByText('Оплат за документом немає')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Оплатити' })).toBeNull()
  })
})
