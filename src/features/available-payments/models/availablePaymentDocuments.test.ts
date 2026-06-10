import { describe, expect, it } from 'vitest'
import { getTaskPaymentProofDocumentCount } from './availablePaymentDocuments'
import type { AvailablePaymentTaskModel } from '../types'

describe('availablePaymentDocuments', () => {
  it('counts task payment documents and local files as payment proof', () => {
    const model = createModel({
      SupplyPaymentTaskDocuments: [
        { FileName: 'proof.pdf' },
        { Deleted: true, FileName: 'deleted.pdf' },
      ],
    })

    expect(getTaskPaymentProofDocumentCount(model, [{} as File])).toBe(2)
  })

  it('does not count source invoice documents as payment proof', () => {
    const model = createModel({}, [{ FileName: 'invoice.pdf' }])

    expect(getTaskPaymentProofDocumentCount(model, [])).toBe(0)
  })

  it('treats the local files argument as optional for existing proof checks', () => {
    const model = createModel({
      SupplyPaymentTaskDocuments: [{ FileName: 'proof.pdf' }],
    })

    expect(getTaskPaymentProofDocumentCount(model)).toBe(1)
  })
})

function createModel(
  task: Partial<AvailablePaymentTaskModel['task']>,
  documents: AvailablePaymentTaskModel['documents'] = [],
): AvailablePaymentTaskModel {
  return {
    columns: [],
    currencyCode: 'UAH',
    deliveryProductProtocolNetUid: '',
    documents,
    grossPrice: 0,
    id: 'task-1',
    organizationName: '',
    organizationNetUid: '',
    rows: [],
    serviceAgreementNetId: '',
    serviceName: '',
    serviceNumber: '',
    supplyOrderNetUid: '',
    supplyOrderUkraineNetUid: '',
    task,
  }
}
