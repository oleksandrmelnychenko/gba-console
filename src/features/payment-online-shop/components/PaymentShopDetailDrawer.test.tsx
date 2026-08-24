import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  RetailPaymentStatusType,
  type PaymentShopItem,
  type RetailPaymentStatusTypeValue,
} from '../types'
import { PaymentShopDetailDrawer } from './PaymentShopDetailDrawer'

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (message: string) => message }),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened, title }: { children: ReactNode; opened: boolean; title: ReactNode }) =>
    opened ? (
      <section>
        <h1>{title}</h1>
        {children}
      </section>
    ) : null,
}))

vi.mock('./PaymentImageList', () => ({
  PaymentImageList: () => <div>Список підтверджень</div>,
}))

vi.mock('./PaymentShopOrderItemsTable', () => ({
  PaymentShopOrderItemsTable: () => <div>Позиції замовлення</div>,
}))

function createPayment(status: RetailPaymentStatusTypeValue): PaymentShopItem {
  return {
    Id: 10142,
    RetailClient: {
      Name: 'Тестовий покупець',
      PhoneNumber: '+380000000000',
    },
    RetailClientPaymentImageItems: [],
    RetailPaymentStatus: {
      Amount: 0,
      AmountToPay: 0,
      PaidAmount: 0,
      RetailPaymentStatusType: status,
    },
    Sale: {
      Created: '2026-08-24T10:00:00',
      Order: { OrderItems: [] },
      SaleNumber: { Value: 'SHOP-1157' },
    },
  }
}

describe('PaymentShopDetailDrawer', () => {
  it('shows the manager confirmation workflow for a new shop payment', () => {
    const onAddPayment = vi.fn()

    render(
      <MantineProvider env="test">
        <PaymentShopDetailDrawer
          createError={null}
          isCreating={false}
          item={createPayment(RetailPaymentStatusType.New)}
          onAddPayment={onAddPayment}
          onClose={vi.fn()}
          onEditItem={vi.fn()}
        />
      </MantineProvider>,
    )

    expect(screen.getByText('Очікує підтвердження')).toBeTruthy()
    expect(screen.getByText('Підтвердження оплати менеджером')).toBeTruthy()
    expect(
      screen.getByText(
        'Після збереження суми статус стане підтвердженим, і рахунок можна буде змінити на накладну.',
      ),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити оплату' }))

    expect(screen.getByText('Вкажіть суму оплати або передплати')).toBeTruthy()
    expect(onAddPayment).not.toHaveBeenCalled()
  })

  it('keeps a paid shop payment read-only', () => {
    render(
      <MantineProvider env="test">
        <PaymentShopDetailDrawer
          createError={null}
          isCreating={false}
          item={createPayment(RetailPaymentStatusType.Paid)}
          onAddPayment={vi.fn()}
          onClose={vi.fn()}
          onEditItem={vi.fn()}
        />
      </MantineProvider>,
    )

    expect(screen.getByText('Оплачено')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Підтвердити оплату' }),
    ).toBeNull()
  })
})
