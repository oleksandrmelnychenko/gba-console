import type { ReportDataset, ReportRequestBody, ReportSelection } from '../types'
import { previousKyivDay } from './cashPeriod'
import { bug1274DatasetTitle, bug1274WorkbookGuide, bug1274WorkbookPeriod } from './bug1274WorkbookGuide'
import { opensOnPreviousDay } from './bug1274WorkbookLaunch'
import { workbookCaption } from './bug1274WorkbookFilters'
import { productClassification, requestProductClassification, requestSourceBuyerSubtree, requestSourceOrganizations,
  sourceBuyerSubtree, sourceOrganizations } from './nativeExactFilters'
import { DAY_ORGANIZATION_GOODS_KIND_ID, DAY_ORGANIZATION_OUT_OF_SCOPE_ORGANIZATION_IDS,
  DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS } from './dayOrganizationGrossProfit'
import { requestSourceCounterpartyGroups, SETTLEMENT_WORKBOOK_EXCLUDED_GROUPS, sourceCounterpartyGroups } from './sourceCounterpartyGroups'
import { readWorkbookCapability, readWorkbookSelection, requestWorkbookPresentation } from './workbookPresentation'
import { hasFixedReportAxes } from './nativeReportProfiles'
import { SALES_BY_RESPONSIBLES_TITLE, SALES_BY_RESPONSIBLES_WORKBOOK_FILE } from './salesByResponsibles'

export type WorkbookDeskEntry = {
  fileName: string
  name: string
  reportName: string
  description: string
}

export type DeskPeriod = { from: string; to: string }
export type DeskChip = { label: string; title: string; kind: 'filter' | 'view' }
export type DeskSummary = { period: string; organizations: string | null; chips: DeskChip[] }

const ENTRIES: readonly WorkbookDeskEntry[] = [
  { fileName: 'ВП.xls', name: 'ВП', reportName: 'Валовий прибуток',
    description: 'Продажі, собівартість і прибуток по днях та організаціях.' },
  { fileName: 'ВП по постачальниках.xls', name: 'ВП по постачальниках', reportName: 'Валовий прибуток по постачальниках',
    description: 'Продажі, собівартість і прибуток: склад → організація → постачальник.' },
  { fileName: 'Впарювання.xls', name: 'Аналіз залишків і продажів', reportName: 'Аналіз залишків і продажів',
    description: 'Товари групи: залишок на кінець періоду, продажі по місяцях і покупці.' },
  { fileName: 'Ведомость по денежным средствам.xls', name: 'Відомість по коштах', reportName: 'Відомість по коштах',
    description: 'Початковий залишок, надходження, видаток і кінцевий залишок по кожній касі та рахунку.' },
  { fileName: 'Взаємороз всі.xls', name: 'Взаєморозрахунки всі', reportName: 'Взаєморозрахунки з контрагентами',
    description: 'Борги покупців: організація → валюта → контрагент, з менеджером і кодом регіону.' },
  { fileName: 'ДБіторка.xls', name: 'Дебіторська заборгованість', reportName: 'Відомість по взаєморозрахунках з контрагентами',
    description: 'Дебіторська заборгованість покупців: організація → контрагент, усі валюти договорів в одному рядку.' },
  { fileName: SALES_BY_RESPONSIBLES_WORKBOOK_FILE, name: SALES_BY_RESPONSIBLES_TITLE, reportName: SALES_BY_RESPONSIBLES_TITLE,
    description: 'Продажі мінус повернення в EUR без ПДВ і з ПДВ: організація → відповідальний документа продажу, у колонках — відповідальний замовлення покупця.' },
]

const TYPICAL_SECONDS: Readonly<Record<number, readonly [number, number]>> = {
  35: [15, 25], 38: [10, 20], 39: [5, 10], 40: [5, 15], 41: [10, 30], 43: [2, 20],
}

const ORGANIZATION_FILTER_FIELDS: Readonly<Record<number, number>> = { 35: 0, 38: 0, 40: 32, 41: 0, 43: 0 }

const SAVED_ORGANIZATION_NAMES = 'ТОВ «АМГ «КОНКОРД», Фенікс, ФОП Самолюк А.Д., ФОП Самолюк Ю.М.'

export function workbookDeskEntry(fileName: string | null | undefined): WorkbookDeskEntry | undefined {
  return fileName ? ENTRIES.find(entry => entry.fileName === fileName) : undefined
}

export function workbookDeskEntries(): readonly WorkbookDeskEntry[] {
  return ENTRIES
}

export function workbookDeskTitle(fileName: string | null | undefined, dataSource: number): string {
  return workbookDeskEntry(fileName)?.reportName ?? (fileName ? bug1274WorkbookGuide(fileName)?.title : undefined)
    ?? bug1274DatasetTitle(dataSource) ?? 'Звіт'
}

