import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { IncomeCounterpartySearchType } from '../types'
import {
  cancelIncomeCashflow,
  createIncomeCashflow,
  getIncomeCashflowByNetId,
  searchIncomeCashflowCounterparties,
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
