import { EXACT_ONE_C_BUYER_ROOT_ID, isOrganizationOnlyTurnoverScope } from './oneCTurnoverScopes'
import type { OneCTurnoverScopeSummary } from '../types'

export const ONE_C_REPORT_LAYOUTS = [
  { id: 'responsibles', name: 'За відповідальними 1С', row: ['Organization', 'SourceSaleResponsible'], col: ['SourceOrderResponsible'], measures: [2, 4] },
  { id: 'daily', name: 'Валовий прибуток за днями — як у 1С', row: ['Day', 'Organization'], col: [], measures: [2, 3, 4, 6, 7, 8, 10, 12, 14, 15] },
  { id: 'agreements', name: 'Валовий прибуток за договорами 1С', row: ['CustomerName', 'CustomerContract', 'Product'], col: [], measures: [2, 3, 4, 6, 7, 8, 10, 12, 14, 15] },
  { id: 'source-grain', name: 'Повний розріз валового прибутку 1С', row: ['SourceProject', 'SourceDivision', 'CustomerName', 'CustomerContract', 'Product', 'SourceProductCharacteristic', 'SourceOrder', 'SourceSaleDocument'], col: [], measures: [2, 3, 4, 6, 7, 8, 10, 12, 14, 15] },
  { id: 'articles', name: 'Оборот за артикулами', row: ['ProductArticle'], col: [], measures: [0, 2, 3, 4] },
] as const

type OneCReportLayoutId = typeof ONE_C_REPORT_LAYOUTS[number]['id']
export { EXACT_ONE_C_BUYER_ROOT_ID } from './oneCTurnoverScopes'

export function oneCReportScopeError(scope: OneCTurnoverScopeSummary, layoutId: OneCReportLayoutId): string | null {
  if (scope.Filters.ScopeVersion === 3 && (!isOrganizationOnlyTurnoverScope(scope) || layoutId !== 'responsibles'))
    return 'Це покриття підтримує лише продажі за відповідальними без ПДВ та з ПДВ у EUR.'
  if ((layoutId === 'daily' || layoutId === 'agreements' || layoutId === 'source-grain')
    && scope.Filters.BuyerRootId?.toUpperCase() !== EXACT_ONE_C_BUYER_ROOT_ID)
    return 'Цей набір завантажено без точної групи покупців і собівартості. Виконайте новий звітний синк.'
  return null
}

/** Refuse unsupported dates without letting JavaScript roll an invalid calendar day forward. */
export function oneCReportPeriodError(from: string, to: string): string | null {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN
    const time = Date.parse(`${value}T00:00:00Z`)
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN
  }
  const start = parse(from), end = parse(to)
  if (!Number.isFinite(start) || !Number.isFinite(end) || from < '2000-01-01' || to > '7998-12-31')
    return 'Задайте обидві коректні дати звіту 1С.'
  if (end < start) return 'Початок періоду пізніший за кінець.'
  if ((end - start) / 86_400_000 >= 366) return 'Звіт 1С підтримує період від 1 до 366 днів.'
  return null
}
