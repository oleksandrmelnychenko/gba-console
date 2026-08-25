import { describe, expect, it } from 'vitest'
import {
  sanitizeInvoicePaymentDeliveryProtocols,
  sanitizeProFormPaymentDeliveryProtocols,
} from './invoicePaymentProtocolPayload'
import type { SupplyInvoice, SupplyProForm } from './types'

describe('sanitizeInvoicePaymentDeliveryProtocols', () => {
  it('omits a stale task scalar and keeps a true-new task for a new protocol', () => {
    const invoice = createInvoice({
      PaymentDeliveryProtocols: [
        {
          IsAccounting: false,
          SupplyPaymentTaskId: 91,
          SupplyPaymentTask: {
            Comment: 'Оплатити',
          },
          Value: 120,
        },
      ],
    })

    const [protocol] = sanitizeInvoicePaymentDeliveryProtocols(invoice)

    expect(protocol).not.toHaveProperty('SupplyPaymentTaskId')
    expect(protocol?.SupplyPaymentTask).toMatchObject({
      Comment: 'Оплатити',
      GrossPrice: 120,
      IsAccounting: false,
      NetPrice: 120,
    })
    expect(protocol?.SupplyPaymentTask).not.toHaveProperty('Id')
    expect(protocol?.SupplyPaymentTask).not.toHaveProperty('NetUid')
  })

  it('rejects attaching an existing payment-task navigation to a new protocol', () => {
    const invoice = createInvoice({
      PaymentDeliveryProtocols: [
        {
          SupplyPaymentTask: {
            Id: 91,
            NetUid: '716a634b-94e8-4f0e-a79e-91ddf403037d',
          },
          Value: 120,
        },
      ],
    })

    expect(() => sanitizeInvoicePaymentDeliveryProtocols(invoice))
      .toThrow('A new invoice payment protocol requires a true-new payment task')
  })

  it('preserves exact protocol and payment-task identities for an existing protocol', () => {
    const invoice = createInvoice({
      PaymentDeliveryProtocols: [
        {
          Id: 31,
          NetUid: 'b996b20b-f960-4a6d-a76b-1f064c0a703e',
          SupplyPaymentTaskId: 91,
          SupplyPaymentTask: {
            Id: 91,
            NetUid: '716a634b-94e8-4f0e-a79e-91ddf403037d',
          },
          Value: 120,
        },
      ],
    })

    const [protocol] = sanitizeInvoicePaymentDeliveryProtocols(invoice)

    expect(protocol).toMatchObject({
      Id: 31,
      NetUid: 'b996b20b-f960-4a6d-a76b-1f064c0a703e',
      SupplyPaymentTaskId: 91,
      SupplyPaymentTask: {
        Id: 91,
        NetUid: '716a634b-94e8-4f0e-a79e-91ddf403037d',
      },
    })
  })

  it('rejects an existing task without its persisted NetUid', () => {
    const invoice = createInvoice({
      PaymentDeliveryProtocols: [
        {
          Id: 31,
          NetUid: 'b996b20b-f960-4a6d-a76b-1f064c0a703e',
          SupplyPaymentTaskId: 91,
          SupplyPaymentTask: {
            Id: 91,
          },
          Value: 120,
        },
      ],
    })

    expect(() => sanitizeInvoicePaymentDeliveryProtocols(invoice))
      .toThrow('Persisted invoice payment task requires a valid Id and NetUid')
  })

  it('expresses a persisted protocol delete with protocol identity only', () => {
    const invoice = createInvoice({
      PaymentDeliveryProtocols: [
        {
          Deleted: true,
          Id: 31,
          NetUid: 'b996b20b-f960-4a6d-a76b-1f064c0a703e',
          SupplyOrderPaymentDeliveryProtocolKey: {
            Id: 4,
            NetUid: 'e0e0fe95-32a2-4577-91f9-c19d135957f8',
          },
          SupplyPaymentTaskId: 91,
          SupplyPaymentTask: {
            Deleted: true,
            Id: 91,
            NetUid: '716a634b-94e8-4f0e-a79e-91ddf403037d',
          },
        },
      ],
    })

    const [protocol] = sanitizeInvoicePaymentDeliveryProtocols(invoice)

    expect(protocol).toMatchObject({
      Deleted: true,
      Id: 31,
      NetUid: 'b996b20b-f960-4a6d-a76b-1f064c0a703e',
      SupplyOrderPaymentDeliveryProtocolKey: {
        Id: 4,
      },
      SupplyPaymentTask: null,
    })
    expect(protocol).not.toHaveProperty('SupplyPaymentTaskId')
  })

  it('sanitizes only the targeted protocol and leaves unrelated immutable tasks out of the payload', () => {
    const targetProtocol = {
      SupplyPaymentTask: {
        Comment: 'Нова задача',
      },
      Value: 120,
    }
    const invoice = createInvoice({
      PaymentDeliveryProtocols: [
        {
          Id: 31,
          IsAccounting: false,
          NetUid: 'b996b20b-f960-4a6d-a76b-1f064c0a703e',
          SupplyPaymentTaskId: 91,
          SupplyPaymentTask: {
            Id: 91,
            IsAvailableForPayment: true,
            NetUid: '716a634b-94e8-4f0e-a79e-91ddf403037d',
          },
          Value: 80,
        },
        targetProtocol,
      ],
    })

    const payload = sanitizeInvoicePaymentDeliveryProtocols(
      invoice,
      [targetProtocol],
    )

    expect(payload).toHaveLength(1)
    expect(payload[0]).not.toHaveProperty('Id')
    expect(payload[0]?.SupplyPaymentTask).toMatchObject({
      Comment: 'Нова задача',
      GrossPrice: 120,
      NetPrice: 120,
    })
    expect(payload).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          Id: 31,
        }),
      ]),
    )
  })
})

describe('sanitizeProFormPaymentDeliveryProtocols', () => {
  it('links a true-new payment task only to its persisted proforma', () => {
    const proForm: SupplyProForm = {
      Id: 17,
      NetUid: '4d13e9d8-e66b-4e40-bf68-e946954b8809',
      PaymentDeliveryProtocols: [
        {
          SupplyInvoiceId: 27,
          SupplyPaymentTaskId: 91,
          SupplyPaymentTask: {
            Comment: 'Оплатити проформу',
          },
          Value: 1_250.5,
        },
      ],
    }

    const [protocol] = sanitizeProFormPaymentDeliveryProtocols(proForm)

    expect(protocol).toMatchObject({
      SupplyInvoiceId: null,
      SupplyProFormId: 17,
      SupplyPaymentTask: {
        Comment: 'Оплатити проформу',
        GrossPrice: 1_250.5,
        NetPrice: 1_250.5,
      },
      Value: 1_250.5,
    })
    expect(protocol).not.toHaveProperty('SupplyPaymentTaskId')
    expect(protocol?.SupplyPaymentTask).not.toHaveProperty('Id')
    expect(protocol?.SupplyPaymentTask).not.toHaveProperty('NetUid')
  })
})

function createInvoice(overrides: Partial<SupplyInvoice> = {}): SupplyInvoice {
  return {
    Id: 12,
    NetUid: '62d98a8e-fb19-4be7-a9ce-2fcb4f57ba9a',
    ...overrides,
  }
}
