import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/apiClient'
import { theme } from '../../../shared/theme/theme'
import {
  clearAllSalesPendingMutations,
  loadSalesPendingMutation,
} from '../pendingSalesMutationRegistry'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../types'
import { SaleDiscountModal } from './SaleDiscountModal'
import { buildSaleDiscountPayload } from './saleDiscountPayload'

const { getSaleByIdMock, notificationsShowMock, updateSaleDiscountMock } = vi.hoisted(() => ({
  getSaleByIdMock: vi.fn(),
  notificationsShowMock: vi.fn(),
  updateSaleDiscountMock: vi.fn(),
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ session: { userNetUid: 'USER-A' } }),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: notificationsShowMock },
}))

vi.mock('../api/salesUkraineApi', () => ({
  getSaleById: getSaleByIdMock,
  updateSaleDiscount: updateSaleDiscountMock,
}))

function sale(status: number): SalesUkraineSale {
  return {
    BaseLifeCycleStatus: { SaleLifeCycleType: status },
    Id: 10,
    NetUid: 'sale-a',
    Updated: '2026-07-14T10:00:00Z',
    OneTimeDiscountComment: 'old sale comment',
    Order: {
      OrderItems: [
        {
          Id: 101,
          NetUid: 'item-a',
          Updated: '2026-07-14T10:00:01Z',
          OneTimeDiscount: 5,
          OneTimeDiscountComment: 'old item a',
        },
        {
          Id: 102,
          NetUid: 'item-b',
          Updated: '2026-07-14T10:00:02Z',
          OneTimeDiscount: 9,
          OneTimeDiscountComment: 'old item b',
        },
      ],
    },
  }
}

function renderModal(value: SalesUkraineSale, orderItem: SalesUkraineOrderItem | null = null) {
  getSaleByIdMock.mockResolvedValue(structuredClone(value))
  const onSaved = vi.fn()

  return {
    ...render(
    <MantineProvider theme={theme}>
      <SaleDiscountModal
        orderItem={orderItem}
        sale={value}
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    </MantineProvider>,
    ),
    onSaved,
  }
}