export function typicalRunSeconds(dataSource: number): readonly [number, number] {
  return TYPICAL_SECONDS[dataSource] ?? [5, 30]
}

export function typicalRunText(dataSource: number): string {
  const [low, high] = typicalRunSeconds(dataSource)
  return `Зазвичай це займає ${low}–${high} с.`
}

export function organizationFilterField(dataSource: number): number | null {
  return ORGANIZATION_FILTER_FIELDS[dataSource] ?? null
}

export function workbookDefaultPeriod(fileName: string, dataSource: number, today: string): DeskPeriod | null {
  const period = bug1274WorkbookPeriod(fileName, today)
  if (period) return period
  if (!opensOnPreviousDay(dataSource)) return null
  const day = previousKyivDay(today)
  return day ? { from: day, to: day } : null
}

export function deskDownloadName(base: string | null, url: string, format: 'excel' | 'pdf'): string | undefined {
  if (!base) return undefined
  const extension = /\.([a-z\d]{2,5})$/i.exec(url.split(/[?#]/)[0])?.[1]
  return `${base}.${extension ? extension.toLowerCase() : format === 'excel' ? 'xlsx' : 'pdf'}`
}

export function deskDay(value: string): string {
  return /^\d{4}-\d\d-\d\d$/.test(value) ? value.split('-').reverse().join('.') : value
}

export function deskPeriodText(from: string, to: string): string {
  if (!from || !to) return 'не вказано'
  return from === to ? deskDay(from) : `${deskDay(from)} – ${deskDay(to)}`
}

export function deskPeriodKind(period: DeskPeriod, today: string): string | null {
  const yesterday = previousKyivDay(today)
  if (period.from === period.to) return period.from === yesterday ? 'Вчора' : period.from === today ? 'Сьогодні' : null
  if (period.from === `${today.slice(0, 4)}-01-01` && period.to === today) return 'З початку року до сьогодні'
  if (period.to === yesterday && period.from === `${yesterday.slice(0, 7)}-01`) return 'З 1-го числа до вчора'
  return null
}

export { deskPlural, deskCount, deskRowsText } from './reportCountPresentation'

function applied(selection: ReportSelection, fixedAxes: boolean): boolean {
  return (fixedAxes ? selection.IsChecked !== false : selection.IsChecked) && selection.Values.length > 0
}

function shortName(name: string): string {
  return name.length > 40 ? `${name.slice(0, 38).trimEnd()}…` : name
}

function valuesText(names: readonly string[]): string {
  if (names.length <= 2) return names.map(shortName).join(', ')
  return `${shortName(names[0])}, ${shortName(names[1])} та ще ${names.length - 2}`
}

function chipValuesText(names: readonly string[]): string {
  return names.length > 3 ? `${names.length} зі списку` : valuesText(names)
}

function selectionNames(selection: ReportSelection): string[] {
  return selection.Values.map(value => workbookCaption(String(value.Name ?? '')) || String(value.Name ?? ''))
}

const EXCLUDING_CONDITIONS = new Set([1, 3])
const PLAIN_CONDITIONS = new Set([0, 2])

function selectionChip(selection: ReportSelection, label: string): DeskChip {
  const names = selectionNames(selection)
  const type = selection.FilterCondition.Type
  const condition = PLAIN_CONDITIONS.has(type) ? '' : EXCLUDING_CONDITIONS.has(type) ? 'крім ' : `${selection.FilterCondition.Name.toLocaleLowerCase('uk-UA')} `
  return { kind: 'filter', label: `${label}: ${condition}${chipValuesText(names)}`, title: `${label} — ${selection.FilterCondition.Name}: ${names.join('; ')}` }
}

function organizationsText(request: ReportRequestBody, selections: readonly ReportSelection[], fixedAxes: boolean): string | null {
  const dataSource = request.dataSource ?? 0
  const field = organizationFilterField(dataSource)
  if (field === null) return null
  const parts: string[] = []
  const saved = sourceOrganizations(requestSourceOrganizations(request))
  if (saved) {
    const ids = saved.OrganizationIds.map(id => id.toUpperCase())
      .filter(id => !(DAY_ORGANIZATION_OUT_OF_SCOPE_ORGANIZATION_IDS as readonly string[]).includes(id))
    parts.push(ids.length === DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS.length
      && DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS.every(id => ids.includes(id))
      ? SAVED_ORGANIZATION_NAMES
      : `вибрані організації (${saved.OrganizationIds.length})`)
  }
  for (const selection of selections) {
    if (selection.SelectedField.Type !== field || !applied(selection, fixedAxes)) continue
    const names = selectionNames(selection)
    parts.push(EXCLUDING_CONDITIONS.has(selection.FilterCondition.Type) ? `Усі, крім ${valuesText(names)}` : valuesText(names))
  }
  return parts.length ? parts.join('; ') : 'Усі'
}

export function workbookOrganizationScope(request: ReportRequestBody): string {
  const field = organizationFilterField(request.dataSource ?? 0)
  if (field === null) return 'Усі'
  const fixedAxes = hasFixedReportAxes(request.dataSource ?? 0)
  const selections = (request.selections ?? []).filter(selection =>
    selection.SelectedField.Type === field && applied(selection, fixedAxes))
  const saved = sourceOrganizations(requestSourceOrganizations(request))
  if (saved && selections.length === 0) {
    const ids = saved.OrganizationIds.map(id => id.toUpperCase())
      .filter(id => !(DAY_ORGANIZATION_OUT_OF_SCOPE_ORGANIZATION_IDS as readonly string[]).includes(id))
    return `Вибрано: ${ids.length}`
  }
  if (!saved && selections.length === 0) return 'Усі'
  if (!saved && selections.length === 1) {
    const selection = selections[0]
    if (PLAIN_CONDITIONS.has(selection.FilterCondition.Type)) return `Вибрано: ${selection.Values.length}`
    if (EXCLUDING_CONDITIONS.has(selection.FilterCondition.Type)) return `Виключено: ${selection.Values.length}`
  }
  return 'З відбором'
}

function fieldShortCaption(caption: string): string {
  const head = caption.replace(/\s*\(.*$/, '').trim()
  return head.includes('.') ? head.slice(head.lastIndexOf('.') + 1) : head
}

export function workbookRequestSummary(request: ReportRequestBody, dataset: ReportDataset | undefined,
  fieldLabel: (selection: ReportSelection) => string): DeskSummary {
  const dataSource = request.dataSource ?? 0
  const fixedAxes = hasFixedReportAxes(dataSource)
  const selections = Array.isArray(request.selections) ? request.selections : []
  const organizationField = organizationFilterField(dataSource)
  const chips: DeskChip[] = []
  const goods = productClassification(requestProductClassification(request))
  if (goods) chips.push(goods.ProductKindId.toUpperCase() === DAY_ORGANIZATION_GOODS_KIND_ID && goods.IsService === false
    ? { kind: 'filter', label: 'Товари без послуг', title: 'Вид номенклатури — Товар, Послуга — Ні' }
    : { kind: 'filter', label: 'Вид товару зі збереженого відбору', title: 'Вид товару з шаблону' })
  if (sourceBuyerSubtree(requestSourceBuyerSubtree(request))) chips.push(dataSource === 41
    ? { kind: 'filter', label: 'Контрагенти з групи «Покупці»', title: 'Контрагент у групі «Покупці» довідника 1С' }
    : { kind: 'filter', label: 'Покупці з групи «Покупці»', title: 'Покупець у групі «Покупці» довідника 1С' })
  const groups = sourceCounterpartyGroups(requestSourceCounterpartyGroups(request))
  const groupName = (id: string) => SETTLEMENT_WORKBOOK_EXCLUDED_GROUPS.find(group => group.Id === id.toUpperCase())?.Name
  if (groups?.IncludeGroupIds.length) {
    const names = groups.IncludeGroupIds.map(id => groupName(id) ?? 'група')
    chips.push({ kind: 'filter', label: `Лише групи: ${groups.IncludeGroupIds.every(groupName) ? valuesText(names) : groups.IncludeGroupIds.length}`,
      title: `Лише групи контрагентів: ${names.join('; ')}` })
  }
  if (groups?.ExcludeGroupIds.length) {
    const names = groups.ExcludeGroupIds.map(id => groupName(id) ?? 'група')
    chips.push({ kind: 'filter', label: `Крім груп: ${groups.ExcludeGroupIds.every(groupName) ? names.join(', ') : groups.ExcludeGroupIds.length}`,
      title: `Крім груп контрагентів: ${names.join('; ')}` })
  }
  for (const selection of selections) {
    if (!applied(selection, fixedAxes) || selection.SelectedField.Type === organizationField) continue
    chips.push(selectionChip(selection, fieldLabel(selection)))
  }
  const view = readWorkbookSelection(requestWorkbookPresentation(request))
  const capability = dataset ? readWorkbookCapability(dataset.workbookPresentation, dataSource) : null
  if (view?.additionalFields.length) {
    const captions = view.additionalFields.map(type => capability?.additionalFields.find(field => field.type === type)?.caption)
      .filter((caption): caption is string => Boolean(caption)).map(fieldShortCaption)
    if (captions.length) chips.push({ kind: 'view', label: `Додаткові поля: ${captions.join(', ')}`, title: 'Додаткові поля книги 1С' })
  }
  if (view?.ordering === 'MonthAscending') chips.push({ kind: 'view', label: 'Сортування по місяцях', title: 'Як у книзі 1С: по місяцях за зростанням' })
  return {
    period: deskPeriodText(request.from, request.to),
    organizations: organizationsText(request, selections, fixedAxes),
    chips,
  }
}
