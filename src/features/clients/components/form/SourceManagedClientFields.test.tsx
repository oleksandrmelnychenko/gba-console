import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { theme } from '../../../../shared/theme/theme'
import type { Client, Currency } from '../../types'
import { BankDetailsFields } from './BankDetailsFields'
import { ContactInfoFields } from './ContactInfoFields'
import { GeneralInfoFields, type ClientFormRole } from './GeneralInfoFields'

const role: ClientFormRole = {
  isBuyer: true,
  isProvider: false,
  isSubClient: false,
}

describe('source-managed client fields', () => {
  it('locks 1C-owned identity, contact and bank fields but keeps local bank metadata editable', () => {
    const currency = { Id: 1, Name: 'UAH' } as Currency
    const client = {
      FullName: 'ТОВ МАГРОМ',
      Name: 'МАГРОМ ТОВ',
      USREOU: '37263688',
      EmailAddress: 'super_truckshop@ukr.net',
      ClientNumber: '(067) 262-60-01',
      ClientBankDetails: {
        BankAndBranch: 'АТ Тест Банк',
        AccountNumber: { AccountNumber: '260000000001', Currency: currency },
        ClientBankDetailIbanNo: { IBANNO: 'UA123456789', Currency: currency },
        Swift: 'TESTUAUK',
        BranchCode: '001',
        BankAddress: 'Хмельницький',
      },
    } as Client

    render(
      <MantineProvider env="test" theme={theme}>
        <I18nProvider>
          <GeneralInfoFields
            client={client}
            countries={[]}
            incoterms={[]}
            packingMarkings={[]}
            packingMarkingPayments={[]}
            regions={[]}
            role={role}
            sourceManaged
            onAddDocuments={vi.fn()}
            onChange={vi.fn()}
            onCreateCountry={vi.fn()}
            onCreateIncoterm={vi.fn()}
            onCreateRegion={vi.fn()}
            onRegionChange={vi.fn()}
            onRegionCodeFieldChange={vi.fn()}
            onRemoveDocument={vi.fn()}
            onSaveDocuments={vi.fn()}
          />
          <ContactInfoFields client={client} role={role} sourceManaged onChange={vi.fn()} />
          <BankDetailsFields
            client={client}
            currencies={[currency]}
            sourceManaged
            onAccountNumberChange={vi.fn()}
            onAccountNumberCurrencyChange={vi.fn()}
            onBankFieldChange={vi.fn()}
            onIbanNumberChange={vi.fn()}
            onIbanNumberCurrencyChange={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    for (const label of ['Повна назва', 'Назва', 'ЄДРПОУ', 'Email', 'Телефон', 'Банк та відділення', 'Номер рахунку', 'IBAN']) {
      expect((screen.getByLabelText(label) as HTMLInputElement).disabled).toBe(true)
    }
    for (const label of ['SWIFT', 'Код відділення', 'Адреса банку']) {
      expect((screen.getByLabelText(label) as HTMLInputElement).disabled).toBe(false)
    }
  })

  it('unlocks source-owned fields after an explicit manual override', () => {
    const currency = { Id: 1, Name: 'UAH' } as Currency
    const tradePointRole = { ...role, isSubClient: true }
    const client = {
      FullName: 'ТОВ МАГРОМ',
      Name: 'МАГРОМ ТОВ',
      USREOU: '37263688',
      EmailAddress: 'super_truckshop@ukr.net',
      ClientNumber: '(067) 262-60-01',
      IsSubClient: false,
      IsTradePoint: true,
      ClientBankDetails: {
        BankAndBranch: 'АТ Тест Банк',
        AccountNumber: { AccountNumber: '260000000001', Currency: currency },
        ClientBankDetailIbanNo: { IBANNO: 'UA123456789', Currency: currency },
      },
    } as Client

    render(
      <MantineProvider env="test" theme={theme}>
        <I18nProvider>
          <GeneralInfoFields
            client={client}
            countries={[]}
            incoterms={[]}
            packingMarkings={[]}
            packingMarkingPayments={[]}
            regions={[]}
            role={tradePointRole}
            sourceManaged={false}
            sourceStructureManaged
            onAddDocuments={vi.fn()}
            onChange={vi.fn()}
            onCreateCountry={vi.fn()}
            onCreateIncoterm={vi.fn()}
            onCreateRegion={vi.fn()}
            onRegionChange={vi.fn()}
            onRegionCodeFieldChange={vi.fn()}
            onRemoveDocument={vi.fn()}
            onSaveDocuments={vi.fn()}
          />
          <ContactInfoFields client={client} role={role} sourceManaged={false} onChange={vi.fn()} />
          <BankDetailsFields
            client={client}
            currencies={[currency]}
            sourceManaged={false}
            onAccountNumberChange={vi.fn()}
            onAccountNumberCurrencyChange={vi.fn()}
            onBankFieldChange={vi.fn()}
            onIbanNumberChange={vi.fn()}
            onIbanNumberCurrencyChange={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    for (const label of ['Повна назва', 'Назва', 'ЄДРПОУ', 'Email', 'Телефон', 'Банк та відділення', 'Номер рахунку', 'IBAN']) {
      expect((screen.getByLabelText(label) as HTMLInputElement).disabled).toBe(false)
    }
    expect((screen.getByLabelText('Торгова точка') as HTMLInputElement).disabled).toBe(true)
  })
})
