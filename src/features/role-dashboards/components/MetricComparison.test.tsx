import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { MetricComparison } from './MetricComparison'
import type { DashboardWorkspaceMetric } from '../types'
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
const metric: DashboardWorkspaceMetric = { key: 'recognized-sales', label: 'Продажі', value: 150, hasData: true, coveragePercent: null, timeBasis: 'period', tone: 'neutral', unit: 'EUR', comparison: { from: '2026-10-21', to: '2026-10-24', value: 100, delta: 50, deltaPercent: 50, unknownReason: '' } }
const show = (value = metric) => render(<MantineProvider><MetricComparison metric={value} /></MantineProvider>)
it('shows explicit prior dates, absolute change and known percentage without calling it a target', () => {
  show()
  expect(screen.getByText(/21.10.2026 — 23.10.2026/)).toBeTruthy()
  expect(screen.getByText('Попереднє значення: 100,00 EUR')).toBeTruthy()
  expect(screen.getByText('Зміна: +50,00 EUR (+50%)')).toBeTruthy()
  expect(screen.queryByText(/план/i)).toBeNull()
})
it('keeps a known zero baseline and absolute delta without a fabricated percentage', () => {
  show({ ...metric, comparison: { ...metric.comparison!, value: 0, delta: 150, deltaPercent: null, unknownReason: 'Відсоток не визначено: попереднє значення дорівнює нулю' } })
  expect(screen.getByText('Попереднє значення: 0,00 EUR')).toBeTruthy()
  expect(screen.getByText('Зміна: +150,00 EUR')).toBeTruthy()
  expect(screen.queryByText(/%/)).toBeNull()
})
it('does not turn missing cost/source data into a negative change or zero', () => {
  show({ ...metric, comparison: { ...metric.comparison!, value: null, delta: 50, deltaPercent: 50, unknownReason: 'Історична собівартість відсутня' } })
  expect(screen.getByText('Попереднє значення: Немає даних')).toBeTruthy()
  expect(screen.getByText('Історична собівартість відсутня')).toBeTruthy()
  expect(screen.queryByText(/Зміна:/)).toBeNull()
})
it('suppresses delta for unavailable current metrics even if a stale comparison object was retained', () => {
  show({ ...metric, hasData: false })
  expect(screen.queryByText(/Зміна:/)).toBeNull()
})
it('renders nothing for older APIs without a comparison contract', () => {
  const { container } = show({ ...metric, comparison: undefined })
  expect(container.querySelector('.role-dashboard-comparison')).toBeNull()
})

it('keeps unavailable previous data and its explanation accessible in compact mode', () => {
  const reason = 'Історична собівартість відсутня'
  const { container } = render(<MantineProvider><MetricComparison compact metric={{ ...metric, comparison: { ...metric.comparison!, value: null, delta: 50, deltaPercent: 50, unknownReason: reason } }} /></MantineProvider>)
  expect(screen.getByText('Попереднє значення: Немає даних')).toBeTruthy()
  expect(screen.queryByText(/Зміна:/)).toBeNull()
  expect(screen.queryByText(reason)).toBeNull()
  expect(container.querySelector('.role-dashboard-comparison')?.getAttribute('title')).toContain(reason)
})

it('distinguishes margin percentage points from relative percentage change', () => {
  show({ ...metric, unit: '%', value: 25.25, comparison: { ...metric.comparison!, value: 20.2, delta: 5.05, deltaPercent: 25 } })
  expect(screen.getByText('Попереднє значення: 20,2 %')).toBeTruthy()
  expect(screen.getByText('Зміна: +5,05 в.п. (+25% від попереднього)')).toBeTruthy()
})
