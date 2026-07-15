import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../../shared/api/apiClient'
import {
  clearWizardMergedSale,
  clearWizardSplitOrderItems,
  getWizardMergedSale,
  getWizardSplitOrderItems,
  setWizardMergedSale,
  setWizardSplitOrderItems,
} from './newSaleWizardState'
import {
  advanceWizardMergedSaleSession,
  buildWizardMergedOrderItems,
} from './wizardMergedSubmit'
import type { WizardSplitOrderItem } from './wizardSplitSale'

const splitItem: WizardSplitOrderItem = {
  Product: { NetUid: 'product-1' },
  Qty: 1,
  TotalAmount: 10,
  TotalAmountEurToUah: 400,
  TotalAmountLocal: 400,
}

function seedDraft() {
  setWizardMergedSale({
    netUid: 'sale-1',
    orderItems: [{ NetUid: 'item-1', Product: { NetUid: 'product-1' }, Qty: 1 }],
    unionSale: null,
  })
  setWizardSplitOrderItems([splitItem], 'agreement-1', {
    agreementNetId: 'agreement-1',
    origin: 'merged',
    saleNetUid: 'sale-1',
    userKey: 'net:user-1',
  })
}

function clearDraft() {
  clearWizardSplitOrderItems()
  clearWizardMergedSale()
}

afterEach(clearDraft)

