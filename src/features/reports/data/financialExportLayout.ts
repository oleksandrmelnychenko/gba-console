export type FinancialExportLayout = 'auto' | 'sheets' | 'table'
export const FINANCIAL_EXPORT_AUTO_SHEET_LIMIT = 100

const nouns: Readonly<Record<number, { each: string; many: string; sheets: string }>> = {
  0: { each: 'кожен рік', many: 'років', sheets: 'У файлі кожен рік у колонках буде окремим аркушем.' },
  1: { each: 'кожен квартал', many: 'кварталів', sheets: 'У файлі кожен квартал у колонках буде окремим аркушем.' },
  2: { each: 'кожен місяць', many: 'місяців', sheets: 'У файлі кожен місяць у колонках буде окремим аркушем.' },
  3: { each: 'кожен день', many: 'днів', sheets: 'У файлі кожен день у колонках буде окремим аркушем.' },
  4: { each: 'кожна організація', many: 'організацій', sheets: 'У файлі кожна організація в колонках буде окремим аркушем.' },
  5: { each: 'кожен товар', many: 'товарів', sheets: 'У файлі кожен товар у колонках буде окремим аркушем.' },
  12: { each: 'кожен клієнт', many: 'клієнтів', sheets: 'У файлі кожен клієнт у колонках буде окремим аркушем.' },
  15: { each: 'кожен договір', many: 'договорів', sheets: 'У файлі кожен договір у колонках буде окремим аркушем.' },
  81: { each: 'кожен документ', many: 'документів', sheets: 'У файлі кожен документ у колонках буде окремим аркушем.' },
}

export const FINANCIAL_EXPORT_LAYOUT_OPTIONS: ReadonlyArray<{ value: FinancialExportLayout; label: string }> = [
  { value: 'auto', label: 'Автоматично' },
  { value: 'sheets', label: 'Окремі аркуші' },
  { value: 'table', label: 'Одна таблиця' },
]

export function financialExportLayoutText(columnType: number, layout: FinancialExportLayout): string {
  const noun = nouns[columnType] ?? nouns[3]
  if (layout === 'sheets') return noun.sheets
  if (layout === 'table') return `У файлі одна таблиця: ${noun.each} займає свої колонки показників.`
  return `До ${FINANCIAL_EXPORT_AUTO_SHEET_LIMIT} ${noun.many} у колонках — ${noun.each} окремим аркушем, більше — одна таблиця.`
}

export const financialExportLayoutQuery = (layout: FinancialExportLayout): 'sheets' | 'table' | undefined =>
  layout === 'auto' ? undefined : layout

export const isFinancialExportLayout = (value: unknown): value is FinancialExportLayout =>
  value === 'auto' || value === 'sheets' || value === 'table'
