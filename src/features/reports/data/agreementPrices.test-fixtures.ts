import type { ReportDataset, ReportRequestBody, SpreadsheetCellValue } from '../types'
import { AGREEMENT_PRICES_CAPTION, AGREEMENT_PRICES_RESOURCE, AGREEMENT_PRICES_TITLE } from './agreementPrices'

export const agreementPricesDataset: ReportDataset = {
  DataSource: 22, Name: AGREEMENT_PRICES_TITLE, Description: 'Поточна ціна конкретного договору',
  Groupings: [{ Type: 5, Name: 'Товар' }, { Type: 28, Name: 'Одиниця виміру' }],
  Measurements: [{ Type: 63, Name: AGREEMENT_PRICES_CAPTION }],
  Filters: [{ Type: 1, Name: 'Товар' }, { Type: 2, Name: 'Артикул' }, { Type: 20, Name: 'Одиниця виміру' }],
  PeriodSupported: false, PeriodRequired: false, Limitations: ['Ціни не додаються.'],
  agreementPrices: { Version: 1, RequiredAgreement: true, RequiredRows: [5, 28], ColumnsSupported: false, TotalsSupported: false,
    MaximumProducts: 15000, MaximumPriceDecimals: 14, MaximumSignificantDigits: 15 },
}
export function agreementPricesRequest(): ReportRequestBody {
  return { dataSource: 22, from: '', to: '', valuationClientAgreementId: 42, selections: [], sorted: {
    Row: [{ type: 5, key: 'Product', label: 'Товар' }, { type: 28, key: 'ProductMeasureUnit', label: 'Одиниця виміру' }],
    Col: [], Measurements: [{ Type: 63, Name: AGREEMENT_PRICES_CAPTION, IsChecked: true, parentName: AGREEMENT_PRICES_CAPTION }],
  } }
}
export function agreementPricesRows(empty = false): SpreadsheetCellValue[][] {
  return [
    [AGREEMENT_PRICES_TITLE], ['Поточний стан: знімок операційних записів GBA'],
    ['Час читання (UTC): 10.09.2026 08:00:00.000 – 10.09.2026 08:00:01.000'],
    ['Рядки: Товар, Одиниця виміру'], ['Колонки: —'], [`Показники: ${AGREEMENT_PRICES_CAPTION}`], ['Фільтри: не застосовано'],
    ['Договір цін: ClientAgreementID=42; Договір [42].'], ['Режим цін: поточна ціна'], ['ПДВ цін: включено'],
    [`Покриття цін: ${empty ? '0 із 0' : '2 із 3'}`], ['Причини невизначених цін: ціна недоступна'],
    ['Точність цін: до 14 десяткових знаків'], ['Межі цін: без підсумків'],
    [], ['', '', AGREEMENT_PRICES_RESOURCE], ['Товар', 'Одиниця виміру', AGREEMENT_PRICES_CAPTION],
    ...(empty ? [] : [['Товар A [11]', 'шт [7]', 12.1234567890123], ['Товар B [12]', 'шт [7]', 0], ['Товар C [13]', 'Не вказано', null]]),
  ]
}
