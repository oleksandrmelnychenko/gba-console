import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { DataTable } from '../../../../shared/ui/data-table/DataTable'
import type { SalesUkraineOrderItem } from '../../types'
import { WizardShoppingCartGrid } from './WizardShoppingCartGrid'

function renderWithProviders(content: ReactNode) {
  return render(
    <MantineProvider env="test">
      <I18nProvider>{content}</I18nProvider>
    </MantineProvider>,
  )
}

describe('WizardShoppingCartGrid toolbar', () => {
  beforeEach(() => {
    // Fill-width tables wait for a viewport measurement; jsdom has no layout.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1600)
  })
  afterEach(() => vi.restoreAllMocks())

  it.each([false, true])('omits the standalone columns button when populated=%s, retaining header controls', (populated) => {
    const items: SalesUkraineOrderItem[] = populated ? [{
      NetUid: 'cart-row-1',
      Product: { NameUA: 'Амортизатор', VendorCode: 'KI00085' },
      Qty: 2,
      TotalAmount: 48.96,
    }] : []
    const view = renderWithProviders(<WizardShoppingCartGrid items={items} localCurrencyCode="UAH" useEurToUah />)
    expect(view.container.querySelector('.data-table-toolbar')).toBeNull()
    const productHeader = within(screen.getByRole('columnheader', { name: /^Товар/ }))
    expect(productHeader.getByLabelText('Колонки')).toBeTruthy()
    expect(productHeader.getByRole('button', { name: /^Товар.*Сортувати за зростанням$/ })).toBeTruthy()
    expect(productHeader.getByLabelText('Змінити ширину колонки')).toBeTruthy()
    expect(screen.getByText(populated ? 'Амортизатор' : 'Кошик порожній')).toBeTruthy()
  })

  it('leaves the toolbar enabled by default for other tables', () => {
    const view = renderWithProviders(
      <DataTable
        columns={[{ id: 'name', header: 'Товар', accessor: (row: { name: string }) => row.name }]}
        data={[]}
        tableId="default-toolbar-test"
      />,
    )
    const toolbar = view.container.querySelector('.data-table-toolbar')
    expect(toolbar).toBeTruthy()
    expect(within(toolbar as HTMLElement).getByRole('button', { name: 'Колонки' })).toBeTruthy()
  })
})
