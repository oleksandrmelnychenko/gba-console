import type { Client } from '../types'

/* «Далі» checks the fields of the step being left, so an empty name is reported on
   «Основна інформація» instead of after walking to the last step. */
export function errorsForStep<TStep extends string>(
  errors: Record<string, string | undefined>,
  step: TStep,
  fieldSteps: Partial<Record<string, TStep>>,
): Record<string, string> {
  return Object.entries(errors).reduce<Record<string, string>>((stepErrors, [field, message]) => {
    if (message && fieldSteps[field] === step) {
      stepErrors[field] = message
    }

    return stepErrors
  }, {})
}

/* A restored session that holds something the user typed: the wizard says so,
   otherwise new typing silently appended to the old names. */
export function hasNewClientDraftContent(draft: Client | undefined): boolean {
  if (!draft) {
    return false
  }

  const textFields = [draft.FullName, draft.Name, draft.FirstName, draft.LastName, draft.MiddleName, draft.USREOU, draft.TIN]

  return textFields.some((value) => typeof value === 'string' && value.trim() !== '')
    || (draft.ClientAgreements?.length || 0) > 0
}

/* A new client needs a name: «Повна назва» or «Назва» (a registry row «Без назви» is useless). */
export function newClientRequiredErrors(draft: Client, message: string): Record<string, string> {
  const hasName = [draft.FullName, draft.Name].some((value) => typeof value === 'string' && value.trim() !== '')

  return hasName ? {} : { FullName: message }
}
