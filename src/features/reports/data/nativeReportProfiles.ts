import { AGREEMENT_PRICES_TITLE, AGREEMENT_PRICES_CAPTION } from './agreementPrices'
import { PAYMENT_COMPARISON_TITLE } from './paymentComparison'
import { MARGIN_COMPARISON_TITLE } from './marginComparison'
import { RATE_COMPARISON_TITLE } from './rateComparison'
import { RETURN_COMPARISON_TITLE } from './returnComparison'
import { BUYER_SALES_SHARE_TITLE } from './buyerSalesShare'
import { REVENUE_COMPARISON_TITLE } from './revenueComparison'
import { XYZ_TITLE } from './salesXyz'
import { IMPORTED_PAYMENTS_TITLE } from './importedPayments'
import { CLIENT_COMPARISON_TITLE } from './clientPeriodComparison'
import { CLIENT_ACTIVITY_REPORT_TITLE } from './clientActivityReport'
import { PRICE_TYPE_SALES_COMPARISON_DEFAULT_MEASURES, PRICE_TYPE_SALES_COMPARISON_DEFAULT_ROWS, PRICE_TYPE_SALES_COMPARISON_TITLE } from './priceTypeSalesComparison'
import { CURRENT_STOCK_REPORT_TITLES, getCurrentStockReport, isCurrentStockPresetId, isCurrentStockSource, type CurrentStockPresetId } from './currentStockReports'
import { IMPORTED_SALE_DISCOUNT_TITLE } from './importedSaleDiscount'
import { DAY_ORGANIZATION_GROSS_PROFIT_TITLE } from './dayOrganizationGrossProfit'
import { VPARIVANIE_TITLE } from './vparivanie'
import { CURRENT_VPARIVANIE_TITLE, CURRENT_VPARIVANIE_NOTICE } from './currentVparivanie'
import { CASH_PERIOD_TITLE } from './cashPeriod'
import { SETTLEMENT_PERIOD_TITLE } from './settlementPeriod'
import { SUPPLIER_BATCH_GROSS_PROFIT_TITLE } from './supplierBatchGrossProfit'

