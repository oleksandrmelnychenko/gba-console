import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { OutgoingPaymentGroupForm } from './OutgoingPaymentGroupForm'

const incomeApi = vi.hoisted(() => ({
  getIncomeCashflowClientAgreements: vi.fn(),
  getIncomeCashflowOrganizations: vi.fn(),
  getIncomeCashflowPaymentMovements: vi.fn(),
  getIncomeCashflowSpecificExchangeRate: vi.fn(),
  getIncomeCashflowSupplyOrganizationAgreements: vi.fn(),
  searchIncomeCashflowPaymentMovements: vi.fn(),
  searchIncomeCashflowPaymentRegisters: vi.fn(),
  searchOutgoingCashflowCounterparties: vi.fn(),
}))
const createApi = vi.hoisted(() => ({
  createOutgoingCashflowOrder: vi.fn(),
  createOutgoingCreatePaymentMovement: vi.fn(),
}))
const quoteApi = vi.hoisted(() => ({ getSupplierSettlementRateQuote: vi.fn() }))
const auth = vi.hoisted(() => ({ canOverride: false }))

vi.mock('../../income-cashflows/api/incomeCashflowsApi', () => incomeApi)
vi.mock('../api/outgoingCashflowCreateApi', () => createApi)
vi.mock('../../consumable-orders/api/consumableOrdersApi', () => ({
  getUnpaidConsumableOrdersByOrganization: vi.fn().mockResolvedValue([]),
}))
vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (key: string) => key !== 'accounting.outgoing_cashflows.order.override_settlement_rate' || auth.canOverride,
  }),
}))
vi.mock('../../../shared/settlement-rate/supplierSettlementRate', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../shared/settlement-rate/supplierSettlementRate')>(),
  getSupplierSettlementRateQuote: quoteApi.getSupplierSettlementRateQuote,
}))
vi.mock('../../../shared/ui/SearchableSelect', () => ({
  SearchableSelect: ({
    data = [],
    label,
    onChange,
    onOptionSubmit,
    value = '',
  }: {
    data?: Array<string | { label: string, value: string }>
    label?: string
    onChange?: (value: string) => void
    onOptionSubmit?: (value: string) => void
    value?: string
  }) => (
    <div>
      <input aria-label={label} role="combobox" value={value} onChange={(event) => onChange?.(event.currentTarget.value)} />
      {data.map((item) => {
        const option = typeof item === 'string' ? { label: item, value: item } : item

        return (
          <button key={option.value} role="option" type="button" onClick={() => onOptionSubmit?.(option.value)}>
            {option.label}
          </button>
        )
      })}
    </div>
  ),
}))

const organization = { Id: 10, Name: 'Фенікс', NetUid: 'organization-1' }
const usd = { Code: 'USD', Id: 3, NetUid: 'currency-usd' }
const register = {
  Id: 71,
  IsMain: true,
  Name: 'Рахунок USD',
  NetUid: 'register-1',
  Organization: organization,
  OrganizationId: 10,
  PaymentCurrencyRegisters: [{ Amount: 1000, Currency: usd, Id: 41, NetUid: 'currency-register-1' }],
  Type: 2,
}
const clientAgreement = {
  Agreement: { Currency: { Code: 'UAH', Id: 2, NetUid: 'currency-uah' }, Id: 30, Name: 'Договір UAH', NetUid: 'agreement-1', OrganizationId: 10 },
  Id: 20,
  NetUid: 'client-agreement-1',
}
const manufacturer = { Id: 40, Name: 'Виробник QA', NetUid: 'manufacturer-1' }
const commercialQuote = { CurrencyCode: 'USD', DefaultKind: 2, Kind: 2, Rate: 1.08, RateDate: '2026-11-18T10:00:00', Source: 'commercial_cross' }

