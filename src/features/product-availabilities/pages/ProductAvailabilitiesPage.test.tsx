import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, isLoading: false }),
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: () => <div data-testid="availability-table" />,
}))

vi.mock('../../../shared/ui/paginator/Paginator', () => ({
  Paginator: () => <div data-testid="availability-paginator" />,
}))

vi.mock('../../../shared/documents/openExportDocument', () => ({
  closePendingExportDocumentWindow: vi.fn(),
  openExportDocumentInWindow: vi.fn(() => false),
  openPendingExportDocumentWindow: vi.fn(() => null),
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
})
