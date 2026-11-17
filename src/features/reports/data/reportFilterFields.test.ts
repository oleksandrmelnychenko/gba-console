import { describe, expect, it } from 'vitest'
import fixture from './constructorDatasets.dev-fixture.json'
import { parseReportDatasets } from '../api/reportWorkspaceApi'
import { datasetFilters } from './reportDatasets'
import { canonicalFilterLabel, groupCanonicalFilterOptions } from './reportFilterFields'

type Entry = { value: string; label: string }
const flatten = (groups: ReturnType<typeof groupCanonicalFilterOptions>) =>
  groups.flatMap(entry => 'group' in entry ? entry.items.map(item => ({ ...item, group: entry.group })) : [{ ...entry, group: '' }])

describe('one filter field list for every report', () => {
  const datasets = parseReportDatasets(fixture)
  const listed = new Map(datasets.map(dataset => [dataset.DataSource,
    flatten(groupCanonicalFilterOptions(dataset.DataSource, datasetFilters(dataset)))]))
  const sales = listed.get(2)!

  it('shows the sales report list in its screenshot order', () => {
    expect(sales.map(item => [item.group, item.label])).toEqual([
      ['', 'Організація'],
      ['Товари', 'Товар'], ['Товари', 'Артикул'], ['Товари', 'Топ'], ['Товари', 'Товарна група'], ['Товари', 'Одиниця виміру'],
      ['Покупці', 'Покупець'], ['Покупці', 'Регіон'], ['Покупці', 'Код по регіону'], ['Покупці', 'Договір'],
      ['Покупці', 'Відповідальний менеджер покупця'], ['Покупці', 'Тип цін покупця'],
      ['Документи продажу', 'Документ продажу'], ['Документи продажу', 'Повернення від клієнта'],
      ['Документи продажу', 'Відповідальний менеджер що забив товар'], ['Документи продажу', 'Відповідальний менеджер що перевів в статус накладної'],
      ['Документи продажу', 'Причина повернення'],
      ['Склади', 'Склад'],
    ])
  })

  it.each([3, 44, 45, 46])('gives source %i the same names, sections and order wherever it shares a field with sales', source => {
    const items = listed.get(source)!
    const shared = items.filter(item => sales.some(other => other.value === item.value))
    const salesOrder = sales.filter(item => shared.some(other => other.value === item.value))
    expect(shared.map(item => [item.value, item.group, item.label])).toEqual(salesOrder.map(item => [item.value, item.group, item.label]))
  })

  it('keeps source-only fields in their own sections after the shared ones', () => {
    expect(listed.get(3)!.map(item => item.label)).toEqual(['Організація', 'Товар', 'Артикул', 'Топ', 'Товарна група', 'Одиниця виміру',
      'Постачальник', 'Договір постачальника', 'Документ надходження', 'Склад'])
    expect(listed.get(45)!.map(item => item.label)).toEqual(['Організація', 'Товар', 'Артикул', 'Топ', 'Товарна група', 'Одиниця виміру',
      'Документ надходження', 'Склад', 'Поточна організація складу'])
  })

  it('never gives one report two fields with the same name', () => {
    for (const [source, items] of listed) expect(new Set(items.map(item => item.label)).size, `source ${source}`).toBe(items.length)
    const analysis = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 21, 60].map(type => ({ value: String(type), label: `Поле ${type}`, field: { Type: type } }))
    const labels = flatten(groupCanonicalFilterOptions(39, analysis)).map(item => item.label)
    expect(new Set(labels).size).toBe(labels.length)
    for (const [source, types] of [[41, [0, 6, 9, 17, 18, 30, 60, 61]], [40, [29, 30, 32, 33]], [35, [0, 1, 2, 6, 9, 12, 60]], [43, [0, 6, 62, 63]], [38, [0, 1, 17]]] as const) {
      const names = types.map(type => canonicalFilterLabel(source, type, `Поле ${type}`))
      expect(new Set(names).size, `source ${source}`).toBe(names.length)
    }
  })

  it('names the account organization and the analysis buyer like sales', () => {
    expect(canonicalFilterLabel(40, 32, 'Організація рахунку')).toBe('Організація')
    expect(canonicalFilterLabel(39, 5, 'Покупець')).toBe('Покупець')
    expect(canonicalFilterLabel(39, 6, 'Назва покупця')).toBe('Назва покупця')
    expect(canonicalFilterLabel(3, 18, 'Договір постачальника')).toBe('Договір постачальника')
    expect(canonicalFilterLabel(41, 61, 'Код по региону (джерело покупця)')).toBe('Код по регіону')
    expect(canonicalFilterLabel(46, 99, 'Власне поле')).toBe('Власне поле')
    const entry: Entry = { value: '1', label: 'x' }
    expect(groupCanonicalFilterOptions(3, [{ ...entry, field: { Type: 1 }, disabled: true }])).toEqual([{ group: 'Товари', items: [{ value: '1', label: 'Товар', disabled: true }] }])
  })
})
