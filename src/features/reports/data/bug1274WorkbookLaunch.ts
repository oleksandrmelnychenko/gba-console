import type { ReportDataset } from '../types'
import { isCashPeriodDataset } from './cashPeriod'
import { isSettlementPeriodDataset } from './settlementPeriod'

export type WorkbookLaunch = {
  fileName: string
  label: string
  notice: string
  dataset: ReportDataset
}

const supported = [
  {
    fileName: 'Ведомость по денежным средствам.xls',
    label: 'Рух коштів за період',
    notice: 'Часткова форма Excel: один точний рахунок Fenix, чотири показники у власній валюті. Оберіть рахунок і завершений період до 31 дня. Сервер відхилить неповне покриття; управлінська валюта ще недоступна.',
    dataSource: 40,
    accepts: isCashPeriodDataset,
  },
  {
    fileName: 'Взаємороз всі.xls',
    label: 'Взаєморозрахунки за період',
    notice: 'Часткова форма Excel: один точний договір, чотири показники у валюті взаєморозрахунків. Оберіть договір і завершений період до 31 дня. Сервер відхилить неповне покриття; згрупована відомість усіх контрагентів ще недоступна.',
    dataSource: 41,
    accepts: isSettlementPeriodDataset,
  },
] as const

/** Workbook shortcuts use live native capabilities, independently of the 1C source migration manifest. */
export function availableBug1274WorkbookLaunches(datasets: readonly ReportDataset[]): WorkbookLaunch[] {
  if (!Array.isArray(datasets)) return []
  return supported.flatMap(spec => {
    const matches = datasets.filter(dataset => dataset?.DataSource === spec.dataSource)
    const candidate = matches[0]
    return matches.length === 1 && Array.isArray(candidate.Groupings) && Array.isArray(candidate.Measurements)
      && Array.isArray(candidate.Filters) && spec.accepts(candidate)
      ? [{ fileName: spec.fileName, label: spec.label, notice: spec.notice, dataset: matches[0] }]
      : []
  })
}
