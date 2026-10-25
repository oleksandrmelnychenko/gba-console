import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { reuseSaleSnapshot } from '../../saleSnapshot'
import type { SalesUkraineOrderItem } from '../../types'
import { WizardCartCards } from './WizardCartCards'
import { WizardProductPhoto } from './WizardProductPhoto'

vi.mock('./WizardProductPhoto', () => ({ WizardProductPhoto: vi.fn(() => null) }))

it('updates only the changed cart position and keeps actions, order and currency current', () => {
  const items: SalesUkraineOrderItem[] = Array.from({ length: 100 }, (_, index) => ({
    NetUid: `item-${index}`, Qty: 1, TotalAmount: 10, TotalAmountLocal: 420,
    Product: { NetUid: `product-${index}`, VendorCode: `CODE-${index}`, Name: `Product ${index}`, CurrentPrice: 10 },
  }))
  const onRowClick = vi.fn()
  const ui = (rows = items, busy = false, currency = 'UAH', onClick = onRowClick) => <MantineProvider env="test"><I18nProvider>
    <WizardCartCards items={rows} busy={busy} localCurrencyCode={currency} useEurToUah={false} onRowClick={onClick} />
  </I18nProvider></MantineProvider>
  const view = render(ui())
  vi.mocked(WizardProductPhoto).mockClear()
  view.rerender(ui())
  expect(WizardProductPhoto).not.toHaveBeenCalled()
  const response = JSON.parse(JSON.stringify({ NetUid: 'sale-1', Order: { OrderItems: items } }))
  response.Order.OrderItems[50].Qty = 7
  response.Order.OrderItems[50].TotalAmount = 70
  const updated = reuseSaleSnapshot({ NetUid: 'sale-1', Order: { OrderItems: items } }, response).Order!.OrderItems!
  view.rerender(ui(updated))
  console.info(`[cart-perf] update one of 100 positions: ${vi.mocked(WizardProductPhoto).mock.calls.length} photo renders`)
  expect(WizardProductPhoto).toHaveBeenCalledTimes(1)
  expect(screen.getByText('7 шт')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Дії з товаром · CODE-50' }))
  expect(onRowClick).toHaveBeenLastCalledWith(updated[50])
  const onNextClick = vi.fn()
  view.rerender(ui([...updated].reverse(), true, 'PLN', onNextClick))
  expect(screen.getAllByRole('listitem')[0].textContent).toContain('CODE-99')
  expect(screen.getAllByRole('listitem')[0].textContent).toContain('01')
  expect(screen.getByRole('button', { name: 'Дії з товаром · CODE-50' })).toHaveProperty('disabled', true)
  expect(screen.getAllByText('PLN')).toHaveLength(100)
  view.rerender(ui(updated, false, 'PLN', onNextClick))
  const first = screen.getByRole('button', { name: 'Дії з товаром · CODE-0' })
  first.focus()
  fireEvent.keyDown(first, { key: 'End' })
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Дії з товаром · CODE-99' }))
  fireEvent.click(screen.getByRole('button', { name: 'Дії з товаром · CODE-50' }))
  expect(onNextClick).toHaveBeenCalledWith(updated[50])
})
