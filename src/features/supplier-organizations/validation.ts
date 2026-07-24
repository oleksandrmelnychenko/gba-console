import type {
  SupplyOrganizationAgreement,
  SupplyOrganizationAgreementFormValues,
  SupplyOrganizationContactFormValues,
  SupplyOrganizationGeneralFormValues,
} from './types'

export type SupplierOrganizationFormErrors<TValues> = Partial<Record<keyof TValues, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function validateSupplierOrganizationGeneralForm(
  values: SupplyOrganizationGeneralFormValues,
): SupplierOrganizationFormErrors<SupplyOrganizationGeneralFormValues> {
  const errors: SupplierOrganizationFormErrors<SupplyOrganizationGeneralFormValues> = {}

  if (!values.Name.trim()) {
    errors.Name = 'Вкажіть назву'
  }

  if (values.EmailAddress.trim() && !isEmail(values.EmailAddress)) {
    errors.EmailAddress = 'Некоректний email'
  }

  return errors
}

export function validateSupplierOrganizationContactForm(
  values: SupplyOrganizationContactFormValues,
): SupplierOrganizationFormErrors<SupplyOrganizationContactFormValues> {
  const errors: SupplierOrganizationFormErrors<SupplyOrganizationContactFormValues> = {}

  if (values.ContactPersonEmail.trim() && !isEmail(values.ContactPersonEmail)) {
    errors.ContactPersonEmail = 'Некоректний email'
  }

  return errors
}

export function validateSupplyOrganizationAgreementForm(
  values: SupplyOrganizationAgreementFormValues,
): SupplierOrganizationFormErrors<SupplyOrganizationAgreementFormValues> {
  const errors: SupplierOrganizationFormErrors<SupplyOrganizationAgreementFormValues> = {}

  if (!values.name.trim()) {
    errors.name = 'Вкажіть назву договору'
  }

  if (!values.organizationId) {
    errors.organizationId = 'Оберіть організацію'
  }

  if (!values.currencyId) {
    errors.currencyId = 'Оберіть валюту'
  }

  if (values.existFrom && !isIsoDate(values.existFrom)) {
    errors.existFrom = 'Некоректна дата початку'
  }

  if (values.existTo && !isIsoDate(values.existTo)) {
    errors.existTo = 'Некоректна дата завершення'
  }

  if (
    !errors.existFrom
    && !errors.existTo
    && values.existFrom
    && values.existTo
    && values.existFrom > values.existTo
  ) {
    errors.existTo = 'Дата завершення не може бути раніше дати початку'
  }

  return errors
}

export function firstSupplierOrganizationValidationError<TValues>(
  errors: SupplierOrganizationFormErrors<TValues>,
): string | null {
  for (const error of Object.values(errors)) {
    if (typeof error === 'string' && error) {
      return error
    }
  }

  return null
}

export function normalizeSupplierOrganizationGeneralForm(
  values: SupplyOrganizationGeneralFormValues,
): SupplyOrganizationGeneralFormValues {
  return {
    ...values,
    Address: values.Address.trim(),
    EmailAddress: values.EmailAddress.trim(),
    Name: values.Name.trim(),
    PhoneNumber: values.PhoneNumber.trim(),
    SROI: values.SROI.trim(),
    TIN: values.TIN.trim(),
    USREOU: values.USREOU.trim(),
  }
}

export function normalizeSupplierOrganizationContactForm(
  values: SupplyOrganizationContactFormValues,
): SupplyOrganizationContactFormValues {
  return {
    ContactPersonComment: values.ContactPersonComment.trim(),
    ContactPersonEmail: values.ContactPersonEmail.trim(),
    ContactPersonName: values.ContactPersonName.trim(),
    ContactPersonPhone: values.ContactPersonPhone.trim(),
    ContactPersonSkype: values.ContactPersonSkype.trim(),
    ContactPersonViber: values.ContactPersonViber.trim(),
  }
}

export function hasSupplierOrganizationEntityIdentity(
  entity?: { Id?: number; NetUid?: string } | null,
): boolean {
  return Boolean(
    entity
    && (
      (typeof entity.NetUid === 'string' && entity.NetUid.trim())
      || (typeof entity.Id === 'number' && Number.isFinite(entity.Id) && entity.Id > 0)
    ),
  )
}

export function isPersistedSupplyOrganizationAgreement(
  agreement?: SupplyOrganizationAgreement | null,
): boolean {
  return hasSupplierOrganizationEntityIdentity(agreement)
}

function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  )
}
