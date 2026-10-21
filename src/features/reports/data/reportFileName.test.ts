import { expect, it } from 'vitest'
import { reportFileBaseName } from './reportFileName'

it('names the file after the workbook and its period', () => {
  expect(reportFileBaseName('ВП по постачальниках.xls', '2026-09-01', '2026-09-30', true)).toBe('ВП по постачальниках 01.09.2026-30.09.2026')
  expect(reportFileBaseName('Взаємороз всі.xls', '2026-09-13', '2026-09-13', true)).toBe('Взаємороз всі 13.09.2026')
})

it('keeps the name valid on Windows and falls back to a plain report name', () => {
  expect(reportFileBaseName('Кошти: залишки / рух', '', '', false)).toBe('Кошти залишки рух')
  expect(reportFileBaseName('  ', '2026-09-01', '2026-09-30', false)).toBe('Звіт')
})

it('downloads the renamed report without changing its legacy workbook identity', () => {
  expect(reportFileBaseName('Впарювання.xls', '2026-09-01', '2026-09-30', true))
    .toBe('Аналіз залишків і продажів 01.09.2026-30.09.2026')
})
