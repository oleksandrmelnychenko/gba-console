import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  createIncomeCashflow,
  getIncomeCashflowClientAgreements,
  getIncomeCashflowClientDebtTotal,
  getIncomeCashflowOrganizations,
  getIncomeCashflowPaymentMovements,
  getIncomeCashflowSpecificExchangeRate,
  searchIncomeCashflowCounterparties,
  searchIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentRegisters,
} from '../api/incomeCashflowsApi'
import type {
  Client,
  ClientAgreement,
  ClientInDebt,
  OrganizationWithDefaults,
  PaymentMovement,
  PaymentRegister,
} from '../types'
import { PaymentRegisterType } from '../types'
import { IncomeCashflowClientFormPage } from './IncomeCashflowClientFormPage'

vi.mock('../api/incomeCashflowsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/incomeCashflowsApi')>(),
  createIncomeCashflow: vi.fn(),
  getIncomeCashflowClientAgreements: vi.fn(),
  getIncomeCashflowClientDebtTotal: vi.fn(),
  getIncomeCashflowOrganizations: vi.fn(),
  getIncomeCashflowPaymentMovements: vi.fn(),
  getIncomeCashflowSpecificExchangeRate: vi.fn(),
  searchIncomeCashflowCounterparties: vi.fn(),
  searchIncomeCashflowPaymentMovements: vi.fn(),
  searchIncomeCashflowPaymentRegisters: vi.fn(),
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
            onClick={() => onOptionSubmit?.(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  ),
}))

const organization: OrganizationWithDefaults = {
  Id: 10,
  Name: 'AMG',
  NetUid: 'organization-10',
}
const currency = {
  Code: 'UAH',
  Id: 20,
  Name: 'Гривня',
  NetUid: 'currency-20',
}
const register: PaymentRegister = {
  Id: 30,
  Name: 'Основна каса',
  NetUid: 'register-30',
  Organization: organization,
  OrganizationId: organization.Id,
  PaymentCurrencyRegisters: [{
    Id: 40,
    Currency: currency,
    NetUid: 'currency-register-40',
  }],
  Type: PaymentRegisterType.Cash,
}
const movement: PaymentMovement = {
  Id: 50,
  NetUid: 'movement-50',
  OperationName: 'Оплата покупця',
}
const client: Client = {
  FullName: 'ФОП Тестовий клієнт',
  Id: 60,
  NetUid: 'client-60',
}
const debt: ClientInDebt = {
  Agreement: {
    Id: 70,
    OrganizationId: organization.Id,
  },
  AgreementId: 70,
  Debt: {
    Days: 3,
    Total: 9533.39,
  },
  NetUid: 'debt-80',
  Sale: {
    Id: 80,
    NetUid: 'sale-80',
    SaleNumber: { Value: 'SALE-80' },
  },
  SaleId: 80,
}
const agreement: ClientAgreement = {
  Agreement: {
    ClientInDebts: [debt],
    Currency: currency,
    Id: 70,
    Name: 'Основний договір UAH',
    NetUid: 'agreement-70',
    Organization: organization,
    OrganizationId: organization.Id,
  },
  AgreementId: 70,
  Id: 90,
  NetUid: 'client-agreement-90',
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter
          initialEntries={[
            '/accounting/income-cashflows/new/client?type=0&operationType=0',
          ]}
        >
          <IncomeCashflowClientFormPage />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('IncomeCashflowClientFormPage automatic debt allocation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getIncomeCashflowOrganizations).mockResolvedValue([organization])
    vi.mocked(searchIncomeCashflowPaymentRegisters).mockResolvedValue([register])
    vi.mocked(getIncomeCashflowPaymentMovements).mockResolvedValue([movement])
    vi.mocked(searchIncomeCashflowPaymentMovements).mockResolvedValue([movement])
    vi.mocked(searchIncomeCashflowCounterparties).mockResolvedValue([client])
    vi.mocked(getIncomeCashflowClientAgreements).mockResolvedValue([agreement])
    vi.mocked(getIncomeCashflowClientDebtTotal).mockResolvedValue({
      TotalLocal: 9533.39,
    })
    vi.mocked(getIncomeCashflowSpecificExchangeRate).mockResolvedValue(1)
    vi.mocked(createIncomeCashflow).mockResolvedValue(null)
  })

  it('checks automatic debt allocation by default for a customer payment and allows opting out', async () => {
    renderPage()

    const counterpartyInput = await screen.findByRole('combobox', {
      name: 'Контрагент',
    })
    await waitFor(() =>
      expect((counterpartyInput as HTMLInputElement).disabled).toBe(false),
    )

    fireEvent.change(counterpartyInput, {
      target: { value: client.FullName },
    })
    await waitFor(() =>
      expect(searchIncomeCashflowCounterparties).toHaveBeenCalledWith(
        client.FullName,
        0,
        expect.any(AbortSignal),
      ),
    )
    fireEvent.click(
      await screen.findByRole('option', { name: client.FullName }),
    )

    const autoAllocate = await screen.findByRole('checkbox', {
      name: 'Автоматично рознести оплату по боргах',
    })
    expect((autoAllocate as HTMLInputElement).checked).toBe(true)

    fireEvent.click(autoAllocate)
    expect((autoAllocate as HTMLInputElement).checked).toBe(false)
  })

  it('requires an explicit confirmation before creating the payment', async () => {
    renderPage()

    const counterpartyInput = await screen.findByRole('combobox', {
      name: 'Контрагент',
    })
    await waitFor(() =>
      expect((counterpartyInput as HTMLInputElement).disabled).toBe(false),
    )

    fireEvent.change(counterpartyInput, {
      target: { value: client.FullName },
    })
    await waitFor(() =>
      expect(searchIncomeCashflowCounterparties).toHaveBeenCalled(),
    )
    fireEvent.click(
      await screen.findByRole('option', { name: client.FullName }),
    )
    await waitFor(() =>
      expect(getIncomeCashflowClientAgreements).toHaveBeenCalledWith(
        client.NetUid,
      ),
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Сума' }), {
      target: { value: '1250' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(createIncomeCashflow).not.toHaveBeenCalled()
    expect(
      await screen.findByRole('dialog', {
        name: 'Підтвердити створення прибуткового ордера',
      }),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
    expect(createIncomeCashflow).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Підтвердити' }))

    await waitFor(() => expect(createIncomeCashflow).toHaveBeenCalledOnce())
    expect(createIncomeCashflow).toHaveBeenCalledWith(
      expect.objectContaining({
        Amount: 1250,
        Client: expect.objectContaining({ NetUid: client.NetUid }),
        ClientAgreement: expect.objectContaining({
          NetUid: agreement.NetUid,
        }),
      }),
      true,
    )
  })
})
