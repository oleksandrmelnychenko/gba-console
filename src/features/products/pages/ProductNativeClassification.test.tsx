import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { updateProduct } from '../api/productsApi'
import type { Product } from '../types'
import { ProductActionDrawer } from './ProductDetailPage'

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))
vi.mock('../api/productsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/productsApi')>(),
  updateProduct: vi.fn(),
}))

function openEditor(product: Product) {
  return render(
    <MemoryRouter><MantineProvider><I18nProvider>
      <ProductActionDrawer activePanel="edit" product={{ Id: 42, Name: 'Native product', ...product }}
        onClose={vi.fn()} onProductSaved={vi.fn()} onReload={vi.fn()} />
    </I18nProvider></MantineProvider></MemoryRouter>,
  )
}

async function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
  await waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1))
  return vi.mocked(updateProduct).mock.calls[0][0]
}

async function choose(label: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Тип позиції' }))
  fireEvent.click(await screen.findByRole('option', { name: label }))
}

describe('native product classification editor', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn()
    vi.mocked(updateProduct).mockReset().mockResolvedValue({ Id: 42 })
  })

  it.each([[null, 'Не визначено'], [false, 'Товар'], [true, 'Послуга']] as const)(
    'preserves explicit %s through opening and ordinary save', async (value, label) => {
      openEditor({ NativeIsService: value })
      expect((await screen.findByRole('combobox', { name: 'Тип позиції' }) as HTMLInputElement).value).toBe(label)
      expect((await save()).NativeIsService).toBe(value)
    },
  )

  it('lets a manager explicitly classify unknown as goods without a false default', async () => {
    openEditor({ NativeIsService: null })
    await choose('Товар')
    expect((await save()).NativeIsService).toBe(false)
  })

  it('allows changing goods to service but offers no unsupported clear', async () => {
    openEditor({ NativeIsService: false })
    fireEvent.click(screen.getByRole('combobox', { name: 'Тип позиції' }))
    expect(screen.queryByRole('option', { name: 'Не визначено' })).toBeNull()
    fireEvent.click(await screen.findByRole('option', { name: 'Послуга' }))
    expect((await save()).NativeIsService).toBe(true)
  })

  it('does not advertise or add the field on an older backend', async () => {
    openEditor({})
    expect(screen.queryByRole('combobox', { name: 'Тип позиції' })).toBeNull()
    expect(await save()).not.toHaveProperty('NativeIsService')
  })

  it.each([
    { SourceFenixId: 'source-id' }, { SourceAmgId: [] },
    { SourceFenixCode: 0 }, { SourceAmgCode: -1 },
  ])('does not offer a native override for source-owned product %j', async (source) => {
    openEditor({ NativeIsService: null, ...source })
    expect(screen.queryByRole('combobox', { name: 'Тип позиції' })).toBeNull()
    expect((await save()).NativeIsService).toBeNull()
  })
})
