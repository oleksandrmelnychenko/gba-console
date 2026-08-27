import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import {
  exportProductAvailabilities,
  getProductAvailabilities,
  getProductAvailabilityStorages,
} from '../api/productAvailabilitiesApi'
import { ProductAvailabilitiesPage } from './ProductAvailabilitiesPage'

vi.mock('../api/productAvailabilitiesApi', () => ({
  exportProductAvailabilities: vi.fn(),
  getProductAvailabilities: vi.fn(),
  getProductAvailabilityStorages: vi.fn(),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: () => <div data-testid="availability-table" />,
}))

vi.mock('../../../shared/ui/paginator/Paginator', () => ({
  Paginator: () => <div data-testid="availability-paginator" />,
}))

function renderPage() {
  return render(
    <MantineProvider>
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

  it('requests exactly the current Kyiv business day by default', async () => {
    const today = formatKyivBusinessDate()

    renderPage()

    await waitFor(() => {
      expect(getProductAvailabilities).toHaveBeenCalledWith({
        from: today,
        limit: expect.any(Number),
        offset: 0,
        storageNetId: 'storage-3',
        to: today,
        vendorCode: '',
      })
    })

    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe(today)
    expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe(today)
  })

  it('keeps filtering by Kyiv business dates when the user explicitly selects both bounds', async () => {
    renderPage()

    await waitFor(() => expect(getProductAvailabilities).toHaveBeenCalledTimes(1))
    vi.mocked(getProductAvailabilities).mockClear()

    fireEvent.change(screen.getByLabelText('Від'), {
      target: { value: '2026-08-01' },
    })
    fireEvent.change(screen.getByLabelText('До'), {
      target: { value: '2026-08-08' },
    })

    await waitFor(() => {
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

  it('restores the current Kyiv business day when filters are reset', async () => {
    const today = formatKyivBusinessDate()

    renderPage()

    await waitFor(() => expect(getProductAvailabilities).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('Від'), {
      target: { value: '2026-08-01' },
    })
    fireEvent.change(screen.getByLabelText('До'), {
      target: { value: '2026-08-08' },
    })
    fireEvent.click(screen.getByLabelText('Скинути'))

    await waitFor(() => {
      expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe(today)
      expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe(today)
    })
  })

  it('exports the same one-day Kyiv range shown in the filter', async () => {
    const today = formatKyivBusinessDate()
    vi.mocked(exportProductAvailabilities).mockResolvedValue({})

    renderPage()

    await waitFor(() => expect(getProductAvailabilities).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByLabelText('Друк PDF'))

    await waitFor(() => {
      expect(exportProductAvailabilities).toHaveBeenCalledWith({
        from: today,
        storageNetId: 'storage-3',
        to: today,
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
    expect(await within(dialog).findByText('Файл не сформовано')).toBeTruthy()
    expect(within(dialog).queryByRole('link')).toBeNull()
    expect(window.open).not.toHaveBeenCalled()
  })
})
