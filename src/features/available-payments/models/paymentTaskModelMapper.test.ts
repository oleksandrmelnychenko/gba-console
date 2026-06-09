import { describe, expect, it } from 'vitest'
import { TaskStatusValue, type GroupedPaymentTask } from '../types'
import { buildTaskModels } from './paymentTaskModelMapper'

const t = (key: string) => key

describe('payment task model mapper', () => {
  it('marks fallback payment-task models as unsupported for write actions', () => {
    const models = buildTaskModels(
      {
        SupplyPaymentTasks: [
          {
            GrossPrice: 125,
            NetUid: 'task-1',
            Number: 'PT-1',
            TaskStatus: TaskStatusValue.NotDone,
          },
        ],
      } satisfies GroupedPaymentTask,
      t,
    )

    expect(models).toHaveLength(1)
    expect(models[0]).toMatchObject({
      grossPrice: 125,
      isUnsupported: true,
      serviceName: 'Платіжна задача',
      serviceNumber: 'PT-1',
    })
  })

  it('uses supply order organization as the payer organization for proform payment protocols', () => {
    const models = buildTaskModels(
      {
        SupplyPaymentTasks: [
          {
            GrossPrice: 200,
            NetUid: 'task-1',
            PaymentDeliveryProtocols: [
              {
                SupplyProForm: {
                  Number: 'PF-1',
                  SupplyOrders: [
                    {
                      Client: { FullName: 'Client A', NetUid: 'client-1' },
                      ClientAgreement: {
                        Agreement: {
                          Currency: { Code: 'EUR', Id: 2, NetUid: 'currency-eur' },
                          Organization: { Id: 12, Name: 'Agreement Org', NetUid: 'agreement-org' },
                        },
                        NetUid: 'agreement-1',
                      },
                      NetUid: 'supply-1',
                      Organization: { Id: 7, Name: 'AMG', NetUid: 'payer-org' },
                    },
                  ],
                },
                Value: 200,
              },
            ],
            TaskStatus: TaskStatusValue.NotDone,
          },
        ],
      } satisfies GroupedPaymentTask,
      t,
    )

    expect(models[0]).toMatchObject({
      organization: { Id: 7, Name: 'AMG', NetUid: 'payer-org' },
      organizationName: 'Client A',
      organizationNetUid: 'payer-org',
    })
  })

  it('keeps service detail rows for supplier services', () => {
    const models = buildTaskModels(
      {
        SupplyPaymentTasks: [
          {
            CustomAgencyServices: [
              {
                CustomAgencyOrganization: { Name: 'Custom agency', NetUid: 'custom-org' },
                FromDate: '2026-06-01T00:00:00Z',
                GrossPrice: 120,
                NetPrice: 100,
                Number: 'CS-1',
                ServiceDetailItems: [
                  {
                    GrossPrice: 60,
                    NetPrice: 50,
                    Qty: 2,
                    ServiceDetailItemKey: { Name: 'Broker fee', Symbol: 'BRK' },
                    Vat: 10,
                    VatPercent: 20,
                  },
                  {
                    GrossPrice: 30,
                    NetPrice: 25,
                    Qty: 1,
                    ServiceDetailItemKey: { Name: 'Docs', Symbol: 'DOC' },
                    Vat: 5,
                    VatPercent: 20,
                  },
                ],
                ServiceNumber: 'SV-1',
                SupplyOrganizationAgreement: { Currency: { Code: 'EUR' }, NetUid: 'agreement-1' },
                SupplyOrders: [{ Organization: { Name: 'AMG', NetUid: 'payer-org' } }],
              },
            ],
            GrossPrice: 90,
            NetUid: 'task-1',
            TaskStatus: TaskStatusValue.NotDone,
          },
        ],
      } satisfies GroupedPaymentTask,
      t,
    )

    expect(models[0].columns.map((column) => column.key)).toEqual(
      expect.arrayContaining(['name', 'symbol', 'quantity']),
    )
    expect(models[0].rows).toMatchObject([
      {
        currency: 'EUR',
        grossPrice: 60,
        name: 'Broker fee',
        netPrice: 50,
        quantity: 2,
        symbol: 'BRK',
      },
      {
        currency: 'EUR',
        grossPrice: 30,
        name: 'Docs',
        netPrice: 25,
        quantity: 1,
        symbol: 'DOC',
      },
    ])
  })

  it('uses bill-of-lading document date and number for container service rows', () => {
    const models = buildTaskModels(
      {
        SupplyPaymentTasks: [
          {
            ContainerServices: [
              {
                AccountingGrossPrice: 130,
                AccountingNetPrice: 110,
                BillOfLadingDocument: { Date: '2026-05-20T00:00:00Z', Number: 'BL-77' },
                ContainerNumber: 'CONT-1',
                ContainerOrganization: { Name: 'Container org', NetUid: 'container-org' },
                FromDate: '2026-06-01T00:00:00Z',
                GrossPrice: 120,
                NetPrice: 100,
                Number: 'SERVICE-1',
                ServiceNumber: 'SV-2',
                SupplyOrganizationAgreement: {
                  Currency: { Code: 'USD' },
                  Organization: { Name: 'AMG', NetUid: 'payer-org' },
                },
              },
            ],
            GrossPrice: 120,
            NetUid: 'task-1',
            TaskStatus: TaskStatusValue.NotDone,
          },
        ],
      } satisfies GroupedPaymentTask,
      t,
    )

    expect(models[0].rows[0]).toMatchObject({
      containerNumber: 'CONT-1',
      date: '2026-05-20T00:00:00Z',
      netPrice: 100,
      number: 'BL-77',
    })
  })

  it('expands bill-of-lading service rows per document', () => {
    const models = buildTaskModels(
      {
        SupplyPaymentTasks: [
          {
            BillOfLadingServices: [
              {
                BillOfLadingDocuments: [
                  { Date: '2026-05-21T00:00:00Z', Number: 'BL-1' },
                  { Date: '2026-05-22T00:00:00Z', Number: 'BL-2' },
                ],
                BillOfLadingNumber: 'SHIP-1',
                GrossPrice: 240,
                NetPrice: 200,
                ServiceNumber: 'SV-3',
                SupplyOrganization: { Name: 'BL org', NetUid: 'bl-org' },
                SupplyOrganizationAgreement: {
                  Currency: { Code: 'USD' },
                  Organization: { Name: 'AMG', NetUid: 'payer-org' },
                },
                TypeBillOfLadingService: 0,
              },
            ],
            GrossPrice: 240,
            NetUid: 'task-1',
            TaskStatus: TaskStatusValue.NotDone,
          },
        ],
      } satisfies GroupedPaymentTask,
      t,
    )

    expect(models[0].rows).toMatchObject([
      { containerNumber: 'SHIP-1', date: '2026-05-21T00:00:00Z', number: 'BL-1' },
      { containerNumber: 'SHIP-1', date: '2026-05-22T00:00:00Z', number: 'BL-2' },
    ])
  })

  it('uses task net price as payment amount for Ukraine delivery protocols', () => {
    const models = buildTaskModels(
      {
        SupplyPaymentTasks: [
          {
            GrossPrice: 120,
            NetPrice: 100,
            NetUid: 'task-1',
            SupplyOrderUkrainePaymentDeliveryProtocols: [
              {
                Discount: 50,
                SupplyOrderUkraine: {
                  ClientAgreement: {
                    Agreement: { Currency: { Code: 'UAH', NetUid: 'currency-uah' } },
                    NetUid: 'agreement-1',
                  },
                  FromDate: '2026-06-01T00:00:00Z',
                  InvNumber: 'INV-UA-1',
                  Number: 'UA-1',
                  Organization: { Name: 'AMG', NetUid: 'payer-org' },
                  Supplier: { FullName: 'Supplier A', NetUid: 'supplier-1' },
                  TotalNetPriceLocal: 100,
                  TotalVatAmount: 20,
                  VatPercent: 20,
                },
                Value: 120,
              },
            ],
            TaskStatus: TaskStatusValue.NotDone,
          },
        ],
      } satisfies GroupedPaymentTask,
      t,
    )

    expect(models[0]).toMatchObject({
      organizationName: 'Supplier A',
      paymentAmount: 100,
    })
    expect(models[0].columns.map((column) => column.key)).toEqual(
      expect.arrayContaining(['paymentType', 'currency']),
    )
  })

  it('keeps merged service number as a dedicated column', () => {
    const models = buildTaskModels(
      {
        SupplyPaymentTasks: [
          {
            GrossPrice: 120,
            MergedServices: [
              {
                FromDate: '2026-06-01T00:00:00Z',
                GrossPrice: 120,
                NetPrice: 100,
                Number: 'MERGED-1',
                ServiceNumber: 'SV-4',
                SupplyOrganization: { Name: 'Merged org', NetUid: 'merged-org' },
                SupplyOrganizationAgreement: {
                  Currency: { Code: 'EUR' },
                  Organization: { Name: 'AMG', NetUid: 'payer-org' },
                },
              },
            ],
            NetUid: 'task-1',
            TaskStatus: TaskStatusValue.NotDone,
          },
        ],
      } satisfies GroupedPaymentTask,
      t,
    )

    expect(models[0].columns.map((column) => column.key)).toContain('mergedServiceNumber')
    expect(models[0].rows[0]).toMatchObject({ mergedServiceNumber: 'MERGED-1' })
  })
})
