import { MantineProvider } from '@mantine/core'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from '../../../shared/api/apiClient'
import { theme } from '../../../shared/theme/theme'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { SalesOnlineShopPage } from '../../sales-online-shop/pages/SalesOnlineShopPage'
import { getSalesUkraineEditDetails } from '../api/salesUkraineApi'
import {
  clearAllSalesPendingMutations,
  loadSalesPendingMutation,
  markSalesPendingMutationUnknown,
  withSalesPendingMutationLock,
} from '../pendingSalesMutationRegistry'
import { installSalesMutationStorageHarness, type SalesMutationStorageHarness } from '../salesMutationStorageTestHarness'
import type { SalesUkraineOrderItem, SalesUkraineProduct, SalesUkraineSale } from '../types'
import { createPersistedWizardCartMutation } from './new-sale-wizard/wizardCartMutation'
import { SaleEditorDrawer } from './SaleEditorDrawer'

vi.mock('../../../shared/api/apiClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api/apiClient')>()),
  apiRequest: vi.fn(),
}))
vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ session: { userNetUid: 'USER-A' } }),
}))
vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (key: string) => key === PermissionKeys.SalesUkraine.Sale.Edit
      || key === PermissionKeys.SystemPages.SalesOnlineShop.View,
  }),
}))
vi.mock('../../../shared/i18n/useI18n', () => {
  const translate = (key: string) => key
  return { useI18n: () => ({ t: translate }) }
})
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))
vi.mock('../usePersistentSaleFileMutation', () => ({ usePersistentSaleFileMutation: () => ({}) }))
vi.mock('./SaleDetailsDrawer', () => ({ SaleDetailsDrawer: () => null }))
vi.mock('./MergedSalesDrawer', () => ({ MergedSalesDrawer: () => null }))
vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ data }: { data: SalesUkraineOrderItem[] }) => (
    <div data-testid="sale-items">{data.map((item) => <div key={item.NetUid}>{item.Product?.VendorCode}: {item.Qty}</div>)}</div>
  ),
}))

const saleNetUid = '11111111-1111-4111-8111-111111111111'
const agreementNetUid = '22222222-2222-4222-8222-222222222222'
const operationId = '33333333-3333-4333-8333-333333333333'
const product: SalesUkraineProduct = {
  Id: 876,
  NetUid: '44444444-4444-4444-8444-444444444444',
  VendorCode: '011876-YUMAK',
  NameUA: 'Пластина компресора',
  AvailableQtyUkVAT: 0,
}
const scope = { context: `sale-editor:${saleNetUid}`, kind: 'cart' as const, userKey: 'net:user-a' }
const apiRequestMock = vi.mocked(apiRequest)
let storage: SalesMutationStorageHarness
let sale: SalesUkraineSale
let availability: Partial<SalesUkraineProduct> | null
let failAvailability: boolean
let failRefreshAfterAdd: boolean
let failAdd: boolean
let hasAdded: boolean
let products: SalesUkraineProduct[]
let productAvailabilities: Map<string, Partial<SalesUkraineProduct> | null>

beforeEach(() => {
  storage = installSalesMutationStorageHarness()
  clearAllSalesPendingMutations()
  availability = {
    AvailableQtyUkVAT: 7.5,
    AvailableQtyUk: 12,
    AvailableQtyUkReSale: 3.25,
    ProductAvailabilities: [{ Amount: 7.5 }],
  }
  failAvailability = false
  failRefreshAfterAdd = false
  failAdd = false
  hasAdded = false
  products = [product]
  productAvailabilities = new Map()
  sale = {
    NetUid: saleNetUid,
    HasDetails: true,
    IsVatSale: true,
    SaleNumber: { Value: 'КСн00002858' },
    ClientAgreement: { NetUid: agreementNetUid, Client: { FullName: 'ShopClient' } },
    Order: { OrderItems: [] },
  }
  apiRequestMock.mockReset().mockImplementation(async (path, options) => {
    if (path === '/sales/online-shop/registry') return [{ ...sale, HasDetails: false, Order: undefined, TotalRowsQty: 1 }]
    if (path === '/sales/ukraine/edit/details') {
      if (hasAdded && failRefreshAfterAdd) throw new Error('refresh unavailable')
      return sale
    }
    if (path === '/products/search/vendorcode') return products
    if (path === '/products/all/availabilities/product') {
      if (failAvailability) throw new Error('availability unavailable')
      const productNetUid = String(options?.query?.netId)
      return productAvailabilities.has(productNetUid) ? productAvailabilities.get(productNetUid) : availability
    }
    if (path === '/orders/items/new') {
      if (failAdd) throw new ApiError('network unavailable', 503, null)
      const item = options?.body as SalesUkraineOrderItem
      hasAdded = true
      sale = {
        ...sale,
        OperationNetUid: item.OperationNetUid,
        Order: { OrderItems: [{ ...item, NetUid: '55555555-5555-4555-8555-555555555555' }] },
      }
      return sale.Order?.OrderItems?.[0]
    }
    throw new Error(`Unexpected API: ${path}`)
  })
})

