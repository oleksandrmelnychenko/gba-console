import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { createInvoiceMetadataPayload } from '../invoiceMetadataPayload'
import { createPackListMetadataSavePlan } from '../packListDocumentSavePlan'
import { PackListMetadataModalBody } from './SupplyUkraineDirectOrderInvoicesPage'

describe('PackListMetadataModalBody', () => {
  it('submits the latest comment and attached documents', () => {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    })

    const onSubmit = vi.fn()
    const file = new File(['document'], 'packing-list.pdf', { type: 'application/pdf' })

    const { container } = render(
      <StrictMode>
        <MantineProvider>
          <I18nProvider>
            <PackListMetadataModalBody
              editor={{
                packList: {
                  Id: 42,
                  NetUid: 'packing-list-42',
                  Comment: '',
                  InvoiceDocuments: [],
                },
              }}
              isSaving={false}
              onClose={vi.fn()}
              onSubmit={onSubmit}
            />
          </I18nProvider>
        </MantineProvider>
      </StrictMode>,
    )

    fireEvent.change(screen.getByLabelText('Коментар'), { target: { value: 'Updated comment' } })
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')

    expect(fileInput).not.toBeNull()
    fireEvent.change(fileInput!, { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      comment: 'Updated comment',
      documents: [expect.objectContaining({
        ContentType: 'application/pdf',
        FileName: 'packing-list.pdf',
        NetUid: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      })],
      files: [file],
    }))
  })

  it('keeps pending uploads out of the metadata payload and preserves their retry token', () => {
    const pendingNetUid = '8cc3a2b3-0f62-4cc2-ae4c-27d726722ea1'
    const plan = createPackListMetadataSavePlan({
      Comment: 'Updated comment',
      FromDate: '2026-07-13T14:00',
      Id: 42,
      InvoiceDocuments: [
          { FileName: 'existing.pdf', Id: 7, NetUid: 'existing-document' },
          { FileName: 'new.pdf', NetUid: pendingNetUid },
      ],
      InvNo: 'INV-1',
      NetUid: 'packing-list-42',
      No: 'PL-1',
    })

    expect(plan.metadataDraft.InvoiceDocuments).toEqual([
      expect.objectContaining({ Id: 7, NetUid: 'existing-document' }),
    ])
    expect(plan.pendingDocuments).toEqual([
      expect.objectContaining({ FileName: 'new.pdf', NetUid: pendingNetUid }),
    ])
  })

  it('keeps payment tasks out of an invoice metadata-only mutation', () => {
    const payload = createInvoiceMetadataPayload(
      {
        Id: 42,
        NetUid: '62d98a8e-fb19-4be7-a9ce-2fcb4f57ba9a',
        PaymentDeliveryProtocols: [
          {
            Id: 31,
            NetUid: 'b996b20b-f960-4a6d-a76b-1f064c0a703e',
            SupplyPaymentTaskId: 91,
            SupplyPaymentTask: {
              Id: 91,
              IsAvailableForPayment: true,
            },
          },
        ],
      },
      {
        dateFrom: '2026-07-25T12:00',
        deliveryAmount: 0,
        discountAmount: 0,
        documents: [],
        files: [],
        number: 'INV-42',
      },
    )

    expect(payload.PaymentDeliveryProtocols).toEqual([])
  })
})
