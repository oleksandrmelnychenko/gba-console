import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { SpecificationPackingList, SpecificationProtocol } from '../specificationTypes'
import { ProductDeliveryProtocolSpecificationPage } from './ProductDeliveryProtocolSpecificationPage'

const apiMocks = vi.hoisted(() => ({
  getPackingListSpecificationProducts: vi.fn(),
  getProtocolForSpecification: vi.fn(),
  uploadProductSpecificationForInvoice: vi.fn(),
}))

vi.mock('../api/productDeliveryProtocolsApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/productDeliveryProtocolsApi')>(),
  getProtocolForSpecification: apiMocks.getProtocolForSpecification,
}))

vi.mock('../api/protocolSpecificationApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/protocolSpecificationApi')>(),
  getPackingListSpecificationProducts: apiMocks.getPackingListSpecificationProducts,
  uploadProductSpecificationForInvoice: apiMocks.uploadProductSpecificationForInvoice,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('../components/SpecificationProductsGrid', () => ({
  SpecificationProductsGrid: () => <div data-testid="specification-products-grid">Specification products</div>,
}))

vi.mock('../components/SpecificationTotals', () => ({
  SpecificationTotals: () => <div data-testid="specification-totals">Specification totals</div>,
}))

const PROTOCOL_NET_ID = '788a8c56-240e-4093-9007-46383f150ed2'
const protocol: SpecificationProtocol = {
  "NetUid": "788a8c56-240e-4093-9007-46383f150ed2",
  "IsCompleted": true,
  "IsShipped": true,
  "DeliveryProductProtocolNumber": {
    "Number": "P0000000001"
  },
  "SupplyInvoices": [
    {
      "Id": 813566,
      "NetUid": "2a27f6ff-e661-4bdf-9a18-dcd37cd55d5b",
      "Number": "9991",
      "DateFrom": "2026-10-28T11:32:00",
      "DateCustomDeclaration": "2026-10-28T00:00:00",
      "PackingLists": [
        {
          "Id": 813581,
          "NetUid": "0d4604a3-7976-4b33-9092-745505d2ff99",
          "InvNo": "9991",
          "FromDate": "2026-10-28T11:32:00"
        }
      ]
    },
    {
      "Id": 813567,
      "NetUid": "ca26d95f-5a71-4d83-98b8-af753fc8fb0a",
      "Number": "99992222",
      "DateFrom": "2026-10-28T15:14:00",
      "DateCustomDeclaration": "2026-10-28T00:00:00",
      "PackingLists": [
        {
          "Id": 813582,
          "NetUid": "e68455b5-725d-495b-8771-6e292279651d",
          "InvNo": "999922222",
          "FromDate": "2026-10-28T15:17:00"
        }
      ]
    }
  ]
}
const packingLists: SpecificationPackingList[] = [
  {
    "Id": 813581,
    "NetUid": "0d4604a3-7976-4b33-9092-745505d2ff99",
    "InvNo": "9991",
    "PackingListPackageOrderItems": [
      {
        "NetUid": "41b47116-2ac3-4355-b004-4a1bdd6e8960",
        "Qty": 40,
        "SupplyInvoiceOrderItem": {
          "Product": {
            "VendorCode": "900252-AL"
          }
        }
      },
      {
        "NetUid": "e3fab445-070a-4577-8004-e6593cabfcf6",
        "Qty": 30,
        "SupplyInvoiceOrderItem": {
          "Product": {
            "VendorCode": "900254-AL"
          }
        }
      },
      {
        "NetUid": "0e51ca92-1faf-4e90-947e-7cccacc7ea4f",
        "Qty": 70,
        "SupplyInvoiceOrderItem": {
          "Product": {
            "VendorCode": "900260-AL"
          }
        }
      },
      {
        "NetUid": "fcb83762-a755-4bb3-bf6e-a8c246cf3404",
        "Qty": 8,
        "SupplyInvoiceOrderItem": {
          "Product": {
            "VendorCode": "990038-AL"
          }
        }
      },
      {
        "NetUid": "7b4fe10e-a2e8-4b06-a638-1db4ed8b49ec",
        "Qty": 6,
        "SupplyInvoiceOrderItem": {
          "Product": {
            "VendorCode": "990148-AL"
          }
        }
      }
    ]
  },
  {
    "Id": 813582,
    "NetUid": "e68455b5-725d-495b-8771-6e292279651d",
    "InvNo": "999922222",
    "PackingListPackageOrderItems": [
      {
        "NetUid": "d0b8ba0f-e044-4960-bd4c-911057a94f69",
        "Qty": 25,
        "SupplyInvoiceOrderItem": {
          "Product": {
            "VendorCode": "990155-AL"
          }
        }
      },
      {
        "NetUid": "70f460d4-aa56-4ebb-a8b0-1bca87181e3e",
        "Qty": 30,
        "SupplyInvoiceOrderItem": {
          "Product": {
            "VendorCode": "990550-AL"
          }
        }
      },
      {
        "NetUid": "68ab9727-021e-4481-a060-5fcd63594040",
        "Qty": 25,
        "SupplyInvoiceOrderItem": {
          "Product": {
            "VendorCode": "990554-AL"
          }
        }
      },
      {
        "NetUid": "b5ab7e95-0b47-4e07-ab6a-36c1c6fd6102",
        "Qty": 45,
        "SupplyInvoiceOrderItem": {
          "Product": {
            "VendorCode": "990560-AL"
          }
        }
      },
      {
        "NetUid": "90c90ad4-352a-40d8-8ebd-a2550ddc4d80",
        "Qty": 6,
        "SupplyInvoiceOrderItem": {
          "Product": {
            "VendorCode": "990911-AL"
          }
        }
      },
      {
        "NetUid": "ae803d94-c8ca-49cf-b367-15574a705a5c",
        "Qty": 100,
        "SupplyInvoiceOrderItem": {
          "Product": {
            "VendorCode": "900254-AL"
          }
        }
      },
      {
        "NetUid": "4d3ef309-a4f5-4d12-a348-e25035a8f7e9",
        "Qty": 100,
        "SupplyInvoiceOrderItem": {
          "Product": {
            "VendorCode": "900253-AL"
          }
        }
      },
      {
        "NetUid": "edb495cc-226a-469a-b9e9-ec9909c38565",
        "Qty": 25,
        "SupplyInvoiceOrderItem": {
          "Product": {
            "VendorCode": "990560-AL"
          }
        }
      },
      {
        "NetUid": "a9c0e546-160b-4bb5-bc51-e8800ab6f7e2",
        "Qty": 15,
        "SupplyInvoiceOrderItem": {
          "Product": {
            "VendorCode": "990038-AL"
          }
        }
      },
      {
        "NetUid": "29472ce0-10b3-4c6e-9f10-d1e263894747",
        "Qty": 10,
        "SupplyInvoiceOrderItem": {
          "Product": {
            "VendorCode": "990554-AL"
          }
        }
      }
    ]
  }
]

