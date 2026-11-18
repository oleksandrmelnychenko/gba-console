import { describe, expect, it } from 'vitest'
import { getDirectOrderStorageCopies, getDirectOrderStorages } from './directOrderStorageCopies'

describe('direct order storage copies', () => {
  it('lists every storage copy of one 1C document from its invoices', () => {
    const order = {
      ImportedStorageName: 'СКЛАД -3',
      NetUid: 'copy-3',
      SupplyInvoices: [
        { ImportedStorageName: 'СКЛАД -3', SupplyOrderHasArrivedDeliveryProtocol: false, SupplyOrderNetUid: 'copy-3' },
        { ImportedStorageName: 'СКЛАД -1', SupplyOrderHasArrivedDeliveryProtocol: true, SupplyOrderNetUid: 'copy-1' },
      ],
    }

    expect(getDirectOrderStorageCopies(order)).toStrictEqual([
      { hasArrivedDeliveryProtocol: false, netUid: 'copy-3', storage: 'СКЛАД -3' },
      { hasArrivedDeliveryProtocol: true, netUid: 'copy-1', storage: 'СКЛАД -1' },
    ])
    expect(getDirectOrderStorages(order)).toEqual(['СКЛАД -1', 'СКЛАД -3'])
  })

  it('keeps a single copy for native orders and responses without copy references', () => {
    const order = {
      ImportedStorageName: 'СКЛАД -3',
      NetUid: 'order-1',
      SupplyInvoices: [{ Number: 'INV-1' }, { Number: 'INV-2' }],
    }

    expect(getDirectOrderStorageCopies(order)).toEqual([{ netUid: 'order-1', storage: undefined }])
    expect(getDirectOrderStorages(order)).toEqual(['СКЛАД -3'])
    expect(getDirectOrderStorageCopies({ NetUid: 'order-2', SupplyInvoices: [] })).toEqual([{ netUid: 'order-2', storage: undefined }])
    expect(getDirectOrderStorageCopies(null)).toEqual([])
  })

  it('keeps the opened order first when its own invoices are absent', () => {
    expect(getDirectOrderStorageCopies({
      NetUid: 'copy-3',
      ImportedStorageName: 'СКЛАД -3',
      SupplyInvoices: [{ ImportedStorageName: 'СКЛАД -1', SupplyOrderNetUid: 'copy-1' }],
    })).toEqual([
      { netUid: 'copy-3', storage: 'СКЛАД -3' },
      { netUid: 'copy-1', storage: 'СКЛАД -1' },
    ])
  })
})
