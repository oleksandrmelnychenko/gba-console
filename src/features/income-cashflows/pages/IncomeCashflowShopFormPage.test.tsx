import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  createIncomeCashflow,
  getIncomeCashflowPaymentMovements,
  getIncomeCashflowRetailClientAgreements,
  getIncomeCashflowRetailClients,
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

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: vi.fn(),
})

vi.mock('../api/incomeCashflowsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/incomeCashflowsApi')>(),
  createIncomeCashflow: vi.fn(),
  getIncomeCashflowPaymentMovements: vi.fn(),
  getIncomeCashflowRetailClientAgreements: vi.fn(),
  getIncomeCashflowRetailClients: vi.fn(),
  getIncomeCashflowSpecificExchangeRate: vi.fn(),
  searchIncomeCashflowPaymentMovements: vi.fn(),
  searchIncomeCashflowPaymentRegisters: vi.fn(),
  searchIncomeCashflowRetailClients: vi.fn(),
}))

vi.mock('../../../shared/ui/SearchableSelect', () => ({
  SearchableSelect: ({
    data = [],
    disabled,
    label,
    onChange,
    onOptionSubmit,
    value = '',
  }: {
    data?: Array<string | { label: string; value: string }>
    disabled?: boolean
    label?: string
    onChange?: (value: string) => void
    onOptionSubmit?: (value: string) => void
    value?: string
  }) => (
    <div>
      <input
        aria-label={label}
        disabled={disabled}
        role="combobox"
        value={value}
        onChange={(event) => onChange?.(event.currentTarget.value)}
      />
      {data.map((item) => {
        const option = typeof item === 'string'
          ? { label: item, value: item }
          : item

        return (
          <button
            key={option.value}
            role="option"
            type="button"
            onClick={() => {
              onChange?.(option.label)
              onOptionSubmit?.(option.value)
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  ),
}))

const organization = {
  Id: 10,
  Name: 'GBA Ukraine',
  NetUid: 'organization-10',
}
const secondOrganization = {
  Id: 11,
  Name: 'AMG Ukraine',
  NetUid: 'organization-11',
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
const secondOrganizationCashRegister: PaymentRegister = {
  Id: 31,
  Name: 'AMG каса',
  NetUid: 'register-31',
  Organization: secondOrganization,
  OrganizationId: secondOrganization.Id,
  PaymentCurrencyRegisters: [{
    Id: 41,
    Currency: currency,
    NetUid: 'currency-register-41',
  }],
  Type: 0,
}
const secondOrganizationBankRegister: PaymentRegister = {
  Id: 32,
  Name: 'AMG рахунок',
  NetUid: 'register-32',
  Organization: secondOrganization,
  OrganizationId: secondOrganization.Id,
  PaymentCurrencyRegisters: [{
    Id: 42,
    Currency: currency,
    NetUid: 'currency-register-42',
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
const shopClientVat: RetailClient = {
  Id: 61,
  Name: 'ShopClient VAT',
  NetUid: 'retail-client-61',
  PhoneNumber: '+380501234567',
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
const secondOrganizationFirstAgreement: ClientAgreement = {
  AgreementId: 71,
  Client: agreement.Client,
  Id: 91,
  NetUid: 'client-agreement-91',
  Agreement: {
    ClientInDebts: [],
    Currency: currency,
    Id: 71,
    Name: 'AMG перший договір',
    NetUid: 'agreement-71',
    Organization: secondOrganization,
    OrganizationId: secondOrganization.Id,
  },
}
const secondOrganizationDebtAgreement: ClientAgreement = {
  AgreementId: 72,
  Client: agreement.Client,
  Id: 92,
  NetUid: 'client-agreement-92',
  Agreement: {
    ClientInDebts: [{
      AgreementId: 72,
      Debt: { Id: 101, Total: 500 },
      Id: 102,
      NetUid: 'client-debt-102',
    }],
    Currency: currency,
    Id: 72,
    Name: 'AMG договір з боргом',
    NetUid: 'agreement-72',
    Organization: secondOrganization,
    OrganizationId: secondOrganization.Id,
  },
}
const retailClientLabel = `${retailClient.Name} ${retailClient.PhoneNumber}`
const shopClientVatLabel = `${shopClientVat.Name} ${shopClientVat.PhoneNumber}`

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
    vi.mocked(getIncomeCashflowRetailClients).mockResolvedValue([shopClientVat])
    vi.mocked(searchIncomeCashflowRetailClients).mockResolvedValue([retailClient])
    vi.mocked(getIncomeCashflowRetailClientAgreements).mockResolvedValue([agreement])
    vi.mocked(getIncomeCashflowSpecificExchangeRate).mockResolvedValue(1)
    vi.mocked(createIncomeCashflow).mockResolvedValue({ NetUid: 'income-1' })
  })

  it('shows the initial retail-client list before the user types', async () => {
    renderPage()

    expect(await screen.findByRole('option', { name: shopClientVatLabel })).toBeTruthy()
    expect(getIncomeCashflowRetailClients).toHaveBeenCalledOnce()
    expect(
      (screen.getByRole('combobox', { name: 'Retail-клієнт' }) as HTMLInputElement).disabled,
    ).toBe(false)
  })

  it('keeps the payment form usable when the optional initial client list fails', async () => {
    vi.mocked(getIncomeCashflowRetailClients).mockRejectedValueOnce(
      new Error('Retail clients unavailable'),
    )

    renderPage()

    await waitFor(() =>
      expect(
        (screen.getByRole('combobox', { name: 'Retail-клієнт' }) as HTMLInputElement).disabled,
      ).toBe(false),
    )
    expect(screen.queryByRole('alert')).toBeNull()
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
    fireEvent.click(await screen.findByRole('option', { name: retailClientLabel }))

    await waitFor(() =>
      expect(getIncomeCashflowRetailClientAgreements).toHaveBeenCalledWith(retailClient.NetUid),
    )
    await act(async () => {
      await vi.mocked(getIncomeCashflowRetailClientAgreements).mock.results.at(-1)?.value
    })

    const organizationInput = screen.getByRole<HTMLInputElement>('combobox', {
      name: 'Організація',
    })
    fireEvent.click(organizationInput)
    fireEvent.change(organizationInput, { target: { value: organization.Name } })
    fireEvent.click(await screen.findByRole('option', {
      hidden: true,
      name: organization.Name,
    }))

    await waitFor(() =>
      expect((screen.getByRole('combobox', { name: 'Договір' }) as HTMLInputElement).value)
        .toBe('Договір магазину UAH'),
    )

    const registerInput = screen.getByRole<HTMLInputElement>('combobox', {
      name: 'Каса / рахунок',
    })
    fireEvent.click(registerInput)
    fireEvent.click(await screen.findByRole('option', {
      hidden: true,
      name: register.Name,
    }))

    fireEvent.change(screen.getByRole('textbox', { name: 'Сума' }), {
      target: { value: '50000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(createIncomeCashflow).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Оберіть retail-клієнта')).toBeNull()
  })

  it('waits for the organization, selects its first agreement, and lets the user choose a matching register', async () => {
    vi.mocked(searchIncomeCashflowPaymentRegisters).mockResolvedValueOnce([
      register,
      secondOrganizationCashRegister,
      secondOrganizationBankRegister,
    ])
    vi.mocked(getIncomeCashflowRetailClientAgreements).mockResolvedValueOnce([
      agreement,
      secondOrganizationFirstAgreement,
      secondOrganizationDebtAgreement,
    ])

    renderPage()

    const retailClientInput = await screen.findByRole('combobox', {
      name: 'Retail-клієнт',
    })
    await waitFor(() => expect((retailClientInput as HTMLInputElement).disabled).toBe(false))

    fireEvent.change(retailClientInput, { target: { value: '380257' } })
    fireEvent.click(await screen.findByRole('option', { name: retailClientLabel }))

    const organizationInput = screen.getByRole<HTMLInputElement>('combobox', {
      name: 'Організація',
    })
    const agreementInput = screen.getByRole<HTMLInputElement>('combobox', {
      name: 'Договір',
    })
    const registerInput = screen.getByRole<HTMLInputElement>('combobox', {
      name: 'Каса / рахунок',
    })

    await waitFor(() => expect(organizationInput.disabled).toBe(false))
    expect(organizationInput.value).toBe('')
    expect(agreementInput.value).toBe('')
    expect(agreementInput.disabled).toBe(true)
    expect(registerInput.value).toBe('')
    expect(registerInput.disabled).toBe(true)

    fireEvent.click(organizationInput)
    fireEvent.change(organizationInput, {
      target: { value: secondOrganization.Name },
    })
    fireEvent.click(await screen.findByRole('option', {
      hidden: true,
      name: secondOrganization.Name,
    }))

    await waitFor(() => {
      expect(organizationInput.value).toBe(secondOrganization.Name)
      expect(agreementInput.value).toBe('AMG перший договір UAH')
      expect(registerInput.value).toBe('')
      expect(registerInput.disabled).toBe(false)
    })

    fireEvent.click(agreementInput)
    expect(screen.getByRole('option', {
      hidden: true,
      name: 'AMG перший договір UAH',
    })).toBeTruthy()
    expect(screen.getByRole('option', {
      hidden: true,
      name: 'AMG договір з боргом UAH',
    })).toBeTruthy()
    expect(screen.queryByRole('option', {
      hidden: true,
      name: 'Договір магазину UAH',
    })).toBeNull()

    fireEvent.click(registerInput)
    expect(screen.getByRole('option', {
      hidden: true,
      name: secondOrganizationCashRegister.Name,
    })).toBeTruthy()
    expect(screen.getByRole('option', {
      hidden: true,
      name: secondOrganizationBankRegister.Name,
    })).toBeTruthy()
    expect(screen.queryByRole('option', {
      hidden: true,
      name: register.Name,
    })).toBeNull()

    fireEvent.click(screen.getByRole('option', {
      hidden: true,
      name: secondOrganizationBankRegister.Name,
    }))
    expect(registerInput.value).toBe(secondOrganizationBankRegister.Name)

    fireEvent.click(agreementInput)
    fireEvent.click(screen.getByRole('option', {
      hidden: true,
      name: 'AMG договір з боргом UAH',
    }))
    expect(agreementInput.value).toBe('AMG договір з боргом UAH')
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
