import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getApprovedInvoices } from '../api/protocolDetailApi'
import type { ProtocolDetail } from '../detailTypes'
import { InvoicesSection } from './InvoicesSection'

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => permission === PermissionKeys.ProductDeliveryProtocols.InvoiceManagement.Open
      || permission === PermissionKeys.ProductDeliveryProtocols.Invoice.Assign,
  }),
}))

vi.mock('../api/protocolDetailApi', () => ({
  getApprovedInvoices: vi.fn(),
  getSupplyInvoiceWithSpendings: vi.fn(),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModalFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <div>{children}</div> : null,
}))

const PROTOCOL = {
  NetUid: 'protocol-1',
  Organization: { NetUid: 'organization-1' },
  SupplyInvoices: [],
  TransportationType: 0,
} as unknown as ProtocolDetail

function renderSection(onAssignInvoices: (invoices: unknown[]) => Promise<void>) {
  render(
    <MantineProvider>
      <I18nProvider>
        <InvoicesSection
          permissions={{ canEditAssignments: true, canEditDeliveryDocuments: false }}
          protocol={PROTOCOL}
          status={{ isAssigning: false, isSavingInvoiceDocuments: false }}
          onAssignInvoices={onAssignInvoices}
          onSaveInvoiceDocuments={vi.fn(async () => undefined)}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('InvoicesSection invoice assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not post an unchanged (empty) selection', async () => {
    vi.mocked(getApprovedInvoices).mockResolvedValue([])
    const onAssignInvoices = vi.fn(async () => undefined)
    renderSection(onAssignInvoices)

    fireEvent.click(screen.getByRole('button', { name: 'Управління інвойсами' }))
    await waitFor(() => expect(getApprovedInvoices).toHaveBeenCalled())
    const save = await screen.findByRole('button', { name: 'Зберегти' })

    expect((save as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(save)
    fireEvent.click(save)
    expect(onAssignInvoices).not.toHaveBeenCalled()
  })

  it('a double click on Save posts the changed selection once', async () => {
    vi.mocked(getApprovedInvoices).mockResolvedValue([{ NetUid: 'invoice-9', Number: 'INV-9' }] as never)
    let finish: () => void = () => undefined
    const onAssignInvoices = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    renderSection(onAssignInvoices)

    fireEvent.click(screen.getByRole('button', { name: 'Управління інвойсами' }))
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Інвойс INV-9' }))
    const save = screen.getByRole('button', { name: 'Зберегти' })
    fireEvent.click(save)
    fireEvent.click(save)

    await act(async () => { finish() })
    expect(onAssignInvoices).toHaveBeenCalledTimes(1)
  })
})
