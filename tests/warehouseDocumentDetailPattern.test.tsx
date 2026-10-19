import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductCapitalizationDetailDrawer } from '../src/features/product-capitalizations/pages/ProductCapitalizationsPage'
import { TransferDetail } from '../src/features/product-transfers/pages/ProductTransfersPage'
import { DepreciatedOrderDetailDrawer } from '../src/features/depreciated-orders/components/DepreciatedOrderDetailDrawer'
import { BatchDetails } from '../src/features/product-remains/pages/ProductRemainsPage'
import { getGroupedProductRemains } from '../src/features/product-remains/api/productRemainsApi'
import type { GroupedConsignment } from '../src/features/product-remains/types'
import { renderWithMantine } from '../src/test/renderWithMantine'

const { translate } = vi.hoisted(() => ({ translate: (value: string) => value }))

vi.mock('../src/shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: translate }),
}))

vi.mock('../src/features/product-remains/api/productRemainsApi', () => ({
  getGroupedProductRemains: vi.fn(),
}))

vi.mock('../src/shared/ui/data-table/DataTable', () => ({
  DataTable: ({ data, defaultLayout, isLoading, layoutVersion, tableId }: {
    data: unknown[]
    defaultLayout: unknown
    isLoading?: boolean
    layoutVersion: string
    tableId: string
  }) => (
    <div aria-busy={Boolean(isLoading)} data-default-layout={JSON.stringify(defaultLayout)} data-layout={layoutVersion} data-testid={tableId}>
      {data.length}
    </div>
  ),
}))

type CapitalizationProps = ComponentProps<typeof ProductCapitalizationDetailDrawer>
type TransferProps = ComponentProps<typeof TransferDetail>
type WriteOffProps = ComponentProps<typeof DepreciatedOrderDetailDrawer>

function renderCapitalization(overrides: Partial<CapitalizationProps> = {}) {
  const props: CapitalizationProps = {
    capitalization: {
      NetUid: 'capitalization-1',
      Number: '0000000321',
      FromDate: '2026-08-26T16:31:00',
      Organization: { Name: 'Фенікс' },
      Storage: { Name: 'СКЛАД -1' },
      Responsible: { Name: 'Melnychenko' },
      Comment: 'Коментар оприбуткування',
      TotalAmount: 13.95,
      ProductCapitalizationItems: [{ Qty: 2, TotalAmount: 13.95, Weight: 3 }],
    },
    detailError: null,
    exportingNetId: null,
    isLoading: false,
    itemColumns: [],
    onClose: vi.fn(),
    onExport: vi.fn(),
    ...overrides,
  }
  renderWithMantine(<ProductCapitalizationDetailDrawer {...props} />)
  return props
}

function renderTransfer(overrides: Partial<TransferProps> = {}) {
  const props: TransferProps = {
    canDownload: true,
    error: null,
    isDownloading: false,
    isLoading: false,
    onDownload: vi.fn(),
    transfer: {
      NetUid: 'transfer-1',
      Number: '1',
      FromDate: '2026-08-27T12:00:00',
      FromStorage: { Name: 'СКЛАД -1' },
      ToStorage: { Name: 'СКЛАД -3' },
      Organization: { Name: 'Фенікс' },
      Responsible: { FullName: 'Відповідальна особа' },
      IsManagement: true,
      Comment: 'Коментар переміщення',
      ProductTransferItems: [{ Qty: 3 }],
    },
    ...overrides,
  }
  renderWithMantine(<TransferDetail {...props} />)
  return props
}

function renderWriteOff(overrides: Partial<WriteOffProps> = {}) {
  const props: WriteOffProps = {
    canExport: true,
    order: {
      NetUid: 'writeoff-1',
      Number: '0000000644',
      FromDate: '2026-08-26T15:27:00',
      Organization: { Name: 'Фенікс' },
      Storage: { Name: 'СКЛАД -1' },
      Responsible: { Name: 'Melnychenko' },
      IsManagement: true,
      Comment: 'продаж на АМГ',
      DepreciatedOrderItems: [{ Qty: 20 }],
    },
    detailError: null,
    downloadDocument: null,
    downloadError: null,
    downloadOpened: false,
    isDetailLoading: false,
    isDownloading: false,
    onClose: vi.fn(),
    onCloseDownload: vi.fn(),
    onExport: vi.fn(),
    ...overrides,
  }
  renderWithMantine(<DepreciatedOrderDetailDrawer {...props} />)
  return props
}

