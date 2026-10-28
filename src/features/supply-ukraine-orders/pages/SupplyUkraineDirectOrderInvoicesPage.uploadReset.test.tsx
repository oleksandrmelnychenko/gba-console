import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getProductForOrderInvoices } from '../../products/api/productsApi'
import {
  uploadSupplyInvoiceFile,
  uploadPackingListFile,
  getDirectSupplyOrderForInvoices,
  getSupplyInvoiceItemsForDirectOrder,
  getSupplyOrderInvoiceTotalsForInvoices,
  getSupplyOrderItemsForInvoices,
} from '../api/supplyUkraineOrdersApi'
import { SupplyUkraineDirectOrderInvoicesPage } from './SupplyUkraineDirectOrderInvoicesPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../../products/api/productsApi', () => ({
  getProductForOrderInvoices: vi.fn(),
}))

vi.mock('../../products/components/ProductCardModal', () => ({
  ProductCardModal: ({
    loadProduct,
    productNetId,
  }: {
    loadProduct: typeof getProductForOrderInvoices
    productNetId: string | null
  }) => productNetId ? (
    <output data-loader={loadProduct === getProductForOrderInvoices ? 'scoped' : 'legacy'}>
      {productNetId}
    </output>
  ) : null,
}))

vi.mock('../api/supplyUkraineOrdersApi', () => ({
  deleteDirectSupplyOrderInvoiceDocument: vi.fn(),
  deletePackingList: vi.fn(),
  deleteSupplyInvoice: vi.fn(),
  getDirectSupplyOrderForInvoices: vi.fn(),
  getDirectSupplyOrderInvoiceInformationProtocolKeys: vi.fn(async () => []),
  getDirectSupplyOrderInvoicePaymentProtocolKeys: vi.fn(async () => []),
  getDirectSupplyOrderInvoiceResponsibleUsers: vi.fn(async () => []),
  getSupplyInvoiceItemsForDirectOrder: vi.fn(),
  getSupplyOrderInvoiceTotalsForInvoices: vi.fn(),
  getSupplyOrderItemsForInvoices: vi.fn(),
  updateDirectSupplyOrderInvoice: vi.fn(),
  updateDirectSupplyOrderInvoiceItems: vi.fn(),
  updateDirectSupplyOrderPackingLists: vi.fn(),
  uploadDirectSupplyOrderInvoiceDocuments: vi.fn(),
  uploadPackingListDocuments: vi.fn(),
  uploadPackingListFile: vi.fn(),
  uploadSupplyInvoiceFile: vi.fn(),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) =>
    opened ? <section>{children}</section> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    columns,
    data,
    tableId,
  }: {
    columns: Array<{ cell?: (item: unknown) => ReactNode; id: string }>
    data: unknown[]
    tableId: string
  }) => (
    <section data-testid={tableId}>
      {data.map((item, rowIndex) => (
        <div data-testid={`${tableId}-row`} key={rowIndex}>
          {columns.map((column) => (
            <span data-column={column.id} key={column.id}>{column.cell?.(item)}</span>
          ))}
        </div>
      ))}
    </section>
  ),
}))

vi.mock('../../../shared/ui/table-row-action', () => ({
  TableRowAction: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button type="button" onClick={onClick}>{label}</button>
  ),
}))

