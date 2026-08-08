import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  createIncomeCashflow,
  getIncomeCashflowPaymentMovements,
  getIncomeCashflowRetailClientAgreements,
  getIncomeCashflowSpecificExchangeRate,
  searchIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentRegisters,
  searchIncomeCashflowRetailClients,
} from '../api/incomeCashflowsApi'
import type {
  ClientAgreement,
  PaymentMovement,
  PaymentRegister,
  RetailClient,
} from '../types'
import { IncomeCashflowShopFormPage } from './IncomeCashflowShopFormPage'

vi.mock('../api/incomeCashflowsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/incomeCashflowsApi')>(),
  createIncomeCashflow: vi.fn(),
  getIncomeCashflowPaymentMovements: vi.fn(),
  getIncomeCashflowRetailClientAgreements: vi.fn(),
  getIncomeCashflowSpecificExchangeRate: vi.fn(),
  searchIncomeCashflowPaymentMovements: vi.fn(),
  searchIncomeCashflowPaymentRegisters: vi.fn(),
  searchIncomeCashflowRetailClients: vi.fn(),
}))

const organization = {
  Id: 10,
  Name: 'GBA Ukraine',
  NetUid: 'organization-10',
}
const currency = {
  Code: 'UAH',
  Id: 20,
  NetUid: 'currency-20',
}
const register: PaymentRegister = {
  Id: 30,
  Name: 'Основний рахунок',
  NetUid: 'register-30',
  Organization: organization,
  OrganizationId: organization.Id,
  PaymentCurrencyRegisters: [{
    Id: 40,
    Currency: currency,
    NetUid: 'currency-register-40',
  }],
  Type: 1,
}
const movement: PaymentMovement = {
  Id: 50,
  NetUid: 'movement-50',
  OperationName: 'Оплата покупця',
}
const retailClient: RetailClient = {
  Id: 60,
  Name: 'Uliana QA Engineer Muliar',
  NetUid: 'retail-client-60',
  PhoneNumber: '+380257899548',
}
const agreement: ClientAgreement = {
  AgreementId: 70,
  Client: {
    FullName: 'Інтернет-магазин GBA',
    Id: 80,
    NetUid: 'client-80',
  },
  Id: 90,
  NetUid: 'client-agreement-90',
  Agreement: {
    ClientInDebts: [],
    Currency: currency,
    Id: 70,
    Name: 'Договір магазину',
    NetUid: 'agreement-70',
    Organization: organization,
    OrganizationId: organization.Id,
  },
}
const retailClientLabel = `${retailClient.Name} ${retailClient.PhoneNumber}`

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/accounting/income-cashflows/new/shop']}>
          <IncomeCashflowShopFormPage />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('IncomeCashflowShopFormPage retail client selection', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(searchIncomeCashflowPaymentRegisters).mockResolvedValue([register])
    vi.mocked(getIncomeCashflowPaymentMovements).mockResolvedValue([movement])
    vi.mocked(searchIncomeCashflowPaymentMovements).mockResolvedValue([movement])
    vi.mocked(searchIncomeCashflowRetailClients).mockResolvedValue([retailClient])
    vi.mocked(getIncomeCashflowRetailClientAgreements).mockResolvedValue([agreement])
    vi.mocked(getIncomeCashflowSpecificExchangeRate).mockResolvedValue(1)
    vi.mocked(createIncomeCashflow).mockResolvedValue({ NetUid: 'income-1' })
  })

  it('keeps a selected retail client and allows saving when its agreement has no debts', async () => {
    renderPage()

    const retailClientInput = await screen.findByRole('combobox', {
      name: 'Retail-клієнт',
    })
    await waitFor(() => expect((retailClientInput as HTMLInputElement).disabled).toBe(false))

    fireEvent.change(retailClientInput, { target: { value: '380257' } })
    await waitFor(() =>
      expect(searchIncomeCashflowRetailClients).toHaveBeenCalledWith('380257'),
    )
    fireEvent.click(await screen.findByText(retailClientLabel))

    await waitFor(() =>
      expect(screen.getAllByText('Інтернет-магазин GBA').length).toBeGreaterThan(0),
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Сума' }), {
      target: { value: '50000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(createIncomeCashflow).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Оберіть retail-клієнта')).toBeNull()
  })

  it('does not save free text that was not selected as a retail client', async () => {
    renderPage()

    const retailClientInput = await screen.findByRole('combobox', {
      name: 'Retail-клієнт',
    })
    await waitFor(() => expect((retailClientInput as HTMLInputElement).disabled).toBe(false))

    fireEvent.change(retailClientInput, { target: { value: 'невідомий клієнт' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Сума' }), {
      target: { value: '50000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(await screen.findByText('Оберіть retail-клієнта')).toBeTruthy()
    expect(createIncomeCashflow).not.toHaveBeenCalled()
  })
})
