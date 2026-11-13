import { describe, expect, it } from 'vitest'
import type { ReportRequestBody, ReportSelection } from '../types'
import { DAY_ORGANIZATION_GOODS_KIND_ID, DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS } from './dayOrganizationGrossProfit'
import { FENIX_BUYERS_ROOT_ID } from './nativeExactFilters'
import { SETTLEMENT_WORKBOOK_EXCLUDED_GROUPS } from './sourceCounterpartyGroups'
import { deskDownloadName, deskPlural, deskRowsText, organizationFilterField,
  workbookDeskTitle, workbookRequestSummary } from './workbookDesk'

function request(extra: Partial<ReportRequestBody>): ReportRequestBody {
  return { from: '2026-10-01', to: '2026-10-17', selections: [], sorted: { Row: [], Col: [], Measurements: [] }, ...extra }
}

function selection(field: number, name: string, condition: number, values: string[], checked = true): ReportSelection {
  return { IsChecked: checked, SelectedField: { Type: field, Name: name }, FilterCondition: { Type: condition, Name: ['Дорівнює', 'Не дорівнює', 'У списку', 'У групі зі списку', 'Не у списку', 'Не у групі зі списку', 'У групі', 'Не у групі'][condition] },
    Values: values.map((value, index) => ({ Name: value, Value: 0, Data: { Id: String(index + 1), Name: value } })) }
}

const label = (item: ReportSelection) => item.SelectedField.Name

describe('workbook desk names', () => {

  it('titles a report opened without a workbook by its 1C report name', () => {
    expect(workbookDeskTitle('ДБіторка.xls', 41)).toBe('Відомість по взаєморозрахунках з контрагентами')
    expect(workbookDeskTitle(null, 40)).toBe('Відомість по коштах')
    expect(workbookDeskTitle(null, 99)).toBe('Звіт')
  })
})

describe('row counts', () => {
  it('uses Ukrainian plural forms', () => {
    expect([1, 2, 5, 11, 21, 22, 25, 101, 111].map(count => deskPlural(count, ['рядок', 'рядки', 'рядків'])))
      .toEqual(['рядок', 'рядки', 'рядків', 'рядків', 'рядок', 'рядки', 'рядків', 'рядок', 'рядків'])
    expect(deskRowsText(50, 101, true)).toBe('Показано 50 з 101 рядка')
    expect(deskRowsText(50, 1144, true)).toBe('Показано 50 з 1 144 рядків')
    expect(deskRowsText(50, 70, true)).toBe('Показано 50 з 70 рядків')
    expect(deskRowsText(20, 20, false)).toBe('20 рядків')
    expect(deskRowsText(1, 1, false)).toBe('1 рядок')
    expect(deskRowsText(3, 3, false)).toBe('3 рядки')
  })

  it('names a downloaded file after the workbook and period', () => {
    expect(deskDownloadName('ВП 01.09.2026-30.09.2026', '/Data/reports/abc.xlsx?x=1', 'excel')).toBe('ВП 01.09.2026-30.09.2026.xlsx')
    expect(deskDownloadName('ВП 01.09.2026-30.09.2026', '/Data/reports/abc', 'pdf')).toBe('ВП 01.09.2026-30.09.2026.pdf')
    expect(deskDownloadName(null, '/Data/reports/abc.pdf', 'pdf')).toBeUndefined()
  })
})

