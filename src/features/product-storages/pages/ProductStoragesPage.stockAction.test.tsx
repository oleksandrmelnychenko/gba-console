import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  createProductStorageSupplyReturn,
  createProductStorageTransfer,
  createProductStorageWriteOff,
  getAvailableProductsByStorage,
  getProductStorageAvailableConsignments,
  getProductStorageStorages,
} from '../api/productStoragesApi'
import { ProductStoragesPage } from './ProductStoragesPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
    user: null,
  }),
}))

vi.mock('../api/productStoragesApi', () => ({
  createProductStorageSupplyReturn: vi.fn(),
  createProductStorageTransfer: vi.fn(),
  createProductStorageWriteOff: vi.fn(),
  exportProductStorageAvailability: vi.fn(),
  getAvailableProductsByStorage: vi.fn(),
  getProductStorageAvailableConsignments: vi.fn(),
  getProductStorageStorages: vi.fn(),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer, opened }: { children: ReactNode; footer?: ReactNode; opened: boolean }) =>
    opened ? <section>{children}{footer}</section> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ columns = [], data = [], tableId }: {
    columns?: Array<{ cell?: (row: unknown) => ReactNode; id: string }>
    data?: unknown[]
    tableId?: string
  }) => (
    <div data-testid={tableId || 'data-table'}>
      {tableId === 'product-storages' && data[0]
        ? columns.find((column) => column.id === 'actions')?.cell?.(data[0])
        : null}
    </div>
  ),
}))

vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: () => null,
}))

vi.mock('../../../shared/ui/paginator/Paginator', () => ({
  Paginator: () => null,
}))

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <ProductStoragesPage />
      </I18nProvider>
    </MantineProvider>,
  )
}

function availabilityOf(unit: string, qty: number) {
  return {
    items: [{
      NetUid: 'availability-1',
      Product: { MeasureUnit: { Name: unit }, Name: 'Фільтр', NetUid: 'product-1', VendorCode: 'QA-FLT-001' },
      Qty: qty,
      Storage: { Name: 'Основний склад', NetUid: 'storage-1', Organization: { Id: 1, Name: 'Організація 1' } },
    }],
    totalQty: 1,
  }
}

describe('Product storages stock operation dialog', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.Storages.Page.View)
    allowedPermissions.add(PermissionKeys.WarehouseAccounting.Storages.PositionAction.Management)
    vi.clearAllMocks()
    vi.mocked(getProductStorageStorages).mockResolvedValue([
      { Name: 'Основний склад', NetUid: 'storage-1', Organization: { Id: 1, Name: 'Організація 1' } },
      { Name: 'Інший склад', NetUid: 'storage-2', Organization: { Id: 1, Name: 'Організація 1' } },
    ])
    vi.mocked(getAvailableProductsByStorage).mockResolvedValue(availabilityOf('шт', 124))
    vi.mocked(createProductStorageTransfer).mockResolvedValue(undefined)
    vi.mocked(createProductStorageWriteOff).mockResolvedValue(undefined)
    vi.mocked(createProductStorageSupplyReturn).mockResolvedValue(undefined)
  })

  async function openDialog() {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Операція зі складської позиції' }))

    return screen.getByRole('textbox', { name: /Кількість/ }) as HTMLInputElement
  }

  it('starts with an empty quantity and does nothing without one', async () => {
    const quantity = await openDialog()

    expect(quantity.value).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Перемістити' }))
    expect(screen.queryByRole('button', { name: 'Так' })).toBeNull()
    expect(createProductStorageTransfer).not.toHaveBeenCalled()
  })

  it('keeps «1,5» as typed and refuses it for pieces; «-1» and more than available are refused too', async () => {
    const quantity = await openDialog()

    await userEvent.type(quantity, '1,5')
    expect(quantity.value).toBe('1,5')
    expect(screen.getByText('Для одиниці «шт» кількість має бути цілою')).toBeTruthy()

    await userEvent.clear(quantity)
    await userEvent.type(quantity, '-1')
    expect(screen.getByText('Кількість не може бути від’ємною')).toBeTruthy()

    await userEvent.clear(quantity)
    await userEvent.type(quantity, '1000')
    expect(screen.getByText('Більше, ніж доступно (124)')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Перемістити' }))
    expect(createProductStorageTransfer).not.toHaveBeenCalled()
  })

  it('writes off 1,5 kg only after the confirmation', async () => {
    vi.mocked(getAvailableProductsByStorage).mockResolvedValue(availabilityOf('кг', 10))
    const quantity = await openDialog()
    fireEvent.click(screen.getByRole('radio', { name: 'Списання' }))

    await userEvent.type(quantity, '1,5')
    fireEvent.click(screen.getByRole('button', { name: 'Списати' }))
    expect(createProductStorageWriteOff).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Так' }))

    await waitFor(() => expect(createProductStorageWriteOff).toHaveBeenCalled())
    expect(JSON.stringify(vi.mocked(createProductStorageWriteOff).mock.calls[0])).toContain('"Qty":1.5')
  })

  it('lists a lot repeated per supplier as separate rows and selects only the clicked one', async () => {
    vi.mocked(getProductStorageAvailableConsignments).mockResolvedValue([
      { ConsignmentItemId: 11, ProductIncomeNumber: 'QAU0000000002', RemainingQty: 5, Supplier: { Id: 1, FullName: 'Постачальник А' } },
      { ConsignmentItemId: 11, ProductIncomeNumber: 'QAU0000000002', RemainingQty: 5, Supplier: { Id: 2, FullName: 'Постачальник Б' } },
    ])
    await openDialog()
    fireEvent.click(screen.getByRole('radio', { name: 'Повернення постачальнику' }))

    const options = await screen.findAllByRole('button', { name: /QAU0000000002/ })
    expect(options).toHaveLength(2)
    fireEvent.click(options[1])

    expect(options[1].className).toContain('is-selected')
    expect(options[0].className).not.toContain('is-selected')
  })
})
