import { describe, expect, it } from 'vitest'
import type { ReportRequestBody, ReportSelection } from '../types'
import { netDataset } from './reportDatasets.test-fixtures'
import {
  clearReportHandoff, defaultHistoryPeriod, distinctLabels, droppedSettingsLine, historyDayTitle, historyPeriodPresets,
  historyReportName, historySummary, peekReportHandoff, rememberHistoryRun, rememberWorkbookOpen, sanitizeHistorySettings, takeHistoryRun,
} from './reportHistory'

function selection(type: number, name: string, values: Array<[number, string]>): ReportSelection {
  return { FilterCondition: { Name: 'Дорівнює', Type: 0 }, IsChecked: true, SelectedField: { Name: name, Type: type },
    Values: values.map(([value, label]) => ({ Value: value, Name: label, Data: { Id: value, Name: label } })) }
}

function request(): ReportRequestBody {
  return {
    dataSource: 2, from: '2026-11-01', to: '2026-11-17',
    sorted: {
      Row: [{ key: 'Client', label: 'Клієнт', type: 1 }, { key: 'Gone', label: 'Склад зберігання', type: 99 }],
      Col: [],
      Measurements: [
        { Type: netDataset.Measurements[0].Type, Name: 'Qty', Label: 'Кількість', IsChecked: true, parentName: 'Sales' },
        { Type: 999, Name: 'Removed', Label: 'Стара сума', IsChecked: true, parentName: 'Sales' },
      ],
    },
    selections: [
      selection(77, 'Removed', [[1, 'Щось']]),
      selection(netDataset.Filters[0].Type, 'Organization', [[5, 'ТОВ «Конкорд»']]),
      selection(netDataset.Filters[1].Type, 'Article', [[7, 'A-100'], [8, 'B-200']]),
    ],
    filterExpression: { Version: 1, Root: { Kind: 2, Children: [
      { Kind: 3, SelectionIndex: 0 },
      { Kind: 1, Children: [{ Kind: 3, SelectionIndex: 1 }, { Kind: 3, SelectionIndex: 2 }] },
    ] } },
  } as unknown as ReportRequestBody
}

describe('sanitizeHistorySettings', () => {
  it('keeps what still applies, re-indexes the І/АБО tree and names what was dropped', () => {
    const { data, dropped } = sanitizeHistorySettings(request(), netDataset)
    expect(data.sorted.Row.map(item => item.type)).toEqual([1])
    expect(data.sorted.Measurements.map(item => item.Type)).toEqual([netDataset.Measurements[0].Type])
    expect(data.selections.map(item => item.SelectedField.Type)).toEqual([netDataset.Filters[0].Type, netDataset.Filters[1].Type])
    expect(data.filterExpression).toEqual({ Version: 1, Root: { Kind: 2, Children: [
      { Kind: 1, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 1 }] },
    ] } })
    expect(dropped).toEqual(['Склад зберігання', 'Стара сума', 'Removed'])
    expect(droppedSettingsLine(dropped)).toBe('Не застосовано, бо цього вже немає у звіті: Склад зберігання, Стара сума, Removed.')
  })

  it('changes nothing when every setting is still in the catalogue', () => {
    const source = request()
    source.sorted.Row = source.sorted.Row.slice(0, 1)
    source.sorted.Measurements = source.sorted.Measurements.slice(0, 1)
    source.selections = source.selections.slice(1)
    source.filterExpression = { Version: 1, Root: { Kind: 1, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 1 }] } }
    const { data, dropped } = sanitizeHistorySettings(source, netDataset)
    expect(dropped).toEqual([])
    expect(data).toEqual(source)
    expect(droppedSettingsLine(dropped)).toBeNull()
  })

  it('drops the whole tree when no condition survives', () => {
    const source = request()
    source.selections = source.selections.slice(0, 1)
    source.filterExpression = { Version: 1, Root: { Kind: 1, Children: [{ Kind: 3, SelectionIndex: 0 }] } }
    const { data } = sanitizeHistorySettings(source, netDataset)
    expect(data.selections).toEqual([])
    expect(Object.hasOwn(data, 'filterExpression')).toBe(false)
  })
})

describe('history presentation', () => {
  it('summarises period and filters with the filter value names', () => {
    const { data } = sanitizeHistorySettings(request(), netDataset)
    const summary = historySummary(data, netDataset)
    expect(summary.period).toContain('01.11.2026')
    expect(summary.filters).toContain('A-100')
  })

  it('formats days, presets and the default 30-day period in Kyiv business days', () => {
    expect(historyDayTitle('2026-11-17')).toBe('17 листопада 2026')
    expect(defaultHistoryPeriod('2026-11-17')).toEqual({ from: '2026-10-19', to: '2026-11-17' })
    expect(historyPeriodPresets('2026-11-17')).toEqual([
      { label: 'Сьогодні', from: '2026-11-17', to: '2026-11-17' },
      { label: 'Тиждень', from: '2026-11-11', to: '2026-11-17' },
      { label: 'Місяць', from: '2026-11-01', to: '2026-11-17' },
    ])
  })

  it('adds an id in brackets only when two names coincide', () => {
    const labels = distinctLabels([{ id: 'a', name: 'Іван' }, { id: 'b', name: 'Іван' }, { id: 'c', name: 'Олена' }], item => item.name, item => item.id)
    expect([...labels.values()]).toEqual(['Іван (a)', 'Іван (b)', 'Олена'])
  })

  it('names a sales constructor entry by its profile and others by the catalogue', () => {
    expect(historyReportName({ ...request(), dataSource: 43, reportProfile: 'grossProfit' } as never, 43, [], [])).toBe('Валовий прибуток')
    expect(historyReportName(null, 2, [netDataset], [])).toBe('Продажі з поверненнями')
  })
})

describe('history hand-off to the reports page', () => {
  it('is read once, expires and survives a non-destructive peek', () => {
    const storage = window.sessionStorage
    storage.clear()
    rememberHistoryRun('11111111-1111-1111-1111-111111111111', 'excel', storage, 1000)
    rememberWorkbookOpen('ВП.xls', storage, 1000)
    expect(peekReportHandoff(storage, 2000)).toEqual({ history: { id: '11111111-1111-1111-1111-111111111111', action: 'excel', at: 1000 }, workbook: 'ВП.xls' })
    expect(peekReportHandoff(storage, 2000).history?.action).toBe('excel')
    clearReportHandoff(storage)
    expect(takeHistoryRun(storage, 2000)).toBeNull()
    rememberHistoryRun('11111111-1111-1111-1111-111111111111', 'open', storage, 1000)
    expect(takeHistoryRun(storage, 1000 + 61_000)).toBeNull()
  })
})