describe('request summary', () => {

  it('shortens long names and lists up to three values in a chip', () => {
    const summary = workbookRequestSummary(request({ dataSource: 38, selections: [
      selection(17, 'Постачальник', 2, ['AYDINSAN FREN CIRCIRLARI OTOMOTIV YED. PARCALARI IMALATI [1]', 'REMI [2]', 'KARATAS [3]']),
    ] }), undefined, label)
    expect(summary.chips.map(chip => chip.label)).toEqual(['Постачальник: AYDINSAN FREN CIRCIRLARI OTOMOTIV YED.…, REMI та ще 1'])
  })

  it('reads the day workbook filters as plain chips and its saved organizations by name', () => {
    const summary = workbookRequestSummary(request({ dataSource: 35,
      productClassification: { Version: 1, SourceWorld: 0, ProductKindId: DAY_ORGANIZATION_GOODS_KIND_ID, IsService: false },
      sourceOrganizations: { Version: 1, SourceWorld: 'fenix', OrganizationIds: [...DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS] },
      sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID },
      workbookPresentation: { version: 1, additionalFields: [2, 3], ordering: 'MonthAscending' } }), undefined, label)
    expect(summary.period).toBe('01.10.2026 – 17.10.2026')
    expect(summary.organizations).toBe('ТОВ «АМГ «КОНКОРД», Фенікс, ФОП Самолюк А.Д., ФОП Самолюк Ю.М.')
    expect(summary.chips).toEqual([
      { kind: 'filter', label: 'Товари без послуг', title: 'Вид номенклатури — Товар, Послуга — Ні' },
      { kind: 'filter', label: 'Покупці з групи «Покупці»', title: 'Покупець у групі «Покупці» довідника 1С' },
      { kind: 'view', label: 'Сортування по місяцях', title: 'Як у книзі 1С: по місяцях за зростанням' },
    ])
  })

  it('lists organization conditions apart from the other filters and shortens long value lists', () => {
    const summary = workbookRequestSummary(request({ dataSource: 38, selections: [
      selection(0, 'Організація', 2, ['ТОВ «АМГ «КОНКОРД» [10557]', 'Фенікс [10558]', 'ФОП Самолюк А.Д. [10559]']),
      selection(17, 'Постачальник', 2, ['BENEFIT [1]', 'YPS GLOBAL [2]', 'KARATAS [3]', 'REMI [4]']),
      selection(1, 'Товар', 0, ['Вимкнений товар'], false),
    ] }), undefined, label)
    expect(summary.organizations).toBe('ТОВ «АМГ «КОНКОРД», Фенікс та ще 1')
    expect(summary.chips.map(chip => chip.label)).toEqual(['Постачальник: 4 зі списку'])
    expect(summary.chips[0].title).toBe('Постачальник — У списку: BENEFIT; YPS GLOBAL; KARATAS; REMI')
  })

  it('keeps the matrix without an organization line and treats its unchecked-by-default rows as applied', () => {
    const summary = workbookRequestSummary(request({ dataSource: 39, selections: [
      { ...selection(4, 'Група товару', 6, ['AL-KO [3996]']), IsChecked: undefined as unknown as boolean },
      selection(5, 'Покупець', 0, ['АФРАКО ТЗОВ [613989]']),
    ] }), undefined, label)
    expect(organizationFilterField(39)).toBeNull()
    expect(summary.organizations).toBeNull()
    expect(summary.chips.map(chip => chip.label)).toEqual(['Група товару: у групі AL-KO', 'Покупець: АФРАКО ТЗОВ'])
  })

  it('names the settlement exclusions and says all organizations when none are chosen', () => {
    const summary = workbookRequestSummary(request({ dataSource: 41,
      sourceBuyerSubtree: { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID },
      sourceCounterpartyGroups: { Version: 1, SourceWorld: 'fenix', IncludeGroupIds: [],
        ExcludeGroupIds: SETTLEMENT_WORKBOOK_EXCLUDED_GROUPS.map(group => group.Id) } }), undefined, label)
    expect(summary.organizations).toBe('Усі')
    expect(summary.chips.map(chip => chip.label)).toEqual(['Контрагенти з групи «Покупці»',
      'Крім груп: Харків Скляр, Ніжин - ФОП Гречківська О.І., НЕВІДОМІ'])
  })

  it('reads an excluding organization condition', () => {
    const summary = workbookRequestSummary(request({ dataSource: 40, selections: [
      selection(32, 'Організація рахунку', 4, ['Фенікс [1]']),
    ] }), undefined, label)
    expect(summary.organizations).toBe('Усі, крім Фенікс')
    expect(summary.chips).toEqual([])
  })
})


describe('typed filter summary polarity', () => {
  it.each([
    [0, 'Товар: Деталь'], [1, 'Товар: крім Деталь'], [2, 'Товар: Деталь'],
    [3, 'Товар: у групі зі списку Деталь'], [4, 'Товар: крім Деталь'],
    [5, 'Товар: не у групі зі списку Деталь'], [6, 'Товар: у групі Деталь'], [7, 'Товар: не у групі Деталь'],
  ])('describes condition %i without changing its group or exclusion meaning', (condition, expected) => {
    const data = request({ dataSource: 3, selections: [selection(1, 'Товар', Number(condition), ['Деталь'])] })
    const before = structuredClone(data)
    expect(workbookRequestSummary(data, undefined, label).chips[0].label).toBe(expected)
    expect(data).toEqual(before)
  })
})
