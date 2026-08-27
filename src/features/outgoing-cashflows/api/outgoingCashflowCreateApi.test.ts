import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import { OUTCOME_OPERATION_TYPE } from '../outgoingCreateTypes'
import {
  createOutgoingCashflowOrder,
  createOutgoingCreatePaymentMovement,
  getOutgoingCreateOrganizations,
  getOutgoingCreatePaymentMovements,
  searchOutgoingCreatePaymentMovements,
  searchOutgoingCreatePaymentRegisters,
  searchOutgoingCreateUsers,
} from './outgoingCashflowCreateApi'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('outgoingCashflowCreateApi mutation contract', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('sends a stable explicit idempotency key with the immutable JSON body', async () => {
    const operationId = '66666666-6666-4666-8666-666666666666'
    const order = {
      Amount: 450,
      Comment: 'Оплата постачальнику',
      OperationType: OUTCOME_OPERATION_TYPE.PaymentToSupplier,
    }
    apiRequestMock.mockResolvedValueOnce({
      ...order,
      NetUid: 'outcome-1',
    })

    await createOutgoingCashflowOrder(order, { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/orders/outcome/outgoing-cashflows/create', {
      body: order,
      dedupe: false,
      headers: { 'Idempotency-Key': operationId },
      method: 'POST',
    })
  })

  it('uses the existing cash-flow article create boundary for a new payment movement', async () => {
    apiRequestMock.mockResolvedValueOnce({ Id: 7, OperationName: 'Господарські витрати' })

    await expect(createOutgoingCreatePaymentMovement('Господарські витрати')).resolves.toEqual({
      Id: 7,
      OperationName: 'Господарські витрати',
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/movements/accounting/new', {
      body: { OperationName: 'Господарські витрати' },
      method: 'POST',
    })
  })

  it('loads the organization, register, currency, movement, and colleague autocomplete contracts', async () => {
    apiRequestMock
      .mockResolvedValueOnce({ Organizations: [{ Id: 1, Name: 'Організація' }] })
      .mockResolvedValueOnce({
        Registers: [
          {
            Id: 2,
            Name: 'Каса',
            PaymentCurrencyRegisters: null,
          },
        ],
      })
      .mockResolvedValueOnce([{ Id: 3, OperationName: 'Під звіт' }])
      .mockResolvedValueOnce({
        Items: [{ Id: 4, OperationName: 'Господарські витрати' }],
      })
      .mockResolvedValueOnce({
        Profiles: [{ Id: 5, FullName: 'Іваненко Іван' }],
      })

    await expect(getOutgoingCreateOrganizations()).resolves.toEqual([
      { Id: 1, Name: 'Організація' },
    ])
    await expect(
      searchOutgoingCreatePaymentRegisters('каса'),
    ).resolves.toEqual([
      {
        Id: 2,
        Name: 'Каса',
        PaymentCurrencyRegisters: [],
      },
    ])
    await expect(getOutgoingCreatePaymentMovements()).resolves.toEqual([
      { Id: 3, OperationName: 'Під звіт' },
    ])
    await expect(
      searchOutgoingCreatePaymentMovements('госп'),
    ).resolves.toEqual([{ Id: 4, OperationName: 'Господарські витрати' }])
    await expect(searchOutgoingCreateUsers('іван')).resolves.toEqual([
      { Id: 5, FullName: 'Іваненко Іван' },
    ])

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/organizations/all')
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      2,
      '/payments/registers/search',
      {
        query: {
          value: 'каса',
        },
      },
    )
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      3,
      '/payments/movements/accounting/all',
    )
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      4,
      '/payments/movements/accounting/all/search',
      {
        query: {
          value: 'госп',
        },
      },
    )
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      5,
      '/usermanagement/profiles/search',
      {
        query: {
          value: 'іван',
        },
      },
    )
  })

  it.each([
    OUTCOME_OPERATION_TYPE.PaymentToSupplier,
    OUTCOME_OPERATION_TYPE.BuyerReturn,
    OUTCOME_OPERATION_TYPE.OtherOutcomeWithCounterparts,
    OUTCOME_OPERATION_TYPE.OtherOutcome,
    OUTCOME_OPERATION_TYPE.TransferToColleague,
  ])('accepts canonical general outcome operation type %s', async (operationType) => {
    const operationId = '77777777-7777-4777-8777-777777777777'
    const order = {
      Amount: 100,
      OperationType: operationType,
    }
    apiRequestMock.mockResolvedValueOnce({ NetUid: 'outcome-1' })

    await createOutgoingCashflowOrder(order, { operationId })

    expect(apiRequestMock).toHaveBeenCalledWith(
      '/payments/orders/outcome/outgoing-cashflows/create',
      {
        body: order,
        dedupe: false,
        headers: { 'Idempotency-Key': operationId },
        method: 'POST',
      },
    )
  })

  it('rejects an order without an explicit outcome operation type', async () => {
    await expect(createOutgoingCashflowOrder({
      Amount: 450,
    })).rejects.toThrow('Видатковий ордер має некоректний тип операції')

    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('rejects the payment-task operation on the general outcome endpoint', async () => {
    await expect(
      createOutgoingCashflowOrder({
        Amount: 450,
        OperationType:
          OUTCOME_OPERATION_TYPE.PaymentToSupplierByPaymentTask,
      }),
    ).rejects.toThrow('Видатковий ордер має некоректний тип операції')

    expect(apiRequestMock).not.toHaveBeenCalled()
  })
})
