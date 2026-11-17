import { createContext } from 'react'
import type { SupplyOrganizationAgreement } from '../types'

/**
 * Document types of the supplier settlements (server JoinServiceType). The
 * Назва column showed «—» or bare numbers (10, 11, 17) without these.
 */
export const SUPPLIER_CASH_FLOW_TYPE_LABELS: Record<number, string> = {
  0: 'Протокол оплати постачання',
  2: 'Контейнерний сервіс',
  3: 'Митний сервіс',
  4: 'Портові роботи',
  5: 'Транспортний сервіс',
  6: 'Портово-митний сервіс',
  7: 'Митне агентство',
  8: 'Авіадоставка',
  9: 'Автодоставка',
  10: 'Прихідна накладна',
  11: 'Видатковий ордер',
  12: 'Прихідний ордер',
  13: 'Продаж',
  14: 'Платіжне завдання постачання',
  15: 'Повернення продажу',
  16: 'Постачання Україна',
  17: 'Акт надання послуг',
  18: 'Протокол оплати постачання Україна',
  20: 'Оприбуткування Україна',
  21: 'Коносамент',
  30: 'Акт надання послуг (бух.)',
  33: 'Коносамент',
  35: 'Акт надання послуг',
  36: 'Акт надання послуг (бух.)',
  37: 'Перепродаж',
  39: 'Витрати на доставку',
  40: 'Витрати на доставку (бух.)',
}

export function getSupplierCashFlowTypeLabel(type?: number): string {
  if (typeof type !== 'number') {
    return '—'
  }

  return SUPPLIER_CASH_FLOW_TYPE_LABELS[type] || String(type)
}

/**
 * Currency of the settlement amounts: with one agreement selected the server
 * answers in that agreement's currency; for all agreements in EUR.
 */
export function getSupplierCashFlowCurrency(
  agreements: SupplyOrganizationAgreement[],
  selectedAgreementNetUid: string,
): string {
  if (!selectedAgreementNetUid) {
    return 'EUR'
  }

  const agreement = agreements.find((item) => item.NetUid === selectedAgreementNetUid)

  return agreement?.Currency?.Code || agreement?.Currency?.Name || ''
}

export const SupplierCashFlowCurrencyContext = createContext('EUR')
