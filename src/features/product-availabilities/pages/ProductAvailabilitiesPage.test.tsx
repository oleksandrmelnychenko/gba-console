import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  exportProductAvailabilities,
  getProductAvailabilities,
  getProductAvailabilityStorages,
} from '../api/productAvailabilitiesApi'
import type { ConsignmentAvailabilityItem } from '../types'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { ProductAvailabilitiesPage } from './ProductAvailabilitiesPage'

vi.mock('../api/productAvailabilitiesApi', () => ({
  exportProductAvailabilities: vi.fn(),
  getProductAvailabilities: vi.fn(),
  getProductAvailabilityStorages: vi.fn(),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, isLoading: false }),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ data, columns }: { data: ConsignmentAvailabilityItem[]; columns: DataTableColumn<ConsignmentAvailabilityItem>[] }) => (
    <table data-testid="availability-table"><tbody>{data.map((item) => (
      <tr key={item.Id}>{columns.map((column) => <td key={column.id} data-testid={column.id}>{column.cell?.(item)}</td>)}</tr>
    ))}</tbody></table>
  ),
}))

vi.mock('../../../shared/ui/paginator/Paginator', () => ({
  Paginator: () => <div data-testid="availability-paginator" />,
}))

function renderPage() {
  return render(
    <MantineProvider env="test">
      <I18nProvider>
        <ProductAvailabilitiesPage />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('ProductAvailabilitiesPage date range', () => {
  beforeEach(() => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    vi.mocked(exportProductAvailabilities).mockReset()
    vi.mocked(getProductAvailabilities).mockReset()
    vi.mocked(getProductAvailabilityStorages).mockReset()
    vi.mocked(getProductAvailabilityStorages).mockResolvedValue([
      { Name: 'СКЛАД -3', NetUid: 'storage-3' },
    ])
    vi.mocked(getProductAvailabilities).mockResolvedValue({
      Availabilities: [],
      Total: 0,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('includes older remaining lots by default without an implicit date filter', async () => {
    renderPage()

    await waitFor(() => {
      expect(getProductAvailabilities).toHaveBeenCalledWith({
        from: undefined,
        limit: expect.any(Number),
        offset: 0,
        storageNetId: 'storage-3',
        to: undefined,
        vendorCode: '',
      })
    })

    fireEvent.click(screen.getByRole('button', { name: /^Період:/ }))
    expect((await screen.findByLabelText('Від') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe('')
  })

  it('shows 101151CNT as three units with one N/N/N placement and the full remaining cost', async () => {
    vi.mocked(getProductAvailabilityStorages).mockResolvedValue([
      { Name: 'СКЛАД -1', NetUid: '7d2f6f3c-7c9a-42f0-abc8-7e6c06284a7c' },
    ])
    vi.mocked(getProductAvailabilities).mockImplementation(async ({ from, to }) => ({
      Availabilities: from || to ? [] : [{
        Id: 38266787, ProductNetId: '9a4931c2-4f96-492b-82ad-df75fb022580',
        VendorCode: '101151CNT', ProductName: 'Підніжка кабіни', Qty: 3,
        GrossPrice: 110.66, AccountingGrossPrice: 110.66, UnitGrossPrice: 36.89,
        StorageName: 'СКЛАД -1',
        Placements: [{ StorageNumber: 'N', RowNumber: 'N', CellNumber: 'N', Qty: 3 }],
      }],
      Total: from || to ? 0 : 1,
    }))
    renderPage()
    expect(await screen.findByText('101151CNT')).toBeTruthy()
    expect(screen.getByTestId('qty').textContent).toBe('3')
    expect(screen.getByTestId('placing').textContent).toBe('Позиція N-N-N. Кількість 3')
    expect(screen.getByTestId('grossPrice').textContent).toBe('110,66')
    expect(screen.getByTestId('unitGrossPrice').textContent).toBe('36,89')
    expect(within(screen.getByTestId('availability-table')).getAllByRole('row')).toHaveLength(1)
  })

  it('does not invent a single unit price for lots with different costs', async () => {
    vi.mocked(getProductAvailabilities).mockResolvedValue({
      Availabilities: [{ Id: 1, Qty: 3, GrossPrice: 120, UnitGrossPrice: null }], Total: 1,
    })
    renderPage()
    expect((await screen.findByTestId('unitGrossPrice')).textContent).toBe('—')
    expect(screen.getByTestId('qty').textContent).toBe('3')
    expect(screen.getByTestId('grossPrice').textContent).toBe('120,00')
  })

  it('keeps filtering by Kyiv business dates when the user explicitly selects both bounds', async () => {
    renderPage()

    await waitFor(() => expect(getProductAvailabilities).toHaveBeenCalledTimes(1))
    vi.mocked(getProductAvailabilities).mockClear()

    fireEvent.click(screen.getByRole('button', { name: /^Період:/ }))
    fireEvent.change(await screen.findByLabelText('Від'), {
      target: { value: '2026-08-01' },
    })
    fireEvent.change(screen.getByLabelText('До'), {
      target: { value: '2026-08-08' },
    })

    expect(getProductAvailabilities).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Застосувати' }))

    await waitFor(() => {
      expect(getProductAvailabilities).toHaveBeenCalledTimes(1)
      expect(getProductAvailabilities).toHaveBeenCalledWith({
        from: '2026-08-01',
        limit: expect.any(Number),
        offset: 0,
        storageNetId: 'storage-3',
        to: '2026-08-08',
        vendorCode: '',
      })
    })
  })

  it('restores all current stock when filters are reset', async () => {
    renderPage()

    await waitFor(() => expect(getProductAvailabilities).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /^Період:/ }))
    fireEvent.change(await screen.findByLabelText('Від'), {
      target: { value: '2026-08-01' },
    })
    fireEvent.change(screen.getByLabelText('До'), {
      target: { value: '2026-08-08' },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Застосувати' }))
    await waitFor(() => expect(getProductAvailabilities).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-08-01', to: '2026-08-08' })))
    fireEvent.click(screen.getByLabelText('Скинути'))
    await waitFor(() => expect(getProductAvailabilities).toHaveBeenLastCalledWith(expect.objectContaining({ from: undefined, to: undefined })))
    fireEvent.click(screen.getByRole('button', { name: /^Період:/ }))

    await waitFor(() => {
      expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('')
      expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe('')
    })
  })

  it('exports all current stock when no period is selected', async () => {
    vi.mocked(exportProductAvailabilities).mockResolvedValue({})

    renderPage()

    await waitFor(() => expect(getProductAvailabilities).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByLabelText('Друк PDF'))

    await waitFor(() => {
      expect(exportProductAvailabilities).toHaveBeenCalledWith({
        from: undefined,
        storageNetId: 'storage-3',
        to: undefined,
        vendorCode: '',
      })
    })
  })

  it('keeps printing in the shared modal until the user chooses an available format', async () => {
    let resolveExport!: (document: { DocumentURL: string; PdfDocumentURL: string }) => void
    vi.mocked(exportProductAvailabilities).mockReturnValue(new Promise((resolve) => {
      resolveExport = resolve
    }))

    renderPage()
    await waitFor(() => expect(getProductAvailabilities).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByLabelText('Друк PDF'))

    const dialog = await screen.findByRole('dialog', { name: /Друк PDF/ })
    expect(within(dialog).getByText('Зачекайте, файл формується')).toBeTruthy()
    expect(within(dialog).queryByRole('link')).toBeNull()
    expect(window.open).not.toHaveBeenCalled()

    await act(async () => resolveExport({
      DocumentURL: 'https://example.com/availability.xlsx',
      PdfDocumentURL: 'https://example.com/availability.pdf',
    }))

    const excel = await within(dialog).findByRole('link', { name: /Excel/ })
    const pdf = within(dialog).getByRole('link', { name: /PDF/ })
    expect(excel.getAttribute('href')).toBe('https://example.com/availability.xlsx')
    expect(pdf.getAttribute('href')).toBe('https://example.com/availability.pdf')
    expect(excel.getAttribute('target')).toBe('_blank')
    expect(pdf.getAttribute('target')).toBe('_blank')
    expect(window.open).not.toHaveBeenCalled()

    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('shows export errors in the modal and clears them on retry', async () => {
    vi.mocked(exportProductAvailabilities)
      .mockRejectedValueOnce(new Error('Помилка експорту'))
      .mockResolvedValueOnce({ PdfDocumentURL: 'https://example.com/availability.pdf' })

    renderPage()
    await waitFor(() => expect(getProductAvailabilities).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByLabelText('Друк PDF'))

    const failedDialog = await screen.findByRole('dialog', { name: /Друк PDF/ })
    expect(await within(failedDialog).findByText('Помилка експорту')).toBeTruthy()
    fireEvent.keyDown(failedDialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    fireEvent.click(screen.getByLabelText('Друк PDF'))
    const retryDialog = await screen.findByRole('dialog', { name: /Друк PDF/ })
    expect(await within(retryDialog).findByRole('link', { name: /PDF/ })).toBeTruthy()
    expect(within(retryDialog).queryByRole('link', { name: /Excel/ })).toBeNull()
    expect(within(retryDialog).queryByText('Помилка експорту')).toBeNull()
    expect(window.open).not.toHaveBeenCalled()
  })

  it('shows an empty state instead of opening a blank tab when no formats are returned', async () => {
    vi.mocked(exportProductAvailabilities).mockResolvedValue({})

    renderPage()
    await waitFor(() => expect(getProductAvailabilities).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByLabelText('Друк PDF'))

    const dialog = await screen.findByRole('dialog', { name: /Друк PDF/ })
    expect(await within(dialog).findByText('Документ недоступний для завантаження')).toBeTruthy()
    expect(within(dialog).queryByRole('link')).toBeNull()
    expect(window.open).not.toHaveBeenCalled()
  })
})
