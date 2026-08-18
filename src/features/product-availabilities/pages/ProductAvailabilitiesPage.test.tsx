import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
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

  it('requests every active lot by default instead of silently limiting availability to seven days', async () => {
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

    expect((screen.getByLabelText('Від') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('До') as HTMLInputElement).value).toBe('')
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
})
