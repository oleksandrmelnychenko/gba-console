import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { DirectSupplyOrder, SupplyUkraineOrderRow } from '../types'
import { OrderActionsModal } from './SupplyUkraineOrdersPage'

const ALL_DIRECT_ACTIONS = {
  canOpenDirectInvoices: true,
  canOpenDirectLogistics: true,
  canOpenDirectProductIncome: true,
  canOpenDirectSpecifications: true,
  canOpenToUkraineOfficialCosts: true,
  canOpenToUkrainePlacement: true,
  canOpenToUkraineProtocols: true,
  canOpenToUkraineView: true,
}

function createDirectRow(order: DirectSupplyOrder): SupplyUkraineOrderRow {
  return {
    directOrder: order,
    index: 1,
    kind: 'direct',
    netUid: order.NetUid,
    number: order.SupplyOrderNumber?.Number,
    supplier: order.Client?.Name,
  }
}

function renderActions(order: DirectSupplyOrder) {
  const onNavigate = vi.fn()

  render(
    <MantineProvider>
      <I18nProvider>
        <OrderActionsModal
          permissions={ALL_DIRECT_ACTIONS}
          row={createDirectRow(order)}
          onClose={() => undefined}
          onNavigate={onNavigate}
          onOpenOfficialCosts={() => undefined}
        />
      </I18nProvider>
    </MantineProvider>,
  )

  return onNavigate
}

describe('BUG-1187 direct-order review workflow', () => {
  it('opens the order products before a proforma exists', () => {
    const onNavigate = renderActions({
      Client: { Name: 'SETFREN OTOMOTIV' },
      NetUid: '5c4de72c-471a-465d-a05b-77ce00726b96',
      SupplyInvoices: [],
      SupplyOrderNumber: { Number: '00000002413' },
      SupplyProForm: null,
      SupplyProFormId: null,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Товари' }))

    expect(onNavigate).toHaveBeenCalledWith(
      '/orders/ukraine/all/edit/5c4de72c-471a-465d-a05b-77ce00726b96/supply-invoices',
    )
    expect(screen.queryByRole('button', { name: 'Специфікації' })).toBeNull()
  })

  it('keeps products and post-proforma actions available after the proforma is saved', () => {
    renderActions({
      Client: { Name: 'SETFREN OTOMOTIV' },
      NetUid: '5c4de72c-471a-465d-a05b-77ce00726b96',
      SupplyInvoices: [],
      SupplyOrderNumber: { Number: '00000002413' },
      SupplyProForm: { Id: 17, Number: 'PF-17' },
      SupplyProFormId: 17,
    })

    expect(screen.getByRole('button', { name: 'Товари' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Специфікації' })).toBeTruthy()
  })
})
