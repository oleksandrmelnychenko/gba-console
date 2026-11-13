import { expect, it } from 'vitest'
import { formatEur } from '../metricPresentation'
import { headChartManagerLabel } from './HeadDashboardChartsPanel'

it('labels a manager by the team name, then the dashboard name, and by id only as the last resort', () => {
  const names = new Map([[10162, 'Олена Коваль']])
  expect(headChartManagerLabel({ manager_id: 10162 }, names)).toBe('Олена Коваль')
  expect(headChartManagerLabel({ manager_id: 10184, manager_name: ' Ігор Мельник ' }, names)).toBe('Ігор Мельник')
  expect(headChartManagerLabel({ manager_id: 10146, manager_name: null }, names)).toBe('#10146')
})
it('formats chart money as whole EUR with a non-breaking space before the currency', () => {
  expect(formatEur(15000)).toBe('15\u00a0000\u00a0EUR')
  expect(formatEur(469.4)).toBe('469\u00a0EUR')
})
