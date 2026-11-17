import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import type { DynamicProductPlacement, PlacementGridRow } from '../placementsTypes'
import { WarehouseUkraineOrderPlacementsPage } from './WarehouseUkraineOrderPlacementsPage'

const apiMocks = vi.hoisted(() => ({
  createIncome: vi.fn(),
  getOrder: vi.fn(),
  getReceivedStorage: vi.fn(),
  getStorages: vi.fn(),
  savePlacementRow: vi.fn(),
  updateOrder: vi.fn(),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('../api/orderPlacementsApi', () => ({
  createProductIncomeFromDynamicPlacements: apiMocks.createIncome,
  getNonDefectiveStorages: apiMocks.getStorages,
  getOrderReceivedStorageNetId: apiMocks.getReceivedStorage,
  getSupplyOrderUkraineById: apiMocks.getOrder,
  saveDynamicPlacementRow: apiMocks.savePlacementRow,
  updateSupplyOrderUkraine: apiMocks.updateOrder,
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer, opened, title }: {
    children: ReactNode
    footer?: ReactNode
    opened: boolean
    title?: ReactNode
  }) => opened ? <section>{title}{children}{footer}</section> : null,
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModalFooter: ({ children }: { children: import('react').ReactNode }) => <div>{children}</div>,
  AppModal: ({ children, opened, title }: { children: ReactNode; opened: boolean; title?: ReactNode }) =>
    opened ? <section>{title}{children}</section> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ columns, data }: {
    columns: DataTableColumn<PlacementGridRow>[]
    data: PlacementGridRow[]
  }) => (
    <div>
      {data.map((row) => (
        <div key={row.item.Id}>
          {columns.map((column) => (
            <div key={column.id}>{typeof column.cell === 'function' ? column.cell(row) : null}</div>
          ))}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('../components/PlacementEditDrawer', () => ({
  PlacementEditDrawer: ({ opened, onApply }: {
    opened: boolean
    onApply: (placements: DynamicProductPlacement[]) => void
  }) => opened ? (
    <button
      type="button"
      onClick={() => onApply([{
        CellNumber: 'CELL',
        DynamicProductPlacementRowId: 31,
        Id: 41,
        IsApplied: false,
        Qty: 4,
        RowNumber: 'ROW',
        StorageNumber: 'STOR',
      }])}
    >
      apply edited placement
    </button>
  ) : null,
}))

function renderPage() {
  return render(
    <MantineProvider env="test">
      <I18nProvider>
        <MemoryRouter initialEntries={['/orders/ukraine/placement/order-1']}>
          <Routes>
            <Route path="/orders/ukraine/placement/:id" element={<WarehouseUkraineOrderPlacementsPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('WarehouseUkraineOrderPlacementsPage', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset())

    apiMocks.getOrder.mockResolvedValue({
      Id: 1,
      NetUid: 'order-1',
      IsPlaced: false,
      SupplyOrderUkraineItems: [{
        Id: 11,
        NetUid: 'item-1',
        Qty: 4,
        PlacedQty: 0,
        Product: { VendorCode: 'SKU-1' },
      }],
      DynamicProductPlacementColumns: [{
        Id: 21,
        NetUid: 'column-1',
        FromDate: '2026-08-15',
        SupplyOrderUkraineId: 1,
        DynamicProductPlacementRows: [{
          Id: 31,
          NetUid: 'row-1',
          Qty: 4,
          SupplyOrderUkraineItemId: 11,
          DynamicProductPlacementColumnId: 21,
          DynamicProductPlacements: [{
            Id: 41,
            DynamicProductPlacementRowId: 31,
            Qty: 4,
            StorageNumber: 'N',
            RowNumber: 'N',
            CellNumber: 'N',
            IsApplied: false,
          }],
        }],
      }],
    })
    /* The order was already partly received to «Основний», which is not the first storage of the list. */
    apiMocks.getStorages.mockResolvedValue([
      { Id: 50, NetUid: 'storage-other', Name: 'Чужий склад' },
      { Id: 51, NetUid: 'storage-1', Name: 'Основний' },
    ])
    apiMocks.getReceivedStorage.mockResolvedValue('storage-1')
    apiMocks.savePlacementRow.mockImplementation(async (row) => row)
    apiMocks.createIncome.mockImplementation(async (order) => order)
  })

  it('persists an edited placement row before using it for product income', async () => {
    renderPage()

    expect(await screen.findByText('SKU-1')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Оприходування' }))
    fireEvent.click(screen.getByRole('button', { name: 'apply edited placement' }))

    await waitFor(() => expect(apiMocks.savePlacementRow).toHaveBeenCalledTimes(1))
    expect(apiMocks.savePlacementRow).toHaveBeenCalledWith(expect.objectContaining({
      Id: 31,
      Qty: 4,
      SupplyOrderUkraineItemId: 11,
      DynamicProductPlacementColumnId: 21,
      DynamicProductPlacements: [expect.objectContaining({
        Id: 41,
        StorageNumber: 'STOR',
        RowNumber: 'ROW',
        CellNumber: 'CELL',
        Qty: 4,
      })],
    }))
    expect(apiMocks.updateOrder).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Оприходувати' }))
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))

    await waitFor(() => expect(apiMocks.createIncome).toHaveBeenCalledTimes(1))
    const incomeOrder = apiMocks.createIncome.mock.calls[0][0]
    expect(incomeOrder.DynamicProductPlacementColumns[0].DynamicProductPlacementRows[0])
      .toEqual(expect.objectContaining({
        Id: 31,
        DynamicProductPlacements: [expect.objectContaining({
          StorageNumber: 'STOR',
          RowNumber: 'ROW',
          CellNumber: 'CELL',
          Qty: 4,
        })],
      }))
  })

  it('shows an unfinished order as not incomed', async () => {
    renderPage()

    expect(await screen.findByText('Не оприходувано')).toBeTruthy()
  })

  it('shows a completed product income as incomed instead of placed', async () => {
    apiMocks.getOrder.mockResolvedValue({
      Id: 1,
      NetUid: 'order-1',
      IsPlaced: true,
      SupplyOrderUkraineItems: [],
      DynamicProductPlacementColumns: [],
    })

    renderPage()

    expect(await screen.findByText('Оприходувано')).toBeTruthy()
    expect(screen.queryByText('Розміщено')).toBeNull()
  })

  it('keeps the editor open when the server does not confirm persisted placements', async () => {
    apiMocks.savePlacementRow.mockResolvedValueOnce({
      Id: 31,
      Qty: 4,
      SupplyOrderUkraineItemId: 11,
      SupplyOrderUkraineItem: { Id: 11 },
      DynamicProductPlacementColumnId: 21,
      DynamicProductPlacements: [],
    })
    renderPage()

    expect(await screen.findByText('SKU-1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Оприходування' }))
    fireEvent.click(screen.getByRole('button', { name: 'apply edited placement' }))

    expect(await screen.findByText('Сервер не підтвердив збереження розміщення')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'apply edited placement' })).toBeTruthy()
    expect(apiMocks.updateOrder).not.toHaveBeenCalled()
    expect(apiMocks.createIncome).not.toHaveBeenCalled()
  })

  it('shows «Замовлення не знайдено» without «Оприходувати» when the server returns an empty body', async () => {
    apiMocks.getOrder.mockResolvedValue({ DynamicProductPlacementColumns: [], SupplyOrderUkraineItems: [] })
    renderPage()

    expect(await screen.findByText('Замовлення не знайдено')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Оприходувати' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Провести' })).toBeNull()
    expect(screen.queryByText('Не оприходувано')).toBeNull()
  })

  it('closes the confirm and shows the server reason when product income fails', async () => {
    apiMocks.createIncome.mockRejectedValue(new Error('Помилка сервера. Нова сутність недопустима.'))
    renderPage()

    expect(await screen.findByText('SKU-1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Оприходувати' }))
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))

    expect(await screen.findByText('Помилка сервера. Нова сутність недопустима.')).toBeTruthy()
    expect(screen.queryByText('Ви впевнені?')).toBeNull()
    expect(apiMocks.createIncome).toHaveBeenCalledTimes(1)
  })

  it('posts the income once while the reloaded order has not arrived yet', async () => {
    renderPage()
    expect(await screen.findByText('SKU-1')).toBeTruthy()

    const openOrder = await apiMocks.getOrder.mock.results[0].value
    let resolveReload: (order: unknown) => void = () => {}
    apiMocks.getOrder.mockImplementationOnce(() => new Promise((resolve) => { resolveReload = resolve }))

    fireEvent.click(screen.getByRole('button', { name: 'Оприходувати' }))
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
    await waitFor(() => expect(apiMocks.createIncome).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(apiMocks.getOrder).toHaveBeenCalledTimes(2))

    fireEvent.click(screen.getByRole('button', { name: 'Оприходувати' }))
    const confirm = screen.queryByRole('button', { name: 'Підтвердити' })
    if (confirm) {
      fireEvent.click(confirm)
    }

    expect(apiMocks.createIncome).toHaveBeenCalledTimes(1)
    resolveReload({ ...openOrder, IsPlaced: true })
    expect(await screen.findByText('Оприходувано')).toBeTruthy()
  })

  it('sends the rest of a partly received order to the storage it was received to, not the first of the list', async () => {
    renderPage()
    expect(await screen.findByText('SKU-1')).toBeTruthy()

    expect(apiMocks.getReceivedStorage).toHaveBeenCalledWith('order-1')
    fireEvent.click(screen.getByRole('button', { name: 'Оприходувати' }))
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))

    await waitFor(() => expect(apiMocks.createIncome).toHaveBeenCalledTimes(1))
    expect(apiMocks.createIncome.mock.calls[0]?.[2]).toBe('storage-1')
  })

  it('preselects no storage for an order that was not received yet and keeps the income actions disabled', async () => {
    apiMocks.getReceivedStorage.mockResolvedValue(null)
    renderPage()
    expect(await screen.findByText('SKU-1')).toBeTruthy()

    const receive = screen.getByRole('button', { name: 'Оприходувати' }) as HTMLButtonElement
    const post = screen.getByRole('button', { name: 'Провести' }) as HTMLButtonElement
    expect(receive.disabled).toBe(true)
    expect(post.disabled).toBe(true)
    expect(screen.getByPlaceholderText('Оберіть склад')).toBeTruthy()

    fireEvent.click(receive)
    expect(screen.queryByRole('button', { name: 'Підтвердити' })).toBeNull()
    expect(apiMocks.createIncome).not.toHaveBeenCalled()
  })
})
