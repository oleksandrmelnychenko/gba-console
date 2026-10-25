import { MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { WizardClientRegistry } from './WizardClientRegistry'
import type { SalesUkraineSale } from '../../types'

const snapshots = vi.hoisted(() => ({ data: [] as SalesUkraineSale[][] }))
vi.mock('../../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ data }: { data: SalesUkraineSale[] }) => { snapshots.data.push(data); return null },
}))

it('retains sorted rows while filters are being edited and updates them when server data or agreement changes', () => {
  const first = { NetUid: 'sale-1', Created: '2026-10-01', ClientAgreement: { Client: { Id: 1 } } }
  const second = { NetUid: 'sale-2', Created: '2026-10-02', ClientAgreement: { Client: { Id: 1 } } }
  const third = { NetUid: 'sale-3', ClientAgreement: { Client: { Id: 2 } } }
  const props = {
    canEdit: true, canOpenDeliveryDetails: true, canOpenDetails: true, canViewAudit: true,
    dateFrom: '2026-10-01', dateTo: '2026-10-25', isLoading: false,
    items: [first, second, third].map(Sale => ({ Sale })), saleSearch: '', selectedAgreementClientId: 1, status: 6,
    onAuditRow: vi.fn(), onChangeDateFrom: vi.fn(), onChangeDateTo: vi.fn(), onChangeSaleSearch: vi.fn(),
    onChangeStatus: vi.fn(), onDeliveryRow: vi.fn(), onEditRow: vi.fn(), onOpenOrderedProducts: vi.fn(),
    onOpenRow: vi.fn(), onPrintRow: vi.fn(),
  }
  const view = (patch: Partial<typeof props> = {}) => <MantineProvider><I18nProvider><WizardClientRegistry {...props} {...patch} /></I18nProvider></MantineProvider>
  const { rerender } = render(view())
  const rows = snapshots.data.at(-1)
  expect(rows).toEqual([second, first])
  rerender(view({ saleSearch: 'search', isLoading: true }))
  expect(snapshots.data.at(-1)).toBe(rows)
  rerender(view({ selectedAgreementClientId: 2 }))
  expect(snapshots.data.at(-1)).toEqual([third])
  const updated = { ...first, Created: '2026-10-03' }
  rerender(view({ items: [{ Sale: updated }, { Sale: second }] }))
  expect(snapshots.data.at(-1)).toEqual([updated, second])
})
