import { describe, expect, it } from 'vitest'
import { createInvoiceDiscountPayload } from './invoiceMetadataPayload'
import type { SupplyInvoice } from './types'

describe('createInvoiceDiscountPayload', () => {
  it('updates only the invoice discount without replaying payment tasks', () => {
    const invoice: SupplyInvoice = {
      DiscountAmount: 25,
      Id: 724710,
      InvoiceDocuments: [{ Id: 41, FileName: 'invoice.xlsx' }],
      NetPrice: 29_187.93,
      NetUid: 'ec9b757c-1394-406b-9602-d3ebb5df1c7e',
      Number: '8',
      PaymentDeliveryProtocols: [{ Id: 51, Value: 1_000 }],
      SupplyOrder: { Id: 61 },
    }

    const payload = createInvoiceDiscountPayload(invoice, 125.37)

    expect(payload).toMatchObject({
      DiscountAmount: 125.37,
      Id: 724710,
      InvoiceDocuments: [{ Id: 41, FileName: 'invoice.xlsx' }],
      NetPrice: 29_187.93,
      Number: '8',
      PaymentDeliveryProtocols: [],
      SupplyOrder: null,
    })
  })
})
