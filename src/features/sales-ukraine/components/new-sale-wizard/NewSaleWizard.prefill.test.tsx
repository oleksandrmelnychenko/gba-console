import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import {
  addOrderItem,
  getCurrentSaleCart,
  getSaleById,
  getSalesUkraineCreateCurrentCart,
  getSalesUkraineCreateDetails,
} from '../../api/salesUkraineApi'
import type { SalesUkraineProduct, SalesUkraineSale } from '../../types'
import { NewSaleWizard } from './NewSaleWizard'

const wizardMocks = vi.hoisted(() => ({
  reloadCart: null as null | (() => Promise<SalesUkraineSale | null>),
}))

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
    addOrderItem: vi.fn(),
    getCurrentSaleCart: vi.fn(),
    getSaleById: vi.fn(),
    getSalesUkraineCreateCurrentCart: vi.fn(),
    getSalesUkraineCreateDetails: vi.fn(),
  }
})

vi.mock('./NewSaleClientStep', () => ({
  NewSaleClientStep: () => <div data-testid="client-step" />,
}))

vi.mock('./NewSaleProductsStep', () => ({
  NewSaleProductsStep: ({
    agreementNetId,
    clientNetId,
    onCartChanged,
    onPendingMutationChange,
    sale,
  }: {
    agreementNetId: string | null
    clientNetId: string | null
    onCartChanged: () => Promise<SalesUkraineSale | null>
    onPendingMutationChange?: (pending: boolean) => void
    sale: SalesUkraineSale | null
  }) => {
    wizardMocks.reloadCart = onCartChanged

    return (
      <div data-testid="products-step">
        <span>{clientNetId}</span>
        <span>{agreementNetId}</span>
        {(sale?.Order?.OrderItems ?? []).map((item) => <span key={item.Product?.NetUid}>{item.Product?.VendorCode}</span>)}
        <button type="button" onClick={() => onPendingMutationChange?.(true)}>mark cart pending</button>
      </div>
    )
  },
}))

vi.mock('./NewSaleReviewStep', () => ({
  NewSaleReviewStep: () => <div data-testid="review-step" />,
}))

vi.mock('./WizardSaleHeader', () => ({
  WizardSaleHeader: () => null,
}))

vi.mock('./WizardDownloadDocumentsModal', () => ({
  WizardDownloadDocumentsModal: () => null,
}))

const products: SalesUkraineProduct[] = [
  { Id: 1, NetUid: 'product-1', VendorCode: 'SEM9401' },
  { Id: 2, NetUid: 'product-2', VendorCode: 'SEM8755' },
  { Id: 3, NetUid: 'product-3', VendorCode: 'SEM15221' },
]

