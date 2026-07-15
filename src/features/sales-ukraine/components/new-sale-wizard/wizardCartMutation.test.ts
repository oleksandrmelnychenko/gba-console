import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addOrderItem, deleteOrderItem, updateOrderItem } from '../../api/salesUkraineApi'
import { shiftOrderItemFromSale } from './newSaleWizardApi'
import {
  createPersistedWizardCartMutation,
  executeWizardCartMutationRequest,
} from './wizardCartMutation'

vi.mock('../../api/salesUkraineApi', () => ({
  addOrderItem: vi.fn(),
  deleteOrderItem: vi.fn(),
  updateOrderItem: vi.fn(),
}))

vi.mock('./newSaleWizardApi', () => ({
  shiftOrderItemFromSale: vi.fn(),
}))

const addOrderItemMock = vi.mocked(addOrderItem)
const deleteOrderItemMock = vi.mocked(deleteOrderItem)
const updateOrderItemMock = vi.mocked(updateOrderItem)
const shiftOrderItemFromSaleMock = vi.mocked(shiftOrderItemFromSale)

beforeEach(() => {
  addOrderItemMock.mockReset().mockResolvedValue(null)
  deleteOrderItemMock.mockReset().mockResolvedValue(undefined)
  updateOrderItemMock.mockReset().mockResolvedValue(undefined)
  shiftOrderItemFromSaleMock.mockReset().mockResolvedValue(undefined)
})

describe('wizard cart mutation wire snapshots', () => {
  it('stores an immutable add payload and retries byte-for-byte with the same body/key', async () => {
    const operationId = '11111111-1111-4111-8111-111111111111'
    const mutableItem = {
      Comment: 'original',
      NetUid: '00000000-0000-0000-0000-000000000000',
      Product: { Id: 7, NetUid: 'product-1' },
      Qty: 2,
    }
    const operation = createPersistedWizardCartMutation({
      context: 'agreement-1:sale-1',
      expectation: { kind: 'operation-marker' },
      fallbackMessage: 'failed',
      localCommit: { kind: 'none' },
      operationId,
      request: {
        clientAgreementNetId: 'agreement-1',
        kind: 'add',
        orderItem: mutableItem,
        saleNetId: 'sale-1',
      },
    })

    await executeWizardCartMutationRequest(operation.request, operation.operationId)
    mutableItem.Comment = 'changed after timeout'
    mutableItem.Qty = 99
    await executeWizardCartMutationRequest(operation.request, operation.operationId)

    expect(addOrderItemMock).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(addOrderItemMock.mock.calls[1]?.[2])).toBe(
      JSON.stringify(addOrderItemMock.mock.calls[0]?.[2]),
    )
    expect(addOrderItemMock.mock.calls[0]?.[2]).toMatchObject({
      Comment: 'original',
      OperationNetUid: operationId,
      Qty: 2,
    })
    expect(addOrderItemMock.mock.calls.map((call) => call[3]?.operationId)).toEqual([
      operationId,
      operationId,
    ])
    expect(Object.isFrozen(operation.request)).toBe(true)
  })

  it('routes update/delete/shift through mandatory operation contexts', async () => {
    const operationId = '22222222-2222-4222-8222-222222222222'
    const base = {
      context: 'agreement-1:sale-1',
      expectation: { kind: 'operation-marker' as const },
      fallbackMessage: 'failed',
      localCommit: { kind: 'none' as const },
      operationId,
    }
    const update = createPersistedWizardCartMutation({
      ...base,
      request: { kind: 'update', orderItem: { NetUid: 'row-1', Qty: 4 } },
    })
    const remove = createPersistedWizardCartMutation({
      ...base,
      request: { kind: 'delete', orderItemNetId: 'row-1' },
    })
    const shift = createPersistedWizardCartMutation({
      ...base,
      request: {
        kind: 'shift',
        orderItem: { NetUid: 'row-1', Qty: 1 },
        saleFromNetId: 'sale-from',
        saleToNetId: 'sale-to',
      },
    })

    await executeWizardCartMutationRequest(update.request, operationId)
    await executeWizardCartMutationRequest(remove.request, operationId)
    await executeWizardCartMutationRequest(shift.request, operationId)

    expect(updateOrderItemMock).toHaveBeenCalledWith(
      expect.objectContaining({ NetUid: 'row-1', OperationNetUid: operationId }),
      { operationId },
    )
    expect(deleteOrderItemMock).toHaveBeenCalledWith('row-1', { operationId })
    expect(shiftOrderItemFromSaleMock).toHaveBeenCalledWith(
      'sale-from',
      'sale-to',
      expect.objectContaining({ NetUid: 'row-1', OperationNetUid: operationId }),
      { operationId },
    )
  })
})
