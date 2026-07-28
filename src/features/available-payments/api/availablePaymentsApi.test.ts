import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createAvailablePaymentOutcome,
  getAvailablePaymentExchangeRate,
  getAvailablePaymentMovements,
  getAvailablePaymentsOrganizations,
  getGroupedPaymentTasks,
  mergeAvailablePaymentTasks,
  searchAvailablePaymentMovements,
  searchAvailablePaymentRegisters,
  setAvailablePaymentTaskToActive,
} from './availablePaymentsApi'
import { AccountingTypeValue, type AvailablePaymentTaskModel, type SupplyPaymentTask } from '../types'
import { PaymentRegisterType } from '../../income-cashflows/types'

vi.mock('../../../shared/api/apiClient', () => ({
  apiRequest: vi.fn(),
}))

const apiRequestMock = vi.mocked(apiRequest)

describe('availablePaymentsApi', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
  })

  it('loads all grouped payment tasks for the accounting available-payments screen', async () => {
    apiRequestMock.mockResolvedValueOnce({
      GroupedPaymentTasks: [],
      PriceTotals: [],
      TotalGrossPrice: 0,
    })

    await getGroupedPaymentTasks({
      from: '2026-07-01',
      limit: 10,
      offset: 0,
      onlyAvailableForPayment: false,
      to: '2026-07-08',
      typePaymentTask: AccountingTypeValue.All,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/tasks/grouped/all/filtered', {
      query: {
        from: '2026-07-01',
        limit: 10,
        offset: 0,
        organizationNetId: undefined,
        to: '2026-07-08',
        typePaymentTask: AccountingTypeValue.All,
      },
    })
  })

  it('loads only available grouped payment tasks for outcome-payment mode', async () => {
    apiRequestMock.mockResolvedValueOnce({
      GroupedPaymentTasks: [],
      PriceTotals: [],
      TotalGrossPrice: 0,
    })

    await getGroupedPaymentTasks({
      from: '2026-07-01',
      limit: 20,
      offset: 20,
      onlyAvailableForPayment: true,
      organizationNetId: 'organization-1',
      to: '2026-07-08',
      typePaymentTask: AccountingTypeValue.Accounting,
    })

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/tasks/grouped/all/available/filtered', {
      query: {
        from: '2026-07-01',
        limit: 20,
        offset: 20,
        organizationNetId: 'organization-1',
        to: '2026-07-08',
        typePaymentTask: AccountingTypeValue.Accounting,
      },
    })
  })

  it('loads the organization, register, currency, and movement autocomplete sources used by the payment form', async () => {
    apiRequestMock
      .mockResolvedValueOnce([{ Id: 1, Name: 'Організація' }])
      .mockResolvedValueOnce({
        Items: [
          {
            Id: 2,
            Name: 'Банк',
            PaymentCurrencyRegisters: null,
          },
        ],
      })
      .mockResolvedValueOnce([{ Id: 3, OperationName: 'Оплата постачальнику' }])
      .mockResolvedValueOnce({
        Items: [{ Id: 4, OperationName: 'Оплата за інвойсом' }],
      })

    await expect(getAvailablePaymentsOrganizations()).resolves.toEqual([
      { Id: 1, Name: 'Організація' },
    ])
    await expect(searchAvailablePaymentRegisters(' банк ')).resolves.toEqual([
      {
        Id: 2,
        Name: 'Банк',
        PaymentCurrencyRegisters: [],
      },
    ])
    await expect(getAvailablePaymentMovements()).resolves.toEqual([
      { Id: 3, OperationName: 'Оплата постачальнику' },
    ])
    await expect(
      searchAvailablePaymentMovements('інвойс'),
    ).resolves.toEqual([{ Id: 4, OperationName: 'Оплата за інвойсом' }])

    expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/organizations/all')
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      2,
      '/payments/registers/search',
      {
        query: {
          value: ' банк ',
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
          value: 'інвойс',
        },
      },
    )
  })

  it('loads the exchange rate for the selected register and task currencies', async () => {
    apiRequestMock.mockResolvedValueOnce({ Rate: 44.35 })

    await expect(
      getAvailablePaymentExchangeRate({
        fromCurrencyNetId: 'currency-uah',
        fromDate: '2026-07-20T12:30:00',
        organizationName: 'Інша організація',
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

  it('keeps the exact persisted task identity and excludes deleted documents when setting a task available', async () => {
    const task = createPersistedTask()
    const upload = new File(['proof'], 'proof.pdf', { type: 'application/pdf' })
    apiRequestMock.mockResolvedValueOnce(task)

    await setAvailablePaymentTaskToActive(task, [upload])

    const body = apiRequestMock.mock.calls[0]?.[1]?.body as FormData
    const payload = JSON.parse(String(body.get('task'))) as SupplyPaymentTask

    expect(payload).toMatchObject({
      Id: 42,
      NetUid: '6b705f30-89a3-4c57-b74c-908082528865',
      SupplyPaymentTaskDocuments: [
        {
          Id: 10,
          NetUid: '7be42a1c-b2a6-4137-8548-2033ce5cb85d',
        },
      ],
    })
    expect(payload.SupplyPaymentTaskDocuments).toHaveLength(1)
    expect(body.getAll('documents')).toEqual([upload])
  })

  it('sends identity-only merge references for persisted tasks', async () => {
    const firstTask = createPersistedTask()
    const secondTask = createPersistedTask({
      Id: 43,
      NetUid: '1d48a5df-2fed-4921-af93-c3b7f562a3a4',
    })
    apiRequestMock.mockResolvedValueOnce(firstTask)

    await mergeAvailablePaymentTasks([firstTask, secondTask])

    expect(apiRequestMock).toHaveBeenCalledWith('/payments/tasks/merge', {
      body: [
        {
          Id: 42,
          NetUid: '6b705f30-89a3-4c57-b74c-908082528865',
        },
        {
          Id: 43,
          NetUid: '1d48a5df-2fed-4921-af93-c3b7f562a3a4',
        },
      ],
      method: 'POST',
    })
  })

  it('rejects a payment-task mutation without an exact persisted identity', async () => {
    await expect(mergeAvailablePaymentTasks([
      {
        Id: 42,
        NetUid: 'not-a-guid',
      },
    ])).rejects.toThrow('Persisted payment task requires a valid Id and NetUid')

    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('creates bank and cash task payments with exact accounting, register, currency, and task fields', async () => {
    const task = createPersistedTask()
    const model = {
      id: 'task-42',
      task,
    } as AvailablePaymentTaskModel
    const operationId = '88888888-8888-4888-8888-888888888888'

    for (const registerType of [
      PaymentRegisterType.Bank,
      PaymentRegisterType.Cash,
    ]) {
      apiRequestMock.mockResolvedValueOnce({})

      await createAvailablePaymentOutcome({
        amount: 100,
        comment: 'Оплата рахунку',
        customNumber: 'PAY-42',
        documents: [],
        exchangeRate: 44.35,
        fromDate: '2026-07-25T12:00:00',
        isAccounting: true,
        isManagementAccounting: false,
        models: [model],
        organization: { Id: 1 },
        paymentPurpose: 'Оплата постачальнику',
        selectedCurrencyRegister: {
          Currency: { Code: 'UAH', Id: 10038 },
          Id: 2,
        },
        selectedMovement: { Id: 3 },
        selectedRegister: { Id: 4, Type: registerType },
      }, { operationId })

      const call = apiRequestMock.mock.calls.at(-1)
      const body = call?.[1]?.body as FormData
      const payload = JSON.parse(String(body.get('order'))) as {
        IsAccounting: boolean
        IsManagementAccounting: boolean
        OperationType: number
        OutcomePaymentOrderSupplyPaymentTasks: Array<{
          SupplyPaymentTask: SupplyPaymentTask
        }>
        PaymentCurrencyRegister: {
          Currency: { Code: string; Id: number }
          Id: number
        }
        PaymentMovementOperation: {
          PaymentMovementId: number
        }
        PaymentRegister: {
          Id: number
          Type: number
        }
      }
      const outcomeTask =
        payload.OutcomePaymentOrderSupplyPaymentTasks[0]?.SupplyPaymentTask

      expect(payload).toMatchObject({
        IsAccounting: true,
        IsManagementAccounting: false,
        OperationType: 4,
        PaymentCurrencyRegister: {
          Currency: { Code: 'UAH', Id: 10038 },
          Id: 2,
        },
        PaymentMovementOperation: {
          PaymentMovementId: 3,
        },
        PaymentRegister: {
          Id: 4,
          Type: registerType,
        },
      })
      expect(outcomeTask).toMatchObject({
        Id: 42,
        NetUid: '6b705f30-89a3-4c57-b74c-908082528865',
      })
      expect(outcomeTask?.SupplyPaymentTaskDocuments).toEqual([
        expect.objectContaining({
          Id: 10,
          NetUid: '7be42a1c-b2a6-4137-8548-2033ce5cb85d',
        }),
      ])
      expect(apiRequestMock).toHaveBeenLastCalledWith(
        '/payments/orders/outcome/new/supplies',
        {
          body,
          dedupe: false,
          headers: {
            'Idempotency-Key': operationId,
          },
          method: 'POST',
          query: {
            operationNetUid: operationId,
          },
        },
      )
    }
  })
})

function createPersistedTask(overrides: Partial<SupplyPaymentTask> = {}): SupplyPaymentTask {
  return {
    GrossPrice: 100,
    Id: 42,
    NetUid: '6b705f30-89a3-4c57-b74c-908082528865',
    SupplyPaymentTaskDocuments: [
      {
        Id: 10,
        NetUid: '7be42a1c-b2a6-4137-8548-2033ce5cb85d',
      },
      {
        Deleted: true,
        Id: 11,
        NetUid: 'd78012af-6d96-4de6-bfcb-0a5807a24d7b',
      },
    ],
    ...overrides,
  }
}
