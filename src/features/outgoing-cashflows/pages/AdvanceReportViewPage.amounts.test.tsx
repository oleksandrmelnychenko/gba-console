import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { AdvanceReportOrder, CompanyCarFueling } from '../advanceReportTypes'
import {
  calculateAdvanceReportOrder,
  getAdvanceReportOrder,
  updateAdvanceReportOrder,
} from '../api/advanceReportApi'
import { AdvanceReportViewPage } from './AdvanceReportViewPage'

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

vi.mock('../../auth/components/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}))

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ children, footer, title }: { children: ReactNode; footer?: ReactNode; title: ReactNode }) => (
    <div>
      <div>{title}</div>
      {children}
      {footer}
    </div>
  ),
}))

vi.mock('../../../shared/ui/AppModal', () => ({
  AppModal: ({ children, opened }: { children: ReactNode; opened: boolean }) => opened ? <div>{children}</div> : null,
  AppModalFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../components/AdvanceReportConsumableOrderModal', () => ({
  AdvanceReportConsumableOrderModal: () => null,
}))

vi.mock('../components/AdvanceReportFuelGrid', () => ({
  AdvanceReportFuelGrid: ({ rows }: { rows: unknown[] }) => <div data-testid="fuel-rows">{rows.length}</div>,
}))

// The fuel dialog reduced to its result: a line of 30 l × 55,50 = 1 665,00.
vi.mock('../components/AdvanceReportFuelModal', () => ({
  AdvanceReportFuelModal: ({ onAdd }: { onAdd: (fueling: CompanyCarFueling) => void }) => (
    <button
      type="button"
      onClick={() => onAdd({ FuelAmount: 30, Id: 0, PricePerLiter: 55.5, TotalPrice: 1387.5, TotalPriceWithVat: 1665, VatAmount: 277.5 })}
    >
      test-add-fuel
    </button>
  ),
}))

vi.mock('../api/advanceReportApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../api/advanceReportApi')>(),
  calculateAdvanceReportOrder: vi.fn(),
  getAdvanceReportOrder: vi.fn(),
  updateAdvanceReportOrder: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/accounting/outgoing-cashflow/order-1/advanced-report/view']}>
      <MantineProvider>
        <I18nProvider>
          <Routes>
            <Route path="/accounting/outgoing-cashflow/:id/advanced-report/view" element={<AdvanceReportViewPage />} />
            <Route path="/accounting/outgoing-cashflow" element={<div>outgoing-list</div>} />
          </Routes>
        </I18nProvider>
      </MantineProvider>
    </MemoryRouter>,
  )
}

function metric(label: string): string {
  const element = screen.getAllByText(label).find((item) => item.closest('.advance-report-detail-metric'))

  return (element?.closest('.advance-report-detail-metric')?.querySelector('strong')?.textContent || '')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace('\u2212', '-')
}

describe('advance report amounts in the view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 3 000,00 issued under report, nothing reported yet.
    vi.mocked(getAdvanceReportOrder).mockResolvedValue({
      AdvanceNumber: 'AR-1',
      Amount: 3000,
      CompanyCarFuelings: [],
      DifferenceAmount: -3000,
      IsUnderReport: true,
      NetUid: 'order-1',
      OutcomePaymentOrderConsumablesOrders: [],
    })
    // The server calculation answers with Amount = sum of the report lines.
    vi.mocked(calculateAdvanceReportOrder).mockImplementation(async (order: AdvanceReportOrder) => ({
      ...order,
      Amount: (order.CompanyCarFuelings || []).reduce((sum, fueling) => sum + (fueling.TotalPriceWithVat || 0), 0),
    }))
    vi.mocked(updateAdvanceReportOrder).mockResolvedValue({ NetUid: 'order-1' })
  })

  it('keeps the issued amount, shows the report sum apart and recalculates the difference', async () => {
    renderPage()

    const addFuel = await screen.findByRole('button', { name: 'test-add-fuel' })
    expect(metric('Сума ордера')).toBe('3 000,00')
    expect(metric('Різниця')).toBe('-3 000,00')

    await act(async () => { fireEvent.click(addFuel) })
    await waitFor(() => expect(calculateAdvanceReportOrder).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(metric('Сума звіту')).toBe('1 665,00'))

    expect(metric('Сума ордера')).toBe('3 000,00')
    expect(metric('Різниця')).toBe('-1 335,00')

    await act(async () => { fireEvent.click(addFuel) })
    await waitFor(() => expect(metric('Сума звіту')).toBe('3 330,00'))

    expect(metric('Сума ордера')).toBe('3 000,00')
    expect(metric('Різниця')).toBe('330,00')
  })

  it('offers the automatic return of the unspent rest and saves the issued amount', async () => {
    renderPage()

    const addFuel = await screen.findByRole('button', { name: 'test-add-fuel' })
    await act(async () => { fireEvent.click(addFuel) })
    await waitFor(() => expect(metric('Сума звіту')).toBe('1 665,00'))

    // 1 335,00 is left with the colleague: it comes back by an income order.
    const automatic = screen.getByRole('checkbox', { name: 'Створити автоматично' })
    expect(screen.getByText('Прибутковий картковий ордер')).toBeTruthy()

    await act(async () => { fireEvent.click(automatic) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Зберегти' })) })

    await waitFor(() => expect(updateAdvanceReportOrder).toHaveBeenCalledTimes(1))
    const [auto, payload] = vi.mocked(updateAdvanceReportOrder).mock.calls[0]
    expect(auto).toBe(true)
    expect(payload.Amount).toBe(3000)
    expect(payload.CompanyCarFuelings).toHaveLength(1)
  })
})