export const SUPPLIER_RETURN_REPORT_TITLE = 'Звіт документів повернень постачальникам'
export const DEBT_REPORT_TITLE = 'Звіт поточної заборгованості'
export const SUPPLIER_RETURN_QUANTITY_CAPTION = 'Записана кількість повернення'
export const DEBT_AMOUNT_CAPTION = 'Записана заборгованість'
export const ACCOUNT_BALANCE_REPORT_TITLE = 'Записані залишки рахунків'
export const ACCOUNT_BALANCE_AMOUNT_CAPTION = 'Записаний залишок рахунку'
export const CURRENT_AGREEMENT_GROUP_DISCOUNT_TITLE = 'Поточні знижки за договором і групою товарів'
export const AGREEMENT_PRICE_COMPARISON_TITLE = 'Порівняння цін двох договорів'
export const RECORDED_SALE_GROSS_PROFIT_TITLE = 'Валовий прибуток проведених продажів GBA'
const DOCUMENT_REPORT_PROFILES = [
  { dataSource: 41, title: SETTLEMENT_PERIOD_TITLE, rowGroupings: [4, 41, 76, 77], measurements: [88, 89, 90, 91],
    preset: { id: 'native-settlement-period-agreement-currency', name: 'Взаєморозрахунки: рух за договором',
      description: 'Один точний договір у валюті взаєморозрахунків. Початок, надходження, витрати й кінець за період до 31 завершеного дня Києва. Повне покриття перевіряє сервер.' } },
  { dataSource: 40, title: CASH_PERIOD_TITLE, rowGroupings: [43, 40, 42, 41], measurements: [84, 85, 86, 87],
    preset: { id: 'native-cash-period-account-currency', name: 'Кошти: рух за рахунком',
      description: 'Один точний валютний запис рахунку. Початок, надходження, витрати й кінець у власній валюті рахунку за включний період до 31 завершеного дня Києва. Без FX і керівної валюти; неповне покриття відхиляється сервером.' } },
  { dataSource: 39, title: CURRENT_VPARIVANIE_TITLE, rowGroupings: [5], measurements: [83],
    preset: { id: 'vparivanie-current-native-matrix', name: 'Впарювання: поточна матриця',
      description: `Оберіть до 128 товарів або одну групу товарів і період продажів до 366 днів. ${CURRENT_VPARIVANIE_NOTICE}` } },
  { dataSource: 38, title: SUPPLIER_BATCH_GROSS_PROFIT_TITLE, rowGroupings: [73, 4, 21], measurements: [0, 2, 6, 10, 12, 14],
    preset: { id: 'recorded-supplier-batch-gross-profit', name: 'Валовий прибуток за постачальниками',
      description: 'Склад партії джерела → організація → постачальник. До 31 дня імпортованих повністю розподілених продажів GBA. Часткові та непідтверджені партії не формують звіт; відповідність XLS 1С не підтверджена.' } },
  { dataSource: 36, title: VPARIVANIE_TITLE, rowGroupings: [5], measurements: [80, 81, 82],
    preset: { id: 'vparivanie-certified-product-stock-sales', name: 'Впарювання: товар і клієнт',
      description: 'Один точний товар і період до 366 днів. Підтверджений залишок на кінець періоду, продажі та кількість за вибраним клієнтом. Оберіть товар; клієнт впливає лише на третій показник. Менеджер і повна відповідність XLS 1С ще не підтверджені.' } },
  { dataSource: 35, title: DAY_ORGANIZATION_GROSS_PROFIT_TITLE, rowGroupings: [3, 4], measurements: [2, 3, 4, 6, 7, 8, 10, 12, 14, 15],
    preset: { id: 'recorded-sale-gross-profit-by-day-organization', name: 'Валовий прибуток GBA за днем і організацією',
      description: 'До 31 дня проведених продажів GBA: день → поточна записана організація. Десять EUR-показників з окремим ПДВ. Точні відбори «Товар без послуг», п’ять організацій і «Покупці» Fenix перевіряють локальне покриття за обраний період. Невідома собівартість порожня; відповідність XLS 1С не підтверджена.' } },
  { dataSource: 32, title: IMPORTED_SALE_DISCOUNT_TITLE, rowGroupings: [12, 15, 5], measurements: [79],
    preset: { id: 'imported-sale-recorded-discount-by-agreement-product', name: 'Записана знижка/націнка GBA',
      description: 'До 31 дня імпортованих продажів GBA: клієнт → точний договір → товар. Обов’язково виберіть один договір. Показник зі знаком у EUR без ПДВ; повернення не віднімаються, відповідність звіту 1С не підтверджена.' } },
  { dataSource: 30, title: RECORDED_SALE_GROSS_PROFIT_TITLE, rowGroupings: [12, 15], measurements: [2, 6, 10, 14],
    preset: { id: 'recorded-sale-gross-profit-by-agreement', name: 'Валовий прибуток GBA за договорами',
      description: 'До 31 дня проведених продажів GBA: клієнт → точний договір. Продажі й собівартість без ПДВ, прибуток і рентабельність. Повернення не віднімаються; відповідність 1С не підтверджена.' } },
  { dataSource: 31, title: AGREEMENT_PRICE_COMPARISON_TITLE, rowGroupings: [5, 28], measurements: [75, 76, 77, 78],
    preset: { id: 'current-two-agreement-product-prices', name: 'Ціни двох договорів',
      description: 'Товар → одиниця виміру. Поточні ціни EUR двох точних договорів, різниця EUR та %. Оберіть явний список товарів; ціни різних товарів не додаються.' } },
  { dataSource: 29, title: CURRENT_AGREEMENT_GROUP_DISCOUNT_TITLE, rowGroupings: [15, 10], measurements: [74],
    preset: { id: 'current-agreement-group-discounts', name: 'Чинні знижки за договорами',
      description: 'Точний договір клієнта → група товарів. Поточна ставка з нашої бази; історичний зріз і товарні правила 1С не підставляються.' } },
  { dataSource: 26, title: '1С: ABC-аналіз продажів', rowGroupings: [46, 5], measurements: [4, 2],
    preset: { id: 'one-c-sales-abc', name: 'ABC продажів за товаром', description: 'ABC-клас → точний товар. Захоплений алгоритм 1С за записаною виручкою GBA; частки A/B/C задаються явно.' } },
  { dataSource: 28, title: '1С: Аналіз цін', rowGroupings: [68, 69], measurements: [72, 73],
    preset: { id: 'one-c-price-analysis', name: 'Аналіз цін Fenix', description: 'Товар → характеристика. Останні зрізи власних і контрагентських цін на одну дату; договірну ціну й рекомендацію не обчислює.' } },
  { dataSource: 25, title: '1С: Знижки клієнтів', rowGroupings: [55, 53, 62, 58], measurements: [64],
    preset: { id: 'one-c-client-discounts', name: 'Знижки клієнтів 1С', description: 'Клієнт → товар → регіон → тип ціни. Максимальний відсоток останнього зрізу на вибрану дату.' } },
  { dataSource: 24, title: '1С: Надані знижки', rowGroupings: [57, 55, 53], measurements: [65, 66],
    preset: { id: 'one-c-provided-discounts', name: 'Надані знижки 1С', description: 'Договір → клієнт → товар. Сума знижки та ПДВ зі знаком вихідного обороту за явний період.' } },
  { dataSource: 23, title: '1С: Аналіз знижок і націнок номенклатури', rowGroupings: [57, 55, 53], measurements: [64],
    preset: { id: 'one-c-discount-markup', name: 'Знижки й націнки 1С', description: 'Договір → клієнт → товар. Максимальний відсоток останнього зрізу на вибрану дату.' } },
  { dataSource: 27, title: PRICE_TYPE_SALES_COMPARISON_TITLE, rowGroupings: PRICE_TYPE_SALES_COMPARISON_DEFAULT_ROWS, measurements: PRICE_TYPE_SALES_COMPARISON_DEFAULT_MEASURES,
    preset: { id: 'one-c-sales-by-global-price-type', name: 'Продажі за глобальним типом ціни',
      description: 'Клієнт → товар. Сума продажу з ПДВ, сума за одним глобальним типом ціни Fenix і різниця. Порівняльна ціна не є ціною договору й не використовується для рекомендацій.' } },
  { dataSource: 22, title: AGREEMENT_PRICES_TITLE, rowGroupings: [5, 28], measurements: [63],
    preset: { id: 'product-prices-by-agreement', name: 'Ціни товарів за договором',
      description: 'Товар → одиниця виміру. Поточна ціна EUR за точним договором клієнта, незалежно від складських залишків. Непідтверджені ціни залишаються порожніми; ціни не додаються.' } },
  { dataSource: 21, title: PAYMENT_COMPARISON_TITLE, rowGroupings: [41, 12, 15], measurements: [59, 60, 61, 62],
    preset: { id: 'imported-payment-period-comparison', name: 'Платежі: порівняння за договорами', description: 'Валюта → клієнт → точний договір. Надходження або виплати за двома незалежними періодами у власній валюті; непідтверджені суми залишаються невідомими.' } },
  { dataSource: 20, title: MARGIN_COMPARISON_TITLE, rowGroupings: [12, 15], measurements: [55, 56, 57, 58],
    preset: { id: 'sale-margin-period-comparison', name: 'Маржа без ПДВ: порівняння за договорами', description: 'Клієнт → точний договір. Маржа за двома незалежними періодами, різниця у відсоткових пунктах і відносна зміна; непідтверджена собівартість залишається невідомою.' } },
  { dataSource: 19, title: RATE_COMPARISON_TITLE, rowGroupings: [52], measurements: [51, 52, 53, 54],
    preset: { id: 'historical-rate-comparison', name: 'Історичні курси: дві дати', description: 'Одна точна серія комерційного або державного курсу. Дві незалежні дати; пропущена історія залишається невідомою, підсумки не обчислюються.' } },
  { dataSource: 18, title: RETURN_COMPARISON_TITLE, rowGroupings: [12, 15], measurements: [47, 48, 49, 50],
    preset: { id: 'sale-return-period-comparison', name: 'Повернення покупців: порівняння періодів',
      description: 'Клієнт → точний договір. Записані повернення EUR за двома періодами, зміна суми та відсоток; непідтверджені імпортовані суми залишаються невідомими.' } },
  { dataSource: 17, title: BUYER_SALES_SHARE_TITLE, rowGroupings: [12, 15], measurements: [39, 40, 41, 42, 43, 44, 45, 46],
    preset: { id: 'buyer-sales-share-period-comparison', name: 'Нові й повторні покупці: частки продажів',
      description: 'Клієнт → точний договір. Частки записаних продажів EUR новим і повторним покупцям за двома періодами; зміна у відсоткових пунктах та відносна зміна.' } },
  { dataSource: 16, title: REVENUE_COMPARISON_TITLE, rowGroupings: [12, 15], measurements: [35, 36, 37, 38],
    preset: { id: 'sale-revenue-period-comparison', name: 'Виручка за договорами: порівняння періодів',
      description: 'Клієнт → точний договір. Записана виручка EUR за двома явними періодами, зміна суми та відсоток із незалежною відомістю кожного періоду.' } },
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
export const CURRENT_REPORT_TITLES: ReadonlySet<string> = new Set([...CURRENT_STOCK_REPORT_TITLES, DEBT_REPORT_TITLE, ACCOUNT_BALANCE_REPORT_TITLE, AGREEMENT_PRICES_TITLE, CURRENT_AGREEMENT_GROUP_DISCOUNT_TITLE, AGREEMENT_PRICE_COMPARISON_TITLE])
export function getNativeReportProfile(dataSource: number | undefined) {
  return getCurrentStockReport(dataSource) ?? DOCUMENT_REPORT_PROFILES.find(report => report.dataSource === dataSource)
}
export function isNativeReportPresetId(id: string): id is NativeReportPresetId {
  return isCurrentStockPresetId(id) || DOCUMENT_REPORT_PROFILES.some(report => report.preset.id === id)
}
export function isCurrentReportSource(dataSource: number | undefined): boolean {
  return isCurrentStockSource(dataSource) || dataSource === 10 || dataSource === 11 || dataSource === 22 || dataSource === 29 || dataSource === 31
}
export function usesNativeReportLookup(dataSource: number | undefined): boolean {
  return isCurrentReportSource(dataSource) || dataSource === 9 || dataSource === 12 || dataSource === 13 || dataSource === 14 || dataSource === 15 || dataSource === 16 || dataSource === 17 || dataSource === 18 || dataSource === 20 || dataSource === 21 || dataSource === 23 || dataSource === 24 || dataSource === 25 || dataSource === 26 || dataSource === 27 || dataSource === 28 || dataSource === 30 || dataSource === 32 || dataSource === 35 || dataSource === 36 || dataSource === 38 || dataSource === 39 || dataSource === 40 || dataSource === 41
}

const FULL_DATE_RANGE_SOURCES = new Set([13, 14, 15, 16, 17, 18, 20, 21, 24, 30, 32, 36, 38, 39, 40, 41])
const FIXED_AXES_SOURCES = new Set([15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28, 29, 30, 31, 32, 36, 38, 39, 40, 41])
export const supportsFullReportDateRange = (dataSource: number): boolean => FULL_DATE_RANGE_SOURCES.has(dataSource)
export const hasFixedReportAxes = (dataSource: number): boolean => FIXED_AXES_SOURCES.has(dataSource)


// Units belong to the selected report and caption, independently of VAT controls.
export function nativeReportMeasurementUnit(dataSource: number, caption: string): string | undefined {
  if (dataSource === 41) return 'Валюта взаєморозрахунків договору'
  if (dataSource === 40) return 'Валюта вибраного рахунку'
  if (dataSource === 36 || dataSource === 39) return 'Кількість товару'
  if (dataSource === 38) return caption.includes('%') ? 'Відсотки' : caption.toLowerCase().includes('кількість') ? 'Кількість товару' : 'Євро'
  if (dataSource === 32) return 'Євро'
  if (dataSource === 30 || dataSource === 35) return caption.includes('%') ? 'Відсотки' : 'Євро'
  if (dataSource === 31) return caption.includes('%') ? 'Відсотки' : 'Євро за одиницю товару'
  if (dataSource === 29) return 'Відсотки'
  if (dataSource === 27) {
    if (caption.includes('%')) return 'Відсотки'
    if (caption.includes('Кількість')) return 'Одиниці зберігання 1С'
    if (caption.includes('глобальним типом цін') || caption.includes('сумою за типом цін')) {
      return 'Значення за формулою 1С без валютного перерахунку'
    }
    return 'Валюта управлінського обліку 1С'
  }
  if (dataSource === 22) return caption === AGREEMENT_PRICES_CAPTION ? 'Євро за одиницю товару' : undefined
  if (dataSource === 21) return caption.endsWith('%') ? 'Відсотки' : 'Валюта рядка'
  if (dataSource === 20) return caption.endsWith('в.п.') ? 'Відсоткові пункти' : 'Відсотки'
  if (dataSource === 19) return caption.endsWith('%') ? 'Відсотки' : 'Курс за одиницю базової валюти'
  if (dataSource === 17) return caption.endsWith('в.п.') ? 'Відсоткові пункти' : 'Відсотки'
  if (dataSource === 18) return caption.endsWith('%') ? 'Відсотки' : 'Євро'
  return undefined
}
