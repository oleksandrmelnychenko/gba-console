import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import type { RecommendationProduct } from '../../recommendationsTypes'
import { RecommendationsList, SelectedProductCard } from './RecommendationProducts'

it('updates only the selected card, preserves latest callbacks and honors availability changes', () => {
  const reads = Array.from({ length: 30 }, () => vi.fn(() => 10))
  const products: RecommendationProduct[] = reads.map((get, index) => {
    const product = { NetUid: `p-${index}`, VendorCode: `CODE-${index}`, Name: `Product ${index}`, AvailableQtyUk: 5 }
    Object.defineProperty(product, 'CurrentPrice', { get })
    return product
  })
  const oldToggle = vi.fn(), latest = vi.fn()
  const ui = (selectedKeys = new Set<string>(), onToggleSelect = oldToggle, isVatSale = false) => (
    <MantineProvider env="test"><I18nProvider><RecommendationsList products={products} selectedKeys={selectedKeys}
      isVatSale={isVatSale} selectable onToggleSelect={onToggleSelect} onPreview={() => {}} /></I18nProvider></MantineProvider>
  )
  const view = render(ui())
  reads.forEach(read => read.mockClear())
  view.rerender(ui(new Set(['p-5'])))
  expect(reads.map(read => read.mock.calls.length)).toEqual(reads.map((_, index) => index === 5 ? 1 : 0))
  reads.forEach(read => read.mockClear())
  view.rerender(ui(new Set(['p-5']), latest))
  expect(reads.every(read => read.mock.calls.length === 0)).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Вибрати товар CODE-6' }))
  expect(latest).toHaveBeenCalledWith(products[6], 6)
  expect(oldToggle).not.toHaveBeenCalled()
  view.rerender(ui(new Set(), latest, true))
  expect(screen.getByRole('button', { name: 'Вибрати товар CODE-6' })).toHaveProperty('disabled', true)
})

it('allows a replacement product image after the previous URL failed', () => {
  const ui = (image: string) => <MantineProvider env="test"><I18nProvider><SelectedProductCard
    product={{ VendorCode: 'CODE', Name: 'Product', Image: image }} onPreview={() => {}} /></I18nProvider></MantineProvider>
  const view = render(ui('https://example.com/first.jpg'))
  fireEvent.error(screen.getByRole('img', { name: 'Product CODE' }))
  expect(screen.queryByRole('button', { name: 'Відкрити фото CODE' })).toBeNull()
  view.rerender(ui('https://example.com/second.jpg'))
  expect(screen.getByRole('button', { name: 'Відкрити фото CODE' })).toBeTruthy()
})
