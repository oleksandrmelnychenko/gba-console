import { TaskStatusValue, type AvailablePaymentTaskModel } from '../types'

export type AvailablePaymentSelectionFailureReason =
  | 'unsupported'
  | 'done'
  | 'organization'
  | 'currency'
  | 'agreement'
  | 'accountingMode'

type Translate = (key: string) => string

const selectionFailureMessages = {
  unsupported: 'Цей тип платіжної задачі ще не підтримується для створення видаткового ордера',
  done: 'Можна обрати тільки незавершені платіжні задачі',
  organization: 'Можна обрати платіжні задачі тільки одного контрагента',
  currency: 'Можна обрати платіжні задачі тільки в одній валюті',
  agreement: 'Можна обрати платіжні задачі тільки однієї угоди',
  accountingMode: 'Можна обрати платіжні задачі тільки одного типу обліку',
} satisfies Record<AvailablePaymentSelectionFailureReason, string>

export function getAvailablePaymentSelectionFailureReason(
  selectedModels: AvailablePaymentTaskModel[],
  candidate: AvailablePaymentTaskModel,
): AvailablePaymentSelectionFailureReason | null {
  if (candidate.isUnsupported) {
    return 'unsupported'
  }

  if (candidate.task.TaskStatus === TaskStatusValue.Done) {
    return 'done'
  }

  const referenceModel = selectedModels[0]

  if (!referenceModel) {
    return null
  }

  if (referenceModel.organizationNetUid !== candidate.organizationNetUid) {
    return 'organization'
  }

  if (referenceModel.currencyCode !== candidate.currencyCode) {
    return 'currency'
  }

  const referenceAgreementNetId = selectedModels.find((model) => model.serviceAgreementNetId)?.serviceAgreementNetId

  if (referenceAgreementNetId && candidate.serviceAgreementNetId && referenceAgreementNetId !== candidate.serviceAgreementNetId) {
    return 'agreement'
  }

  if (Boolean(referenceModel.task.IsAccounting) !== Boolean(candidate.task.IsAccounting)) {
    return 'accountingMode'
  }

  return null
}

export function getAvailablePaymentSelectionError(
  selectedModels: AvailablePaymentTaskModel[],
  candidate: AvailablePaymentTaskModel,
  t: Translate,
): string | null {
  const reason = getAvailablePaymentSelectionFailureReason(selectedModels, candidate)

  return reason ? t(selectionFailureMessages[reason]) : null
}

export function validateAvailablePaymentSelection(
  models: AvailablePaymentTaskModel[],
  t: Translate,
): string | null {
  const firstModel = models[0]

  if (!firstModel) {
    return t('Виберіть платіжні задачі')
  }

  for (let index = 0; index < models.length; index += 1) {
    const reason = getAvailablePaymentSelectionFailureReason(models.slice(0, index), models[index])

    if (reason) {
      return t(selectionFailureMessages[reason])
    }
  }

  return null
}
