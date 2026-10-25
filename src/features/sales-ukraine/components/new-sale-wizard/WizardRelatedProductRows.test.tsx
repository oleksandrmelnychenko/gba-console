import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { WizardRelatedProductRows } from './WizardRelatedProductRows'
import type { WizardSaleProduct } from './wizardSaleProduct'

it('renders only the old and new focused rows and dispatches to the latest actions', () => {
  const products: WizardSaleProduct[] = Array.from({ length: 30 }, (_, index) => ({ NetUid: `p-${index}`, Name: `Product ${index}` }))
  const renderExtra = vi.fn((product: WizardSaleProduct) => <span>{product.CurrentPrice ?? 10}</span>)
  const oldPick = vi.fn(), newPick = vi.fn(), onOpenCard = vi.fn()
  const ui = (focusedIndex: number, onPick = oldPick, items = products) => (
    <MantineProvider env="test"><I18nProvider><WizardRelatedProductRows active focusedIndex={focusedIndex}
      products={items} renderExtra={renderExtra} onPick={onPick} onOpenCard={onOpenCard} /></I18nProvider></MantineProvider>
  )
  const view = render(ui(0))
  renderExtra.mockClear()
  view.rerender(ui(1))
  expect(renderExtra.mock.calls.map(([item]) => item.NetUid)).toEqual(['p-0', 'p-1'])
  renderExtra.mockClear()
  view.rerender(ui(1, newPick))
  expect(renderExtra).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Product 5'))
  expect(newPick).toHaveBeenCalledWith(5)
  expect(oldPick).not.toHaveBeenCalled()
  const updated = products.map((item, index) => index === 5 ? { ...item, CurrentPrice: 99 } : item)
  view.rerender(ui(1, newPick, updated))
  expect(renderExtra).toHaveBeenCalledOnce()
  expect(screen.getByText('99')).toBeTruthy()
  fireEvent.click(screen.getAllByRole('button', { name: 'Картка товару' })[5])
  expect(onOpenCard).toHaveBeenCalledWith('p-5')
})
