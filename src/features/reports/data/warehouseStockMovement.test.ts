import { describe, expect, it } from 'vitest'
import { stockMovementCapability, stockMovementResult } from '../testing/warehouseStockMovementFixtures'
import {
  buildStockMovementRequest, defaultStockMovementDraft, displayDateTime, formatStockQuantity, moveLevel, normalizeStockMovementCapability,
  normalizeStockMovementExport, normalizeStockMovementLookup, normalizeStockMovementResult, stockMovementDraftError,
  stockMovementPeriodPresets, summarizeStockMovementFilters, toggleLevel, stockMovementExpressionView, copyStockMovementRow,
  type StockMovementFilterRow,
} from './warehouseStockMovement'

const draft = () => defaultStockMovementDraft(stockMovementCapability)
const legacyDraft = () => defaultStockMovementDraft({ ...stockMovementCapability, MaximumFilterRows: undefined })
let nextId = 0
const row = (field: StockMovementFilterRow['field'], patch: Partial<StockMovementFilterRow> = {}): StockMovementFilterRow =>
  ({ id: ++nextId, field, enabled: true, ...patch })

describe('warehouse stock movement request', () => {
  it('starts with the current month, all products and the 1C grouping', () => {
    const request = buildStockMovementRequest(draft())
    expect(request).toEqual({
      Version: 1, From: '2026-10-01', To: '2026-10-26', WarehouseIds: [], OrganizationIds: [], ProductIds: [], ArticleMatch: '', Articles: [],
      ProductGroupIds: [], ProductTops: [], MeasureUnitIds: [], DocumentKinds: [], DocumentText: null, Conditions: [], Levels: ['warehouse', 'product', 'registrar'],
      Measures: ['opening', 'incoming', 'outgoing', 'closing'], GrandTotals: true, NegativeRed: true, Offset: 0, Limit: 200,
    })
  })

  it('normalizes ids, articles, text and measures into a stable request', () => {
    const filterRows = [row('warehouse', { ids: [2975, 2968, 2975] }), row('organization', { ids: [3, 1] }),
      row('product', { items: [{ id: 9, label: 'b' }, { id: 4, label: 'a' }] }), row('group', { items: [{ id: 7, label: 'g' }] }),
      row('article', { articleMatch: 'contains', text: ' 940 ' }), row('documentKind', { values: ['transfer', 'sale'] }), row('documentText', { text: '  ВН-7 ' })]
    const rest = { conditions: [{ Measure: 'closing' as const, Comparison: 'less' as const, Value: 0 }, { Measure: 'opening' as const, Comparison: 'equal' as const, Value: Number.NaN }],
      measures: ['closing' as const, 'opening' as const] }
    expect(buildStockMovementRequest({ ...legacyDraft(), filterRows, ...rest }, 400)).toMatchObject({
      WarehouseIds: [2968, 2975], OrganizationIds: [1, 3], ProductIds: [4, 9], ProductGroupIds: [7], ArticleMatch: 'contains', Articles: ['940'],
      DocumentKinds: ['sale', 'transfer'], DocumentText: 'ВН-7', Conditions: [{ Measure: 'closing', Comparison: 'less', Value: 0 }],
      Measures: ['opening', 'closing'], Offset: 400,
    })
    const listed = buildStockMovementRequest({ ...draft(), filterRows, ...rest }, 400)
    expect(listed).toMatchObject({ WarehouseIds: [], OrganizationIds: [], ProductIds: [], ArticleMatch: '', Articles: [], DocumentText: null, Filters: [
      { Field: 'warehouse', Ids: [2968, 2975] }, { Field: 'organization', Ids: [1, 3] }, { Field: 'product', Ids: [4, 9] }, { Field: 'group', Ids: [7] },
      { Field: 'article', ArticleMatch: 'contains', Values: ['940'] }, { Field: 'documentKind', Values: ['sale', 'transfer'] }, { Field: 'documentText', Text: 'ВН-7' }] })
    expect(buildStockMovementRequest({ ...legacyDraft(), filterRows: [row('article', { articleMatch: 'inList', text: '94000, 94001\n94000;' })] }))
      .toMatchObject({ ArticleMatch: 'inList', Articles: ['94000', '94001'] })
    expect(buildStockMovementRequest({ ...draft(), filterRows: [row('article', { articleMatch: 'inList', text: ' ;' })] })).not.toHaveProperty('Filters')
  })

  it('sends repeated fields as separate rows and remaps the tree past switched-off and empty rows', () => {
    const filterRows = [row('group', { items: [{ id: 7, label: 'Фільтри' }] }), row('warehouse', { ids: [1], enabled: false }), row('group'),
      row('group', { items: [{ id: 8, label: 'Подушки' }] })]
    const filterExpression = { Version: 1 as const, Root: { Kind: 2, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 1 },
      { Kind: 3, SelectionIndex: 2 }, { Kind: 1, Children: [{ Kind: 3, SelectionIndex: 3 }] }] } }
    expect(buildStockMovementRequest({ ...draft(), filterRows, filterExpression })).toMatchObject({
      ProductGroupIds: [], Filters: [{ Field: 'group', Ids: [7], Row: 1 }, { Field: 'group', Ids: [8], Row: 4 }],
      FilterExpression: { Version: 1, Root: { Kind: 2, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 1, Children: [{ Kind: 3, SelectionIndex: 1 }] }] } },
    })
    expect(stockMovementDraftError({ ...draft(), filterRows }, stockMovementCapability)).toBeNull()
    expect(stockMovementDraftError({ ...legacyDraft(), filterRows }, stockMovementCapability)).toBe('Поле «Товарна група» можна вибрати лише один раз.')
    const long = [row('warehouse', { ids: [1] }), row('article', { articleMatch: 'equals', text: 'x'.repeat(129) })]
    expect(stockMovementDraftError({ ...draft(), filterRows: long }, stockMovementCapability)).toBe('Умова відбору 2: артикул не може бути довшим за 128 символів.')
    const many = [row('warehouse', { ids: [1] }), row('warehouse', { ids: [2], enabled: false }), row('group', { items: Array.from({ length: 101 }, (_, id) => ({ id: id + 1, label: `g${id}` })) })]
    expect(stockMovementDraftError({ ...draft(), filterRows: many }, stockMovementCapability)).toBe('Умова відбору 3: можна вибрати до 100 груп товарів.')
    expect(stockMovementDraftError({ ...draft(), filterRows: [row('organization', { ids: Array.from({ length: 51 }, (_, id) => id + 1) })] }, stockMovementCapability))
      .toBe('Умова відбору 1: можна вибрати до 50 організацій.')
    expect(stockMovementDraftError({ ...draft(), filterRows: [row('documentText', { text: 'д'.repeat(65) })] }, stockMovementCapability))
      .toBe('Умова відбору 1: текст документа не може бути довшим за 64 символи.')
    const copy = copyStockMovementRow(filterRows[0], 99)
    expect(copy).toEqual({ ...filterRows[0], id: 99 })
    expect(copy.items).not.toBe(filterRows[0].items)
  })

  it('names the chosen values in the І/АБО tree labels like the sales report', () => {
    const filterRows = [row('warehouse', { ids: [2975, 2968] }), row('organization', { ids: [1] }), row('article', { articleMatch: 'contains', text: '94' }),
      row('documentKind', { values: ['sale'] }), row('group', { items: [{ id: 7, label: 'Фільтри' }] }), row('unit', { ids: [2] }), row('top')]
    const view = stockMovementExpressionView({ ...draft(), filterRows }, { ...stockMovementCapability,
      FilterExpression: { Version: 1, MaximumDepth: 8, MaximumLeaves: 9, Operators: [1, 2] } },
    { warehouses: [{ Id: 2968, Name: 'СКЛАД -1', Detail: 'Фенікс' }, { Id: 2975, Name: 'СКЛАД -3', Detail: 'Фенікс' }],
      organizations: [{ Id: 1, Name: 'Фенікс', Detail: null }], units: [{ Id: 2, Name: 'компл', Detail: null }] })
    expect(view.data.selections.map(selection => `${selection.SelectedField.Name} ${selection.FilterCondition.Name} ${selection.Values.map(value => value.Name).join('; ')}`))
      .toEqual(['Склад В списку СКЛАД -1; СКЛАД -3', 'Організація складу В списку Фенікс', 'Артикул Містить 94', 'Вид документа руху В списку Продаж',
        'Товарна група В групі Фільтри', 'Одиниця виміру В списку компл', 'Топ В списку '])
    expect(view.data.selections.map(selection => selection.IsChecked)).toEqual([true, true, true, true, true, true, false])
    expect((view.dataset.FilterExpression as { MaximumLeaves: number }).MaximumLeaves).toBe(30)
  })

  it('validates the period, grouping order, measures and conditions', () => {
    expect(stockMovementDraftError(draft(), stockMovementCapability)).toBeNull()
    expect(stockMovementDraftError({ ...draft(), from: '2024-12-31' }, stockMovementCapability)).toContain('01.01.2025')
    expect(stockMovementDraftError({ ...draft(), to: '2026-10-27' }, stockMovementCapability)).toContain('сьогодні')
    expect(stockMovementDraftError({ ...draft(), from: '2026-02-01', to: '2026-01-01' }, stockMovementCapability)).toContain('пізніша')
    expect(stockMovementDraftError({ ...draft(), levels: [] }, stockMovementCapability)).toContain('групування')
    expect(stockMovementDraftError({ ...draft(), levels: ['registrar', 'warehouse'] }, stockMovementCapability)).toContain('останнім')
    expect(stockMovementDraftError({ ...draft(), levels: ['day', 'month'] }, stockMovementCapability)).toContain('днем')
    expect(stockMovementDraftError({ ...draft(), measures: [] }, stockMovementCapability)).toContain('показник')
    expect(stockMovementDraftError({ ...draft(), conditions: [{ Measure: 'closing', Comparison: 'less', Value: Number.NaN }] }, stockMovementCapability)).toContain('число')
  })

  it('keeps the registrar as the deepest level when grouping changes', () => {
    expect(toggleLevel(['warehouse', 'registrar'], 'month', true)).toEqual(['warehouse', 'month', 'registrar'])
    expect(toggleLevel(['warehouse', 'month'], 'registrar', true)).toEqual(['warehouse', 'month', 'registrar'])
    expect(toggleLevel(['warehouse', 'product'], 'warehouse', false)).toEqual(['product'])
    expect(moveLevel(['warehouse', 'product', 'registrar'], 'product', -1)).toEqual(['product', 'warehouse', 'registrar'])
    expect(moveLevel(['warehouse', 'product'], 'warehouse', -1)).toEqual(['warehouse', 'product'])
  })

  it('offers 1C-like period presets clamped to the GBA history start', () => {
    expect(stockMovementPeriodPresets('2026-10-26', '2025-01-01')).toEqual([
      { label: 'Уся історія GBA', from: '2025-01-01', to: '2026-10-26' },
      { label: 'Поточний місяць', from: '2026-10-01', to: '2026-10-26' },
      { label: 'Минулий місяць', from: '2026-09-01', to: '2026-09-30' },
      { label: 'Поточний рік', from: '2026-01-01', to: '2026-10-26' },
    ])
    expect(stockMovementPeriodPresets('2025-01-15', '2025-01-01')[2]).toEqual({ label: 'Минулий місяць', from: '2025-01-01', to: '2025-01-01' })
  })

  it('summarizes filters as the 1C header does', () => {
    expect(summarizeStockMovementFilters({ ...draft(), filterRows: [row('article', { text: '94000' }), row('warehouse', { ids: [2968, 5] }),
      row('documentKind', { values: ['sale'] })],
    conditions: [{ Measure: 'closing', Comparison: 'less', Value: 0 }] }, [{ Id: 2968, Name: 'СКЛАД -1', Detail: null }], [],
    stockMovementCapability.DocumentKinds)).toEqual([
      'Номенклатура.Артикул Дорівнює 94000', 'Склад У списку (#5; СКЛАД -1)', 'Вид документа руху У списку (Продаж)', 'Кількість кінцевий залишок Менше 0',
    ])
  })

  it('sends top and unit lists and leaves out a switched-off row', () => {
    const value = { ...legacyDraft(), filterRows: [row('top', { values: ['B', 'A', 'B'] }), row('warehouse', { ids: [2968], enabled: false }),
      row('unit', { ids: [2, 1] })] }
    expect(buildStockMovementRequest(value)).toMatchObject({ ProductTops: ['A', 'B'], MeasureUnitIds: [1, 2], WarehouseIds: [] })
    expect(summarizeStockMovementFilters(value, [{ Id: 2968, Name: 'СКЛАД -1', Detail: null }], [], stockMovementCapability.DocumentKinds,
      [{ Id: 1, Name: 'шт', Detail: null }])).toEqual(['Топ У списку (A; B)', 'Одиниця виміру У списку (шт; #2)'])
  })
})

