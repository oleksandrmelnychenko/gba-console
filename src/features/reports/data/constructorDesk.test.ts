import { describe, expect, it } from 'vitest'
import { CONSTRUCTOR_CONDITION_LABELS, constructorConditionLabel, constructorFilterField, constructorFilterGroups, constructorGroupingCaption,
  constructorGroupingField, constructorMeasureGroupCaption, constructorMeasureItemCaption, usesConstructorDesk } from './constructorDesk'
import type { ReportDataset, ReportMeasurementGroup, ReportRequestBody } from '../types'

const request = (dataSource: number, extra: Partial<ReportRequestBody> = {}): ReportRequestBody =>
  ({ dataSource, from: '2026-10-01', to: '2026-10-31', selections: [], sorted: { Row: [], Col: [], Measurements: [] }, ...extra })
const dataset = (DataSource: number): ReportDataset => ({ DataSource, Name: 'Набір', Description: '', PeriodRequired: true, PeriodSupported: true, Groupings: [], Measurements: [], Filters: [], Limitations: [],
  constructorPresentation: { version: 1, fields: ['negativeRed', 'grandTotals'] } }) as ReportDataset

describe('constructor desk vocabulary', () => {
  it('labels all eight server comparison types in FilterConditionMain order', () => {
    expect(Object.entries(CONSTRUCTOR_CONDITION_LABELS)).toEqual([['0', 'Рівне'], ['1', 'Не рівне'], ['2', 'В списку'], ['3', 'В групі зі списку'],
      ['4', 'Не в списку'], ['5', 'Не в групі зі списку'], ['6', 'В групі'], ['7', 'Не в групі']])
    expect(constructorConditionLabel(9, 'Інше')).toBe('Інше')
  })

  it('uses the constructor desk only for the six constructor reports', () => {
    expect(usesConstructorDesk(dataset(2), request(2, { reportProfile: 'sales' }))).toBe(true)
    expect(usesConstructorDesk(dataset(2), request(2, { reportProfile: 'grossProfit' }))).toBe(true)
    expect(usesConstructorDesk(dataset(2), request(2))).toBe(false)
    expect(usesConstructorDesk(dataset(2), request(2, { reportProfile: 'sales', returnsOnly: true }))).toBe(true)
    for (const source of [3, 44, 45, 46]) expect(usesConstructorDesk(dataset(source), request(source))).toBe(true)
    expect(usesConstructorDesk(dataset(35), request(35))).toBe(false)
    expect(usesConstructorDesk({ ...dataset(3), constructorPresentation: undefined } as ReportDataset, request(3))).toBe(false)
    expect(usesConstructorDesk(dataset(3), request(45))).toBe(false)
  })

  it('maps sales profile groupings to the requested categories and keeps the GBA meaning of 19 and 20', () => {
    const sales = request(2, { reportProfile: 'sales' })
    expect(constructorGroupingField(sales, 2, 'По місяцях')).toEqual({ type: 2, label: 'По місяцях', path: [] })
    expect(constructorGroupingField(sales, 4, 'Організація')).toEqual({ type: 4, label: 'Організація', path: [] })
    expect(constructorGroupingField(sales, 10, 'Група товару')).toEqual({ type: 10, label: 'Товарна група', path: ['Товар'] })
    expect(constructorGroupingField(sales, 14, 'Код регіону')).toEqual({ type: 14, label: 'Код по регіону', path: ['Покупець'] })
    expect(constructorGroupingField(sales, 16, 'Менеджер клієнта').label).toBe('Відповідальний менеджер покупця')
    expect(constructorGroupingField(sales, 19, 'Ввів документ')).toEqual({ type: 19, label: 'Відповідальний менеджер що забив товар', path: ['Документ продажу'] })
    expect(constructorGroupingField(sales, 20, 'Провів документ')).toEqual({ type: 20, label: 'Відповідальний менеджер що перевів в статус накладної', path: ['Документ продажу'] })
    expect(constructorGroupingField(sales, 21, 'Постачальник')).toEqual({ type: 21, label: 'Постачальник', path: [] })
    expect(constructorGroupingCaption(sales, 19, 'Ввів документ')).toBe('Документ продажу. Відповідальний менеджер що забив товар')
    expect(constructorGroupingCaption(sales, 13, 'Регіон клієнта')).toBe('Покупець. Регіон')
    expect(constructorGroupingCaption(sales, 7, 'Назва товару')).toBe('Назва товару')
  })

  it('keeps every other report’s own field names and only categorises them', () => {
    expect(constructorGroupingField(request(46), 19, 'Користувач, який додав товар у первинний продаж'))
      .toEqual({ type: 19, label: 'Користувач, який додав товар у первинний продаж', path: ['Документ продажу'] })
    expect(constructorGroupingField(request(3), 25, 'Договір постачальника').path).toEqual(['Постачальник'])
    expect(constructorGroupingField(request(45), 29, 'Склад').path).toEqual(['Склад'])
    expect(constructorGroupingField(request(45), 34, 'Поточна організація складу').path).toEqual([])
    expect(constructorGroupingCaption(request(44), 13, 'Поточний регіон клієнта')).toBe('Поточний регіон клієнта')
  })

  it('groups filter fields by category without changing the wire field', () => {
    const sales = request(2, { reportProfile: 'grossProfit' })
    const options = [0, 4, 7, 12, 15].map(type => ({ value: String(type), label: `Поле ${type}`, field: { Type: type } }))
    expect(constructorFilterGroups(sales, options)).toEqual([
      { value: '0', label: 'Організація' },
      { group: 'Товар', items: [{ value: '4', label: 'Товарна група' }] },
      { group: 'Покупець', items: [{ value: '7', label: 'Покупець. Регіон' }] },
      { group: 'Документ продажу', items: [{ value: '12', label: 'Документ продажу' }, { value: '15', label: 'Відповідальний менеджер що забив товар' }] },
    ])
    expect(constructorFilterField(request(46), 15, 'Користувач, який додав товар у продаж').label).toBe('Користувач, який додав товар у продаж')
  })

  it('renames sales and gross-profit measures without changing their types', () => {
    const group = (Name: string, types: number[]): ReportMeasurementGroup => ({ Name, IsChecked: false, SubList: types.map(Type => ({ Name: `${Name}${Type}`, Type, IsChecked: false })) })
    const sales = request(2, { reportProfile: 'sales' }), gross = request(2, { reportProfile: 'grossProfit' })
    expect(constructorMeasureGroupCaption(sales, group('SalesQuantity', [0]), 'x')).toBe('Кількість продажу')
    expect(constructorMeasureGroupCaption(sales, group('SalesValue', [2, 3, 4]), 'x')).toBe('Вартість продажу')
    expect(constructorMeasureItemCaption(sales, group('Profitability', [14, 15]), { Name: 'P', Type: 15, IsChecked: false })).toBe('% (з ПДВ)')
    expect(constructorMeasureGroupCaption(gross, group('SalesQuantity', [0]), 'x')).toBe('Кількість (од. зберігання)')
    expect(constructorMeasureGroupCaption(gross, group('Cost', [6, 7, 8]), 'x')).toBe('Собівартість (EUR)')
    expect(constructorMeasureGroupCaption(gross, group('Markup', [10]), 'x')).toBe('Валовий прибуток (EUR)')
    expect(constructorMeasureItemCaption(gross, group('Markup', [10]), { Name: 'MarkupWithoutVAT', Type: 10, IsChecked: false })).toBe('Без ПДВ')
    expect(constructorMeasureGroupCaption(request(3), group('SalesValue', [2, 3]), 'Вартість закупівлі')).toBe('Вартість закупівлі')
    expect(constructorMeasureItemCaption(request(3), group('SalesValue', [2, 3]), { Name: 'SalesValueVAT', Type: 3, IsChecked: false })).toBeUndefined()
  })
})