const batch: GroupedConsignment = {
  ProductIncomeNumber: '332912-1',
  InvoiceNumber: 'INV-1',
  FromDate: '2026-07-29T09:30:00',
  SupplierName: 'Постачальник з довгою назвою',
  OrganizationName: 'Організація з довгою назвою',
  TotalGrossPrice: 287.35,
  AccountingTotalGrossPrice: 287.35,
  TotalWeight: 7.139,
  RowNumber: 3,
  GroupedConsignmentItems: [{ NetUid: 'batch-item-1', RemainingQty: 30 }],
}

function renderBatch(value = batch) {
  return renderWithMantine(
    <BatchDetails batch={value} columns={[]} dateFrom="2026-07-01" dateTo="2026-08-27" storageNetIds={['storage-1']} supplierNetId="supplier-1" />,
  )
}

function expectSectionTable(tableId: string, layoutVersion: string, count: number) {
  const section = screen.getByRole('region', { name: 'Позиції' })
  expect(section.querySelector('.document-detail-section__body.is-stacked')).toBeTruthy()
  const table = within(section).getByTestId(tableId)
  expect(table.textContent).toBe(String(count))
  expect(table.getAttribute('data-layout')).toBe(layoutVersion)
  return table
}

function expectChip(region: HTMLElement, tone: string, text: string) {
  expect([...region.querySelectorAll(`.app-table-chip.is-${tone}`)].map(chip => chip.textContent)).toContain(text)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('warehouse document detail pattern', () => {
  it('keeps capitalization totals, fields, PDF action and table settings', async () => {
    const props = renderCapitalization()
    const dialog = await screen.findByRole('dialog', { name: 'Оприховування' })
    const summary = dialog.querySelector('.document-detail-summary')!
    expect(summary.querySelectorAll('.document-detail-metric')).toHaveLength(3)
    expect(summary.textContent).toContain('Кількість2Сума13,95Вага6')
    expect(dialog.querySelector('.inventory-document-detail')).toBeTruthy()
    const requisites = screen.getByRole('region', { name: 'Реквізити документа' })
    expect(within(requisites).getByText('Коментар оприбуткування')).toBeTruthy()
    expectChip(requisites, 'product', 'Фенікс')
    expectChip(requisites, 'storage', 'СКЛАД -1')
    expect(requisites.textContent).toContain('Сума документа13,95')
    const table = expectSectionTable('product-capitalization-items', 'product-capitalization-items-table-1', 1)
    expect(JSON.parse(table.getAttribute('data-default-layout')!)).toMatchObject({ columnPinning: { left: ['index', 'vendorCode', 'productName'] } })
    fireEvent.click(screen.getByRole('button', { name: 'Друк PDF' }))
    expect(props.onExport).toHaveBeenCalledWith(props.capitalization)
  })

  it('keeps capitalization loading, errors and the missing-ID export guard', async () => {
    renderCapitalization({ capitalization: { Number: 'EMPTY' }, detailError: 'Помилка оприбуткування', isLoading: true })
    await screen.findByRole('dialog', { name: 'Оприховування' })
    expect(screen.getByText('Помилка оприбуткування')).toBeTruthy()
    expect(screen.getByTestId('product-capitalization-items').getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('button', { name: 'Друк PDF' }).hasAttribute('disabled')).toBe(true)
  })

  it('keeps transfer route, management status, quantity and download action', () => {
    const props = renderTransfer()
    expect(document.querySelectorAll('.document-detail-metric')).toHaveLength(2)
    expect(document.querySelector('.document-detail-summary')?.textContent).toContain('СКЛАД -1 → СКЛАД -3')
    expect(document.querySelector('.document-detail-summary')?.textContent).toContain('Позицій1Кількість3')
    expect(screen.getByText('Управлінське').classList.contains('is-active')).toBe(true)
    expect(document.querySelector('.inventory-document-detail')).toBeTruthy()
    const requisites = screen.getByRole('region', { name: 'Реквізити переміщення' })
    expect(requisites.textContent).toContain('Відповідальна особа')
    expect(requisites.textContent).toContain('Коментар переміщення')
    expectChip(requisites, 'product', 'Фенікс')
    expect([...requisites.querySelectorAll('.app-table-chip.is-storage')].map(chip => chip.textContent)).toEqual(['СКЛАД -1', 'СКЛАД -3'])
    expectSectionTable('product-transfer-items', 'product-transfer-items-table-2', 1)
    fireEvent.click(screen.getByRole('button', { name: 'Завантажити' }))
    expect(props.onDownload).toHaveBeenCalledOnce()
  })

  it('keeps transfer loading and errors with no available download', () => {
    renderTransfer({ transfer: {}, error: 'Помилка переміщення', isLoading: true })
    expect(screen.getByText('Помилка переміщення')).toBeTruthy()
    expect(screen.getByText('Завантаження деталей')).toBeTruthy()
    expect(screen.getByTestId('product-transfer-items').getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('button', { name: 'Завантажити' }).hasAttribute('disabled')).toBe(true)
  })

  it('keeps write-off fields, quantity, management status and export action', async () => {
    const props = renderWriteOff()
    const dialog = await screen.findByRole('dialog', { name: 'Акт списання' })
    expect(dialog.querySelectorAll('.document-detail-metric')).toHaveLength(2)
    expect(dialog.querySelector('.document-detail-summary')?.textContent).toContain('Позицій1К-сть20')
    expect(screen.getByText('Управ.').classList.contains('is-active')).toBe(true)
    expect(dialog.querySelector('.inventory-document-detail')).toBeTruthy()
    const requisites = screen.getByRole('region', { name: 'Реквізити документа' })
    expect(requisites.textContent).toContain('продаж на АМГ')
    expect(requisites.textContent).toContain('Melnychenko')
    expectChip(requisites, 'product', 'Фенікс')
    expectChip(requisites, 'storage', 'СКЛАД -1')
    expectSectionTable('depreciated-order-items', 'depreciated-order-items-table-1', 1)
    fireEvent.click(screen.getByRole('button', { name: 'Завантажити' }))
    expect(props.onExport).toHaveBeenCalledWith(props.order)
  })

  it('keeps write-off loading, errors and the missing-ID export guard', async () => {
    renderWriteOff({ order: {}, detailError: 'Помилка списання', isDetailLoading: true })
    await screen.findByRole('dialog', { name: 'Акт списання' })
    expect(screen.getByText('Помилка списання')).toBeTruthy()
    expect(screen.getByText('Завантаження деталей')).toBeTruthy()
    expect(screen.getByTestId('depreciated-order-items').getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('button', { name: 'Завантажити' }).hasAttribute('disabled')).toBe(true)
  })

  it('shows preloaded batch positions and retains supplier, invoice and totals', () => {
    renderBatch()
    expect(getGroupedProductRemains).not.toHaveBeenCalled()
    expect(document.querySelectorAll('.document-detail-metric')).toHaveLength(3)
    expect(document.querySelector('.document-detail-summary')?.textContent).toContain('Сума gross287,35Облік gross287,35Вага7,139')
    expect(screen.getByRole('region', { name: 'Документ' }).textContent).toContain('INV-1')
    expect(screen.getByRole('region', { name: 'Учасники' }).querySelectorAll('.document-detail-row.is-wide')).toHaveLength(2)
    expectSectionTable('product-remains-batch-details', 'product-remains-batch-details-table-2', 1)
  })

  it('loads thin batch details with the same paging and filter scope', async () => {
    vi.mocked(getGroupedProductRemains).mockResolvedValueOnce({ Collection: [batch] })
    renderBatch({ ...batch, GroupedConsignmentItems: undefined })
    expect(screen.getByTestId('product-remains-batch-details').getAttribute('aria-busy')).toBe('true')
    expect(getGroupedProductRemains).toHaveBeenCalledWith({ from: '2026-07-01', to: '2026-08-27', includeItems: true, limit: 1, offset: 2, storageNetIds: ['storage-1'], supplierNetId: 'supplier-1' })
    await waitFor(() => expect(screen.getByTestId('product-remains-batch-details').getAttribute('aria-busy')).toBe('false'))
    expectSectionTable('product-remains-batch-details', 'product-remains-batch-details-table-2', 1)
  })

  it('retains the batch header when loading positions fails', async () => {
    vi.mocked(getGroupedProductRemains).mockRejectedValueOnce(new Error('Помилка партії'))
    renderBatch({ ...batch, GroupedConsignmentItems: undefined })
    expect(await screen.findByText('Помилка партії')).toBeTruthy()
    expect(screen.getByText('У відповіді немає позицій партії')).toBeTruthy()
    expect(document.querySelector('.document-detail-summary')?.textContent).toContain('332912-1')
  })

  it('shows the normal empty-batch state without an error', async () => {
    vi.mocked(getGroupedProductRemains).mockResolvedValueOnce({ Collection: [] })
    renderBatch({ ...batch, GroupedConsignmentItems: [] })
    expect(await screen.findByText('У відповіді немає позицій партії')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
