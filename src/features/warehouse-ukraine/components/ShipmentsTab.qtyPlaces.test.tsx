import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  carryOutShipmentList,
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

vi.mock('../../sales-ukraine/usePersistentSaleJsonMutation', () => {
  const runMutation = async (
    _context: string,
    payload: object,
    request: (payload: object, operation: { operationId: string }) => Promise<unknown>,
  ) => {
    try {
      return {
        completed: true,
        result: await request(payload, {
          operationId: '99999999-9999-4999-8999-999999999999',
        }),
      }
    } catch (error) {
      return { completed: false, error }
    }
  }

  return {
    usePersistentSaleJsonMutationRunner: () => runMutation,
  }
})

const getAllShipmentListsMock = vi.mocked(getAllShipmentLists)
const getAutoShipmentListMock = vi.mocked(getAutoShipmentList)
const getShipmentTransporterTypesMock = vi.mocked(getShipmentTransporterTypes)
const getShipmentTransportersByTypeMock = vi.mocked(getShipmentTransportersByType)
const carryOutShipmentListMock = vi.mocked(carryOutShipmentList)

describe('ShipmentsTab quantity carry-out workflow', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    getShipmentTransporterTypesMock.mockResolvedValue([
      {
        NetUid: '11111111-1111-4111-8111-111111111111',
        Name: 'Перевізники Україна',
      },
    ])
    getShipmentTransportersByTypeMock.mockResolvedValue([
      {
        NetUid: '22222222-2222-4222-8222-222222222222',
        Name: 'Автолюкс',
      },
    ])
  })

  it('sends the currently entered 5 when carrying out and then shows 5 in the all-shipments row', async () => {
    const draft = buildShipmentList()
    let persisted: ShipmentList | null = null
    getAutoShipmentListMock.mockResolvedValue(draft)
    carryOutShipmentListMock.mockImplementation(async (shipmentList) => {
      persisted = {
        ...shipmentList,
        Updated: '2026-08-27T13:10:00.1234567Z',
        ShipmentListItems: shipmentList.ShipmentListItems.map((item) => ({ ...item })),
      }

      return persisted
    })
    getAllShipmentListsMock.mockImplementation(async () => (persisted ? [persisted] : []))

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

    await waitFor(() => expect(getShipmentTransporterTypesMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(getShipmentTransportersByTypeMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(getAutoShipmentListMock).toHaveBeenCalledTimes(1))

    const draftSaleNumber = await screen.findByText('000000123')
    const draftRow = draftSaleNumber.closest('tr')

    expect(draftRow).not.toBeNull()
    const qtyPlacesInput = (draftRow as HTMLTableRowElement)
      .querySelector<HTMLInputElement>('input[type="number"]')
    const carryOutButton = screen.getByRole('button', { name: 'Провести і закрити' })

    expect(qtyPlacesInput).not.toBeNull()
    fireEvent.focus(qtyPlacesInput as HTMLInputElement)
    fireEvent.change(qtyPlacesInput as HTMLInputElement, { target: { value: '5' } })
    fireEvent.blur(qtyPlacesInput as HTMLInputElement, { relatedTarget: carryOutButton })
    expect(carryOutShipmentListMock).not.toHaveBeenCalled()
    fireEvent.click(carryOutButton)
    fireEvent.click(await screen.findByRole('button', { name: 'Так' }))

    await waitFor(() => expect(carryOutShipmentListMock).toHaveBeenCalledTimes(1))
    expect(carryOutShipmentListMock.mock.calls[0][0]).toMatchObject({
      IsSent: true,
      ShipmentListItems: [{ IsDirty: true, QtyPlaces: 5 }],
    })

    const shipmentNumber = await screen.findByText('000000001')
    const shipmentRow = shipmentNumber.closest('tr')

    expect(shipmentRow).not.toBeNull()
    expect(within(shipmentRow as HTMLTableRowElement).getByText('5')).toBeTruthy()
  })
})

function buildShipmentList(): ShipmentList {
  return {
    Id: 10,
    NetUid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    Number: '000000001',
    Updated: '2026-08-27T13:00:00.1234567Z',
    FromDate: '2026-08-27T12:00:00Z',
    IsSent: false,
    Transporter: {
      Id: 2,
      NetUid: '22222222-2222-4222-8222-222222222222',
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
          ChangedToInvoice: '2026-08-27T12:30:00Z',
          SaleNumber: { Value: '000000123' },
        },
      },
    ],
  }
}
