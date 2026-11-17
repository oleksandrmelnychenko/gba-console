import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createPaymentCashflowArticle } from '../api/paymentCashflowArticlesApi'
import { PaymentCashflowArticleFormPage } from './PaymentCashflowArticleFormPage'

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, isLoading: false }),
}))

vi.mock('../api/paymentCashflowArticlesApi', () => ({
  createPaymentCashflowArticle: vi.fn(),
  deletePaymentCashflowArticle: vi.fn(),
  getPaymentCashflowArticle: vi.fn(),
  updatePaymentCashflowArticle: vi.fn(),
}))

describe('cash-flow article form (outgoing#6)', () => {
  it('shows its own message for an empty Назва instead of relying on the browser bubble', async () => {
    render(
      <MemoryRouter initialEntries={['/accounting/payment-cashflow-articles/new']}>
        <MantineProvider>
          <I18nProvider>
            <Routes>
              <Route path="/accounting/payment-cashflow-articles/new" element={<PaymentCashflowArticleFormPage />} />
            </Routes>
          </I18nProvider>
        </MantineProvider>
      </MemoryRouter>,
    )

    const form = (await screen.findByLabelText(/^Назва/)).closest('form')!
    expect(form.noValidate).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(await screen.findByText('Вкажіть назву статті руху коштів')).toBeTruthy()
    expect(createPaymentCashflowArticle).not.toHaveBeenCalled()
  })
})
