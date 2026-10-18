import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { ReportDataset } from '../types'
import { groupedSettlementSupplierDataset } from '../data/groupedSettlementSupplier.test-fixtures'
import { groupedSettlementDataset } from '../data/groupedSettlementPeriod.test-fixtures'
import { settlementModeDataset } from '../data/settlementReadMode.test-fixtures'
import { defaultDatasetRequest, datasetGroupings } from '../data/reportDatasets'
import { SettlementPeriodModePanel } from './SettlementPeriodModePanel'

function show(dataset: ReportDataset, extra: { readMode?: 0 | 1; hideRegisterReadMode?: boolean } = {}) {
  const request = defaultDatasetRequest(dataset, '2026-09-01', '2026-09-30')
  const onBuyerChange = vi.fn(), onModeChange = vi.fn()
  const props = { dataset, grouped: request.groupedSettlementPeriod, exact: undefined, buyer: request.sourceBuyerSubtree,
    groups: undefined, available: datasetGroupings(dataset), rows: request.sorted.Row, from: request.from, to: request.to,
    disabled: false, enabled: true, onModeChange, onGroupedChange: vi.fn(), onExactChange: vi.fn(),
    onBuyerChange, onRowsChange: vi.fn(), onGroupsChange: vi.fn(), onReadModeChange: vi.fn(), ...extra }
  const view = render(<MantineProvider env="test"><I18nProvider><SettlementPeriodModePanel {...props} /></I18nProvider></MantineProvider>)
  return { ...view, onBuyerChange, onModeChange }
}
it('shows the additive counterparty scope while keeping Buyers checked until an explicit user change', () => {
  const view = show(groupedSettlementSupplierDataset)
  expect((screen.getByRole('combobox', { name: 'Обсяг взаєморозрахунків' }) as HTMLInputElement).value).toBe('Поточні договори контрагентів')
  const buyer = screen.getByRole('checkbox', { name: 'Контрагенти у групі «Покупці» (Fenix)' })
  expect((buyer as HTMLInputElement).checked).toBe(true); expect(view.onBuyerChange).not.toHaveBeenCalled()
  fireEvent.click(buyer)
  expect(view.onBuyerChange).toHaveBeenCalledExactlyOnceWith(undefined)
  expect(view.onModeChange).not.toHaveBeenCalled()
})
it('preserves the accepted buyer-only label and default scope for the previous server capability', () => {
  const view = show(groupedSettlementDataset)
  expect((screen.getByRole('combobox', { name: 'Обсяг взаєморозрахунків' }) as HTMLInputElement).value).toBe('Поточні договори покупців')
  expect((screen.getByRole('checkbox', { name: 'Контрагенти у групі «Покупці» (Fenix)' }) as HTMLInputElement).checked).toBe(true)
  expect(view.onBuyerChange).not.toHaveBeenCalled(); expect(view.onModeChange).not.toHaveBeenCalled()
})
it('hides the locked Fenix base and buyer group under the BUG-1274 surface but keeps the form choice', () => {
  show(settlementModeDataset, { readMode: 0, hideRegisterReadMode: true })
  expect(screen.queryByRole('combobox', { name: 'База взаєморозрахунків' })).toBeNull()
  expect(screen.queryByRole('checkbox', { name: 'Контрагенти у групі «Покупці» (Fenix)' })).toBeNull()
  expect((screen.getByRole('combobox', { name: 'Форма взаєморозрахунків' }) as HTMLInputElement).disabled).toBe(false)
})
it('keeps the locked base and buyer group visible but disabled outside the BUG-1274 surface', () => {
  show(settlementModeDataset, { readMode: 0 })
  const world = screen.getByRole('combobox', { name: 'База взаєморозрахунків' }) as HTMLInputElement
  expect(world.value).toBe('Fenix'); expect(world.disabled).toBe(true)
  expect((screen.getByRole('checkbox', { name: 'Контрагенти у групі «Покупці» (Fenix)' }) as HTMLInputElement).disabled).toBe(true)
})
it('keeps the base and buyer group choosable under the BUG-1274 surface without an explicit source', () => {
  show(settlementModeDataset, { hideRegisterReadMode: true })
  expect((screen.getByRole('combobox', { name: 'База взаєморозрахунків' }) as HTMLInputElement).disabled).toBe(false)
  expect((screen.getByRole('checkbox', { name: 'Контрагенти у групі «Покупці» (Fenix)' }) as HTMLInputElement).disabled).toBe(false)
})
