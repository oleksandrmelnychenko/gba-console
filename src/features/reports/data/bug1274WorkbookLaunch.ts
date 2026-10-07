import type { ReportDataset, ReportRequestBody } from '../types'
import { cashWorkbookPresentationSupported, readWorkbookCapability, requestWorkbookPresentation } from './workbookPresentation'
import { CASH_WORKBOOK_ROWS, groupedCashPeriod, groupedCashSupported, groupedCashWorkbookSupported, requestGroupedCashPeriod } from './groupedCashPeriod'
import { cashPeriodSupportsManagement, isCashPeriodDataset } from './cashPeriod'
import { isSettlementPeriodDataset } from './settlementPeriod'
import { isDayOrganizationBasisCapability, requestDayOrganizationBasis } from './dayOrganizationBasis'
import { DAY_ORGANIZATION_GOODS_KIND_ID, DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS,
  isDayOrganizationGrossProfitDataset } from './dayOrganizationGrossProfit'
import { isSupplierBatchGrossProfitDataset } from './supplierBatchGrossProfit'
import { isSupplierBasisCapability } from './supplierBasis'
import { groupedSettlementPeriod, requestGroupedSettlementPeriod, groupedSettlementSupportsSuppliers, groupedWorkbookRequest, isGroupedSettlementDataset } from './groupedSettlementPeriod'
import { datasetGroupings } from './reportDatasets'
import { isCurrentVparivanieDataset } from './currentVparivanie'
import { FENIX_BUYERS_ROOT_ID, isProductClassificationCapability, isSourceBuyerSubtreeCapability,
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
          ? 'Часткова форма Excel: день → організація, суми EUR та рентабельність %. Для нового запиту застосовано відбори книги: товар без послуг, п’ять організацій і група «Покупці» Fenix. Їх можна змінити у формі. «Продажі мінус повернення за період» підтримують до 31 дня. Недоступні собівартість, ПДВ і залежні показники залишаються порожніми.'
          : spec.dataSource === 40 && groupedCashSupported(candidate)
            ? 'Показано банківські рахунки та каси: вісім показників у валюті рахунку й управлінській валюті. Відбори рахунку, організації, валюти та виду доступні у формі.'
          : spec.dataSource === 40 && cashPeriodSupportsManagement(candidate)
          ? 'Часткова форма Excel: один рахунок, вісім показників залишків і руху у валюті рахунку та управлінській валюті. Оберіть рахунок і завершений період до 31 дня. Недоступні суми залишаються порожніми.'
          : spec.dataSource === 41 && isGroupedSettlementDataset(candidate)
          ? spec.fileName === 'ДБіторка.xls'
            ? `Організація → контрагент, поточні договори ${groupedSettlementSupportsSuppliers(candidate) ? 'покупців і постачальників' : 'покупців'} за вибраними відборами й чотири показники залишків та руху. Період до 31 дня може включати поточний київський день. Недоступні суми й залежні підсумки залишаються порожніми; суми різних валют не додаються.`
            : `Організація → валюта → контрагент, поточні договори ${groupedSettlementSupportsSuppliers(candidate) ? 'покупців і постачальників' : 'покупців'} за вибраними відборами й чотири показники залишків та руху. Період до 31 дня може включати поточний київський день; договори без повних даних залишаються з порожніми сумами та підсумками.`
          : spec.dataSource === 38 && isSupplierBasisCapability(candidate.supplierBasis)
          ? 'Склад документа → організація → постачальник, продажі мінус повернення за період до 31 дня. Невизначені постачальник і склад показуються окремо. Недоступні собівартість і прибуток залишаються порожніми, зокрема у підсумках.'
          : spec.dataSource === 38 && candidate.Groupings.some((field: { Type: number }) => field.Type === 78)
          ? `${spec.notice} Для групування як в 1С оберіть шаблон «Валовий прибуток за складом продажу 1С»; він вимагає повних джерельних ID для всього періоду.`
          : spec.notice,
        dataset: matches[0] }]
      : []
  })
}

