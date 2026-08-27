import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  addProductTransferFromFile,
  exportProductTransferDocument,
  getProductTransferByNetId,
  getProductTransfers,
  getProductTransferStorages,
} from '../api/productTransfersApi'
import { ProductTransfersPage } from './ProductTransfersPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/productTransfersApi', () => ({
  addProductTransferFromFile: vi.fn(),
  exportProductTransferDocument: vi.fn(),
  getProductTransferByNetId: vi.fn(),
  getProductTransfers: vi.fn(),
  getProductTransferStorages: vi.fn(),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ columns, data, onRowClick }: {
    columns: Array<{ cell?: (row: unknown) => ReactNode; id: string }>
    data: unknown[]
    onRowClick?: (row: unknown) => void
  }) => (
    <div>
      {data[0] && onRowClick ? (
        <button type="button" onClick={() => onRowClick(data[0])}>Відкрити рядок</button>
      ) : null}
      {data[0] ? columns.find((column) => column.id === 'actions')?.cell?.(data[0]) : null}
    </div>
  ),
}))

vi.mock('../../../shared/ui/paginator/Paginator', () => ({
  Paginator: () => null,
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened, title }: { children: ReactNode; opened: boolean; title: ReactNode }) =>
    opened ? <div>{title}{children}</div> : null,
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened, title }: { children: ReactNode; opened: boolean; title: ReactNode }) =>
    opened ? <div>{title}{children}</div> : null,
}))

vi.mock('../../../shared/ui/document-export-modal/DocumentExportModal', () => ({
  DocumentExportModal: () => null,
}))

const transfer = {
  NetUid: '22222222-2222-4222-8222-222222222222',
  Number: 'PT-1',
  ProductTransferItems: [],
}
const storages = [
  {
    Id: 11,
    Name: 'Склад A',
    NetUid: '33333333-3333-4333-8333-333333333333',
    OrganizationId: 7,
  },
  {
    Id: 12,
    Name: 'Склад B',
    NetUid: '44444444-4444-4444-8444-444444444444',
    OrganizationId: 7,
  },
]

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <ProductTransfersPage />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('ProductTransfersPage canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getProductTransfers).mockResolvedValue({ items: [transfer], totalQty: 1 })
    vi.mocked(getProductTransferByNetId).mockResolvedValue(transfer)
    vi.mocked(getProductTransferStorages).mockResolvedValue(storages)
    vi.mocked(exportProductTransferDocument).mockResolvedValue({ DocumentURL: '/transfer.xlsx' })
    vi.mocked(addProductTransferFromFile).mockResolvedValue([])
  })

  it('does not mount the page model without page access', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getProductTransfers).not.toHaveBeenCalled()
    expect(getProductTransferStorages).not.toHaveBeenCalled()
  })

  it('loads only the registry with page access', async () => {
    allowedPermissions.add(PermissionKeys.ProductTransfers.Page.View)
    renderPage()

    await waitFor(() => expect(getProductTransfers).toHaveBeenCalled())
    expect(getProductTransferStorages).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Нове переміщення' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Відкрити рядок' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Деталі' })).toBeNull()
  })

  it('opens details independently and keeps export hidden', async () => {
    allowedPermissions.add(PermissionKeys.ProductTransfers.Page.View)
    allowedPermissions.add(PermissionKeys.ProductTransfers.Transfer.OpenDetails)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Відкрити рядок' }))

    await waitFor(() => expect(getProductTransferByNetId).toHaveBeenCalledWith(transfer.NetUid))
    expect(screen.getByText('Деталі переміщення')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Завантажити' })).toBeNull()
  })

  it('exports only when both detail access and export are granted', async () => {
    allowedPermissions.add(PermissionKeys.ProductTransfers.Page.View)
    allowedPermissions.add(PermissionKeys.ProductTransfers.Transfer.OpenDetails)
    allowedPermissions.add(PermissionKeys.ProductTransfers.Document.Export)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Відкрити рядок' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Завантажити' }))

    await waitFor(() => expect(exportProductTransferDocument).toHaveBeenCalledWith(transfer.NetUid))
  })

  it('keeps management transfer disabled without its independent key', async () => {
    allowedPermissions.add(PermissionKeys.ProductTransfers.Page.View)
    allowedPermissions.add(PermissionKeys.ProductTransfers.Transfer.Create)
    renderPage()

    const createButton = await screen.findByRole('button', { name: 'Нове переміщення' })
    await waitFor(() => expect(createButton.hasAttribute('disabled')).toBe(false))
    fireEvent.click(createButton)

    expect((screen.getByRole('switch', {
      name: 'Управлінське переміщення',
    }) as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText('Немає права створювати управлінське переміщення.')).toBeTruthy()
  })

  it('loads create dictionaries and submits only with create access', async () => {
    allowedPermissions.add(PermissionKeys.ProductTransfers.Page.View)
    allowedPermissions.add(PermissionKeys.ProductTransfers.Transfer.Create)
    allowedPermissions.add(PermissionKeys.ProductTransfers.Transfer.CreateManagement)
    const { container } = renderPage()

    const createButton = await screen.findByRole('button', { name: 'Нове переміщення' })
    await waitFor(() => expect(createButton.hasAttribute('disabled')).toBe(false))
    fireEvent.click(createButton)
    expect(getProductTransferStorages).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByLabelText('Колонка коду'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Колонка кількості'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Початковий рядок'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Кінцевий рядок'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Управлінське переміщення' }))
    const fileInput = container.querySelector('input[type="file"]')
    expect(fileInput).not.toBeNull()
    fireEvent.change(fileInput!, {
      target: { files: [new File(['code,qty'], 'transfer.xlsx')] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))

    await waitFor(() => expect(addProductTransferFromFile).toHaveBeenCalledWith(
      expect.objectContaining({
        productTransfer: expect.objectContaining({
          FromStorageNetUid: storages[0].NetUid,
          IsManagement: true,
          ToStorageNetUid: storages[1].NetUid,
        }),
      }),
    ))
  })
})
