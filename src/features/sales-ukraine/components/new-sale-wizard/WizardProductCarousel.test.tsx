import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WizardProductCarousel } from './WizardProductCarousel'
import type { WizardSaleProduct } from './wizardSaleProduct'

const mocks = vi.hoisted(() => ({ notify: vi.fn(), t: (key: string) => key }))
vi.mock('../../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: mocks.t }) }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notify } }))
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
  else Reflect.deleteProperty(navigator, 'clipboard')
})
const products: WizardSaleProduct[] = Array.from({ length: 5 }, (_, index) => ({
  NetUid: `product-${index}`, NameUA: `Product ${index}`, VendorCode: `CODE-${index}`,
}))
function options() {
  return {
    products, focusedIndex: 0, hasFocus: false, searchMode: true, active: true,
    searchValue: '', searchInputRef: createRef<HTMLInputElement>(), onPick: vi.fn(), onSearchChange: vi.fn(),
  }
}
function view(props: ReturnType<typeof options>) {
  return <MantineProvider><WizardProductCarousel {...props} /></MantineProvider>
}

describe('product carousel presentation', () => {
  it('picks the absolute result index above and below the centred search input', () => {
    const props = options()
    render(view(props))
    fireEvent.click(screen.getByText('Product 1'))
    fireEvent.click(screen.getByText('Product 4'))
    expect(props.onPick.mock.calls).toEqual([[1], [4]])
  })

  it('keeps the same input mounted and focuses it after copying the selected code', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const props = options()
    const { rerender } = render(view(props))
    const input = screen.getByRole('textbox')
    rerender(view({ ...props, hasFocus: true, searchMode: false, focusedIndex: 2 }))
    expect(screen.getByRole('textbox')).toBe(input)
    expect(input.classList.contains('is-hidden')).toBe(true)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Скопіювати код: CODE-2' })) })
    expect(writeText).toHaveBeenCalledExactlyOnceWith('CODE-2')
    expect(document.activeElement).toBe(input)
  })

  it('resets a dismissed photo when selecting another product with the same image', () => {
    const sharedImage = [{ ImageUrl: 'https://example.test/shared.jpg' }]
    const props = { ...options(), products: products.map((product) => ({ ...product, ProductImages: sharedImage })), hasFocus: true, searchMode: false }
    const { container, rerender } = render(view(props))
    fireEvent.click(screen.getByRole('button', { name: 'Закрити фото' }))
    expect(container.querySelector('.new-sale-product-picker-card-wrap')?.getAttribute('data-photo-dismissed')).toBe('true')
    rerender(view({ ...props, focusedIndex: 1 }))
    expect(container.querySelector('.new-sale-product-picker-card-wrap')?.hasAttribute('data-photo-dismissed')).toBe(false)
    expect(document.activeElement).toBe(props.searchInputRef.current)
  })

  it('does not render unchanged rows again when the parent replaces its pick callback', () => {
    const name = vi.fn(() => 'Observed product')
    const product = { NetUid: 'observed', VendorCode: 'OBS', get NameUA() { return name() } }
    const props = { ...options(), products: [product] }
    const { rerender } = render(view(props))
    const initialReads = name.mock.calls.length
    const onPick = vi.fn()
    rerender(view({ ...props, onPick }))
    expect(name).toHaveBeenCalledTimes(initialReads)
    fireEvent.click(screen.getByText('Observed product'))
    expect(onPick).toHaveBeenCalledExactlyOnceWith(0)
  })

  it('shows component indicators for a base set without a HasComponent flag', () => {
    const props = { ...options(), products: [{ ...products[0], BaseSetProducts: [{ BaseProduct: products[1] }] }] }
    render(view(props))
    expect(screen.getByRole('img', { name: 'Є комплектуючі' })).toBeTruthy()
  })
})
