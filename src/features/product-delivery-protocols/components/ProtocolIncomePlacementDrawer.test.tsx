import { fireEvent, screen, within } from '@testing-library/react'
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
})