const ORDER = {
  "NetUid": "5ba3cdd9-1d33-4cf4-8b6b-f6fb0354b17e",
  "Qty": 535,
  "SupplyProFormId": 813532,
  "SupplyOrderNumber": {
    "Number": "00000002413"
  },
  "SupplyProForm": {
    "Id": 813532
  },
  "SupplyInvoices": [
    {
      "NetUid": "2a27f6ff-e661-4bdf-9a18-dcd37cd55d5b",
      "Number": "9991",
      "DateFrom": "2026-10-28T11:32:00",
      "SupplyInvoiceOrderItems": [
        {
          "NetUid": "8f8fb5e7-5813-4767-8655-7d5f095b4938",
          "Qty": 40,
          "UnitPrice": 32.08,
          "SupplyOrderItemId": 5081954,
          "ProductId": 38298749,
          "Product": {
            "NetUid": "bb306d01-41e3-4b75-98c3-9c5e993a7464",
            "VendorCode": "900252-AL",
            "Name": "Амортизатор підвіски причіпу"
          }
        },
        {
          "NetUid": "f593ca2c-115b-4b86-a162-048ef0312426",
          "Qty": 30,
          "UnitPrice": 33.16,
          "SupplyOrderItemId": 5081955,
          "ProductId": 38299628,
          "Product": {
            "NetUid": "9292bc7b-1f67-44d1-b484-908192258d28",
            "VendorCode": "900254-AL",
            "Name": "Амортизатор підвіски причіпу"
          }
        },
        {
          "NetUid": "a2e9f30b-f04a-4d07-89c7-12e3308a46d0",
          "Qty": 70,
          "UnitPrice": 29.68,
          "SupplyOrderItemId": 5081956,
          "ProductId": 38299037,
          "Product": {
            "NetUid": "34a5813a-352c-4003-81d7-9ef89b17c427",
            "VendorCode": "900260-AL",
            "Name": "Амортизатор підвіски причіпу"
          }
        },
        {
          "NetUid": "420ffbbc-c99b-4531-970a-aa4146ba0e4a",
          "Qty": 8,
          "UnitPrice": 36.29,
          "SupplyOrderItemId": 5081957,
          "ProductId": 38296524,
          "Product": {
            "NetUid": "73408b14-3cbe-4319-b89d-b7e33979e8a0",
            "VendorCode": "990038-AL",
            "Name": "Амортизатор підвіски причіпу"
          }
        },
        {
          "NetUid": "a6c0098b-5898-4f62-96e7-312add4e81ab",
          "Qty": 6,
          "UnitPrice": 34.91,
          "SupplyOrderItemId": 5081958,
          "ProductId": 38302071,
          "Product": {
            "NetUid": "13bb7bd7-4754-4ce4-9b54-7b4824f07da3",
            "VendorCode": "990148-AL",
            "Name": "Амортизатор підвіски причіпу"
          }
        }
      ],
      "PackingLists": [
        {
          "NetUid": "0d4604a3-7976-4b33-9092-745505d2ff99",
          "No": "9991",
          "InvNo": "9991",
          "FromDate": "2026-10-28T11:32:00",
          "PackingListPackageOrderItems": []
        }
      ]
    }
  ]
}

