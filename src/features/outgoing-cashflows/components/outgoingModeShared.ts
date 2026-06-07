import { formatLocalInputDateTime } from '../../../shared/date/dateTime'
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
  return entities.reduce<{ label: string; value: string }[]>((acc, entity) => {
    const option = {
      label: getEntityName(entity) || getEntityValue(entity),
      value: getEntityValue(entity),
    }

    if (option.value) {
      acc.push(option)
    }

    return acc
  }, [])
}

export function toCurrencyOptions(register?: PaymentRegister | null) {
  return (register?.PaymentCurrencyRegisters || []).reduce<{ label: string; value: string }[]>((acc, currencyRegister) => {
    const currency = currencyRegister.Currency
    const value = getEntityValue(currency)
    const balance = typeof currencyRegister.Amount === 'number' ? ` (${moneyFormatter.format(currencyRegister.Amount)})` : ''

    if (value) {
      acc.push({
        label: `${currency?.Code || currency?.Name || value}${balance}`,
        value,
      })
    }

    return acc
  }, [])
}

export function toClientAgreementOptions(agreements: ClientAgreement[]) {
  return agreements.reduce<{ label: string; value: string }[]>((acc, clientAgreement) => {
    const agreement = clientAgreement.Agreement
    const currency = agreement?.Currency
    const value = getEntityValue(agreement)

    if (value) {
      acc.push({
        label: [agreement?.Name || agreement?.Number || value, currency?.Code || currency?.Name].filter(Boolean).join(' '),
        value,
      })
    }

    return acc
  }, [])
}

export function toSupplyAgreementOptions(agreements: SupplyOrganizationAgreement[]) {
  return agreements.reduce<{ label: string; value: string }[]>((acc, agreement) => {
    const currency = agreement.Currency
    const value = getEntityValue(agreement)

    if (value) {
      acc.push({
        label: [agreement.Name || agreement.Number || value, currency?.Code || currency?.Name].filter(Boolean).join(' '),
        value,
      })
    }

    return acc
  }, [])
}

export function toUniqueLabels<T extends NamedEntity>(entities: T[]): string[] {
  return Array.from(new Set(entities.flatMap((entity) => {
    const name = getEntityName(entity)
    return name ? [name] : []
  })))
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
  return formatLocalInputDateTime(dateValue, timeValue)
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
