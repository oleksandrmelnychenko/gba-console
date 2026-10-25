import { documentaryDebtFixture, documentaryOverlayFixture, documentarySummaryFixture } from '../../../shared/debt/documentaryDebtAging.test-fixtures'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  calculateIncomeCashflowExchange,
  getIncomeCashflowClientAgreements,
  getIncomeCashflowClientDebtTotal,
  getIncomeCashflowOrganizations,
  getIncomeCashflowPaymentMovements,
  getIncomeCashflowSpecificExchangeRate,
  searchIncomeCashflowClientPayers,
  searchIncomeCashflowCounterpartiesForOperation,
  searchIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentRegisters,
} from '../api/incomeCashflowsApi'
import type {
  Client,
  ClientAgreement,
  Currency,
  OrganizationWithDefaults,
  PaymentMovement,
  PaymentRegister,
} from '../types'
import { PaymentRegisterType } from '../types'
import { IncomeCashflowClientFormPage } from './IncomeCashflowClientFormPage'

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: vi.fn(),
})

vi.mock('../api/incomeCashflowsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/incomeCashflowsApi')>(),
  calculateIncomeCashflowExchange: vi.fn(),
  getIncomeCashflowClientAgreements: vi.fn(),
  getIncomeCashflowClientDebtTotal: vi.fn(),
  getIncomeCashflowOrganizations: vi.fn(),
  getIncomeCashflowPaymentMovements: vi.fn(),
  getIncomeCashflowSpecificExchangeRate: vi.fn(),
  searchIncomeCashflowClientPayers: vi.fn(),
  searchIncomeCashflowCounterpartiesForOperation: vi.fn(),
  searchIncomeCashflowPaymentMovements: vi.fn(),
  searchIncomeCashflowPaymentRegisters: vi.fn(),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
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

vi.mock('../components/PaymentPurposeAutocomplete', () => ({
  PaymentPurposeAutocomplete: ({
    label,
    onChange,
    value,
  }: {
    label: string
    onChange: (value: string) => void
    value: string
  }) => (
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  ),
}))

const uah: Currency = {
  Code: 'UAH',
  Id: 100,
  NetUid: 'currency-uah',
}

const fenix: OrganizationWithDefaults = {
  Id: 10,
  Name: 'Fenix',
  NetUid: 'organization-fenix',
  PriceSourceIsAmg: false,
}

const amg: OrganizationWithDefaults = {
  Id: 20,
  Name: 'AMG',
  NetUid: 'organization-amg',
  PriceSourceIsAmg: true,
}

function createRegister(
  id: number,
  name: string,
  organization: OrganizationWithDefaults,
  type: number,
): PaymentRegister {
  return {
    Id: id,
    Name: name,
    NetUid: `register-${id}`,
    Organization: organization,
    OrganizationId: organization.Id,
    PaymentCurrencyRegisters: [{
      Id: id + 1000,
      Currency: uah,
      NetUid: `currency-register-${id}`,
    }],
    Type: type,
  }
}

const registers = [
  createRegister(1, 'Fenix каса', fenix, PaymentRegisterType.Cash),
  createRegister(2, 'Fenix банк', fenix, PaymentRegisterType.Bank),
  createRegister(3, 'AMG каса', amg, PaymentRegisterType.Cash),
  createRegister(4, 'AMG банк', amg, PaymentRegisterType.Bank),
]

const client: Client = {
  FullName: 'Клієнт з двома організаціями',
  Id: 200,
  NetUid: 'client-200',
}

function createAgreement(
  id: number,
  name: string,
  organization: OrganizationWithDefaults,
): ClientAgreement {
  return {
    AgreementId: id + 100,
    Id: id,
    NetUid: `client-agreement-${id}`,
    Agreement: {
      Currency: uah,
      Id: id + 100,
      Name: name,
      NetUid: `agreement-${id}`,
      Organization: organization,
      OrganizationId: organization.Id,
    },
  }
}

const agreements = [
  createAgreement(300, 'Fenix договір', fenix),
  createAgreement(400, 'AMG договір', amg),
]

const movement: PaymentMovement = {
  Id: 500,
  NetUid: 'movement-500',
  OperationName: 'Оплата покупця',
}

