import { describe, expect, it } from 'vitest'
import { isDataTableNumericColumn } from './dataTableNumeric'
import type { DataTableColumn } from './types'

function createColumn(
  header: DataTableColumn<unknown>['header'],
  id = 'column',
  numeric?: boolean,
): DataTableColumn<unknown> {
  return { header, id, numeric }
}

describe('isDataTableNumericColumn', () => {
  it.each([
    ['Сума gross', 'grossAmount'],
    ['Вартість брутто (Бух.)', 'accountingGross'],
    ['Кількість', 'quantity'],
    ['К-сть', 'itemCount'],
    ['Вага', 'weight'],
    ['ПДВ %', 'vatRate'],
    ['Баланс', 'balance'],
    ['Знижка, %', 'discountPercent'],
    ['Разом', 'grandTotal'],
    ['Валюта', 'currency'],
    ['Мито', 'customsDuty'],
    ['Оплачено', 'paidAmount'],
    ['ПДВ', 'vatAmount'],
    ['Знижка', 'discountAmount'],
    ['Маржа', 'marginAmount'],
    ['EUR', 'eur'],
  ])('recognizes numeric column %s', (header, id) => {
    expect(isDataTableNumericColumn(createColumn(header, id))).toBe(true)
  })

  it.each([
    ['Тип ціни', 'priceType'],
    ['Статус оплати', 'paymentStatus'],
    ['Облік ПДВ', 'vatAccounting'],
    ['Пробіг', 'mileage'],
    ['Пакування', 'packing'],
    ['Назва складу', 'stockName'],
    ['Значення', 'value'],
  ])('does not treat categorical column %s as numeric', (header, id) => {
    expect(isDataTableNumericColumn(createColumn(header, id))).toBe(false)
  })

  it('falls back to a camel-cased column id for non-text headers', () => {
    expect(
      isDataTableNumericColumn(createColumn(<span>Localized value</span>, 'totalGross')),
    ).toBe(true)
  })

  it('supports an explicit override for exceptional columns', () => {
    expect(isDataTableNumericColumn(createColumn('Залишок', 'balance', false))).toBe(false)
    expect(isDataTableNumericColumn(createColumn('Значення', 'value', true))).toBe(true)
  })
})
