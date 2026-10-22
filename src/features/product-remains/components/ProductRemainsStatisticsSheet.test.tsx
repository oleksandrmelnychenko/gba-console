import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { ProductRemainsStatisticsSheet } from './ProductRemainsStatisticsSheet'

const totals = {
  TotalQty: 120, TotalQtyFiltered: 12,
  TotalAmount: 100, AccountingTotalAmount: 90,
  TotalAmountLocal: 4000, AccountingTotalAmountLocal: 3600,
  TotalAmountFiltered: 10, AccountingTotalAmountFiltered: 9,
  TotalAmountLocalFiltered: 400, AccountingTotalAmountLocalFiltered: 360,
}

function renderSheet(props: Partial<React.ComponentProps<typeof ProductRemainsStatisticsSheet>> = {}) {
  return render(
    <MantineProvider><I18nProvider>
      <ProductRemainsStatisticsSheet opened onClose={() => {}} totals={totals} kind="batches"
        dateFrom="2026-10-01" dateTo="2026-10-22" isLoading={false} error={null} {...props} />
    </I18nProvider></MantineProvider>,
  )
}

describe('ProductRemainsStatisticsSheet', () => {
  it('keeps overall and filtered amounts in their own currency and accounting columns', () => {
    renderSheet()
    const allRows = within(screen.getByRole('table', { name: 'Усі залишки' })).getAllByRole('row')
    const periodRows = within(screen.getByRole('table', { name: 'За вибраний період' })).getAllByRole('row')
    expect(within(allRows[1]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['100,00', '90,00'])
    expect(within(allRows[2]).getAllByRole('cell').map(cell => cell.textContent?.replace(/\s/g, ''))).toEqual(['4000,00', '3600,00'])
    expect(within(periodRows[1]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['10,00', '9,00'])
    expect(within(periodRows[2]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['400,00', '360,00'])
    expect(screen.getByText('120')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('01.10.2026 — 22.10.2026')).toBeTruthy()
  })

  it('preserves unavailable products period UAH totals and distinguishes zero from missing', () => {
    renderSheet({ kind: 'products', totals: { ...totals, TotalAmount: 0, AccountingTotalAmount: undefined } })
    const allRows = within(screen.getByRole('table', { name: 'Усі залишки' })).getAllByRole('row')
    const periodRows = within(screen.getByRole('table', { name: 'За вибраний період' })).getAllByRole('row')
    expect(within(allRows[1]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['0,00', '-'])
    expect(within(periodRows[2]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['-', '360,00'])
  })

  it('hides stale totals while new filters are loading', () => {
    renderSheet({ isLoading: true })
    expect(screen.getByRole('status', { name: 'Завантаження статистики' })).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
