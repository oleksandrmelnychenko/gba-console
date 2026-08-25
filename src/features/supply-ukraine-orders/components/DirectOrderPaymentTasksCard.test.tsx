import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  NewPaymentProtocolFormValues,
  SupplyOrderUkrainePaymentDeliveryProtocol,
} from '../../supply-ukraine-payment-protocols/types'
import type { DirectSupplyOrder, SupplyInvoice, SupplyProForm } from '../types'
import { DirectOrderPaymentTasksCard } from './DirectOrderPaymentTasksCard'

const mocks = vi.hoisted(() => ({
  getSupplyInvoiceItems: vi.fn(),
  getSupplyPaymentDeliveryProtocolKeys: vi.fn(),
  getSupplyProtocolResponsibleUsers: vi.fn(),
  t: (key: string) => key,
  updateSupplyInvoice: vi.fn(),
  updateSupplyProForm: vi.fn(),
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: mocks.t }),
}))

vi.mock('../api/supplyUkraineOrdersApi', () => ({
  getSupplyInvoiceItems: mocks.getSupplyInvoiceItems,
  getSupplyPaymentDeliveryProtocolKeys: mocks.getSupplyPaymentDeliveryProtocolKeys,
  getSupplyProtocolResponsibleUsers: mocks.getSupplyProtocolResponsibleUsers,
  updateSupplyInvoice: mocks.updateSupplyInvoice,
  updateSupplyProForm: mocks.updateSupplyProForm,
}))

vi.mock('../../supply-ukraine-payment-protocols/components/PaymentDeliveryProtocolsSection', () => ({
  PaymentDeliveryProtocolsSection: ({
    onCreateProtocol,
    onRemoveProtocol,
    protocols,
    totalGrossPriceLocal,
  }: {
    onCreateProtocol: (values: NewPaymentProtocolFormValues) => Promise<void>
    onRemoveProtocol: (protocol: SupplyOrderUkrainePaymentDeliveryProtocol) => Promise<void>
    protocols: SupplyOrderUkrainePaymentDeliveryProtocol[]
    totalGrossPriceLocal: number
  }) => (
    <div>
      <output aria-label="Сума платіжної задачі">{totalGrossPriceLocal}</output>
      <button type="button" onClick={() => void onCreateProtocol(createPaymentValues())}>
        Створити платіжну задачу
      </button>
      {protocols[0] && (
        <button type="button" onClick={() => void onRemoveProtocol(protocols[0])}>
          Видалити платіжну задачу
        </button>
      )}
    </div>
  ),
}))

const orderNetUid = '8af6ae7b-2671-4a05-8843-c4309900a1dc'
const proFormNetUid = '4d13e9d8-e66b-4e40-bf68-e946954b8809'
const invoiceNetUid = '6ce91504-44de-45a9-88a8-8c26162ef85b'

describe('DirectOrderPaymentTasksCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSupplyPaymentDeliveryProtocolKeys.mockResolvedValue([])
    mocks.getSupplyProtocolResponsibleUsers.mockResolvedValue([])
  })

  it('creates a payment task from a saved proforma when the order has no invoice', async () => {
    const proForm: SupplyProForm = {
      Id: 17,
      NetPrice: 59_892.7,
      NetUid: proFormNetUid,
      Number: '5',
      PaymentDeliveryProtocols: [],
      ProFormDocuments: [{ Id: 31, FileName: 'proforma.xlsx' }],
    }
    mocks.updateSupplyProForm.mockResolvedValue({
      ...proForm,
      PaymentDeliveryProtocols: [],
    })

    renderCard({
      NetUid: orderNetUid,
      SupplyInvoices: [],
      SupplyProForm: proForm,
      SupplyProFormId: proForm.Id,
      TotalNetPrice: proForm.NetPrice,
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Створити платіжну задачу' }))

    await waitFor(() => expect(mocks.updateSupplyProForm).toHaveBeenCalledTimes(1))
    expect(mocks.getSupplyInvoiceItems).not.toHaveBeenCalled()
    expect(mocks.updateSupplyInvoice).not.toHaveBeenCalled()
    expect(mocks.updateSupplyProForm).toHaveBeenCalledWith(
      orderNetUid,
      expect.objectContaining({
        Id: 17,
        NetUid: proFormNetUid,
        PaymentDeliveryProtocols: [
          expect.objectContaining({
            SupplyInvoiceId: null,
            SupplyProFormId: 17,
            SupplyPaymentTask: expect.objectContaining({
              Comment: 'Оплатити проформу',
              GrossPrice: 1_250.5,
              NetPrice: 1_250.5,
              UserId: 9,
            }),
            Value: 1_250.5,
          }),
        ],
      }),
    )
  })

  it('keeps invoice payment-task creation working when there is no proforma', async () => {
    const invoice: SupplyInvoice = {
      DeliveryAmount: 125.5,
      DiscountAmount: 25,
      Id: 27,
      NetUid: invoiceNetUid,
      NetPrice: 99999,
      Number: 'INV-27',
      PaymentDeliveryProtocols: [],
      TotalNetPrice: 31439.43,
    }
    mocks.getSupplyInvoiceItems.mockResolvedValue(invoice)
    mocks.updateSupplyInvoice.mockResolvedValue(invoice)

    renderCard({
      NetUid: orderNetUid,
      SupplyInvoices: [invoice],
      SupplyProForm: null,
      TotalNetPrice: 59_892.7,
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Створити платіжну задачу' }))

    await waitFor(() => expect(mocks.updateSupplyInvoice).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('status', { name: 'Сума платіжної задачі' }).textContent).toBe('100099.5')
    expect(mocks.updateSupplyProForm).not.toHaveBeenCalled()
    expect(mocks.updateSupplyInvoice).toHaveBeenCalledWith(
      orderNetUid,
      expect.objectContaining({
        Id: 27,
        NetUid: invoiceNetUid,
        PaymentDeliveryProtocols: [
          expect.objectContaining({
            SupplyInvoiceId: 27,
            SupplyPaymentTask: expect.objectContaining({
              Comment: 'Оплатити проформу',
              GrossPrice: 1_250.5,
              NetPrice: 1_250.5,
              UserId: 9,
            }),
            Value: 1_250.5,
          }),
        ],
      }),
    )
  })

  it('keeps the existing invoice as the default when both invoice and proforma are available', async () => {
    const invoice: SupplyInvoice = {
      Id: 27,
      NetUid: invoiceNetUid,
      Number: 'INV-27',
      PaymentDeliveryProtocols: [],
    }
    const proForm: SupplyProForm = {
      Id: 17,
      NetPrice: 59_892.7,
      NetUid: proFormNetUid,
      Number: '5',
      PaymentDeliveryProtocols: [],
    }
    mocks.getSupplyInvoiceItems.mockResolvedValue(invoice)
    mocks.updateSupplyInvoice.mockResolvedValue(invoice)

    renderCard({
      NetUid: orderNetUid,
      SupplyInvoices: [invoice],
      SupplyProForm: proForm,
      SupplyProFormId: proForm.Id,
      TotalNetPrice: proForm.NetPrice,
    })

    await waitFor(() => expect(mocks.getSupplyInvoiceItems).toHaveBeenCalledWith(invoiceNetUid))
    fireEvent.click(screen.getByRole('button', { name: 'Створити платіжну задачу' }))

    await waitFor(() => expect(mocks.updateSupplyInvoice).toHaveBeenCalledTimes(1))
    expect(mocks.updateSupplyProForm).not.toHaveBeenCalled()
  })

  it('reloads the selected invoice after its discount changes on the logistics path', async () => {
    const invoice: SupplyInvoice = {
      DiscountAmount: 0,
      Id: 27,
      NetPrice: 1_000,
      NetUid: invoiceNetUid,
      Number: 'INV-27',
      PaymentDeliveryProtocols: [],
      Updated: '2026-08-25T10:00:00',
    }
    mocks.getSupplyInvoiceItems
      .mockResolvedValueOnce(invoice)
      .mockResolvedValueOnce({ ...invoice, DiscountAmount: 100, Updated: '2026-08-25T10:01:00' })

    const { rerender } = renderCard({
      NetUid: orderNetUid,
      SupplyInvoices: [invoice],
      SupplyProForm: null,
    })

    await waitFor(() => expect(mocks.getSupplyInvoiceItems).toHaveBeenCalledTimes(1))

    rerender(
      <MantineProvider>
        <DirectOrderPaymentTasksCard
          canEdit
          order={{
            NetUid: orderNetUid,
            SupplyInvoices: [{ ...invoice, DiscountAmount: 100, Updated: '2026-08-25T10:01:00' }],
            SupplyProForm: null,
          }}
        />
      </MantineProvider>,
    )

    await waitFor(() => expect(mocks.getSupplyInvoiceItems).toHaveBeenCalledTimes(2))
    expect((await screen.findByRole('status', { name: 'Сума платіжної задачі' })).textContent).toBe('900')
  })

  it('removes an existing proforma payment task without routing it through an invoice', async () => {
    const proForm: SupplyProForm = {
      Id: 17,
      NetPrice: 59_892.7,
      NetUid: proFormNetUid,
      Number: '5',
      PaymentDeliveryProtocols: [
        {
          Id: 41,
          NetUid: '7e8dd988-e7b4-440d-b381-a079e94146cc',
          SupplyPaymentTaskId: 51,
          SupplyPaymentTask: {
            Id: 51,
            NetUid: 'a70a2b19-60cf-44a5-aa51-bc987146adff',
          },
          SupplyProFormId: 17,
          Value: 1_250.5,
        },
      ],
    }
    mocks.updateSupplyProForm.mockResolvedValue({
      ...proForm,
      PaymentDeliveryProtocols: [],
    })

    renderCard({
      NetUid: orderNetUid,
      SupplyInvoices: [],
      SupplyProForm: proForm,
      SupplyProFormId: proForm.Id,
      TotalNetPrice: proForm.NetPrice,
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Видалити платіжну задачу' }))

    await waitFor(() => expect(mocks.updateSupplyProForm).toHaveBeenCalledTimes(1))
    expect(mocks.updateSupplyInvoice).not.toHaveBeenCalled()
    expect(mocks.updateSupplyProForm).toHaveBeenCalledWith(
      orderNetUid,
      expect.objectContaining({
        PaymentDeliveryProtocols: [
          expect.objectContaining({
            Deleted: true,
            Id: 41,
            NetUid: '7e8dd988-e7b4-440d-b381-a079e94146cc',
            SupplyPaymentTask: null,
          }),
        ],
      }),
    )
    const payload = mocks.updateSupplyProForm.mock.calls[0]?.[1] as SupplyProForm
    expect(payload.PaymentDeliveryProtocols?.[0]).not.toHaveProperty('SupplyPaymentTaskId')
  })
})

function renderCard(order: DirectSupplyOrder) {
  return render(
    <MantineProvider>
      <DirectOrderPaymentTasksCard canEdit order={order} />
    </MantineProvider>,
  )
}

function createPaymentValues(): NewPaymentProtocolFormValues {
  return {
    comment: 'Оплатити проформу',
    discount: '0',
    isAccounting: false,
    payToDate: new Date('2026-08-28T00:00:00Z'),
    protocolKey: {
      Id: 4,
      Key: 'Передплата',
      NetUid: '78327073-61b3-4071-b7b7-640194689634',
    },
    responsible: {
      Id: 9,
      FirstName: 'QA',
      NetUid: '22f5eb70-10d6-4f8b-a05a-004620cab5a2',
    },
    value: '1250.5',
  }
}
