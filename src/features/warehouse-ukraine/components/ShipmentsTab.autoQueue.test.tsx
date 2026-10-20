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
  updateShipmentList,
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
const updateShipmentListMock = vi.mocked(updateShipmentList)
const TOMBSTONE_MESSAGE = /tombstone/

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

  it('sends the reopened panel request after the earlier create/auto call that was still waiting for its lock', async () => {
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
      renderShipmentsTab()

      await waitFor(() => expect(autoLockRequests).toHaveLength(1))
      expect(getAutoShipmentListMock).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'Усі' }))
      await waitFor(() => expect(getAllShipmentListsMock).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: 'Підбір' }))
      expect(autoLockRequests).toHaveLength(1)

      expect(grant.release).not.toBe(null)
      grant.release?.()

      await waitFor(() => expect(getAutoShipmentListMock).toHaveBeenCalledTimes(2))
      expect(autoLockRequests).toHaveLength(2)
      expect(autoLockRequests[1]).toBe(autoLockRequests[0])
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
      grant.release?.()
      requestSpy.mockRestore()
    }
  })

  it('waits for the create/auto call that already holds its lease when «Підбір» is reopened', async () => {
    const firstResponse = deferred<ShipmentList>()
    getAutoShipmentListMock
      .mockImplementationOnce(() => firstResponse.promise)
      .mockResolvedValueOnce(buildShipmentList({ extraSaleNumber: '000000124' }))

    renderShipmentsTab()

    await waitFor(() => expect(getAutoShipmentListMock).toHaveBeenCalledTimes(1))
    const firstCall = getAutoShipmentListMock.mock.calls[0]
    const scope = {
      context: `shipment-list-auto:${TRANSPORTER_NET_ID}:${firstCall?.[0].from}:${firstCall?.[0].to}`,
      kind: 'shipment-list-auto' as const,
      userKey: 'net:user-a',
    }
    expect(loadSalesPendingMutation(scope)).toMatchObject({
      operationId: firstCall?.[1].operationId,
      phase: 'submitted',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Усі' }))
    await waitFor(() => expect(getAllShipmentListsMock).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Підбір' }))
    firstResponse.resolve(buildShipmentList())

    expect(await screen.findByText('000000124')).toBeTruthy()
    expect(getAutoShipmentListMock).toHaveBeenCalledTimes(2)
    expect(getAutoShipmentListMock.mock.calls[1]?.[1].operationId).not.toBe(firstCall?.[1].operationId)
    expect(screen.queryByText(TOMBSTONE_MESSAGE)).toBeNull()
    expect(loadSalesPendingMutation(scope)).toBe(null)
  })

  it('reloads a fresh list after a quantity save while an earlier refresh is still in flight', async () => {
    const refreshResponse = deferred<ShipmentList>()
    const saveResponse = deferred<ShipmentList>()
    getAutoShipmentListMock
      .mockResolvedValueOnce(buildShipmentList())
      .mockImplementationOnce(() => refreshResponse.promise)
      .mockResolvedValueOnce(buildShipmentList({ extraSaleNumber: '000000124', qtyPlaces: 5 }))
    updateShipmentListMock.mockImplementationOnce(() => saveResponse.promise)

    renderShipmentsTab()

    const saleRow = (await screen.findByText('000000123')).closest('tr') as HTMLTableRowElement
    const qtyPlacesInput = saleRow.querySelector<HTMLInputElement>('input[type="number"]')

    expect(qtyPlacesInput).not.toBe(null)
    fireEvent.focus(qtyPlacesInput as HTMLInputElement)
    fireEvent.change(qtyPlacesInput as HTMLInputElement, { target: { value: '5' } })
    await waitFor(() => expect(getQtyPlacesInput('000000123').value).toBe('5'))
    fireEvent.blur(getQtyPlacesInput('000000123'))
    await waitFor(() => expect(updateShipmentListMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Оновити' }))
    await waitFor(() => expect(getAutoShipmentListMock).toHaveBeenCalledTimes(2))

    saveResponse.resolve(buildShipmentList({ qtyPlaces: 5 }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Провести і закрити' })).toBeTruthy())
    refreshResponse.resolve(buildShipmentList())

    expect(await screen.findByText('000000124')).toBeTruthy()
    expect(getAutoShipmentListMock).toHaveBeenCalledTimes(3)
    const operationIds = getAutoShipmentListMock.mock.calls.map((call) => call[1].operationId)
    expect(new Set(operationIds).size).toBe(3)
    expect(screen.queryByText(TOMBSTONE_MESSAGE)).toBeNull()
  })
})

function renderShipmentsTab() {
  return render(
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
}

function getQtyPlacesInput(saleNumber: string): HTMLInputElement {
  const input = screen.getByText(saleNumber).closest('tr')?.querySelector<HTMLInputElement>('input[type="number"]')

  if (!input) {
    throw new Error(`No quantity input for ${saleNumber}`)
  }

  return input
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })

  return { promise, resolve }
}

function buildShipmentList({
  extraSaleNumber,
  qtyPlaces = 0,
}: { extraSaleNumber?: string; qtyPlaces?: number } = {}): ShipmentList {
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
        QtyPlaces: qtyPlaces,
        Sale: {
          Id: 20,
          NetUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          ChangedToInvoice: '2026-10-20T12:30:00Z',
          SaleNumber: { Value: '000000123' },
        },
      },
      ...(extraSaleNumber
        ? [{
            Id: 31,
            NetUid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            QtyPlaces: 0,
            Sale: {
              Id: 21,
              NetUid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              ChangedToInvoice: '2026-10-20T12:40:00Z',
              SaleNumber: { Value: extraSaleNumber },
            },
          }]
        : []),
    ],
  }
}
