import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  getCurrentEuroExchangeRate,
  getIncomeCashflowOrganizations,
  getIncomeCashflowPaymentMovements,
  searchIncomeCashflowPaymentRegisters,
} from '../api/incomeCashflowsApi'
import { IncomeCashflowClientFormPage } from './IncomeCashflowClientFormPage'
import { IncomeCashflowConversionFormPage } from './IncomeCashflowConversionFormPage'
import { IncomeCashflowUserFormPage } from './IncomeCashflowUserFormPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children, fallback = null, permissionKey }: {
    children: ReactNode
    fallback?: ReactNode
    permissionKey: string
  }) => allowedPermissions.has(permissionKey) ? children : fallback,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../api/incomeCashflowsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/incomeCashflowsApi')>(),
  createIncomeCashflow: vi.fn(),
  createIncomeCashflowPaymentMovement: vi.fn(),
  getCurrentEuroExchangeRate: vi.fn(),
  getIncomeCashflowOrganizations: vi.fn(),
  getIncomeCashflowPaymentMovements: vi.fn(),
  searchIncomeCashflowPaymentRegisters: vi.fn(),
}))

const incomeOrderPermissions =
  PermissionKeys.FinancialAdministration.IncomeCashflows.IncomeOrder

function renderForm(path: string, form: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MantineProvider>
        <I18nProvider>{form}</I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

describe('Income cashflow form permission boundaries', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getIncomeCashflowOrganizations).mockResolvedValue([])
    vi.mocked(getIncomeCashflowPaymentMovements).mockResolvedValue([])
    vi.mocked(searchIncomeCashflowPaymentRegisters).mockResolvedValue([])
    vi.mocked(getCurrentEuroExchangeRate).mockResolvedValue(1)
  })

  it('derives the client-form permission from the selected immutable operation type', async () => {
    allowedPermissions.add(incomeOrderPermissions.CreateClientPayment)
    const denied = renderForm(
      '/accounting/income-cashflows/new/client?type=0&operationType=1',
      <IncomeCashflowClientFormPage />,
    )

    expect(screen.getByText('Немає права створювати цей прибутковий ордер')).toBeTruthy()
    expect(getIncomeCashflowOrganizations).not.toHaveBeenCalled()
    denied.unmount()

    allowedPermissions.add(incomeOrderPermissions.CreateSupplierReturn)
    renderForm(
      '/accounting/income-cashflows/new/client?type=0&operationType=1',
      <IncomeCashflowClientFormPage />,
    )

    await waitFor(() => expect(getIncomeCashflowOrganizations).toHaveBeenCalled())
  })

  it('does not mount other-income resources without other_income.create', () => {
    renderForm(
      '/accounting/income-cashflows/new/conversion?type=0',
      <IncomeCashflowConversionFormPage />,
    )

    expect(screen.getByText('Немає права створювати інше надходження')).toBeTruthy()
    expect(getIncomeCashflowOrganizations).not.toHaveBeenCalled()
  })

  it('does not mount colleague-return resources without colleague_return.create', () => {
    renderForm(
      '/accounting/income-cashflows/new/user',
      <IncomeCashflowUserFormPage />,
    )

    expect(screen.getByText('Немає права створювати повернення від колеги')).toBeTruthy()
    expect(getIncomeCashflowOrganizations).not.toHaveBeenCalled()
  })
})
