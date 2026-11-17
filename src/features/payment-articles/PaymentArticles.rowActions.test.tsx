import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../shared/auth/permissionKeys'
import { I18nProvider } from '../../shared/i18n/I18nProvider'
import { getPaymentCashflowArticles } from '../payment-cashflow-articles/api/paymentCashflowArticlesApi'
import { getPaymentExpenseArticles } from '../payment-expense-articles/api/paymentExpenseArticlesApi'
import { PaymentArticlesPage } from './PaymentArticlesPage'

const allowedPermissions = new Set<string>()

vi.mock('../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../payment-cashflow-articles/api/paymentCashflowArticlesApi', () => ({
  getPaymentCashflowArticles: vi.fn(),
  searchPaymentCashflowArticles: vi.fn(),
}))

vi.mock('../payment-expense-articles/api/paymentExpenseArticlesApi', () => ({
  getPaymentExpenseArticles: vi.fn(),
  searchPaymentExpenseArticles: vi.fn(),
}))

// Render every cell so the row action (edit vs view) is visible.
vi.mock('../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ columns, data }: { columns: Array<{ id: string; cell?: (row: unknown) => ReactNode }>; data: unknown[] }) => (
    <div>
      {data.map((row, index) => (
        <div key={index}>{columns.map((column) => <span key={column.id}>{column.cell?.(row)}</span>)}</div>
      ))}
    </div>
  ),
}))

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/accounting/payment-expense-articles']}>
          <PaymentArticlesPage />
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('payment article row actions', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    allowedPermissions.add(PermissionKeys.SystemPages.ExpenseArticles.View)
    allowedPermissions.add(PermissionKeys.FinancialAdministration.CashflowArticles.Page.View)
    vi.mocked(getPaymentExpenseArticles).mockResolvedValue([{ NetUid: 'expense-1', OperationName: 'Оренда' }])
    vi.mocked(getPaymentCashflowArticles).mockResolvedValue([{ NetUid: 'cashflow-1', OperationName: 'Продаж' }])
  })

  it('offers only "view" to a read-only role on both article lists', async () => {
    renderPage()

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Переглянути' })).toHaveLength(2))
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()
  })

  it('offers "edit" on the expense list only with the expense save key', async () => {
    allowedPermissions.add(PermissionKeys.FinancialAdministration.ExpenseArticles.Article.Save)
    renderPage()

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Редагувати' })).toHaveLength(1))
    expect(screen.getAllByRole('button', { name: 'Переглянути' })).toHaveLength(1)
  })
})
