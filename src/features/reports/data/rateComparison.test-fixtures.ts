import { RATE_COMPARISON_NOTE_PREFIXES } from './rateComparisonSpreadsheet'
import type { ReportDataset, ReportRequestBody, SpreadsheetCellValue } from '../types'
import { defaultDatasetRequest } from './reportDatasets'
import { RATE_COMPARISON_CAPTIONS, RATE_COMPARISON_TITLE } from './rateComparison'
// Captured from actual GbaJsonSerializer source19 capabilities, wave26 wire-01; no SQL/source parity assertion.
export const rateDataset: ReportDataset = {
  "DataSource": 19,
  "Name": "Порівняння історичних курсів валют",
  "Description": "Одна валютна пара: останній записаний курс на кожну з двох незалежних дат.",
  "Groupings": [
    {
      "Type": 52,
      "Name": "Валютна пара",
      "Selectable": true
    }
  ],
  "Measurements": [
    {
      "Type": 51,
      "Name": "Курс на поточну дату",
      "Selectable": true
    },
    {
      "Type": 52,
      "Name": "Курс на дату порівняння",
      "Selectable": true
    },
    {
      "Type": 53,
      "Name": "Зміна курсу",
      "Selectable": true
    },
    {
      "Type": 54,
      "Name": "Зміна курсу, %",
      "Selectable": true
    }
  ],
  "Filters": [],
  "Limitations": [
    "Комерційний і державний курси обираються окремо за точним записом валютної пари. Курс означає кількість цільової валюти за одиницю базової.",
    "Для кожної дати обирається останній активний запис до кінця записаного календарного дня. Імпорт і ручне введення мають різне походження часу; універсальну відповідність часу Києва чи UTC не підтверджено.",
    "Відсутня історія залишається порожньою. Повторення останньої дати зупиняє звіт; поточний курс або старіший запис не підставляються.",
    "Зміни обчислюються до округлення: курси й різниця мають чотири десяткові знаки, відсоток — два. Відомий попередній нуль дає 100 %, зокрема для двох нулів.",
    "Показано одну валютну пару без підсумків та середніх. Ціни договорів і документи не перераховуються.",
    "Це збережена історія GBA з поточними назвами й прив’язками валют. Повноту історії, кратність і відповідність сирому курсу та правам 1С не підтверджено."
  ],
  "PeriodRequired": false,
  "PeriodSupported": false,
  "rateComparison": {
    "version": 1,
    "kinds": [
      "commercial",
      "government"
    ],
    "lookupFields": {
      "commercial": 39,
      "government": 40
    },
    "dateSemantics": "stored-calendar-end-of-day",
    "rateDecimals": 4,
    "percentageDecimals": 2,
    "totalsSupported": false,
    "sourceParityVerified": false
  },
  "HideZero": null
}
export function rateRequest(): ReportRequestBody {
  return { ...defaultDatasetRequest(rateDataset, '', ''), rateComparison: { Version: 1, RateKind: 'commercial', RateDefinitionId: '9007199254740993', CurrentAsOf: '2026-07-31', PreviousAsOf: '2026-06-30' } }
}

export const rateSeriesCaption = 'Комерційний: EUR [CurrencyID=2] → UAH [CurrencyID=3] [RateDefinitionID=9007199254740993]'
export function rateRows(kind = 'known', selected = [0, 1, 2, 3]): SpreadsheetCellValue[][] {
  const values: Record<string, Array<number | null>> = { known: [42.5, 40, 2.5, 6.25], negative: [40, 42.5, -2.5, -5.88], zero: [0, 0, 0, 100],
    'current-unknown': [null, 40, null, null], 'previous-unknown': [42.5, null, null, null], 'both-unknown': [null, null, null, null], 'raw-rounding': [0.0001, 0, 0, 50] }
  const data = values[kind]; if (!data) throw new Error('Unknown fixture')
  const current = kind === 'raw-rounding' ? '0.00006' : String(data[0]), previous = kind === 'raw-rounding' ? '0.00004' : String(data[1])
  const notes = ['GBA, набір 19; збережена історія курсів. Поточна дата: 2026-07-31; дата порівняння: 2026-06-30.', rateSeriesCaption,
    data[0] == null ? 'відсутній' : `HistoryID=301; дата=2026-06-29T23:59:59.9999999; курс=${current}`,
    data[1] == null ? 'відсутній' : `HistoryID=302; дата=2026-06-29T23:59:59.9999999; курс=${previous}`,
    'Останній активний запис до кінця дня за календарем збережених даних.', 'Курси й різниця: чотири знаки, відсоток: два. Підсумків і середніх немає.',
    'Відсутня історія залишається порожньою.', 'Повнота й відповідність 1С не підтверджені; договори не перераховуються.']
  return [[RATE_COMPARISON_TITLE], ['Поточна дата: 31.07.2026'], ['Дата порівняння: 30.06.2026'],
    ['Час читання (UTC): 09.09.2026 00:00:00.000 – 09.09.2026 00:00:01.000'], ['Рядки: Валютна пара'], ['Колонки: —'],
    ['Показники: ' + selected.map(index => RATE_COMPARISON_CAPTIONS[index]).join(', ')], ['Фільтри: не застосовано'],
    ...RATE_COMPARISON_NOTE_PREFIXES.map((prefix, index) => [`! ${prefix} ${notes[index]}`]), [],
    [null, ...selected.map(() => 'Історичні курси')], ['Валютна пара', ...selected.map(index => RATE_COMPARISON_CAPTIONS[index])],
    [rateSeriesCaption, ...selected.map(index => data[index])]]
}
