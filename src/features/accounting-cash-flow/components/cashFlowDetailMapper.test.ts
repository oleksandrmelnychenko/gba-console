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

  it('maps supplier invoice payment protocol rows', () => {
    const detail = mapItemToDetailViewModel({
      Name: 'Supplier invoice',
      Type: 0,
      SupplyOrderPaymentDeliveryProtocol: {
        IsPayed: true,
        SupplyInvoice: {
          DateFrom: '2026-06-02T09:30:00Z',
          InvoiceDocuments: [{ DocumentURL: 'https://example.test/invoice.pdf', FileName: 'invoice.pdf' }],
          NetPrice: 1500,
          Number: 'INV-10',
          ServiceNumber: 'DOC-10',
          SupplyOrder: {
            Client: {
              ClientAgreements: [
                {
                  Agreement: {
                    Currency: {
                      Code: 'EUR',
                    },
                  },
                },
              ],
            },
          },
        },
      },
    } as AccountingCashFlowHeadItem)

    expect(detail?.columnKind).toBe('supplyPaymentTask')
    expect(detail?.rows).toMatchObject([
      {
        Currency: 'EUR',
        FromData: '2026-06-02T09:30:00Z',
        NetPrice: 1500,
        Number: 'INV-10',
        PaymentStatus: { kind: 'paid' },
        ServiceNumber: 'DOC-10',
      },
    ])
    expect(detail?.documents).toEqual([{ name: 'invoice.pdf', url: 'https://example.test/invoice.pdf' }])
  })

  it('maps supplier proform payment protocol rows', () => {
    const detail = mapItemToDetailViewModel({
      Name: 'Supplier proform',
      Type: 0,
      SupplyOrderPaymentDeliveryProtocol: {
        SupplyProForm: {
          DateFrom: '2026-06-03T11:00:00Z',
          NetPrice: '990.5',
          Number: 'PF-12',
          ProFormDocuments: [{ URL: 'https://example.test/proform.pdf', FileName: 'proform.pdf' }],
          ServiceNumber: 'DOC-12',
          SupplyOrders: [
            {
              Client: {
                ClientAgreements: [
                  {
                    Agreement: {
                      Currency: {
                        Code: 'USD',
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    } as AccountingCashFlowHeadItem)

    expect(detail?.columnKind).toBe('supplyPaymentTask')
    expect(detail?.rows).toMatchObject([
      {
        Currency: 'USD',
        FromData: '2026-06-03T11:00:00Z',
        NetPrice: 990.5,
        Number: 'PF-12',
        ServiceNumber: 'DOC-12',
      },
    ])
    expect(detail?.documents).toEqual([{ name: 'proform.pdf', url: 'https://example.test/proform.pdf' }])
  })

  it('maps outcome payment-order nested supply payment tasks', () => {
    const detail = mapItemToDetailViewModel({
      Name: 'Outcome task details',
      Type: 11,
      OutcomePaymentOrder: {
        OutcomePaymentOrderSupplyPaymentTasks: [
          {
            SupplyPaymentTask: {
              IsPayed: true,
              PaymentDeliveryProtocols: [
                {
                  SupplyInvoice: {
                    DateFrom: '2026-06-04T08:00:00Z',
                    InvoiceDocuments: [{ DocumentURL: 'https://example.test/outcome-invoice.pdf', FileName: 'outcome-invoice.pdf' }],
                    NetPrice: 700,
                    Number: 'INV-OUT-1',
                    ServiceNumber: 'DOC-OUT-1',
                    SupplyOrder: {
                      Client: {
                        ClientAgreements: [
                          {
                            Agreement: {
                              Currency: {
                                Code: 'EUR',
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    } as AccountingCashFlowHeadItem)

    expect(detail?.columnKind).toBe('supplyPaymentTask')
    expect(detail?.rows).toMatchObject([
      {
        Currency: 'EUR',
        FromData: '2026-06-04T08:00:00Z',
        NetPrice: 700,
        Number: 'INV-OUT-1',
        PaymentStatus: { kind: 'paid' },
        ServiceNumber: 'DOC-OUT-1',
      },
    ])
    expect(detail?.documents).toEqual([
      { name: 'outcome-invoice.pdf', url: 'https://example.test/outcome-invoice.pdf' },
    ])
  })

  it('maps accounting container payment task services from type 22 payload', () => {
    const detail = mapItemToDetailViewModel({
      Name: 'Accounting container task',
      Type: 22,
      AccountingContainerPaymentTask: {
        IsPayed: true,
        SupplyPaymentTaskDocuments: [
          { DocumentURL: 'https://example.test/accounting-task.pdf', FileName: 'accounting-task.pdf' },
        ],
        ContainerServices: [
          {
            AccountingNetPrice: '225.5',
            ContainerNumber: 'CONT-22',
            FromDate: '2026-06-04T10:00:00Z',
            InvoiceDocuments: [
              { Url: 'https://example.test/accounting-container-service.pdf', FileName: 'container-service.pdf' },
            ],
            Number: 'CS-22',
            ServiceNumber: 'DOC-22',
            SupplyOrganizationAgreement: {
              Currency: {
                Code: 'USD',
              },
            },
          },
        ],
      },
    } as AccountingCashFlowHeadItem)

    expect(detail?.columnKind).toBe('supplyPaymentTask')
    expect(detail?.rows).toMatchObject([
      {
        ContainerNumber: 'CONT-22',
        Currency: 'USD',
        FromData: '2026-06-04T10:00:00Z',
        NetPrice: 225.5,
        Number: 'CS-22',
        PaymentStatus: { kind: 'paid' },
        ServiceNumber: 'DOC-22',
      },
    ])
    expect(detail?.documents).toEqual([
      { name: 'accounting-task.pdf', url: 'https://example.test/accounting-task.pdf' },
      { name: 'container-service.pdf', url: 'https://example.test/accounting-container-service.pdf' },
    ])
  })

  it('maps accounting container service type 31 with accounting base service fields', () => {
    const detail = mapItemToDetailViewModel({
      IsAccounting: true,
      Name: 'Accounting container service',
      Type: 31,
      ContainerService: {
        AccountingGrossPrice: 330,
        AccountingNetPrice: 300,
        AccountingVat: 30,
        AccountingVatPercent: 10,
        FromDate: '2026-06-05',
        GrossPrice: 999,
        InvoiceDocuments: [
          { DocumentURL: 'https://example.test/accounting-container.pdf', FileName: 'accounting-container.pdf' },
        ],
        Name: 'Container fee',
        NetPrice: 999,
        Number: 'CS-31',
        ServiceNumber: 'DOC-31',
        SupplyOrganizationAgreement: {
          Currency: {
            Code: 'EUR',
          },
        },
        Vat: 999,
        VatPercent: 99,
      },
    } as AccountingCashFlowHeadItem)

    expect(detail?.columnKind).toBe('baseService')
    expect(detail?.rows).toEqual([
      {
        Currency: 'EUR',
        FromData: '2026-06-05',
        GrossPrice: 330,
        Name: 'Container fee',
        NetPrice: 300,
        Number: 'CS-31',
        PaymentStatus: null,
        ServiceNumber: 'DOC-31',
        Symbol: '',
        Vat: 30,
        VatPercent: 10,
      },
    ])
    expect(detail?.documents).toEqual([
      { name: 'accounting-container.pdf', url: 'https://example.test/accounting-container.pdf' },
    ])
  })

  it('maps accounting port work service type 32 with service detail items', () => {
    const detail = mapItemToDetailViewModel({
      Name: 'Accounting port work service',
      Type: 32,
      PortWorkService: {
        FromDate: '2026-06-06',
        Number: 'PW-32',
        ServiceDetailItems: [
          {
            GrossPrice: 132,
            NetPrice: 110,
            PaymentStatusType: 3,
            ServiceDetailItemKey: {
              Name: 'Port handling',
              Symbol: 'PORT',
            },
            Vat: 22,
            VatPercent: 20,
          },
        ],
        ServiceNumber: 'DOC-32',
        SupplyOrganizationAgreement: {
          Currency: {
            Code: 'UAH',
          },
        },
      },
    } as AccountingCashFlowHeadItem)

    expect(detail?.columnKind).toBe('baseService')
    expect(detail?.rows).toMatchObject([
      {
        Currency: 'UAH',
        FromData: '2026-06-06',
        GrossPrice: 132,
        Name: 'Port handling',
        NetPrice: 110,
        Number: 'PW-32',
        PaymentStatus: { kind: 'partial' },
        ServiceNumber: 'DOC-32',
        Symbol: 'PORT',
        Vat: 22,
        VatPercent: 20,
      },
    ])
  })

  it('marks the Poland supply-order link as non-navigable', () => {
    const detail = mapItemToDetailViewModel({
      Name: 'Container service',
      Type: 2,
      ContainerService: {
        FromDate: '2026-06-07',
        Number: 'CS-2',
        ServiceNumber: 'DOC-2',
        SupplyOrder: { NetUid: 'poland-uid' },
      },
    } as AccountingCashFlowHeadItem)

    expect(detail?.orderLink).toEqual({
      isNavigable: false,
      route: '/orders/poland/all/edit/poland-uid',
    })
  })

  it('keeps the Ukraine protocols link navigable', () => {
    const detail = mapItemToDetailViewModel({
      Name: 'Merged service',
      Type: 17,
      MergedService: {
        FromDate: '2026-06-08',
        Number: 'MS-17',
        ServiceNumber: 'DOC-17',
        SupplyOrderUkraine: { NetUid: 'ukraine-uid' },
      },
    } as AccountingCashFlowHeadItem)

    expect(detail?.orderLink).toEqual({
      isNavigable: true,
      route: '/orders/ukraine/protocols/ukraine-uid',
    })
  })

  it('returns no order link when the supply order has no identifier', () => {
    const detail = mapItemToDetailViewModel({
      Name: 'Transportation service',
      Type: 5,
      TransportationService: {
        FromDate: '2026-06-09',
        Number: 'TS-5',
        ServiceNumber: 'DOC-5',
        SupplyOrder: {},
      },
    } as AccountingCashFlowHeadItem)

    expect(detail?.orderLink).toBeNull()
  })
})
