import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: vi.fn(),
})

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
          canCreatePayment
          canEditPayment
          createError={null}
          createNotice={null}
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
          canCreatePayment
          canEditPayment
          createError={null}
          createNotice={null}
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

  it('keeps the manager draft when a status conflict refreshes the payment', async () => {
    const onAddPayment = vi.fn().mockResolvedValue(false)
    const props = {
      canCreatePayment: true,
      canEditPayment: true,
      createError: null,
      createNotice: null,
      isCreating: false,
      item: createPayment(RetailPaymentStatusType.New),
      onAddPayment,
      onClose: vi.fn(),
      onEditItem: vi.fn(),
    }
    const view = render(
      <MantineProvider env="test">
        <PaymentShopDetailDrawer {...props} />
      </MantineProvider>,
    )
    const image = new File(['proof'], 'payment-proof.png', {
      type: 'image/png',
    })
    const imageInput = view.container.querySelector<HTMLInputElement>(
      'input[type="file"]',
    )

    expect(imageInput).not.toBeNull()

    fireEvent.change(screen.getByLabelText('Сума'), {
      target: { value: '125.50' },
    })
    fireEvent.click(screen.getByRole('combobox', { name: 'Тип' }))
    fireEvent.click(screen.getByRole('option', { name: 'Передплата' }))
    fireEvent.change(screen.getByLabelText('Коментар'), {
      target: { value: 'Передплата за магазин' },
    })
    fireEvent.change(imageInput!, {
      target: { files: [image] },
    })

    expect((screen.getByRole('combobox', { name: 'Тип' }) as HTMLInputElement).value).toBe(
      'Передплата',
    )
    expect(screen.getByText('payment-proof.png')).toBeTruthy()

    view.rerender(
      <MantineProvider env="test">
        <PaymentShopDetailDrawer
          {...props}
          createNotice="Статус оновлено; повторіть збереження"
          item={createPayment(RetailPaymentStatusType.Confirmed)}
        />
      </MantineProvider>,
    )

    expect(screen.getByText('Статус оновлено; повторіть збереження')).toBeTruthy()
    expect((screen.getByLabelText('Сума') as HTMLInputElement).value).toBe(
      '125.5',
    )
    expect(
      (screen.getByLabelText('Коментар') as HTMLTextAreaElement).value,
    ).toBe('Передплата за магазин')
    expect((screen.getByRole('combobox', { name: 'Тип' }) as HTMLInputElement).value).toBe(
      'Передплата',
    )
    expect(screen.getByText('payment-proof.png')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити оплату' }))

    expect(screen.queryByText('Вкажіть суму оплати або передплати')).toBeNull()
    expect(screen.queryByText('Оберіть тип оплати')).toBeNull()
    expect(screen.queryByText('Додайте зображення підтвердження оплати')).toBeNull()

    await waitFor(() => {
      expect(onAddPayment).toHaveBeenCalledWith({
        amount: 125.5,
        comment: 'Передплата за магазин',
        image,
        paymentType: 0,
      })
    })
  })
})
