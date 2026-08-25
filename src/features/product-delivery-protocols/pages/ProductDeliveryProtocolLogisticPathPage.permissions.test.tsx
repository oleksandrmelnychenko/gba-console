import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import {
  addDocumentsToSupplyInvoice,
  assignInvoicesToMergedService,
  assignInvoicesToProtocol,
  calculateMergedServiceExtraCharge,
  removeMergedService,
  saveMergedService,
  updateProtocolStatus,
} from '../api/protocolDetailApi'
import { getProtocolForLogisticPath } from '../api/productDeliveryProtocolsApi'
import { ProductDeliveryProtocolLogisticPathPage } from './ProductDeliveryProtocolLogisticPathPage'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
    user: null,
  }),
}))

vi.mock('../api/productDeliveryProtocolsApi', () => ({
  getProtocolForLogisticPath: vi.fn(),
}))

vi.mock('../api/protocolDetailApi', () => ({
  addDocumentsToSupplyInvoice: vi.fn(),
  assignInvoicesToMergedService: vi.fn(),
  assignInvoicesToProtocol: vi.fn(),
  calculateMergedServiceExtraCharge: vi.fn(),
  removeMergedService: vi.fn(),
  saveMergedService: vi.fn(),
  updateProtocolStatus: vi.fn(),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, opened }: { children: ReactNode; opened: boolean }) =>
    opened ? <section>{children}</section> : null,
}))

vi.mock('../components/ProtocolDetailsCard', () => ({
  ProtocolDetailsCard: () => null,
}))

vi.mock('../components/StatusSection', () => ({
  StatusSection: ({ onChangeStatus }: { onChangeStatus: () => void }) => (
    <button onClick={onChangeStatus}>status-final</button>
  ),
}))

vi.mock('../components/InvoicesSection', () => ({
  InvoicesSection: ({
    onAssignInvoices,
    onSaveInvoiceDocuments,
  }: {
    onAssignInvoices: (invoices: unknown[]) => Promise<void>
    onSaveInvoiceDocuments: (invoice: unknown, documents: File[]) => Promise<void>
  }) => (
    <section>
      <button onClick={() => void onAssignInvoices([])}>invoice-assign-final</button>
      <button onClick={() => void onSaveInvoiceDocuments({ NetUid: 'invoice-1' }, [])}>
        invoice-documents-final
      </button>
    </section>
  ),
}))

vi.mock('../components/MergedServicesSection', () => ({
  MergedServicesSection: ({
    onAssignServiceInvoices,
    onCalculate,
    onRemoveService,
    onSaveService,
  }: {
    onAssignServiceInvoices: (service: unknown, invoices: unknown[]) => Promise<void>
    onCalculate: (payload: {
      extraChargeType: number
      invoices: unknown[]
      isAuto: boolean
      serviceNetId: string
    }) => Promise<void>
    onRemoveService: (service: { NetUid: string }) => Promise<void>
    onSaveService: (payload: { files: Record<string, File[]>; service: { NetUid?: string } }) => Promise<void>
  }) => (
    <section>
      <button onClick={() => void onSaveService({ files: {}, service: {} })}>service-create-final</button>
      <button onClick={() => void onSaveService({ files: {}, service: { NetUid: 'service-1' } })}>
        service-edit-final
      </button>
      <button
        onClick={() => void onCalculate({ extraChargeType: 0, invoices: [], isAuto: true, serviceNetId: 'service-1' })}
      >
        service-calculate-final
      </button>
      <button onClick={() => void onAssignServiceInvoices({ NetUid: 'service-1' }, [])}>
        service-assign-final
      </button>
      <button onClick={() => void onRemoveService({ NetUid: 'service-1' })}>service-delete-final</button>
    </section>
  ),
}))

const PROTOCOL = {
  IsCompleted: false,
  MergedServices: [{ NetUid: 'service-1' }],
  NetUid: 'protocol-1',
  SupplyInvoices: [{ NetUid: 'invoice-1' }],
}

