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
vi.mock('../../sales-ukraine/persistentCreateMutation', () => ({
  usePersistentCreateMutation: () => (payload: unknown, create: (body: unknown, operation: object) => unknown) =>
    create(payload, { operationId: 'fc5d941e-7382-4c29-b459-7ed373b66916' }),
}))
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
const screenshotProduct = {
  Id: 38286744,
  NetUid: '1678ef9f-0d8c-492b-a784-2dc9ea6abc18',
  VendorCode: '02235030FSS',
  Name: 'Кран гальмівний ножний',
  MainOriginalNumber: '461 494 501 0',
  AvailableQtyUk: 0,
  AvailableQtyUkVAT: 2,
  AvailableQtyUkReSale: 2,
}
const agreementNetId = '90838e82-2079-418c-a8fc-27fdab365892'
let products: object[]
let availability: unknown
let withVatAccounting: boolean | undefined

beforeEach(() => {
  vi.clearAllMocks()
  state.canCreate = true
  products = screenshotProducts
  availability = { AvailableQtyUk: 1, AvailableQtyUkVAT: 0, AvailableQtyUkReSale: 0 }
  withVatAccounting = false
  apiMock.mockImplementation(async (path) => {
    if (path === '/clients/sales-ukraine/offers/create/search') {
      return [{ NetUid: 'client-1', FullName: 'Муляр Іван Сергійович' }]
    }
    if (path === '/agreements/client/all') {
      return [{ Id: 503943, NetUid: agreementNetId, Agreement: { Name: 'Основной договор', WithVATAccounting: withVatAccounting } }]
    }
    if (path === '/products/search/vendorcode') return products
    if (path === '/products/reservations/current/carousel/agreement') return []
    if (path === '/products/all/availabilities/product') {
      if (availability instanceof Error) throw availability
      return availability
    }
    if (path === '/sales/offers/new') return { NetUid: '8c351eb4-9b28-4efe-80c9-a78a831bec8f' }
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
    expect(apiMock).toHaveBeenCalledWith('/products/all/availabilities/product', {
      query: { netId: stockedProduct.NetUid, clientAgreementNetId: agreementNetId },
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

describe('BUG-1485 offer product addition', () => {
  beforeEach(() => {
    products = [screenshotProduct]
    withVatAccounting = true
    availability = { AvailableQtyUk: 0, AvailableQtyUkVAT: 2, AvailableQtyUkReSale: 0 }
  })

  it('adds the screenshot VAT product without reservations and submits its edited quantity and comment', async () => {
    const [option] = await searchProducts('02235030FSS')
    expect(within(option).getByText('Без ПДВ: 0')).toBeTruthy()
    expect(within(option).getByText('ПДВ: 2', { exact: true })).toBeTruthy()
    expect(within(option).getByText('Перепродаж: 2')).toBeTruthy()
    fireEvent.click(option)
    const table = await screen.findByRole('table')
    expect(within(table).getByText('02235030FSS')).toBeTruthy()
    expect(apiMock).toHaveBeenCalledWith('/products/all/availabilities/product', {
      query: { netId: screenshotProduct.NetUid, clientAgreementNetId: agreementNetId },
    })
    expect(apiMock.mock.calls.some(([path]) => path.includes('/reservations/'))).toBe(false)
    fireEvent.change(within(table).getByRole('textbox', { name: 'Кількість' }), { target: { value: '2' } })
    fireEvent.change(within(table).getByRole('textbox', { name: 'Коментар' }), { target: { value: 'Для клієнта' } })
    const createButton = screen.getByRole('button', { name: 'Створити' })
    expect(createButton.hasAttribute('disabled')).toBe(false)
    fireEvent.click(createButton)
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/sales/offers/new', expect.objectContaining({
      body: {
        ClientAgreement: { Id: 503943, NetUid: agreementNetId, Agreement: { Name: 'Основной договор', WithVATAccounting: true } },
        OrderItems: [{ Product: screenshotProduct, Qty: 2, Comment: 'Для клієнта' }],
      },
    })))
  })

  it('adds eligible resale stock for a non-VAT agreement and does not duplicate the line', async () => {
    withVatAccounting = false
    availability = { AvailableQtyUk: 0, AvailableQtyUkVAT: 0, AvailableQtyUkReSale: 2 }
    const [option] = await searchProducts('02235030FSS')
    fireEvent.click(option)
    const table = await screen.findByRole('table')
    fireEvent.click(screen.getByRole('combobox', { name: 'Товар' }))
    fireEvent.click(await screen.findByRole('option', { name: /02235030FSS/, hidden: true }))
    expect(within(table).getAllByRole('row')).toHaveLength(2)
    expect(apiMock.mock.calls.filter(([path]) => path === '/products/all/availabilities/product')).toHaveLength(1)
  })

  it('blocks a genuine zero in the agreement scope even when global search shows stock', async () => {
    availability = { AvailableQtyUk: 0, AvailableQtyUkVAT: 0, AvailableQtyUkReSale: 2 }
    const [option] = await searchProducts('02235030FSS')
    fireEvent.click(option)
    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith({ color: 'red', message: 'Немає товарів на складі' }))
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('button', { name: 'Створити' }).hasAttribute('disabled')).toBe(true)
  })

  it.each([new Error('Unavailable'), null, {}, { AvailableQtyUkVAT: Number.NaN }])(
    'reports unavailable stock data without inventing zero: %s', async (response) => {
      availability = response
      const [option] = await searchProducts('02235030FSS')
      fireEvent.click(option)
      await waitFor(() => expect(notifications.show).toHaveBeenCalledWith({
        color: 'red', message: 'Не вдалося перевірити наявність товару. Спробуйте ще раз',
      }))
      expect(screen.queryByRole('table')).toBeNull()
      expect(notifications.show).not.toHaveBeenCalledWith(expect.objectContaining({ message: 'Немає товарів на складі' }))
      availability = { AvailableQtyUk: 0, AvailableQtyUkVAT: 2, AvailableQtyUkReSale: 0 }
      fireEvent.click(screen.getByRole('combobox', { name: 'Товар' }))
      fireEvent.click(await screen.findByRole('option', { name: /02235030FSS/, hidden: true }))
      expect(await screen.findByRole('table')).toBeTruthy()
    },
  )
})
