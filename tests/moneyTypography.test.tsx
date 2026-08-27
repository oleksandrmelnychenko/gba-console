import { fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OnlineShopOrderItemsList } from '../src/features/clients/components/OnlineShopOrderItemsList'
import { PaymentInfoForm } from '../src/features/online-shop-seo/components/OnlineShopSeoControls'
import { I18nProvider } from '../src/shared/i18n/I18nProvider'
import { renderWithMantine } from '../src/test/renderWithMantine'

describe('money typography outside numeric tables', () => {
  it('styles retail unit, source and total amounts without the cart CSS scope', () => {
    const view = renderWithMantine(
      <I18nProvider>
        <OnlineShopOrderItemsList
          currencyCode="UAH"
          emptyText="Немає товарів"
          items={[{ ProductName: 'Тестовий товар', Qty: 2, TotalAmountLocal: 1200, PricePerItem: 15, CurrencyCode: 'EUR' }]}
        />
      </I18nProvider>,
    )
    expect(view.container.querySelectorAll('.app-money').length).toBe(3)
    expect(view.getByText('Тестовий товар').closest('.app-money')).toBeNull()
    expect(view.container.querySelector('.online-shop-order-item-quantity')?.closest('.app-money')).toBeNull()
    expect(view.container.querySelector('.online-shop-clients-cart-body')).toBeNull()
  })

  it('styles only numeric prices in mixed text/amount inputs and preserves typed values', () => {
    const onSave = vi.fn()
    const view = renderWithMantine(
      <I18nProvider>
        <PaymentInfoForm
          isSaving={false}
          locale="uk"
          onSave={onSave}
          payment={{ Id: 1, LowPrice: '500 грн', FullPrice: 'За домовленістю' }}
        />
      </I18nProvider>,
    )
    const amount = view.getByLabelText('Передплата') as HTMLInputElement
    const text = view.getByLabelText('Повна ціна') as HTMLInputElement
    expect(amount.classList.contains('app-money')).toBe(true)
    expect(text.classList.contains('app-money')).toBe(false)

    fireEvent.change(text, { target: { value: '1 500,50' } })
    expect(text.classList.contains('app-money')).toBe(true)
    expect(text.value).toBe('1 500,50')
    fireEvent.change(amount, { target: { value: 'Без передплати' } })
    expect(amount.classList.contains('app-money')).toBe(false)
    expect(amount.value).toBe('Без передплати')
    expect(onSave).not.toHaveBeenCalled()
  })
})
