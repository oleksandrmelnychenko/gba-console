import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getApprovedInvoices, getSupplyInvoiceWithSpendings } from '../api/protocolDetailApi'
import type { ProtocolDetail } from '../detailTypes'
import { InvoicesSection } from './InvoicesSection'

const allowedPermissions = new Set<string>()

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission),
  }),
}))

vi.mock('../api/protocolDetailApi', () => ({
  getApprovedInvoices: vi.fn(),
  getSupplyInvoiceWithSpendings: vi.fn(),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({
    children,
    footer,
    opened,
  }: {
    children: ReactNode
    footer?: ReactNode
    opened: boolean
  }) => opened ? <section>{children}{footer}</section> : null,
}))

const PROTOCOL = {
  NetUid: 'protocol-1',
  Organization: { NetUid: 'organization-1' },
  SupplyInvoices: [{ NetUid: 'invoice-1', Number: 'INV-1', SupplyInvoiceDeliveryDocuments: [] }],
  TransportationType: 0,
} as ProtocolDetail

function renderSection(canEditDeliveryDocuments: boolean) {
  return render(
    <MantineProvider>
      <I18nProvider>
        <InvoicesSection
          permissions={{ canEditAssignments: true, canEditDeliveryDocuments }}
          protocol={PROTOCOL}
          status={{ isAssigning: false, isSavingInvoiceDocuments: false }}
          onAssignInvoices={vi.fn(async () => undefined)}
          onSaveInvoiceDocuments={vi.fn(async () => undefined)}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('InvoicesSection permissions', () => {
  beforeEach(() => {
    allowedPermissions.clear()
    vi.clearAllMocks()
    vi.mocked(getApprovedInvoices).mockResolvedValue([])
    vi.mocked(getSupplyInvoiceWithSpendings).mockResolvedValue(null)
  })

  it('keeps invoice management, expense details, and delivery-document editing independent', async () => {
    const withoutRights = renderSection(false)

    expect(screen.queryByRole('button', { name: 'Управління інвойсами' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Детальні витрати' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
    withoutRights.unmount()

    allowedPermissions.add(PermissionKeys.ProductDeliveryProtocols.InvoiceManagement.Open)
    const managementOnly = renderSection(false)

    expect(screen.getByRole('button', { name: 'Управління інвойсами' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Детальні витрати' }))
    await waitFor(() => expect(getSupplyInvoiceWithSpendings).toHaveBeenCalledWith('invoice-1'))
    expect(screen.queryByRole('button', { name: 'Зберегти' })).toBeNull()
    managementOnly.unmount()

    allowedPermissions.clear()
    renderSection(true)

    expect(screen.getByRole('button', { name: 'Зберегти' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Управління інвойсами' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Детальні витрати' })).toBeNull()
  })
})
