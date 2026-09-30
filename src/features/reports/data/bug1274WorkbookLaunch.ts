import type { ReportDataset } from '../types'
import { isCashPeriodDataset } from './cashPeriod'
import { isSettlementPeriodDataset } from './settlementPeriod'
import { isDayOrganizationGrossProfitDataset } from './dayOrganizationGrossProfit'
import { isSupplierBatchGrossProfitDataset } from './supplierBatchGrossProfit'
import { isCurrentVparivanieDataset } from './currentVparivanie'
import { isProductClassificationCapability, isSourceBuyerSubtreeCapability,
  isSourceOrganizationsCapability } from './nativeExactFilters'

export type WorkbookLaunch = {
  fileName: string
  label: string
  notice: string
  dataset: ReportDataset
}

const supported = [
  {
    fileName: 'ВП.xls',
    label: 'Валовий прибуток за днем',
    notice: 'Часткова форма Excel: день → організація, суми EUR та рентабельність %. Для врахування повернень оберіть один завершений день і всі три точні відбори Fenix: товар без послуг, організації та групу покупців. Сервер відхилить неповне покриття; без цих відборів діє звичайний звіт продажів без повернень.',
    dataSource: 35,
    accepts: (dataset: ReportDataset) => isDayOrganizationGrossProfitDataset(dataset)
      && isProductClassificationCapability(dataset.productClassification)
      && isSourceOrganizationsCapability(dataset.sourceOrganizations)
      && isSourceBuyerSubtreeCapability(dataset.sourceBuyerSubtree),
  },
  {
    fileName: 'ВП по постачальниках.xls',
    label: 'Валовий прибуток за постачальниками',
    notice: 'Часткова форма Excel: склад партії → організація → постачальник. Оберіть базу Fenix, товар і завершений період до 31 дня; сервер відхилить неповні партії та періоди з непідтвердженими поверненнями.',
    dataSource: 38,
    accepts: isSupplierBatchGrossProfitDataset,
  },
  {
    fileName: 'Впарювання.xls',
    label: 'Поточна матриця товарів',
    notice: 'Часткова форма Excel: поточні записані залишки GBA і продажі за вибраний період. Оберіть товари або групу; історичний залишок і формула 1С ще не підтверджені.',
    dataSource: 39,
    accepts: isCurrentVparivanieDataset,
  },
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
      ? [{ fileName: spec.fileName, label: spec.label,
        notice: spec.dataSource === 38 && candidate.Groupings.some((field: { Type: number }) => field.Type === 78)
          ? `${spec.notice} Для групування як в 1С оберіть шаблон «Валовий прибуток за складом продажу 1С»; він вимагає повних джерельних ID для всього періоду.`
          : spec.notice,
        dataset: matches[0] }]
      : []
  })
}
