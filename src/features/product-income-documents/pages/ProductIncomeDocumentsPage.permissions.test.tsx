import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  exportProductIncomeDocument,
  getProductIncomeDocuments,
  getProductIncomeInfo,
  getProductIncomeInfoForRemainings,
  getProductIncomeRemainings,
} from '../api/productIncomeDocumentsApi'
import { ProductIncomeDocumentsPage } from './ProductIncomeDocumentsPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/productIncomeDocumentsApi', () => ({
  exportProductIncomeDocument: vi.fn(),
  getProductIncomeDocuments: vi.fn(),
  getProductIncomeInfo: vi.fn(),
  getProductIncomeInfoForRemainings: vi.fn(),
  getProductIncomeRemainings: vi.fn(),
}))

vi.mock('../../product-capitalizations/api/productCapitalizationsApi', () => ({
  getProductCapitalizationForIncomeDocuments: vi.fn(),
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

vi.mock('../../../shared/ui/product-movement-history/ProductMovementHistoryDrawers', () => ({
  ProductMovementHistoryDrawer: () => null,
  ProductStorageLocationHistoryDrawer: () => null,
}))

vi.mock('../../../shared/ui/product-movement-history/productMovementHistoryRequestPaths', () => ({
  assortmentMovementRequestPaths: {},
}))

const document = {
  NetUid: 'income-1',
  Number: 'PI-1',
  ProductIncomeItems: [{
    Qty: 2,
    Product: {
      Name: 'Тестовий товар',
      NetUid: 'product-1',
      VendorCode: 'P-1',
    },
  }],
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <ProductIncomeDocumentsPage />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('ProductIncomeDocumentsPage canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getProductIncomeDocuments).mockResolvedValue({ Items: [document], Total: 1 })
    vi.mocked(getProductIncomeInfo).mockResolvedValue(document)
    vi.mocked(getProductIncomeInfoForRemainings).mockResolvedValue(document)
    vi.mocked(getProductIncomeRemainings).mockResolvedValue([])
    vi.mocked(exportProductIncomeDocument).mockResolvedValue({ DocumentURL: '/income.xlsx' })
  })

  it('does not mount the page model without page access', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getProductIncomeDocuments).not.toHaveBeenCalled()
  })

  it('loads the registry with page access but exposes no document business action', async () => {
    allowedPermissions.add(PermissionKeys.ProductIncomeDocuments.Page.View)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Відкрити рядок' }))

    expect(screen.queryByRole('button', { name: 'Деталі документа' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Залишки по партіям' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Експорт' })).toBeNull()
  })

  it('opens details independently and does not load remainings', async () => {
    allowedPermissions.add(PermissionKeys.ProductIncomeDocuments.Page.View)
    allowedPermissions.add(PermissionKeys.ProductIncomeDocuments.Document.OpenDetails)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Відкрити рядок' }))
    fireEvent.click(screen.getByRole('button', { name: 'Деталі документа' }))

    await waitFor(() => expect(getProductIncomeInfo).toHaveBeenCalledWith('income-1'))
    expect(getProductIncomeInfoForRemainings).not.toHaveBeenCalled()
    expect(getProductIncomeRemainings).not.toHaveBeenCalled()
  })

  it('loads remainings through its own details scope without the open-details right', async () => {
    allowedPermissions.add(PermissionKeys.ProductIncomeDocuments.Page.View)
    allowedPermissions.add(PermissionKeys.ProductIncomeDocuments.Document.OpenRemainings)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Відкрити рядок' }))
    fireEvent.click(screen.getByRole('button', { name: 'Залишки по партіям' }))

    await waitFor(() => expect(getProductIncomeInfoForRemainings).toHaveBeenCalledWith('income-1'))
    expect(getProductIncomeRemainings).toHaveBeenCalledWith('income-1')
    expect(getProductIncomeInfo).not.toHaveBeenCalled()
  })

  it('exports independently without exposing details or remainings', async () => {
    allowedPermissions.add(PermissionKeys.ProductIncomeDocuments.Page.View)
    allowedPermissions.add(PermissionKeys.ProductIncomeDocuments.Document.Export)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Експорт' }))

    await waitFor(() => expect(exportProductIncomeDocument).toHaveBeenCalledWith('income-1'))
    expect(screen.queryByRole('button', { name: 'Деталі документа' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Залишки по партіям' })).toBeNull()
  })

  it('keeps movement and storage-history buttons independently guarded', async () => {
    allowedPermissions.add(PermissionKeys.ProductIncomeDocuments.Page.View)
    allowedPermissions.add(PermissionKeys.ProductIncomeDocuments.Document.OpenDetails)
    allowedPermissions.add(PermissionKeys.ProductsAssortment.Movement.Open)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Відкрити рядок' }))
    fireEvent.click(screen.getByRole('button', { name: 'Деталі документа' }))

    expect(await screen.findByRole('button', { name: 'Рух товару' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Історія місця зберігання' })).toBeNull()
  })
})
