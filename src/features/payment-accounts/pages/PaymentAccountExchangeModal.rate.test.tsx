import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createPaymentAccountExchange } from '../api/paymentAccountsApi'
import type { PaymentAccount } from '../types'
import { PaymentRegisterType } from '../types'
import { PaymentAccountExchangeModal } from './PaymentAccountFormPage'

vi.mock('../api/paymentAccountsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/paymentAccountsApi')>(),
  calculatePaymentAccountExchange: vi.fn().mockResolvedValue(0),
  createPaymentAccountExchange: vi.fn().mockResolvedValue(null),
  getPaymentAccountCurrencyTraders: vi.fn().mockResolvedValue([]),
  getPaymentAccountPaymentMovements: vi.fn().mockResolvedValue([{ NetUid: 'movement-1', OperationName: 'Конвертація валюти' }]),
  getPaymentAccountSystemExchangeRates: vi.fn().mockResolvedValue([{ Code: 'USD', Amount: 46.2 }, { Code: 'EUR', Amount: 51.2 }]),
  getPaymentAccountsByBank: vi.fn().mockResolvedValue([]),
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

async function findRateInput(): Promise<HTMLInputElement> {
  await screen.findAllByLabelText(/^Курс/)
  return screen.getAllByLabelText(/^Курс/).find((element) => element.getAttribute('inputmode') === 'decimal') as HTMLInputElement
}

function renderModal() {
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
}

describe('exchange dialog rate (currency#9)', () => {
  it('offers the system rate instead of an empty field', async () => {
    renderModal()

    const rate = await findRateInput()
    await waitFor(() => expect(rate.value).toBe('51,2'))
    expect(screen.getByText('Системний: 51,2')).toBeTruthy()
  })

  it('asks to confirm a rate more than 20% away from the system rate before saving', async () => {
    renderModal()

    const rate = await findRateInput()
    await waitFor(() => expect(rate.value).toBe('51,2'))
    fireEvent.change(screen.getByLabelText(/^Сума/), { target: { value: '10' } })
    fireEvent.change(rate, { target: { value: '99999999999' } })
    fireEvent.click(screen.getByRole('button', { name: /Зберегти|Створити/ }))

    expect(await screen.findByText(/відрізняється від системного 51,2 більш ніж на 20%/)).toBeTruthy()
    expect(createPaymentAccountExchange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Зберегти|Створити/ }))
    await waitFor(() => expect(createPaymentAccountExchange).toHaveBeenCalledTimes(1))
  })
})
