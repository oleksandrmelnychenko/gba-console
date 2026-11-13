import { DAY_ORGANIZATION_GROSS_PROFIT_TITLE } from './dayOrganizationGrossProfit'
import { CURRENT_VPARIVANIE_TITLE, CURRENT_VPARIVANIE_NOTICE } from './currentVparivanie'
import { CASH_PERIOD_ALL_MEASURES, CASH_PERIOD_TITLE } from './cashPeriod'
import { SETTLEMENT_PERIOD_TITLE } from './settlementPeriod'
import { SUPPLIER_BATCH_GROSS_PROFIT_TITLE } from './supplierBatchGrossProfit'
import { BUG_1274_PARITY_NOTICE } from './reportMigration'

const DOCUMENT_REPORT_PROFILES = [
  { dataSource: 41, title: SETTLEMENT_PERIOD_TITLE, rowGroupings: [4, 41, 76, 77], measurements: [88, 89, 90, 91],
    preset: { id: 'native-settlement-period-agreement-currency', name: 'Взаєморозрахунки: рух за договором',
      description: 'Один точний договір у валюті взаєморозрахунків. Початок, надходження, витрати й кінець за період до 31 завершеного дня Києва. Повне покриття перевіряє сервер.' } },
  { dataSource: 40, title: CASH_PERIOD_TITLE, rowGroupings: [43, 40, 42, 41], measurements: [...CASH_PERIOD_ALL_MEASURES],
    preset: { id: 'native-cash-period-account-currency', name: 'Кошти: рух за рахунком',
      description: 'Рахунки та каси за включний період до 31 завершеного дня Києва. Початок, надходження, витрати й кінець у валюті рахунку; за підтримки сервера також окремі управлінські суми. Валюти вказано в результаті.' } },
  { dataSource: 39, title: CURRENT_VPARIVANIE_TITLE, rowGroupings: [5], measurements: [83],
    preset: { id: 'vparivanie-current-native-matrix', name: 'Аналіз залишків і продажів: поточна матриця',
      description: `Оберіть до 128 товарів або одну групу товарів і період продажів до 366 днів. ${CURRENT_VPARIVANIE_NOTICE}` } },
  { dataSource: 38, title: SUPPLIER_BATCH_GROSS_PROFIT_TITLE, rowGroupings: [73, 4, 21], measurements: [0, 2, 6, 10, 12, 14],
    preset: { id: 'recorded-supplier-batch-gross-profit', name: 'Валовий прибуток за постачальниками',
      description: `Склад партії джерела → організація → постачальник. До 31 дня імпортованих повністю розподілених продажів GBA. Часткові та непідтверджені партії не формують звіт. ${BUG_1274_PARITY_NOTICE}` } },
  { dataSource: 35, title: DAY_ORGANIZATION_GROSS_PROFIT_TITLE, rowGroupings: [3, 4], measurements: [2, 3, 4, 6, 7, 8, 10, 12, 14, 15],
    preset: { id: 'recorded-sale-gross-profit-by-day-organization', name: 'Валовий прибуток GBA за днем і організацією',
      description: `До 31 дня проведених продажів GBA: день → поточна записана організація. Десять EUR-показників з окремим ПДВ. Точні відбори «Товар без послуг», організації налаштування 1С і «Покупці» Fenix перевіряють локальне покриття за обраний період. Невідома собівартість порожня. ${BUG_1274_PARITY_NOTICE}` } },
] as const

export type NativeReportPresetId = typeof DOCUMENT_REPORT_PROFILES[number]['preset']['id']
const OPTIONAL_PROFILE_MEASURES: Readonly<Record<number, readonly number[]>> = { 35: [117, 118] }
export function optionalProfileMeasures(dataSource: number | undefined): readonly number[] {
  return dataSource === undefined ? [] : OPTIONAL_PROFILE_MEASURES[dataSource] ?? []
}
export function getNativeReportProfile(dataSource: number | undefined) {
  return DOCUMENT_REPORT_PROFILES.find(report => report.dataSource === dataSource)
}
export function isNativeReportPresetId(id: string): id is NativeReportPresetId {
  return DOCUMENT_REPORT_PROFILES.some(report => report.preset.id === id)
}
export function usesNativeReportLookup(dataSource: number | undefined): boolean {
  return dataSource === 45 || dataSource === 35 || dataSource === 38 || dataSource === 39 || dataSource === 40 || dataSource === 41 || dataSource === 43
}

const FULL_DATE_RANGE_SOURCES = new Set([38, 39, 40, 41])
const FIXED_AXES_SOURCES = new Set([38, 39, 40, 41])
export const supportsFullReportDateRange = (dataSource: number): boolean => FULL_DATE_RANGE_SOURCES.has(dataSource)
export const hasFixedReportAxes = (dataSource: number): boolean => FIXED_AXES_SOURCES.has(dataSource)


// Units belong to the selected report and caption, independently of VAT controls.
export function nativeReportMeasurementUnit(dataSource: number, caption: string, measureType?: number): string | undefined {
  if (dataSource === 40 && measureType !== undefined) return [92, 93, 94, 95].includes(measureType) ? 'Сума у (EUR)' : 'Сума у валюті рахунку (каси)'
  if (dataSource === 41) return 'Валюта взаєморозрахунків договору'
  if (dataSource === 40) return caption.includes('(EUR)') || caption.includes('управлінська') ? 'Сума у (EUR)' : 'Сума у валюті рахунку (каси)'
  if (dataSource === 39) return 'Кількість товару'
  if (dataSource === 38) return caption.includes('%') ? 'Відсотки' : caption.toLowerCase().includes('кількість') ? 'Кількість товару' : 'Євро'
  if (dataSource === 35) return caption.includes('%') ? 'Відсотки' : 'Євро'
  return undefined
}
