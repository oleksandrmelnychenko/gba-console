import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { NewOfferModal } from './NewOfferModal'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))
vi.mock('../../auth/usePermissions', () => ({ usePermissions: () => ({ can: () => state.canCreate }) }))
vi.mock('../../sales-ukraine/persistentCreateMutation', () => ({ usePersistentCreateMutation: () => vi.fn() }))
vi.mock('../../products/components/ProductCardModal', () => ({ ProductCardModal: () => null }))

const state = vi.hoisted(() => ({ canCreate: true }))
const apiMock = vi.mocked(apiRequest)
const screenshotProducts = [
  ['154bdad0-4f57-4502-8702-1c7ef0390b21', '045.401-00-PE', '02.2002.46.00*'],
  ['68a81241-cbf2-4bdf-8a18-0f3d3a824f38', '045.403-00-PE', '02.2002.40.00*'],
  ['7214dc1b-06d1-426c-865a-017cdae72603', '045.404-00-PE', '02.2002.41.00*'],
  ['0caee76f-3c7a-4b9c-92bb-7fa27755f239', '045.405-00-PE', '02.2002.42.00*'],
].map(([NetUid, VendorCode, MainOriginalNumber]) => ({
  NetUid, VendorCode, MainOriginalNumber, Name: 'Пневмоподушка',
  AvailableQtyUk: 0, AvailableQtyUkVAT: 0, AvailableQtyUkReSale: 0,
}))
const stockedProduct = {
  NetUid: 'b4ce391f-3e7b-4be0-aebe-7541198d7442',
  VendorCode: '19037 FERODO',
  Name: 'Накладки тормозные',
  MainOriginalNumber: '19037VWA',
  AvailableQtyUk: 1,
  AvailableQtyUkVAT: 0,
  AvailableQtyUkReSale: 0,
}
let products: object[]

beforeEach(() => {
  vi.clearAllMocks()
  state.canCreate = true
  products = screenshotProducts
  apiMock.mockImplementation(async (path) => {
    if (path === '/clients/sales-ukraine/offers/create/search') {
      return [{ NetUid: 'client-1', FullName: 'Муляр Іван Сергійович' }]
    }
    if (path === '/agreements/client/all') {
      return [{ NetUid: 'agreement-1', Agreement: { Name: 'Основной договор' } }]
    }
    if (path === '/products/search/vendorcode') return products
    if (path === '/products/reservations/current/carousel/agreement') return [{ AvailableQtyUk: 1 }]
    return []
  })
})

function renderModal() {
  return render(<MantineProvider><I18nProvider><NewOfferModal opened onClose={vi.fn()} onCreated={vi.fn()} /></I18nProvider></MantineProvider>)
}

async function searchProducts(value = '045.40') {
  renderModal()
  const user = userEvent.setup()
  await user.type(screen.getByRole('combobox', { name: 'Клієнт' }), 'Муляр')
  await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/clients/sales-ukraine/offers/create/search', { query: { limit: 50, offset: 0, value: 'Муляр' } }))
  fireEvent.click(await screen.findByRole('option', { name: 'Муляр Іван Сергійович', hidden: true }))
  const agreement = screen.getByRole('combobox', { name: 'Договір' })
  await waitFor(() => expect(agreement.hasAttribute('disabled')).toBe(false))
  fireEvent.click(agreement)
  fireEvent.click(await screen.findByRole('option', { name: 'Основной договор', hidden: true }))
  await user.type(screen.getByRole('combobox', { name: 'Товар' }), value)
  return within(screen.getByRole('listbox', { name: 'Товар', hidden: true })).findAllByRole('option', { hidden: true })
}

describe('NewOfferModal product search stock', () => {
  it('shows all three zero quantities beside the four screenshot products before selection', async () => {
    const options = await searchProducts()
    expect(options).toHaveLength(4)
    for (const [index, option] of options.entries()) {
      const row = within(option)
      expect(row.getByText(screenshotProducts[index].VendorCode)).toBeTruthy()
      expect(row.getByText(screenshotProducts[index].MainOriginalNumber)).toBeTruthy()
      expect(row.getByText('Пневмоподушка')).toBeTruthy()
      expect(row.getByText('Без ПДВ: 0')).toBeTruthy()
      expect(row.getByText('ПДВ: 0', { exact: true })).toBeTruthy()
      expect(row.getByText('Перепродаж: 0')).toBeTruthy()
    }
    expect(apiMock).toHaveBeenCalledWith('/products/search/vendorcode', {
      query: { limit: 20, offset: 0, value: '045.40' },
    })
    expect(apiMock.mock.calls.some(([path]) => path.includes('/reservations/'))).toBe(false)
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('shows the real positive DEV quantity and keeps selection bound to the product NetUid', async () => {
    products = [stockedProduct]
    const [option] = await searchProducts('19037 FERODO')
    expect(within(option).getByText('Без ПДВ: 1')).toBeTruthy()
    expect(within(option).getByText('ПДВ: 0', { exact: true })).toBeTruthy()
    fireEvent.click(option)
    expect(await screen.findByRole('table')).toBeTruthy()
    expect(apiMock).toHaveBeenCalledWith('/products/reservations/current/carousel/agreement', {
      query: { productNetId: stockedProduct.NetUid, clientAgreementNetId: 'agreement-1' },
    })
    expect(within(screen.getByRole('table')).getByText(stockedProduct.VendorCode)).toBeTruthy()
    expect(notifications.show).not.toHaveBeenCalled()
  })

  it('keeps fractional non-VAT, VAT and resale stock separate without rounding or adding buckets', async () => {
    products = [{ ...stockedProduct, AvailableQtyUk: 12.125, AvailableQtyUkVAT: 7.5, AvailableQtyUkReSale: 3.25 }]
    const [option] = await searchProducts('19037')
    expect(within(option).getByText('Без ПДВ: 12.125')).toBeTruthy()
    expect(within(option).getByText('ПДВ: 7.5', { exact: true })).toBeTruthy()
    expect(within(option).getByText('Перепродаж: 3.25')).toBeTruthy()
  })

  it('marks missing and invalid stock as unknown instead of showing zero', async () => {
    products = [{ ...stockedProduct, AvailableQtyUk: undefined, AvailableQtyUkVAT: null, AvailableQtyUkReSale: Number.NaN }]
    const [option] = await searchProducts('19037')
    expect(within(option).getByText('Без ПДВ: Невідомо')).toBeTruthy()
    expect(within(option).getByText('ПДВ: Невідомо', { exact: true })).toBeTruthy()
    expect(within(option).getByText('Перепродаж: Невідомо')).toBeTruthy()
    expect(within(option).queryByText(/: 0$/)).toBeNull()
  })

  it('does not expose the creation form without create permission', () => {
    state.canCreate = false
    renderModal()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(apiMock).not.toHaveBeenCalled()
  })
})
