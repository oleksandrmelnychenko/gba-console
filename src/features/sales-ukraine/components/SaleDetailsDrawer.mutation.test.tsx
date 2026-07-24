import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import type { SalesUkraineSale } from '../types'
import { SaleDetailsDrawer } from './SaleDetailsDrawer'

const mocks = vi.hoisted(() => ({
  getSaleById: vi.fn(),
  getSaleTransporterTypes: vi.fn(async () => []),
  reconciliationRequired: true,
  reconcile: vi.fn(),
  run: vi.fn(),
  updateSaleFromData: vi.fn(),
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

vi.mock('../api/salesUkraineApi', () => ({
  getSaleById: mocks.getSaleById,
  getSaleTransporterTypes: mocks.getSaleTransporterTypes,
  getSaleTransportersByType: vi.fn(async () => []),
  updateSaleFromData: mocks.updateSaleFromData,
}))

vi.mock('../usePersistentSaleFileMutation', () => ({
  usePersistentSaleFileMutation: () => ({
    blocked: false,
    canReconcile: true,
    pendingError: 'Сервер не підтвердив операцію',
    pendingKind: 'sale-update-file',
    reconcile: mocks.reconcile,
    reconciliationRequired: mocks.reconciliationRequired,
    requiresFileReselection: false,
    run: mocks.run,
  }),
}))

const fontsDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts')

beforeEach(() => {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  })
  mocks.reconciliationRequired = true
  mocks.getSaleById.mockReset().mockResolvedValue({
    HasDetails: true,
    NetUid: 'sale-1',
    Order: { OrderItems: [], OrderPackages: [{ Id: 91 }] },
  })
  mocks.updateSaleFromData.mockReset().mockResolvedValue({ message: 'saved' })
  mocks.reconcile.mockReset().mockImplementation(async (_kind, file, request) => request(
    {
      HasDetails: false,
      NetUid: 'sale-1',
      Order: { OrderItems: [], OrderPackages: [] },
    },
    file,
    { operationId: '11111111-1111-4111-8111-111111111111' },
  ))
  mocks.run.mockReset().mockImplementation(async (_kind, payload, file, request) => request(
    payload,
    file,
    { operationId: '11111111-1111-4111-8111-111111111111' },
  ))
})

afterEach(() => {
  cleanup()
  mocks.getSaleTransporterTypes.mockClear()
  if (fontsDescriptor) {
    Object.defineProperty(document, 'fonts', fontsDescriptor)
  } else {
    Reflect.deleteProperty(document, 'fonts')
  }
})

describe('SaleDetailsDrawer file mutation reconciliation', () => {
  it('fails closed for a legacy frozen operation that did not persist full sale details', async () => {
    const sale: SalesUkraineSale = {
      BaseLifeCycleStatus: { SaleLifeCycleType: 1 },
      Comment: 'server value',
      DeliveryRecipient: { FullName: 'Recipient', MobilePhone: '0500000000' },
      DeliveryRecipientAddress: { City: 'Kyiv', Department: '1' },
      NetUid: 'sale-1',
    }
    const onSaved = vi.fn()

    render(
      <MantineProvider theme={theme}>
        <SaleDetailsDrawer sale={sale} onClose={vi.fn()} onSaved={onSaved} />
      </MantineProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Звірити операцію' }))

    expect((await screen.findByRole('textbox', { name: 'Коментар' }) as HTMLTextAreaElement).disabled).toBe(true)
    expect((screen.getByRole('textbox', { name: 'Місто' }) as HTMLInputElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Звірити збереження' }))

    await waitFor(() => expect(mocks.reconcile).toHaveBeenCalledOnce())
    expect(mocks.getSaleById).not.toHaveBeenCalled()
    expect(mocks.updateSaleFromData).not.toHaveBeenCalled()
    expect(mocks.run).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('replays a complete frozen payload byte-for-byte without rehydrating it', async () => {
    const frozenSale = {
      BaseLifeCycleStatus: { SaleLifeCycleType: 1 },
      HasDetails: true,
      NetUid: 'sale-1',
      Order: { OrderItems: [], OrderPackages: [{ Id: 91 }] },
    } as SalesUkraineSale
    mocks.reconcile.mockImplementationOnce(async (_kind, file, request) => request(
      frozenSale,
      file,
      { operationId: '11111111-1111-4111-8111-111111111111' },
    ))
    const onSaved = vi.fn()

    render(
      <MantineProvider theme={theme}>
        <SaleDetailsDrawer
          sale={{ BaseLifeCycleStatus: { SaleLifeCycleType: 1 }, NetUid: 'sale-1' }}
          onClose={vi.fn()}
          onSaved={onSaved}
        />
      </MantineProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Звірити операцію' }))
    fireEvent.click(screen.getByRole('button', { name: 'Звірити збереження' }))

    await waitFor(() => expect(mocks.updateSaleFromData).toHaveBeenCalledOnce())
    expect(mocks.updateSaleFromData).toHaveBeenCalledWith(
      frozenSale,
      null,
      { operationId: '11111111-1111-4111-8111-111111111111' },
    )
    expect(mocks.getSaleById).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledOnce()
  })

  it('hydrates a list projection before a new delivery save and preserves server order packages', async () => {
    mocks.reconciliationRequired = false
    const sale = {
      BaseLifeCycleStatus: { SaleLifeCycleType: 1 },
      Comment: 'list projection',
      DeliveryRecipient: { FullName: 'Recipient', MobilePhone: '0500000000' },
      DeliveryRecipientAddress: { City: 'Kyiv', Department: '1' },
      HasDetails: false,
      NetUid: 'sale-1',
      Order: { OrderItems: [], OrderPackages: [] },
    } as SalesUkraineSale
    const onSaved = vi.fn()

    render(
      <MantineProvider theme={theme}>
        <SaleDetailsDrawer sale={sale} onClose={vi.fn()} onSaved={onSaved} />
      </MantineProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Редагувати' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(mocks.getSaleById).toHaveBeenCalledWith('sale-1'))
    expect(mocks.run).toHaveBeenCalledWith(
      'sale-update-file',
      expect.objectContaining({
        HasDetails: true,
        Order: expect.objectContaining({ OrderPackages: [{ Id: 91 }] }),
      }),
      null,
      mocks.updateSaleFromData,
    )
    expect(mocks.updateSaleFromData).toHaveBeenCalledOnce()
    expect(onSaved).toHaveBeenCalledOnce()
  })

  it('blocks delivery save when full sale hydration fails', async () => {
    mocks.reconciliationRequired = false
    mocks.getSaleById.mockResolvedValueOnce(null)
    const sale: SalesUkraineSale = {
      BaseLifeCycleStatus: { SaleLifeCycleType: 1 },
      DeliveryRecipient: { FullName: 'Recipient', MobilePhone: '0500000000' },
      DeliveryRecipientAddress: { City: 'Kyiv', Department: '1' },
      HasDetails: false,
      NetUid: 'sale-1',
    }

    render(
      <MantineProvider theme={theme}>
        <SaleDetailsDrawer sale={sale} onClose={vi.fn()} onSaved={vi.fn()} />
      </MantineProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Редагувати' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Зберегти' }))

    await waitFor(() => expect(mocks.getSaleById).toHaveBeenCalledWith('sale-1'))
    expect(mocks.run).not.toHaveBeenCalled()
    expect(mocks.updateSaleFromData).not.toHaveBeenCalled()
  })
})
