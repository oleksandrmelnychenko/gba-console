import type { ReportDataset, ReportRequestBody, SpreadsheetCellValue } from '../types'
import { defaultDatasetRequest } from './reportDatasets'
import { BUYER_SALES_SHARE_CAPTIONS, BUYER_SALES_SHARE_TITLE, defaultBuyerSalesShare } from './buyerSalesShare'
import { BUYER_SALES_SHARE_EMPTY_STATE } from './buyerSalesShareSpreadsheet'

// Synthetic UI controls. Actual frozen server capabilities and writer output are
// reconciled separately before acceptance; these examples contain no client data.
export const buyerShareDataset: ReportDataset = {
  DataSource: 17, Name: BUYER_SALES_SHARE_TITLE,
  Description: 'Частки записаних продажів EUR новим і повторним покупцям за двома періодами.',
  Groupings: [{ Type: 12, Name: 'Клієнт' }, { Type: 15, Name: 'Договір' }],
  Measurements: BUYER_SALES_SHARE_CAPTIONS.map((Name, index) => ({ Type: index + 39, Name, Selectable: true })),
  Filters: [{ Type: 1, Name: 'Товар' }, { Type: 2, Name: 'Артикул' }, { Type: 6, Name: 'Клієнт' }, { Type: 9, Name: 'Договір' }],
  Limitations: ['Записані суми EUR та історія проведених продажів у GBA; ціни за договором повторно не обчислюються.'],
  PeriodRequired: true, PeriodSupported: true,
  BuyerSalesShare: {"Version": 1, "Required": true, "DateFormat": "yyyy-MM-dd", "CalendarTimezone": "Europe/Kyiv", "BaseResources": [4], "RoundingPolicy": "NativeBuyerSalesShareRawGrossFinalAwayFromZero2", "RequiredRows": [12, 15], "ColumnsSupported": false, "MaximumFacts": 200000, "MaximumPeriodMemberships": 400000, "MaximumContracts": 200000, "MaximumDenseCells": 1000000, "MaximumSelections": 64, "MaximumFilterValues": 2000, "PublishedDecimalPlaces": 2, "ZeroPreviousPolicy": "Both shares known and previous raw ratio=0 gives relative change100, including0/0", "UnknownPolicy": "Any unknown amount makes both shares of that period unknown; changes require both periods known; unknown buyer rejects the report", "OrderingPolicy": "Positive ClientID ascending, exact ClientAgreementID ascending", "ClassificationPolicy": "New buyer has no qualifying native sale before each independent period start; repeat buyer has prior activity", "ShareZeroDenominatorPolicy": "Known raw total=0 gives both shares0, including signed cancellation; no0..100 clamp", "HistoryPolicy": "All qualifying activity across all buyer agreements/products; display filters never restrict history; no200000-history-row truncation", "SourceParityVerified": false},
  FilterExpression: { Version: 1, MaximumDepth: 8, MaximumLeaves: 64, MaximumNodes: 128, Operators: [1, 2] },
}
export function buyerShareRequest(): ReportRequestBody {
  return { ...defaultDatasetRequest(buyerShareDataset, '2026-07-01', '2026-07-31'), buyerSalesShare: { ...defaultBuyerSalesShare(), From: '2026-06-01', To: '2026-06-30' } }
}
const notes = [
  'Періоди часток: два незалежні періоди з включними крайніми днями за Києвом.',
  'Основа часток: записані суми продажів EUR; ціни повторно не обчислюються.',
  'Історія покупців: усі договори й товари покупця до початку кожного періоду; відбори не змінюють історію.',
  'Правила часток: частка × 100; зміна у відсоткових пунктах; відносна зміна у відсотках. Нульова попередня частка дає 100.',
  'Точність часток: сервер обчислює частки з початкових сум і остаточно округлює до двох знаків.',
  'Покриття часток: невідомий період залишається порожнім; інший зберігається незалежно.',
  'Підсумки часток: сервер повторно обчислює частки з сум, не додає відсотки рядків.',
  'Джерело часток: поточні записи GBA; повну тотожність 1С не підтверджено.',
]
export function buyerShareRows(kind = 'known', selected = [0, 1, 2, 3, 4, 5, 6, 7]): SpreadsheetCellValue[][] {
  let values: SpreadsheetCellValue[][]
  if (kind === 'empty') values = [['Загальний підсумок', '', 0, 0, 0, 100, 0, 0, 0, 100]]
  else if (kind === 'current-unknown') values = [
    ['Клієнт [1]', 'Договір [201]', null, 100, null, null, null, 0, null, null],
    ['Загальний підсумок', '', null, 100, null, null, null, 0, null, null],
  ]
  else if (kind === 'previous-unknown') values = [
    ['Клієнт [1]', 'Договір [201]', 100, null, null, null, 0, null, null, null],
    ['Загальний підсумок', '', 100, null, null, null, 0, null, null, null],
  ]
  else if (kind === 'both-unknown') values = [
    ['Клієнт [1]', 'Договір [201]', null, null, null, null, null, null, null, null],
    ['Загальний підсумок', '', null, null, null, null, null, null, null, null],
  ]
  else if (kind === 'raw-rounding') values = [
    ['Клієнт [1]', 'Договір [201]', 100, 0, 100, 100, 0, 0, 0, 100],
    ['Клієнт [2]', 'Договір [202]', 0, 100, -100, -100, 100, 0, 100, 100],
    // Raw current new=1, total=300; previous new=1, total=400.
    // Published difference .08 and relative 33.33 are not derived from .33/.25.
    ['Загальний підсумок', '', 0.33, 0.25, 0.08, 33.33, 99.67, 99.75, -0.08, -0.08],
  ]
  else if (kind === 'signed') values = [
    ['Клієнт [1]', 'Договір [201]', 100, 0, 100, 100, 0, 0, 0, 100],
    ['Клієнт [2]', 'Договір [202]', 0, 100, -100, -100, 100, 0, 100, 100],
    ['Загальний підсумок', '', -200, 50, -250, -500, 300, 50, 250, 500],
  ]
  else values = [
    ['Клієнт [1]', 'Договір [201]', 100, 0, 100, 100, 0, 0, 0, 100],
    ['Підсумок: Клієнт [1]', '', 100, 0, 100, 100, 0, 0, 0, 100],
    ['Клієнт [2]', 'Договір [202]', 0, 100, -100, -100, 100, 0, 100, 100],
    ['Підсумок: Клієнт [2]', '', 0, 100, -100, -100, 100, 0, 100, 100],
    // Buyer1: current20/previous0; buyer2: current80/previous20.
    ['Загальний підсумок', '', 20, 100, -80, -80, 80, 0, 80, 100],
  ]
  return [
    [BUYER_SALES_SHARE_TITLE], ['Поточний період: 01.07.2026 – 31.07.2026'], ['Період порівняння: 01.06.2026 – 30.06.2026'],
    ['Час читання (UTC): 09.09.2026 12:00:00.000 – 09.09.2026 12:00:01.000'],
    ['Рядки: Клієнт, Договір'], ['Колонки: —'], ['Показники: ' + selected.map(index => BUYER_SALES_SHARE_CAPTIONS[index]).join(', ')], ['Фільтри: —'],
    ...notes.map(note => ['! ' + note]), ...(kind === 'empty' ? [[BUYER_SALES_SHARE_EMPTY_STATE]] : []), [],
    ['', '', ...selected.map(() => 'Частка продажів покупцям')],
    ['Клієнт', 'Договір', ...selected.map(index => BUYER_SALES_SHARE_CAPTIONS[index])],
    ...values.map(row => [...row.slice(0, 2), ...selected.map(index => row[index + 2])]),
  ]
}
