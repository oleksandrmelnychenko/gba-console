import { TaskStatusValue, type AvailablePaymentTaskModel } from '../types'

type Translate = (key: string) => string

export type AvailablePaymentMergeFailureReason =
  | 'unsupported'
  | 'done'
  | 'kind'
  | 'organization'
  | 'minimum'

const mergeFailureMessages = {
  unsupported: 'Об’єднання підтримується тільки для контейнерних та портових платіжних задач',
  done: 'Можна об’єднувати тільки незавершені платіжні задачі',
  kind: 'Можна об’єднувати тільки платіжні задачі одного типу',
  organization: 'Можна об’єднувати тільки платіжні задачі однієї сервісної організації',
  minimum: 'Виберіть щонайменше дві платіжні задачі для об’єднання',
} satisfies Record<AvailablePaymentMergeFailureReason, string>

export function getAvailablePaymentMergeFailureReason(
  selectedModels: AvailablePaymentTaskModel[],
  candidate: AvailablePaymentTaskModel,
): AvailablePaymentMergeFailureReason | null {
  if (!candidate.mergeKind) {
    return 'unsupported'
  }

  if (candidate.task.TaskStatus === TaskStatusValue.Done) {
    return 'done'
  }

  const reference = selectedModels.find((model) => model.mergeKind)

  if (!reference) {
    return selectedModels.length > 0 ? 'unsupported' : null
  }

  if (reference.mergeKind !== candidate.mergeKind) {
    return 'kind'
  }

  if (
    reference.mergeOrganizationNetUid
    && candidate.mergeOrganizationNetUid
    && reference.mergeOrganizationNetUid !== candidate.mergeOrganizationNetUid
  ) {
    return 'organization'
  }

  return null
}

export function getAvailablePaymentMergeError(
  selectedModels: AvailablePaymentTaskModel[],
  candidate: AvailablePaymentTaskModel,
  t: Translate,
): string | null {
  const reason = getAvailablePaymentMergeFailureReason(selectedModels, candidate)

  return reason ? t(mergeFailureMessages[reason]) : null
}

export function validateAvailablePaymentMerge(
  models: AvailablePaymentTaskModel[],
  t: Translate,
): string | null {
  const uniqueModels = uniqueTaskModels(models)

  if (uniqueModels.length < 2) {
    return t(mergeFailureMessages.minimum)
  }

  for (let index = 0; index < uniqueModels.length; index += 1) {
    const reason = getAvailablePaymentMergeFailureReason(uniqueModels.slice(0, index), uniqueModels[index])

    if (reason) {
      return t(mergeFailureMessages[reason])
    }
  }

  return null
}

export function uniqueTaskModels(models: AvailablePaymentTaskModel[]): AvailablePaymentTaskModel[] {
  const modelsByTaskKey = new Map<string, AvailablePaymentTaskModel>()

  models.forEach((model, index) => {
    const key = String(model.task.NetUid || model.task.Id || model.id || index)

    if (!modelsByTaskKey.has(key)) {
      modelsByTaskKey.set(key, model)
    }
  })

  return [...modelsByTaskKey.values()]
}