describe('new sale wizard recommendation prefill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    wizardMocks.reloadCart = null
  })

  it('adds selected recommendations and opens the products step with the client selected', async () => {
    const agreement = {
      Client: { Id: 7, NetUid: 'client-1' },
      NetUid: 'agreement-1',
    }
    const emptyCart: SalesUkraineSale = {
      ClientAgreement: agreement,
      NetUid: 'sale-1',
      Order: { OrderItems: [] },
    }
    const filledCart: SalesUkraineSale = {
      ...emptyCart,
      Order: {
        OrderItems: products.map((product, index) => ({
          Id: index + 1,
          NetUid: `item-${index + 1}`,
          Product: product,
          Qty: 1,
        })),
      },
    }

    vi.mocked(getCurrentSaleCart)
      .mockResolvedValueOnce(emptyCart)
      .mockResolvedValueOnce(filledCart)
    vi.mocked(addOrderItem).mockResolvedValue(null)

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
              products,
            }}
            onClose={() => {}}
            onCreated={() => {}}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    await waitFor(() => expect(addOrderItem).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(getCurrentSaleCart).toHaveBeenCalledTimes(2))

    const productsStep = await screen.findByTestId('products-step')

    expect(productsStep.textContent).toContain('client-1')
    expect(productsStep.textContent).toContain('agreement-1')
    expect(productsStep.textContent).toContain('SEM9401')
    expect(productsStep.textContent).toContain('SEM8755')
    expect(productsStep.textContent).toContain('SEM15221')

    expect(vi.mocked(addOrderItem).mock.calls.map((call) => call[2].Product?.NetUid)).toEqual([
      'product-1',
      'product-2',
      'product-3',
    ])
  })

  it('keeps permission-scoped create cart hydration off shared read routes', async () => {
    const agreement = {
      Client: { Id: 7, NetUid: 'client-1' },
      NetUid: 'agreement-1',
    }
    const sale: SalesUkraineSale = {
      ClientAgreement: agreement,
      NetUid: 'sale-1',
      Order: { OrderItems: [] },
    }
    vi.mocked(getSalesUkraineCreateCurrentCart)
      .mockResolvedValueOnce(sale)
      .mockResolvedValueOnce(sale)
    vi.mocked(getSalesUkraineCreateDetails).mockResolvedValue(sale)
    vi.mocked(addOrderItem).mockResolvedValue(null)

    render(
      <MantineProvider theme={theme}>
        <I18nProvider>
          <NewSaleWizard
            opened
            permissionScopedSalesUkraineApi
            prefill={{
              agreement,
              agreementNetId: 'agreement-1',
              client: { Id: 7, NetUid: 'client-1' },
              clientNetId: 'client-1',
              products: [products[0]],
            }}
            onClose={() => {}}
            onCreated={() => {}}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    await screen.findByTestId('products-step')
    await wizardMocks.reloadCart?.()

    expect(getSalesUkraineCreateCurrentCart).toHaveBeenCalledTimes(2)
    expect(getSalesUkraineCreateDetails).toHaveBeenCalledWith('sale-1', expect.any(AbortSignal))
    expect(getCurrentSaleCart).not.toHaveBeenCalled()
    expect(getSaleById).not.toHaveBeenCalled()
  })

  it('keeps navigation blocked but allows closing when a cart operation needs reconciliation', async () => {
    const agreement = {
      Client: { Id: 7, NetUid: 'client-1' },
      NetUid: 'agreement-1',
    }
    const sale: SalesUkraineSale = {
      ClientAgreement: agreement,
      NetUid: 'sale-1',
      Order: {
        OrderItems: [{
          Id: 1,
          NetUid: 'item-1',
          Product: products[0],
          Qty: 1,
        }],
      },
    }
    vi.mocked(getCurrentSaleCart)
      .mockResolvedValueOnce({ ...sale, Order: { OrderItems: [] } })
      .mockResolvedValueOnce(sale)
    vi.mocked(addOrderItem).mockResolvedValue(null)
    const onClose = vi.fn()

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
              products: [products[0]],
            }}
            onClose={onClose}
            onCreated={() => {}}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'mark cart pending' }))

    expect((screen.getByRole('button', { name: 'Далі' }) as HTMLButtonElement).disabled).toBe(true)
    const close = screen.getByRole('button', { name: 'Закрити' }) as HTMLButtonElement
    expect(close.disabled).toBe(false)
    fireEvent.click(close)
    fireEvent.click(await screen.findByRole('button', { name: 'Так' }))

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('shares a cart refresh triggered concurrently by mutation acknowledgement and realtime', async () => {
    const agreement = {
      Client: { Id: 7, NetUid: 'client-1' },
      NetUid: 'agreement-1',
    }
    const sale: SalesUkraineSale = {
      ClientAgreement: agreement,
      NetUid: 'sale-1',
      Order: { OrderItems: [] },
    }
    const refreshedSale: SalesUkraineSale = {
      ...sale,
      Order: {
        OrderItems: [{
          Id: 1,
          NetUid: 'item-1',
          Product: products[0],
          Qty: 1,
        }],
      },
    }
    let resolveRefresh: ((value: SalesUkraineSale) => void) | undefined
    const refresh = new Promise<SalesUkraineSale>((resolve) => {
      resolveRefresh = resolve
    })

    vi.mocked(getCurrentSaleCart)
      .mockResolvedValueOnce(sale)
      .mockResolvedValueOnce(sale)
    vi.mocked(addOrderItem).mockResolvedValue(null)
    vi.mocked(getSaleById).mockReturnValue(refresh)

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
              products: [products[0]],
            }}
            onClose={() => {}}
            onCreated={() => {}}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    await screen.findByTestId('products-step')
    const reloadCart = wizardMocks.reloadCart

    expect(reloadCart).not.toBeNull()

    const mutationRefresh = reloadCart?.()
    const realtimeRefresh = reloadCart?.()

    expect(getSaleById).toHaveBeenCalledOnce()

    resolveRefresh?.(refreshedSale)

    await expect(mutationRefresh).resolves.toBe(refreshedSale)
    await expect(realtimeRefresh).resolves.toBe(refreshedSale)
    await waitFor(() => expect(screen.getByTestId('products-step').textContent).toContain('SEM9401'))
  })
})
