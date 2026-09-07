import { describe, expect, it } from 'vitest'
import { CURRENT_STOCK_REPORT_TITLES, getCurrentStockReport, isCurrentStockSource } from './currentStockReports'

describe('published current snapshot identities', () => {
  it('recognizes only the three explicit current sources and exact workbook titles', () => {
    expect([...CURRENT_STOCK_REPORT_TITLES]).toEqual([
      'Звіт поточних складських залишків', 'Звіт поточних розміщень товарів', 'Звіт поточних резервів за договорами',
    ])
    for (const source of [4, 5, 6]) expect(isCurrentStockSource(source)).toBe(true)
    for (const source of [undefined, 0, 1, 2, 3, 7, 99]) {
      expect(isCurrentStockSource(source)).toBe(false)
      expect(getCurrentStockReport(source)).toBeUndefined()
    }
    expect(CURRENT_STOCK_REPORT_TITLES.has('Звіт поточних резервів за договорами користувача')).toBe(false)
  })
})
