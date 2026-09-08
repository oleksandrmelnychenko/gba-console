import type { ReportDataset, ReportRequestBody, SpreadsheetCellValue } from '../types'
import { XYZ_CAPTIONS, XYZ_TITLE, defaultXyzOptions } from './salesXyz'
import { XYZ_EMPTY_STATE, XYZ_NOTE_PREFIXES } from './salesXyzSpreadsheet'
import { defaultDatasetRequest } from './reportDatasets'

// Public capability DTO captured from the actual source15 serializer (contract-02).
export const salesXyzDataset: ReportDataset = {
  "DataSource": 15,
  "Name": "XYZ-стабільність продажів GBA за товарами",
  "Description": "Місячна стабільність записаної суми продажів EUR за точним товаром у явному native календарі.",
  "Groupings": [
    {
      "Type": 51,
      "Name": "Клас XYZ",
      "Selectable": true
    },
    {
      "Type": 5,
      "Name": "Товар",
      "Selectable": true
    }
  ],
  "Measurements": [
    {
      "Type": 32,
      "Name": "Сума продажів з ПДВ, EUR",
      "Selectable": true
    },
    {
      "Type": 33,
      "Name": "Середня сума за період, EUR",
      "Selectable": true
    },
    {
      "Type": 34,
      "Name": "Коефіцієнт варіації, %",
      "Selectable": true
    }
  ],
  "Filters": [
    {
      "Type": 1,
      "Name": "Товар",
      "Selectable": true
    },
    {
      "Type": 2,
      "Name": "Артикул",
      "Selectable": true
    },
    {
      "Type": 6,
      "Name": "Клієнт",
      "Selectable": true
    },
    {
      "Type": 9,
      "Name": "Договір",
      "Selectable": true
    }
  ],
  "Limitations": [
    "Записана ціна PricePerItem × Qty у EUR; ціни за договором не перераховуються, ПДВ і курс повторно не додаються. Точний ClientAgreement.ID не замінюється спільним AgreementID.",
    "Обрано область проведених продажів source0: існують Order, ClientAgreement і Agreement; активний OrderItem. Missing CA/Agreement виключені. Повернення не віднімаються; нулі й від’ємні значення збережені.",
    "Два явні native календарі; touched-month сітка не є доказом фактичної сітки 1С. Середнє й дисперсія діляться на N, фактичне K показано окремо.",
    "CV округлюється до 2 знаків половинами від нуля до класифікації; показано 3 знаки. Межі незалежні, перевіряються послідовно X, Y, Z.",
    "Середнє й CV лише для товарів. У підсумках лише сума raw продажів з одним фінальним округленням. Порожній обсяг і невідомий товар різняться.",
    "Лише рядки Клас XYZ → Товар та 3 показники; до 200 000 фактів/товаромісяців і 1 000 000 клітинок. TOP, ABC, поріг, довільне сортування, колонки та інші ресурси не підтримуються.",
    "Це поточні змінювані записи GBA, не незмінна історія чи підтверджена валютна, числова, календарна або повна функціональна тотожність 1С."
  ],
  "PeriodRequired": true,
  "PeriodSupported": true,
  "Xyz": {
    "Version": 1,
    "Required": true,
    "DateFormat": "yyyy-MM-dd",
    "CalendarTimezone": "Europe/Kyiv",
    "BaseResources": [
      4
    ],
    "Objects": [
      5
    ],
    "CalendarPolicies": [
      "NativeClosedCalendarMonths",
      "NativeTouchedMonthsSourceWindow"
    ],
    "RoundingPolicy": "NativeAwayFromZero2",
    "MinimumPeriodCount": 1,
    "MaximumPeriodCount": 60,
    "MaximumActualBuckets": 61,
    "RequiredRows": [
      51,
      5
    ],
    "ColumnsSupported": false,
    "MaximumFacts": 200000,
    "MaximumObjectBuckets": 200000,
    "MaximumDenseCells": 1000000,
    "MaximumSelections": 64,
    "MaximumFilterValues": 2000,
    "PublishedDecimalPlaces": 2,
    "CvDisplayDecimalPlaces": 3,
    "SummaryPolicy": "ResourceTotalOnly",
    "SourcePeriodGridVerified": false,
    "SourceParityVerified": false
  },
  "FilterExpression": {
    "Version": 1,
    "MaximumDepth": 8,
    "MaximumLeaves": 64,
    "MaximumNodes": 128,
    "Operators": [
      1,
      2
    ]
  },
  "HideZero": null
}
export function salesXyzRequest(): ReportRequestBody {
  return { ...defaultDatasetRequest(salesXyzDataset, '2026-05-01', '2026-07-31'), xyz: defaultXyzOptions() }
}
export function salesXyzRows(kind: 'known' | 'empty' | 'unknown' | 'raw-rounding' = 'known', selected = [0, 1, 2]): SpreadsheetCellValue[][] {
  const headers = [XYZ_TITLE, 'Період: 01.05.2026 – 31.07.2026', 'Час читання (UTC): 08.09.2026 12:00:00.000 – 08.09.2026 12:00:01.000',
    'Рядки: Клас XYZ, Товар', 'Колонки: —', `Показники: ${selected.map(index => XYZ_CAPTIONS[index]).join(', ')}`, 'Фільтри: не застосовано',
    ...XYZ_NOTE_PREFIXES.map(prefix => `! ${prefix} повний контекст розрахунку.`)]
  if (kind === 'empty') headers.push(XYZ_EMPTY_STATE)
  const row = (a: string, b: string, values: Array<number | null>) => [a, b, ...selected.map(index => values[index])]
  const values = kind === 'empty' ? [] : kind === 'unknown'
    ? [row('Невідомо', 'Невідомий товар', [5, null, null]), row('Підсумок: Невідомо', '', [5, null, null]), row('Загальний підсумок', '', [5, null, null])]
    : kind === 'raw-rounding'
      ? [row('Z', 'Товар [10]', [0, 0, 141.42]), row('', 'Товар [11]', [0, 0, 141.42]), row('Підсумок: Z', '', [0.01, null, null]), row('Загальний підсумок', '', [0.01, null, null])]
      : [row('Y', 'Товар [6]', [300, 100, 40.82]), row('Підсумок: Y', '', [300, null, null]), row('Z', 'Товар [9]', [-10, -3.33, 141.42]),
        row('Підсумок: Z', '', [-10, null, null]), row('Без класу', 'Товар [8]', [0, 0, 0]), row('Підсумок: Без класу', '', [0, null, null]), row('Загальний підсумок', '', [290, null, null])]
  return [...headers.map(line => [line, line]), [], [null, null, ...selected.map(() => 'Стабільність продажів')],
    ['Клас XYZ', 'Товар', ...selected.map(index => XYZ_CAPTIONS[index])], ...values]
}
