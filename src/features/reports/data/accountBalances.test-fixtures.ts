import type { ReportDataset, ReportSelection, SpreadsheetCellValue } from '../types'
import { ACCOUNT_BALANCE_REPORT_TITLE, ACCOUNT_BALANCE_AMOUNT_CAPTION } from './nativeReportProfiles'

const captions = ['Рахунок', 'Валюта рахунку', 'Запис залишку рахунку', 'Організація рахунку', 'Тип рахунку', 'Призначення рахунку']
export const accountBalanceDataset: ReportDataset = {
  DataSource: 11, Name: ACCOUNT_BALANCE_REPORT_TITLE, Description: 'Поточні записані залишки рахунків у підтверджених валютах.',
  PeriodSupported: false, PeriodRequired: false,
  Groupings: captions.map((Name, index) => ({ Type: 40 + index, Name })),
  Filters: captions.map((Name, index) => ({ Type: 29 + index, Name })),
  Measurements: [{ Type: 24, Name: ACCOUNT_BALANCE_AMOUNT_CAPTION }],
  Limitations: ['Записаний залишок не є обіцянкою доступних коштів. Різні або непідтверджені валюти не додаються.'],
}
export const accountBalanceSelections: ReportSelection[] = [
  { IsChecked: true, SelectedField: { Type: 29, Name: 'PaymentRegister' }, FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [{ Data: { Id: 1000 }, Name: 'Рахунок [1000]', Value: 1000 }] },
  { IsChecked: true, SelectedField: { Type: 30, Name: 'PaymentCurrency' }, FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [{ Data: { Id: 2 }, Name: 'UAH [2]', Value: 2 }] },
  { IsChecked: false, SelectedField: { Type: 9, Name: 'CustomerContract' }, FilterCondition: { Type: 0, Name: 'Дорівнює' }, Values: [{ Data: { Id: 459018 }, Name: 'Договір [459018]', Value: 459018 }] },
]
export const accountBalanceHeaderLines = [ACCOUNT_BALANCE_REPORT_TITLE, 'Поточний стан: знімок операційних записів GBA',
  'Час читання (UTC): 08.09.2026 00:00:00.000 – 08.09.2026 00:00:00.120',
  'Рядки: Призначення рахунку, Тип рахунку, Валюта рахунку, Рахунок', 'Колонки: —', 'Показники: Записаний залишок рахунку', 'Фільтри: —',
  '! Джерело залишків рахунків: активні записи залишків.', '! Покриття залишків рахунків: один залишок невизначений.',
  '! Валюта залишків рахунків: різні валюти не додаються.', '! Узгодження залишків рахунків: один ланцюг журналу не підтверджено.',
  '! Типи рахунків: готівкові, карткові та банківські.', '! Організація рахунку: записана прив’язка.',
  '! Межі залишків рахунків: поточний записаний залишок не є доступним залишком коштів.']
export const accountBalanceWorkbookRows: SpreadsheetCellValue[][] = [
  ...accountBalanceHeaderLines.map(line => Array.from({ length: 5 }, () => line)), [],
  ['Призначення рахунку', 'Тип рахунку', 'Валюта рахунку', 'Рахунок', 'Залишки рахунків'],
  ['Призначення рахунку', 'Тип рахунку', 'Валюта рахунку', 'Рахунок', ACCOUNT_BALANCE_AMOUNT_CAPTION],
  ['Звичайний [1]', 'Готівковий [1]', 'UAH [2]', 'Рахунок [1000]', 0],
  ['', '', '', 'Рахунок [1001]', 1234.56],
  ['Підсумок: UAH [2]', '', '', '', 1234.56],
  ['Звичайний [1]', 'Банківський [3]', 'EUR [1]', 'Рахунок [2000]', -7.89],
  ['Спільний [2]', 'Картковий [2]', 'Непідтверджена валюта', 'Рахунок [3000]', null],
  ['Загальний підсумок', '', '', '', null],
]
