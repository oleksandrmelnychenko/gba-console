import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import type { ReportDataset, ReportRequestBody, ReportSelection } from '../types'
import { InlineReportSelection, ReportSelectionsCard } from './ReportsStocksPage'

vi.mock('../../../shared/api/apiClient', () => ({ apiRequest: vi.fn().mockResolvedValue([]) }))

it.each([2, 3, 45, 46].flatMap(source => (['modal', 'card', 'row'] as const).map(mode => ({ source, mode }))))(
  'keeps saved group conditions unavailable on a flat field, source$source mode$mode', ({ source, mode }) => {
    const selection: ReportSelection = { IsChecked: true, SelectedField: { Type: 0, Name: 'Організація' },
      FilterCondition: { Type: 3, Name: 'У групі зі списку' }, Values: [{ Name: 'Збережене значення', Value: 1, Data: { Id: 1 } }] }
    const dataset: ReportDataset = { DataSource: source, Name: 'Звіт', Description: '', PeriodRequired: true, PeriodSupported: true,
      Groupings: [], Measurements: [], Filters: [selection.SelectedField], Limitations: [] }
    const request: ReportRequestBody = { dataSource: source, from: '2026-10-01', to: '2026-10-31',
      selections: [selection], sorted: { Row: [], Col: [], Measurements: [] } }
    const onChange = vi.fn(), before = structuredClone(request)
    const props = { dataset, request, dataSource: source, from: request.from, to: request.to,
      selections: request.selections, filterFieldOptions: [{ value: '0', label: 'Організація', field: selection.SelectedField }], onChange }
    render(<MantineProvider env="test"><I18nProvider>{mode === 'row'
      ? <InlineReportSelection {...props} selection={selection} index={0} variant="row" />
      : <ReportSelectionsCard {...props} inline={mode === 'card'} selectionKeys={['saved']} />}</I18nProvider></MantineProvider>)
    if (mode === 'modal') fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))
    expect(screen.getAllByText(/Сервер не підтвердив групи для цього поля/).length).toBeGreaterThan(0)
    if (mode === 'row') expect(screen.getByRole('alert').textContent).toContain('Сервер не підтвердив групи для цього поля')
    fireEvent.click(screen.getByRole('combobox', { name: mode === 'row' ? 'Тип порівняння' : 'Умова' }))
    expect(screen.getByRole('option', { name: mode === 'row' ? 'В групі зі списку' : 'У групі зі списку' }).getAttribute('data-combobox-disabled')).toBe('true')
    for (const name of mode === 'row' ? ['Рівне', 'Не рівне', 'В списку', 'Не в списку'] : ['Дорівнює', 'Не дорівнює', 'У списку', 'Не у списку'])
      expect(screen.getByRole('option', { name }).getAttribute('data-combobox-disabled')).toBeNull()
    expect(request).toEqual(before)
    expect(onChange).not.toHaveBeenCalled()
  },
)