function renderPage(
  registerType: PaymentRegisterType = PaymentRegisterType.Cash,
) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter
          initialEntries={[
            `/accounting/income-cashflows/new/client?type=${registerType}&operationType=0`,
          ]}
        >
          <IncomeCashflowClientFormPage />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('IncomeCashflowClientFormPage payment dependencies', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getIncomeCashflowOrganizations).mockResolvedValue([fenix, amg])
    vi.mocked(searchIncomeCashflowPaymentRegisters).mockResolvedValue(registers)
    vi.mocked(getIncomeCashflowPaymentMovements).mockResolvedValue([movement])
    vi.mocked(searchIncomeCashflowPaymentMovements).mockResolvedValue([movement])
    vi.mocked(searchIncomeCashflowCounterpartiesForOperation).mockResolvedValue([client])
    vi.mocked(searchIncomeCashflowClientPayers).mockResolvedValue([])
    vi.mocked(getIncomeCashflowClientAgreements).mockResolvedValue(agreements)
    vi.mocked(getIncomeCashflowClientDebtTotal).mockResolvedValue(null)
    vi.mocked(getIncomeCashflowSpecificExchangeRate).mockResolvedValue(1)
    vi.mocked(calculateIncomeCashflowExchange).mockResolvedValue({
      ConvertedAmount: 0,
    })
  })

  it('uses documentary known zero for the displayed client-level debt and preserves payment selection', async () => {
    // jsdom has no layout; the real DataTable waits for a measured positive viewport.
    const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')?.get
      ?? Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')?.get
    const viewportWidth = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('data-table-scroll') ? 1100 : originalWidth?.call(this) ?? 0
    })
    onTestFinished(() => viewportWidth.mockRestore())

    const knownDebt = { Id: 81, DebtId: 41, AgreementId: 400, Debt: { Id: 41, Days: 999999, Total: 100 }, Sale: { Id: 31, SaleNumber: { Value: 'DOC-DAY-ZERO' } }, SaleId: 31 }
    const sourceClient = { ...client, ClientInDebts: [knownDebt] }
    const overlay = documentaryOverlayFixture({
      Debts: [documentaryDebtFixture({ ClientId: '200', AgreementId: '400' })],
      Agreements: [documentarySummaryFixture({ ClientId: '200', AgreementId: '400' })],
    })
    vi.mocked(searchIncomeCashflowCounterpartiesForOperation).mockResolvedValue([sourceClient])
    vi.mocked(getIncomeCashflowClientAgreements).mockResolvedValue([{ ...agreements[0], ClientId: 200, DocumentaryDebtAging: overlay }])
    renderPage()
    const organizationInput = await screen.findByRole<HTMLInputElement>('combobox', { name: 'Організація' })
    await waitFor(() => expect(organizationInput.disabled).toBe(false))
    fireEvent.change(screen.getByRole('combobox', { name: 'Контрагент' }), { target: { value: 'двома' } })
    fireEvent.click(await screen.findByRole('option', { name: client.FullName }))
    const dialog = screen.getByRole('dialog')
    const invoice = await within(dialog).findByRole('cell', { name: 'DOC-DAY-ZERO' })
    const table = invoice.closest('table')
    const row = invoice.closest('tr')
    expect(table).not.toBeNull()
    expect(row).not.toBeNull()
    expect(within(table!).getByRole('columnheader', { name: /Вік боргу, днів/ })).toBeTruthy()
    expect(within(row!).getByRole('cell', { name: '0' })).toBeTruthy()
    expect(within(row!).queryByText('999999')).toBeNull()
    const checkbox = within(row!).getByRole<HTMLInputElement>('checkbox', { name: 'Вибрати борг' })
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(true)
    expect(sourceClient.ClientInDebts[0].Debt.Days).toBe(999999)
  })

  it('places the company-resource organization beside the counterparty', async () => {
    renderPage()

    const organizationInput = await screen.findByRole<HTMLInputElement>(
      'combobox',
      { name: 'Організація' },
    )
    const counterpartyInput = screen.getByRole<HTMLInputElement>('combobox', {
      name: 'Контрагент',
    })

    await waitFor(() => expect(organizationInput.disabled).toBe(false))

    const primaryFields = organizationInput.closest(
      '.income-cashflow-client-form__primary-fields',
    )

    expect(getIncomeCashflowOrganizations).toHaveBeenCalledOnce()
    expect(primaryFields).not.toBeNull()
    expect(primaryFields?.contains(counterpartyInput)).toBe(true)
  })

  it('keeps the selected organization and exposes its agreement after selecting a counterparty', async () => {
    const user = userEvent.setup()
    renderPage()

    const organizationInput = await screen.findByRole<HTMLInputElement>(
      'combobox',
      { name: 'Організація' },
    )
    await waitFor(() => expect(organizationInput.disabled).toBe(false))

    await user.click(organizationInput)
    await user.click(
      await screen.findByRole('option', { hidden: true, name: amg.Name }),
    )

    expect(organizationInput.value).toBe(amg.Name)
    expect(
      screen.getByRole<HTMLInputElement>('combobox', {
        name: 'Каса / рахунок',
      }).value,
    ).toBe('AMG каса')

    const counterpartyInput = screen.getByRole<HTMLInputElement>('combobox', {
      name: 'Контрагент',
    })
    fireEvent.change(counterpartyInput, { target: { value: 'двома' } })

    await waitFor(() =>
      expect(searchIncomeCashflowCounterpartiesForOperation).toHaveBeenCalledWith(
        'двома',
        0,
        0,
        expect.any(AbortSignal),
      ),
    )
    fireEvent.click(
      await screen.findByRole('option', { name: client.FullName }),
    )

    await waitFor(() =>
      expect(getIncomeCashflowClientAgreements).toHaveBeenCalledWith(
        client.NetUid,
      ),
    )
    await waitFor(() => {
      expect(organizationInput.value).toBe(amg.Name)
      expect(
        screen.getByRole<HTMLInputElement>('combobox', { name: 'Договір' })
          .value,
      ).toBe('AMG договір UAH')
    })
  })

  it('shows only bank accounts for the selected organization in bank mode', async () => {
    const user = userEvent.setup()
    renderPage(PaymentRegisterType.Bank)

    const organizationInput = await screen.findByRole<HTMLInputElement>(
      'combobox',
      { name: 'Організація' },
    )
    await waitFor(() => expect(organizationInput.disabled).toBe(false))

    await user.click(organizationInput)
    await user.click(
      await screen.findByRole('option', { hidden: true, name: amg.Name }),
    )

    const registerInput = screen.getByRole<HTMLInputElement>('combobox', {
      name: 'Каса / рахунок',
    })
    expect(registerInput.value).toBe('AMG банк')

    fireEvent.click(registerInput)
    expect(
      screen.getByRole('option', { hidden: true, name: 'AMG банк' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('option', { hidden: true, name: 'AMG каса' }),
    ).toBeNull()
    expect(
      screen.queryByRole('option', { hidden: true, name: 'Fenix банк' }),
    ).toBeNull()
  })

  it('checks accounting automatically when the selected organization belongs to AMG', async () => {
    const user = userEvent.setup()
    renderPage()

    const organizationInput = await screen.findByRole<HTMLInputElement>(
      'combobox',
      { name: 'Організація' },
    )
    const accountingCheckbox = screen.getByRole<HTMLInputElement>('checkbox', {
      name: 'Бухгалтерський облік',
    })

    await waitFor(() => expect(organizationInput.disabled).toBe(false))
    expect(accountingCheckbox.checked).toBe(false)

    await user.click(organizationInput)
    await user.click(
      await screen.findByRole('option', { hidden: true, name: amg.Name }),
    )

    await waitFor(() => expect(accountingCheckbox.checked).toBe(true))
  })

  it('applies the AMG default on initial selection without locking the checkbox', async () => {
    vi.mocked(getIncomeCashflowOrganizations).mockResolvedValueOnce([amg, fenix])

    renderPage()

    const accountingCheckbox = await screen.findByRole<HTMLInputElement>(
      'checkbox',
      { name: 'Бухгалтерський облік' },
    )

    await waitFor(() => expect(accountingCheckbox.checked).toBe(true))
    fireEvent.click(accountingCheckbox)
    expect(accountingCheckbox.checked).toBe(false)
  })
})
