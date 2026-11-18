import { describe, expect, it } from 'vitest'
import {
  canOpenDirectProductIncomeFromOrder,
  canOpenDirectProductIncomeFromCopy,
  canOpenDirectProductIncomeFromRow,
  hasArrivedDeliveryProtocolForInvoice,
} from './directOrderActions'

describe('direct order actions', () => {
  it('hides product income until the API confirms an arrived delivery protocol', () => {
    expect(canOpenDirectProductIncomeFromRow({ kind: 'direct', netUid: 'order-1' }, true)).toBe(false)
    expect(canOpenDirectProductIncomeFromRow({
      directOrder: { HasArrivedDeliveryProtocol: false },
      kind: 'direct',
      netUid: 'order-1',
    }, true)).toBe(false)
    expect(canOpenDirectProductIncomeFromOrder({ NetUid: 'order-1' }, true)).toBe(false)
    expect(canOpenDirectProductIncomeFromOrder({
      HasArrivedDeliveryProtocol: false,
      NetUid: 'order-1',
    }, true)).toBe(false)
  })

  it('shows product income after the linked delivery protocol has arrived', () => {
    expect(canOpenDirectProductIncomeFromRow({
      directOrder: { HasArrivedDeliveryProtocol: true },
      kind: 'direct',
      netUid: 'order-1',
    }, true)).toBe(true)
    expect(canOpenDirectProductIncomeFromOrder({
      HasArrivedDeliveryProtocol: true,
      NetUid: 'order-1',
    }, true)).toBe(true)
  })

  it('still respects permission, route identity and order kind', () => {
    const directOrder = { HasArrivedDeliveryProtocol: true }

    expect(canOpenDirectProductIncomeFromRow({ directOrder, kind: 'direct', netUid: 'order-1' }, false)).toBe(false)
    expect(canOpenDirectProductIncomeFromRow({ directOrder, kind: 'direct', netUid: '' }, true)).toBe(false)
    expect(canOpenDirectProductIncomeFromRow({ directOrder, kind: 'toUkraine', netUid: 'order-1' }, true)).toBe(false)
    expect(canOpenDirectProductIncomeFromOrder({ HasArrivedDeliveryProtocol: true, NetUid: 'order-1' }, false)).toBe(false)
    expect(canOpenDirectProductIncomeFromOrder({ HasArrivedDeliveryProtocol: true, NetUid: '' }, true)).toBe(false)
  })

  it('allows only invoices from an active arrived protocol', () => {
    expect(hasArrivedDeliveryProtocolForInvoice(undefined)).toBe(false)
    expect(hasArrivedDeliveryProtocolForInvoice({ DeliveryProductProtocol: null })).toBe(false)
    expect(hasArrivedDeliveryProtocolForInvoice({
      DeliveryProductProtocol: { IsCompleted: false },
    })).toBe(false)
    expect(hasArrivedDeliveryProtocolForInvoice({
      DeliveryProductProtocol: { Deleted: true, IsCompleted: true },
    })).toBe(false)
    expect(hasArrivedDeliveryProtocolForInvoice({
      DeliveryProductProtocol: { Deleted: false, IsCompleted: true },
    })).toBe(true)
  })

  it('uses each storage copy\'s own arrived delivery protocol and falls back to the row for older responses', () => {
    const row = { directOrder: { HasArrivedDeliveryProtocol: true }, kind: 'direct' as const }

    expect(canOpenDirectProductIncomeFromCopy(row, { hasArrivedDeliveryProtocol: false, netUid: 'copy-1' }, true)).toBe(false)
    expect(canOpenDirectProductIncomeFromCopy({ ...row, directOrder: { HasArrivedDeliveryProtocol: false } }, { hasArrivedDeliveryProtocol: true, netUid: 'copy-2' }, true)).toBe(true)
    expect(canOpenDirectProductIncomeFromCopy(row, { netUid: 'copy-3' }, true)).toBe(true)
    expect(canOpenDirectProductIncomeFromCopy(row, { hasArrivedDeliveryProtocol: true, netUid: 'copy-4' }, false)).toBe(false)
  })
})
