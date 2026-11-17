import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  clearAllSalesPendingMutations,
} from '../../sales-ukraine/pendingSalesMutationRegistry'
import {
  installSalesMutationStorageHarness,
  type SalesMutationStorageHarness,
} from '../../sales-ukraine/salesMutationStorageTestHarness'
import {
  getAllShipmentLists,
  getAutoShipmentList,
  getShipmentCreatePageDocument,
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

describe('ShipmentsTab «Підбір» filters and print', () => {
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
  })

  afterEach(() => {
    clearAllSalesPendingMutations()
    harness.dispose()
  })

  it('labels the carrier-type and carrier filters differently', async () => {
    getAutoShipmentListMock.mockResolvedValue(buildShipmentList())
    renderShipmentsTab()

    expect(await screen.findByPlaceholderText('Тип перевізника')).toBeTruthy()
    expect(screen.getByPlaceholderText('Перевізник')).toBeTruthy()
    expect(screen.queryByPlaceholderText('Перевізники')).toBeNull()
  })

  it('does not offer «Друк PDF» for an empty picker', async () => {
    getAutoShipmentListMock.mockResolvedValue({ ...buildShipmentList(), ShipmentListItems: [] })
    renderShipmentsTab()

    await waitFor(() => expect(getAutoShipmentListMock).toHaveBeenCalled())
    const print = screen.getByRole('button', { name: 'Друк PDF' })
    await waitFor(() => expect(print.getAttribute('title')).toBe('Немає накладних для друку'))
    expect((print as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(print)
    expect(getShipmentCreatePageDocument).not.toHaveBeenCalled()
  })

  it('offers «Друк PDF» once the picker has invoices', async () => {
    getAutoShipmentListMock.mockResolvedValue(buildShipmentList())
    renderShipmentsTab()

    expect(await screen.findByText('000000123')).toBeTruthy()
    await waitFor(() => expect((screen.getByRole('button', { name: 'Друк PDF' }) as HTMLButtonElement).disabled).toBe(false))
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
