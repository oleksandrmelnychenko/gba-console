import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { OfferCard } from './OfferCard'
import { OFFER_PROCESSING_STATUS, type ClientShoppingCart } from '../types'

vi.mock('../../products/components/ProductCardModal', () => ({
  ProductCardModal: ({ productNetId }: { productNetId: string | null }) => productNetId ? <div role="dialog">{productNetId}</div> : null,
}))

const item = { NetUid: 'item-1', Product: { NetUid: 'product-1', VendorCode: 'P-001', Name: 'Тестовий товар' }, Qty: 4, OrderedQty: 1, TotalAmount: 125.5 }
const offer: ClientShoppingCart = { NetUid: 'offer-1', Number: 'OF-123', IsOfferProcessed: true, OfferProcessingStatus: OFFER_PROCESSING_STATUS.PartiallyProcessed, OrderItems: [item] }
function renderOffer(overrides: Partial<React.ComponentProps<typeof OfferCard>> = {}) {
  const props = { offer, canDelete: true, canEdit: true, canExtendValidity: true, expanded: true,
    onCopyLink: vi.fn(), onDelete: vi.fn(), onOpenItemReason: vi.fn(), onOpenReason: vi.fn(), onRestart: vi.fn(), onToggle: vi.fn(), ...overrides }
  const view = render(<MantineProvider><I18nProvider><OfferCard {...props} /></I18nProvider></MantineProvider>)
  return { ...view, props }
}

describe('OfferCard actions and expanded lines', () => {
  it('keeps copying and deletion separate from expansion and exposes its current state', () => {
    const { props } = renderOffer()
    const toggle = screen.getByRole('button', { name: 'Згорнути' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Копіювати посилання' }))
    fireEvent.click(screen.getByRole('button', { name: 'Видалити' }))
    expect(props.onCopyLink).toHaveBeenCalledWith(offer)
    expect(props.onDelete).toHaveBeenCalledWith(offer)
    expect(props.onToggle).not.toHaveBeenCalled()
    fireEvent.click(toggle)
    expect(props.onToggle).toHaveBeenCalledWith(offer)
  })

  it('preserves product opening and the exact item passed to the accessible reason action', () => {
    const { props } = renderOffer()
    const table = screen.getByRole('table', { name: 'Товари пропозиції' })
    expect(within(table).getAllByRole('columnheader')).toHaveLength(5)
    fireEvent.click(within(table).getByRole('button', { name: 'Причини' }))
    expect(props.onOpenItemReason).toHaveBeenCalledWith(offer, item)
    fireEvent.click(within(table).getByRole('button', { name: 'Тестовий товар' }))
    expect(screen.getByRole('dialog').textContent).toBe('product-1')
  })

  it('does not expose mutation controls without permissions', () => {
    renderOffer({ canDelete: false, canEdit: false, canExtendValidity: false })
    expect(screen.queryByRole('button', { name: 'Видалити' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Причини' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Перезапустити' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Копіювати посилання' })).toBeTruthy()
  })

  it('only exposes restart for an unprocessed offer with extension permission', () => {
    const pending = { ...offer, OfferProcessingStatus: OFFER_PROCESSING_STATUS.NotProcessed }
    const { props } = renderOffer({ offer: pending })
    fireEvent.click(screen.getByRole('button', { name: 'Перезапустити' }))
    expect(props.onRestart).toHaveBeenCalledWith(pending)
    expect(screen.queryByRole('button', { name: 'Видалити' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Копіювати посилання' })).toBeNull()
  })
})
