import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { DirectSupplyOrder } from '../types'
import { DirectSupplyOrderProFormCard } from './DirectSupplyOrderProFormCard'

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

function renderCard(order: DirectSupplyOrder) {
  render(
    <MantineProvider>
      <I18nProvider>
        <DirectSupplyOrderProFormCard
          canEdit
          order={order}
          onError={() => undefined}
          onOrderUpdated={() => undefined}
          onReload={async () => undefined}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

const orderNetUid = '5c4de72c-471a-465d-a05b-77ce00726b96'

describe('proforma fields', () => {
  it('shows a saved proforma date as a date, without a time', () => {
    renderCard({
      IsApproved: true,
      NetUid: orderNetUid,
      SupplyProForm: { DateFrom: '2026-11-17T00:00:00', Id: 17, NetPrice: 100, Number: 'PF-17' },
      SupplyProFormId: 17,
    })

    expect(screen.getByText('17.11.26')).toBeTruthy()
    expect(screen.queryByText(/17\.11\.26,/)).toBeNull()
  })

  it('marks Документи as required and reports a negative amount instead of dropping the minus', () => {
    renderCard({ IsApproved: true, NetPrice: 10, NetUid: orderNetUid, SupplyProForm: null, SupplyProFormId: null })

    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))

    expect(screen.getByText('Документи').textContent).toContain('*')
    const amount = screen.getByRole('textbox', { name: /Сума нетто/ }) as HTMLInputElement
    fireEvent.change(amount, { target: { value: '-5' } })

    expect(amount.value).toBe('-5')
    expect(amount.getAttribute('aria-invalid')).toBe('true')
  })
})