describe('warehouse stock movement responses', () => {
  it('accepts camel or Pascal case wires and rejects incomplete capability', () => {
    const camel = Object.fromEntries(Object.entries(stockMovementCapability).map(([key, value]) => [key.charAt(0).toLowerCase() + key.slice(1), value]))
    expect(normalizeStockMovementCapability(camel)).toEqual(stockMovementCapability)
    expect(() => normalizeStockMovementCapability({ ...stockMovementCapability, Levels: ['warehouse', 'region'] })).toThrow()
    const { MaximumFilterRows: _rows, ...old } = stockMovementCapability
    void _rows
    expect(normalizeStockMovementCapability(old).MaximumFilterRows).toBeUndefined()
    expect(defaultStockMovementDraft(normalizeStockMovementCapability(old)).listed).toBe(false)
    expect(defaultStockMovementDraft(normalizeStockMovementCapability(stockMovementCapability)).listed).toBe(true)
    expect(normalizeStockMovementLookup([{ id: 1, name: 'A' }])).toEqual([{ Id: 1, Name: 'A', Detail: null }])
    expect(() => normalizeStockMovementLookup([{ Id: -1, Name: 'A' }])).toThrow()
    expect(normalizeStockMovementExport({ DocumentURL: '/f.xlsx', FileName: 'f.xlsx', TotalRows: 3 })).toEqual({ DocumentURL: '/f.xlsx', FileName: 'f.xlsx', TotalRows: 3 })
    expect(() => normalizeStockMovementExport({ DocumentURL: '', FileName: 'f.xlsx', TotalRows: 3 })).toThrow()
  })

  it('rejects results that do not answer the request or break the balance', () => {
    const request = buildStockMovementRequest(draft())
    const result = stockMovementResult(request)
    expect(normalizeStockMovementResult(result, request).Rows).toHaveLength(4)
    expect(() => normalizeStockMovementResult({ ...result, From: '2025-02-01' }, request)).toThrow()
    expect(() => normalizeStockMovementResult({ ...result, Offset: 200 }, request)).toThrow()
    expect(() => normalizeStockMovementResult({ ...result, Rows: result.Rows.map((row, index) => ({ ...row, Index: index + 1 })) }, request)).toThrow()
    expect(() => normalizeStockMovementResult({ ...result, Rows: [{ ...result.Rows[0], Quantity: { Opening: 1, Incoming: 1, Outgoing: 0, Closing: 1 } }] }, request)).toThrow()
    expect(() => normalizeStockMovementResult({ ...result, Totals: { Opening: 0, Incoming: 1, Outgoing: 0, Closing: 0 } }, request)).toThrow()
    expect(() => normalizeStockMovementResult({ ...result, TotalRows: 2 }, request)).toThrow()
  })

  it('formats quantities like the 1C spreadsheet', () => {
    expect(formatStockQuantity(0)).toBe('')
    expect(formatStockQuantity(1234567.5)).toBe('1 234 567,5')
    expect(formatStockQuantity(-1280)).toBe('-1 280')
    expect(formatStockQuantity(0.125)).toBe('0,125')
    expect(formatStockQuantity(0.12345678)).toBe('0,12345678')
    expect(formatStockQuantity(-0.00000001)).toBe('-0,00000001')
    expect(displayDateTime('2026-10-19 12:46:36')).toBe('19.10.2026 12:46')
    expect(displayDateTime(null)).toBe('')
  })
})


it('preserves unknown warehouse quantities while still rejecting false complete conservation', () => {
  const request = buildStockMovementRequest(draft())
  const result = stockMovementResult(request)
  const partial = { ...result, Totals: { Opening: null, Incoming: 0, Outgoing: null, Closing: null } }
  expect(normalizeStockMovementResult(partial, request).Totals).toEqual(partial.Totals)
  expect(formatStockQuantity(null)).toBe('—')
  expect(formatStockQuantity(0)).toBe('')
  expect(() => normalizeStockMovementResult({ ...result, Totals: { Opening: 0, Incoming: 0, Outgoing: 0, Closing: 1 } }, request)).toThrow()
})
