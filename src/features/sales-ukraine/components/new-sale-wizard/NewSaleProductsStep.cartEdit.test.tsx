import { useState } from 'react'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import {
  clearAllSalesPendingMutations,
  loadSalesPendingMutation,
  type SalesPendingMutationScope,
} from '../../pendingSalesMutationRegistry'
import type { SalesUkraineProduct, SalesUkraineSale } from '../../types'

const apiMocks = vi.hoisted(() => ({
  acceptedQty: 3,
  addOrderItem: vi.fn(),
  deleteOrderItem: vi.fn(),
  getProductAvailabilityBuckets: vi.fn(),
  getProductAnalogues: vi.fn(),
  getProductCurrentPriceByAgreement: vi.fn(),
  getProductCalculatedPricingsByAgreement: vi.fn(),
  searchSaleProductsWithAvailability: vi.fn(),
  updateOrderItem: vi.fn(),
  updateProduct: vi.fn(),
}))

vi.mock('../../api/salesUkraineApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api/salesUkraineApi')>()

  return {
    ...original,
    addOrderItem: apiMocks.addOrderItem,
    deleteOrderItem: apiMocks.deleteOrderItem,
    updateOrderItem: apiMocks.updateOrderItem,
  }
})

vi.mock('./newSaleWizardApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('./newSaleWizardApi')>()

  return {
    ...original,
    getAllProductAvailabilities: vi.fn(async () => ({ Rows: [], Total: 0 })),
    getNearestSupplyOrder: vi.fn(async () => null),
    getProductAnalogues: apiMocks.getProductAnalogues,
    getProductAvailabilityBuckets: apiMocks.getProductAvailabilityBuckets,
    getProductCalculatedPricingsByAgreement: apiMocks.getProductCalculatedPricingsByAgreement,
    getProductCurrentPriceByAgreement: apiMocks.getProductCurrentPriceByAgreement,
    getProductReservationsByAgreement: vi.fn(async () => []),
    searchSaleProductsWithAvailability: apiMocks.searchSaleProductsWithAvailability,
    shiftOrderItemFromSale: vi.fn(async () => null),
  }
})

vi.mock('../../../products/api/productsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../products/api/productsApi')>(),
  updateProduct: apiMocks.updateProduct,
}))

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    session: { userNetUid: 'USER-A' },
    user: { FirstName: 'Test', LastName: 'User', NetUid: 'user-1' },
  }),
}))

vi.mock('../../../../shared/realtime/events', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../../shared/realtime/events')>()

  return {
    ...original,
    useRealtimeEvent: () => {},
  }
})

vi.mock('../../../clients/api/clientRecommendationsApi', () => ({
  getMostPurchasedProductsByClientId: vi.fn(async () => []),
}))

vi.mock('./WizardCrossSellModal', () => ({
  WizardCrossSellModal: ({
    opened,
    seedProduct,
    onPick,
  }: {
    opened: boolean
    seedProduct: SalesUkraineProduct | null
    onPick: (product: SalesUkraineProduct) => void
  }) => opened && seedProduct ? (
    <button type="button" onClick={() => onPick(seedProduct)}>
      pick same product
    </button>
  ) : null,
}))

vi.mock('./WizardConfirmModal', () => ({
  WizardConfirmModal: ({ opened, onConfirm }: { opened: boolean; onConfirm: () => void }) => (
    opened ? <button type="button" onClick={onConfirm}>confirm mutation</button> : null
  ),
}))

import { NewSaleProductsStep } from './NewSaleProductsStep'
import { initializeWizardKeyboard, setWizardKeyboardState } from './wizardKeyboard'
import { clearAllWizardSplitRecoveries } from './newSaleWizardState'
import type { WizardSaleProduct } from './wizardSaleProduct'

const agreementNetId = '052e5de7-1a9d-4b9b-bee5-fb6880985d35'
const scope: SalesPendingMutationScope = {
  context: `${agreementNetId}:8c0d823f-cccb-43e9-8fcc-2a2bbe781e3c`,
  kind: 'cart',
  userKey: 'net:user-a',
}

function createSale(qty: number = 2): SalesUkraineSale {
  const product: WizardSaleProduct = {
    AvailableQtyUk: 10,
    AvailableQtyUkReSale: 0,
    Id: 10,
    NetUid: 'product-1',
  }

  return {
    BaseLifeCycleStatus: { SaleLifeCycleType: 0 },
    ClientAgreement: { NetUid: agreementNetId },
    NetUid: '8c0d823f-cccb-43e9-8fcc-2a2bbe781e3c',
    Order: {
      OrderItems: [{
        Deleted: false,
        Id: 20,
        NetUid: '45c1535d-17c4-4d28-b3e9-771340f1a449',
        Product: product,
        Qty: qty,
      }],
    },
  }
}

