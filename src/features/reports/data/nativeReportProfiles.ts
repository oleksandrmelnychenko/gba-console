import { CURRENT_STOCK_REPORT_TITLES, getCurrentStockReport, isCurrentStockPresetId, isCurrentStockSource, type CurrentStockPresetId } from './currentStockReports'

export const SUPPLIER_RETURN_REPORT_TITLE = 'Звіт документів повернень постачальникам'
export const DEBT_REPORT_TITLE = 'Звіт поточної заборгованості'
export const SUPPLIER_RETURN_QUANTITY_CAPTION = 'Записана кількість повернення'
export const DEBT_AMOUNT_CAPTION = 'Записана заборгованість'
const DOCUMENT_REPORT_PROFILES = [
  { dataSource: 9, title: SUPPLIER_RETURN_REPORT_TITLE, rowGroupings: [38, 3, 28], measurements: [22],
    preset: { id: 'supplier-returns-by-mode-day-unit', name: 'Повернення за типами й одиницями',
      description: 'Тип повернення → день → одиниця виміру. Записана кількість повернення; покриття складських рухів зазначене окремо.' } },
  { dataSource: 10, title: DEBT_REPORT_TITLE, rowGroupings: [36, 12, 15], measurements: [23],
    preset: { id: 'current-debt-by-currency-agreement', name: 'Заборгованість за валютами й договорами',
      description: 'Валюта боргу → клієнт → договір. Поточна записана заборгованість; різні або непідтверджені валюти не додаються.' } },
] as const

export type NativeReportPresetId = CurrentStockPresetId | typeof DOCUMENT_REPORT_PROFILES[number]['preset']['id']
export const CURRENT_REPORT_TITLES: ReadonlySet<string> = new Set([...CURRENT_STOCK_REPORT_TITLES, DEBT_REPORT_TITLE])
export function getNativeReportProfile(dataSource: number | undefined) {
  return getCurrentStockReport(dataSource) ?? DOCUMENT_REPORT_PROFILES.find(report => report.dataSource === dataSource)
}
export function isNativeReportPresetId(id: string): id is NativeReportPresetId {
  return isCurrentStockPresetId(id) || DOCUMENT_REPORT_PROFILES.some(report => report.preset.id === id)
}
export function isCurrentReportSource(dataSource: number | undefined): boolean {
  return isCurrentStockSource(dataSource) || dataSource === 10
}
export function usesNativeReportLookup(dataSource: number | undefined): boolean {
  return isCurrentReportSource(dataSource) || dataSource === 9
}
