import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../shared/auth/permissionKeys'
import { I18nProvider } from '../../shared/i18n/I18nProvider'
import {
  createPaymentCashflowArticle,
  getPaymentCashflowArticle,
  getPaymentCashflowArticles,
  updatePaymentCashflowArticle,
} from '../payment-cashflow-articles/api/paymentCashflowArticlesApi'
import { PaymentCashflowArticleFormPage } from '../payment-cashflow-articles/pages/PaymentCashflowArticleFormPage'
import { PaymentCashflowArticlesPage } from '../payment-cashflow-articles/pages/PaymentCashflowArticlesPage'
import {
  createPaymentExpenseArticle,
  getPaymentExpenseArticle,
  getPaymentExpenseArticles,
  updatePaymentExpenseArticle,
} from '../payment-expense-articles/api/paymentExpenseArticlesApi'
import { PaymentExpenseArticleFormPage } from '../payment-expense-articles/pages/PaymentExpenseArticleFormPage'
import { PaymentExpenseArticlesPage } from '../payment-expense-articles/pages/PaymentExpenseArticlesPage'

const allowedPermissions = new Set<string>()

vi.mock('../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../payment-cashflow-articles/api/paymentCashflowArticlesApi', () => ({
  createPaymentCashflowArticle: vi.fn(),
  deletePaymentCashflowArticle: vi.fn(),
  getPaymentCashflowArticle: vi.fn(),
  getPaymentCashflowArticles: vi.fn(),
  searchPaymentCashflowArticles: vi.fn(),
  updatePaymentCashflowArticle: vi.fn(),
}))

vi.mock('../payment-expense-articles/api/paymentExpenseArticlesApi', () => ({
  createPaymentExpenseArticle: vi.fn(),
  deletePaymentExpenseArticle: vi.fn(),
  getPaymentExpenseArticle: vi.fn(),
  getPaymentExpenseArticles: vi.fn(),
  searchPaymentExpenseArticles: vi.fn(),
  updatePaymentExpenseArticle: vi.fn(),
}))

vi.mock('../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer, opened }: { children: ReactNode; footer?: ReactNode; opened: boolean }) =>
    opened ? <section>{children}{footer}</section> : null,
}))

vi.mock('../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) =>
    opened ? <section>{children}</section> : null,
}))

vi.mock('../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ data }: { data: unknown[] }) => <output data-testid="article-row-count">{data.length}</output>,
}))

function renderRoute(element: ReactNode, path: string, routePath: string) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={routePath} element={element} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('payment article canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getPaymentCashflowArticles).mockResolvedValue([])
    vi.mocked(getPaymentExpenseArticles).mockResolvedValue([])
    vi.mocked(getPaymentCashflowArticle).mockResolvedValue({
      NetUid: 'cashflow-1',
      OperationName: 'Продаж',
      PaymentMovementOperations: [],
    })
    vi.mocked(getPaymentExpenseArticle).mockResolvedValue({
      NetUid: 'expense-1',
      OperationName: 'Пальне',
      PaymentCostMovementOperations: [],
    })
    vi.mocked(createPaymentCashflowArticle).mockResolvedValue(null)
    vi.mocked(createPaymentExpenseArticle).mockResolvedValue(null)
    vi.mocked(updatePaymentCashflowArticle).mockResolvedValue(null)
    vi.mocked(updatePaymentExpenseArticle).mockResolvedValue(null)
  })

  it('does not mount either registry without its own page permission', () => {
    renderRoute(
      <>
        <PaymentCashflowArticlesPage />
        <PaymentExpenseArticlesPage />
      </>,
      '/articles',
      '/articles',
    )

    expect(screen.getAllByText('Доступ заборонено')).toHaveLength(2)
    expect(getPaymentCashflowArticles).not.toHaveBeenCalled()
    expect(getPaymentExpenseArticles).not.toHaveBeenCalled()
  })

  it('requires create, not save, for a direct cashflow create and its final submit', async () => {
    allowedPermissions.add(PermissionKeys.FinancialAdministration.CashflowArticles.Page.View)
    allowedPermissions.add(PermissionKeys.FinancialAdministration.CashflowArticles.Article.Save)
    const firstRender = renderRoute(
      <PaymentCashflowArticleFormPage />,
      '/accounting/payment-cashflow-articles/new',
      '/accounting/payment-cashflow-articles/new',
    )

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(createPaymentCashflowArticle).not.toHaveBeenCalled()
    firstRender.unmount()

    allowedPermissions.delete(PermissionKeys.FinancialAdministration.CashflowArticles.Article.Save)
    allowedPermissions.add(PermissionKeys.FinancialAdministration.CashflowArticles.Article.Create)
    renderRoute(
      <PaymentCashflowArticleFormPage />,
      '/accounting/payment-cashflow-articles/new',
      '/accounting/payment-cashflow-articles/new',
    )

    fireEvent.change(screen.getByRole('textbox', { name: /Назва/ }), { target: { value: 'Продаж' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(createPaymentCashflowArticle).toHaveBeenCalledWith({ OperationName: 'Продаж' }))
    expect(updatePaymentCashflowArticle).not.toHaveBeenCalled()
  })

  it('keeps an expense edit readable with page access and requires save only for mutation', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.ExpenseArticles.View)
    renderRoute(
      <PaymentExpenseArticleFormPage />,
      '/accounting/payment-expense-articles/edit/expense-1',
      '/accounting/payment-expense-articles/edit/:id',
    )

    const input = await screen.findByRole('textbox', { name: /Назва/ })
    expect((input as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
    expect(getPaymentExpenseArticle).toHaveBeenCalledWith('expense-1')
    expect(updatePaymentExpenseArticle).not.toHaveBeenCalled()
  })

  it('uses expense create independently from the edit save permission', async () => {
    allowedPermissions.add(PermissionKeys.SystemPages.ExpenseArticles.View)
    allowedPermissions.add(PermissionKeys.FinancialAdministration.ExpenseArticles.Article.Create)
    renderRoute(
      <PaymentExpenseArticleFormPage />,
      '/accounting/payment-expense-articles/new',
      '/accounting/payment-expense-articles/new',
    )

    fireEvent.change(screen.getByRole('textbox', { name: /Назва/ }), { target: { value: 'Оренда' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(createPaymentExpenseArticle).toHaveBeenCalledWith({ OperationName: 'Оренда' }))
    expect(updatePaymentExpenseArticle).not.toHaveBeenCalled()
  })
})
