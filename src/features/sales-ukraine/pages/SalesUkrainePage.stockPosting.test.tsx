import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getSaleStockPostingMarker } from '../saleStatus'
import { SaleSummaryDrawer } from './SalesUkrainePage'
import type { SalesUkraineSale } from '../types'

vi.mock('../../../shared/ui/data-table/useElementClientWidth', () => ({ useElementClientWidth: () => 1000 }))

vi.mock('../../../shared/ui/AppDrawer', () => ({ AppDrawer: ({ children }: { children: ReactNode }) => <div>{children}</div> }))

const invoice: SalesUkraineSale = {
  NetUid: 'sale-36',
  BaseLifeCycleStatus: { SaleLifeCycleType: 1 },
  ClientAgreement: { Agreement: { Currency: { Code: 'UAH' } } },
  IsAcceptedToPacking: true,
  Order: { OrderItems: [{ NetUid: 'line', Qty: 5, TotalAmountLocal: 4864, Product: { Name: 'Фільтр', VendorCode: 'QA-FLT-003' } }] },
  SaleNumber: { Value: 'QAUНо00000036' },
  TotalAmountLocal: 4864,
}

function mount(value: SalesUkraineSale) {
  render(<MantineProvider><I18nProvider><SaleSummaryDrawer opened sale={value} onClose={() => {}} /></I18nProvider></MantineProvider>)
}

describe('stock posting marker of an invoice', () => {
  it('is absent for a posted invoice and for unknown states', () => {
    expect(getSaleStockPostingMarker({})).toBeNull()
    expect(getSaleStockPostingMarker({ StockPostingState: null, StockPostingReason: 'InsufficientStock' })).toBeNull()
    expect(getSaleStockPostingMarker({ StockPostingState: 'Done' })).toBeNull()
  })

  it('words a pending posting as a warning with its reason', () => {
    expect(getSaleStockPostingMarker({ StockPostingState: 'Pending' })).toEqual({
      hint: 'Складське списання за накладною ще в черзі. Резерв утримується, собівартості немає, повернення за накладною недоступне. Проведення повторюється автоматично.',
      label: 'Складське проведення не завершено',
      tone: 'warning',
    })
    expect(getSaleStockPostingMarker({ StockPostingState: 'Pending', StockPostingReason: 'InsufficientStock' })?.hint)
      .toContain('на складах, з яких дозволено списання за цим договором, не вистачає залишку')
  })

  it('words a dead posting as a failure and never shows the technical text', () => {
    const marker = getSaleStockPostingMarker({ StockPostingState: 'Failed', StockPostingReason: 'PricingUnavailable' })

    expect(marker?.label).toBe('Складське проведення не виконано')
    expect(marker?.tone).toBe('danger')
    expect(marker?.hint).toContain('для позиції не визначено ціну за договором')
    expect(marker?.hint).toContain('зверніться до адміністратора')
    expect(getSaleStockPostingMarker({ StockPostingState: 'Failed', StockPostingReason: 'Other' })?.hint)
      .toMatch(/^Товар за накладною не списано з партій\./)
    expect(getSaleStockPostingMarker({ StockPostingState: 'Failed', StockPostingReason: 'ShiftWithoutMovement' })?.hint)
      .toContain('Акт зсуву не проведено по складу')
  })

  it('shows the marker on the sale card of an invoice whose stock posting failed', () => {
    mount({ ...invoice, StockPostingState: 'Failed', StockPostingReason: 'InsufficientStock' })

    const pill = screen.getByText('Складське проведення не виконано')

    expect(pill.className).toContain('is-red')
    expect(pill.getAttribute('aria-label')).toContain('не вистачає залишку')
  })

  it('shows a warning on the sale card while the posting is pending and nothing for a posted invoice', () => {
    mount({ ...invoice, StockPostingState: 'Pending' })
    expect(screen.getByText('Складське проведення не завершено').className).toContain('is-orange')
  })

  it('keeps the sale card of a posted invoice unmarked', () => {
    mount(invoice)
    expect(screen.queryByText('Складське проведення не завершено')).toBeNull()
    expect(screen.queryByText('Складське проведення не виконано')).toBeNull()
  })
})
