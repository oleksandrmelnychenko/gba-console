import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { SupplyOrderUkrainePaymentDeliveryProtocol } from '../types'
import { PaymentDeliveryProtocolsSection } from './PaymentDeliveryProtocolsSection'

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer, opened }: { children: ReactNode; footer?: ReactNode; opened: boolean }) => opened ? (
    <div>
      {children}
      {footer}
    </div>
  ) : null,
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <div>{children}</div> : null,
}))

const managementProtocol: SupplyOrderUkrainePaymentDeliveryProtocol = {
  Discount: 100,
  IsAccounting: false,
  NetUid: 'management-protocol',
  SupplyOrderUkrainePaymentDeliveryProtocolKey: { Key: 'Платіж' },
  Value: 1_000,
}

function renderSection(
  protocols: SupplyOrderUkrainePaymentDeliveryProtocol[],
  onCreateProtocol = vi.fn().mockResolvedValue(undefined),
  users: Array<{ FirstName?: string; LastName?: string; NetUid?: string }> = [],
) {
  render(
    <MantineProvider>
      <PaymentDeliveryProtocolsSection
        canCreateProtocol
        canRemoveProtocol={false}
        isSaving={false}
        protocolKeys={[{ Key: 'Платіж', NetUid: 'payment-key' }]}
        protocols={protocols}
        totalGrossPriceLocal={1_000}
        users={users}
        onCreateProtocol={onCreateProtocol}
        onRemoveProtocol={vi.fn().mockResolvedValue(undefined)}
      />
    </MantineProvider>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Створити платіжну задачу' }))

  return onCreateProtocol
}

describe('PaymentDeliveryProtocolsSection amount validation', () => {
  it('allows an accounting payment when management payments already cover the order', () => {
    const onCreateProtocol = renderSection([managementProtocol])

    fireEvent.click(screen.getByRole('checkbox', { name: 'Бух. витрата' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Вартість Брутто' }), {
      target: { value: '10' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(screen.queryByText('Сума платежів не може бути більшою за суму замовлення')).toBeNull()
    expect(onCreateProtocol).toHaveBeenCalledWith(expect.objectContaining({
      isAccounting: true,
      value: '10',
    }))
  })

  it('still rejects payments that exceed the order within the same accounting mode', () => {
    const onCreateProtocol = renderSection([managementProtocol])

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Вартість Брутто' }), {
      target: { value: '10' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(screen.getByText('Сума платежів не може бути більшою за суму замовлення')).toBeTruthy()
    expect(onCreateProtocol).not.toHaveBeenCalled()
  })

  it('keeps the entered percentage when accounting mode is toggled', () => {
    renderSection([])

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Відсоток' }), {
      target: { value: '50' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Бух. витрата' }))

    expect((screen.getByRole('spinbutton', { name: 'Відсоток' }) as HTMLInputElement).value).toBe('50')
    expect((screen.getByRole('spinbutton', { name: 'Вартість Брутто' }) as HTMLInputElement).value).toBe('500')
  })

  it('keeps a responsible user selected when the control normalizes GUID casing', () => {
    const onCreateProtocol = renderSection([], undefined, [{
      FirstName: 'Алла',
      LastName: 'Самолюк',
      NetUid: 'A9B6242E-4E72-43CC-91FA-41A691C538F1',
    }])

    fireEvent.change(screen.getByRole('combobox', { name: 'Відповідальний за оплату' }), {
      target: { value: 'a9b6242e-4e72-43cc-91fa-41a691c538f1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(onCreateProtocol).toHaveBeenCalledWith(expect.objectContaining({
      responsible: expect.objectContaining({ LastName: 'Самолюк' }),
    }))
  })
})
