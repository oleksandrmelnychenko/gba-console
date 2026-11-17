import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { PaymentAccount } from '../types'
import { PaymentRegisterType } from '../types'
import { PaymentAccountExchangeModal } from './PaymentAccountFormPage'

vi.mock('../api/paymentAccountsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/paymentAccountsApi')>(),
  getPaymentAccountsByBank: vi.fn().mockResolvedValue([]),
  getPaymentAccountPaymentMovements: vi.fn().mockResolvedValue([]),
  // Traders exist, but none has a rate: the picker has nothing to offer.
  getPaymentAccountCurrencyTraders: vi.fn().mockResolvedValue([
    { NetUid: 'trader-1', FirstName: 'Іван', LastName: 'Трейдер', CurrencyTraderExchangeRates: [] },
  ]),
}))

function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider>
      <I18nProvider>{children}</I18nProvider>
    </MantineProvider>
  )
}

const account: PaymentAccount = {
  Name: 'Мультивалютний рахунок',
  NetUid: 'account-1',
  Type: PaymentRegisterType.Bank,
  PaymentCurrencyRegisters: [
    { NetUid: 'register-uah', Amount: 1000, Currency: { Code: 'UAH', NetUid: 'uah', Id: 1 } },
    { NetUid: 'register-eur', Amount: 10, Currency: { Code: 'EUR', NetUid: 'eur', Id: 2 } },
  ],
} as PaymentAccount

describe('exchange dialog trader rates', () => {
  it('says that no trader has a rate instead of opening an empty picker', async () => {
    render(
      <Providers>
        <PaymentAccountExchangeModal
          account={account}
          canCreate
          opened
          onClose={vi.fn()}
          onMutationComplete={vi.fn().mockResolvedValue(undefined)}
        />
      </Providers>,
    )

    expect(await screen.findByText('Немає трейдерів з курсом для цієї валюти — введіть курс вручну')).toBeTruthy()
  })
})