afterEach(() => {
  cleanup()
  clearAllSalesPendingMutations()
  storage.dispose()
})

function renderEditor() {
  return render(
    <StrictMode>
      <MantineProvider theme={theme}>
        <SaleEditorDrawer sale={sale} loadSale={getSalesUkraineEditDetails} onClose={vi.fn()} />
      </MantineProvider>
    </StrictMode>,
  )
}

async function openProductSearch(vendorCode = '011876-YUMAK') {
  fireEvent.click(await screen.findByRole('button', { name: 'Додати товар' }))
  fireEvent.change(screen.getByLabelText('Пошук по товару'), { target: { value: '876' } })
  return screen.findByRole('button', { name: new RegExp(vendorCode) })
}

async function seedPendingAdd() {
  const pending = createPersistedWizardCartMutation({
    context: scope.context,
    operationId,
    expectation: { kind: 'operation-marker' },
    fallbackMessage: 'Не вдалося додати товар',
    localCommit: { kind: 'none' },
    request: {
      kind: 'add',
      clientAgreementNetId: agreementNetUid,
      saleNetId: saleNetUid,
      orderItem: { Product: product, Qty: 2 },
    },
  })
  await withSalesPendingMutationLock(scope, operationId, pending, async (lease) => {
    markSalesPendingMutationUnknown(lease)
  })
  return pending
}

function addRequests() {
  return apiRequestMock.mock.calls.filter(([path]) => path === '/orders/items/new')
}

