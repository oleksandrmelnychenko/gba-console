import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { ApiError } from '../../../shared/api/apiClient'
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
  AppModalFooter: ({ children }: { children: import('react').ReactNode }) => <div>{children}</div>,
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

function renderPage(entry = '/products/transfers') {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[entry]}><ProductTransfersPage /></MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('ProductTransfersPage import dialog', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    allowedPermissions.add(PermissionKeys.ProductTransfers.Page.View)
    allowedPermissions.add(PermissionKeys.ProductTransfers.Transfer.Create)
    vi.clearAllMocks()
    vi.mocked(getProductTransfers).mockResolvedValue({ items: [transfer], totalQty: 1 })
    vi.mocked(getProductTransferByNetId).mockResolvedValue(transfer)
    vi.mocked(getProductTransferStorages).mockResolvedValue(storages)
    vi.mocked(exportProductTransferDocument).mockResolvedValue({ DocumentURL: '/transfer.xlsx' })
    vi.mocked(addProductTransferFromFile).mockResolvedValue([])
  })

  async function openDialog() {
    const view = renderPage()
    const createButton = await screen.findByRole('button', { name: 'Нове переміщення' })
    await waitFor(() => expect(createButton.hasAttribute('disabled')).toBe(false))
    fireEvent.click(createButton)

    return view
  }

  it('starts with code column 1, quantity column 2 and start row 2', async () => {
    await openDialog()

    expect((screen.getByLabelText('Колонка коду') as HTMLInputElement).value).toBe('1')
    expect((screen.getByLabelText('Колонка кількості') as HTMLInputElement).value).toBe('2')
    expect((screen.getByLabelText('Початковий рядок') as HTMLInputElement).value).toBe('2')
  })

  it('asks for the file before sending anything', async () => {
    await openDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))

    expect(await screen.findByText('Додайте файл.')).toBeTruthy()
    expect(addProductTransferFromFile).not.toHaveBeenCalled()
  })

  it('shows a raw server key as a Ukrainian message', async () => {
    vi.mocked(addProductTransferFromFile).mockRejectedValue(new ApiError('UnsupportedFileFormat', 400, null))
    const { container } = await openDialog()

    fireEvent.change(screen.getByLabelText('Кінцевий рядок'), { target: { value: '3' } })
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File([''], 'empty.xlsx')] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))

    expect(await screen.findByText('Файл не є коректною книгою Excel (.xlsx).')).toBeTruthy()
  })

  it('does not offer storages without a name in «Зі складу»', async () => {
    vi.mocked(getProductTransferStorages).mockResolvedValue([...storages, { Id: 13, Name: '  ', NetUid: '55555555-5555-4555-8555-555555555555', OrganizationId: 7 }])
    await openDialog()

    fireEvent.click(screen.getAllByLabelText('Зі складу')[0])

    const options = await screen.findAllByRole('option', { hidden: true })
    expect(options.length).toBeGreaterThan(0)
    expect(options.map((option) => option.textContent?.trim())).not.toContain('')
  })
})
