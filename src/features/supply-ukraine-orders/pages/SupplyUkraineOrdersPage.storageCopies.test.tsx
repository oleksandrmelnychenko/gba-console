import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { DirectSupplyOrder, SupplyUkraineOrderRow } from '../types'
import { OrderActionsModal } from './SupplyUkraineOrdersPage'

vi.mock('../components/DirectOrderProductIncomeStatus', () => ({
  DirectOrderProductIncomeStatus: ({ orderNetId }: { orderNetId?: string }) => <div data-testid="income-status">{orderNetId}</div>,
  DirectOrderIncomeStorageChip: () => null,
}))

const ALL_ACTIONS = {
  canOpenDirectInvoices: true,
  canOpenDirectLogistics: true,
  canOpenDirectProductIncome: true,
  canOpenDirectSpecifications: true,
  canOpenToUkraineOfficialCosts: true,
  canOpenToUkrainePlacement: true,
  canOpenToUkraineProtocols: true,
  canOpenToUkraineView: true,
}

function renderActions(order: DirectSupplyOrder) {
  const onNavigate = vi.fn()
  const row: SupplyUkraineOrderRow = {
    directOrder: order,
    index: 1,
    kind: 'direct',
    netUid: order.NetUid,
    number: order.SupplyOrderNumber?.Number,
  }

  render(
    <MantineProvider>
      <I18nProvider>
        <OrderActionsModal
          permissions={ALL_ACTIONS}
          row={row}
          onClose={() => undefined}
          onNavigate={onNavigate}
          onOpenOfficialCosts={() => undefined}
        />
      </I18nProvider>
    </MantineProvider>,
  )

  return onNavigate
}

describe('one row per 1C document in the supply-order list', () => {
  it('opens the lines of every storage copy from one row, each under its storage', () => {
    const onNavigate = renderActions({
      HasArrivedDeliveryProtocol: false,
      ImportedStorageName: 'СКЛАД -3',
      NetUid: 'copy-3',
      SupplyInvoices: [
        { ImportedStorageName: 'СКЛАД -3', Number: 'К0000000392', SupplyOrderHasArrivedDeliveryProtocol: false, SupplyOrderNetUid: 'copy-3' },
        { ImportedStorageName: 'СКЛАД -1', Number: 'К0000000392', SupplyOrderHasArrivedDeliveryProtocol: true, SupplyOrderNetUid: 'copy-1' },
      ],
      SupplyOrderNumber: { Number: 'К0000000392' },
    })

    expect(screen.getByText('Склад: СКЛАД -3')).toBeTruthy()
    expect(screen.getByText('Склад: СКЛАД -1')).toBeTruthy()
    expect(screen.getAllByTestId('income-status').map((node) => node.textContent)).toEqual(['copy-3', 'copy-1'])

    const secondCopy = screen.getByText('Склад: СКЛАД -1').closest('.supply-order-actions-storage') as HTMLElement
    fireEvent.click(within(secondCopy).getByRole('button', { name: 'Товари' }))
    expect(onNavigate).toHaveBeenCalledWith('/orders/ukraine/all/edit/copy-1/supply-invoices')

    fireEvent.click(within(secondCopy).getByRole('button', { name: 'Оприходування' }))
    expect(onNavigate).toHaveBeenCalledWith('/orders/ukraine/all/edit/copy-1/product-income')
    expect(screen.getAllByRole('button', { name: 'Товари' })).toHaveLength(2)
    const firstCopy = screen.getByText('Склад: СКЛАД -3').closest('.supply-order-actions-storage') as HTMLElement
    expect(within(firstCopy).queryByRole('button', { name: 'Оприходування' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Оприходування' })).toHaveLength(1)
  })

  it('keeps the single set of actions for an order held in one storage', () => {
    const onNavigate = renderActions({
      ImportedStorageName: 'СКЛАД -3',
      NetUid: 'order-1',
      SupplyInvoices: [{ ImportedStorageName: 'СКЛАД -3', Number: 'INV-1', SupplyOrderNetUid: 'order-1' }],
      SupplyOrderNumber: { Number: 'К-1' },
    })

    expect(screen.queryByText(/^Склад:/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Товари' }))
    expect(onNavigate).toHaveBeenCalledWith('/orders/ukraine/all/edit/order-1/supply-invoices')
  })
})