/** The retained day workbook has these three exact filters; explicit scopes keep their own meaning. */
function dayWorkbookRequest(request: ReportRequestBody, launch: WorkbookLaunch): ReportRequestBody {
  const dataset = launch.dataset
  if (launch.fileName !== 'ВП.xls' || request.dataSource !== 35 || !isDayOrganizationGrossProfitDataset(dataset)
    || !isDayOrganizationBasisCapability(dataset.dayOrganizationBasis) || requestDayOrganizationBasis(request) !== 0
    || Object.keys(request).filter(key => key.toLowerCase() === 'dayorganizationbasis').length !== 1
    || !isProductClassificationCapability(dataset.productClassification)
    || !isSourceOrganizationsCapability(dataset.sourceOrganizations)
    || !isSourceBuyerSubtreeCapability(dataset.sourceBuyerSubtree)) return request
  const explicit = new Set(Object.keys(request).map(key => key.toLowerCase()))
  if (explicit.has('productclassification') || explicit.has('sourceorganizations') || explicit.has('sourcebuyersubtree')
    || !Array.isArray(request.selections)
    || request.selections.some(selection => selection?.IsChecked !== false && selection?.SelectedField?.Type === 0)) return request
  return { ...structuredClone(request),
    productClassification: { Version: 1, SourceWorld: 0, ProductKindId: DAY_ORGANIZATION_GOODS_KIND_ID, IsService: false },
    sourceOrganizations: { Version: 1, SourceWorld: 'fenix', OrganizationIds: [...DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS] },
    sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID },
  }
}

/** Only the Excel shortcut opts into its supported form; ordinary and saved dataset requests keep their own meaning. */
export function bug1274WorkbookRequest(request: ReportRequestBody, launch?: WorkbookLaunch): ReportRequestBody {
  if (!launch || launch.dataset.DataSource !== request.dataSource) return request
  const selected = groupedWorkbookRequest(dayWorkbookRequest(request, launch), launch.currencyAxis)
  const presented = presentationWorkbookRequest(selected, launch)
  if (presented !== selected) return presented
  if (launch.fileName !== 'Ведомость по денежным средствам.xls' || request.dataSource !== 40
    || !groupedCashWorkbookSupported(launch.dataset) || !groupedCashPeriod(requestGroupedCashPeriod(selected))
    || !Array.isArray(launch.dataset.Groupings)) return selected
  if (CASH_WORKBOOK_ROWS.some(type => {
    const matches = launch.dataset.Groupings.filter(field => field.Type === type)
    return matches.length !== 1 || matches[0].Selectable === false
  })) return selected
  const groupings = datasetGroupings(launch.dataset)
  const result = structuredClone(selected)
  result.sorted.Row = CASH_WORKBOOK_ROWS.flatMap(type => groupings.filter(row => row.type === type))
  return result
}

function presentationWorkbookRequest(request: ReportRequestBody, launch: WorkbookLaunch): ReportRequestBody {
  if (requestWorkbookPresentation(request) !== undefined || !readWorkbookCapability(launch.dataset.workbookPresentation, request.dataSource ?? -1)) return request
  if (launch.fileName === 'ВП.xls' && request.dataSource === 35 && requestDayOrganizationBasis(request) === 0)
    return { ...structuredClone(request), workbookPresentation: { version: 1, additionalFields: [2, 3], ordering: 'MonthAscending' } }
  if (request.dataSource === 41 && isGroupedSettlementDataset(launch.dataset)
    && groupedSettlementPeriod(requestGroupedSettlementPeriod(request))
    && (launch.fileName === 'Взаємороз всі.xls' || launch.fileName === 'ДБіторка.xls'))
    return { ...structuredClone(request), workbookPresentation: { version: 1,
      additionalFields: launch.fileName === 'ДБіторка.xls' || groupedSettlementPeriod(requestGroupedSettlementPeriod(request))?.SourceWorld !== 'Fenix'
        ? [30] : [30, 60, 61], ordering: null } }
  if (launch.fileName !== 'Ведомость по денежным средствам.xls' || !cashWorkbookPresentationSupported(launch.dataset)
    || !groupedCashPeriod(requestGroupedCashPeriod(request))) return request
  const rows = datasetGroupings(launch.dataset).filter(row => row.type === 40)
  return rows.length === 1 ? { ...structuredClone(request), sorted: { ...structuredClone(request.sorted), Row: rows },
    workbookPresentation: { version: 1, additionalFields: [30, 33], ordering: null } } : request
}

/** Both settlement workbooks are variants of the same source report. */
export const BUG_1274_WORKBOOK_REPORT_IDS: Readonly<Record<string, string>> = {
  'ВП.xls': 'builtin:ВаловаяПрибыль',
  'ВП по постачальниках.xls': 'builtin:ВаловаяПрибыльПоПоставщикам',
  'Впарювання.xls': 'builtin:ОтчетВпаривание',
  'Ведомость по денежным средствам.xls': 'builtin:ВедомостьДенежныеСредства',
  'Взаємороз всі.xls': 'builtin:ВедомостьВзаиморасчетыСКонтрагентами',
  'ДБіторка.xls': 'builtin:ВедомостьВзаиморасчетыСКонтрагентами',
}