function renderPage() {
  render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[`/product-delivery-protocols/${PROTOCOL_NET_ID}/specifications`]}>
          <Routes>
            <Route
              path="/product-delivery-protocols/:id/specifications"
              element={<ProductDeliveryProtocolSpecificationPage />}
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

const fields = [
  ['Код', 3], ['Митна вартість', 11], ['Митний код', 2], ['Мито', 12],
  ['Ціна', 8], ['К-сть', 9], ['Сума ПДВ', 14], ['Від', 6], ['До', 10],
] as const
const configuration = {
  VendorCode: 3, CustomsValue: 11, SpecificationCode: 2, Duty: 12,
  Price: 8, Qty: 9, VATValue: 14, StartRow: 6, EndRow: 10,
}
const file = new File(['sheet'], 'CCD_23UA400040039313U0 (2).xlsx', {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
})

async function openUpload() {
  const button = await screen.findByRole('button', { name: 'Завантаження митних кодів' })
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
  fireEvent.click(button)
  return screen.findByRole('dialog', { name: 'Завантаження митних кодів' })
}

function submitButton(dialog: HTMLElement) {
  return within(dialog.querySelector<HTMLElement>('.app-modal-footer')!).getByRole('button', { name: 'Завантажити' })
}

function fillUpload(dialog: HTMLElement) {
  for (const [label, value] of fields) {
    fireEvent.change(within(dialog).getByLabelText(label, { exact: true }), { target: { value: String(value) } })
  }
  const date = within(dialog).getByRole('textbox', { name: /Дата митної декларації/ })
  fireEvent.change(date, { target: { value: '28.10.2026' } })
  fireEvent.blur(date)
  fireEvent.change(dialog.querySelector('input[type="file"]')!, { target: { files: [file] } })
}

function expectEmpty(dialog: HTMLElement) {
  for (const [label] of fields) {
    expect((within(dialog).getByLabelText(label, { exact: true }) as HTMLInputElement).value).toBe('')
  }
  expect((within(dialog).getByRole('textbox', { name: /Дата митної декларації/ }) as HTMLInputElement).value).toBe('')
  expect(within(dialog).queryByText(file.name)).toBeNull()
  expect(dialog.querySelector<HTMLInputElement>('input[type="file"]')?.value).toBe('')
  expect(within(dialog).queryByRole('alert')).toBeNull()
}

