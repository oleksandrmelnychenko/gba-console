import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { VehicleRegistryPage } from './VehicleRegistryPage'

const {
  canMock,
  getFiltersMock,
  getImportIssuesMock,
  getImportsMock,
  getImportTotalMock,
  getSummaryMock,
  getVehicleMock,
  getVehiclesMock,
  updateWorkflowMock,
} = vi.hoisted(() => ({
  canMock: vi.fn<(permissionKey: string) => boolean>(),
  getFiltersMock: vi.fn(),
  getImportIssuesMock: vi.fn(),
  getImportsMock: vi.fn(),
  getImportTotalMock: vi.fn(),
  getSummaryMock: vi.fn(),
  getVehicleMock: vi.fn(),
  getVehiclesMock: vi.fn(),
  updateWorkflowMock: vi.fn(),
}))

vi.mock('../../auth/usePermissions', () => ({
  usePermissions: () => ({
    can: canMock,
    cannot: (permissionKey: string) => !canMock(permissionKey),
    isLoading: false,
    permissions: [],
  }),
}))

vi.mock('../api/vehicleRegistryApi', () => ({
  getVehicleRegistryFilters: getFiltersMock,
  getVehicleRegistryImportIssues: getImportIssuesMock,
  getVehicleRegistryImports: getImportsMock,
  getVehicleRegistryImportTotal: getImportTotalMock,
  getVehicleRegistrySummary: getSummaryMock,
  getVehicleRegistryVehicle: getVehicleMock,
  getVehicleRegistryVehicles: getVehiclesMock,
  importVehicleRegistryFile: vi.fn(),
  updateVehicleRegistryWorkflow: updateWorkflowMock,
}))

const vehicle = {
  NetUid: '11111111-1111-1111-1111-111111111111',
  PlateNumber: 'AA0001AA',
  Vin: 'VIN-1',
  Brand: 'Toyota',
  Model: 'Corolla',
  EngineVolumeCc: 1800,
  ManufactureYear: 2024,
  OwnerName: 'Тестовий власник',
  Address: 'Київ',
  Region: 'Київ',
  WorkflowStatus: 'new' as const,
  DataQualityStatus: 'valid' as const,
  LatestChangeType: 'created',
  IsCurrent: true,
  IsProcessed: false,
  ClientMatchCount: 0,
  UpdatedAtUtc: '2026-08-18T00:00:00Z',
  LastSeenAtUtc: '2026-08-18T00:00:00Z',
  ImportFileName: 'vehicles.xlsx',
  ImportNetUid: '22222222-2222-2222-2222-222222222222',
}

const imported = {
  NetUid: '22222222-2222-2222-2222-222222222222',
  OriginalFileName: 'vehicles.xlsx',
  Brand: 'Toyota',
  Status: 'completed' as const,
  TotalRows: 1,
  ValidRows: 1,
  WarningRows: 0,
  InvalidRows: 0,
  DuplicateRows: 0,
  AddedVehicles: 1,
  UpdatedVehicles: 0,
  UnchangedVehicles: 0,
  CreatedAtUtc: '2026-08-18T00:00:00Z',
  CompletedAtUtc: '2026-08-18T00:01:00Z',
}

function renderPage(allowed: string[] = []) {
  const permissionSet = new Set(allowed)
  canMock.mockImplementation((permissionKey) => permissionSet.has(permissionKey))

  return render(
    <MantineProvider>
      <I18nProvider>
        <VehicleRegistryPage />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('VehicleRegistryPage permissions', () => {
  beforeEach(() => {
    canMock.mockReset()
    getFiltersMock.mockReset().mockResolvedValue({
      Brands: ['Toyota'],
      Models: ['Corolla'],
      Regions: ['Київ'],
    })
    getImportIssuesMock.mockReset().mockResolvedValue({
      Items: [],
      Limit: 200,
      Offset: 0,
      Total: 0,
    })
    getImportsMock.mockReset().mockResolvedValue({
      Items: [imported],
      Limit: 50,
      Offset: 0,
      Total: 1,
    })
    getImportTotalMock.mockReset().mockResolvedValue(1)
    getSummaryMock.mockReset().mockResolvedValue({
      Total: 1,
      Pending: 1,
      Processed: 0,
      Brands: 1,
      WorkflowCounts: { new: 1 },
      DataQualityCounts: { valid: 1 },
      LatestImport: imported,
    })
    getVehicleMock.mockReset().mockResolvedValue({
      ...vehicle,
      Note: '',
      FirstSeenAtUtc: '2026-08-18T00:00:00Z',
      Import: imported,
      SourceSheet: 'Sheet1',
      SourceRow: 2,
      Events: [],
      ClientMatches: [],
    })
    getVehiclesMock.mockReset().mockResolvedValue({
      Items: [vehicle],
      Limit: 50,
      Offset: 0,
      Total: 1,
    })
    updateWorkflowMock.mockReset().mockResolvedValue({})
  })

  it('does not expose any reviewed business action without its permission', async () => {
    renderPage()

    await screen.findByText('Тестовий власник')
    expect(screen.queryByRole('button', { name: 'Імпортувати' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Відкрити' })).toBeNull()
    expect(getVehicleMock).not.toHaveBeenCalled()
  })

  it('opens vehicle details independently and keeps workflow read-only without update', async () => {
    renderPage([PermissionKeys.VehicleRegistry.Vehicle.OpenDetails])

    const owner = await screen.findByText('Тестовий власник')
    fireEvent.click(owner.closest('tr')!)
    await waitFor(() => expect(getVehicleMock).toHaveBeenCalledWith(vehicle.NetUid, expect.any(AbortSignal)))
    expect(await screen.findByText('Картка автомобіля')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
    expect(updateWorkflowMock).not.toHaveBeenCalled()
  })

  it('keeps import and import-issue access as two independent business permissions', async () => {
    const { unmount } = renderPage([PermissionKeys.VehicleRegistry.Import.Create])

    expect(await screen.findByRole('button', { name: 'Імпортувати' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Імпорти/ }))
    await waitFor(() => expect(
      screen.getAllByText('vehicles.xlsx').some((element) => element.closest('tr')),
    ).toBe(true))
    const firstImportRow = screen.getAllByText('vehicles.xlsx')
      .map((element) => element.closest('tr'))
      .find(Boolean)
    fireEvent.click(firstImportRow!)
    expect(getImportIssuesMock).not.toHaveBeenCalled()
    unmount()

    renderPage([PermissionKeys.VehicleRegistry.Import.ViewIssues])
    expect(screen.queryByRole('button', { name: 'Імпортувати' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /Імпорти/ }))
    await waitFor(() => expect(
      screen.getAllByText('vehicles.xlsx').some((element) => element.closest('tr')),
    ).toBe(true))
    const secondImportRow = screen.getAllByText('vehicles.xlsx')
      .map((element) => element.closest('tr'))
      .find(Boolean)
    fireEvent.click(secondImportRow!)
    await waitFor(() => expect(getImportIssuesMock).toHaveBeenCalledWith(
      imported.NetUid,
      200,
      0,
      expect.any(AbortSignal),
    ))
  })
})
