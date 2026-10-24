import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { OriginalSalesGrid } from './OriginalSalesGrid'

const lines = Array.from({ length: 51 }, (_, i) => ({ key: String(i), cells: [`Організація ${i}`, `Товар ${i}`, `${i},25`], subtotal: i === 0 }))
const view = (rows = lines) => <MantineProvider env="test"><I18nProvider>
  <OriginalSalesGrid lines={rows} headers={['Організація', 'Товар', 'Сума']} totals={['1275,75']} />
</I18nProvider></MantineProvider>
it('pages the rows while retaining the full total and clamps the page when the result shrinks', () => {
  const rendered = render(view())
  expect(screen.getByRole('navigation', { name: 'Сторінки звіту' }).textContent).toContain('1–50 із 51')
  expect((screen.getByRole('button', { name: 'Попередні рядки' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByRole('cell', { name: 'Товар 50' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Наступні рядки' }))
  expect(screen.getByRole('cell', { name: 'Товар 50' })).toBeTruthy()
  expect(screen.queryByRole('cell', { name: 'Товар 0' })).toBeNull()
  expect(screen.getByRole('navigation').textContent).toContain('51–51 із 51')
  expect(screen.getByRole('cell', { name: '1275,75' })).toBeTruthy()
  rendered.rerender(view(lines.slice(0, 1)))
  expect(screen.getByRole('navigation').textContent).toContain('1–1 із 1')
  const row = screen.getByRole('cell', { name: 'Товар 0' }).closest('tr')!
  expect(row.hasAttribute('data-subtotal')).toBe(true)
  expect(within(row).getByRole('cell', { name: '0,25' }).className).toContain('app-table-cell-number')
  rendered.rerender(view([]))
  expect(screen.getByRole('navigation').textContent).toContain('0 рядків')
  expect((screen.getByRole('button', { name: 'Наступні рядки' }) as HTMLButtonElement).disabled).toBe(true)
})
