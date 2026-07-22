import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  getSaleClientAgreements,
  searchSaleProducts,
  searchSalesUkraineClients,
} from '../../sales-ukraine/api/salesUkraineApi'
import { PricingPage } from './PricingPage'

vi.mock('../../sales-ukraine/api/salesUkraineApi', () => ({
  getSaleClientAgreements: vi.fn(),
  searchSaleProducts: vi.fn(),
  searchSalesUkraineClients: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/pricing']}>
      <MantineProvider>
        <I18nProvider>
          <PricingPage />
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(getSaleClientAgreements).mockReset()
  vi.mocked(searchSaleProducts).mockReset()
  vi.mocked(searchSalesUkraineClients).mockReset()

  vi.mocked(getSaleClientAgreements).mockResolvedValue([])
  vi.mocked(searchSaleProducts).mockResolvedValue([])
  vi.mocked(searchSalesUkraineClients).mockResolvedValue([])
})

describe('PricingPage layout', () => {
  it('keeps the title, filters, and content inside the shared console page shell', () => {
    const { container } = renderPage()

    const page = container.querySelector('.pricing-page.console-table-page')
    const shell = container.querySelector('.pricing-page__shell.console-table-shell')
    const filterBar = container.querySelector('.pricing-page__filter-bar.app-filter-bar')
    const content = container.querySelector('.pricing-page__content.console-table-body')

    expect(page).not.toBeNull()
    expect(shell?.parentElement).toBe(page)
    expect(filterBar?.parentElement).toBe(shell)
    expect(content?.parentElement).toBe(shell)
    expect(content?.querySelectorAll('.pricing-page__section')).toHaveLength(2)

    const title = screen.getByText('Рекомендація ціни')
    expect(content?.contains(title)).toBe(true)
    expect(filterBar?.contains(title)).toBe(false)

    for (const label of ['Товар', 'Клієнт', 'Угода клієнта']) {
      expect(filterBar?.contains(screen.getByRole('combobox', { name: label }))).toBe(true)
    }

    expect(searchSaleProducts).not.toHaveBeenCalled()
    expect(searchSalesUkraineClients).not.toHaveBeenCalled()
    expect(getSaleClientAgreements).not.toHaveBeenCalled()
  })
})
