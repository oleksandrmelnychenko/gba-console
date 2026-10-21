import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AnalyticsTabs } from './AnalyticsControls'

describe('AnalyticsTabs', () => {
  it('exposes selected metric and changes/focuses metrics with the keyboard', () => {
    const onChange = vi.fn()
    render(<AnalyticsTabs label="Показник" value="units" onChange={onChange} items={[
      { value: 'units', label: 'Кількість', valueLabel: 0 },
      { value: 'revenue', label: 'Виручка', valueLabel: '100 EUR' },
    ]} />)
    const units = screen.getByRole('button', { name: 'Кількість 0' })
    const revenue = screen.getByRole('button', { name: 'Виручка 100 EUR' })
    expect(units.getAttribute('aria-pressed')).toBe('true')
    fireEvent.keyDown(units, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('revenue')
    expect(document.activeElement).toBe(revenue)
    fireEvent.keyDown(revenue, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith('units')
    fireEvent.click(revenue)
    expect(onChange).toHaveBeenLastCalledWith('revenue')
  })
})
