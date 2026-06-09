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
})
