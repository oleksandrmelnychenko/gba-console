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
    expect(constructorGroupingField(sales, 2, 'По місяцях')).toMatchObject({ type: 2, label: 'По місяцях', path: [] })
    expect(constructorGroupingField(sales, 4, 'Організація')).toMatchObject({ type: 4, label: 'Організація', path: [] })
    expect(constructorGroupingField(sales, 10, 'Група товару')).toMatchObject({ type: 10, label: 'Товарна група', path: ['Товар'] })
    expect(constructorGroupingField(sales, 14, 'Код регіону')).toMatchObject({ type: 14, label: 'Код по регіону', path: ['Покупець'] })
    expect(constructorGroupingField(sales, 16, 'Менеджер клієнта').label).toBe('Відповідальний менеджер покупця')
    expect(constructorGroupingField(sales, 19, 'Ввів документ')).toMatchObject({ type: 19, label: 'Відповідальний менеджер що забив товар', path: ['Документ продажу'] })
    expect(constructorGroupingField(sales, 20, 'Провів документ')).toMatchObject({ type: 20, label: 'Відповідальний менеджер що перевів в статус накладної', path: ['Документ продажу'] })
    expect(constructorGroupingField(sales, 21, 'Постачальник')).toMatchObject({ type: 21, label: 'Постачальник', path: [] })
    expect(constructorGroupingCaption(sales, 19, 'Ввів документ')).toBe('Відповідальний менеджер що забив товар')
    expect(constructorGroupingCaption(sales, 13, 'Регіон клієнта')).toBe('Регіон')
    expect(constructorGroupingCaption(sales, 7, 'Назва товару')).toBe('Назва товару')
    expect(constructorGroupingField(sales, 7, 'Назва товару').caption).toBe('Назва товару')
    expect(constructorGroupingField(sales, 15, 'Договір').caption).toBe('Договір')
  })

  it('keeps every other report’s own field names and only categorises them', () => {
    expect(constructorGroupingField(request(46), 19, 'Користувач, який додав товар у первинний продаж'))
      .toEqual({ type: 19, label: 'Користувач, який додав товар у первинний продаж', path: ['Документ продажу'] })
    expect(constructorGroupingField(request(3), 25, 'Договір постачальника').path).toEqual(['Постачальник'])
    expect(constructorGroupingField(request(45), 29, 'Склад').path).toEqual(['Склад'])
    expect(constructorGroupingField(request(45), 34, 'Поточна організація складу').path).toEqual([])
    expect(constructorGroupingCaption(request(44), 13, 'Регіон клієнта')).toBe('Регіон клієнта')
  })

  it('groups filter fields by category without changing the wire field', () => {
    const sales = request(2, { reportProfile: 'grossProfit' })
    const options = [0, 4, 7, 12, 15].map(type => ({ value: String(type), label: `Поле ${type}`, field: { Type: type } }))
    const unavailableParties = { group: 'Контрагент', items: [
      { value: 'unavailable:buyer', label: 'Покупець (недоступно для цього звіту)', disabled: true },
      { value: 'unavailable:goods-supplier', label: 'Постачальник товару (недоступно для цього звіту)', disabled: true },
      { value: 'unavailable:service-supplier', label: 'Постачальник послуг (недоступно для цього звіту)', disabled: true },
    ] }
    expect(constructorFilterGroups(sales, options)).toEqual([
      { value: '0', label: 'Організація' },
      { group: 'Товари', items: [{ value: '4', label: 'Товарна група' }] },
      unavailableParties,
      { group: 'Покупці', items: [{ value: '7', label: 'Регіон' }] },
      { group: 'Документи продажу', items: [{ value: '12', label: 'Документ продажу' }, { value: '15', label: 'Відповідальний менеджер що забив товар' }] },
    ])
    expect(constructorFilterField(request(46), 15, 'Користувач, який додав товар у продаж').label).toBe('Відповідальний менеджер що забив товар')
    expect(constructorFilterField(request(3), 21, 'Склад надходження')).toEqual({ type: 21, label: 'Склад', path: ['Склад'] })
    expect(constructorFilterField(request(40), 32, 'Організація рахунку')).toEqual({ type: 32, label: 'Організація', path: [] })
    expect(constructorFilterGroups(request(45), [21, 20, 3, 0, 19, 2, 1, 4, 23].map(type => ({ value: String(type), label: `Поле ${type}`, field: { Type: type } })))).toEqual([
      { value: '0', label: 'Організація' },
      { group: 'Товари', items: ['Товар', 'Артикул', 'Топ', 'Товарна група', 'Одиниця виміру'].map((label, index) => ({ value: String([1, 2, 3, 4, 20][index]), label })) },
      unavailableParties,
      { group: 'Постачальники', items: [{ value: '19', label: 'Поле 19' }] },
      { group: 'Склади', items: [{ value: '21', label: 'Склад' }, { value: '23', label: 'Поле 23' }] },
    ])
  })

  it('renames sales and gross-profit measures without changing their types', () => {
    const group = (Name: string, types: number[]): ReportMeasurementGroup => ({ Name, IsChecked: false, SubList: types.map(Type => ({ Name: `${Name}${Type}`, Type, IsChecked: false })) })
    const sales = request(2, { reportProfile: 'sales' }), gross = request(2, { reportProfile: 'grossProfit' })
    expect(constructorMeasureGroupCaption(sales, group('SalesQuantity', [0]), 'x')).toBe('Кількість продажу')
    expect(constructorMeasureGroupCaption(sales, group('SalesValue', [2, 3, 4]), 'x')).toBe('Вартість продажу')
    expect(constructorMeasureGroupCaption(sales, group('Profitability', [14, 15]), 'x')).toBe('Націнка, %')
    expect(constructorMeasureItemCaption(sales, group('Profitability', [14, 15]), { Name: 'P', Type: 15, IsChecked: false })).toBe('з ПДВ')
    expect(constructorMeasureGroupCaption(sales, group('MarginPercent', [115, 116]), 'x')).toBe('Маржа, %')
    expect(constructorMeasureGroupCaption(gross, group('MarginPercent', [115, 116]), 'x')).toBe('Маржа, %')
    expect(constructorMeasureGroupCaption(gross, group('Profitability', [14, 15]), 'x')).toBe('Націнка, %')
    expect(constructorMeasureItemCaption(gross, group('Profitability', [14, 15]), { Name: 'P', Type: 14, IsChecked: false })).toBeUndefined()
    expect(constructorMeasureGroupCaption(gross, group('SalesQuantity', [0]), 'x')).toBe('Кількість (од. зберігання)')
    expect(constructorMeasureGroupCaption(gross, group('Cost', [6, 7, 8]), 'x')).toBe('Собівартість (EUR)')
    expect(constructorMeasureGroupCaption(gross, group('Markup', [10]), 'x')).toBe('Валовий прибуток (EUR)')
    expect(constructorMeasureItemCaption(gross, group('Markup', [10]), { Name: 'MarkupWithoutVAT', Type: 10, IsChecked: false })).toBe('Без ПДВ')
    expect(constructorMeasureItemCaption(gross, group('Markup', [10, 12]), { Name: 'MarkupWithVAT', Type: 12, IsChecked: false })).toBe('З ПДВ')
    expect(constructorMeasureGroupCaption(request(3), group('SalesValue', [2, 3]), 'Вартість закупівлі')).toBe('Вартість закупівлі')
    expect(constructorMeasureItemCaption(request(3), group('SalesValue', [2, 3]), { Name: 'SalesValueVAT', Type: 3, IsChecked: false })).toBeUndefined()
  })
})
