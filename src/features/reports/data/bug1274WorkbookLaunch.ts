import { currentProfitMaximumDays, isProfitReadModeCapability, requestProfitReadMode } from './profitReadMode'
import { isSettlementReadModeCapability, requestSettlementReadMode } from './settlementReadMode'
import { isCashReadModeCapability } from './cashReadMode'
import type { ReportDataset, ReportRequestBody } from '../types'
import { cashCurrencyRecordWorkbookSupported, cashWorkbookPresentationSupported, readWorkbookCapability,
  requestWorkbookPresentation } from './workbookPresentation'
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
import { BUG_1274_ONLY_REPORT_SURFACE } from '../reportSurfacePolicy'
import { BUG_1274_PARITY_NOTICE } from './reportMigration'
import { SETTLEMENT_WORKBOOK_EXCLUDED_GROUPS, sourceCounterpartyGroupCapability } from './sourceCounterpartyGroups'
import { requestSupplierBasis } from './supplierBasis'
import { requestSupplierSourceWorld } from './supplierBatchGrossProfit'
import { SUPPLIER_WORKBOOK_FILE, SUPPLIER_WORKBOOK_FILTERS_NOTICE, VPARIVANIE_WORKBOOK_FILE, VPARIVANIE_WORKBOOK_FILTERS_NOTICE,
  type ResolvedWorkbookFilters } from './bug1274WorkbookFilters'

export type WorkbookLaunch = {
  fileName: string
  label: string
  notice: string
  dataset: ReportDataset
  currencyAxis?: boolean
}

/** Completed-day reports open on the previous Kyiv day: today's documents are still incomplete. */
const PREVIOUS_DAY_DEFAULT_SOURCES: ReadonlySet<number> = new Set([35, 38, 40, 41])

export function opensOnPreviousDay(dataSource: number): boolean {
  return PREVIOUS_DAY_DEFAULT_SOURCES.has(dataSource)
}

export const SETTLEMENT_READ_MODE_NOTICE = BUG_1274_ONLY_REPORT_SURFACE
  ? 'Форма відкривається з джерелом «Поточні документи GBA»: документи GBA та початкові залишки на 01.01.2025, період від 01.01.2025 до 120 календарних місяців.'
  : 'Форма відкривається з джерелом «Поточні документи GBA»: документи GBA та початкові залишки на 01.01.2025, період від 01.01.2025 до 120 календарних місяців. Для розрахунку за регістрами 1С оберіть «Збережені регістри 1С» у джерелі розрахунку.'
export const CASH_READ_MODE_NOTICE = SETTLEMENT_READ_MODE_NOTICE
export const DEBTOR_WORKBOOK_CURRENCY_NOTICE = 'Як в 1С: суми договорів контрагента в різних валютах додаються в один рядок без перерахунку; підсумки організацій і загальний підсумок також додають валюти без перерахунку.'
export const SETTLEMENT_WORKBOOK_CURRENCY_NOTICE = 'Як в 1С: рядки розділено за валютою взаєморозрахунків; підсумки організацій і загальний підсумок додають суми різних валют без перерахунку.'

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
    label: 'Матриця товарів',
    notice: `Часткова форма Excel: залишки GBA на кінець періоду і продажі за вибраний період. ${VPARIVANIE_WORKBOOK_FILTERS_NOTICE} До останньої синхронізації залишків з 1С залишок порожній. Продажі: ${BUG_1274_PARITY_NOTICE}`,
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
    notice: `Організація → контрагент, поточні договори покупців і чотири показники залишків та руху. Недоступні суми й залежні підсумки залишаються порожніми. ${DEBTOR_WORKBOOK_CURRENCY_NOTICE}`,
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
        notice: (spec.dataSource === 35 || spec.dataSource === 38) && isProfitReadModeCapability(candidate.profitReadMode)
          ? profitReadModeNotice(spec.dataSource, candidate)
          : spec.dataSource === 35 && isDayOrganizationBasisCapability(candidate.dayOrganizationBasis)
          ? 'Часткова форма Excel: день → організація, суми EUR та рентабельність %. Для нового запиту застосовано відбори книги: товар без послуг, чотири організації GBA (ФОП Пархоменко не синхронізується) і група «Покупці» Fenix. Їх можна змінити у формі. «Продажі мінус повернення за період» підтримують до 31 дня. Недоступні собівартість, ПДВ і залежні показники залишаються порожніми.'
          : spec.dataSource === 40 && groupedCashSupported(candidate)
            ? groupedCashNotice(candidate)
          : spec.dataSource === 40 && cashPeriodSupportsManagement(candidate)
          ? 'Часткова форма Excel: один рахунок, вісім показників залишків і руху у валюті рахунку та управлінській валюті. Оберіть рахунок і завершений період до 31 дня. Недоступні суми залишаються порожніми.'
          : spec.dataSource === 41 && isGroupedSettlementDataset(candidate)
          ? groupedSettlementNotice(spec.fileName, candidate)
          : spec.dataSource === 38 && isSupplierBasisCapability(candidate.supplierBasis)
          ? 'Склад документа → організація → постачальник, продажі мінус повернення за період до 31 дня. Невизначені постачальник і склад показуються окремо. Недоступні собівартість і прибуток залишаються порожніми, зокрема у підсумках.'
          : spec.dataSource === 38 && candidate.Groupings.some((field: { Type: number }) => field.Type === 78)
          ? `${spec.notice} Для групування як в 1С оберіть шаблон «Валовий прибуток за складом продажу 1С»; він вимагає повних джерельних ID для всього періоду.`
          : spec.notice,
        dataset: matches[0] }]
      : []
  })
}

