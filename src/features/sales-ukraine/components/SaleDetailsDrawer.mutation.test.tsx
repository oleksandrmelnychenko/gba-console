import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../../shared/theme/theme'
import type { SalesUkraineSale } from '../types'
import { SaleDetailsDrawer } from './SaleDetailsDrawer'

const mocks = vi.hoisted(() => ({
  getSaleTransporterTypes: vi.fn(async () => []),
  reconcile: vi.fn(async () => ({ message: 'saved' })),
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
    reconciliationRequired: true,
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
})

afterEach(() => {
  cleanup()
  mocks.getSaleTransporterTypes.mockClear()
  mocks.reconcile.mockClear()
  mocks.run.mockClear()
  mocks.updateSaleFromData.mockClear()

  if (fontsDescriptor) {
    Object.defineProperty(document, 'fonts', fontsDescriptor)
  } else {
    Reflect.deleteProperty(document, 'fonts')
  }
})

describe('SaleDetailsDrawer file mutation reconciliation', () => {
  it('locks editable values and only exposes the explicit frozen-operation reconciliation action', async () => {
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

    await waitFor(() => expect(mocks.reconcile).toHaveBeenCalledWith(
      'sale-update-file',
      null,
      mocks.updateSaleFromData,
    ))
    expect(mocks.run).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledOnce()
  })
})
