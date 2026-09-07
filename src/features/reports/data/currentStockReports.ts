// These identities and exact workbook titles are published contracts. A no-period
// capability or a similar user-supplied filename alone never identifies a native snapshot.
const CURRENT_STOCK_REPORTS = [
  { dataSource: 4, title: 'Звіт поточних складських залишків', rowGroupings: [29, 28], measurements: [17, 18, 19],
    preset: { id: 'stock-by-warehouse-unit', name: 'Залишки за складами й одиницями',
      description: 'Поточний стан: склад → одиниця виміру. Фізичний залишок, вільна кількість і записаний резерв без додавання різних одиниць.' } },
  { dataSource: 5, title: 'Звіт поточних розміщень товарів', rowGroupings: [29, 30, 31, 32, 28], measurements: [17],
    preset: { id: 'placements-by-location', name: 'Розміщення за комірками',
      description: 'Склад → стелаж → ряд → комірка → одиниця виміру. Поточний фізичний залишок; різні одиниці не додаються.' } },
  { dataSource: 6, title: 'Звіт поточних резервів за договорами', rowGroupings: [12, 15, 29, 28], measurements: [19],
    preset: { id: 'reservations-by-agreement', name: 'Резерви за договорами',
      description: 'Клієнт → договір → склад → одиниця виміру. Записаний резерв на час читання даних, без оцінки вартості.' } },
] as const

export type CurrentStockPresetId = typeof CURRENT_STOCK_REPORTS[number]['preset']['id']
export const CURRENT_STOCK_REPORT_TITLES: ReadonlySet<string> = new Set(CURRENT_STOCK_REPORTS.map(report => report.title))

export function getCurrentStockReport(dataSource: number | undefined) {
  return CURRENT_STOCK_REPORTS.find(report => report.dataSource === dataSource)
}

export function isCurrentStockSource(dataSource: number | undefined): boolean {
  return getCurrentStockReport(dataSource) !== undefined
}

export function isCurrentStockPresetId(id: string): id is CurrentStockPresetId {
  return CURRENT_STOCK_REPORTS.some(report => report.preset.id === id)
}
