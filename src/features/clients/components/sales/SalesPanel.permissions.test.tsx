import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../../shared/auth/permissionKeys'
import { getSaleStatisticBySaleId, getSalesByClient } from '../../api/clientSalesApi'
import { SaleLifeCycleType, SalePaymentStatusType } from '../../salesTypes'
import { SalesPanel } from './SalesPanel'

const authState = vi.hoisted(() => ({
  permissions: new Set<string>(),
  t: (value: string) => value,
}))

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: (key: string) => authState.permissions.has(key) }),
}))

vi.mock('../../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: authState.t }),
}))

vi.mock('../../api/clientSalesApi', () => ({
  getSaleStatisticBySaleId: vi.fn(),
  getSalesByClient: vi.fn(),
}))

describe('SalesPanel permissions', () => {
  beforeEach(() => {
    authState.permissions = new Set()
    vi.mocked(getSaleStatisticBySaleId).mockReset().mockResolvedValue(null)
    vi.mocked(getSalesByClient).mockReset().mockResolvedValue([
      {
        NetUid: 'statistic-1',
        Sale: {
          NetUid: 'sale-1',
          TotalCount: 1,
          BaseLifeCycleStatus: { SaleLifeCycleType: SaleLifeCycleType.Packaging },
          BaseSalePaymentStatus: { SalePaymentStatusType: SalePaymentStatusType.Paid },
          SaleNumber: { Value: 'S-1' },
          Transporter: { Name: 'Нова пошта' },
        },
      },
    ])
  })

  it('does not load client sales without sale.view', () => {
    renderPanel()

    expect(getSalesByClient).not.toHaveBeenCalled()
    expect(screen.getByText('Клієнта не вибрано')).toBeTruthy()
  })

  it('shows each sale action only with its matching existing permission', async () => {
    authState.permissions = new Set([
      PermissionKeys.SalesUkraine.Sale.View,
      PermissionKeys.SalesUkraine.Sale.ViewAudit,
    ])
    renderPanel()

    await waitFor(() => expect(screen.getByText('S-1')).toBeTruthy())

    expect(screen.queryByLabelText('Переглянути продаж')).toBeNull()
    expect(screen.getByLabelText('Рух ТМЦ')).toBeTruthy()
    expect(screen.queryByLabelText('Нова пошта')).toBeNull()
  })

  it('maps details and delivery to their existing Sales Ukraine rights', async () => {
    authState.permissions = new Set([
      PermissionKeys.SalesUkraine.Sale.View,
      PermissionKeys.SalesUkraine.Sale.OpenDetails,
      PermissionKeys.SalesUkraine.Sale.OpenDeliveryDetails,
    ])
    renderPanel()

    await waitFor(() => expect(screen.getByText('S-1')).toBeTruthy())

    expect(screen.getByLabelText('Переглянути продаж')).toBeTruthy()
    expect(screen.queryByLabelText('Рух ТМЦ')).toBeNull()
    expect(screen.getByLabelText('Нова пошта')).toBeTruthy()
  })
})

function renderPanel() {
  return render(
    <MantineProvider>
      <SalesPanel netId="client-1" />
    </MantineProvider>,
  )
}
