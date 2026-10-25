import type { ComponentProps, ReactNode } from 'react'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { WizardClientRegistry } from './WizardClientRegistry'
import type { SalesUkraineSale } from '../../types'

const snapshots = vi.hoisted(() => ({ data: [] as SalesUkraineSale[][], expandedRenders: 0 }))
vi.mock('../../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ data, renderExpandedRow }: { data: SalesUkraineSale[]; renderExpandedRow?: (sale: SalesUkraineSale) => ReactNode }) => {
    if (!renderExpandedRow) { snapshots.expandedRenders += 1; return null }
    snapshots.data.push(data)
    return <>{data.map(sale => <div key={sale.NetUid}>{renderExpandedRow(sale)}</div>)}</>
  },
}))

it('retains sorted rows while filters are being edited and updates them when server data or agreement changes', () => {
  const first: SalesUkraineSale = { NetUid: 'sale-1', Created: '2026-10-01', Order: { OrderItems: [{ NetUid: 'item-1', Qty: 1 }] }, ClientAgreement: { Client: { Id: 1 } } }
  const second: SalesUkraineSale = { NetUid: 'sale-2', Created: '2026-10-02', ClientAgreement: { Client: { Id: 1 } } }
  const third: SalesUkraineSale = { NetUid: 'sale-3', ClientAgreement: { Client: { Id: 2 } } }
  const props: ComponentProps<typeof WizardClientRegistry> = {
    canEdit: true, canOpenDeliveryDetails: true, canOpenDetails: true, canViewAudit: true,
    dateFrom: '2026-10-01', dateTo: '2026-10-25', isLoading: false,
    items: [first, second, third].map(Sale => ({ Sale })), saleSearch: '', selectedAgreementClientId: 1, status: 6,
    onAuditRow: vi.fn(), onChangeDateFrom: vi.fn(), onChangeDateTo: vi.fn(), onChangeSaleSearch: vi.fn(),
    onChangeStatus: vi.fn(), onDeliveryRow: vi.fn(), onEditRow: vi.fn(), onOpenOrderedProducts: vi.fn(),
    onOpenRow: vi.fn(), onPrintRow: vi.fn(), onRetry: vi.fn(),
  }
  const view = (patch: Partial<typeof props> = {}) => <MantineProvider><I18nProvider><WizardClientRegistry {...props} {...patch} /></I18nProvider></MantineProvider>
  const { rerender } = render(view())
  const rows = snapshots.data.at(-1)
  expect(rows).toEqual([second, first])
  const expandedRenders = snapshots.expandedRenders
  expect(expandedRenders).toBeGreaterThan(0)
  rerender(view({ saleSearch: 'search', isLoading: true }))
  expect(snapshots.expandedRenders).toBe(expandedRenders)
  expect(snapshots.data.at(-1)).toBe(rows)
  rerender(view({ items: [{ Sale: { ...first, Order: { OrderItems: [{ NetUid: 'item-1', Qty: 2 }] } } }, { Sale: second }] }))
  expect(snapshots.expandedRenders).toBe(expandedRenders + 1)
  rerender(view({ selectedAgreementClientId: 2 }))
  expect(snapshots.data.at(-1)).toEqual([third])
  const updated = { ...first, Created: '2026-10-03' }
  rerender(view({ items: [{ Sale: updated }, { Sale: second }] }))
  expect(snapshots.data.at(-1)).toEqual([updated, second])
  rerender(view({ error: 'saved-list' }))
  expect(screen.getByRole('alert').textContent).toContain('Зміни збережено, але реєстр не оновлено')
  fireEvent.click(screen.getByRole('button', { name: 'Повторити завантаження' }))
  expect(props.onRetry).toHaveBeenCalledOnce()
  const errorRows = snapshots.data.at(-1)
  const errorRenders = snapshots.expandedRenders
  rerender(view({ error: 'saved-list', isLoading: true }))
  expect((screen.getByRole('button', { name: 'Повторити завантаження' }) as HTMLButtonElement).disabled).toBe(true)
  expect(snapshots.data.at(-1)).toBe(errorRows)
  expect(snapshots.expandedRenders).toBe(errorRenders)
  rerender(view({ error: 'saved-details' }))
  expect(screen.getByRole('alert').textContent).toContain('підсумки замовлення не оновлено')
  rerender(view({ error: 'load' }))
  expect(screen.getByRole('alert').textContent).toContain('Не вдалося завантажити реєстр')
  expect(screen.getByRole('alert').textContent).not.toContain('Зміни збережено')
  rerender(view({ error: null }))
  expect(screen.queryByRole('alert')).toBeNull()

})