const ORDER_ITEMS = [
  {
    "NetUid": "c03a3014-f4b6-4b83-9ac2-9a8a023d1b43",
    "Qty": 8,
    "Id": 5081957,
    "Product": {
      "NetUid": "73408b14-3cbe-4319-b89d-b7e33979e8a0",
      "VendorCode": "990038-AL",
      "Name": "Амортизатор підвіски причіпу"
    }
  },
  {
    "NetUid": "c3c99f3f-d462-4220-b730-f38873acf294",
    "Qty": 6,
    "Id": 5081958,
    "Product": {
      "NetUid": "13bb7bd7-4754-4ce4-9b54-7b4824f07da3",
      "VendorCode": "990148-AL",
      "Name": "Амортизатор підвіски причіпу"
    }
  },
  {
    "NetUid": "3c927b30-69ed-4cc9-b7a0-afda1bcb356a",
    "Qty": 6,
    "Id": 5081963,
    "Product": {
      "NetUid": "154ea487-b6ed-44ec-891b-09bc91040800",
      "VendorCode": "990911-AL",
      "Name": "Амортизатор підвіски причіпу"
    }
  },
  {
    "NetUid": "a7339549-187d-4514-b29a-bcabb759246e",
    "Qty": 15,
    "Id": 5081967,
    "Product": {
      "NetUid": "73408b14-3cbe-4319-b89d-b7e33979e8a0",
      "VendorCode": "990038-AL",
      "Name": "Амортизатор підвіски причіпу"
    }
  },
  {
    "NetUid": "1d7e50c9-2a6a-46b3-84b7-4788307eb4b9",
    "Qty": 30,
    "Id": 5081960,
    "Product": {
      "NetUid": "7aba1d24-f727-453e-9ccd-d6f60000c35b",
      "VendorCode": "990550-AL",
      "Name": "Амортизатор підвіски причіпу"
    }
  },
  {
    "NetUid": "b25f164d-3da0-4c0c-a6d6-f758cf7a8793",
    "Qty": 25,
    "Id": 5081959,
    "Product": {
      "NetUid": "d1054933-7d57-41e3-9de9-d935301ba6ff",
      "VendorCode": "990155-AL",
      "Name": "Амортизатор підвіски причіпу"
    }
  },
  {
    "NetUid": "2208fb39-d093-4c3a-a091-d96f97a30e8c",
    "Qty": 40,
    "Id": 5081954,
    "Product": {
      "NetUid": "bb306d01-41e3-4b75-98c3-9c5e993a7464",
      "VendorCode": "900252-AL",
      "Name": "Амортизатор підвіски причіпу"
    }
  },
  {
    "NetUid": "d161a5f0-373a-4278-a97b-5eb25fa7425e",
    "Qty": 100,
    "Id": 5081965,
    "Product": {
      "NetUid": "d56bcaf8-adfd-4256-bc20-c751ffdd1be0",
      "VendorCode": "900253-AL",
      "Name": "Амортизатор підвіски причіпу"
    }
  },
  {
    "NetUid": "1258862a-6cd1-4840-99bb-21a56733df06",
    "Qty": 100,
    "Id": 5081964,
    "Product": {
      "NetUid": "9292bc7b-1f67-44d1-b484-908192258d28",
      "VendorCode": "900254-AL",
      "Name": "Амортизатор підвіски причіпу"
    }
  },
  {
    "NetUid": "7f9096ad-5320-41ab-9dc9-6e6b041aa8b6",
    "Qty": 30,
    "Id": 5081955,
    "Product": {
      "NetUid": "9292bc7b-1f67-44d1-b484-908192258d28",
      "VendorCode": "900254-AL",
      "Name": "Амортизатор підвіски причіпу"
    }
  },
  {
    "NetUid": "cad72daf-b237-49cf-b604-c92fd84f4ba5",
    "Qty": 45,
    "Id": 5081962,
    "Product": {
      "NetUid": "d2fa3977-064b-430c-b3f2-e8a784186498",
      "VendorCode": "990560-AL",
      "Name": "Амортизатор підвіски причіпу"
    }
  },
  {
    "NetUid": "d91f5e96-0b46-43ab-b873-201766e3e155",
    "Qty": 25,
    "Id": 5081966,
    "Product": {
      "NetUid": "d2fa3977-064b-430c-b3f2-e8a784186498",
      "VendorCode": "990560-AL",
      "Name": "Амортизатор підвіски причіпу"
    }
  },
  {
    "NetUid": "f2780cc5-7a64-4b8b-83c9-cd145a2d83bb",
    "Qty": 70,
    "Id": 5081956,
    "Product": {
      "NetUid": "34a5813a-352c-4003-81d7-9ef89b17c427",
      "VendorCode": "900260-AL",
      "Name": "Амортизатор підвіски причіпу"
    }
  },
  {
    "NetUid": "92691807-270a-4f0a-8229-3eea0f74aad3",
    "Qty": 25,
    "Id": 5081961,
    "Product": {
      "NetUid": "c621e287-af20-45cf-aeaf-b403231dcf20",
      "VendorCode": "990554-AL",
      "Name": "Амортизатор підвіски причіпу"
    }
  },
  {
    "NetUid": "3eb149ed-6d98-4bf9-8f59-9dfa981d3db4",
    "Qty": 10,
    "Id": 5081968,
    "Product": {
      "NetUid": "c621e287-af20-45cf-aeaf-b403231dcf20",
      "VendorCode": "990554-AL",
      "Name": "Амортизатор підвіски причіпу"
    }
  }
]

const INVOICE = ORDER.SupplyInvoices[0]

