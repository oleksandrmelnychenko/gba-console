import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../../shared/auth/permissionKeys'
import {
  confirmSaleActForEditing,
  getSaleStatisticBySaleId,
  getSalesByClient,
  getShiftedSaleDocument,
  getShiftedSaleHistoryDocument,
} from '../../api/clientSalesApi'
import { SaleLifeCycleType, SalePaymentStatusType } from '../../salesTypes'
import { SalesPanel } from './SalesPanel'

const authState = vi.hoisted(() => ({
  permissions: new Set<string>(),
  t: (value: string) => value,
}))

const auditDetailState = vi.hoisted(() => ({
  props: null as null | Record<string, unknown>,
}))

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: (key: string) => authState.permissions.has(key) }),
}))

vi.mock('../../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: authState.t }),
}))

vi.mock('../../api/clientSalesApi', () => ({
  confirmSaleActForEditing: vi.fn(),
  getSaleStatisticBySaleId: vi.fn(),
  getSalesByClient: vi.fn(),
  getShiftedSaleDocument: vi.fn(),
  getShiftedSaleHistoryDocument: vi.fn(),
}))

vi.mock('../../../../shared/sale-audit', () => ({
  SaleAuditDetail: (props: Record<string, unknown>) => {
    auditDetailState.props = props
    return <div data-testid="sale-audit-detail" />
  },
}))

describe('SalesPanel permissions', () => {
  beforeEach(() => {
    authState.permissions = new Set()
    auditDetailState.props = null
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

    fireEvent.click(screen.getByLabelText('Рух ТМЦ'))
    await waitFor(() => expect(screen.getByTestId('sale-audit-detail')).toBeTruthy())

    expect(auditDetailState.props?.showConfirm).toBe(false)
    expect(auditDetailState.props?.documentApi).toEqual({
      confirm: confirmSaleActForEditing,
      getInvoice: getShiftedSaleDocument,
      getShifted: getShiftedSaleHistoryDocument,
    })
  })

  it('maps edit and delivery to their exact Sales Ukraine rights', async () => {
    authState.permissions = new Set([
      PermissionKeys.SalesUkraine.Sale.View,
      PermissionKeys.SalesUkraine.Sale.Edit,
      PermissionKeys.SalesUkraine.Sale.OpenDeliveryDetails,
    ])
    renderPanel()

    await waitFor(() => expect(screen.getByText('S-1')).toBeTruthy())

    expect(screen.getByLabelText('Переглянути продаж')).toBeTruthy()
    expect(screen.queryByLabelText('Рух ТМЦ')).toBeNull()
    expect(screen.getByLabelText('Нова пошта')).toBeTruthy()
  })

  it('allows audit confirmation only with sale.edit', async () => {
    authState.permissions = new Set([
      PermissionKeys.SalesUkraine.Sale.View,
      PermissionKeys.SalesUkraine.Sale.ViewAudit,
      PermissionKeys.SalesUkraine.Sale.Edit,
    ])
    renderPanel()

    await waitFor(() => expect(screen.getByText('S-1')).toBeTruthy())
    fireEvent.click(screen.getByLabelText('Рух ТМЦ'))
    await waitFor(() => expect(screen.getByTestId('sale-audit-detail')).toBeTruthy())

    expect(auditDetailState.props?.showConfirm).toBe(true)
  })
})

function renderPanel() {
  return render(
    <MantineProvider>
      <SalesPanel netId="client-1" />
    </MantineProvider>,
  )
}
