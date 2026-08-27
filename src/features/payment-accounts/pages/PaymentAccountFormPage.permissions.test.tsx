import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getPaymentAccount } from '../api/paymentAccountsApi'
import type { PaymentAccount, PaymentRegisterCurrencyExchange, PaymentRegisterTransfer } from '../types'
import { PaymentRegisterType } from '../types'
import { PaymentAccountActivityPanel, PaymentAccountFormPage } from './PaymentAccountFormPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => allowedPermissions.has(permission),
    isLoading: false,
  }),
}))

vi.mock('../api/paymentAccountsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/paymentAccountsApi')>(),
  getPaymentAccount: vi.fn(),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    columns,
    data,
  }: {
    columns: Array<{ cell?: (row: unknown) => ReactNode; id: string }>
    data: unknown[]
  }) => (
    <div>
      {data.flatMap((row, rowIndex) =>
        columns.map((column) => (
          <div key={`${rowIndex}-${column.id}`}>{column.cell?.(row)}</div>
        )),
      )}
    </div>
  ),
}))

const account: PaymentAccount = {
  Name: 'Основний рахунок',
  NetUid: 'account-1',
  Type: PaymentRegisterType.Bank,
  PaymentCurrencyRegisters: [],
}

const transfer: PaymentRegisterTransfer = {
  NetUid: 'transfer-1',
  Number: 'TR-1',
}

const exchange: PaymentRegisterCurrencyExchange = {
  NetUid: 'exchange-1',
  Number: 'EX-1',
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider>
      <I18nProvider>{children}</I18nProvider>
    </MantineProvider>
  )
}

function renderActivity({
  activeTab,
  canCancelExchange = false,
  canCancelTransfer = false,
  canCreateExchange = false,
  canCreateTransfer = false,
}: {
  activeTab: 'transfers' | 'exchanges'
  canCancelExchange?: boolean
  canCancelTransfer?: boolean
  canCreateExchange?: boolean
  canCreateTransfer?: boolean
}) {
  return render(
    <Providers>
      <PaymentAccountActivityPanel
        account={account}
        activeTab={activeTab}
        canCancelExchange={canCancelExchange}
        canCancelTransfer={canCancelTransfer}
        canCreateExchange={canCreateExchange}
        canCreateTransfer={canCreateTransfer}
        from="2026-08-01"
        isLoadingAccount={false}
        selectedCurrencyRegister={null}
        state={{
          currencyActivity: null,
          error: null,
          exchanges: [exchange],
          isLoading: false,
          transfers: [transfer],
        }}
        to="2026-08-18"
        onActiveTabChange={vi.fn()}
        onFromChange={vi.fn()}
        onOpenIncome={vi.fn()}
        onOpenOutgoing={vi.fn()}
        onMutationComplete={vi.fn().mockResolvedValue(undefined)}
        onRefresh={vi.fn()}
        onSelectedCurrencyChange={vi.fn()}
        onToChange={vi.fn()}
      />
    </Providers>,
  )
}

describe('payment-account canonical permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
  })

  it('does not mount a direct account route without page access', () => {
    render(
      <Providers>
        <MemoryRouter initialEntries={['/accounting/payment-accounts/edit/account-1']}>
          <Routes>
            <Route path="/accounting/payment-accounts/edit/:id" element={<PaymentAccountFormPage />} />
          </Routes>
        </MemoryRouter>
      </Providers>,
    )

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getPaymentAccount).not.toHaveBeenCalled()
  })

  it('keeps transfer and exchange creation independent', () => {
    const view = renderActivity({ activeTab: 'transfers', canCreateTransfer: true })

    expect(screen.getByRole('button', { name: 'Переказ' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Обмін' })).toBeNull()

    view.unmount()
    renderActivity({ activeTab: 'exchanges', canCreateExchange: true })

    expect(screen.queryByRole('button', { name: 'Переказ' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Обмін' })).toBeTruthy()
  })

  it('keeps transfer and exchange cancellation independent', () => {
    const view = renderActivity({ activeTab: 'transfers', canCancelTransfer: true })

    expect(screen.getByRole('button', { name: 'Скасувати' })).toBeTruthy()

    view.unmount()
    renderActivity({ activeTab: 'exchanges', canCancelExchange: false })

    expect(screen.queryByRole('button', { name: 'Скасувати' })).toBeNull()
  })
})
