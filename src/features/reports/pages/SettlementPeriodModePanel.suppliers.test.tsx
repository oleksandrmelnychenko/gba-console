import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { ReportDataset } from '../types'
import { groupedSettlementSupplierDataset } from '../data/groupedSettlementSupplier.test-fixtures'
import { groupedSettlementDataset } from '../data/groupedSettlementPeriod.test-fixtures'
import { defaultDatasetRequest, datasetGroupings } from '../data/reportDatasets'
import { SettlementPeriodModePanel } from './SettlementPeriodModePanel'

function show(dataset: ReportDataset) {
  const request = defaultDatasetRequest(dataset, '2026-09-01', '2026-09-30')
  const onBuyerChange = vi.fn(), onModeChange = vi.fn()
  const props = { dataset, grouped: request.groupedSettlementPeriod, exact: undefined, buyer: request.sourceBuyerSubtree,
    groups: undefined, available: datasetGroupings(dataset), rows: request.sorted.Row, from: request.from, to: request.to,
    disabled: false, enabled: true, onModeChange, onGroupedChange: vi.fn(), onExactChange: vi.fn(),
    onBuyerChange, onRowsChange: vi.fn(), onGroupsChange: vi.fn() }
  const view = render(<MantineProvider env="test"><I18nProvider><SettlementPeriodModePanel {...props} /></I18nProvider></MantineProvider>)
  return { ...view, onBuyerChange, onModeChange }
}
it('shows the additive counterparty scope while keeping Buyers checked until an explicit user change', () => {
  const view = show(groupedSettlementSupplierDataset)
  expect((screen.getByRole('combobox', { name: 'Обсяг взаєморозрахунків' }) as HTMLInputElement).value).toBe('Поточні договори контрагентів')
  const buyer = screen.getByRole('checkbox', { name: 'Контрагенти у групі «Покупці» (Fenix)' })
  expect(buyer).toBeChecked(); expect(view.onBuyerChange).not.toHaveBeenCalled()
  fireEvent.click(buyer)
  expect(view.onBuyerChange).toHaveBeenCalledExactlyOnceWith(undefined)
  expect(view.onModeChange).not.toHaveBeenCalled()
})
it('preserves the accepted buyer-only label and default scope for the previous server capability', () => {
  const view = show(groupedSettlementDataset)
  expect((screen.getByRole('combobox', { name: 'Обсяг взаєморозрахунків' }) as HTMLInputElement).value).toBe('Поточні договори покупців')
  expect(screen.getByRole('checkbox', { name: 'Контрагенти у групі «Покупці» (Fenix)' })).toBeChecked()
  expect(view.onBuyerChange).not.toHaveBeenCalled(); expect(view.onModeChange).not.toHaveBeenCalled()
})