function renderPage() {
  return render(
    <MantineProvider env="test">
      <I18nProvider>
        <MemoryRouter initialEntries={[`/orders/ukraine/all/edit/${ORDER.NetUid}/supply-invoices`]}>
          <Routes>
            <Route path="/orders/ukraine/all/edit/:id/supply-invoices" element={<SupplyUkraineDirectOrderInvoicesPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

const scenarios = [
  { name: 'invoice', button: 'Додати інвойс', checkbox: 'Імпортний товар', upload: uploadSupplyInvoiceFile },
  { name: 'packing list', button: 'Додати пак лист', checkbox: 'Вага на одиницю', upload: uploadPackingListFile },
] as const

type Scenario = typeof scenarios[number]

async function openForm(scenario: Scenario) {
  const button = await screen.findByRole('button', { name: scenario.button })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button)
  return within(await screen.findByRole('dialog', { name: scenario.button }))
}

function fillForm(scenario: Scenario, number = '9992') {
  const dialog = screen.getByRole('dialog', { name: scenario.button })
  const form = within(dialog)
  const values = {
    'Номер': number,
    'Коментар': `Document ${number}`,
    'Дата': '28.10.2026 11:32',
    'Код товару': '3',
    'Кількість': '9',
    'З рядка': '6',
    'До рядка': '10',
    'Ціна': '8',
    ...(scenario.name === 'packing list' ? { 'Нетто': '11', 'Брутто': '12' } : {}),
  }
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(form.getByLabelText(label, { exact: true, selector: 'input:not([type=radio]), textarea' }), { target: { value } })
  }
  const file = new File(['spreadsheet fixture'], `${number}.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  fireEvent.change(dialog.querySelector('input[type="file"]')!, { target: { files: [file] } })
  fireEvent.click(form.getByLabelText(scenario.checkbox))
  if (scenario.name === 'invoice') {
    fireEvent.click(form.getByRole('radio', { name: 'Сума' }))
    fireEvent.change(form.getByLabelText('Сума', { exact: true, selector: 'input:not([type=radio]), textarea' }), { target: { value: '13' } })
  }
  return file
}

function expectEmptyForm(scenario: Scenario) {
  const form = within(screen.getByRole('dialog', { name: scenario.button }))
  for (const label of ['Номер', 'Коментар', 'Код товару', 'Кількість', 'З рядка', 'До рядка', 'Ціна',
    ...(scenario.name === 'invoice' ? ['Сума'] : ['Нетто', 'Брутто'])]) {
    expect((form.getByLabelText(label, { exact: true, selector: 'input:not([type=radio]), textarea' }) as HTMLInputElement).value).toBe('')
  }
  expect(form.getByText('Оберіть файл')).toBeTruthy()
  expect((form.getByLabelText(scenario.checkbox) as HTMLInputElement).checked).toBe(true)
  if (scenario.name === 'invoice') expect((form.getByRole('radio', { name: 'Ціна' }) as HTMLInputElement).checked).toBe(true)
  const [date, time] = (form.getByLabelText('Дата') as HTMLInputElement).value.split(' ')
  expect(date).toBe('29.10.2026')
  expect(time).toBe('14:45')
}

describe.each(scenarios)('$name creation draft lifecycle', (scenario) => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 28, 11, 32))
    allowedPermissions.clear()
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Order.OpenProducts)
    allowedPermissions.add(PermissionKeys.OrdersUkraine.Invoice.Upload)
    allowedPermissions.add(PermissionKeys.OrdersUkraine.PackList.Upload)
    vi.clearAllMocks()
    vi.mocked(getDirectSupplyOrderForInvoices).mockResolvedValue(ORDER)
    vi.mocked(getSupplyOrderItemsForInvoices).mockResolvedValue(ORDER_ITEMS)
    vi.mocked(getSupplyOrderInvoiceTotalsForInvoices).mockResolvedValue({ TotalItemsCount: 15, TotalQuantity: 535, TotalAmount: 17822.89 })
    vi.mocked(getSupplyInvoiceItemsForDirectOrder).mockResolvedValue(INVOICE)
    vi.mocked(uploadSupplyInvoiceFile).mockResolvedValue({ NetUid: 'created-invoice', Number: '9992' })
    vi.mocked(uploadPackingListFile).mockResolvedValue({ NetUid: 'created-pack-list', No: '9992' })
  })

  afterEach(() => vi.useRealTimers())

  it('initializes the date when first opened after the page has been idle', async () => {
    renderPage()
    await screen.findByRole('button', { name: scenario.button })
    vi.setSystemTime(new Date(2026, 9, 29, 14, 45))
    await openForm(scenario)
    expectEmptyForm(scenario)
  })

  it('clears every draft field after success and submits only the next document values', async () => {
    renderPage()
    expect(await screen.findAllByTestId('supply-direct-order-items-row')).toHaveLength(15)
    fireEvent.click(screen.getByRole('tab', { name: 'Інвойси' }))
    const rows = await screen.findAllByTestId('supply-direct-invoice-items-row')
    expect(rows).toHaveLength(5)
    expect(rows.map((row) => row.querySelector('[data-column="qty"]')?.textContent)).toEqual(['40', '30', '70', '8', '6'])
    expect(rows.map((row) => row.querySelector('[data-column="price"]')?.textContent)).toEqual(['32,08', '33,16', '29,68', '36,29', '34,91'])
    await openForm(scenario)
    fillForm(scenario)
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))
    await waitFor(() => expect(scenario.upload).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: scenario.button })).toBeNull())
    vi.setSystemTime(new Date(2026, 9, 29, 14, 45))
    await openForm(scenario)
    expectEmptyForm(scenario)
    const file = fillForm(scenario, '9993')
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))
    await waitFor(() => expect(scenario.upload).toHaveBeenCalledTimes(2))
    expect(scenario.upload).toHaveBeenLastCalledWith(expect.objectContaining({
      file,
      ...(scenario.name === 'invoice'
        ? { supplyOrderNetId: ORDER.NetUid, invoice: { Number: '9993', Comment: 'Document 9993', DateFrom: '2026-10-28T11:32:00' } }
        : { supplyInvoiceNetId: INVOICE.NetUid, packingList: { No: '9993', InvNo: '9993', Comment: 'Document 9993', FromDate: '2026-10-28T11:32:00' } }),
      parseConfiguration: expect.objectContaining({ VendorCodeColumnNumber: 3, QtyColumnNumber: 9, StartRow: 6, EndRow: 10 }),
    }))
    expect(getDirectSupplyOrderForInvoices).toHaveBeenCalledWith(ORDER.NetUid)
    expect(getSupplyInvoiceItemsForDirectOrder).toHaveBeenCalledWith(INVOICE.NetUid)
  })

  it.each(['Скасувати', 'Закрити'])('starts fresh after %s and uses the time of reopening', async (closeButton) => {
    renderPage()
    await openForm(scenario)
    fillForm(scenario)
    fireEvent.click(screen.getByRole('button', { name: closeButton }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: scenario.button })).toBeNull())
    vi.setSystemTime(new Date(2026, 9, 29, 14, 45))
    await openForm(scenario)
    expectEmptyForm(scenario)
    expect(scenario.upload).not.toHaveBeenCalled()
  })

  it('preserves the complete draft on upload failure and permits retry', async () => {
    vi.mocked(scenario.upload).mockRejectedValueOnce(new Error('Upload failed'))
    renderPage()
    await openForm(scenario)
    const file = fillForm(scenario)
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }))
    await waitFor(() => expect(scenario.upload).toHaveBeenCalledTimes(1))
    const form = within(screen.getByRole('dialog', { name: scenario.button }))
    await waitFor(() => expect((form.getByLabelText('Номер') as HTMLInputElement).disabled).toBe(false))
    expect((form.getByLabelText('Номер') as HTMLInputElement).value).toBe('9992')
    expect((form.getByLabelText('Коментар') as HTMLTextAreaElement).value).toBe('Document 9992')
    expect(form.getByText(file.name)).toBeTruthy()
    expect((form.getByLabelText(scenario.checkbox) as HTMLInputElement).checked).toBe(false)
    fireEvent.click(form.getByRole('button', { name: 'Створити' }))
    await waitFor(() => expect(scenario.upload).toHaveBeenCalledTimes(2))
    const calls = vi.mocked(scenario.upload).mock.calls
    expect(calls[1]).toEqual(calls[0])
    await waitFor(() => expect(screen.queryByRole('dialog', { name: scenario.button })).toBeNull())
  })

  it('keeps a draft open on validation failure without sending a request', async () => {
    renderPage()
    const form = await openForm(scenario)
    fillForm(scenario)
    fireEvent.change(form.getByLabelText('До рядка'), { target: { value: '2' } })
    fireEvent.click(form.getByRole('button', { name: 'Створити' }))
    expect(scenario.upload).not.toHaveBeenCalled()
    expect((form.getByLabelText('Номер') as HTMLInputElement).value).toBe('9992')
    expect((form.getByLabelText('До рядка') as HTMLInputElement).value).toBe('2')
    expect(form.getByText('9992.xlsx')).toBeTruthy()
  })
})
