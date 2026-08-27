import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { AccountableExpenseActionsModal } from '../../accountable-expenses/pages/AccountableExpensesPage'
import type { AccountableExpenseRow } from '../../accountable-expenses/types'
import type { ConsumableOrderRow } from '../types'
import { ConsumableOrderActionsModal } from './ConsumableOrdersPage'

function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider>
      <I18nProvider>{children}</I18nProvider>
    </MantineProvider>
  )
}

const orderRow = {
  isPayed: false,
  order: { Number: 'CO-1' },
} as ConsumableOrderRow

const expenseRow = {
  order: {},
  paymentStatus: 'unpaid',
  productName: 'Послуга',
} as AccountableExpenseRow

describe('consumable-order action permission composition', () => {
  it('keeps registry edit and payment actions independent', () => {
    const view = render(
      <Providers>
        <ConsumableOrderActionsModal
          row={orderRow}
          onClose={vi.fn()}
          onOpenDetails={vi.fn()}
          onPay={vi.fn()}
        />
      </Providers>,
    )

    expect(screen.getByRole('button', { name: 'Деталі' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Оплатити' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull()

    view.unmount()
    render(
      <Providers>
        <ConsumableOrderActionsModal
          row={orderRow}
          onClose={vi.fn()}
          onOpenDetails={vi.fn()}
          onView={vi.fn()}
        />
      </Providers>,
    )

    expect(screen.getByRole('button', { name: 'Редагувати' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Оплатити' })).toBeNull()
  })

  it('keeps accountable-expense invoice access and payment independent', () => {
    const view = render(
      <Providers>
        <AccountableExpenseActionsModal
          row={expenseRow}
          onClose={vi.fn()}
          onDetails={vi.fn()}
          onPay={vi.fn()}
        />
      </Providers>,
    )

    expect(screen.getByRole('button', { name: 'Деталі' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Оплатити' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Відкрити накладну' })).toBeNull()

    view.unmount()
    render(
      <Providers>
        <AccountableExpenseActionsModal
          row={expenseRow}
          onClose={vi.fn()}
          onDetails={vi.fn()}
          onEdit={vi.fn()}
        />
      </Providers>,
    )

    expect(screen.getByRole('button', { name: 'Відкрити накладну' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Оплатити' })).toBeNull()
  })
})
