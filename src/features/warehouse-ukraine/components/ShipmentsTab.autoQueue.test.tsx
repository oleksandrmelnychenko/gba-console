import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  clearAllSalesPendingMutations,
  loadSalesPendingMutation,
} from '../../sales-ukraine/pendingSalesMutationRegistry'
import {
  installSalesMutationStorageHarness,
  type SalesMutationStorageHarness,
} from '../../sales-ukraine/salesMutationStorageTestHarness'
import {
  getAllShipmentLists,
  getAutoShipmentList,
  getShipmentTransporterTypes,
  getShipmentTransportersByType,
} from '../api/shipmentsApi'
import type { ShipmentList } from '../shipmentTypes'
import { ShipmentsTab } from './ShipmentsTab'

vi.mock('../api/shipmentsApi', () => ({
  carryOutShipmentList: vi.fn(),
  getAllShipmentLists: vi.fn(),
  getAutoShipmentList: vi.fn(),
  getManualShipmentSales: vi.fn(),
  getShipmentCreatePageDocument: vi.fn(),
  getShipmentDocument: vi.fn(),
  getShipmentListById: vi.fn(),
  getShipmentListForSaleDocument: vi.fn(),
  getShipmentTransporterTypes: vi.fn(),
  getShipmentTransportersByType: vi.fn(),
  updateDeliveryRecipient: vi.fn(),
  updateDeliveryRecipientAddress: vi.fn(),
  updateSaleComment: vi.fn(),
  updateShipmentList: vi.fn(),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ session: { userNetUid: 'USER-A' } }),
}))

const TRANSPORTER_NET_ID = '22222222-2222-4222-8222-222222222222'
const getAllShipmentListsMock = vi.mocked(getAllShipmentLists)
const getAutoShipmentListMock = vi.mocked(getAutoShipmentList)
const getShipmentTransporterTypesMock = vi.mocked(getShipmentTransporterTypes)
const getShipmentTransportersByTypeMock = vi.mocked(getShipmentTransportersByType)

let harness: SalesMutationStorageHarness

describe('ShipmentsTab «Підбір» queued auto-selection', () => {
  beforeEach(() => {
    harness = installSalesMutationStorageHarness()
    clearAllSalesPendingMutations()
    vi.clearAllMocks()
    getShipmentTransporterTypesMock.mockResolvedValue([
      { NetUid: '11111111-1111-4111-8111-111111111111', Name: 'Перевізники Україна' },
    ])
    getShipmentTransportersByTypeMock.mockResolvedValue([
      { NetUid: TRANSPORTER_NET_ID, Name: 'Автолюкс' },
    ])
    getAllShipmentListsMock.mockResolvedValue([])
    getAutoShipmentListMock.mockResolvedValue(buildShipmentList())
  })

  afterEach(() => {
    clearAllSalesPendingMutations()
    harness.dispose()
  })

  it('sends the reopened panel request after the queued earlier create/auto call completes', async () => {
    const autoLockRequests: string[] = []
    const grant: { release: (() => void) | null } = { release: null }
    const locks = navigator.locks
    const requestLock = locks.request.bind(locks) as (
      name: string,
      options: LockOptions,
      callback: LockGrantedCallback<unknown>,
    ) => Promise<unknown>
    const requestSpy = vi.spyOn(locks, 'request').mockImplementation(((
      name: string,
      options: LockOptions,
      callback: LockGrantedCallback<unknown>,
    ) => {
      if (name.includes('shipment-list-auto')) {
        autoLockRequests.push(name)
        grant.release ??= harness.holdWebLock(name)
      }

      return requestLock(name, options, callback)
    }) as LockManager['request'])

    try {
      render(
        <MantineProvider>
          <I18nProvider>
            <ShipmentsTab
              createRequest={1}
              permissions={{
                canCarryOut: true,
                canCreate: true,
                canEdit: true,
                canPrintInvoice: true,
                canPrintShipment: true,
              }}
            />
          </I18nProvider>
        </MantineProvider>,
      )

      await waitFor(() => expect(autoLockRequests).toHaveLength(1))
      expect(getAutoShipmentListMock).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'Усі' }))
      await waitFor(() => expect(getAllShipmentListsMock).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: 'Підбір' }))
      await waitFor(() => expect(autoLockRequests).toHaveLength(2))
      expect(autoLockRequests[1]).toBe(autoLockRequests[0])

      expect(grant.release).not.toBe(null)
      grant.release?.()

      await waitFor(() => expect(getAutoShipmentListMock).toHaveBeenCalledTimes(2))
      expect(await screen.findByText('000000123')).toBeTruthy()
      expect(screen.queryByText(/Mutation scope змінився/)).toBeNull()

      const [firstCall, secondCall] = getAutoShipmentListMock.mock.calls
      expect(firstCall?.[0]).toMatchObject({ transporterNetId: TRANSPORTER_NET_ID })
      expect(secondCall?.[0]).toMatchObject({
        from: firstCall?.[0].from,
        to: firstCall?.[0].to,
        transporterNetId: TRANSPORTER_NET_ID,
      })
      expect(secondCall?.[1].operationId).not.toBe(firstCall?.[1].operationId)
      expect(loadSalesPendingMutation({
        context: `shipment-list-auto:${TRANSPORTER_NET_ID}:${firstCall?.[0].from}:${firstCall?.[0].to}`,
        kind: 'shipment-list-auto',
        userKey: 'net:user-a',
      })).toBe(null)
    } finally {
      requestSpy.mockRestore()
    }
  })
})

function buildShipmentList(): ShipmentList {
  return {
    Id: 10,
    NetUid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    Number: '000000001',
    Updated: '2026-10-20T13:00:00.1234567Z',
    FromDate: '2026-10-20T12:00:00Z',
    IsSent: false,
    Transporter: {
      Id: 2,
      NetUid: TRANSPORTER_NET_ID,
      Name: 'Автолюкс',
    },
    Responsible: { Id: 3, LastName: 'QA' },
    ShipmentListItems: [
      {
        Id: 30,
        NetUid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        QtyPlaces: 0,
        Sale: {
          Id: 20,
          NetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          ChangedToInvoice: '2026-10-20T12:30:00Z',
          SaleNumber: { Value: '000000123' },
        },
      },
    ],
  }
}
