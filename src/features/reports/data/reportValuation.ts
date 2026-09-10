import type { ReportRequestBody } from '../types'

export const VALUATION_DATA_SOURCE = 8
export const requiresValuationAgreement = (source: number | undefined): boolean => source === VALUATION_DATA_SOURCE || source === 22
export const VALUATION_MONEY_CAPTION = 'Оцінка за договором, EUR'
export const VALUATION_REQUIRED_METADATA_PREFIXES = ['Договір оцінки:', 'Режим оцінки:', 'ПДВ оцінки:'] as const
export const VALUATION_METADATA_PREFIXES = [
  'Договір оцінки:', 'Режим оцінки:', 'ПДВ оцінки:', 'Публікація цін Fenix:', 'Публікація цін AMG:',
  'Покриття оцінки:', 'Причини невизначеної оцінки:', 'Округлення оцінки:', 'Версія розрахунку оцінки:',
] as const

export function isValuationAgreementId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

export function valuationConfigurationError(data: Pick<ReportRequestBody, 'dataSource' | 'valuationClientAgreementId'>): string | null {
  if (requiresValuationAgreement(data.dataSource)) {
    return isValuationAgreementId(data.valuationClientAgreementId) ? null : data.dataSource === 22
      ? 'Виберіть точний договір клієнта для звіту цін.' : 'Виберіть точний договір клієнта для оцінки залишків.'
  }
  return data.valuationClientAgreementId != null ? 'Договір оцінки дозволено лише для оцінки залишків або звіту цін за договором. Налаштування не застосовано.' : null
}
