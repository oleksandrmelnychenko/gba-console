import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { getSalesForecast } from '../api/salesPredictionApi'
import type { SalesForecastMeta } from '../types'
import { SalesPredictionPage } from './SalesPredictionPage'

const i18n = vi.hoisted(() => ({
  t: (key: string, values?: Record<string, unknown>) => key.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? '')),
}))
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => i18n }))
vi.mock('../api/salesPredictionApi', () => ({ getSalesForecast: vi.fn(), searchPredictionClients: vi.fn(), searchPredictionProducts: vi.fn() }))
vi.mock('../../../shared/ai/AiHistoryLineageNote', () => ({ AiHistoryLineageNote: () => null }))
vi.mock('../components/SalesPredictionChart', () => ({
  SalesPredictionComparisonChart: () => null,
  SalesPredictionChart: ({ title, coveragePct, data }: { title: string; coveragePct?: number; data: unknown[] }) =>
    <div data-testid="forecast-chart">{title} | {coveragePct ?? 'no-interval'} | {data.length}</div>,
}))
vi.mock('@mantine/core', async (original) => ({
  ...await original<typeof import('@mantine/core')>(),
  Select: ({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string | null) => void }) =>
    <button type="button" onClick={() => onChange(value ? null : `${label}-id`)}>{label}: {value ?? 'порожньо'}</button>,
}))

const meta = { horizon_months: 6, horizon_shape: 'flat_run_rate', interval: { coverage_pct: 80 } } as unknown as SalesForecastMeta
const point = { MonthNameUK: 'Грудень', SaleAmount: 100, SaleAmountLow: 70, SaleAmountHigh: 130 }

beforeEach(() => {
  vi.mocked(getSalesForecast).mockReset()
  vi.mocked(getSalesForecast).mockResolvedValue({ ByClient: [point], ByProduct: [point], ByClientAndProduct: [point], meta } as never)
})

it('keeps the client forecast title, interval and run-rate note after the product is cleared', async () => {
  render(<MantineProvider env="test"><SalesPredictionPage /></MantineProvider>)
  fireEvent.click(screen.getByRole('button', { name: /^Клієнт:/ }))
  fireEvent.click(screen.getByRole('button', { name: /^Товар:/ }))
  await waitFor(() => expect(screen.getAllByTestId('forecast-chart')).toHaveLength(3))
  await waitFor(() => expect(screen.getAllByTestId('forecast-chart')[2].textContent).toContain('на 6 місяців | 80 | 1'))
  const requests = vi.mocked(getSalesForecast).mock.calls.length

  fireEvent.click(screen.getByRole('button', { name: /^Товар:/ }))

  const charts = screen.getAllByTestId('forecast-chart')
  expect(charts).toHaveLength(1)
  expect(charts[0].textContent).toContain('Прогноз продажів по клієнту')
  expect(charts[0].textContent).toContain('на 6 місяців | 80 | 1')
  expect(screen.getByTestId('forecast-horizon-shape')).toBeTruthy()
  expect(vi.mocked(getSalesForecast).mock.calls.length).toBe(requests)
})

it('drops the client forecast context when the client itself is cleared', async () => {
  render(<MantineProvider env="test"><SalesPredictionPage /></MantineProvider>)
  fireEvent.click(screen.getByRole('button', { name: /^Клієнт:/ }))
  await waitFor(() => expect(screen.getByTestId('forecast-chart').textContent).toContain('на 6 місяців | 80 | 1'))
  fireEvent.click(screen.getByRole('button', { name: /^Клієнт:/ }))
  expect(screen.queryByTestId('forecast-chart')).toBeNull()
  expect(screen.queryByTestId('forecast-horizon-shape')).toBeNull()
})
