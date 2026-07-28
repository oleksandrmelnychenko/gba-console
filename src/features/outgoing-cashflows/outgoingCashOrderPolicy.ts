import {
  ACCOUNTING_PAYMENT_REGISTER_TYPE,
  type AccountingPaymentRegisterType,
} from '../accounting/accountingOperationCatalog'
import type {
  CreatePaymentCurrencyRegister,
  CreatePaymentRegister,
  OutcomePaymentUser,
} from './outgoingCreateTypes'
import type { Organization, PaymentMovement } from './types'

export function parseOutgoingCashOrderRegisterType(
  value: string | null,
): AccountingPaymentRegisterType | null {
  if (value === String(ACCOUNTING_PAYMENT_REGISTER_TYPE.Cash)) {
    return ACCOUNTING_PAYMENT_REGISTER_TYPE.Cash
  }

  if (value === String(ACCOUNTING_PAYMENT_REGISTER_TYPE.Bank)) {
    return ACCOUNTING_PAYMENT_REGISTER_TYPE.Bank
  }

  return null
}

export function validateOutgoingCashOrderForm({
  amount,
  selectedColleague,
  selectedCurrencyRegister,
  selectedMovement,
  selectedOrganization,
  selectedRegister,
  t,
}: {
  amount: number
  selectedColleague: OutcomePaymentUser | null
  selectedCurrencyRegister: CreatePaymentCurrencyRegister | null
  selectedMovement: PaymentMovement | null
  selectedOrganization: Organization | null
  selectedRegister: CreatePaymentRegister | null
  t: (value: string) => string
}): string | null {
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

  if (!selectedColleague) {
    return t('Виберіть відповідального')
  }

  if (!amount || amount <= 0) {
    return t('Сума')
  }

  return null
}
