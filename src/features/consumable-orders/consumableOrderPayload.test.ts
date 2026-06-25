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
})
