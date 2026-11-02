import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { ConstructorUnavailableFilters, NO_GBA_DATA_FILTER_HINT, unavailableConstructorFilters } from './ConstructorUnavailableFilters'

afterEach(cleanup)

it.each([
  [2, 'sales', ['Проєкт', 'Підрозділ']],
  [2, 'grossProfit', []],
  [2, null, []],
  [46, null, ['Проєкт', 'Підрозділ']],
  [44, null, ['Підрозділ']],
  [3, null, []],
] as const)('lists the QA filters without GBA data for source %s profile %s', (source, profile, expected) => {
  expect(unavailableConstructorFilters(source, profile)).toEqual(expected)
})

it('renders each unavailable filter as a disabled row with the no-data hint', () => {
  render(<MantineProvider env="test"><ConstructorUnavailableFilters fields={['Проєкт', 'Підрозділ']} /></MantineProvider>)
  for (const field of ['Проєкт', 'Підрозділ']) {
    const row = document.querySelector(`[data-unavailable-filter="${field}"]`)
    expect(row?.getAttribute('aria-disabled')).toBe('true')
    expect(row?.getAttribute('title')).toBe(NO_GBA_DATA_FILTER_HINT)
    expect((screen.getByRole('checkbox', { name: `${field}: ${NO_GBA_DATA_FILTER_HINT}` }) as HTMLInputElement).disabled).toBe(true)
  }
  expect(screen.getAllByText(NO_GBA_DATA_FILTER_HINT)).toHaveLength(2)
})

it('renders nothing when the report has no unavailable filters', () => {
  const { container } = render(<MantineProvider env="test"><ConstructorUnavailableFilters fields={[]} /></MantineProvider>)
  expect(container.querySelector('[data-unavailable-filter]')).toBeNull()
})
