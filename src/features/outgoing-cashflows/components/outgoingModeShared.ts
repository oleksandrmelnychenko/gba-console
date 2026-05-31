import { formatLocalDate } from '../../../shared/date/dateTime'
import type {
  ClientAgreement,
  NamedEntity,
  Organization,
  PaymentCurrencyRegister,
  PaymentRegister,
  SupplyOrganizationAgreement,
} from '../../income-cashflows/types'

export const SEARCH_DEBOUNCE_MS = 300

export const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function getEntityValue(entity?: NamedEntity | null): string {
  return String(entity?.NetUid || entity?.Id || '')
}

export function getEntityName(entity?: NamedEntity | null): string {
  return entity?.FullName || entity?.LastName || entity?.Name || entity?.OperationName || entity?.Code || entity?.Number || ''
}

export function toEntityOptions<T extends NamedEntity>(entities: T[]) {
  return entities
    .map((entity) => ({
      label: getEntityName(entity) || getEntityValue(entity),
      value: getEntityValue(entity),
    }))
    .filter((option) => option.value)
}

export function toCurrencyOptions(register?: PaymentRegister | null) {
  return (register?.PaymentCurrencyRegisters || [])
    .map((currencyRegister) => {
      const currency = currencyRegister.Currency
      const value = getEntityValue(currency)
      const balance = typeof currencyRegister.Amount === 'number' ? ` (${moneyFormatter.format(currencyRegister.Amount)})` : ''

      return {
        label: `${currency?.Code || currency?.Name || value}${balance}`,
        value,
      }
    })
    .filter((option) => option.value)
}

export function toClientAgreementOptions(agreements: ClientAgreement[]) {
  return agreements
    .map((clientAgreement) => {
      const agreement = clientAgreement.Agreement
      const currency = agreement?.Currency
      const value = getEntityValue(agreement)

      return {
        label: [agreement?.Name || agreement?.Number || value, currency?.Code || currency?.Name].filter(Boolean).join(' '),
        value,
      }
    })
    .filter((option) => option.value)
}

export function toSupplyAgreementOptions(agreements: SupplyOrganizationAgreement[]) {
  return agreements
    .map((agreement) => {
      const currency = agreement.Currency
      const value = getEntityValue(agreement)

      return {
        label: [agreement.Name || agreement.Number || value, currency?.Code || currency?.Name].filter(Boolean).join(' '),
        value,
      }
    })
    .filter((option) => option.value)
}

export function toUniqueLabels<T extends NamedEntity>(entities: T[]): string[] {
  return Array.from(new Set(entities.map(getEntityName).filter(Boolean)))
}

export function includeEntity<T extends NamedEntity>(entities: T[], entity: T): T[] {
  const entityValue = getEntityValue(entity)

  if (!entityValue || entities.some((item) => getEntityValue(item) === entityValue)) {
    return entities
  }

  return [entity, ...entities]
}

export function selectedCurrencyRegisterOf(
  register: PaymentRegister | null,
  currencyValue: string,
): PaymentCurrencyRegister | null {
  return (
    (register?.PaymentCurrencyRegisters || []).find(
      (currencyRegister) => getEntityValue(currencyRegister.Currency) === currencyValue,
    ) || null
  )
}

export function balanceLabelOf(currencyRegister: PaymentCurrencyRegister | null, prefix: string): string {
  if (!currencyRegister || typeof currencyRegister.Amount !== 'number') {
    return ''
  }

  return `${prefix}: ${moneyFormatter.format(currencyRegister.Amount)} ${currencyRegister.Currency?.Code || ''}`
}

export function pickRegistersForOrganization(
  registers: PaymentRegister[],
  organization: Organization | null,
): PaymentRegister[] {
  if (!organization) {
    return registers
  }

  return registers.filter(
    (register) => getEntityValue(register.Organization) === getEntityValue(organization) || register.OrganizationId === organization.Id,
  )
}

export function defaultRegisterOf(registers: PaymentRegister[]): PaymentRegister | null {
  return registers.find((register) => register.IsMain) || registers[0] || null
}

export function toIsoDateTime(dateValue: string, timeValue: string): string {
  const date = new Date(`${dateValue || formatLocalDate(new Date())}T${timeValue || '00:00'}`)

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

export function toTimeValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${hours}:${minutes}`
}

export function toNumber(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value.replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : 0
}

export function calculateVat(amount: number, vatPercent: number): number {
  if (!amount || !vatPercent) {
    return 0
  }

  return Math.round((amount * vatPercent * 100) / (100 + vatPercent)) / 100
}
