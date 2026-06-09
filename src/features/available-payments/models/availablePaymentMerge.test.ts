import { describe, expect, it } from 'vitest'
import { TaskStatusValue, type AvailablePaymentTaskModel, type SupplyPaymentTask } from '../types'
import {
  getAvailablePaymentMergeFailureReason,
  uniqueTaskModels,
  validateAvailablePaymentMerge,
} from './availablePaymentMerge'

type ModelOverride = Partial<Omit<AvailablePaymentTaskModel, 'task'>> & {
  task?: Partial<SupplyPaymentTask>
}

const t = (key: string) => key

function buildModel(overrides: ModelOverride = {}): AvailablePaymentTaskModel {
  const id = overrides.id || 'model-1'
  const task: SupplyPaymentTask = {
    GrossPrice: 100,
    NetUid: id,
    TaskStatus: TaskStatusValue.NotDone,
    ...overrides.task,
  }

  return {
    columns: [],
    currencyCode: 'USD',
    deliveryProductProtocolNetUid: '',
    documents: [],
    grossPrice: 100,
    id,
    mergeKind: 'containerService',
    mergeOrganizationNetUid: 'service-org-1',
    organizationName: 'Service org',
    organizationNetUid: 'payer-org-1',
    rows: [],
    serviceAgreementNetId: '',
    serviceName: 'Container',
    serviceNumber: '',
    supplyOrderNetUid: '',
    supplyOrderUkraineNetUid: '',
    task,
    ...overrides,
  }
}

describe('available payment merge validation', () => {
  it('allows not-done container payment tasks from one service organization', () => {
    const first = buildModel()
    const second = buildModel({ id: 'model-2', task: { NetUid: 'task-2' } })

    expect(validateAvailablePaymentMerge([first, second], t)).toBeNull()
  })

  it('rejects payment tasks with different merge types', () => {
    const first = buildModel()
    const second = buildModel({ id: 'model-2', mergeKind: 'portWorkService', task: { NetUid: 'task-2' } })

    expect(getAvailablePaymentMergeFailureReason([first], second)).toBe('kind')
    expect(validateAvailablePaymentMerge([first, second], t)).toBe(
      'Можна об’єднувати тільки платіжні задачі одного типу',
    )
  })

  it('rejects payment tasks from different service organizations', () => {
    const first = buildModel()
    const second = buildModel({
      id: 'model-2',
      mergeOrganizationNetUid: 'service-org-2',
      task: { NetUid: 'task-2' },
    })

    expect(getAvailablePaymentMergeFailureReason([first], second)).toBe('organization')
  })

  it('does not allow starting a merge set after a non-merge task is selected', () => {
    const selected = buildModel({ mergeKind: undefined })
    const candidate = buildModel({ id: 'model-2', task: { NetUid: 'task-2' } })

    expect(getAvailablePaymentMergeFailureReason([selected], candidate)).toBe('unsupported')
  })

  it('does not treat two models from the same task as mergeable tasks', () => {
    const first = buildModel({ id: 'model-a', task: { NetUid: 'task-1' } })
    const second = buildModel({ id: 'model-b', task: { NetUid: 'task-1' } })

    expect(uniqueTaskModels([first, second])).toHaveLength(1)
    expect(validateAvailablePaymentMerge([first, second], t)).toBe(
      'Виберіть щонайменше дві платіжні задачі для об’єднання',
    )
  })
})