function renderForm() {
  return render(
    <MantineProvider env="test">
      <I18nProvider>
        <MemoryRouter initialEntries={['/accounting/outgoing-cashflow/new/group?operationType=5&type=2']}>
          <OutgoingPaymentGroupForm onCancel={vi.fn()} onCreated={vi.fn()} onTitleChange={vi.fn()} />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

async function chooseManufacturer() {
  const view = renderForm()
  await waitFor(() => expect(incomeApi.searchIncomeCashflowPaymentRegisters).toHaveBeenCalled())
  fireEvent.click(await screen.findByText('Виробники'))
  fireEvent.change(screen.getByRole('combobox', { name: 'Отримувач' }), { target: { value: 'Виробник' } })
  fireEvent.click(await screen.findByRole('option', { name: 'Виробник QA' }))
  await waitFor(() => expect(incomeApi.getIncomeCashflowClientAgreements).toHaveBeenCalledWith('manufacturer-1', 'outgoing-create'))
  return view
}

function rateLine() {
  return screen.getByTestId('supplier-settlement-rate-line')
}

async function fillAndSubmit() {
  fireEvent.click(screen.getByRole('option', { name: 'Оплата постачальнику' }))
  fireEvent.change(screen.getAllByLabelText(/^Сума/)[0], { target: { value: '540' } })
  fireEvent.submit(document.getElementById('outgoing-payment-group-form')!)
  await waitFor(() => expect(createApi.createOutgoingCashflowOrder).toHaveBeenCalled())
  return createApi.createOutgoingCashflowOrder.mock.calls[0][0]
}

describe('supplier payment «Курс у EUR»', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.canOverride = false
    Element.prototype.scrollIntoView = vi.fn()
    incomeApi.getIncomeCashflowOrganizations.mockResolvedValue([organization])
    incomeApi.searchIncomeCashflowPaymentRegisters.mockResolvedValue([register])
    incomeApi.getIncomeCashflowPaymentMovements.mockResolvedValue([{ Id: 51, NetUid: 'movement-1', OperationName: 'Оплата постачальнику' }])
    incomeApi.searchIncomeCashflowPaymentMovements.mockResolvedValue([])
    incomeApi.getIncomeCashflowSpecificExchangeRate.mockResolvedValue(0)
    incomeApi.searchOutgoingCashflowCounterparties.mockResolvedValue([manufacturer])
    incomeApi.getIncomeCashflowClientAgreements.mockResolvedValue([clientAgreement])
    createApi.createOutgoingCashflowOrder.mockResolvedValue({ NetUid: 'outcome-1' })
    quoteApi.getSupplierSettlementRateQuote.mockResolvedValue(commercialQuote)
  })

  it('quotes the payment rate in the register currency for the payment date, read-only without the key', async () => {
    await chooseManufacturer()

    await waitFor(() => expect(within(rateLine()).getByText('Комерційний 1,08 за 18.11.2026')).toBeTruthy())
    expect(within(rateLine()).getByText('Курс у EUR:')).toBeTruthy()
    expect(quoteApi.getSupplierSettlementRateQuote).toHaveBeenCalledWith(expect.objectContaining({
      clientAgreementNetId: 'client-agreement-1',
      currencyNetId: 'currency-usd',
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/),
      document: 'payment',
      kind: null,
    }))
    expect(screen.queryByRole('combobox', { name: 'Вид курсу' })).toBeNull()

    const payload = await fillAndSubmit()
    expect(payload).not.toHaveProperty('EuroRateKind')
    expect(payload).not.toHaveProperty('EuroExchangeRate')
    expect(payload.FromDate).toBe(quoteApi.getSupplierSettlementRateQuote.mock.calls[0][0].date)
  })

  it('quotes again when the payment date changes', async () => {
    await chooseManufacturer()
    await waitFor(() => expect(within(rateLine()).getByText('Комерційний 1,08 за 18.11.2026')).toBeTruthy())

    quoteApi.getSupplierSettlementRateQuote.mockResolvedValueOnce({ ...commercialQuote, Rate: 1.1, RateDate: '2026-11-10T10:00:00' })
    fireEvent.change(screen.getByLabelText(/^Час/), { target: { value: '09:15' } })

    await waitFor(() => expect(within(rateLine()).getByText('Комерційний 1,1 за 10.11.2026')).toBeTruthy())
    expect(quoteApi.getSupplierSettlementRateQuote).toHaveBeenLastCalledWith(expect.objectContaining({
      date: expect.stringMatching(/T09:15:00$/),
    }))
  })

  it('lets an override key holder choose the kind and a rate, and sends EuroRateKind / EuroExchangeRate', async () => {
    auth.canOverride = true
    await chooseManufacturer()
    await waitFor(() => expect(within(rateLine()).getByText('Комерційний 1,08 за 18.11.2026')).toBeTruthy())

    quoteApi.getSupplierSettlementRateQuote.mockResolvedValueOnce({ ...commercialQuote, Kind: 1, Rate: 1.07, Source: 'nbu_cross' })
    fireEvent.click(screen.getByRole('combobox', { name: 'Вид курсу' }))
    fireEvent.click(screen.getByRole('option', { name: 'НБУ' }))
    await waitFor(() => expect(within(rateLine()).getByText('НБУ 1,07 за 18.11.2026')).toBeTruthy())
    expect(quoteApi.getSupplierSettlementRateQuote).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 1 }))
    fireEvent.change(screen.getByLabelText('Свій курс, за 1 EUR'), { target: { value: '1,075' } })

    const payload = await fillAndSubmit()
    expect(payload).toMatchObject({
      ClientAgreement: clientAgreement,
      EuroExchangeRate: 1.075,
      EuroRateKind: 1,
      OperationType: 5,
    })
  })

  it('drops a chosen rate when the payment currency changes, so an EUR payment sends none', async () => {
    auth.canOverride = true
    const eur = { Code: 'EUR', Id: 1, NetUid: 'currency-eur' }
    incomeApi.searchIncomeCashflowPaymentRegisters.mockResolvedValue([{
      ...register,
      PaymentCurrencyRegisters: [...register.PaymentCurrencyRegisters, { Amount: 500, Currency: eur, Id: 42, NetUid: 'currency-register-2' }],
    }])
    await chooseManufacturer()
    await waitFor(() => expect(within(rateLine()).getByText('Комерційний 1,08 за 18.11.2026')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Свій курс, за 1 EUR'), { target: { value: '1,075' } })
    expect(within(rateLine()).getByText('вручну 1,075')).toBeTruthy()

    quoteApi.getSupplierSettlementRateQuote.mockResolvedValue({ ...commercialQuote, CurrencyCode: 'EUR', Rate: 1, Source: 'eur' })
    fireEvent.click(screen.getByRole('combobox', { name: /^Валюта/ }))
    fireEvent.click(screen.getByRole('option', { name: /^EUR/ }))
    await waitFor(() => expect(within(rateLine()).getByText('EUR — без перерахунку')).toBeTruthy())
    expect(screen.queryByLabelText('Свій курс, за 1 EUR')).toBeNull()

    const payload = await fillAndSubmit()
    expect(payload).not.toHaveProperty('EuroRateKind')
    expect(payload).not.toHaveProperty('EuroExchangeRate')
  })

  it('shows nothing for a payment to a service supplier', async () => {
    renderForm()
    await waitFor(() => expect(incomeApi.searchIncomeCashflowPaymentRegisters).toHaveBeenCalled())

    expect(screen.queryByTestId('supplier-settlement-rate-line')).toBeNull()
    expect(quoteApi.getSupplierSettlementRateQuote).not.toHaveBeenCalled()
  })
})
