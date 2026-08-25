import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductEditorForm } from './ConsumableProductsPage'

const mocks = vi.hoisted(() => ({
  searchMeasureUnits: vi.fn(),
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

vi.mock('../../../shared/ui/SearchableSelect', () => ({
  SearchableSelect: ({ data, label }: { data: Array<{ label: string }>; label: string }) => (
    <div aria-label={label}>{data.map((option) => <span key={option.label}>{option.label}</span>)}</div>
  ),
}))

vi.mock('../api/consumableProductsApi', () => ({
  createConsumableProduct: vi.fn(),
  createConsumableProductCategory: vi.fn(),
  deleteConsumableProduct: vi.fn(),
  deleteConsumableProductCategory: vi.fn(),
  getConsumableProductCategories: vi.fn(),
  searchConsumableProductCategories: vi.fn(),
  searchMeasureUnits: mocks.searchMeasureUnits,
  updateConsumableProduct: vi.fn(),
  updateConsumableProductCategory: vi.fn(),
}))

describe('ConsumableProductsPage measure-unit selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.searchMeasureUnits.mockResolvedValue([
      { Id: 1, Name: 'послуга' },
      { Id: 2, Name: 'шт' },
    ])
  })

  it('preloads all company-resource units before the empty dropdown is opened', async () => {
    render(
      <MantineProvider>
        <ProductEditorForm
          editor={{
            category: { Id: 10, Name: 'Побутові товари і послуги', ConsumableProducts: [] },
            mode: 'create',
          }}
          isSubmitting={false}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      </MantineProvider>,
    )

    await waitFor(() => expect(mocks.searchMeasureUnits).toHaveBeenCalledWith(''))
    expect(await screen.findByText('послуга')).toBeTruthy()
    expect(screen.getByText('шт')).toBeTruthy()
  })
})
