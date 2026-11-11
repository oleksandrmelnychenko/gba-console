import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getProtocolForProductIncome } from '../api/productDeliveryProtocolsApi'
import {
  createProductIncomeFromPackingListDynamic,
  getOrganizationStorages,
  getPackingListSpecificationProducts,
  getProductIncomeByDeliveryProtocolNetId,
  getSupplyOrderInvoiceItems,
  updatePackingListInInvoice,
  updateDynamicPlacementRow,
} from '../api/protocolProductIncomeApi'
import { ProductDeliveryProtocolIncomePage, ProductDeliveryProtocolIncomeSheet } from './ProductDeliveryProtocolIncomePage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../api/productDeliveryProtocolsApi', () => ({
  getProtocolForProductIncome: vi.fn(),
}))

vi.mock('../api/protocolProductIncomeApi', () => ({
  addDynamicPlacementRow: vi.fn(),
  createProductIncomeFromPackingListDynamic: vi.fn(),
  getOrganizationStorages: vi.fn(),
  getPackingListSpecificationProducts: vi.fn(),
  getProductIncomeByDeliveryProtocolNetId: vi.fn(),
  getProductIncomeBySupplyOrderNetId: vi.fn(),
  getPzDocumentBySupplyInvoiceId: vi.fn(),
  getSupplyOrderInvoiceItems: vi.fn(),
  markAllItemsReadyToPlace: vi.fn(),
  updateDynamicPlacementRow: vi.fn(),
  updatePackingListInInvoice: vi.fn(),
  updateVatOfPackListInvoiceItems: vi.fn(),
}))

vi.mock('../../supply-ukraine-orders/api/supplyUkraineOrdersApi', () => ({
  getDirectSupplyOrderForProductIncome: vi.fn(),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer, opened, title }: { children: ReactNode; footer: ReactNode; opened: boolean; title: ReactNode }) =>
    opened ? <section data-testid={title === 'Розміщення' ? 'placement-drawer' : 'income-sheet'}>{children}{footer}</section> : null,
  AppDrawerFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModalFooter: ({ children }: { children: import('react').ReactNode }) => <div>{children}</div>,
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) =>
    opened ? <section>{children}</section> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ data, columns }: { data: import('../productIncomeTypes').IncomeGridRow[]; columns: { id: string; header: ReactNode; cell: (row: import('../productIncomeTypes').IncomeGridRow) => ReactNode }[] }) => <div>
    {columns.filter(c => c.id.startsWith('dynamic-')).map(c => <section key={c.id}>{c.header}{data.map(row => <div key={row.item.Id}>{c.cell(row)}</div>)}</section>)}
  </div>,
}))

vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: () => null,
}))

vi.mock('../components/NewIncomeDynamicColumnModal', () => ({
  NewIncomeDynamicColumnModal: ({ disabled, opened, onAdd }: {
    disabled: boolean
    opened: boolean
    onAdd: (fromDate: string) => void
  }) => opened
    ? <button disabled={disabled} onClick={() => onAdd('2026-08-18')}>Підтвердити додавання</button>
    : null,
}))


const PACKING_LIST = {
  Id: 11,
  NetUid: 'pack-1',
  PackingListPackageOrderItems: [{
    Id: 111,
    IsReadyToPlaced: false,
    PlacedQty: 0,
    Qty: 60,
    SupplyInvoiceOrderItem: { Product: { Name: 'Товар', VendorCode: 'A-1' } },
  }],
  DynamicProductPlacementColumns: [{
    Id: 21,
    NetUid: 'column-1',
    FromDate: '2026-08-18',
    DynamicProductPlacementRows: [{
      Id: 44508, Qty: 20, PackingListPackageOrderItemId: 111, DynamicProductPlacementColumnId: 21,
      DynamicProductPlacements: [{ Id: 44958, Qty: 20, StorageNumber: '4', RowNumber: '4', CellNumber: '4', IsApplied: false }],
    }],
  }],
}

const INVOICE = {
  Id: 1,
  NetUid: 'invoice-1',
  Number: 'INV-1',
  PackingLists: [PACKING_LIST],
}

const PROTOCOL = {
  IsCompleted: true,
  NetUid: 'protocol-1',
  Organization: { NetUid: 'organization-1', Name: 'GBA' },
  SupplyInvoices: [INVOICE],
}

