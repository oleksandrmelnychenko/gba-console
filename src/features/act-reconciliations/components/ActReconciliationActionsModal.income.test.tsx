import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { ActReconciliationItem } from '../types'
import { ActReconciliationActionsModal } from './ActReconciliationActionsModal'

const apiMocks = vi.hoisted(() => ({
  createDepreciatedOrderFromItem: vi.fn(),
  createDepreciatedOrderFromItems: vi.fn(),
  createProductIncomeFromItem: vi.fn(),
  createProductIncomeFromItems: vi.fn(),
  createProductTransferFromItem: vi.fn(),
  createProductTransferFromItems: vi.fn(),
  getReconciliationStorages: vi.fn(),
}))

vi.mock('../api/actReconciliationsApi', () => apiMocks)
vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => (opened ? <section>{children}</section> : null),
  AppModalFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const SHORTAGE_ROW: ActReconciliationItem = {
  HasDifference: true,
  IncomeReceivableQty: 0,
  NegativeDifference: true,
  NetUid: 'item-1',
  Product: { VendorCode: 'QA-FLT-001' },
  QtyDifference: 6,
}

function renderModal(item: ActReconciliationItem, permissions = { income: true, transfer: true, writeOff: true }) {
  render(
    <MantineProvider env="test">
      <I18nProvider>
        <ActReconciliationActionsModal
          canCreateProductIncome={permissions.income}
          canCreateProductTransfer={permissions.transfer}
          canCreateWriteOff={permissions.writeOff}
          opened
          organizationNetId="org-1"
          target={{ item, mode: 'single' }}
          onApplied={() => undefined}
          onClose={() => undefined}
        />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('ActReconciliationActionsModal income tab (chaos2-orders F10 / w1-16)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getReconciliationStorages.mockResolvedValue([])
  })

  it('disables «Оприходування» on a row the server will refuse and opens on another action', async () => {
    renderModal(SHORTAGE_ROW)

    const incomeTab = await screen.findByRole('tab', { name: 'Оприходування' })
    expect(incomeTab.hasAttribute('disabled') || incomeTab.getAttribute('data-disabled') === 'true').toBe(true)
    expect(incomeTab.getAttribute('aria-description')).toContain('немає неоприходованого залишку')
    expect(screen.getByRole('tab', { name: 'Переміщення' }).getAttribute('aria-selected')).toBe('true')
    await waitFor(() => expect(apiMocks.getReconciliationStorages).toHaveBeenCalled())
  })

  it('explains the refusal when income is the only action the role has', async () => {
    renderModal(SHORTAGE_ROW, { income: true, transfer: false, writeOff: false })

    expect(await screen.findByText(/немає неоприходованого залишку/)).toBeTruthy()
  })

  it('keeps «Оприходування» for rows the packing lists can still serve', async () => {
    renderModal({ ...SHORTAGE_ROW, IncomeReceivableQty: 3 })

    const incomeTab = await screen.findByRole('tab', { name: 'Оприходування' })
    expect(incomeTab.hasAttribute('disabled')).toBe(false)
    expect(incomeTab.getAttribute('aria-selected')).toBe('true')
  })
})
