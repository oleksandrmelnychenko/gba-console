import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { PaymentCashflowArticleFormPage } from '../../payment-cashflow-articles/pages/PaymentCashflowArticleFormPage'
import { PaymentExpenseArticleFormPage } from './PaymentExpenseArticleFormPage'

const permissions = vi.hoisted(() => ({ allowed: new Set<string>() }))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: (key: string) => permissions.allowed.has(key), isLoading: false }),
}))

vi.mock('../api/paymentExpenseArticlesApi', () => ({
  createPaymentExpenseArticle: vi.fn(),
  deletePaymentExpenseArticle: vi.fn(),
  getPaymentExpenseArticle: vi.fn(async () => ({ Id: 1, NetUid: 'a-1', Name: 'Оренда' })),
  updatePaymentExpenseArticle: vi.fn(),
}))

vi.mock('../../payment-cashflow-articles/api/paymentCashflowArticlesApi', () => ({
  createPaymentCashflowArticle: vi.fn(),
  deletePaymentCashflowArticle: vi.fn(),
  getPaymentCashflowArticle: vi.fn(async () => ({ Id: 2, NetUid: 'c-2', Name: 'Інкасація' })),
  updatePaymentCashflowArticle: vi.fn(),
}))

function renderAt(path: string, route: string, element: React.ReactNode) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <MantineProvider>
        <I18nProvider>
          <Routes>
            <Route path={route} element={element} />
          </Routes>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

// N3-05: TOPMANAGER / FINANCE open an article with «Переглянути»; the dialog is read-only but was
// titled «Редагування…».
describe('article dialogs without save permission', () => {
  it('titles the read-only expense article dialog «Перегляд статті витрат»', async () => {
    permissions.allowed = new Set([PermissionKeys.SystemPages.ExpenseArticles.View])
    renderAt(
      '/accounting/payment-expense-articles/edit/a-1',
      '/accounting/payment-expense-articles/edit/:id',
      <PaymentExpenseArticleFormPage />,
    )

    expect(await screen.findByText('Перегляд статті витрат')).toBeTruthy()
    expect(screen.queryByText('Редагування статті витрат')).toBeNull()
  })

  it('titles the read-only cash-flow article dialog «Перегляд статті руху коштів»', async () => {
    permissions.allowed = new Set([PermissionKeys.FinancialAdministration.CashflowArticles.Page.View])
    renderAt(
      '/accounting/payment-cashflow-articles/edit/c-2',
      '/accounting/payment-cashflow-articles/edit/:id',
      <PaymentCashflowArticleFormPage />,
    )

    expect(await screen.findByText('Перегляд статті руху коштів')).toBeTruthy()
  })

  it('keeps «Редагування статті витрат» for a user who can save', async () => {
    permissions.allowed = new Set([
      PermissionKeys.SystemPages.ExpenseArticles.View,
      PermissionKeys.FinancialAdministration.ExpenseArticles.Article.Save,
    ])
    renderAt(
      '/accounting/payment-expense-articles/edit/a-1',
      '/accounting/payment-expense-articles/edit/:id',
      <PaymentExpenseArticleFormPage />,
    )

    expect(await screen.findByText('Редагування статті витрат')).toBeTruthy()
  })
})
