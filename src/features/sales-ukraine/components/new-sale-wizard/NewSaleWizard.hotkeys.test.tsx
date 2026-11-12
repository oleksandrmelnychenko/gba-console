import { useRef } from 'react'
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import { getCurrentSaleCart } from '../../api/salesUkraineApi'
import type { SalesUkraineClientAgreement, SalesUkraineSale } from '../../types'
import { NewSaleWizard } from './NewSaleWizard'
import { consumeNextWizardEscape, dispatchWizardKey, useWizardKeyHandler } from './wizardKeyboard'

const hotkeyMocks = vi.hoisted(() => ({
  exitCart: vi.fn(),
  openCart: vi.fn(),
  setCartSheetOpen: vi.fn(),
}))

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    session: { user: { NetUid: 'user-1' } },
  }),
}))

vi.mock('../../api/salesUkraineApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api/salesUkraineApi')>()

  return {
    ...original,
    getCurrentSaleCart: vi.fn(),
    getSaleById: vi.fn(),
  }
})

vi.mock('./NewSaleClientStep', () => ({
  NewSaleClientStep: () => <div data-testid="client-step" />,
}))

vi.mock('./NewSaleProductsStep', async () => {
  const { useWizardProductKeyboard } = await import('./useWizardProductKeyboard')
  const keyboard = await import('./wizardKeyboard')
  type KeyboardOptions = Parameters<typeof useWizardProductKeyboard>[0]

  return {
    NewSaleProductsStep: () => {
      const containerRef = useRef<HTMLDivElement | null>(null)
      const searchInputRef = useRef<HTMLInputElement | null>(null)
      const state = keyboard.getWizardKeyboardState(1)

      useWizardProductKeyboard({
        blockingOverlay: false,
        cartSheetOpen: false,
        closeProductDetails: () => {},
        containerRef,
        crossSellOpen: false,
        navigation: {
          cart: { exit: async () => { hotkeyMocks.exitCart() }, hasSelection: true, open: hotkeyMocks.openCart },
          state,
        } as unknown as KeyboardOptions['navigation'],
        productCardOpen: false,
        searchInputRef,
        setCartSheetOpen: hotkeyMocks.setCartSheetOpen,
      })

      return (
        <div ref={containerRef} data-testid="products-step">
          <input ref={searchInputRef} aria-label="product search" />
        </div>
      )
    },
  }
})

vi.mock('./NewSaleReviewStep', () => ({
  NewSaleReviewStep: () => <div data-testid="review-step" />,
}))

vi.mock('./WizardSaleHeader', () => ({
  WizardSaleHeader: () => null,
}))

vi.mock('./WizardDownloadDocumentsModal', () => ({
  WizardDownloadDocumentsModal: () => null,
}))

const agreement: SalesUkraineClientAgreement = { Client: { Id: 7, NetUid: 'client-1' }, NetUid: 'agreement-1' }
const currentBill: SalesUkraineSale = {
  ClientAgreement: agreement,
  NetUid: 'sale-1',
  Order: { OrderItems: [{ Id: 1, NetUid: 'item-1', Product: { Id: 1, NetUid: 'product-1' }, Qty: 1 }] },
}

async function openProductsStep(): Promise<HTMLInputElement> {
  vi.mocked(getCurrentSaleCart).mockResolvedValue(currentBill)
  render(
    <MantineProvider theme={theme}>
      <I18nProvider>
        <NewSaleWizard
          opened
          prefill={{
            agreement,
            agreementNetId: 'agreement-1',
            client: { Id: 7, NetUid: 'client-1' },
            clientNetId: 'client-1',
          }}
          onClose={() => {}}
          onCreated={() => {}}
        />
      </I18nProvider>
    </MantineProvider>,
  )
  const next = await screen.findByRole('button', { name: 'Далі' })
  await waitFor(() => expect((next as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(next)
  const search = await screen.findByLabelText('product search') as HTMLInputElement
  search.focus()

  return search
}

describe('BUG-1533 wizard hotkeys with the product search focused', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('opens cart editing on F2 and still suppresses the browser default', async () => {
    const search = await openProductsStep()

    const notPrevented = fireEvent.keyDown(search, { key: 'F2' })

    expect(hotkeyMocks.openCart).toHaveBeenCalledOnce()
    expect(notPrevented).toBe(false)
  })

  it('opens the cart sheet on F3 and still suppresses the browser search', async () => {
    const search = await openProductsStep()

    const notPrevented = fireEvent.keyDown(search, { key: 'F3' })

    expect(hotkeyMocks.setCartSheetOpen).toHaveBeenCalledWith(true)
    expect(notPrevented).toBe(false)
  })
})

function EscapeHarness({ onEscape }: { onEscape: () => void }) {
  useWizardKeyHandler((event) => {
    if (event.hotkey !== 'Escape') return false
    onEscape()

    return true
  })

  return <div onKeyDown={dispatchWizardKey}><input aria-label="field" /></div>
}

describe('BUG-1533 Escape after a quantity editor closed by mouse', () => {
  afterEach(() => {
    cleanup()
  })

  it('still swallows the Escape that closed the editor', () => {
    const onEscape = vi.fn()
    const ui = render(<EscapeHarness onEscape={onEscape} />)

    consumeNextWizardEscape()
    fireEvent.keyDown(ui.getByLabelText('field'), { key: 'Escape' })

    expect(onEscape).not.toHaveBeenCalled()
  })

  it('handles the next Escape when the editor was closed without one', async () => {
    const onEscape = vi.fn()
    const ui = render(<EscapeHarness onEscape={onEscape} />)

    consumeNextWizardEscape()
    await new Promise((resolve) => setTimeout(resolve, 0))
    fireEvent.keyDown(ui.getByLabelText('field'), { key: 'Escape' })

    expect(onEscape).toHaveBeenCalledOnce()
  })
})
