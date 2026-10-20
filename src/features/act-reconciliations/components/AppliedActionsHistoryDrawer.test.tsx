import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { AppliedActionsHistoryDrawer } from './AppliedActionsHistoryDrawer'
import type { ActReconciliationAppliedAction } from '../types'

vi.mock('../../../shared/ui/AppDrawer', () => ({
  AppDrawer: ({ opened, children }: { opened: boolean; children: ReactNode }) => opened ? <div>{children}</div> : null,
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: <T,>({ columns, data, onRowClick }: {
    columns: DataTableColumn<T>[]
    data: T[]
    onRowClick?: (row: T) => void
  }) => <div>{data.map((row, index) => <div key={index}>
    {columns.map((column) => <div key={column.id}>{column.cell?.(row)}</div>)}
    {onRowClick && <button onClick={() => onRowClick(row)}>Вибрати дію</button>}
  </div>)}</div>,
}))

it('renders populated history cells, quantity differences and disposition explanations', () => {
  const action: ActReconciliationAppliedAction = {
    ActReconciliationItem: { Product: { VendorCode: 'SKU-42', Name: 'Фільтр' }, HasDifference: true, NegativeDifference: true, QtyDifference: 2 },
  }
  const onSelectAction = vi.fn()
  render(<MantineProvider env="test"><I18nProvider>
    <AppliedActionsHistoryDrawer
      opened
      appliedActions={[action]}
      dispositionEvents={[{ ProductName: 'Кріплення', ProductVendorCode: 'SKU-43', Comment: 'Уточнено після перевірки', IsDismissed: false }]}
      error={null}
      isLoading={false}
      selectedAction={null}
      title="Історія змін"
      onClose={vi.fn()}
      onSelectAction={onSelectAction}
    />
  </I18nProvider></MantineProvider>)

  expect(screen.getByText('- 2')).toBeTruthy()
  expect(screen.getByText('Кріплення')).toBeTruthy()
  expect(screen.getByText('Уточнено після перевірки')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Вибрати дію' }))
  expect(onSelectAction).toHaveBeenCalledWith(action)
})
