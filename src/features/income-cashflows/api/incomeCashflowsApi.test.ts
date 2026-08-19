import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { IncomeCounterpartySearchType } from '../types'
import {
  cancelIncomeCashflow,
  createIncomeCashflow,
  createIncomeCashflowPaymentMovementForAccounting,
  createOnlineShopIncomeCashflow,
  getIncomeCashflowClientAgreements,
  getIncomeCashflowOrganizations,
  getIncomeCashflowPaymentMovements,
  getIncomeCashflowRetailClients,
  getIncomeCashflowSpecificExchangeRate,
  getIncomeCashflowSupplyOrganizationAgreements,
  getIncomeCashflowByNetId,
  getIncomeCashflowForAccountingCashFlow,
  searchIncomeCashflowCounterparties,
  searchIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentRegisters,
  searchIncomeCashflowPaymentPurposes,
  updateIncomeCashflow,
  updateIncomeCashflowClient,
} from './incomeCashflowsApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('income cashflow API lookup contracts', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('searches client counterparties through the targeted clients endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce([{ NetUid: 'client-1' }])

    await expect(searchIncomeCashflowCounterparties(' конкорд ', IncomeCounterpartySearchType.Client)).resolves.toEqual([{ NetUid: 'client-1' }])

    expect(apiRequestMock).toHaveBeenCalledWith('/clients/all/filtered', {
      query: {
        filterSql: 'RegionCode.Value/Client.FullName',
        limit: 20,
        offset: 0,
        typeRoleFilter: '',
        value: 'конкорд',
      },
    })
  })

  it('searches manufacturer counterparties through the targeted suppliers endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce([{ NetUid: 'manufacturer-1' }])

    await expect(searchIncomeCashflowCounterparties(' sem ', IncomeCounterpartySearchType.Manufacturer)).resolves.toEqual([{ NetUid: 'manufacturer-1' }])

    expect(apiRequestMock).toHaveBeenCalledWith('/clients/suppliers/all/filtered', {
      query: {
        filterSql: 'RegionCode.Value/Client.FullName',
        limit: 20,
        offset: 0,
        typeRoleFilter: '4',
        value: 'sem',
      },
    })
  })

  it('searches supply organization counterparties through the supply organizations endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce({ Items: [{ NetUid: 'supplier-1' }] })

    await expect(searchIncomeCashflowCounterparties(' dhl ', IncomeCounterpartySearchType.Supplier)).resolves.toEqual([{ NetUid: 'supplier-1' }])

    expect(apiRequestMock).toHaveBeenCalledWith('/supplies/organizations/all/search', {
      query: {
        limit: 20,
        offset: 0,
        value: 'dhl',
      },
    })
  })

  it('loads the organization, register, currency, and movement sources shared by income and outcome forms', async () => {
    apiRequestMock
      .mockResolvedValueOnce({ Items: [{ Id: 1, Name: 'Організація' }] })
      .mockResolvedValueOnce({
        Items: [
          {
            Id: 2,
            Name: 'Рахунок',
            PaymentCurrencyRegisters: null,
          },
        ],
      })
      .mockResolvedValueOnce([{ Id: 3, OperationName: 'Інші витрати' }])
      .mockResolvedValueOnce({
        Items: [{ Id: 4, OperationName: 'Оплата постачальнику' }],
      })

    await expect(getIncomeCashflowOrganizations()).resolves.toEqual([
      { Id: 1, Name: 'Організація' },
    ])
    await expect(searchIncomeCashflowPaymentRegisters('рах')).resolves.toEqual([
      {
        Id: 2,
        Name: 'Рахунок',
        PaymentCurrencyRegisters: [],
      },
    ])
    await expect(getIncomeCashflowPaymentMovements()).resolves.toEqual([
      { Id: 3, OperationName: 'Інші витрати' },
    ])
    await expect(
      searchIncomeCashflowPaymentMovements('постачальнику'),
    ).resolves.toEqual([{ Id: 4, OperationName: 'Оплата постачальнику' }])

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/organizations/all')
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      2,
      '/payments/registers/search',
      {
        query: {
          value: 'рах',
        },
      },
    )
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      3,
      '/payments/movements/all',
    )
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      4,
      '/payments/movements/all/search',
      {
        query: {
          value: 'постачальнику',
        },
      },
    )
  })

  it('loads client and supplier agreements from their distinct autocomplete contracts', async () => {
    apiRequestMock
      .mockResolvedValueOnce({
        ClientAgreements: [{ Id: 11, Agreement: { Id: 12 } }],
      })
      .mockResolvedValueOnce({
        SupplyOrganizationAgreements: [{ Id: 21 }],
      })

    await expect(
      getIncomeCashflowClientAgreements('client-1'),
    ).resolves.toEqual([{ Id: 11, Agreement: { Id: 12 } }])
    await expect(
      getIncomeCashflowSupplyOrganizationAgreements(42),
    ).resolves.toEqual([{ Id: 21 }])

    expect(apiRequestMock).toHaveBeenNthCalledWith(
      1,
      '/agreements/client/all',
      {
        query: {
          netId: 'client-1',
        },
      },
    )
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      2,
      '/supplies/organizations/agreements/by',
      {
        query: {
          id: 42,
        },
      },
    )
  })

  it('loads every initial retail-client page for the shop selector', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      Name: `Retail ${index + 1}`,
      NetUid: `retail-client-${index + 1}`,
    }))
    const target = {
      Name: 'ShopClient VAT',
      NetUid: 'retail-client-101',
    }
    apiRequestMock
      .mockResolvedValueOnce({ Collection: firstPage, TotalQty: 101 })
      .mockResolvedValueOnce({ Collection: [target], TotalQty: 101 })

    const clients = await getIncomeCashflowRetailClients()

    expect(clients).toHaveLength(101)
    expect(clients.at(-1)).toEqual(target)
    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/retail/clients/all', {
      query: {
        limit: 100,
        offset: 0,
      },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/retail/clients/all', {
      query: {
        limit: 100,
        offset: 100,
      },
    })
  })

  it('loads a specific exchange rate for the selected register and agreement currencies', async () => {
    apiRequestMock.mockResolvedValueOnce(44.35)

    await expect(
      getIncomeCashflowSpecificExchangeRate({
        fromCurrencyNetId: 'currency-uah',
        fromDate: '2026-07-20T12:30:00',
        toCurrencyNetId: 'currency-eur',
      }),
    ).resolves.toBe(44.35)

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/exchangerates/get/specific',
      {
        query: {
          fromCurrencyNetId: 'currency-uah',
          fromDate: '2026-07-20T12:30:00',
          toCurrencyNetId: 'currency-eur',
        },
      },
    )
  })

  it('loads a focused income payment order by NetUid for cash-flow drilldown', async () => {
    apiRequestMock.mockResolvedValueOnce({
      AssignedPaymentOrders: null,
      NetUid: 'income-order-1',
      Number: 'ПКО-1',
    })

    await expect(getIncomeCashflowByNetId('income-order-1')).resolves.toEqual({
      AssignedPaymentOrders: [],
      NetUid: 'income-order-1',
      Number: 'ПКО-1',
    })

    apiRequestMock.mockResolvedValueOnce({ NetUid: 'income-order-1' })
    await getIncomeCashflowForAccountingCashFlow('income-order-1')
    expect(apiRequestMock).toHaveBeenLastCalledWith('/payments/orders/income/accounting-cash-flow/get', {
      query: { netId: 'income-order-1' },
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/orders/income/get', {
      query: {
        netId: 'income-order-1',
      },
    })
  })

  it('loads payment-purpose suggestions for the selected client agreement', async () => {
    const controller = new AbortController()
    apiRequestMock.mockResolvedValueOnce([' Оплата за товар ', null, 'За рахунком', 'Оплата за товар'])

    await expect(
      searchIncomeCashflowPaymentPurposes({
        clientAgreementNetId: 'agreement-1',
        clientNetId: 'client-1',
        limit: 8,
        signal: controller.signal,
        value: ' рах ',
      }),
    ).resolves.toEqual(['Оплата за товар', 'За рахунком'])

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/orders/income/payment-purpose/suggestions', {
      query: {
        clientAgreementNetId: 'agreement-1',
        clientNetId: 'client-1',
        limit: 8,
        value: 'рах',
      },
      signal: controller.signal,
    })
  })

  it('sends one explicit idempotency key for a general income create', async () => {
    const operationId = '11111111-1111-4111-8111-111111111111'
    const order = {
      Amount: 250,
      AssignedPaymentOrders: [],
      Comment: 'Оплата',
    }
    apiRequestMock.mockResolvedValueOnce({
      ...order,
      NetUid: 'income-1',
    })

    await createIncomeCashflow(order, true, { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/orders/income/new', {
      body: order,
      dedupe: false,
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
      query: {
        auto: true,
      },
    })
  })

  it('uses permission-scoped routes for the online-shop order and article create', async () => {
    const operationId = '55555555-5555-4555-8555-555555555555'
    const order = { Amount: 125, AssignedPaymentOrders: [] }
    apiRequestMock.mockResolvedValue({ NetUid: 'income-shop-1' })

    await createOnlineShopIncomeCashflow(order, false, { operationId })
    await createIncomeCashflowPaymentMovementForAccounting('Оплата магазину')

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/payments/orders/income/online-shop/create', {
      body: order,
      dedupe: false,
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
      query: { auto: false },
    })
    expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/payments/movements/accounting/new', {
      body: { OperationName: 'Оплата магазину' },
      method: 'POST',
    })
  })

  it('covers cancel, update-client, and update with backward-compatible operation options', async () => {
    const cancelOperationId = '22222222-2222-4222-8222-222222222222'
    const clientOperationId = '33333333-3333-4333-8333-333333333333'
    const updateOperationId = '44444444-4444-4444-8444-444444444444'
    apiRequestMock.mockResolvedValue({ NetUid: 'income-1' })

    await cancelIncomeCashflow('income-1', {
      operationId: cancelOperationId,
    })
    await updateIncomeCashflowClient({
      clientAgreementNetId: 'agreement-2',
      clientNetId: 'client-2',
      incomeNetId: 'income-1',
    }, {
      operationId: clientOperationId,
    })
    await updateIncomeCashflow({
      Amount: 300,
      AssignedPaymentOrders: [],
      NetUid: 'income-1',
    }, {
      operationId: updateOperationId,
    })

    expect(apiRequestMock).toHaveBeenNthCalledWith(
      1,
      '/payments/orders/income/cancel',
      {
        dedupe: false,
        headers: { 'Idempotency-Key': cancelOperationId },
        method: 'PUT',
        query: {
          netId: 'income-1',
        },
      },
    )
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      2,
      '/payments/orders/income/update/client',
      {
        dedupe: false,
        headers: { 'Idempotency-Key': clientOperationId },
        method: 'PUT',
        query: {
          clientAgreementNetId: 'agreement-2',
          clientNetId: 'client-2',
          incomeNetId: 'income-1',
        },
      },
    )
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      3,
      '/payments/orders/income/update',
      {
        body: {
          Amount: 300,
          AssignedPaymentOrders: [],
          NetUid: 'income-1',
        },
        dedupe: false,
        headers: { 'Idempotency-Key': updateOperationId },
        method: 'POST',
      },
    )
  })
})
