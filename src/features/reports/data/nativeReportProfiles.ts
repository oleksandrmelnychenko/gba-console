import { XYZ_TITLE } from './salesXyz'
import { IMPORTED_PAYMENTS_TITLE } from './importedPayments'
import { CLIENT_COMPARISON_TITLE } from './clientPeriodComparison'
import { CLIENT_ACTIVITY_REPORT_TITLE } from './clientActivityReport'
import { CURRENT_STOCK_REPORT_TITLES, getCurrentStockReport, isCurrentStockPresetId, isCurrentStockSource, type CurrentStockPresetId } from './currentStockReports'

export const SUPPLIER_RETURN_REPORT_TITLE = 'Звіт документів повернень постачальникам'
export const DEBT_REPORT_TITLE = 'Звіт поточної заборгованості'
export const SUPPLIER_RETURN_QUANTITY_CAPTION = 'Записана кількість повернення'
export const DEBT_AMOUNT_CAPTION = 'Записана заборгованість'
export const ACCOUNT_BALANCE_REPORT_TITLE = 'Записані залишки рахунків'
export const ACCOUNT_BALANCE_AMOUNT_CAPTION = 'Записаний залишок рахунку'
const DOCUMENT_REPORT_PROFILES = [
  { dataSource: 15, title: XYZ_TITLE, rowGroupings: [51, 5], measurements: [32, 33, 34],
    preset: { id: 'sales-xyz-by-product', name: 'XYZ-стабільність продажів за товарами',
      description: 'Клас XYZ → товар. Явний календар, кількість періодів і незалежні межі класів; записані суми EUR та коефіцієнт варіації.' } },
  { dataSource: 14, title: IMPORTED_PAYMENTS_TITLE, rowGroupings: [41, 48, 40], measurements: [29, 30, 31],
    preset: { id: 'imported-payments-by-currency-direction-account', name: 'Імпортовані платежі за валютами й рахунками',
      description: 'Валюта → напрям → рахунок. Записані суми документів із чотирма десятковими знаками; різні або непідтверджені валюти не додаються.' } },
  { dataSource: 13, title: CLIENT_COMPARISON_TITLE, rowGroupings: [12], measurements: [25, 26, 27, 28],
    preset: { id: 'sale-clients-period-comparison', name: 'Клієнти: порівняння періодів',
      description: 'Клієнти у двох вибраних періодах, зміна кількості та відсоток. Підсумки обчислює сервер за унікальними клієнтами кожного періоду.' } },
  { dataSource: 12, title: CLIENT_ACTIVITY_REPORT_TITLE, rowGroupings: [2, 12, 15], measurements: [25],
    preset: { id: 'sale-clients-by-month-agreement', name: 'Клієнти за місяцями й договорами',
      description: 'Місяць → клієнт → договір. Унікальні клієнти за поточними прив’язками GBA; підсумки визначає сервер за об’єднанням клієнтів.' } },
  { dataSource: 9, title: SUPPLIER_RETURN_REPORT_TITLE, rowGroupings: [38, 3, 28], measurements: [22],
    preset: { id: 'supplier-returns-by-mode-day-unit', name: 'Повернення за типами й одиницями',
      description: 'Тип повернення → день → одиниця виміру. Записана кількість повернення; покриття складських рухів зазначене окремо.' } },
  { dataSource: 10, title: DEBT_REPORT_TITLE, rowGroupings: [36, 12, 15], measurements: [23],
    preset: { id: 'current-debt-by-currency-agreement', name: 'Заборгованість за валютами й договорами',
      description: 'Валюта боргу → клієнт → договір. Поточна записана заборгованість; різні або непідтверджені валюти не додаються.' } },
  { dataSource: 11, title: ACCOUNT_BALANCE_REPORT_TITLE, rowGroupings: [45, 44, 41, 40], measurements: [24],
    preset: { id: 'account-balances-by-purpose-currency', name: 'Рахунки за призначенням і валютою',
      description: 'Призначення → тип рахунку → валюта → рахунок. Поточний записаний залишок; різні або непідтверджені валюти не додаються.' } },
] as const

export type NativeReportPresetId = CurrentStockPresetId | typeof DOCUMENT_REPORT_PROFILES[number]['preset']['id']
export const CURRENT_REPORT_TITLES: ReadonlySet<string> = new Set([...CURRENT_STOCK_REPORT_TITLES, DEBT_REPORT_TITLE, ACCOUNT_BALANCE_REPORT_TITLE])
export function getNativeReportProfile(dataSource: number | undefined) {
  return getCurrentStockReport(dataSource) ?? DOCUMENT_REPORT_PROFILES.find(report => report.dataSource === dataSource)
}
export function isNativeReportPresetId(id: string): id is NativeReportPresetId {
  return isCurrentStockPresetId(id) || DOCUMENT_REPORT_PROFILES.some(report => report.preset.id === id)
}
export function isCurrentReportSource(dataSource: number | undefined): boolean {
  return isCurrentStockSource(dataSource) || dataSource === 10 || dataSource === 11
}
export function usesNativeReportLookup(dataSource: number | undefined): boolean {
  return isCurrentReportSource(dataSource) || dataSource === 9 || dataSource === 12 || dataSource === 13 || dataSource === 14 || dataSource === 15
}
