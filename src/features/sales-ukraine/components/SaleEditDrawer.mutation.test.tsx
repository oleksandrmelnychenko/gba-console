import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { theme } from '../../../shared/theme/theme'
import {
  clearAllSalesPendingMutations,
  saveSalesPendingMutation,
  type SalesPendingMutationScope,
} from '../pendingSalesMutationRegistry'
import { createSaleJsonMutationSubmission } from '../saleJsonMutation'
import type { SalesUkraineSale } from '../types'
import { SaleEditDrawer } from './SaleEditDrawer'

const mocks = vi.hoisted(() => ({
  getShiftedSaleById: vi.fn(),
  notificationsShow: vi.fn(),
  shiftOrderItemsCurrent: vi.fn(),
}))

vi.mock('../../../shared/i18n/useI18n', () => {
  const t = (key: string) => key

  return { useI18n: () => ({ t }) }
})

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ session: { userNetUid: 'USER-A' } }),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mocks.notificationsShow },
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer, opened }: {
    children: React.ReactNode
    footer?: React.ReactNode
    opened: boolean
  }) => opened ? <div>{children}{footer}</div> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: () => <div data-testid="sale-edit-table" />,
}))

vi.mock('../api/salesUkraineApi', () => ({
  getShiftedSaleById: mocks.getShiftedSaleById,
  shiftOrderItemsCurrent: mocks.shiftOrderItemsCurrent,
}))

const scope: SalesPendingMutationScope = {
  context: 'sale-shift-current:sale-1',
  kind: 'sale-shift-current',
  userKey: 'net:user-a',
}

const sale: SalesUkraineSale = {
  BaseLifeCycleStatus: { SaleLifeCycleType: 1 },
  Id: 1,
  NetUid: 'sale-1',
  Order: {
    OrderItems: [{
      Id: 11,
      NetUid: 'item-1',
      Product: { Name: 'Product', VendorCode: 'P-1' },
      Qty: 2,
      TotalAmount: 20,
    }],
  },
  SaleNumber: { Value: 'INV-1' },
}

const fontsDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts')

beforeEach(() => {
  clearAllSalesPendingMutations()
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  })
  mocks.getShiftedSaleById.mockReset().mockResolvedValue(structuredClone(sale))
  mocks.notificationsShow.mockReset()
  mocks.shiftOrderItemsCurrent.mockReset()
})

afterEach(() => {
  cleanup()
  clearAllSalesPendingMutations()

  if (fontsDescriptor) {
    Object.defineProperty(document, 'fonts', fontsDescriptor)
  } else {
    Reflect.deleteProperty(document, 'fonts')
  }
})

describe('SaleEditDrawer pending operation recovery', () => {
  it('exposes an explicit retry and replays the frozen edit with the same key', async () => {
    const frozenSale: SalesUkraineSale = {
      ...structuredClone(sale),
      Order: {
        ...structuredClone(sale.Order),
        OrderItems: [{
          ...structuredClone(sale.Order?.OrderItems?.[0]),
          ShiftStatuses: [{ Id: 0, OrderItemId: 11, Qty: 2, ShiftStatus: 0 }],
        }],
      },
    }
    const submission = createSaleJsonMutationSubmission(
      'sale-shift-current',
      frozenSale,
      '11111111-1111-4111-8111-111111111111',
    )
    saveSalesPendingMutation(scope, submission.operationId, submission)
    const sentBodies: string[] = []
    const operationIds: string[] = []
    mocks.shiftOrderItemsCurrent
      .mockImplementationOnce(async (payload, operation) => {
        sentBodies.push(JSON.stringify(payload))
        operationIds.push(operation.operationId)
        throw new ApiError('Сервер ще не підтвердив операцію', 503, null)
      })
      .mockImplementationOnce(async (payload, operation) => {
        sentBodies.push(JSON.stringify(payload))
        operationIds.push(operation.operationId)

        return payload
      })
    const onSaved = vi.fn()

    render(
      <MantineProvider theme={theme}>
        <SaleEditDrawer
          sale={sale}
          onClose={vi.fn()}
          onSaved={onSaved}
        />
      </MantineProvider>,
    )

    await waitFor(() => expect(mocks.shiftOrderItemsCurrent).toHaveBeenCalledTimes(1))
    const retry = await screen.findByRole('button', { name: 'Перевірити та повторити' })
    await waitFor(() => expect((retry as HTMLButtonElement).disabled).toBe(false))
    expect((screen.getByRole('button', { name: 'Зробити зсув' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(retry)

    await waitFor(() => expect(mocks.shiftOrderItemsCurrent).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
    expect(operationIds).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111',
    ])
    expect(sentBodies[1]).toBe(sentBodies[0])
    expect(sentBodies[1]).toContain('ShiftStatuses')
  })
})
