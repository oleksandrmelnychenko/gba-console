import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '../../../shared/api/apiClient'
import {
  createAvailablePaymentOutcome,
  getGroupedPaymentTasks,
  mergeAvailablePaymentTasks,
  setAvailablePaymentTaskToActive,
} from './availablePaymentsApi'
import { AccountingTypeValue, type AvailablePaymentTaskModel, type SupplyPaymentTask } from '../types'

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

  it('excludes deleted persisted documents from the outcome-payment task graph', async () => {
    const task = createPersistedTask()
    const model = {
      id: 'task-42',
      task,
    } as AvailablePaymentTaskModel
    apiRequestMock.mockResolvedValueOnce({})

    const operationId = '88888888-8888-4888-8888-888888888888'

    await createAvailablePaymentOutcome({
      amount: 100,
      comment: '',
      customNumber: '',
      documents: [],
      exchangeRate: 1,
      fromDate: '2026-07-25T12:00:00',
      isAccounting: false,
      isManagementAccounting: true,
      models: [model],
      organization: { Id: 1 },
      paymentPurpose: 'Оплата постачальнику',
      selectedCurrencyRegister: { Id: 2 },
      selectedMovement: { Id: 3 },
      selectedRegister: { Id: 4 },
    }, { operationId })

    const body = apiRequestMock.mock.calls[0]?.[1]?.body as FormData
    const payload = JSON.parse(String(body.get('order'))) as {
      OperationType: number
      OutcomePaymentOrderSupplyPaymentTasks: Array<{
        SupplyPaymentTask: SupplyPaymentTask
      }>
    }
    const outcomeTask = payload.OutcomePaymentOrderSupplyPaymentTasks[0]?.SupplyPaymentTask

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
    expect(payload.OperationType).toBe(4)
    expect(apiRequestMock).toHaveBeenCalledWith('/payments/orders/outcome/new/supplies', {
      body,
      dedupe: false,
      headers: {
        'Idempotency-Key': operationId,
      },
      method: 'POST',
      query: {
        operationNetUid: operationId,
      },
    })
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
