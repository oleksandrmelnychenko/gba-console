import { describe, expect, it } from 'vitest'
import { toProductCapitalizationCreateWirePayload } from './productCapitalizationPayload'
import type { ProductCapitalizationCreatePayload } from './types'

describe('product capitalization wire payload', () => {
  it('maps the active console payload to exact canonical references only', () => {
    const payload = createPayload() as ProductCapitalizationCreatePayload & {
      Id: number
      NetUid: string
      Number: string
      ResponsibleId: number
    }
    payload.Id = 999
    payload.NetUid = '99999999-9999-4999-8999-999999999999'
    payload.Number = 'UNTRUSTED'
    payload.ResponsibleId = 123
    Object.assign(payload.Organization, {
      Code: "X'; DROP TABLE ProductCapitalization;--",
      Name: 'Untrusted label',
    })
    Object.assign(payload.Storage, {
      Name: 'Untrusted storage label',
    })
    Object.assign(payload.ProductCapitalizationItems[0], {
      Id: 456,
      NetUid: '88888888-8888-4888-8888-888888888888',
      RemainingQty: 999,
      TotalAmount: 999,
      ProductName: 'Untrusted product label',
    })

    const wire =
      toProductCapitalizationCreateWirePayload(payload)

    expect(wire).toEqual({
      Comment: 'count correction',
      FromDate: '2026-07-26T10:00:00.000Z',
      Organization: {
        Id: 11,
        NetUid: '11111111-1111-4111-8111-111111111111',
      },
      OrganizationId: 11,
      ProductCapitalizationItems: [{
        Product: {
          Id: 31,
          NetUid: '33333333-3333-4333-8333-333333333333',
        },
        ProductId: 31,
        Qty: 2.5,
        UnitPrice: 0,
        Weight: 0.25,
      }],
      Storage: {
        Id: 21,
        NetUid: '22222222-2222-4222-8222-222222222222',
      },
      StorageId: 21,
    })
    expect(JSON.stringify(wire)).not.toContain('DROP TABLE')
    expect(JSON.stringify(wire)).not.toContain('Responsible')
    expect(JSON.stringify(wire)).not.toContain('RemainingQty')
    expect(Object.isFrozen(wire)).toBe(true)
    expect(Object.isFrozen(wire.ProductCapitalizationItems[0])).toBe(true)
  })

  it.each([
    ['quantity', Number.NaN, 0, 0],
    ['quantity', Number.POSITIVE_INFINITY, 0, 0],
    ['quantity', 0, 0, 0],
    ['unit price', 1, -1, 0],
    ['weight', 1, 0, Number.NEGATIVE_INFINITY],
    ['weight', 1, 0, -1],
  ])(
    'rejects invalid %s before issuing a request',
    (_name, quantity, unitPrice, weight) => {
      const payload = createPayload()
      Object.assign(payload.ProductCapitalizationItems[0], {
        Qty: quantity,
        UnitPrice: unitPrice,
        Weight: weight,
      })

      expect(() =>
        toProductCapitalizationCreateWirePayload(payload),
      ).toThrow()
    },
  )

  it('rejects duplicate products and missing canonical NetUid', () => {
    const duplicate = createPayload()
    duplicate.ProductCapitalizationItems.push({
      ...duplicate.ProductCapitalizationItems[0],
      Product: {
        ...duplicate.ProductCapitalizationItems[0].Product,
      },
    })
    expect(() =>
      toProductCapitalizationCreateWirePayload(duplicate),
    ).toThrow('Duplicate product rows')

    const missingNetUid = createPayload()
    delete missingNetUid.Organization.NetUid
    expect(() =>
      toProductCapitalizationCreateWirePayload(missingNetUid),
    ).toThrow('organization NetUid')
  })

  it.each([
    ['1752-12-31T23:59:59.999Z'],
    ['+010000-01-01T00:00:00.000Z'],
  ])('rejects date %s outside the SQL datetime range', (fromDate) => {
    const payload = createPayload()
    payload.FromDate = fromDate

    expect(() =>
      toProductCapitalizationCreateWirePayload(payload),
    ).toThrow('SQL datetime range')
  })
})

function createPayload(): ProductCapitalizationCreatePayload {
  return {
    Comment: 'count correction',
    FromDate: '2026-07-26T10:00:00.000Z',
    Organization: {
      Id: 11,
      NetUid: '11111111-1111-4111-8111-111111111111',
    },
    ProductCapitalizationItems: [{
      Product: {
        Id: 31,
        NetUid: '33333333-3333-4333-8333-333333333333',
      },
      ProductId: 31,
      Qty: 2.5,
      UnitPrice: 0,
      Weight: 0.25,
    }],
    Storage: {
      Id: 21,
      NetUid: '22222222-2222-4222-8222-222222222222',
    },
  }
}
