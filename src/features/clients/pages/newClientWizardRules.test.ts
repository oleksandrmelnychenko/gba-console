import { describe, expect, it } from 'vitest'
import { errorsForStep, hasNewClientDraftContent, newClientRequiredErrors } from './newClientWizardRules'

const fieldSteps = { FullName: 'general-information', EmailAddress: 'contact-information' } as const

describe('new client wizard rules', () => {
  it('«Далі» reports only the errors of the step being left', () => {
    const errors = { FullName: 'Вкажіть назву клієнта', EmailAddress: 'bad email', Unknown: 'x' }

    expect(errorsForStep(errors, 'general-information', fieldSteps)).toEqual({ FullName: 'Вкажіть назву клієнта' })
    expect(errorsForStep(errors, 'contact-information', fieldSteps)).toEqual({ EmailAddress: 'bad email' })
    expect(errorsForStep(errors, 'role', fieldSteps)).toEqual({})
  })

  it('a client without «Повна назва» and «Назва» is refused', () => {
    expect(newClientRequiredErrors({ FullName: '  ' }, 'Вкажіть назву клієнта')).toEqual({ FullName: 'Вкажіть назву клієнта' })
    expect(newClientRequiredErrors({ Name: 'CH5 Боржник А' }, 'm')).toEqual({})
  })

  it('a restored session is announced only when it holds typed data', () => {
    expect(hasNewClientDraftContent({ ClientAgreements: [], ClientInRole: {} })).toBe(false)
    expect(hasNewClientDraftContent({ FullName: 'CH5 Боржник А' })).toBe(true)
    expect(hasNewClientDraftContent({ ClientAgreements: [{}] })).toBe(true)
  })
})