function renderPage() {
  return render(
    <MantineProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={['/product-delivery-protocols/protocol-1']}>
          <Routes>
            <Route
              path="/product-delivery-protocols/:id"
              element={<ProductDeliveryProtocolLogisticPathPage />}
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('Product delivery protocol logistic-path permission guards', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getProtocolForLogisticPath).mockResolvedValue(PROTOCOL)
    vi.mocked(addDocumentsToSupplyInvoice).mockResolvedValue(null)
    vi.mocked(assignInvoicesToMergedService).mockResolvedValue(null)
    vi.mocked(assignInvoicesToProtocol).mockResolvedValue(null)
    vi.mocked(calculateMergedServiceExtraCharge).mockResolvedValue(null)
    vi.mocked(removeMergedService).mockResolvedValue(null)
    vi.mocked(saveMergedService).mockResolvedValue(null)
    vi.mocked(updateProtocolStatus).mockResolvedValue(null)
  })

  it('does not mount the model or request protocol data without logistic-path access', () => {
    renderPage()

    expect(screen.getByText('Доступ заборонено')).toBeTruthy()
    expect(getProtocolForLogisticPath).not.toHaveBeenCalled()
  })

  it('rechecks every mutation permission at the final page handler boundary', async () => {
    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.LogisticWay.Open)
    renderPage()

    await waitFor(() => expect(getProtocolForLogisticPath).toHaveBeenCalledWith('protocol-1'))

    const cases = [
      {
        button: 'status-final',
        permission: PermissionKeys.ProductDeliveryProtocols.UnifiedService.ChangeStatus,
        request: updateProtocolStatus,
      },
      {
        button: 'invoice-assign-final',
        permission: PermissionKeys.ProductDeliveryProtocols.InvoiceManagement.Open,
        request: assignInvoicesToProtocol,
      },
      {
        button: 'invoice-documents-final',
        permission: PermissionKeys.ProductDeliveryProtocols.DeliveryDocuments.Download,
        request: addDocumentsToSupplyInvoice,
      },
      {
        button: 'service-create-final',
        permission: PermissionKeys.ProductDeliveryProtocols.UnifiedService.Create,
        request: saveMergedService,
      },
      {
        button: 'service-edit-final',
        permission: PermissionKeys.ProductDeliveryProtocols.UnifiedService.Edit,
        request: saveMergedService,
      },
      {
        button: 'service-calculate-final',
        permission: PermissionKeys.ProductDeliveryProtocols.UnifiedService.Calculate,
        request: calculateMergedServiceExtraCharge,
      },
      {
        button: 'service-assign-final',
        permission: PermissionKeys.ProductDeliveryProtocols.UnifiedService.AddInvoice,
        request: assignInvoicesToMergedService,
      },
      {
        button: 'service-delete-final',
        permission: PermissionKeys.ProductDeliveryProtocols.UnifiedService.Delete,
        request: removeMergedService,
      },
    ] as const

    for (const testCase of cases) {
      const request = vi.mocked(testCase.request)
      const callsBefore = request.mock.calls.length

      fireEvent.click(screen.getByRole('button', { name: testCase.button }))
      expect(request).toHaveBeenCalledTimes(callsBefore)

      allowedPermissions.add(testCase.permission)
      fireEvent.click(screen.getByRole('button', { name: testCase.button }))
      await waitFor(() => expect(request).toHaveBeenCalledTimes(callsBefore + 1))
      allowedPermissions.delete(testCase.permission)
    }
  })

  it('requires the completed-protocol override in addition to the exact mutation key', async () => {
    vi.mocked(getProtocolForLogisticPath).mockResolvedValue({ ...PROTOCOL, IsCompleted: true })
    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.LogisticWay.Open)
    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.UnifiedService.ChangeStatus)
    const firstView = renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'status-final' }))
    expect(updateProtocolStatus).not.toHaveBeenCalled()

    firstView.unmount()
    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.Protocol.EditCompleted)
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'status-final' }))
    await waitFor(() => expect(updateProtocolStatus).toHaveBeenCalledWith('protocol-1'))
  })
})
