import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { SUPPLY_ORDER_COMMENT_MAX_LENGTH } from '../supplyOrderCommentValidation'
import { SupplyUkraineDirectOrderCreatePage } from './SupplyUkraineDirectOrderCreatePage'

const apiMocks = vi.hoisted(() => ({
  getSupplyOrderOrganizations: vi.fn(),
  getSupplyOrderSuppliers: vi.fn(),
  uploadDirectSupplyOrderFromFile: vi.fn(),
  uploadSupplyOrderUkraineFromSupplierFile: vi.fn(),
}))

vi.mock('../api/supplyUkraineOrdersApi', () => apiMocks)

function renderPage() {
  render(
    <MantineProvider env="test">
      <I18nProvider>
        <MemoryRouter initialEntries={['/orders/ukraine/all/new']}>
          <SupplyUkraineDirectOrderCreatePage />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('direct supply order comment validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getSupplyOrderOrganizations.mockResolvedValue([])
    apiMocks.getSupplyOrderSuppliers.mockResolvedValue([])
  })

  it('stops an oversized comment before the multipart request', async () => {
    renderPage()

    const comment = await screen.findByRole('textbox', { name: /Коментар/ })
    fireEvent.change(comment, {
      target: { value: '2'.repeat(SUPPLY_ORDER_COMMENT_MAX_LENGTH + 1) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))

    expect(screen.getAllByText('Коментар: не більше 500 символів')).not.toHaveLength(0)
    expect(apiMocks.uploadDirectSupplyOrderFromFile).not.toHaveBeenCalled()
  })
})
