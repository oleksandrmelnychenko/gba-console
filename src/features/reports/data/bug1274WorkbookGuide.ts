import { previousKyivDay } from './cashPeriod'
import { SALES_BY_RESPONSIBLES_SOURCE, SALES_BY_RESPONSIBLES_TITLE, SALES_BY_RESPONSIBLES_WORKBOOK_FILE } from './salesByResponsibles'

export type WorkbookGuide = { title: string; summary: string }
export type ReportPeriodPreset = { label: string; from: string; to: string }

export const BUG_1274_WORKBOOKS_TITLE = 'Звіти 1С за зразками Excel'
export const BUG_1274_WORKBOOKS_INTRO = 'Кожна форма відкривається з відборами й групуваннями книги 1С. Період і відбори можна змінити; '
  + 'кнопка «Скинути» повертає налаштування книги. Суми розраховано з документів GBA і звірено з 1С; ТОВ «АМГ «КОНКОРД» — за базою 1С AMG. '
  + 'Організації ХАЗ, ФОП Пархоменко, ФОП Берешвілі, ПАК, Злагода та CONCORD.PL у GBA не переносяться, тому їхніх сум у звітах немає.'

const DEBT_ADJUSTMENT_NOTE = 'Документи 1С «Корректировка долга» в GBA не переносяться: у 1С надходження й видаток більші на їхню суму, залишки однакові.'

const GUIDES: Readonly<Record<string, WorkbookGuide>> = {
  'ВП.xls': {
    title: 'Валовий прибуток',
    summary: 'По днях і організаціях, період до 62 днів. Відбори книги: чотири організації, покупці з групи «Покупці»; '
      + 'додаткові поля Артикул і Топ, сортування по місяцях.',
  },
  'ВП по постачальниках.xls': {
    title: 'Валовий прибуток по постачальниках',
    summary: 'Склад → організація → постачальник, період до 62 днів. Відбори книги: чотири організації, 35 постачальників зі збереженого '
      + 'налаштування 1С «OV», покупці з групи «Покупці».',
  },
  'Впарювання.xls': {
    title: 'Аналіз залишків і продажів',
    summary: 'Товари із залишком на кінець періоду, продажами й контрагентами. Відбори книги: група AL-KO, покупець АФРАКО ТЗОВ, '
      + 'основний менеджер Крицький О. Р. Залишок відомий від останнього перенесення залишків з 1С; за раніший період він порожній.',
  },
  'Ведомость по денежным средствам.xls': {
    title: 'Відомість по коштах',
    summary: 'Кожна каса й банківський рахунок окремим рядком у своїй валюті та в EUR: початковий залишок, надходження, видаток, '
      + 'кінцевий залишок. Період від 01.01.2025.',
  },
  'Взаємороз всі.xls': {
    title: 'Взаєморозрахунки з контрагентами',
    summary: 'Організація → валюта → контрагент з основним менеджером і кодом по регіону. Покупці з групи «Покупці», крім груп '
      + `Харків Скляр, Ніжин - ФОП Гречківська О.І. і НЕВІДОМІ. Період від 01.01.2025. ${DEBT_ADJUSTMENT_NOTE}`,
  },
  'ДБіторка.xls': {
    title: 'Відомість по взаєморозрахунках з контрагентами',
    summary: 'Організація → контрагент, договори контрагента в різних валютах — в одному рядку, як у 1С. Покупці з групи «Покупці». '
      + `Період від 01.01.2025. ${DEBT_ADJUSTMENT_NOTE}`,
  },
  [SALES_BY_RESPONSIBLES_WORKBOOK_FILE]: {
    title: SALES_BY_RESPONSIBLES_TITLE,
    summary: 'Як звіт 1С «Продажі»: рядки — організація → відповідальний документа продажу, колонки — відповідальний замовлення покупця, '
      + 'суми продажу в EUR без ПДВ і з ПДВ. Повернення віднімаються окремою колонкою «Повернення (без замовлення)» за відповідальним продажу. '
      + 'Відбір книги: чотири організації GBA; ФОП Пархоменко не синхронізується. Будь-який період до 120 місяців.',
  },
}

export function bug1274WorkbookGuide(fileName: string): WorkbookGuide | undefined {
  return GUIDES[fileName]
}

const MONTH_PERIOD_WORKBOOKS: ReadonlySet<string> = new Set(['ВП.xls', 'ВП по постачальниках.xls', 'ДБіторка.xls',
  SALES_BY_RESPONSIBLES_WORKBOOK_FILE])

function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`
}

function previousMonth(day: string): { from: string; to: string } {
  const to = previousKyivDay(monthStart(day))
  return { from: monthStart(to), to }
}

export function bug1274WorkbookPeriod(fileName: string, today: string): { from: string; to: string } | null {
  const yesterday = previousKyivDay(today)
  if (!yesterday) return null
  if (fileName === 'Впарювання.xls') return { from: `${today.slice(0, 4)}-01-01`, to: today }
  if (MONTH_PERIOD_WORKBOOKS.has(fileName)) return { from: monthStart(yesterday), to: yesterday }
  return null
}

export function reportPeriodPresets(dataSource: number, today: string): ReportPeriodPreset[] {
  if (![35, 38, 39, 40, 41, SALES_BY_RESPONSIBLES_SOURCE].includes(dataSource)) return []
  const yesterday = previousKyivDay(today)
  if (!yesterday) return []
  const end = dataSource === 39 ? today : yesterday
  const last = previousMonth(end)
  const presets: ReportPeriodPreset[] = [
    dataSource === 39 ? { label: 'Сьогодні', from: today, to: today } : { label: 'Вчора', from: yesterday, to: yesterday },
    { label: 'Поточний місяць', from: monthStart(end), to: end },
    { label: 'Минулий місяць', ...last },
  ]
  if (dataSource !== 35 && dataSource !== 38) presets.push({ label: 'Поточний рік', from: `${end.slice(0, 4)}-01-01`, to: end })
  return presets
}

const REPORT_TITLES: Readonly<Record<string, string>> = {
  'builtin:ВаловаяПрибыль': 'Валовий прибуток',
  'builtin:ВаловаяПрибыльПоПоставщикам': 'Валовий прибуток по постачальниках',
  'builtin:ОтчетВпаривание': 'Аналіз залишків і продажів',
  'builtin:ВедомостьДенежныеСредства': 'Відомість по коштах',
  'builtin:ВедомостьВзаиморасчетыСКонтрагентами': 'Відомість по взаєморозрахунках з контрагентами',
}

export function bug1274ReportTitle(reportId: string): string | undefined {
  return REPORT_TITLES[reportId]
}

const DATASET_TITLES: Readonly<Record<number, string>> = {
  35: 'Валовий прибуток',
  38: 'Валовий прибуток по постачальниках',
  39: 'Аналіз залишків і продажів',
  40: 'Відомість по коштах',
  41: 'Взаєморозрахунки з контрагентами',
  [SALES_BY_RESPONSIBLES_SOURCE]: SALES_BY_RESPONSIBLES_TITLE,
}

export function bug1274DatasetTitle(dataSource: number): string | undefined {
  return DATASET_TITLES[dataSource]
}

/** Display-only name; persisted workbook identity and import lookup stay unchanged. */
export function workbookDisplayFileName(fileName: string): string {
  return fileName === 'Впарювання.xls' ? 'Аналіз залишків і продажів.xls' : fileName
}