describe('merged sale submit commit boundary', () => {
  it('preserves separate persisted identities for duplicate products', () => {
    const items = buildWizardMergedOrderItems([
      {
        Comment: 'normal',
        IsFromReSale: false,
        NetUid: 'normal-row',
        Product: { Id: 10, NetUid: 'product-1' },
        Qty: 2,
      },
      {
        Comment: 'resale',
        IsFromReSale: true,
        NetUid: 'resale-row',
        Product: { Id: 10, NetUid: 'product-1' },
        Qty: 1,
      },
    ])

    expect(items).toHaveLength(2)
    expect(items.map((item) => [item.NetUid, item.SourceOrderItemNetUid])).toEqual([
      ['normal-row', 'normal-row'],
      ['resale-row', 'resale-row'],
    ])
  })

  it('rejects merged rows without a unique persisted source identity', () => {
    expect(() => buildWizardMergedOrderItems([{ NetUid: '00000000-0000-0000-0000-000000000000' }])).toThrow(
      'позиція не має збереженого ідентифікатора',
    )
    expect(() => buildWizardMergedOrderItems([{ NetUid: 'row-1' }, { NetUid: 'ROW-1' }])).toThrow(
      'одна позиція передана двічі',
    )
  })

  it('replays a lost merged response with the same frozen body/key and does not clear drafts before ack', async () => {
    seedDraft()
    const operationId = '11111111-1111-4111-8111-111111111111'
    const payload = {
      Comment: 'original merged payload',
      NetUid: 'sale-1',
      Order: { OrderItems: [{ NetUid: 'item-1', Qty: 1 }] },
    }
    const ledger = new Set<string>()
    let committedWrites = 0
    const updateMergedSale = vi.fn(async (_body, operation) => {
      if (!ledger.has(operation.operationId)) {
        ledger.add(operation.operationId)
        committedWrites += 1
        throw new ApiError('response lost after commit', 500, null)
      }
    })

    const first = await advanceWizardMergedSaleSession({
      createOperationId: () => operationId,
      payload,
      updateMergedSale,
    })

    if (first.status !== 'pending-reconciliation') {
      throw new Error(`Expected pending reconciliation, received ${first.status}`)
    }

    payload.Comment = 'edited after lost response'
    payload.Order.OrderItems[0]!.Qty = 99
    expect(getWizardMergedSale()?.netUid).toBe('sale-1')
    expect(getWizardSplitOrderItems()).toEqual([splitItem])

    const replay = await advanceWizardMergedSaleSession({
      submission: first.submission,
      updateMergedSale,
    })

    expect(replay).toEqual({ status: 'reconciled', submission: null })
    expect(committedWrites).toBe(1)
    expect(updateMergedSale).toHaveBeenCalledTimes(2)
    expect(updateMergedSale.mock.calls[1]).toEqual(updateMergedSale.mock.calls[0])
    expect(updateMergedSale.mock.calls[1]?.[0]).toBe(updateMergedSale.mock.calls[0]?.[0])
    expect(updateMergedSale.mock.calls[1]?.[0]).toMatchObject({
      Comment: 'original merged payload',
      OperationNetUid: operationId,
      Order: { OrderItems: [{ NetUid: 'item-1', Qty: 1 }] },
    })
    expect(getWizardMergedSale()?.netUid).toBe('sale-1')
    expect(getWizardSplitOrderItems()).toEqual([splitItem])

    clearDraft()
    expect(getWizardMergedSale()).toBe(null)
    expect(getWizardSplitOrderItems()).toEqual([])
  })

  it('retains a pending merged context after an unmarked 400 until manual reconciliation', async () => {
    const firstOperationId = '22222222-2222-4222-8222-222222222222'
    const nextOperationId = '33333333-3333-4333-8333-333333333333'
    const payload = { Comment: 'before correction', NetUid: 'sale-1' }
    const updateMergedSale = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('response lost', 500, null))
      .mockRejectedValueOnce(new ApiError('merged fingerprint rejected', 400, null))
      .mockResolvedValueOnce(undefined)

    const first = await advanceWizardMergedSaleSession({
      createOperationId: () => firstOperationId,
      payload,
      updateMergedSale,
    })

    if (first.status !== 'pending-reconciliation') {
      throw new Error(`Expected pending reconciliation, received ${first.status}`)
    }

    payload.Comment = 'corrected payload'
    const retry = await advanceWizardMergedSaleSession({
      submission: first.submission,
      updateMergedSale,
    })

    expect(retry).toEqual({
      error: expect.any(ApiError),
      status: 'pending-reconciliation',
      submission: first.submission,
    })

    // The pure session helper may start a corrected operation only after its
    // durable caller has manually reconciled and closed the previous journal.

    const corrected = await advanceWizardMergedSaleSession({
      createOperationId: () => nextOperationId,
      payload,
      updateMergedSale,
    })

    expect(corrected).toEqual({ status: 'acknowledged', submission: null })
    expect(updateMergedSale.mock.calls.map((call) => call[1]?.operationId)).toEqual([
      firstOperationId,
      firstOperationId,
      nextOperationId,
    ])
    expect(updateMergedSale.mock.calls.map((call) => call[0]?.Comment)).toEqual([
      'before correction',
      'before correction',
      'corrected payload',
    ])
  })

  it('settles a not-entered validation failure and permits a corrected merged payload', async () => {
    const firstOperationId = '55555555-5555-4555-8555-555555555555'
    const nextOperationId = '66666666-6666-4666-8666-666666666666'
    const updateMergedSale = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(
        'invalid merged payload',
        400,
        { MutationLedgerState: 'not-entered' },
      ))
      .mockResolvedValueOnce(undefined)

    const rejected = await advanceWizardMergedSaleSession({
      createOperationId: () => firstOperationId,
      payload: { Comment: 'invalid', NetUid: 'sale-1' },
      updateMergedSale,
    })

    expect(rejected).toEqual({
      error: expect.any(ApiError),
      status: 'definitive-failure',
      submission: null,
    })

    const corrected = await advanceWizardMergedSaleSession({
      createOperationId: () => nextOperationId,
      payload: { Comment: 'corrected', NetUid: 'sale-1' },
      updateMergedSale,
    })

    expect(corrected).toEqual({ status: 'acknowledged', submission: null })
    expect(updateMergedSale.mock.calls.map((call) => call[1]?.operationId)).toEqual([
      firstOperationId,
      nextOperationId,
    ])
  })

  it('uses the canonical OperationNetUid in the generated merged payload and call options', async () => {
    const updateMergedSale = vi.fn().mockResolvedValue(undefined)
    const operationId = '44444444-4444-4444-8444-444444444444'

    await advanceWizardMergedSaleSession({
      createOperationId: () => operationId,
      payload: { NetUid: 'sale-1' },
      updateMergedSale,
    })

    expect(updateMergedSale).toHaveBeenCalledWith(
      { NetUid: 'sale-1', OperationNetUid: operationId },
      { operationId },
    )
  })
})
