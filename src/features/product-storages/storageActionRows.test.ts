import { describe, expect, it } from 'vitest'
import {
  getStorageActionRowQty,
  getStorageActionRowsError,
  INITIAL_STORAGE_ACTION_ROW_QTY_TEXT,
  sumStorageActionRows,
} from './storageActionRows'

const t = (text: string, values?: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_match, key: string) => String(values?.[key] ?? ''))

/* «Попередній перегляд» › Кількість on /products/storages (deep-writeoff.json quantityMap.B: D2-WO-003, «QA шт»,
   53,494 available after the earlier cases). Before: -3 → 30, 1e3 → 13, pasted «1 000» → the whole stock,
   0 / empty / 2,5 / 2.5 / Arabic digits → 0.001, and the cell started with the whole stock. */
const piece = (qtyText: string) => ({ available: 53.494, qtyText, unit: 'QA шт' })
const metre = (qtyText: string) => ({ available: 10, qtyText, unit: 'м' })

describe('preview quantity cell (group write-off / transfer)', () => {
  it('starts empty, so an untouched «Виконати» sends nothing', () => {
    expect(INITIAL_STORAGE_ACTION_ROW_QTY_TEXT).toBe('')
    expect(getStorageActionRowQty(piece(INITIAL_STORAGE_ACTION_ROW_QTY_TEXT), t)).toBeNull()
    expect(getStorageActionRowsError([piece('')], t)).toBe('Вкажіть кількість')
  })

  it.each([
    ['-3', 'Кількість не може бути від’ємною'],
    ['1e3', 'Введіть число'],
    ['1 000', 'Введіть число'],
    ['١٢', 'Введіть число'],
    ['0', 'Кількість має бути більшою за 0'],
    ['0,000', 'Кількість має бути більшою за 0'],
    ['', 'Вкажіть кількість'],
    ['   ', 'Вкажіть кількість'],
    ['2,5', 'Для одиниці «QA шт» кількість має бути цілою'],
    ['2.5', 'Для одиниці «QA шт» кількість має бути цілою'],
    ['0,001', 'Для одиниці «QA шт» кількість має бути цілою'],
    ['150', 'Більше, ніж доступно (53,494)'],
  ])('blocks «%s» for a piece unit before the confirm step: %s', (input, error) => {
    expect(getStorageActionRowQty(piece(input), t)).toBeNull()
    expect(getStorageActionRowsError([piece(input)], t)).toBe(error)
  })

  it.each([
    ['1', 1],
    ['53', 53],
  ])('sends «%s» as %s for a piece unit', (input, qty) => {
    expect(getStorageActionRowQty(piece(input), t)).toBe(qty)
  })

  it.each([
    ['2,5', 2.5],
    ['2.5', 2.5],
    ['0,001', 0.001],
    ['10', 10],
  ])('keeps «%s» as %s for a divisible unit (м)', (input, qty) => {
    expect(getStorageActionRowQty(metre(input), t)).toBe(qty)
  })

  it('refuses a fraction of «QA од» on neither side: the unit name is not a piece name', () => {
    expect(getStorageActionRowQty({ available: 5, qtyText: '1,5', unit: 'QA од' }, t)).toBe(1.5)
  })

  it('adds only what will be sent to «Разом» and reports the first bad row', () => {
    const rows = [piece('2'), metre('2,5'), piece('-3')]

    expect(sumStorageActionRows(rows, t)).toBe(4.5)
    expect(getStorageActionRowsError(rows, t)).toBe('Кількість не може бути від’ємною')
    expect(getStorageActionRowsError([piece('2'), metre('2,5')], t)).toBeNull()
  })
})
