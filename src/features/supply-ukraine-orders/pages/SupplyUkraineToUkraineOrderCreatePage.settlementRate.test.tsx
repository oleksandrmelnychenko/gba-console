import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { SupplyUkraineToUkraineOrderCreatePage } from './SupplyUkraineDirectOrderCreatePage'

const api = vi.hoisted(() => ({
  getSupplyOrderOrganizations: vi.fn(),
  getSupplyOrderCreateSuppliers: vi.fn(),
  uploadSupplyOrderUkraineFromSupplierFile: vi.fn(),
}))
const quoteApi = vi.hoisted(() => ({ getSupplierSettlementRateQuote: vi.fn() }))
const auth = vi.hoisted(() => ({ canOverride: false }))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (key: string) => key !== 'orders.ukraine.order.override_settlement_rate' || auth.canOverride,
  }),
}))
vi.mock('../api/supplyUkraineOrdersApi', () => api)
vi.mock('../../../shared/settlement-rate/supplierSettlementRate', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../shared/settlement-rate/supplierSettlementRate')>(),
  getSupplierSettlementRateQuote: quoteApi.getSupplierSettlementRateQuote,
}))

const organization = { Culture: 'uk', Id: 10, Name: 'Фенікс', NetUid: 'organization-1' }
const agreement = {
  Agreement: { Currency: { Code: 'UAH', Id: 2 }, Id: 30, Name: 'Договір UAH', NetUid: 'agreement-1', Organization: organization },
  Id: 20,
  NetUid: 'client-agreement-1',
}
const supplier = { ClientAgreements: [agreement], Id: 40, Name: 'Постачальник QA', NetUid: 'supplier-1' }
const nbuQuote = { CurrencyCode: 'UAH', DefaultKind: 1, Kind: 1, Rate: 50.222, RateDate: '2026-11-17T08:30:00Z', Source: 'nbu' }

function renderPage() {
  return render(<MantineProvider env="test"><I18nProvider><MemoryRouter initialEntries={['/orders/ukraine/to-ukraine/new']}>
    <SupplyUkraineToUkraineOrderCreatePage />
  </MemoryRouter></I18nProvider></MantineProvider>)
}

function select(label: string | RegExp, option: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }))
  fireEvent.click(screen.getByRole('option', { name: option }))
}

async function chooseAgreement() {
  const view = renderPage()
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Постачальник' }) as HTMLInputElement).disabled).toBe(false))
  select('Постачальник', 'Постачальник QA')
  select('Організація', 'Фенікс')
  select('Договір', 'Договір UAH · UAH')
  return view
}


function rateLine() {
  return screen.getByTestId('supplier-settlement-rate-line')
}

