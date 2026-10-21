import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AnalyticsSeriesChart } from './AnalyticsSeriesChart'

describe('AnalyticsSeriesChart', () => {
  it('connects a single forecast point to its adjacent actual without changing the readout', () => {
    const { container } = render(<AnalyticsSeriesChart valueLabel="Кількість" points={[
      { label: 'Січень', actual: 4 }, { label: 'Лютий', actual: null, forecast: 8 },
    ]} />)
    const path = container.querySelector('[data-series="forecast"]')?.getAttribute('d')
    expect(path?.match(/M/g)).toHaveLength(1)
    expect(path?.match(/L/g)).toHaveLength(1)
    expect(container.querySelector('.app-analytics-chart-readout')?.textContent).toBe('ЛютийКількістьФакт —Прогноз 8')
    fireEvent.keyDown(screen.getByRole('group', { name: 'Графік: Кількість' }), { key: 'Home' })
    expect(container.querySelector('.app-analytics-chart-readout')?.textContent).toBe('СіченьКількістьФакт 4Прогноз —')
  })

  it('never bridges a missing period between actuals and the forecast', () => {
    const { container } = render(<AnalyticsSeriesChart valueLabel="Кількість" points={[
      { label: 'Січень', actual: 4 }, { label: 'Лютий', actual: null }, { label: 'Березень', actual: null, forecast: 8 },
    ]} />)
    const path = container.querySelector('[data-series="forecast"]')?.getAttribute('d')
    expect(path?.match(/M/g)).toHaveLength(1)
    expect(path).not.toContain('L')
  })

  it('leaves gaps for missing actuals and distinguishes missing values from zero', () => {
    const { container } = render(<AnalyticsSeriesChart valueLabel="Кількість" points={[
      { label: 'Січень', actual: 0 },
      { label: 'Лютий', actual: null },
      { label: 'Березень', actual: 10, forecast: 12 },
    ]} />)
    const path = container.querySelector('[data-series="actual"]')?.getAttribute('d')
    expect(path?.match(/M/g)).toHaveLength(2)
    expect(path).not.toContain('L')
    const chart = screen.getByRole('group', { name: 'Графік: Кількість' })
    fireEvent.keyDown(chart, { key: 'Home' })
    expect(container.querySelector('.app-analytics-chart-readout')?.textContent).toBe('СіченьКількістьФакт 0Прогноз —')
    fireEvent.keyDown(chart, { key: 'ArrowRight' })
    expect(container.querySelector('.app-analytics-chart-readout')?.textContent).toBe('ЛютийКількістьФакт —Прогноз —')
    fireEvent.keyDown(chart, { key: 'End' })
    expect(container.querySelector('.app-analytics-chart-readout')?.textContent).toBe('БерезеньКількістьФакт 10Прогноз 12')
  })

  it('shows an empty state for entirely unavailable data but renders zero sales', () => {
    const { rerender } = render(<AnalyticsSeriesChart valueLabel="Продажі" emptyLabel="Немає історії" points={[{ label: 'Січень', actual: null }]} />)
    expect(screen.getByRole('status').textContent).toBe('Немає історії')
    rerender(<AnalyticsSeriesChart valueLabel="Продажі" points={[{ label: 'Січень', actual: 0 }]} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('img', { name: 'Продажі: 1 періодів' })).not.toBeNull()
  })

  it('inspects the exact nearest period on pointer movement', () => {
    const { container } = render(<AnalyticsSeriesChart valueLabel="Продажі" points={[
      { label: 'Січень', actual: 3 }, { label: 'Лютий', actual: 8 }, { label: 'Березень', actual: 4 },
    ]} />)
    const chart = screen.getByRole('img')
    chart.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 220, width: 800, height: 220, toJSON: () => ({}) })
    fireEvent.pointerMove(chart, { clientX: 416 })
    expect(container.querySelector('.app-analytics-chart-readout')?.textContent).toBe('ЛютийПродажіФакт 8')
  })

  it('toggles the series without hiding the last visible series or losing inspection', () => {
    const { container, rerender } = render(<AnalyticsSeriesChart valueLabel="Продажі" points={[
      { label: 'Січень', actual: 3, forecast: 8 },
    ]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Факт' }))
    expect(container.querySelector('[data-series="actual"]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Факт' }).getAttribute('aria-pressed')).toBe('false')
    expect((screen.getByRole('button', { name: 'Прогноз' }) as HTMLButtonElement).disabled).toBe(true)
    expect(container.querySelector('.app-analytics-chart-readout')?.textContent).toBe('СіченьПродажіФакт 3Прогноз 8')
    fireEvent.click(screen.getByRole('button', { name: 'Факт' }))
    expect(container.querySelector('[data-series="actual"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Факт' }))
    rerender(<AnalyticsSeriesChart valueLabel="Виручка" points={[{ label: 'Січень', actual: 20 }]} />)
    expect(container.querySelector('[data-series="actual"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Факт' }).getAttribute('aria-pressed')).toBe('true')
  })
})
