import { describe, expect, it, vi } from 'vitest'
import type { ReportRequestBody, ReportSelection } from '../types'
import { netDataset } from './reportDatasets.test-fixtures'
import type { StockMovementCapability, StockMovementDraft, StockMovementRequest } from './warehouseStockMovement'
import {
  clearReportHandoff, defaultHistoryPeriod, distinctLabels, droppedSettingsLine, historyDayTitle, historyPeriodPresets,
  historyReportKeyName, historyReportName, historyReportOptions, historySummary, MOVEMENT_REPORT_KEY, movementDraftFromHistory,
  movementHistorySummary, peekReportHandoff, REGIONAL_REPORT_KEY, verifyHistoryValues, rememberHistoryRun, rememberWorkbookOpen, sanitizeHistorySettings, takeHistoryRun,
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

describe('history values checked against current data', () => {
  const label = (item: ReportSelection) => item.SelectedField.Name
  it('drops only values whose record is gone and keeps what cannot be checked', async () => {
    const source = request()
    source.selections = source.selections.slice(1)
    source.filterExpression = { Version: 1, Root: { Kind: 2, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 1 }] } }
    const search = vi.fn(async (field: number, text: string) => {
      if (field === netDataset.Filters[0].Type) return text === '' ? [{ Id: 1, Name: 'Інша' }] : []
      if (text === '') return [{ Id: 7, Name: 'A-100' }]
      return text === 'A-100' ? [{ Id: 7, Name: 'A-100' }] : []
    })
    const { data, dropped } = await verifyHistoryValues(source, search, 30, label)
    expect(dropped).toEqual(['Organization: ТОВ «Конкорд»', 'Article: B-200'])
    expect(data.selections).toHaveLength(1)
    expect(data.selections[0].Values.map(value => value.Name)).toEqual(['A-100'])
    expect(data.filterExpression).toEqual({ Version: 1, Root: { Kind: 2, Children: [{ Kind: 3, SelectionIndex: 0 }] } })
  })

  it('keeps values when the list cannot be read, is not searchable or is cut at the page size', async () => {
    const source = request()
    source.selections = source.selections.slice(1)
    const failing = vi.fn(async () => { throw new Error('offline') })
    expect((await verifyHistoryValues(source, failing, 30, label)).dropped).toEqual([])
    const unsupported = vi.fn(async () => [])
    expect((await verifyHistoryValues(source, unsupported, 30, label)).dropped).toEqual([])
    const full = vi.fn(async () => Array.from({ length: 30 }, (_, index) => ({ Id: 1000 + index, Name: `X${index}` })))
    expect((await verifyHistoryValues(source, full, 30, label)).data.selections).toEqual(source.selections)
  })
})

describe('report keys and movement entries', () => {
  it('names movement, regional and profile keys in catalogue wording', () => {
    expect(historyReportKeyName(MOVEMENT_REPORT_KEY, [], [])).toBe('Рух товару')
    expect(historyReportKeyName(REGIONAL_REPORT_KEY, [], [])).toBe('Аналіз залишків і продажів: регіональна форма')
    expect(historyReportKeyName('2:sales', [], [])).toBe('Звіт по продажам')
    const options = historyReportOptions([netDataset], [], new Set([2]))
    expect(options.map(option => option.value)).toEqual(['2', MOVEMENT_REPORT_KEY])
  })

  const capability = { Version: 1, MinimumFrom: '2024-01-01', Today: '2026-11-17', StockSyncAt: null, Levels: ['warehouse', 'product'],
    DefaultLevels: ['warehouse'], Measures: ['opening'], Comparisons: [], ArticleMatches: ['equals'],
    DocumentKinds: [{ Code: 'sale', Name: 'Продаж' }], MaximumLimit: 500, MaximumFilterRows: 10, Notes: [] } as unknown as StockMovementCapability
  const movement: StockMovementRequest = { Version: 1, From: '2026-11-01', To: '2026-11-17', WarehouseIds: [], OrganizationIds: [], ProductIds: [],
    ArticleMatch: '', Articles: [], ProductGroupIds: [], ProductTops: [], MeasureUnitIds: [], DocumentKinds: [], DocumentText: null,
    Filters: [{ Field: 'warehouse', Ids: [1, 2], Row: 1 }, { Field: 'product', Ids: [7, 8], Row: 2 }, { Field: 'documentKind', Values: ['sale', 'old'], Row: 3 }],
    FilterExpression: { Version: 1, Root: { Kind: 2, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 1 }, { Kind: 3, SelectionIndex: 2 }] } },
    Conditions: [], Levels: ['warehouse', 'product'], Measures: ['opening'], GrandTotals: false, NegativeRed: true, Offset: 0, Limit: 200 }

  it('rebuilds the movement settings with current names and drops what no longer exists', () => {
    const base = { from: '', to: '', listed: true, filterRows: [], conditions: [], levels: [], measures: [], grandTotals: true, negativeRed: true } as StockMovementDraft
    const { draft, dropped } = movementDraftFromHistory(movement, capability, base, {
      warehouses: [{ Id: 1, Name: 'Склад 1', Detail: null }], organizations: [], units: null, tops: null,
      products: [{ Id: 7, Name: 'A-100', Detail: 'Фільтр' }], groups: [] })
    expect(dropped).toEqual(['Склад: 1 значення', 'Товар: 1 значення', 'Вид документа руху: old'])
    expect(draft.filterRows.map(row => [row.field, row.ids ?? row.items?.map(item => item.label) ?? row.values])).toEqual([
      ['warehouse', [1]], ['product', ['A-100']], ['documentKind', ['sale']]])
    expect(draft).toMatchObject({ from: '2026-11-01', to: '2026-11-17', grandTotals: false, levels: ['warehouse', 'product'] })
    expect(draft.filterExpression).toEqual({ Version: 1, Root: { Kind: 2, Children: [
      { Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 1 }, { Kind: 3, SelectionIndex: 2 }] } })
    expect(movementHistorySummary(movement)).toEqual({ period: '01.11.2026 – 17.11.2026',
      filters: 'Склад: 2 значення; Товар: 2 значення; Вид документа руху: sale, old' })
  })
})
