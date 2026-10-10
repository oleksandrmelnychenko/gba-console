import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { matrixFixture } from '../testing/originalVparivanieFixtures'
import { OriginalVparivanieMatrix } from './OriginalVparivanieMatrix'
const view = (result = matrixFixture()) => <MantineProvider env="test"><I18nProvider><OriginalVparivanieMatrix result={result} /></I18nProvider></MantineProvider>
const acceptedFixture = () => ({ ...matrixFixture(), SourceParityVerified: true, OriginalFullTaskAccepted: true })
it('does not expose candidate quantities before native comparisons are accepted', () => {
  render(view()); expect(screen.queryByRole('table')).toBeNull()
  expect(screen.getByText('Матриця проходить звірку з 1С. Звіт буде доступний після завершення перевірки.')).toBeTruthy()
})
it('renders exact negative strings and distinct sparse zeros under the server physical columns', () => {
  render(view(acceptedFixture()))
  const rows = screen.getAllByRole('row').slice(1)
  expect(within(rows[0]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0', '0', '', ''])
  expect(within(rows[1]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['', '', '-9007199254740993.125', '-9007199254740993.125'])
  expect(screen.getAllByRole('rowheader', { name: 'Однакова назва' })).toHaveLength(2)
  expect(screen.queryByText('B'.repeat(32))).toBeNull()
})
it('retains row order across pages and clears the page on new input witness', () => {
  const result = acceptedFixture(); result.Rows = Array.from({ length: 70 }, (_, n) => ({ ...result.Rows[0], ProductReference: (n + 1).toString(16).toUpperCase().padStart(32, '0'), Caption: `Товар ${n}` }))
  const rendered = render(view(result)); expect(screen.getAllByRole('rowheader')).toHaveLength(50)
  fireEvent.click(screen.getByRole('button', { name: 'Наступні рядки' })); expect(screen.getAllByRole('rowheader')[0].textContent).toBe('Товар 50')
  rendered.rerender(view({ ...result, InputWitnessSha256: 'b'.repeat(64) })); expect(screen.getAllByRole('rowheader')[0].textContent).toBe('Товар 0')
})
