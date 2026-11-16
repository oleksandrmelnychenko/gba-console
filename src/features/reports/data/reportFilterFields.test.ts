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
      ['Товар', 'Товар'], ['Товар', 'Артикул'], ['Товар', 'Топ'], ['Товар', 'Товарна група'], ['Товар', 'Одиниця виміру'],
      ['Покупець', 'Покупець'], ['Покупець', 'Покупець. Регіон'], ['Покупець', 'Покупець. Код по регіону'], ['Покупець', 'Покупець. Договір'],
      ['Покупець', 'Покупець. Відповідальний менеджер покупця'], ['Покупець', 'Покупець. Тип цін'],
      ['Документ продажу', 'Документ продажу'], ['Документ продажу', 'Повернення від клієнта'],
      ['Документ продажу', 'Відповідальний менеджер що забив товар'], ['Документ продажу', 'Відповідальний менеджер що перевів в статус накладної'],
      ['Документ продажу', 'Причина повернення'],
      ['Склад', 'Склад'],
    ])
  })

  it.each([3, 44, 45, 46])('gives source %i the same names, sections and order wherever it shares a field with sales', source => {
    const items = listed.get(source)!
    const shared = items.filter(item => sales.some(other => other.value === item.value))
    const salesOrder = sales.filter(item => shared.some(other => other.value === item.value))
    expect(shared.map(item => [item.value, item.group, item.label])).toEqual(salesOrder.map(item => [item.value, item.group, item.label]))
  })

  it('keeps source-only fields in their own sections after the shared ones', () => {
    expect(listed.get(3)!.map(item => item.label)).toEqual(['Організація', 'Товар', 'Артикул', 'Топ', 'Одиниця виміру',
      'Постачальник', 'Постачальник. Договір', 'Документ надходження', 'Склад'])
    expect(listed.get(45)!.map(item => item.label)).toEqual(['Організація', 'Товар', 'Артикул', 'Топ', 'Одиниця виміру',
      'Документ надходження', 'Склад', 'Склад. Організація'])
  })

  it('names the account organization and the analysis buyer like sales', () => {
    expect(canonicalFilterLabel(40, 32, 'Організація рахунку')).toBe('Організація')
    expect(canonicalFilterLabel(39, 5, 'Покупець')).toBe('Покупець')
    expect(canonicalFilterLabel(39, 6, 'Назва покупця')).toBe('Покупець. Назва')
    expect(canonicalFilterLabel(41, 61, 'Код по региону (джерело покупця)')).toBe('Покупець. Код по регіону')
    expect(canonicalFilterLabel(46, 99, 'Власне поле')).toBe('Власне поле')
    const entry: Entry = { value: '1', label: 'x' }
    expect(groupCanonicalFilterOptions(3, [{ ...entry, field: { Type: 1 }, disabled: true }])).toEqual([{ group: 'Товар', items: [{ value: '1', label: 'Товар', disabled: true }] }])
  })
})
