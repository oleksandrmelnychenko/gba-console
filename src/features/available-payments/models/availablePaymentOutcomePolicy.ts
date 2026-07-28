import { formatLocalDate } from '../../../shared/date/dateTime'
import type {
  AvailablePaymentCurrencyRegister,
  AvailablePaymentMovement,
  AvailablePaymentRegister,
  AvailablePaymentsOrganization,
  AvailablePaymentTaskModel,
} from '../types'

export function validateAvailablePaymentOutcomeForm({
  amount,
  date,
  outcomeModels,
  selectedCurrencyRegister,
  selectedMovement,
  selectedOrganization,
  selectedRegister,
  t,
  time,
}: {
  amount: number
  date: string
  outcomeModels: AvailablePaymentTaskModel[]
  selectedCurrencyRegister: AvailablePaymentCurrencyRegister | null
  selectedMovement: AvailablePaymentMovement | null
  selectedOrganization: AvailablePaymentsOrganization | null
  selectedRegister: AvailablePaymentRegister | null
  t: (key: string) => string
  time: string
}): string | null {
  if (outcomeModels.length === 0) {
    return t('Виберіть платіжні задачі')
  }

  if (!isValidDateInput(date)) {
    return t('Вкажіть дату видаткового ордера')
  }

  if (!isValidTimeInput(time)) {
    return t('Вкажіть час видаткового ордера')
  }

  if (!selectedOrganization) {
    return t('Організація')
  }

  if (!selectedRegister) {
    return t('Грошові рахунки')
  }

  if (!selectedCurrencyRegister) {
    return t('Валюта')
  }

  if (!selectedMovement) {
    return t('Виберіть статтю грошових витрат')
  }

  if (!amount || amount <= 0) {
    return t('Сума')
  }

  return null
}

function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00`)

  return !Number.isNaN(date.getTime()) && formatLocalDate(date) === value
}

function isValidTimeInput(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}
