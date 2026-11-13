import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { SalesPredictionChart } from './SalesPredictionChart'
import { formatAxisMoney } from './salesPredictionAxis'

vi.mock('@mantine/charts', () => ({
  LineChart: ({ series }: { series: Array<{ label: string }> }) => <div data-testid="chart">{series.map((item) => item.label).join('|')}</div>,
}))

it('states the forecast basis in the series and summary labels', () => {
  render(<MantineProvider env="test"><I18nProvider>
    <SalesPredictionChart
      coveragePct={80}
      data={[
        { amount: 100, high: 130, low: 70, month: 'Грудень' },
        { amount: 300, high: 360, low: 240, month: 'Січень' },
      ]}
      title="Прогноз"
    />
  </I18nProvider></MantineProvider>)

  expect(screen.getByTestId('chart').textContent)
    .toBe('Продажі мінус повернення, EUR з ПДВ|Верхня межа, EUR з ПДВ|Нижня межа, EUR з ПДВ')
  expect(screen.getByText('Разом за період, з ПДВ')).toBeTruthy()
  expect(screen.getByText('Середнє за місяць')).toBeTruthy()
  expect(screen.getByText('Пік за місяць')).toBeTruthy()
})

it('keeps the axis amount and its currency on one line with a non-breaking space', () => {
  expect(formatAxisMoney(1500)).toBe('1\u00a0500\u00a0EUR')
  expect(formatAxisMoney(0)).toBe('0\u00a0EUR')
})