function renderPage(embedded = false) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/product-delivery-protocols/protocol-1/product-income']}>
          <Routes>
            <Route
              path="/product-delivery-protocols/:id/product-income"
              element={embedded ? <ProductDeliveryProtocolIncomeSheet sourceId="protocol-1" /> : <ProductDeliveryProtocolIncomePage />}
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('Product delivery protocol placement-to-receipt flow', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getProtocolForProductIncome).mockResolvedValue(PROTOCOL as never)
    vi.mocked(getProductIncomeByDeliveryProtocolNetId).mockResolvedValue(null)
    vi.mocked(getOrganizationStorages).mockResolvedValue([{ NetUid: 'storage-1', Name: 'Основний' }] as never)
    vi.mocked(getSupplyOrderInvoiceItems).mockResolvedValue(INVOICE as never)
    vi.mocked(getPackingListSpecificationProducts).mockResolvedValue(PACKING_LIST as never)
    vi.mocked(updatePackingListInInvoice).mockResolvedValue(INVOICE as never)
    vi.mocked(createProductIncomeFromPackingListDynamic).mockResolvedValue(PACKING_LIST as never)
  })

  it('passes the canonical saved 20+40 placement IDs into the outer capitalization request', async () => {
    for (const permission of [PermissionKeys.ProductDeliveryProtocols.ProductIncome.Open, PermissionKeys.ProductDeliveryProtocols.ProductIncome.EditPlacement, PermissionKeys.ProductDeliveryProtocols.ProductIncome.Capitalize]) allowedPermissions.add(permission)
    vi.mocked(updateDynamicPlacementRow).mockImplementation(async (_source, payload) => ({
      ...payload,
      DynamicProductPlacements: payload.DynamicProductPlacements.map((placement, index) => ({ ...placement, Id: placement.Id || 44958 + index })),
    }))
    renderPage()
    fireEvent.click(await screen.findByTestId('placement-cell'))
    fireEvent.click(screen.getByTestId('placement-add-draft'))
    for (const label of ['Склад', 'Ряд', 'Полиця']) fireEvent.change(within(screen.getByTestId("placement-drawer")).getByLabelText(label), { target: { value: '5' } })
    fireEvent.click(screen.getByTestId('placement-accept-draft'))
    fireEvent.click(screen.getByTestId('placement-apply'))
    await waitFor(() => expect(screen.getByTestId('placement-cell').getAttribute('data-placed-qty')).toBe('60'))
    fireEvent.click(screen.getByTestId('income-capitalize'))
    await waitFor(() => expect(createProductIncomeFromPackingListDynamic).toHaveBeenCalledOnce())
    const payload = vi.mocked(createProductIncomeFromPackingListDynamic).mock.calls[0][4]
    const savedRow = payload.DynamicProductPlacementColumns[0].DynamicProductPlacementRows[0]
    expect(savedRow.Qty).toBe(60)
    expect(savedRow.DynamicProductPlacements.map(p => [p.Id, p.Qty, p.StorageNumber])).toEqual([[44958, 20, '4'], [44959, 40, '5']])
    expect(updatePackingListInInvoice).not.toHaveBeenCalled()
  })

  it('blocks bulk edits and row edits after partial receipt, while allowing a new column', async () => {
    for (const permission of [PermissionKeys.ProductDeliveryProtocols.ProductIncome.Open, PermissionKeys.ProductDeliveryProtocols.ProductIncome.EditPlacement]) allowedPermissions.add(permission)
    const partial = structuredClone(PACKING_LIST)
    partial.PackingListPackageOrderItems[0].PlacedQty = 20
    partial.DynamicProductPlacementColumns[0].DynamicProductPlacementRows[0].DynamicProductPlacements[0].IsApplied = true
    vi.mocked(getPackingListSpecificationProducts).mockResolvedValue(partial as never)
    vi.mocked(getSupplyOrderInvoiceItems).mockResolvedValue({ ...INVOICE, PackingLists: [partial] } as never)
    renderPage()
    const cell = await screen.findByTestId('placement-cell')
    expect((screen.getByRole('button', { name: 'Перемістити залишки' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('income-add-column') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(cell)
    expect(screen.getByRole('alert').textContent).toContain('Для решти товару додайте нову колонку')
    expect(screen.queryByTestId('placement-apply')).toBeNull()
    expect(updateDynamicPlacementRow).not.toHaveBeenCalled()
  })

  it.each([
    { name: 'splits 222.6 into 20 plus the unassigned remainder', qty: '20', expected: [20, 202.6] },
    { name: 'preserves fractional quantity when only the address changes', qty: null, expected: [222.6] },
  ])('$name in the protocol income sheet and subsequent capitalization', async ({ qty, expected }) => {
    for (const permission of [PermissionKeys.ProductDeliveryProtocols.ProductIncome.Open, PermissionKeys.ProductDeliveryProtocols.ProductIncome.EditPlacement, PermissionKeys.ProductDeliveryProtocols.ProductIncome.Capitalize]) allowedPermissions.add(permission)
    const packingList = structuredClone(PACKING_LIST)
    const item = packingList.PackingListPackageOrderItems[0]
    item.Id = 5339226
    item.Qty = 222.6
    item.SupplyInvoiceOrderItem.Product.VendorCode = 'CH1110-SF'
    const row = packingList.DynamicProductPlacementColumns[0].DynamicProductPlacementRows[0]
    row.Id = 44528
    row.PackingListPackageOrderItemId = item.Id
    row.Qty = 222.6
    row.DynamicProductPlacements = [{ Id: 44977, Qty: 222.6, StorageNumber: 'N', RowNumber: 'N', CellNumber: 'N', IsApplied: false }]
    const invoice = { ...INVOICE, Number: '4412', PackingLists: [packingList] }
    vi.mocked(getSupplyOrderInvoiceItems).mockResolvedValue(invoice as never)
    vi.mocked(getPackingListSpecificationProducts).mockResolvedValue(packingList as never)
    vi.mocked(updateDynamicPlacementRow).mockImplementation(async (_source, payload) => ({
      ...payload,
      DynamicProductPlacements: payload.DynamicProductPlacements.map((placement, index) => ({ ...placement, Id: placement.Id || 50000 + index })),
    }))

    renderPage(true)
    fireEvent.click(await screen.findByTestId('placement-cell'))
    fireEvent.click(within(screen.getByTestId('placement-drawer')).getByText('222.6'))
    for (const [label, value] of [['Склад', '4454'], ['Ряд', 'N545'], ['Полиця', 'N545']]) {
      fireEvent.change(within(screen.getByTestId('placement-drawer')).getByLabelText(label), { target: { value } })
    }
    if (qty) fireEvent.change(screen.getByLabelText('Кількість'), { target: { value: qty } })
    fireEvent.click(screen.getByTestId('placement-accept-draft'))
    expect(screen.queryByText('Невірна кількість')).toBeNull()
    fireEvent.click(screen.getByTestId('placement-apply'))
    await waitFor(() => expect(updateDynamicPlacementRow).toHaveBeenCalledOnce())
    const payload = vi.mocked(updateDynamicPlacementRow).mock.calls[0][1]
    expect(payload.Qty).toBe(222.6)
    expect(payload.PackingListPackageOrderItem?.Qty).toBe(222.6)
    expect(payload.DynamicProductPlacements.map(p => p.Qty)).toEqual(expected)
    expect(payload.DynamicProductPlacements[0]).toMatchObject({ Id: 44977, StorageNumber: '4454', RowNumber: 'N545', CellNumber: 'N545' })
    if (qty) expect(payload.DynamicProductPlacements[1]).toMatchObject({ Qty: 202.6, StorageNumber: 'N', RowNumber: 'N', CellNumber: 'N', IsApplied: false })
    await waitFor(() => expect(screen.getByTestId('placement-cell').getAttribute('data-placed-qty')).toBe('222.6'))

    fireEvent.click(screen.getByTestId('placement-cell'))
    const drawer = within(screen.getByTestId('placement-drawer'))
    for (const value of expected) expect(drawer.getByText(String(value))).not.toBeNull()
    fireEvent.click(drawer.getByRole('button', { name: 'Скасувати' }))
    fireEvent.click(screen.getByTestId('income-capitalize'))
    await waitFor(() => expect(createProductIncomeFromPackingListDynamic).toHaveBeenCalledOnce())
    const saved = vi.mocked(createProductIncomeFromPackingListDynamic).mock.calls[0][4].DynamicProductPlacementColumns[0].DynamicProductPlacementRows[0]
    expect(saved.Qty).toBe(222.6)
    expect(saved.DynamicProductPlacements.map(p => [p.Id, p.Qty])).toEqual(expected.map((value, index) => [index ? 50000 + index : 44977, value]))
  })
})
