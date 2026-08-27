import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
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

describe('BUG-1187 proforma approval workflow', () => {
  it('does not offer proforma creation before the order is approved', () => {
    renderCard({
      IsApproved: false,
      NetPrice: 19_084.9,
      NetUid: '5c4de72c-471a-465d-a05b-77ce00726b96',
      SupplyProForm: null,
      SupplyProFormId: null,
    })

    expect(screen.getByText('Потрібно створити')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Створити' })).toBeNull()
  })

  it('offers proforma creation after the order is approved', () => {
    renderCard({
      IsApproved: true,
      NetPrice: 19_084.9,
      NetUid: '5c4de72c-471a-465d-a05b-77ce00726b96',
      SupplyProForm: null,
      SupplyProFormId: null,
    })

    expect(screen.getByRole('button', { name: 'Створити' })).toBeTruthy()
  })

  it('keeps an already saved proforma editable for legacy inconsistent data', () => {
    renderCard({
      IsApproved: false,
      NetUid: '5c4de72c-471a-465d-a05b-77ce00726b96',
      SupplyProForm: { Id: 17, Number: 'PF-17' },
      SupplyProFormId: 17,
    })

    expect(screen.getByRole('button', { name: 'Редагувати' })).toBeTruthy()
  })
})
