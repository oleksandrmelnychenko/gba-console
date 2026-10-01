import type { ReportDataset } from '../types'
import { groupedCashSupported } from './groupedCashPeriod'
import { cashPeriodSupportsManagement, isCashPeriodDataset } from './cashPeriod'
import { isSettlementPeriodDataset } from './settlementPeriod'
import { isDayOrganizationBasisCapability } from './dayOrganizationBasis'
import { isDayOrganizationGrossProfitDataset } from './dayOrganizationGrossProfit'
import { isSupplierBatchGrossProfitDataset } from './supplierBatchGrossProfit'
import { isSupplierBasisCapability } from './supplierBasis'
import { isGroupedSettlementDataset } from './groupedSettlementPeriod'
import { isCurrentVparivanieDataset } from './currentVparivanie'
import { isProductClassificationCapability, isSourceBuyerSubtreeCapability,
  isSourceOrganizationsCapability } from './nativeExactFilters'

export type WorkbookLaunch = {
  fileName: string
  label: string
  notice: string
  dataset: ReportDataset
  currencyAxis?: boolean
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
    currencyAxis: true,
    label: 'Взаєморозрахунки за період',
    notice: 'Часткова форма Excel: один точний договір, чотири показники у валюті взаєморозрахунків. Оберіть договір і завершений період до 31 дня. Сервер відхилить неповне покриття; згрупована відомість усіх контрагентів ще недоступна.',
    dataSource: 41,
    accepts: isSettlementPeriodDataset,
  },
  {
    fileName: 'ДБіторка.xls',
    currencyAxis: false,
    label: 'Дебіторка за період',
    notice: 'Організація → контрагент, поточні договори покупців і чотири показники залишків та руху. Недоступні суми й залежні підсумки залишаються порожніми; суми різних валют не додаються.',
    dataSource: 41,
    accepts: isGroupedSettlementDataset,
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
      ? [{ fileName: spec.fileName, label: spec.label, ...('currencyAxis' in spec ? { currencyAxis: spec.currencyAxis } : {}),
        notice: spec.dataSource === 35 && isDayOrganizationBasisCapability(candidate.dayOrganizationBasis)
          ? 'Часткова форма Excel: день → організація, суми EUR та рентабельність %. «Продажі мінус повернення за період» підтримують до 31 дня та доступні відбори. Недоступні собівартість, ПДВ і залежні показники залишаються порожніми. Для «Продажі з поверненнями за день» оберіть один день, товар без послуг, організації та групу покупців.'
          : spec.dataSource === 40 && groupedCashSupported(candidate)
            ? 'Показано банківські рахунки та каси: вісім показників у валюті рахунку й управлінській валюті. Відбори рахунку, організації, валюти та виду доступні у формі.'
          : spec.dataSource === 40 && cashPeriodSupportsManagement(candidate)
          ? 'Часткова форма Excel: один рахунок, вісім показників залишків і руху у валюті рахунку та управлінській валюті. Оберіть рахунок і завершений період до 31 дня. Недоступні суми залишаються порожніми.'
          : spec.dataSource === 41 && isGroupedSettlementDataset(candidate)
          ? spec.fileName === 'ДБіторка.xls' ? spec.notice
            : 'Організація → валюта → контрагент, поточні договори покупців і чотири показники залишків та руху. Оберіть відбори й період до 31 дня; договори без повних даних залишаються з порожніми сумами та підсумками.'
          : spec.dataSource === 38 && isSupplierBasisCapability(candidate.supplierBasis)
          ? 'Склад документа → організація → постачальник, продажі мінус повернення за період до 31 дня. Невизначені постачальник і склад показуються окремо. Недоступні собівартість і прибуток залишаються порожніми, зокрема у підсумках.'
          : spec.dataSource === 38 && candidate.Groupings.some((field: { Type: number }) => field.Type === 78)
          ? `${spec.notice} Для групування як в 1С оберіть шаблон «Валовий прибуток за складом продажу 1С»; він вимагає повних джерельних ID для всього періоду.`
          : spec.notice,
        dataset: matches[0] }]
      : []
  })
}