function expectDraft(dialog: HTMLElement) {
  for (const [label, value] of fields) {
    expect((within(dialog).getByLabelText(label, { exact: true }) as HTMLInputElement).value).toBe(String(value))
  }
  expect((within(dialog).getByRole('textbox', { name: /Дата митної декларації/ }) as HTMLInputElement).value).toBe('28.10.2026')
  expect(within(dialog).getByText(file.name)).toBeTruthy()
}

describe('BUG-1477 customs-code upload lifecycle on protocol specifications', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    apiMocks.getProtocolForSpecification.mockResolvedValue(protocol)
    apiMocks.getPackingListSpecificationProducts.mockImplementation(async (netId: string) =>
      packingLists.find((pack) => pack.NetUid === netId),
    )
    apiMocks.uploadProductSpecificationForInvoice.mockResolvedValue({ SuccessfullyUpdatedProducts: ['900252-AL'] })
  })

  it.each([false, true])('clears a successful upload before reopening; another invoice=%s', async (anotherInvoice) => {
    renderPage()
    const dialog = await openUpload()
    expectEmpty(dialog)
    fillUpload(dialog)
    fireEvent.click(submitButton(dialog))
    await waitFor(() => expect(apiMocks.uploadProductSpecificationForInvoice).toHaveBeenCalledWith(
      protocol.SupplyInvoices![0].NetUid, configuration, '2026-10-28', file,
    ))
    const result = await screen.findByRole('dialog', { name: 'Результат' })
    expect(within(result).getByText('900252-AL')).toBeTruthy()
    fireEvent.click(result.querySelector('.mantine-Modal-close')!)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Завантаження митних кодів' }).hasAttribute('disabled')).toBe(false))
    if (anotherInvoice) {
      fireEvent.click(screen.getByRole('tab', { name: /99992222/ }))
      await waitFor(() => expect(apiMocks.getPackingListSpecificationProducts).toHaveBeenCalledWith(packingLists[1].NetUid))
    }
    const fresh = await openUpload()
    expectEmpty(fresh)
    fireEvent.click(submitButton(fresh))
    expect(within(fresh).getByRole('alert').textContent).toContain('Заповніть файл, дату митної декларації і колонки імпорту')
    expect(apiMocks.uploadProductSpecificationForInvoice).toHaveBeenCalledTimes(1)
    fillUpload(fresh)
    fireEvent.click(submitButton(fresh))
    await waitFor(() => expect(apiMocks.uploadProductSpecificationForInvoice).toHaveBeenLastCalledWith(
      protocol.SupplyInvoices![anotherInvoice ? 1 : 0].NetUid, configuration, '2026-10-28', file,
    ))
  })

  it('clears cancelled input and validation errors before reopening', async () => {
    renderPage()
    let dialog = await openUpload()
    fillUpload(dialog)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Скасувати' }))
    dialog = await openUpload()
    expectEmpty(dialog)
    fireEvent.click(submitButton(dialog))
    expect(within(dialog).getByRole('alert')).toBeTruthy()
    fireEvent.click(dialog.querySelector('.mantine-Modal-close')!)
    expectEmpty(await openUpload())
    expect(apiMocks.uploadProductSpecificationForInvoice).not.toHaveBeenCalled()
  })

  it('preserves a pending or failed draft and retries with the exact same invoice, date and file', async () => {
    let rejectUpload!: (error: Error) => void
    apiMocks.uploadProductSpecificationForInvoice.mockImplementationOnce(() => new Promise((_, reject) => {
      rejectUpload = reject
    }))
    renderPage()
    const dialog = await openUpload()
    fillUpload(dialog)
    fireEvent.click(submitButton(dialog))
    expect(within(dialog).getByRole('button', { name: 'Скасувати' }).hasAttribute('disabled')).toBe(true)
    expectDraft(dialog)
    await act(async () => rejectUpload(new Error('Upload failed')))
    expectDraft(dialog)
    expect(submitButton(dialog).hasAttribute('disabled')).toBe(false)
    fireEvent.click(submitButton(dialog))
    await screen.findByRole('dialog', { name: 'Результат' })
    expect(apiMocks.uploadProductSpecificationForInvoice).toHaveBeenCalledTimes(2)
    expect(apiMocks.uploadProductSpecificationForInvoice.mock.calls[0]).toEqual(apiMocks.uploadProductSpecificationForInvoice.mock.calls[1])
  })
})
