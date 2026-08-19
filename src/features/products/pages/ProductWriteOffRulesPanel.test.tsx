import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  addOrUpdateProductWriteOffRule,
  getProductGroupsByProductNetId,
  getProductWriteOffRulesByProductGroupNetId,
  getProductWriteOffRulesByProductNetId,
} from '../api/productsApi'
import type { Product } from '../types'
import { ProductActionDrawer } from './ProductDetailPage'

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ data }: { data: Array<{ NetUid?: string }> }) => (
    <div data-testid="writeoff-rules">{data.map((row) => row.NetUid).join(',')}</div>
  ),
}))

vi.mock('../api/productsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/productsApi')>(),
  addOrUpdateProductWriteOffRule: vi.fn(),
  deleteProductWriteOffRule: vi.fn(),
  getProductGroupsByProductNetId: vi.fn(),
  getProductWriteOffRulesByProductGroupNetId: vi.fn(),
  getProductWriteOffRulesByProductNetId: vi.fn(),
}))

const product: Product = {
  Id: 101,
  NetUid: 'product-101',
  VendorCode: 'CE0373MEXKIT-SF',
  ProductProductGroups: [{
    Deleted: false,
    ProductGroup: {
      Id: 3039,
      Name: 'Тестова група',
      NetUid: 'group-3039',
    },
  }],
}

function renderPanel() {
  return render(
    <MemoryRouter>
      <MantineProvider>
        <I18nProvider>
          <ProductActionDrawer
            activePanel="writeoff"
            product={product}
            onClose={vi.fn()}
            onProductSaved={vi.fn()}
            onReload={vi.fn()}
          />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('ProductWriteOffRulesPanel', () => {
  beforeEach(() => {
    vi.mocked(addOrUpdateProductWriteOffRule).mockReset()
    vi.mocked(getProductGroupsByProductNetId).mockReset().mockResolvedValue([
      { Id: 3039, Name: 'Тестова група', NetUid: 'group-3039' },
    ])
    vi.mocked(getProductWriteOffRulesByProductNetId).mockReset().mockResolvedValue([
      { NetUid: 'product-rule', Product: product, RuleLocale: 'uk', RuleType: 0 },
    ])
    vi.mocked(getProductWriteOffRulesByProductGroupNetId).mockReset().mockResolvedValue([
      { NetUid: 'group-rule', ProductGroup: product.ProductProductGroups?.[0].ProductGroup, RuleLocale: 'uk', RuleType: 0 },
    ])
    vi.mocked(addOrUpdateProductWriteOffRule).mockImplementation(async (payload) => ({
      NetUid: payload.Product ? 'saved-product-rule' : 'saved-group-rule',
      Product: payload.Product,
      ProductGroup: payload.ProductGroup,
      RuleLocale: payload.RuleLocale,
      RuleType: payload.RuleType,
    }))
  })

  it('loads and saves both product and product-group rules with their exact scope', async () => {
    renderPanel()

    await waitFor(() => {
      expect(getProductWriteOffRulesByProductNetId).toHaveBeenCalledWith('product-101')
      expect(screen.getByTestId('writeoff-rules').textContent).toContain('product-rule')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Додати' }))

    await waitFor(() => {
      expect(addOrUpdateProductWriteOffRule).toHaveBeenCalledWith(expect.objectContaining({
        Product: expect.objectContaining({ Id: 101, NetUid: 'product-101' }),
        ProductGroup: null,
      }))
    })

    fireEvent.click(screen.getByText('Група товарів'))

    await waitFor(() => {
      expect(getProductWriteOffRulesByProductGroupNetId).toHaveBeenCalledWith('group-3039')
      expect(screen.getByTestId('writeoff-rules').textContent).toContain('group-rule')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Додати' }))

    await waitFor(() => {
      expect(addOrUpdateProductWriteOffRule).toHaveBeenLastCalledWith(expect.objectContaining({
        Product: null,
        ProductGroup: expect.objectContaining({ Id: 3039, NetUid: 'group-3039' }),
      }))
    })
  })
})
