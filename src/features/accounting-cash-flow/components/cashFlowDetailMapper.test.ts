import { describe, expect, it } from 'vitest'
import { mapItemToDetailViewModel } from './cashFlowDetailMapper'
import type { AccountingCashFlowHeadItem } from '../types'

describe('cashFlowDetailMapper', () => {
  it('filters deleted documents and reads supported document URL variants', () => {
    const detail = mapItemToDetailViewModel({
      Name: 'Custom service',
      Type: 7,
      CustomAgencyService: {
        InvoiceDocuments: [
          { Deleted: true, DocumentUrl: 'https://example.test/deleted.pdf', FileName: 'deleted.pdf' },
          { DocumentURL: 'https://example.test/invoice.pdf', FileName: 'invoice.pdf' },
          { PdfDocumentURL: 'https://example.test/invoice-print.pdf', Name: 'invoice print' },
        ],
      },
    } as AccountingCashFlowHeadItem)

    expect(detail?.documents).toEqual([
      { name: 'invoice.pdf', url: 'https://example.test/invoice.pdf' },
      { name: 'invoice print', url: 'https://example.test/invoice-print.pdf' },
    ])
  })

  it('maps non-container supply payment task services with their documents', () => {
    const detail = mapItemToDetailViewModel({
      Name: 'Supply task',
      Type: 14,
      SupplyPaymentTask: {
        SupplyPaymentTaskDocuments: [{ DocumentURL: 'https://example.test/task.pdf', FileName: 'task.pdf' }],
        TransportationServices: [
          {
            FromDate: '2026-06-03T10:00:00Z',
            InvoiceDocuments: [{ Url: 'https://example.test/service.pdf', FileName: 'service.pdf' }],
            NetPrice: 120,
            Number: 'TR-1',
            ServiceNumber: 'DOC-1',
            SupplyOrganizationAgreement: {
              Currency: {
                Code: 'EUR',
              },
            },
          },
        ],
      },
    } as AccountingCashFlowHeadItem)

    expect(detail?.columnKind).toBe('supplyPaymentTask')
    expect(detail?.rows).toMatchObject([
      {
        Currency: 'EUR',
        FromData: '2026-06-03T10:00:00Z',
        NetPrice: 120,
        Number: 'TR-1',
        ServiceNumber: 'DOC-1',
      },
    ])
    expect(detail?.documents).toEqual([
      { name: 'task.pdf', url: 'https://example.test/task.pdf' },
      { name: 'service.pdf', url: 'https://example.test/service.pdf' },
    ])
  })
})