describe('SaleDiscountModal', () => {
  beforeAll(() => {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    })
  })

  beforeEach(() => {
    clearAllSalesPendingMutations()
    getSaleByIdMock.mockReset()
    notificationsShowMock.mockReset()
    updateSaleDiscountMock.mockReset()
    updateSaleDiscountMock.mockImplementation(async (payload: SalesUkraineSale) => payload)
  })

  it('locks the Packaging percentage and submits a comment-only update', async () => {
    renderModal(sale(1))

    const amount = screen.getByLabelText('Відсоток знижки')
    const comment = screen.getByLabelText('Коментар')

    expect((amount as HTMLInputElement).disabled).toBe(true)
    expect((comment as HTMLTextAreaElement).disabled).toBe(false)
    expect(screen.getByText('Відсоток знижки зафіксовано на етапі пакування. Можна змінити лише коментар')).toBeTruthy()

    fireEvent.change(comment, { target: { value: 'packaging approval' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(updateSaleDiscountMock).toHaveBeenCalledTimes(1))
    expect(getSaleByIdMock).toHaveBeenCalledWith('sale-a')

    const payload = updateSaleDiscountMock.mock.calls[0]?.[0] as SalesUkraineSale
    expect(payload.OneTimeDiscountComment).toBe('packaging approval')
    expect(payload.Order?.OrderItems?.map((item) => item.OneTimeDiscount)).toEqual([5, 9])
    expect(payload.Order?.OrderItems?.map((item) => item.OneTimeDiscountComment)).toEqual([
      'packaging approval',
      'packaging approval',
    ])
  })

  it('keeps normal New-sale percentage and comment editing', async () => {
    renderModal(sale(0))

    const amount = screen.getByLabelText('Відсоток знижки')
    const comment = screen.getByLabelText('Коментар')

    expect((amount as HTMLInputElement).disabled).toBe(false)
    expect((comment as HTMLTextAreaElement).disabled).toBe(false)

    fireEvent.change(amount, { target: { value: '12' } })
    fireEvent.change(comment, { target: { value: 'new sale approval' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(updateSaleDiscountMock).toHaveBeenCalledTimes(1))

    const payload = updateSaleDiscountMock.mock.calls[0]?.[0] as SalesUkraineSale
    expect(payload.OneTimeDiscountComment).toBe('new sale approval')
    expect(payload.Order?.OrderItems?.map((item) => item.OneTimeDiscount)).toEqual([12, 12])
    expect(payload.Order?.OrderItems?.map((item) => item.OneTimeDiscountComment)).toEqual([
      'new sale approval',
      'new sale approval',
    ])
  })

  it('sends only the changed item and omits stale sibling comments for a Packaging comment update', () => {
    const value = sale(1)
    const target = value.Order?.OrderItems?.[1] ?? null
    const payload = buildSaleDiscountPayload(value, target, 99, 'item-only approval', false)

    expect(payload).not.toHaveProperty('OneTimeDiscountComment')
    expect(payload.Order?.OrderItems).toEqual([
      {
        Id: 102,
        NetUid: 'item-b',
        Updated: '2026-07-14T10:00:02Z',
        OneTimeDiscount: 9,
        OneTimeDiscountComment: 'item-only approval',
      },
    ])
    expect(JSON.stringify(payload)).not.toContain('old item a')
  })

  it('detects a concurrent discount change before submitting', async () => {
    const value = sale(0)
    renderModal(value)
    const fresh = structuredClone(value)
    fresh.Order!.OrderItems![0]!.OneTimeDiscount = 33
    getSaleByIdMock.mockResolvedValueOnce(fresh)

    fireEvent.change(screen.getByLabelText('Коментар'), { target: { value: 'my approval' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(getSaleByIdMock).toHaveBeenCalledWith('sale-a'))
    expect(updateSaleDiscountMock).not.toHaveBeenCalled()
    expect(notificationsShowMock).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'orange', message: expect.stringContaining('інший користувач') }),
    )
  })

  it('refreshes an item target and settles a marked pre-ledger validation error', async () => {
    const value = sale(0)
    const target = value.Order?.OrderItems?.[1] ?? null
    renderModal(value, target)
    updateSaleDiscountMock.mockRejectedValueOnce(new ApiError(
      'Discount row changed on server',
      400,
      { MutationLedgerState: 'not-entered' },
    ))

    fireEvent.change(screen.getByLabelText('Коментар'), { target: { value: 'item approval' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(updateSaleDiscountMock).toHaveBeenCalledTimes(1))
    expect(updateSaleDiscountMock.mock.calls[0]?.[0]).not.toHaveProperty('OneTimeDiscountComment')
    expect(await screen.findByText('Discount row changed on server')).toBeTruthy()
    expect(loadSalesPendingMutation({
      context: 'sale-discount:sale-a:item-b',
      kind: 'sale-discount',
      userKey: 'net:user-a',
    })).toBe(null)
    expect(notificationsShowMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ color: 'red' }),
    )
  })

  it('retries an unknown discount outcome with the same frozen body and operation key', async () => {
    const value = sale(0)
    const bodies: string[] = []
    const operationIds: string[] = []
    renderModal(value)
    updateSaleDiscountMock
      .mockImplementationOnce(async (payload: SalesUkraineSale, operation: { operationId: string }) => {
        bodies.push(JSON.stringify(payload))
        operationIds.push(operation.operationId)
        throw new ApiError('timeout', 500, null)
      })
      .mockImplementationOnce(async (payload: SalesUkraineSale, operation: { operationId: string }) => {
        bodies.push(JSON.stringify(payload))
        operationIds.push(operation.operationId)

        return payload
      })

    fireEvent.change(screen.getByLabelText('Відсоток знижки'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('Коментар'), { target: { value: 'frozen approval' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(updateSaleDiscountMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText(/timeout/)).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(updateSaleDiscountMock).toHaveBeenCalledTimes(2))
    expect(operationIds[1]).toBe(operationIds[0])
    expect(bodies[1]).toBe(bodies[0])
    expect(getSaleByIdMock).toHaveBeenCalledTimes(1)
  })

  it('treats a nullable 2xx response as success and closes the mutation journal', async () => {
    const value = sale(0)
    updateSaleDiscountMock.mockResolvedValueOnce(null)
    const { onSaved } = renderModal(value)

    fireEvent.change(screen.getByLabelText('Коментар'), { target: { value: 'accepted without body' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(null))
    expect(notificationsShowMock).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'green', message: 'Знижку збережено' }),
    )
  })

  it('does not share a pending discount journal between rows with the same source provenance', async () => {
    const value = sale(0)
    const first = value.Order!.OrderItems![0]!
    const second = value.Order!.OrderItems![1]!
    first.SourceOrderItemNetUid = 'shared-source-row'
    second.SourceOrderItemNetUid = 'shared-source-row'
    updateSaleDiscountMock.mockRejectedValueOnce(new ApiError('first row pending', 500, null))
    const firstModal = renderModal(value, first)

    fireEvent.change(screen.getByLabelText('Коментар'), { target: { value: 'first row update' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(screen.getByText(/first row pending/)).toBeTruthy())
    firstModal.unmount()

    renderModal(value, second)

    await waitFor(() => expect(screen.queryByText(/first row pending/)).toBe(null))
    expect((screen.getByLabelText('Коментар') as HTMLTextAreaElement).disabled).toBe(false)
  })
})