function renderStep({
  onBusyChange = vi.fn(),
  onCartChanged = vi.fn(async () => createSale()),
  onPendingMutationChange = vi.fn(),
  sale = createSale(),
}: {
  onBusyChange?: (busy: boolean) => void
  onCartChanged?: () => SalesUkraineSale | null | void | Promise<SalesUkraineSale | null | void>
  onPendingMutationChange?: (pending: boolean) => void
  sale?: SalesUkraineSale | null
} = {}) {
  function Step() {
    const [currentSale, setCurrentSale] = useState(sale)
    return <NewSaleProductsStep
      agreementNetId={agreementNetId}
      client={null}
      clientNetId="06533388-32e7-40ef-9041-2501ae108248"
      sale={currentSale}
      onBusyChange={onBusyChange}
      onCartChanged={async () => {
        const updated = await onCartChanged()
        if (updated) setCurrentSale(updated)
        return updated
      }}
      onPendingMutationChange={onPendingMutationChange}
    />
  }
  return render(
    <MantineProvider theme={theme}>
      <Notifications autoClose={false} />
      <I18nProvider>
        <Step />
      </I18nProvider>
    </MantineProvider>,
  )
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1920)
  clearAllSalesPendingMutations()
  clearAllWizardSplitRecoveries()
  initializeWizardKeyboard(1)
  setWizardKeyboardState('ProductSearch')
  apiMocks.acceptedQty = 3
  apiMocks.addOrderItem.mockReset().mockResolvedValue(null)
  apiMocks.deleteOrderItem.mockReset().mockResolvedValue(null)
  apiMocks.getProductAnalogues.mockReset().mockResolvedValue([])
  apiMocks.getProductCurrentPriceByAgreement.mockReset().mockResolvedValue(null)
  apiMocks.getProductCalculatedPricingsByAgreement.mockReset().mockResolvedValue([])
  apiMocks.searchSaleProductsWithAvailability.mockReset().mockResolvedValue([])
  apiMocks.updateOrderItem.mockReset().mockResolvedValue(null)
  apiMocks.updateProduct.mockReset().mockResolvedValue(null)
  apiMocks.getProductAvailabilityBuckets.mockReset().mockResolvedValue({
    AvailableQtyUk: 10,
    AvailableQtyUkReSale: 0,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  clearAllSalesPendingMutations()
  clearAllWizardSplitRecoveries()
})


function recordedSale(qty = 20): SalesUkraineSale {
  const sale = createSale(qty)
  sale.IsVatSale = true
  sale.Order!.OrderItems![0].Product = {
    NetUid: '249c4c35-2fb3-4bb4-bd0b-1328786bd609',
    VendorCode: '2003-HC',
    NameUA: 'Комплект ремонтний крана гальмівного головного',
  }
  return sale
}

async function openEditor(sale = recordedSale()) {
  const onCartChanged = vi.fn(async () => recordedSale(12))
  renderStep({ sale, onCartChanged })
  fireEvent.keyDown(document.body, { key: 'F2' })
  const editor = await screen.findByRole('dialog', { name: 'Редагування кошика' })
  return { editor, onCartChanged }
}

beforeEach(() => {
  apiMocks.getProductAvailabilityBuckets.mockResolvedValue({ AvailableQtyUk: 0, AvailableQtyUkVAT: 3, AvailableQtyUkReSale: 0 })
})

describe('BUG-1533 actual F2 cart editor', () => {
  it('opens the recorded row by mouse and saves its quantity and comment through the existing mutation', async () => {
    const { editor, onCartChanged } = await openEditor()
    fireEvent.click(within(editor).getByRole('button', { name: 'Редагувати кількість · 2003-HC' }))
    const quantity = await screen.findByRole('textbox', { name: 'Кількість' })
    expect((quantity as HTMLInputElement).value).toBe('20')
    expect(apiMocks.getProductAvailabilityBuckets).toHaveBeenCalledWith('249c4c35-2fb3-4bb4-bd0b-1328786bd609', agreementNetId, expect.any(AbortSignal))
    fireEvent.change(quantity, { target: { value: '12' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Коментар' }), { target: { value: 'уточнено' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(apiMocks.updateOrderItem).toHaveBeenCalledOnce())
    expect(apiMocks.updateOrderItem.mock.calls[0][0]).toMatchObject({ NetUid: '45c1535d-17c4-4d28-b3e9-771340f1a449', Qty: 12, Comment: 'уточнено' })
    expect(apiMocks.updateOrderItem.mock.calls[0][1].operationId).toBeTruthy()
    await waitFor(() => expect(onCartChanged).toHaveBeenCalled())
    expect(loadSalesPendingMutation(scope)).toBeNull()
    await waitFor(() => expect(within(editor).getByRole('button', { name: 'Редагувати кількість · 2003-HC' }).textContent).toBe('12'))
  })

  it('keeps Enter editing available and cancels without changing the row', async () => {
    await openEditor()
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect((await screen.findByRole('textbox', { name: 'Кількість' }) as HTMLInputElement).value).toBe('20')
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
    expect(apiMocks.updateOrderItem).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Редагування кошика' })).toBeTruthy()
  })

  it('rejects quantity beyond the current row plus agreement-scoped availability', async () => {
    const { editor } = await openEditor()
    fireEvent.click(within(editor).getByRole('button', { name: 'Редагувати кількість · 2003-HC' }))
    const quantity = await screen.findByRole('textbox', { name: 'Кількість' })
    fireEvent.change(quantity, { target: { value: '24' } })
    expect((screen.getByRole('button', { name: 'Зберегти' }) as HTMLButtonElement).disabled).toBe(true)
    expect(apiMocks.updateOrderItem).not.toHaveBeenCalled()
  })

  it('does not bypass printed-sale approval through the mouse action', async () => {
    const { editor } = await openEditor({ ...recordedSale(), IsPrinted: true, HistoryInvoiceEdit: [] })
    fireEvent.click(within(editor).getByRole('button', { name: 'Редагувати кількість · 2003-HC' }))
    expect(await screen.findByText('Зміни заборонені')).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Кількість' })).toBeNull()
    expect(apiMocks.updateOrderItem).not.toHaveBeenCalled()
  })
})

const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
beforeAll(() => Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() }))
afterAll(() => {
  if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollDescriptor)
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})
