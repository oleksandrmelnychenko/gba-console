import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { addProductSpecificationCode, getProductByNetId, updateProductPlacements } from '../api/productsApi'
import type { Product } from '../types'
import { ProductActionDrawer, ProductStockSummary } from './ProductDetailPage'

const renders = vi.hoisted(() => ({ history: 0, placementFields: 0 }))
vi.mock('@mantine/core', async original => {
  const actual = await original<typeof import('@mantine/core')>()
  return { ...actual,
    Stack: (props: React.ComponentProps<typeof actual.Stack>) => {
      if (props.className === 'product-specification-history-item') renders.history++
      return <actual.Stack {...props} />
    },
    TextInput: (props: React.ComponentProps<typeof actual.TextInput>) => {
      if (props.className === 'product-placement-editor__field') renders.placementFields++
      return <actual.TextInput {...props} />
    },
  }
})
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true, user: null }) }))
vi.mock('../api/productsApi', async original => ({ ...await original<typeof import('../api/productsApi')>(),
  addProductSpecificationCode: vi.fn(), getProductByNetId: vi.fn(), updateProductPlacements: vi.fn(),
}))
function ui(children: React.ReactNode) { return <MemoryRouter><MantineProvider env="test"><I18nProvider>{children}</I18nProvider></MantineProvider></MemoryRouter> }
beforeEach(() => { vi.clearAllMocks(); renders.history = 0; renders.placementFields = 0 })

it('does not rerender 999 history entries while typing and preserves a failed specification draft', async () => {
  const product: Product = { NetUid: 'large', ProductSpecifications: Array.from({ length: 1000 }, (_, index) => ({
    Id: index, SpecificationCode: `SPEC-${index}`, CustomsValue: 100, Duty: 5, Created: new Date(2026, 0, 1 + index),
  })) }
  let reject!: (error: Error) => void
  vi.mocked(addProductSpecificationCode).mockImplementation(() => new Promise((_yes, no) => { reject = no }))
  render(ui(<ProductActionDrawer activePanel="specification" product={product} onClose={vi.fn()} onReload={vi.fn()} onProductSaved={vi.fn()} />))
  expect(renders.history).toBe(999)
  const input = screen.getByRole('textbox', { name: 'Код специфікації' }) as HTMLInputElement
  fireEvent.change(input, { target: { value: 'N' } })
  fireEvent.change(input, { target: { value: 'NEW' } })
  expect(renders.history).toBe(999)
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
  expect(addProductSpecificationCode).toHaveBeenCalledOnce()
  expect(input.disabled).toBe(true)
  expect((screen.getByRole('textbox', { name: 'Митна вартість' }) as HTMLInputElement).disabled).toBe(true)
  await act(async () => reject(new Error('offline')))
  expect(input.disabled).toBe(false)
  expect(input.value).toBe('NEW')
  expect(renders.history).toBe(999)
}, 30000)

it('rerenders only the changed placement row among 1000 and blocks edits during a pending save', async () => {
  const placements = Array.from({ length: 1000 }, (_, index) => ({ Id: index + 1, ProductId: 1, StorageId: 1, StorageNumber: `${index}`, RowNumber: '1', CellNumber: '1', Qty: 1 }))
  const product: Product = { NetUid: 'large-placements', ProductAvailabilities: [{ StorageId: 1, ProductId: 1, Amount: 1000, Storage: { Id: 1, Name: 'Large warehouse', ProductPlacements: placements } }] }
  vi.mocked(getProductByNetId).mockResolvedValue(product)
  let reject!: (error: Error) => void
  vi.mocked(updateProductPlacements).mockImplementation(() => new Promise((_yes, no) => { reject = no }))
  render(ui(<ProductStockSummary product={product} reservation={{}} reservationError={null} />))
  fireEvent.click(screen.getByRole('button', { name: 'Large warehouse: Місця зберігання' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Редагувати' }))
  const dialog = screen.getByRole('dialog', { name: /Місця зберігання$/ })
  const before = renders.placementFields
  const first = within(dialog).getByDisplayValue('0') as HTMLInputElement
  fireEvent.change(first, { target: { value: 'EDIT' } })
  expect(renders.placementFields - before).toBe(3)
  fireEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }))
  expect(updateProductPlacements).toHaveBeenCalledOnce()
  expect(first.disabled).toBe(true)
  expect((within(dialog).getByRole('button', { name: 'Додати місце' }) as HTMLButtonElement).disabled).toBe(true)
  await act(async () => reject(new Error('offline')))
  await waitFor(() => expect(first.disabled).toBe(false))
  expect(first.value).toBe('EDIT')
// This asserts render counts; mounting 1,000 Mantine rows in jsdom is not a timing benchmark.
}, 60000)
