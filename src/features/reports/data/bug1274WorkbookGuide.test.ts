import { expect, it } from 'vitest'
import { bug1274DatasetTitle, bug1274WorkbookPeriod, reportPeriodPresets } from './bug1274WorkbookGuide'

it('opens the month workbooks on the current month, the matrix on the year and the day workbooks on the last day', () => {
  expect(bug1274WorkbookPeriod('ВП.xls', '2026-10-17')).toEqual({ from: '2026-10-01', to: '2026-10-16' })
  expect(bug1274WorkbookPeriod('ДБіторка.xls', '2026-10-01')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  expect(bug1274WorkbookPeriod('Впарювання.xls', '2026-10-17')).toEqual({ from: '2026-01-01', to: '2026-10-17' })
  expect(bug1274WorkbookPeriod('gba:sales-constructor:v1', '2026-11-12')).toEqual({ from: '2026-11-01', to: '2026-11-12' })
  expect(bug1274WorkbookPeriod('gba:gross-profit-constructor:v1', '2026-11-01')).toEqual({ from: '2026-11-01', to: '2026-11-01' })
  expect(bug1274WorkbookPeriod('Взаємороз всі.xls', '2026-10-17')).toBeNull()
  expect(bug1274WorkbookPeriod('Ведомость по денежным средствам.xls', '2026-10-17')).toBeNull()
})

it('offers quick periods that end on the day each form opens on and respects the 62-day profit limit', () => {
  expect(reportPeriodPresets(35, '2026-10-17')).toEqual([
    { label: 'Вчора', from: '2026-10-16', to: '2026-10-16' },
    { label: 'Поточний місяць', from: '2026-10-01', to: '2026-10-16' },
    { label: 'Минулий місяць', from: '2026-09-01', to: '2026-09-30' },
  ])
  expect(reportPeriodPresets(39, '2026-03-01').map(preset => [preset.label, preset.from, preset.to])).toEqual([
    ['Сьогодні', '2026-03-01', '2026-03-01'], ['Поточний місяць', '2026-03-01', '2026-03-01'],
    ['Минулий місяць', '2026-02-01', '2026-02-28'], ['Поточний рік', '2026-01-01', '2026-03-01']])
  expect(reportPeriodPresets(41, '2026-01-01').at(-1)).toEqual({ label: 'Поточний рік', from: '2025-01-01', to: '2025-12-31' })
  expect(reportPeriodPresets(12, '2026-10-17')).toEqual([])
})

it('names the five report datasets as the 1C reports', () => {
  expect([35, 38, 39, 40, 41].map(bug1274DatasetTitle)).toEqual(['Валовий прибуток', 'Валовий прибуток по постачальниках',
    'Аналіз залишків і продажів', 'Відомість по коштах', 'Взаєморозрахунки з контрагентами'])
  expect(bug1274DatasetTitle(12)).toBeUndefined()
})
