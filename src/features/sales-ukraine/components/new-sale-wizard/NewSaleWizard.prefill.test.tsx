import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import { addOrderItem, getCurrentSaleCart } from '../../api/salesUkraineApi'
import type { SalesUkraineProduct, SalesUkraineSale } from '../../types'
import { NewSaleWizard } from './NewSaleWizard'

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
  }
})

vi.mock('./NewSaleClientStep', () => ({
  NewSaleClientStep: () => <div data-testid="client-step" />,
}))

vi.mock('./NewSaleProductsStep', () => ({
  NewSaleProductsStep: ({
    agreementNetId,
    clientNetId,
    sale,
  }: {
    agreementNetId: string | null
    clientNetId: string | null
    sale: SalesUkraineSale | null
  }) => (
    <div data-testid="products-step">
      <span>{clientNetId}</span>
      <span>{agreementNetId}</span>
      {(sale?.Order?.OrderItems ?? []).map((item) => <span key={item.Product?.NetUid}>{item.Product?.VendorCode}</span>)}
    </div>
  ),
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
})