describe('/sales-online-shop → existing sale editor → add product (BUG-1252)', () => {
  it('opens the real add modal from the shop registry and shows quantities for every Screenshot_337 search row before selection', async () => {
    const screenshotRows = [
      ['.0145-AL', 'Амортизатор', 8],
      ['.05628457BP', 'Клапан обмеження тиску', 0],
      ['.05669451BP', 'Клапан магістральний багатопозиційний', 12],
      ['.05765455BP', 'Клапан розгальмовування аварійного', 3],
      ['.05767451BP', 'Клапан розгальмовування аварійного', 21],
    ] as const
    products = screenshotRows.map(([vendorCode, name], index) => ({
      ...product,
      Id: 100 + index,
      NetUid: `44444444-4444-4444-8444-${String(index + 1).padStart(12, '0')}`,
      VendorCode: vendorCode,
      NameUA: name,
    }))
    products.forEach((item, index) => productAvailabilities.set(item.NetUid!, {
      AvailableQtyUkVAT: screenshotRows[index][2],
      AvailableQtyUk: 99,
      AvailableQtyUkReSale: 99,
      ProductAvailabilities: [{ Amount: screenshotRows[index][2] }],
    }))
    render(
      <MantineProvider theme={theme}>
        <MemoryRouter initialEntries={['/sales-online-shop']}>
          <SalesOnlineShopPage />
        </MemoryRouter>
      </MantineProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Відкрити продаж' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Додати товар' }))
    const modal = await screen.findByRole('dialog', { name: 'Додати товар' })
    fireEvent.change(within(modal).getByLabelText('Пошук по товару'), { target: { value: '45' } })

    for (const [vendorCode, , quantity] of screenshotRows) {
      const row = await within(modal).findByRole('button', { name: new RegExp(vendorCode.replace('.', '\\.')) })
      expect(within(row).getByText(quantity)).toBeTruthy()
    }
    expect((within(modal).getByRole('textbox', { name: 'Кількість' }) as HTMLInputElement).disabled).toBe(true)
    expect(apiRequestMock).toHaveBeenCalledWith('/sales/ukraine/edit/details', { query: { netId: saleNetUid } })
    expect(apiRequestMock).toHaveBeenCalledWith('/products/search/vendorcode', expect.objectContaining({
      query: { limit: 20, offset: 0, value: '45' },
    }))
    expect(apiRequestMock.mock.calls.filter(([path]) => path === '/products/all/availabilities/product')).toHaveLength(5)
    expect(addRequests()).toHaveLength(0)
    fireEvent.click(within(modal).getByRole('button', { name: /\.05669451BP/ }))
    fireEvent.change(within(modal).getByRole('textbox', { name: 'Кількість' }), { target: { value: '12' } })
    fireEvent.click(within(modal).getByRole('button', { name: 'Додати' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Додати товар' })).toBeNull())
    expect(addRequests()).toHaveLength(1)
    expect(addRequests()[0][1]?.body).toMatchObject({ Product: { NetUid: products[2].NetUid }, Qty: 12 })
  })

  it.each([true, false] as const)(
    'shows the physical warehouse quantity for VAT=%s and adds with one submit',
    async (isVatSale) => {
      sale.IsVatSale = isVatSale
      renderEditor()
      const result = await openProductSearch()
      expect(within(result).getByText('7,5')).toBeTruthy()
      expect(apiRequestMock).toHaveBeenCalledWith('/products/all/availabilities/product', expect.objectContaining({
        cache: 'no-store', query: { clientAgreementNetId: agreementNetUid, netId: product.NetUid },
      }))
      fireEvent.click(result)
      fireEvent.change(screen.getByRole('textbox', { name: 'Кількість' }), { target: { value: '2' } })
      fireEvent.click(screen.getByRole('button', { name: 'Додати' }))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Додати товар' })).toBeNull())
      expect(addRequests()).toHaveLength(1)
      expect(addRequests()[0][1]).toMatchObject({
        method: 'POST',
        query: { clientAgreementNetId: agreementNetUid, saleNetId: saleNetUid },
        body: { Product: { NetUid: product.NetUid }, Qty: 2 },
      })
      expect(screen.getByTestId('sale-items').textContent).toContain('011876-YUMAK: 2')
      expect(loadSalesPendingMutation(scope)).toBeNull()
      expect(screen.queryByText(/Попередня операція не підтверджена/)).toBeNull()
    },
  )

  it.each(['unavailable', 'missing', 'incomplete'])(
    'does not invent zero stock when availability is %s',
    async (state) => {
      failAvailability = state === 'unavailable'
      availability = state === 'incomplete' ? { ProductAvailabilities: [{ Amount: Number.NaN }] } : null
      renderEditor()
      expect(within(await openProductSearch()).getByText('Залишок невідомий')).toBeTruthy()
      expect(screen.queryByText('0')).toBeNull()
    },
  )

  it('shows a genuine zero quantity', async () => {
    availability = { AvailableQtyUkVAT: 0, ProductAvailabilities: [] }
    renderEditor()
    expect(within(await openProductSearch()).getByText('0')).toBeTruthy()
  })

  it('shows 12 on stock for Screenshot_338 product even when the agreement sellable bucket is zero', async () => {
    products = [{ ...product, VendorCode: '56010CNT' }]
    availability = {
      AvailableQtyUkVAT: 0,
      AvailableQtyUk: 0,
      AvailableQtyUkReSale: 0,
      ProductAvailabilities: [{ Amount: 12 }],
    }
    renderEditor()
    const result = await openProductSearch('56010CNT')
    expect(within(result).getByText('12')).toBeTruthy()
    expect(within(result).queryByText('0')).toBeNull()
  })

  it('clears the previous product and its quantity immediately when the search changes', async () => {
    renderEditor()
    fireEvent.click(await openProductSearch())
    const modal = screen.getByRole('dialog', { name: 'Додати товар' })
    fireEvent.change(within(modal).getByLabelText('Пошук по товару'), { target: { value: '4' } })
    expect(within(modal).queryByText('7,5')).toBeNull()
    expect((within(modal).getByRole('textbox', { name: 'Кількість' }) as HTMLInputElement).disabled).toBe(true)
    expect((within(modal).getByRole('button', { name: 'Додати' }) as HTMLButtonElement).disabled).toBe(true)
    expect(addRequests()).toHaveLength(0)
  })

  it('replays a restored add automatically with the frozen payload and same idempotency key', async () => {
    const pending = await seedPendingAdd()
    renderEditor()
    await waitFor(() => expect(loadSalesPendingMutation(scope)).toBeNull())
    expect(addRequests()).toHaveLength(1)
    expect(addRequests()[0][1]).toMatchObject({
      body: pending.request.kind === 'add' ? pending.request.orderItem : null,
      headers: { 'Idempotency-Key': operationId },
    })
    expect(screen.queryByText(/Попередня операція не підтверджена/)).toBeNull()
    expect(await screen.findByRole('button', { name: 'Додати товар' })).toBeTruthy()
    fireEvent.click(await openProductSearch())
    fireEvent.click(screen.getByRole('button', { name: 'Додати' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Додати товар' })).toBeNull())
    expect(addRequests()).toHaveLength(2)
    expect((addRequests()[1][1]?.body as SalesUkraineOrderItem).OperationNetUid).not.toBe(operationId)
  })

  it('clears a restored committed add by marker without another POST', async () => {
    await seedPendingAdd()
    sale.OperationNetUid = operationId
    renderEditor()
    await waitFor(() => expect(loadSalesPendingMutation(scope)).toBeNull())
    expect(addRequests()).toHaveLength(0)
    expect(screen.queryByText(/Попередня операція не підтверджена/)).toBeNull()
  })

  it('retains the pending key and reports a genuine recovery failure without looping', async () => {
    await seedPendingAdd()
    failAdd = true
    renderEditor()
    expect(await screen.findByText('network unavailable')).toBeTruthy()
    expect(loadSalesPendingMutation(scope)?.operationId).toBe(operationId)
    expect(addRequests()).toHaveLength(1)
  })

  it('does not require another add or retain pending confirmation when only the post-save GET fails', async () => {
    failRefreshAfterAdd = true
    renderEditor()
    fireEvent.click(await openProductSearch())
    fireEvent.click(screen.getByRole('button', { name: 'Додати' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Додати товар' })).toBeNull())
    expect(addRequests()).toHaveLength(1)
    expect(loadSalesPendingMutation(scope)).toBeNull()
    expect(await screen.findByText(/Зміни збережено, але не вдалося оновити/)).toBeTruthy()
  })
})
