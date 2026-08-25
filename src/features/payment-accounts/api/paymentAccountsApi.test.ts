import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  calculatePaymentAccountExchange,
  cancelPaymentAccountExchange,
  cancelPaymentAccountTransfer,
  createPaymentAccount,
  createPaymentAccountExchange,
  createPaymentAccountTransfer,
  getPaymentAccountCurrencyActivity,
  getPaymentAccountCurrencyTraders,
  getPaymentAccountExchanges,
  getPaymentAccountPaymentMovements,
  getPaymentAccountTransfers,
  getPaymentAccountsByBank,
  updatePaymentAccount,
} from './paymentAccountsApi'
import type {
  PaymentAccountPayload,
  PaymentRegisterCurrencyExchange,
  PaymentRegisterTransfer,
} from '../types'

vi.mock('../../../shared/api/apiClient', () => ({
  ApiError: class ApiError extends Error {},
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('paymentAccountsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('does not expose destructive payment account deletion', async () => {
    const paymentAccountsApi = await import('./paymentAccountsApi')

    expect(paymentAccountsApi).not.toHaveProperty(
      'deletePaymentAccount',
    )
  })

  it('loads exchange traders for a payment currency register', async () => {
    apiRequestMock.mockResolvedValueOnce({
      Collection: [
        {
          CurrencyTraderExchangeRates: [{ CurrencyName: 'EUR', ExchangeRate: 42.5 }],
          FirstName: 'Trader',
          NetUid: 'trader-1',
        },
      ],
    })

    await expect(getPaymentAccountCurrencyTraders('currency-register-1')).resolves.toEqual([
      {
        CurrencyTraderExchangeRates: [{ CurrencyName: 'EUR', ExchangeRate: 42.5 }],
        FirstName: 'Trader',
        NetUid: 'trader-1',
      },
    ])

    expect(apiRequestMock).toHaveBeenCalledWith('/currencies/traders/find/currency', {
      query: {
        netId: 'currency-register-1',
      },
    })
  })

  it('delegates currency exchange calculation to the backend', async () => {
    apiRequestMock.mockResolvedValueOnce({ Amount: 4250 })

    await expect(calculatePaymentAccountExchange({
      amount: 100,
      currencyCode: 'EUR',
      exchangeRate: 42.5,
    })).resolves.toBe(4250)

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/registers/exchanges/accounting/calculate', {
      query: {
        amount: 100,
        currencyCode: 'EUR',
        exchangeRate: 42.5,
      },
    })
  })

  it('uses page-scoped routes for payment-account activity reads', async () => {
    apiRequestMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ NetUid: 'currency-register-1' })

    await getPaymentAccountsByBank('account-1')
    await getPaymentAccountTransfers({
      currencyNetId: 'currency-1',
      from: '2026-08-01',
      netId: 'account-1',
      to: '2026-08-18',
      type: 0,
    })
    await getPaymentAccountExchanges({
      from: '2026-08-01',
      fromCurrencyNetId: 'currency-1',
      netId: 'account-1',
      to: '2026-08-18',
      toCurrencyNetId: 'currency-2',
    })
    await getPaymentAccountCurrencyActivity({
      currencyRegisterNetId: 'currency-register-1',
      from: '2026-08-01',
      to: '2026-08-18',
    })

    expect(apiRequestMock.mock.calls.map(([path]) => path)).toEqual([
      '/payments/registers/accounting/by/bank',
      '/payments/registers/transfers/accounting/all',
      '/payments/registers/exchanges/accounting/all',
      '/payments/registers/accounting/currencies/get/filtered',
    ])
  })

  it('loads payment movements through the payment-accounts page scope', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [] })

    await getPaymentAccountPaymentMovements()

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/payments/movements/payment-accounts/page/all',
    )
  })

  it.each([
    ['create', createPaymentAccount, '/payments/registers/accounting/new', '33333333-3333-4333-8333-333333333333'],
    ['update', updatePaymentAccount, '/payments/registers/accounting/update', '44444444-4444-4444-8444-444444444444'],
  ] as const)('sends one durable operation key for account %s', async (
    _name,
    mutate,
    path,
    operationId,
  ) => {
    const account: PaymentAccountPayload = {
      Name: 'Основна каса',
      Organization: {
        Id: 10,
        NetUid: 'organization-10',
      },
      PaymentCurrencyRegisters: [],
      Type: 0,
    }
    apiRequestMock.mockResolvedValueOnce({
      ...account,
      Id: 51,
      NetUid: 'account-51',
    })

    await mutate(account, { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith(path, {
      body: account,
      dedupe: false,
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
      query: {
        operationNetUid: operationId,
      },
    })
  })

  it('reuses the transfer operation key after an unknown outcome', async () => {
    const operationId = '11111111-1111-4111-8111-111111111111'
    const transfer: PaymentRegisterTransfer = {
      Amount: 125.5,
      Comment: 'Каса → банк',
      FromPaymentCurrencyRegisterId: 10,
      ToPaymentCurrencyRegisterId: 20,
      TypeOfOperation: 1,
    }
    const persisted = {
      ...transfer,
      Id: 41,
      NetUid: 'transfer-41',
    }
    apiRequestMock
      .mockRejectedValueOnce(new Error('network outcome is unknown'))
      .mockResolvedValueOnce(persisted)

    await expect(
      createPaymentAccountTransfer(transfer, { operationId }),
    ).rejects.toThrow('network outcome is unknown')
    await expect(createPaymentAccountTransfer(transfer)).resolves.toEqual(
      persisted,
    )

    expect(apiRequestMock).toHaveBeenCalledTimes(2)
    for (const call of apiRequestMock.mock.calls) {
      expect(call).toEqual([
        '/payments/registers/transfers/accounting/new',
        {
          body: transfer,
          dedupe: false,
          headers: { 'Idempotency-Key': operationId },
          method: 'POST',
          query: {
            operationNetUid: operationId,
          },
        },
      ])
    }
  })

  it('sends one stable operation key for a currency exchange create', async () => {
    const operationId = '22222222-2222-4222-8222-222222222222'
    const exchange: PaymentRegisterCurrencyExchange = {
      Amount: 100,
      ExchangeRate: 42.5,
      FromPaymentCurrencyRegisterId: 10,
      ToPaymentCurrencyRegisterId: 20,
    }
    const persisted = {
      ...exchange,
      Id: 71,
      NetUid: 'exchange-71',
    }
    apiRequestMock.mockResolvedValueOnce(persisted)

    await expect(
      createPaymentAccountExchange(exchange, { operationId }),
    ).resolves.toEqual(persisted)

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/payments/registers/exchanges/accounting/new',
      {
        body: exchange,
        dedupe: false,
        headers: { 'Idempotency-Key': operationId },
        method: 'POST',
        query: {
          operationNetUid: operationId,
        },
      },
    )
  })

  it.each([
    [
      'transfer',
      cancelPaymentAccountTransfer,
      '/payments/registers/transfers/accounting/cancel',
      '55555555-5555-4555-8555-555555555555',
    ],
    [
      'currency exchange',
      cancelPaymentAccountExchange,
      '/payments/registers/exchanges/accounting/cancel',
      '66666666-6666-4666-8666-666666666666',
    ],
  ] as const)(
    'sends one durable operation key for %s cancellation',
    async (_name, cancel, path, operationId) => {
      const netId = '77777777-7777-4777-8777-777777777777'
      apiRequestMock.mockResolvedValueOnce({
        Entity: { NetUid: netId },
        IsSuccess: true,
      })

      await cancel(netId, { operationId })

      expect(apiRequestMock).toHaveBeenCalledWith(path, {
        dedupe: false,
        headers: { 'Idempotency-Key': operationId },
        method: 'PUT',
        query: {
          netId,
          operationNetUid: operationId,
        },
      })
    },
  )
})
