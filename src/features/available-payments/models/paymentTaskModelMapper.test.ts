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
})
