import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import {
  getNotSentSads,
  getNotSentTaxFreePackLists,
  getUkraineCartItems,
} from '../api/basketSupplyUkraineOrderApi'
import { BasketSupplyUkraineOrderPage } from './BasketSupplyUkraineOrderPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/basketSupplyUkraineOrderApi', () => ({
  addOrUpdateSad: vi.fn(),
  addOrUpdateSaleSad: vi.fn(),
  addOrUpdateSaleTaxFreePackList: vi.fn(),
  addOrUpdateTaxFreePackList: vi.fn(),
  assembleCartSadDocument: vi.fn(),
  assembleCartTaxFreeDocument: vi.fn(),
  calculateTotalsByCartItems: vi.fn(),
  calculateTotalsBySales: vi.fn(),
  getNotSentSads: vi.fn(),
  getNotSentSaleSads: vi.fn(),
  getNotSentSaleTaxFreePackLists: vi.fn(),
  getNotSentTaxFreePackLists: vi.fn(),
  getSalesForMovingToUkraine: vi.fn(),
  getUkraineCartItems: vi.fn(),
  updateUkraineCartItem: vi.fn(),
  uploadPreviewUkraineCartItemsFromFile: vi.fn(),
  uploadUkraineCartItemsFromFile: vi.fn(),
}))

vi.mock('../components/ProcurementConstructor', () => ({
  ProcurementConstructor: () => (
    <div className="procure-cockpit" data-testid="procurement-constructor">
      <div className="app-data-card basket-supply-primary-card">
        <div className="app-filter-bar" data-testid="active-filter" />
      </div>
    </div>
  ),
}))

function renderPage(pathname: string) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[pathname]}>
          <BasketSupplyUkraineOrderPage />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('BasketSupplyUkraineOrderPage shell', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    allowedPermissions.add(PermissionKeys.SystemPages.SupplyCart.View)
    allowedPermissions.add(PermissionKeys.SupplyCart.File.Import)
    vi.mocked(getUkraineCartItems).mockResolvedValue([])
    vi.mocked(getNotSentTaxFreePackLists).mockResolvedValue([])
    vi.mocked(getNotSentSads).mockResolvedValue([])
  })

  it.each(['/recommendations', '/basket-supply-ukraine-order/recommendations'])(
    'keeps the recommendations alias on the visible constructor tab at %s',
    (pathname) => {
      const { container } = renderPage(pathname)

      const shell = container.querySelector('.basket-supply-page > .basket-supply-shell.app-data-card')
      const tabs = shell?.querySelector(':scope > .basket-supply-tabs.pill-tabs')
      const content = shell?.querySelector(':scope > .basket-supply-tab-content')
      const activeTabs = tabs?.querySelectorAll('.pill-tab.is-active')
      const activeFilter = screen.getByTestId('active-filter')

      expect(shell).not.toBeNull()
      expect(shell?.firstElementChild).toBe(tabs)
      expect(tabs?.nextElementSibling).toBe(content)
      expect(activeTabs).toHaveLength(1)
      expect(activeTabs?.[0]?.getAttribute('aria-pressed')).toBe('true')
      expect(activeTabs?.[0]?.textContent).toContain('Конструктор закупівель')
      expect(content?.contains(activeFilter)).toBe(true)
      expect((tabs?.compareDocumentPosition(activeFilter) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    },
  )

  it('replaces empty transfer tables and zero totals with one useful state', async () => {
    renderPage('/basket-supply-ukraine-order')

    expect(await screen.findByText('Немає товарів для переміщення')).not.toBeNull()
    expect(
      screen.getByText(
        'Завантажте файл із товарами, щоб сформувати підбірку для переміщення та створити документ.',
      ),
    ).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Завантажити товари' })).not.toBeNull()
    expect(screen.queryByText('Підбірка порожня')).toBeNull()
    expect(screen.queryByText('Заг. к-сть')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Додати (0)' })).toBeNull()
    expect(screen.queryByLabelText('Пошук по товару')).toBeNull()
  })
})