function profitReadModeNotice(dataSource: number, dataset: ReportDataset): string {
  const original = dataSource === 35 ? '«Збережені регістри 1С» і відбори Fenix' : '«Збережені регістри 1С»'
  const filters = dataSource === 35 ? ` ${DAY_WORKBOOK_FILTERS_NOTICE}`
    : isSourceBuyerSubtreeCapability(dataset.sourceBuyerSubtree) ? ` ${SUPPLIER_WORKBOOK_FILTERS_NOTICE}` : ''
  const notice = `Форма відкривається з джерелом «Поточні документи GBA»: продажі та повернення з поточних документів за період до ${currentProfitMaximumDays(dataset.profitReadMode)} календарних днів.${filters} ${BUG_1274_AMG_PARITY_NOTICE}`
  return BUG_1274_ONLY_REPORT_SURFACE ? notice : `${notice} Для розрахунку за регістрами 1С оберіть ${original}.`
}

export const BUG_1274_AMG_PARITY_NOTICE = `${BUG_1274_PARITY_NOTICE} ТОВ «АМГ «КОНКОРД» розраховано й звірено за базою 1С AMG.`
export const DAY_WORKBOOK_FILTERS_NOTICE = 'Застосовано відбори книги: товар без послуг, організації ТОВ «АМГ «КОНКОРД», Фенікс, ФОП Самолюк А.Д. і ФОП Самолюк Ю.М. (ФОП Пархоменко не синхронізується в GBA), група «Покупці» Fenix і додаткові поля Артикул/Топ із порядком за місяцями.'
export const SETTLEMENT_WORKBOOK_EXCLUSIONS_NOTICE = `Застосовано виключення книги: ${SETTLEMENT_WORKBOOK_EXCLUDED_GROUPS.map(group => group.Name).join('; ')}.`

export const CASH_CURRENCY_RECORD_NOTICE = 'Як в 1С, кожна валюта рахунку чи каси — окремий рядок із сумами у своїй валюті.'

function groupedCashNotice(dataset: ReportDataset): string {
  const base = 'Показано банківські рахунки та каси: вісім показників у валюті рахунку й управлінській валюті. Відбори рахунку, організації, валюти та виду доступні у формі.'
  const notice = cashCurrencyRecordWorkbookSupported(dataset) ? `${base} ${CASH_CURRENCY_RECORD_NOTICE}` : base
  return isCashReadModeCapability(dataset.cashReadMode) ? `${notice} ${CASH_READ_MODE_NOTICE}` : notice
}

