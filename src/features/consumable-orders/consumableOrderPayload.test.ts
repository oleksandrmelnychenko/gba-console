import { describe, expect, it } from 'vitest'
import { sanitizeConsumableOrderPayload } from './consumableOrderPayload'
import type { ConsumablesOrder } from './types'

describe('consumable order payload', () => {
  it('removes local NetUid values before multipart upload', () => {
    const validNetUid = '2d11197c-d74e-4d15-b87a-4074750d79c9'
    const order: ConsumablesOrder = {
      NetUid: validNetUid,
      ConsumableProductOrganization: {
        Name: 'Supplier',
        NetUid: validNetUid,
      },
      ConsumablesOrderDocuments: [
        {
          FileName: 'invoice.pdf',
          NetUid: 'local-document',
        },
      ],
      ConsumablesOrderItems: [
        {
          Id: 10,
          NetUid: validNetUid,
        },
        {
          Id: -1,
          NetUid: 'local-item',
          PaymentCostMovementOperation: {
            NetUid: '',
            PaymentCostMovement: {
              NetUid: 'local-movement',
              OperationName: 'Service',
            },
          },
        },
      ],
    }

    const payload = sanitizeConsumableOrderPayload(order)

    expect(payload.NetUid).toBe(validNetUid)
    expect(payload.ConsumableProductOrganization?.NetUid).toBe(validNetUid)
    expect(payload.ConsumablesOrderDocuments?.[0]).not.toHaveProperty('NetUid')
    expect(payload.ConsumablesOrderItems?.[0]?.NetUid).toBe(validNetUid)
    expect(payload.ConsumablesOrderItems?.[1]).not.toHaveProperty('NetUid')
    expect(payload.ConsumablesOrderItems?.[1]?.PaymentCostMovementOperation).not.toHaveProperty('NetUid')
    expect(payload.ConsumablesOrderItems?.[1]?.PaymentCostMovementOperation?.PaymentCostMovement).not.toHaveProperty('NetUid')
  })

  it('does not attach an existing payment-task scalar to a new consumables order', () => {
    const order: ConsumablesOrder = {
      SupplyPaymentTaskId: 91,
      SupplyPaymentTask: {
        Comment: 'Нова задача',
      },
    }

    const payload = sanitizeConsumableOrderPayload(order)

    expect(payload).not.toHaveProperty('SupplyPaymentTaskId')
    expect(payload.SupplyPaymentTask).toEqual({
      Comment: 'Нова задача',
    })
  })

  it('preserves the canonical payment-task scalar for a persisted consumables order', () => {
    const order: ConsumablesOrder = {
      Id: 12,
      NetUid: '2d11197c-d74e-4d15-b87a-4074750d79c9',
      SupplyPaymentTaskId: 91,
      SupplyPaymentTask: {
        Id: 91,
        NetUid: '716a634b-94e8-4f0e-a79e-91ddf403037d',
      },
    }

    const payload = sanitizeConsumableOrderPayload(order)

    expect(payload.SupplyPaymentTaskId).toBe(91)
    expect(payload.SupplyPaymentTask).toMatchObject({
      Id: 91,
      NetUid: '716a634b-94e8-4f0e-a79e-91ddf403037d',
    })
  })
})
