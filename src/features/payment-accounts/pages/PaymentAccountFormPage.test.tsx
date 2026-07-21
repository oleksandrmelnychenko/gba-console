import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  calculatePaymentAccountExchange,
  getPaymentAccountPaymentMovements,
  getPaymentAccounts,
  getPaymentAccountsByBank,
} from '../api/paymentAccountsApi'
import type { PaymentAccount } from '../types'
import { PaymentRegisterType } from '../types'
import { PaymentAccountExchangeModal, PaymentAccountTransferModal } from './PaymentAccountFormPage'

vi.mock('../api/paymentAccountsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/paymentAccountsApi')>(),
  calculatePaymentAccountExchange: vi.fn(),
  getPaymentAccountPaymentMovements: vi.fn(),
  getPaymentAccounts: vi.fn(),
  getPaymentAccountsByBank: vi.fn(),
}))

const account: PaymentAccount = {
  Name: 'Основний рахунок',
  NetUid: 'account-1',
  Type: PaymentRegisterType.Bank,
  PaymentCurrencyRegisters: [
    {
      Currency: { Code: 'USD', Name: 'Долар США', NetUid: 'currency-usd' },
      NetUid: 'register-usd',
    },
    {
      Currency: { Code: 'EUR', Name: 'Євро', NetUid: 'currency-eur' },
      NetUid: 'register-eur',
    },
  ],
}

function renderModal(component: ReactNode) {
  return render(
    <StrictMode>
      <MantineProvider>
        <I18nProvider>{component}</I18nProvider>
      </MantineProvider>
    </StrictMode>,
  )
}

describe('PaymentAccount transfer and exchange inputs', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getPaymentAccounts).mockResolvedValue({ paymentRegisters: [account], totalEuroAmount: 0 })
    vi.mocked(getPaymentAccountsByBank).mockResolvedValue([])
    vi.mocked(getPaymentAccountPaymentMovements).mockResolvedValue([])
    vi.mocked(calculatePaymentAccountExchange).mockResolvedValue(50)
  })

  it('keeps transfer text input values after React finishes handling the change event', async () => {
    renderModal(
      <PaymentAccountTransferModal
        account={account}
        opened
        onClose={vi.fn()}
        onMutationComplete={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await waitFor(() => expect(getPaymentAccounts).toHaveBeenCalled())

    const valuesByLabel = {
      Сума: '125.50',
      Дата: '2026-07-21',
      Час: '12:45',
      Коментар: 'Переказ між рахунками',
    }

    for (const [label, value] of Object.entries(valuesByLabel)) {
      const input = screen.getByLabelText<HTMLInputElement>(new RegExp(`^${label}(?: \\*)?$`))
      fireEvent.change(input, { target: { value } })
      expect(input.value).toBe(value)
    }
  })

  it('keeps exchange text input values after React finishes handling the change event', async () => {
    renderModal(
      <PaymentAccountExchangeModal
        account={account}
        opened
        onClose={vi.fn()}
        onMutationComplete={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await waitFor(() => expect(getPaymentAccountsByBank).toHaveBeenCalled())

    const valuesByLabel = {
      Сума: '200',
      Курс: '1.08',
      'Вхідний номер': 'EX-42',
      Дата: '2026-07-22',
      Час: '09:30',
      Коментар: 'Конвертація валюти',
    }

    for (const [label, value] of Object.entries(valuesByLabel)) {
      const input = screen.getByLabelText<HTMLInputElement>(new RegExp(`^${label}(?: \\*)?$`))
      fireEvent.change(input, { target: { value } })
      expect(input.value).toBe(value)
    }
  })
})