function fillImportAndSubmit(container: HTMLElement) {
  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files: [new File(['test'], 'supply.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })] },
  })
  fireEvent.change(screen.getByLabelText('Код товару'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Кількість'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('З рядка'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('До рядка'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('Колонка ціни'), { target: { value: '3' } })
  api.uploadSupplyOrderUkraineFromSupplierFile.mockResolvedValue({ HasError: true })
  fireEvent.click(screen.getByRole('button', { name: 'Створити' }))
}

describe('new supply to Ukraine: «Курс розрахунків»', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.canOverride = false
    Element.prototype.scrollIntoView = vi.fn()
    api.getSupplyOrderOrganizations.mockResolvedValue([organization])
    api.getSupplyOrderCreateSuppliers.mockResolvedValue([supplier])
    quoteApi.getSupplierSettlementRateQuote.mockResolvedValue(nbuQuote)
  })

  it('quotes the receipt rate for the chosen agreement and the invoice date it will send', async () => {
    await chooseAgreement()

    await waitFor(() => expect(within(rateLine()).getByText('НБУ 50,222 за 17.11.2026')).toBeTruthy())
    expect(within(rateLine()).getByText('Курс розрахунків:')).toBeTruthy()
    expect(quoteApi.getSupplierSettlementRateQuote).toHaveBeenCalledWith(expect.objectContaining({
      clientAgreementNetId: 'client-agreement-1',
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/),
      document: 'receipt',
      kind: null,
    }))
    // Read-only without the override key.
    expect(screen.queryByRole('combobox', { name: 'Вид курсу' })).toBeNull()
    expect(screen.queryByLabelText('Свій курс, за 1 EUR')).toBeNull()
  })

  it('quotes again when the invoice date changes', async () => {
    await chooseAgreement()
    await waitFor(() => expect(quoteApi.getSupplierSettlementRateQuote).toHaveBeenCalledTimes(1))

    quoteApi.getSupplierSettlementRateQuote.mockResolvedValueOnce({ ...nbuQuote, Rate: 49.9, RateDate: '2026-11-10T08:30:00Z' })
    fireEvent.change(screen.getByLabelText('Дата накладної'), { target: { value: '2026-11-10T10:30' } })

    await waitFor(() => expect(within(rateLine()).getByText('НБУ 49,9 за 10.11.2026')).toBeTruthy())
    expect(quoteApi.getSupplierSettlementRateQuote).toHaveBeenLastCalledWith(expect.objectContaining({
      date: new Date('2026-11-10T10:30').toISOString(),
    }))
  })

  it('warns when there is no rate and says so for an EUR agreement', async () => {
    quoteApi.getSupplierSettlementRateQuote.mockResolvedValueOnce({ ...nbuQuote, Rate: null, Source: 'none' })
    await chooseAgreement()

    await waitFor(() => expect(within(rateLine()).getByText('Немає курсу НБУ UAH/EUR на 17.11.2026')).toBeTruthy())

    quoteApi.getSupplierSettlementRateQuote.mockResolvedValueOnce({ ...nbuQuote, CurrencyCode: 'EUR', Rate: 1, Source: 'eur' })
    fireEvent.change(screen.getByLabelText('Дата накладної'), { target: { value: '2026-11-11T10:30' } })
    await waitFor(() => expect(within(rateLine()).getByText('EUR — без перерахунку')).toBeTruthy())
  })

  it('keeps a failed quote non-blocking', async () => {
    quoteApi.getSupplierSettlementRateQuote.mockRejectedValueOnce(new Error('Не вдалося отримати курс розрахунків.'))
    const { container } = await chooseAgreement()

    await waitFor(() => expect(within(rateLine()).getByText('Не вдалося отримати курс розрахунків.')).toBeTruthy())
    fillImportAndSubmit(container)
    await waitFor(() => expect(api.uploadSupplyOrderUkraineFromSupplierFile).toHaveBeenCalled())
  })

  it('sends no override without the key', async () => {
    const { container } = await chooseAgreement()
    await waitFor(() => expect(within(rateLine()).getByText('НБУ 50,222 за 17.11.2026')).toBeTruthy())

    fillImportAndSubmit(container)

    await waitFor(() => expect(api.uploadSupplyOrderUkraineFromSupplierFile).toHaveBeenCalledWith(
      expect.objectContaining({ orderUkraine: expect.objectContaining({ SettlementExchangeRate: null, SettlementRateKind: null }) }),
    ))
    // The quote used the very InvDate string the upload carries.
    expect(api.uploadSupplyOrderUkraineFromSupplierFile.mock.calls[0][0].orderUkraine.InvDate)
      .toBe(quoteApi.getSupplierSettlementRateQuote.mock.calls[0][0].date)
  })

  it('lets an override key holder pick the kind and type a rate, and sends both', async () => {
    expect(PermissionKeys.OrdersUkraine.Order.OverrideSettlementRate).toBe('orders.ukraine.order.override_settlement_rate')
    auth.canOverride = true
    const { container } = await chooseAgreement()
    await waitFor(() => expect(within(rateLine()).getByText('НБУ 50,222 за 17.11.2026')).toBeTruthy())

    quoteApi.getSupplierSettlementRateQuote.mockResolvedValueOnce({ ...nbuQuote, Kind: 2, Rate: 51.2, Source: 'commercial' })
    select('Вид курсу', 'Комерційний')
    await waitFor(() => expect(within(rateLine()).getByText('Комерційний 51,2 за 17.11.2026')).toBeTruthy())
    expect(quoteApi.getSupplierSettlementRateQuote).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 2 }))

    fireEvent.change(screen.getByLabelText('Свій курс, за 1 EUR'), { target: { value: '51,5' } })
    expect(within(rateLine()).getByText('вручну 51,5')).toBeTruthy()
    fillImportAndSubmit(container)

    await waitFor(() => expect(api.uploadSupplyOrderUkraineFromSupplierFile).toHaveBeenCalledWith(
      expect.objectContaining({ orderUkraine: expect.objectContaining({ SettlementExchangeRate: 51.5, SettlementRateKind: 2 }) }),
    ))
  })

  it('drops the override when another agreement is chosen', async () => {
    auth.canOverride = true
    const second = { ...agreement, Agreement: { ...agreement.Agreement, Id: 31, Name: 'Другий', NetUid: 'agreement-2' }, Id: 21, NetUid: 'client-agreement-2' }
    api.getSupplyOrderCreateSuppliers.mockResolvedValue([{ ...supplier, ClientAgreements: [agreement, second] }])
    await chooseAgreement()
    select('Вид курсу', 'Комерційний')
    await waitFor(() => expect(quoteApi.getSupplierSettlementRateQuote).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 2 })))

    select('Договір', 'Другий · UAH')

    await waitFor(() => expect(quoteApi.getSupplierSettlementRateQuote).toHaveBeenLastCalledWith(expect.objectContaining({
      clientAgreementNetId: 'client-agreement-2',
      kind: null,
    })))
    expect((screen.getByRole('combobox', { name: 'Вид курсу' }) as HTMLInputElement).value).toBe('Як у договорі')
  })
})
