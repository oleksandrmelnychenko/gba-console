import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PaymentType, type RetailClientPaymentImageItem } from '../types'
import { PaymentImageEditModal } from './PaymentImageEditModal'

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (message: string) => message }),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) =>
    opened ? <section>{children}</section> : null,
}))

function createItem(
  overrides: Partial<RetailClientPaymentImageItem> = {},
): RetailClientPaymentImageItem {
  return {
    Amount: 100,
    Comment: 'server comment',
    Id: 140,
    ImgUrl: 'http://data-concord:35981/Images/PaymentConfirmation/proof.png',
    NetUid: 'payment-item-140',
    PaymentType: PaymentType.Prepayment,
    RowVersion: 'AAAAAAAF49Q=',
    Updated: '2026-08-24T12:00:00',
    ...overrides,
  }
}

describe('PaymentImageEditModal', () => {
  it('preserves the user draft when a fresh RowVersion is loaded', () => {
    const onConfirm = vi.fn()
    const props = {
      editError: null,
      editNotice: null,
      isRefreshing: false,
      isSaving: false,
      item: createItem(),
      onClose: vi.fn(),
      onConfirm,
      onRefresh: vi.fn(),
    }
    const view = render(
      <MantineProvider env="test">
        <PaymentImageEditModal {...props} />
      </MantineProvider>,
    )

    fireEvent.change(screen.getByLabelText('Сума'), {
      target: { value: '125.50' },
    })
    fireEvent.change(screen.getByLabelText('Коментар'), {
      target: { value: 'draft survives' },
    })

    view.rerender(
      <MantineProvider env="test">
        <PaymentImageEditModal
          {...props}
          editNotice="Актуальні дані завантажено"
          item={createItem({ Amount: 110, RowVersion: 'AAAAAAAF49U=' })}
        />
      </MantineProvider>,
    )

    expect((screen.getByLabelText('Сума') as HTMLInputElement).value).toBe(
      '125.50',
    )
    expect(
      (screen.getByLabelText('Коментар') as HTMLTextAreaElement).value,
    ).toBe('draft survives')
    expect(screen.getByText('Актуальні дані завантажено')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))

    expect(onConfirm).toHaveBeenCalledWith(
      125.5,
      'draft survives',
      PaymentType.Prepayment,
    )
  })

  it('proxies the stored image and offers an explicit refresh action', () => {
    const onRefresh = vi.fn()

    render(
      <MantineProvider env="test">
        <PaymentImageEditModal
          editError={null}
          editNotice={null}
          isRefreshing={false}
          isSaving={false}
          item={createItem()}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          onRefresh={onRefresh}
        />
      </MantineProvider>,
    )

    expect(
      screen
        .getByRole('link', { name: 'Підтвердження оплати' })
        .getAttribute('href'),
    ).toBe('/Images/PaymentConfirmation/proof.png')

    fireEvent.click(screen.getByRole('button', { name: 'Оновити дані' }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })
})
