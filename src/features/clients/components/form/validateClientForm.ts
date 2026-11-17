import type { Client } from '../../types'
import type { ClientFormRole } from './GeneralInfoFields'

export type ClientFormErrors = Partial<Record<string, string>>

type MaxLengthRule = {
  field: string
  value?: string
  max: number
}

export type ClientFormatOptions = {
  /** Enables the format rules (ЄДРПОУ, ІПН, email, phones); messages go through it. */
  t: (value: string) => string
  /**
   * The client as loaded from the server. A value equal to it is not re-checked, so a
   * legacy 1C value the user did not touch never blocks saving another field.
   */
  baseline?: Partial<Client> | null
}

type FormatField = 'USREOU' | 'TIN' | 'EmailAddress' | 'ClientNumber' | 'SMSNumber' | 'AccountantNumber' | 'DirectorNumber'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_CHARACTERS = /^[\d\s+\-()]+$/
const PHONE_FIELDS = ['ClientNumber', 'SMSNumber', 'AccountantNumber', 'DirectorNumber'] as const

function digitsOnly(value: string): string | null {
  const compact = value.replace(/\s+/g, '')
  // All zeros is a placeholder, not a code (the server's NormalizeLegalCode rejects it too).
  return /^\d+$/.test(compact) && /[1-9]/.test(compact) ? compact : null
}

/** Lenient phone: digits, spaces, +, -, parentheses; 10–15 digits in total. */
export function isValidClientPhone(value: string): boolean {
  if (!PHONE_CHARACTERS.test(value)) {
    return false
  }
  const digits = value.replace(/\D/g, '').length
  return digits >= 10 && digits <= 15
}

export function isValidClientEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

function needsFormatCheck(
  field: FormatField,
  value: string | null | undefined,
  baseline?: Partial<Client> | null,
): value is string {
  if (!value || !value.trim()) {
    return false
  }
  return !baseline || (baseline[field] ?? '') !== value
}

function validateClientFormats(client: Client, role: ClientFormRole, options: ClientFormatOptions): ClientFormErrors {
  const { t, baseline } = options
  const errors: ClientFormErrors = {}

  if (role.isBuyer) {
    if (needsFormatCheck('USREOU', client.USREOU, baseline)) {
      const digits = digitsOnly(client.USREOU)
      // A sole proprietor may carry the 10-digit РНОКПП in the ЄДРПОУ field (the server accepts both).
      const allowed = client.IsIndividual ? [8, 10] : [8]
      if (!digits || !allowed.includes(digits.length)) {
        errors.USREOU = client.IsIndividual
          ? t('ЄДРПОУ має містити 8 або 10 цифр')
          : t('ЄДРПОУ має містити 8 цифр')
      }
    }

    if (needsFormatCheck('TIN', client.TIN, baseline)) {
      const digits = digitsOnly(client.TIN)
      // Individuals: 10-digit РНОКПП; legal entities: 12-digit ІПН платника ПДВ (10 tolerated).
      const allowed = client.IsIndividual ? [10] : [10, 12]
      if (!digits || !allowed.includes(digits.length)) {
        errors.TIN = client.IsIndividual
          ? t('ІПН фізичної особи має містити 10 цифр')
          : t('ІПН має містити 10 або 12 цифр')
      }
    }
  }

  if (needsFormatCheck('EmailAddress', client.EmailAddress, baseline) && !isValidClientEmail(client.EmailAddress)) {
    errors.EmailAddress = t('Вкажіть коректний email, наприклад name@example.com')
  }

  PHONE_FIELDS.forEach((field) => {
    const value = client[field]
    if (needsFormatCheck(field, value, baseline) && !isValidClientPhone(value)) {
      errors[field] = t('Телефон: 10–15 цифр; дозволені пробіли, +, -, дужки')
    }
  })

  return errors
}

export function validateClientForm(
  client: Client,
  role: ClientFormRole,
  tooManyMessage: string,
  formatOptions?: ClientFormatOptions,
): ClientFormErrors {
  const rules: MaxLengthRule[] = [
    { field: 'FullName', value: client.FullName, max: 100 },
    { field: 'EmailAddress', value: client.EmailAddress, max: 100 },
    { field: 'FaxNumber', value: client.FaxNumber, max: 20 },
    { field: 'ActualAddress', value: client.ActualAddress, max: 500 },
  ]

  if (role.isProvider) {
    rules.push(
      { field: 'Brand', value: client.Brand, max: 100 },
      { field: 'SupplierCode', value: client.SupplierCode, max: 100 },
      { field: 'SupplierName', value: client.SupplierName, max: 100 },
      { field: 'IncotermsElse', value: client.IncotermsElse, max: 100 },
    )
  }

  if (role.isBuyer) {
    rules.push(
      { field: 'Name', value: client.Name, max: 100 },
      { field: 'SROI', value: client.SROI, max: 30 },
      { field: 'TIN', value: client.TIN, max: 30 },
      { field: 'USREOU', value: client.USREOU, max: 30 },
      { field: 'ICQ', value: client.ICQ, max: 20 },
      { field: 'SMSNumber', value: client.SMSNumber, max: 20 },
      { field: 'AccountantNumber', value: client.AccountantNumber, max: 20 },
      { field: 'DirectorNumber', value: client.DirectorNumber, max: 20 },
      { field: 'Manager', value: client.Manager, max: 250 },
      { field: 'DeliveryAddress', value: client.DeliveryAddress, max: 500 },
      { field: 'LegalAddress', value: client.LegalAddress, max: 500 },
    )
  }

  const errors: ClientFormErrors = formatOptions ? validateClientFormats(client, role, formatOptions) : {}

  rules.forEach((rule) => {
    if (rule.value && rule.value.length > rule.max) {
      errors[rule.field] = tooManyMessage
    }
  })

  return errors
}

export function validateRegionCodeSubmitState(
  isLoadingRegionCode: boolean,
  regionCodeError: string | undefined,
  loadingMessage: string,
): string | undefined {
  if (isLoadingRegionCode) {
    return loadingMessage
  }

  return regionCodeError
}