function groupedSettlementNotice(fileName: string, dataset: ReportDataset): string {
  const parties = groupedSettlementSupportsSuppliers(dataset) ? 'покупців і постачальників' : 'покупців'
  const current = isSettlementReadModeCapability(dataset.settlementReadMode)
  const period = current ? 'Період може включати поточний київський день' : 'Період до 31 дня може включати поточний київський день'
  const notice = fileName === 'ДБіторка.xls'
    ? `Організація → контрагент, поточні договори ${parties} за вибраними відборами й чотири показники залишків та руху. ${period}. Недоступні суми й залежні підсумки залишаються порожніми. ${DEBTOR_WORKBOOK_CURRENCY_NOTICE}`
    : `Організація → валюта → контрагент, поточні договори ${parties} за вибраними відборами й чотири показники залишків та руху. ${period}; договори без повних даних залишаються з порожніми сумами та підсумками. ${SETTLEMENT_WORKBOOK_CURRENCY_NOTICE}`
  const exclusions = current && fileName === 'Взаємороз всі.xls' && sourceCounterpartyGroupCapability(dataset.sourceCounterpartyGroups)
    ? ` ${SETTLEMENT_WORKBOOK_EXCLUSIONS_NOTICE}` : ''
  return current ? `${notice}${exclusions} ${SETTLEMENT_READ_MODE_NOTICE}` : notice
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
export function bug1274WorkbookRequest(request: ReportRequestBody, launch?: WorkbookLaunch,
  resolved?: ResolvedWorkbookFilters): ReportRequestBody {
  if (!launch || launch.dataset.DataSource !== request.dataSource) return request
  const selected = filtersWorkbookRequest(supplierWorkbookRequest(settlementWorkbookRequest(
    groupedWorkbookRequest(dayWorkbookRequest(request, launch), launch.currencyAxis), launch), launch), launch, resolved)
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

function supplierWorkbookRequest(request: ReportRequestBody, launch: WorkbookLaunch): ReportRequestBody {
  if (launch.fileName !== SUPPLIER_WORKBOOK_FILE || request.dataSource !== 38 || requestProfitReadMode(request) !== 0
    || requestSupplierBasis(request) !== 0 || requestSupplierSourceWorld(request) != null
    || !isSourceBuyerSubtreeCapability(launch.dataset.sourceBuyerSubtree)
    || Object.keys(request).some(key => key.toLowerCase() === 'sourcebuyersubtree')) return request
  return { ...structuredClone(request), sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID } }
}

function filtersWorkbookRequest(request: ReportRequestBody, launch: WorkbookLaunch,
  resolved?: ResolvedWorkbookFilters): ReportRequestBody {
  if (!resolved || resolved.fileName !== launch.fileName || !resolved.selections.length
    || ![SUPPLIER_WORKBOOK_FILE, VPARIVANIE_WORKBOOK_FILE].includes(launch.fileName)
    || request.dataSource !== (launch.fileName === SUPPLIER_WORKBOOK_FILE ? 38 : 39)
    || !Array.isArray(request.selections) || request.selections.length) return request
  return { ...structuredClone(request), selections: structuredClone(resolved.selections) }
}

function settlementWorkbookRequest(request: ReportRequestBody, launch: WorkbookLaunch): ReportRequestBody {
  if (launch.fileName !== 'Взаємороз всі.xls' || request.dataSource !== 41 || requestSettlementReadMode(request) !== 0
    || groupedSettlementPeriod(requestGroupedSettlementPeriod(request))?.SourceWorld !== 'Fenix'
    || !sourceCounterpartyGroupCapability(launch.dataset.sourceCounterpartyGroups)
    || Object.keys(request).some(key => key.toLowerCase() === 'sourcecounterpartygroups')) return request
  return { ...structuredClone(request), sourceCounterpartyGroups: { Version: 1, SourceWorld: 'fenix', IncludeGroupIds: [],
    ExcludeGroupIds: SETTLEMENT_WORKBOOK_EXCLUDED_GROUPS.map(group => group.Id) } }
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
        ? [30] : [60, 61], ordering: null } }
  if (launch.fileName !== 'Ведомость по денежным средствам.xls' || !cashWorkbookPresentationSupported(launch.dataset)
    || !groupedCashPeriod(requestGroupedCashPeriod(request))) return request
  const rowType = cashCurrencyRecordWorkbookSupported(launch.dataset) ? 42 : 40
  const rows = datasetGroupings(launch.dataset).filter(row => row.type === rowType)
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
