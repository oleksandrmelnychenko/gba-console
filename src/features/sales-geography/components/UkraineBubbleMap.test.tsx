import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { UkraineBubbleMap } from './UkraineBubbleMap'
import { formatGeographyMoney } from '../data/salesGeographyPresentation'
import type { PlottedRegion } from '../types'
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: (value: string) => value }) }))

it('scales negative returns by magnitude and distinguishes them from zero and unknown amounts', () => {
  const base: PlottedRegion = { code: 'PA', name: 'Полтавська', valueEur: -100, knownValueEur: -100, clientCount: 1, unresolvedAmountCount: 0, lat: 49.59, lng: 34.55 }
  render(<UkraineBubbleMap metric="sales" formatMoney={formatGeographyMoney} formatCount={n => `${n} клієнтів`} regions={[
    base,
    { ...base, code: 'LV', name: 'Львівська', valueEur: 100, knownValueEur: 100 },
    { ...base, code: 'KI', name: 'Київ', valueEur: 0, knownValueEur: 0 },
    { ...base, code: 'OD', name: 'Одеська', valueEur: null, knownValueEur: 500, unresolvedAmountCount: 1 },
  ]} />)
  const negative = screen.getByRole('img', { name: 'Полтавська: €-100,00, 1 клієнтів' })
  const positive = screen.getByRole('img', { name: 'Львівська: €100,00, 1 клієнтів' })
  const zero = screen.getByRole('img', { name: 'Київ: €0,00, 1 клієнтів' })
  const unknown = screen.getByRole('img', { name: 'Одеська: Сума не визначена, Відомо: €500,00, 1 клієнтів' })
  expect(negative.getAttribute('r')).toBe('56')
  expect(negative.getAttribute('r')).toBe(positive.getAttribute('r'))
  expect(negative.getAttribute('fill')).toBe('var(--mantine-color-red-6)')
  expect(zero.getAttribute('fill')).toBe('none')
  expect(zero.getAttribute('stroke-dasharray')).toBeNull()
  expect(unknown.getAttribute('r')).toBe('6')
  expect(unknown.getAttribute('fill')).toBe('none')
  expect(unknown.getAttribute('stroke-dasharray')).toBe('3 2')
  fireEvent.focus(unknown)
  expect(screen.getByText('Сума не визначена')).toBeTruthy()
  expect(screen.getByText('Відомо: €500,00')).toBeTruthy()
  fireEvent.keyDown(unknown, { key: 'Escape' })
  expect(screen.queryByText('Сума не визначена')).toBeNull()
})
