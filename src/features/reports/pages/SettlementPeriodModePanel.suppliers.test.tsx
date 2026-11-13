import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { ReportDataset } from '../types'
import { groupedSettlementSupplierDataset } from '../data/groupedSettlementSupplier.test-fixtures'
import { settlementModeDataset } from '../data/settlementReadMode.test-fixtures'
import { groupCapability } from '../data/sourceCounterpartyGroups.test-fixtures'
import { defaultDatasetRequest, datasetGroupings } from '../data/reportDatasets'
import { SettlementPeriodModePanel } from './SettlementPeriodModePanel'

vi.mock('./CounterpartyGroupFilters', () => ({
  CounterpartyGroupFilters: () => <div data-testid="counterparty-groups" />,
}))

function show(dataset: ReportDataset, extra: { readMode?: 0 | 1; grouped?: unknown } = {}) {
  const request = defaultDatasetRequest(dataset, '2026-09-01', '2026-09-30')
  const onModeChange = vi.fn()
  const props = { dataset, grouped: request.groupedSettlementPeriod, groups: undefined, available: datasetGroupings(dataset),
    rows: request.sorted.Row, disabled: false, enabled: true, onModeChange, onRowsChange: vi.fn(), onGroupsChange: vi.fn(),
    onReadModeChange: vi.fn(), ...extra }
  const view = render(<MantineProvider env="test"><I18nProvider><SettlementPeriodModePanel {...props} /></I18nProvider></MantineProvider>)
  return { ...view, onModeChange }
}

it('offers neither the single-agreement scope nor a Fenix/AMG base or buyer-group choice', () => {
  show(groupedSettlementSupplierDataset, { readMode: 0 })
  expect(screen.queryByRole('combobox', { name: 'Обсяг взаєморозрахунків' })).toBeNull()
  expect(screen.queryByText('Один точний договір')).toBeNull()
  expect(screen.queryByRole('combobox', { name: 'База взаєморозрахунків' })).toBeNull()
  expect(screen.queryByRole('checkbox', { name: 'Контрагенти у групі «Покупці» (Fenix)' })).toBeNull()
  expect((screen.getByRole('combobox', { name: 'Форма взаєморозрахунків' }) as HTMLInputElement).disabled).toBe(false)
})

it('shows the counterparty-group filter regardless of the source world', () => {
  const dataset = { ...settlementModeDataset, sourceCounterpartyGroups: groupCapability }
  show(dataset, { readMode: 0, grouped: { Version: 1, SourceWorld: 'Amg', CurrencyBasis: 'SettlementCurrency' } })
  expect(screen.getByTestId('counterparty-groups')).toBeTruthy()
})

it('moves a restored single-agreement form to the current counterparty agreements', () => {
  const view = show(settlementModeDataset, { grouped: undefined })
  expect(screen.queryByRole('combobox', { name: 'Форма взаєморозрахунків' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Перейти до поточних договорів контрагентів' }))
  expect(view.onModeChange).toHaveBeenCalledOnce()
})

it('keeps the form choice under the BUG-1274 surface', () => {
  show(settlementModeDataset, { readMode: 0 })
  expect(screen.queryByRole('combobox', { name: 'Джерело розрахунку' })).toBeNull()
  expect((screen.getByRole('combobox', { name: 'Форма взаєморозрахунків' }) as HTMLInputElement).disabled).toBe(false)
})
