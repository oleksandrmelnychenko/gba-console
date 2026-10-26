import { describe, expect, it } from 'vitest'
import { stockMovementCapability, stockMovementResult } from '../testing/warehouseStockMovementFixtures'
import {
  buildStockMovementRequest, defaultStockMovementDraft, displayDateTime, formatStockQuantity, moveLevel, normalizeStockMovementCapability,
  normalizeStockMovementExport, normalizeStockMovementLookup, normalizeStockMovementResult, parseArticleList, stockMovementDraftError,
  stockMovementPeriodPresets, summarizeStockMovementFilters, toggleLevel,
} from './warehouseStockMovement'

const draft = () => defaultStockMovementDraft(stockMovementCapability)

describe('warehouse stock movement request', () => {
  it('starts with all GBA history, all products and the 1C grouping', () => {
    const request = buildStockMovementRequest(draft())
    expect(request).toEqual({
      Version: 1, From: '2025-01-01', To: '2026-10-26', WarehouseIds: [], OrganizationIds: [], ProductIds: [], ArticleMatch: '', Articles: [],
      ProductGroupIds: [], DocumentKinds: [], DocumentText: null, Conditions: [], Levels: ['warehouse', 'product', 'registrar'],
      Measures: ['opening', 'incoming', 'outgoing', 'closing'], GrandTotals: true, NegativeRed: true, Offset: 0, Limit: 200,
    })
  })

  it('normalizes ids, articles, text and measures into a stable request', () => {
    const request = buildStockMovementRequest({
      ...draft(), warehouseIds: [2975, 2968, 2975], organizationIds: [3, 1], products: [{ id: 9, label: 'b' }, { id: 4, label: 'a' }],
      groups: [{ id: 7, label: 'g' }], articleMatch: 'contains', articleText: ' 940 ', documentKinds: ['transfer', 'sale'], documentText: '  ВН-7 ',
      conditions: [{ Measure: 'closing', Comparison: 'less', Value: 0 }, { Measure: 'opening', Comparison: 'equal', Value: Number.NaN }],
      measures: ['closing', 'opening'],
    }, 400)
    expect(request).toMatchObject({
      WarehouseIds: [2968, 2975], OrganizationIds: [1, 3], ProductIds: [4, 9], ProductGroupIds: [7], ArticleMatch: 'contains', Articles: ['940'],
      DocumentKinds: ['sale', 'transfer'], DocumentText: 'ВН-7', Conditions: [{ Measure: 'closing', Comparison: 'less', Value: 0 }],
      Measures: ['opening', 'closing'], Offset: 400,
    })
    expect(buildStockMovementRequest({ ...draft(), articleMatch: 'inList', articleText: 'ignored', articleList: parseArticleList('94000, 94001\n94000;') }))
      .toMatchObject({ ArticleMatch: 'inList', Articles: ['94000', '94001'] })
    expect(buildStockMovementRequest({ ...draft(), articleMatch: 'inList', articleList: [] })).toMatchObject({ ArticleMatch: '', Articles: [] })
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
    expect(summarizeStockMovementFilters({ ...draft(), articleText: '94000', warehouseIds: [2968, 5], documentKinds: ['sale'],
      conditions: [{ Measure: 'closing', Comparison: 'less', Value: 0 }] }, [{ Id: 2968, Name: 'СКЛАД -1', Detail: null }], [],
    stockMovementCapability.DocumentKinds)).toEqual([
      'Номенклатура.Артикул Дорівнює 94000', 'Склад У списку (СКЛАД -1; #5)', 'Вид документа руху У списку (Продаж)', 'Кількість кінцевий залишок Менше 0',
    ])
  })
})

describe('warehouse stock movement responses', () => {
  it('accepts camel or Pascal case wires and rejects incomplete capability', () => {
    const camel = Object.fromEntries(Object.entries(stockMovementCapability).map(([key, value]) => [key.charAt(0).toLowerCase() + key.slice(1), value]))
    expect(normalizeStockMovementCapability(camel)).toEqual(stockMovementCapability)
    expect(() => normalizeStockMovementCapability({ ...stockMovementCapability, Levels: ['warehouse', 'region'] })).toThrow()
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
    expect(displayDateTime('2026-10-19 12:46:36')).toBe('19.10.2026 12:46')
    expect(displayDateTime(null)).toBe('')
  })
})
