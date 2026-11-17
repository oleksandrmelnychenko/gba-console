import { NATIVE_PRICE_COMPARISON_WORKBOOK } from './nativePriceComparison'
import { CUSTOMER_GROUPS_WORKBOOK } from './customerGroups'
import { CUSTOMER_RETURN_WORKBOOK } from './customerReturnReport'
import { PURCHASES_CONSTRUCTOR_FILE, STOCK_PERIOD_CONSTRUCTOR_FILE } from './bug1274WorkbookLaunch'
import { GROSS_PROFIT_CONSTRUCTOR_WORKBOOK, SALES_CONSTRUCTOR_WORKBOOK } from './salesConstructorProfiles'

export type ReportNavigationEntry = { label: string; file: string | null }

export const SALES_NAVIGATION: readonly ReportNavigationEntry[] = [
  { label: 'Звіт по продажам', file: SALES_CONSTRUCTOR_WORKBOOK },
  { label: 'Валовий прибуток', file: GROSS_PROFIT_CONSTRUCTOR_WORKBOOK },
]
export const CASH_NAVIGATION: readonly ReportNavigationEntry[] = [
  { label: 'Відомість по коштах', file: 'Ведомость по денежным средствам.xls' },
  { label: 'Взаєморозрахунки всі', file: 'Взаємороз всі.xls' },
  { label: 'Дебіторська заборгованість', file: 'ДБіторка.xls' },
]
export const SPECIAL_NAVIGATION: readonly ReportNavigationEntry[] = [
  { label: 'Аналіз залишків і продажів', file: 'Впарювання.xls' },
  { label: 'Звіт повернення', file: CUSTOMER_RETURN_WORKBOOK },
  { label: 'Звіт по скидкам клієнтів', file: null },
  { label: 'Продажі порівнянням за типами цін', file: NATIVE_PRICE_COMPARISON_WORKBOOK },
  { label: 'Порівняння роботи клієнтів', file: CUSTOMER_GROUPS_WORKBOOK },
]
export const SINGLE_NAVIGATION: readonly ReportNavigationEntry[] = [
  { label: 'Залишки', file: STOCK_PERIOD_CONSTRUCTOR_FILE },
  { label: 'Закупи', file: PURCHASES_CONSTRUCTOR_FILE },
]

export const ALL_NAVIGATION_ENTRIES: readonly ReportNavigationEntry[] = [
  ...SALES_NAVIGATION, ...SINGLE_NAVIGATION, ...CASH_NAVIGATION, ...SPECIAL_NAVIGATION,
]
