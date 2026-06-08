import { describe, expect, it } from 'vitest'
import {
  getAvailablePaymentSelectionFailureReason,
  validateAvailablePaymentSelection,
} from './availablePaymentSelection'
import { TaskStatusValue, type AvailablePaymentTaskModel, type SupplyPaymentTask } from '../types'

type ModelOverride = Partial<Omit<AvailablePaymentTaskModel, 'task'>> & {
  task?: Partial<SupplyPaymentTask>
}

const t = (key: string) => key

function buildModel(overrides: ModelOverride = {}): AvailablePaymentTaskModel {
  const id = overrides.id || 'model-1'
  const task: SupplyPaymentTask = {
    GrossPrice: 100,
    IsAccounting: false,
    NetUid: id,
    TaskStatus: TaskStatusValue.NotDone,
    ...overrides.task,
  }

  return {
    columns: [],
    currency: { Code: 'USD', NetUid: 'currency-1' },
    currencyCode: 'USD',
    deliveryProductProtocolNetUid: '',
    documents: [],
    grossPrice: 100,
    id,
    organization: { Name: 'Vendor', NetUid: 'organization-1' },
    organizationName: 'Vendor',
    organizationNetUid: 'organization-1',
    rows: [],
    serviceAgreementNetId: 'agreement-1',
    serviceName: 'Service',
    serviceNumber: '',
    supplyOrderNetUid: '',
    supplyOrderUkraineNetUid: '',
    task,
    ...overrides,
  }
}

describe('available payment selection validation', () => {
  it('allows a not-done candidate with matching organization, currency, agreement, and accounting mode', () => {
    const selected = buildModel()
    const candidate = buildModel({ id: 'model-2', task: { NetUid: 'task-2' } })

    expect(getAvailablePaymentSelectionFailureReason([selected], candidate)).toBeNull()
  })

  it('rejects done candidates even when there is no current selection', () => {
    const candidate = buildModel({ task: { TaskStatus: TaskStatusValue.Done } })

    expect(getAvailablePaymentSelectionFailureReason([], candidate)).toBe('done')
  })

  it('rejects unsupported fallback candidates before any write action', () => {
    const candidate = buildModel({ isUnsupported: true })

    expect(getAvailablePaymentSelectionFailureReason([], candidate)).toBe('unsupported')
    expect(validateAvailablePaymentSelection([candidate], t)).toBe(
      'Цей тип платіжної задачі ще не підтримується для створення видаткового ордера',
    )
  })

  it('rejects candidates from another organization', () => {
    const selected = buildModel()
    const candidate = buildModel({ organizationNetUid: 'organization-2' })

    expect(getAvailablePaymentSelectionFailureReason([selected], candidate)).toBe('organization')
  })

  it('rejects candidates in another currency', () => {
    const selected = buildModel()
    const candidate = buildModel({ currencyCode: 'EUR' })

    expect(getAvailablePaymentSelectionFailureReason([selected], candidate)).toBe('currency')
  })

  it('rejects another agreement only when both models have agreement ids', () => {
    const selected = buildModel()
    const candidate = buildModel({ serviceAgreementNetId: 'agreement-2' })
    const candidateWithoutAgreement = buildModel({ serviceAgreementNetId: '' })

    expect(getAvailablePaymentSelectionFailureReason([selected], candidate)).toBe('agreement')
    expect(getAvailablePaymentSelectionFailureReason([selected], candidateWithoutAgreement)).toBeNull()
  })

  it('compares candidate agreements with any selected agreement that is present', () => {
    const selectedWithoutAgreement = buildModel({ serviceAgreementNetId: '' })
    const selectedWithAgreement = buildModel({ id: 'model-2', serviceAgreementNetId: 'agreement-1' })
    const candidate = buildModel({ id: 'model-3', serviceAgreementNetId: 'agreement-2' })

    expect(getAvailablePaymentSelectionFailureReason([selectedWithoutAgreement, selectedWithAgreement], candidate)).toBe(
      'agreement',
    )
  })

  it('rejects candidates from another accounting mode', () => {
    const selected = buildModel()
    const candidate = buildModel({ task: { IsAccounting: true } })

    expect(getAvailablePaymentSelectionFailureReason([selected], candidate)).toBe('accountingMode')
  })

  it('uses the same rules for batch validation', () => {
    const first = buildModel()
    const done = buildModel({ id: 'done', task: { TaskStatus: TaskStatusValue.Done } })
    const otherOrganization = buildModel({ id: 'other-org', organizationNetUid: 'organization-2' })
    const withoutAgreement = buildModel({ id: 'without-agreement', serviceAgreementNetId: '' })
    const agreementOne = buildModel({ id: 'agreement-one', serviceAgreementNetId: 'agreement-1' })
    const agreementTwo = buildModel({ id: 'agreement-two', serviceAgreementNetId: 'agreement-2' })

    expect(validateAvailablePaymentSelection([first, done], t)).toBe('Можна обрати тільки незавершені платіжні задачі')
    expect(validateAvailablePaymentSelection([first, otherOrganization], t)).toBe(
      'Можна обрати платіжні задачі тільки одного контрагента',
    )
    expect(validateAvailablePaymentSelection([withoutAgreement, agreementOne, agreementTwo], t)).toBe(
      'Можна обрати платіжні задачі тільки однієї угоди',
    )
  })
})
