import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { renderWithMantine } from '../../../test/renderWithMantine'
import type { DynamicProductPlacementRow, PackingListPackageOrderItem } from '../productIncomeTypes'
import { ProtocolIncomePlacementDrawer } from './ProtocolIncomePlacementDrawer'

const item: PackingListPackageOrderItem = {
  Id: 10,
  Qty: 12,
  SupplyInvoiceOrderItem: {
    Product: {
      NameUA: 'Тестовий товар',
      VendorCode: 'SKU-10',
    },
  },
}

const row: DynamicProductPlacementRow = {
  Id: 20,
  Qty: 7,
  PackingListPackageOrderItemId: item.Id,
  DynamicProductPlacements: [
    {
      Id: 30,
      CellNumber: '3',
      Qty: 7,
      RowNumber: '2',
      StorageNumber: '1',
    },
  ],
}

describe('ProtocolIncomePlacementDrawer', () => {
  it('keeps entered quantity visible in a fixed-width quantity column', () => {
    renderWithMantine(
      <I18nProvider>
        <ProtocolIncomePlacementDrawer
          columnId="column-1"
          item={item}
          maxQty={12}
          opened
          row={row}
          selectedStorage={null}
          onApply={vi.fn()}
          onClose={vi.fn()}
        />
      </I18nProvider>,
    )

    const quantityColumn = document.querySelector<HTMLElement>('.protocol-income-placement-qty-column')
    expect(quantityColumn).not.toBeNull()
    if (!quantityColumn) {
      throw new Error('Quantity column was not rendered')
    }

    expect(quantityColumn.style.width).toBe('96px')
    expect(quantityColumn.closest('.protocol-income-placement-table')).not.toBeNull()

    fireEvent.click(screen.getByText('7'))

    const quantityInput = screen.getByLabelText('Кількість')
    fireEvent.change(quantityInput, { target: { value: '9' } })
    expect((quantityInput as HTMLInputElement).value).toBe('9')

    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    const placementRow = screen.getByText('9').closest('tr')
    expect(placementRow).not.toBeNull()
    expect(
      within(placementRow as HTMLTableRowElement).getByText('9').classList.contains('protocol-income-placement-qty-cell'),
    ).toBe(true)
    expect(screen.queryByText('Не вказано')).toBeNull()
    expect(document.querySelector<HTMLElement>('.protocol-income-placement-qty-column')?.style.width).toBe('96px')
  })
  it('keeps the whole partially received row read-only and explains the remaining-quantity workflow', () => {
    const onApply = vi.fn()
    const applied = { ...row.DynamicProductPlacements[0], Qty: 20, IsApplied: true }
    const pending = { Qty: 40, StorageNumber: '5', RowNumber: '5', CellNumber: '5', IsApplied: false }
    renderWithMantine(<I18nProvider><ProtocolIncomePlacementDrawer
      opened columnId="column-1" item={{ ...item, Qty: 60, PlacedQty: 20 }}
      maxQty={60} row={{ ...row, Qty: 60, DynamicProductPlacements: [applied, pending] }}
      selectedStorage={null} onApply={onApply} onClose={vi.fn()}
    /></I18nProvider>)

    expect(screen.getByRole('alert').textContent).toContain('Для решти товару додайте нову колонку')
    fireEvent.click(screen.getByText('40'))
    expect(screen.queryByLabelText('Кількість')).toBeNull()
    expect(screen.queryByTestId('placement-apply')).toBeNull()
    expect(screen.queryByTestId('placement-add-draft')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Видалити' })).toBeNull()
    expect(onApply).not.toHaveBeenCalled()
  })

  it('saves an unapplied 20 + 40 split preserving the persisted identity and the new address', () => {
    const onApply = vi.fn()
    const first = { Id: 44958, Qty: 20, StorageNumber: '4', RowNumber: '4', CellNumber: '4', IsApplied: false }
    renderWithMantine(<I18nProvider><ProtocolIncomePlacementDrawer
      opened columnId="column-1" item={{ ...item, Qty: 60 }} maxQty={60}
      row={{ ...row, Qty: 20, DynamicProductPlacements: [first] }}
      selectedStorage={null} onApply={onApply} onClose={vi.fn()}
    /></I18nProvider>)
    fireEvent.click(screen.getByTestId('placement-add-draft'))
    expect((screen.getByLabelText('Кількість') as HTMLInputElement).value).toBe('40')
    for (const label of ['Склад', 'Ряд', 'Полиця']) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: '5' } })
    }
    fireEvent.click(screen.getByTestId('placement-accept-draft'))
    fireEvent.click(screen.getByTestId('placement-apply'))
    expect(onApply).toHaveBeenCalledExactlyOnceWith([
      first,
      { Qty: 40, StorageNumber: '5', RowNumber: '5', CellNumber: '5', IsApplied: false },
    ])
  })

})
