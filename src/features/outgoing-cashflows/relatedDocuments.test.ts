import { describe, expect, it } from 'vitest'
import { getPaymentTaskConsumablesOrders, mayHavePaymentTaskDocuments } from './relatedDocuments'

// N3-04: QAU0000000027 paid invoice 0000000006 from Платежі; «Пов’язані документи» was empty.
describe('outgoing order documents linked through a payment task', () => {
  const invoice = { Id: 6, NetUid: 'invoice-6', Number: '0000000006' }

  it('lists the invoice of each paid payment task', () => {
    expect(getPaymentTaskConsumablesOrders({
      NetUid: 'order-27',
      OutcomePaymentOrderSupplyPaymentTasks: [
        { Id: 5, NetUid: 'link-5', Amount: 102, SupplyPaymentTask: { Id: 10, ConsumablesOrder: invoice } },
        { Id: 6, Deleted: true, SupplyPaymentTask: { Id: 11, ConsumablesOrder: { Id: 7 } } },
        { Id: 7, SupplyPaymentTask: { Id: 12, ConsumablesOrder: null } },
      ],
    })).toEqual([{ Id: 5, NetUid: 'link-5', ConsumablesOrder: invoice, PaidThroughPaymentTask: 102 }])
  })

  it('reads the details only for a regular order without directly linked documents', () => {
    expect(mayHavePaymentTaskDocuments({ NetUid: 'order-27' })).toBe(true)
    expect(mayHavePaymentTaskDocuments({ NetUid: 'advance-10', IsUnderReport: true })).toBe(false)
    expect(mayHavePaymentTaskDocuments({ NetUid: 'order-22', OutcomePaymentOrderConsumablesOrders: [{ ConsumablesOrder: invoice }] })).toBe(false)
    expect(mayHavePaymentTaskDocuments(null)).toBe(false)
  })
})
