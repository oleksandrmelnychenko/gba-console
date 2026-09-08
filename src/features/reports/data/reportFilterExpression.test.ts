import { describe, expect, it } from 'vitest'
import { createFilterExpression, editFilterExpression, filterNodeAt, readFilterExpressionCapabilities, readReportFilterExpression, removeFilterSelection, reportFilterExpressionError, reportSelectionsForRequest, requestFilterExpression } from './reportFilterExpression'
import { expressionCapabilities as cap, expressionDataset as dataset, expressionRequest, nestedExpression } from './reportFilterExpression.test-fixtures'
import { datasetConfigurationError, datasetPresetRequest } from './reportDatasets'
import { valuationDataset } from './reportDatasets.test-fixtures'
import type { ReportFilterNode } from '../types'

describe('strict typed filter expressions', () => {
  it('validates exact original indices including disabled foreign filters; absent capabilities keep legacy only', () => {
    const data = expressionRequest()
    expect(datasetConfigurationError(data, dataset)).toBeNull()
    expect(reportSelectionsForRequest(data.selections, data.filterExpression)).toBe(data.selections)
    expect(reportSelectionsForRequest(data.selections, undefined)).toEqual(data.selections.slice(0, 2))
    expect(reportFilterExpressionError(data, { ...dataset, FilterExpression: undefined })).toMatch(/не підтвердив/)
    expect(reportFilterExpressionError({ ...data, filterExpression: undefined }, undefined)).toBeNull()
    expect(readReportFilterExpression({ Version: 1, Root: { Kind: 2, Children: [] } })).not.toBeNull()
    expect(reportFilterExpressionError({ ...data, selections: [], filterExpression: { Version: 1, Root: { Kind: 2, Children: [] } } }, dataset)).toBeNull()
  })
  it.each([
    { Version: 2, Root: nestedExpression.Root }, { ...nestedExpression, Sql: 'never executed' },
    { Version: 1 }, { Version: 1, Root: { Kind: 0, Children: [] } },
    { Version: 1, Root: { Kind: 1, Children: [], SelectionIndex: 0 } },
    { Version: 1, Root: { Kind: 1 } }, { Version: 1, Root: { Kind: 3, SelectionIndex: 0, Children: [] } },
    { Version: 1, Root: { Kind: 3 } }, { Version: 1, Root: { Kind: 3, SelectionIndex: '0' } },
    { Version: 1, Root: { Kind: 3, SelectionIndex: -1 } }, { Version: 1, Root: { Kind: 3, SelectionIndex: 0.1 } },
    { Version: 1, Root: { Kind: 3, SelectionIndex: 0, Future: true } },
    { Version: 1, Root: { Kind: 2, Children: [{ Kind: 3, SelectionIndex: 2 }, { Kind: 3, SelectionIndex: 2 }] } },
  ])('refuses malformed/unknown source material intact %#', filterExpression => {
    const data = { ...expressionRequest(), filterExpression }, original = structuredClone(data)
    expect(reportFilterExpressionError(data, dataset)).toMatch(/Невідома версія|некоректне дерево/)
    expect(data).toEqual(original)
    expect(removeFilterSelection(filterExpression, 0)).toBe(filterExpression)
    expect(editFilterExpression(filterExpression, { kind: 'add-group', path: [] }, cap)).toBe(filterExpression)
  })
  it('blocks every active omission and out-of-range index, but permits omitted disabled filters', () => {
    const data = expressionRequest()
    data.filterExpression = { Version: 1, Root: { Kind: 3, SelectionIndex: 0 } }
    expect(reportFilterExpressionError(data, dataset)).toContain('№2')
    data.filterExpression = createFilterExpression(data.selections.slice(0, 2))
    expect(reportFilterExpressionError(data, dataset)).toBeNull()
    data.selections[2].IsChecked = true
    expect(reportFilterExpressionError(data, dataset)).toContain('№3')
    data.filterExpression = { Version: 1, Root: { Kind: 3, SelectionIndex: 55 } }
    expect(reportFilterExpressionError(data, dataset)).toContain('відсутню умову №56')
  })
  it('rejects alias duplicates even null and preserves Pascal response material', () => {
    const data = expressionRequest()
    expect(requestFilterExpression({ ...data, filterExpression: undefined, FilterExpression: nestedExpression })).toBeUndefined()
    expect(reportFilterExpressionError({ ...data, FilterExpression: null }, dataset)).toContain('двічі')
    delete data.filterExpression; data.FilterExpression = nestedExpression
    expect(requestFilterExpression(data)).toBe(nestedExpression)
    expect(reportFilterExpressionError(data, dataset)).toBeNull()
  })
  it('bounds cycles, shared objects, depth, leaf and node counts independently', () => {
    const cyclic: ReportFilterNode = { Kind: 1, Children: [] }; cyclic.Children.push(cyclic)
    expect(readReportFilterExpression({ Version: 1, Root: cyclic })).toBeNull()
    const group: ReportFilterNode = { Kind: 1, Children: [] }
    expect(readReportFilterExpression({ Version: 1, Root: { Kind: 2, Children: [group, group] } })).toBeNull()
    let deep: ReportFilterNode = { Kind: 3, SelectionIndex: 0 }
    for (let i = 0; i < 7; i++) deep = { Kind: 1, Children: [deep] }
    expect(readReportFilterExpression({ Version: 1, Root: deep })).not.toBeNull()
    expect(readReportFilterExpression({ Version: 1, Root: { Kind: 1, Children: [deep] } })).toBeNull()
    const leaves = (count: number) => ({ Version: 1, Root: { Kind: 2, Children: Array.from({ length: count }, (_, SelectionIndex) => ({ Kind: 3, SelectionIndex })) } })
    expect(readReportFilterExpression(leaves(64))).not.toBeNull(); expect(readReportFilterExpression(leaves(65))).toBeNull()
    const nodes = (count: number) => ({ Version: 1, Root: { Kind: 2, Children: Array.from({ length: count }, () => ({ Kind: 1, Children: [] })) } })
    expect(readReportFilterExpression(nodes(127))).not.toBeNull(); expect(readReportFilterExpression(nodes(128))).toBeNull()
    expect(reportFilterExpressionError(expressionRequest(), { ...dataset, FilterExpression: { ...cap, MaximumDepth: 2 } })).toContain('межі сервера')
    expect(readFilterExpressionCapabilities({ ...dataset, FilterExpression: { ...cap, MaximumLeaves: 65 } })).toBeNull()
    expect(readFilterExpressionCapabilities({ ...dataset, FilterExpression: { ...cap, Operators: [1, 1] } })).toBeNull()
  })
})

describe('explicit index and tree edits', () => {
  it('deletes one exact original position and shifts later positions without flattening any groups', () => {
    const data = expressionRequest(), original = structuredClone(data)
    const filterExpression = removeFilterSelection(data.filterExpression, 0)
    expect(filterExpression).toEqual({ Version: 1, Root: { Kind: 1, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 2, Children: [{ Kind: 3, SelectionIndex: 1 }] }] } })
    expect(data).toEqual(original)
    expect(reportFilterExpressionError({ ...data, filterExpression, selections: data.selections.slice(1) }, dataset)).toBeNull()
  })
  it('resolves sibling destination before source removal and carries entire nested block', () => {
    const moved = editFilterExpression(nestedExpression, { kind: 'move', path: [0], target: [1] }, cap)
    expect(moved).toEqual({ Version: 1, Root: { Kind: 1, Children: [{ Kind: 2, Children: [{ Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 2 }, { Kind: 3, SelectionIndex: 1 }] }] } })
    const wrapped = { Version: 1, Root: { Kind: 1, Children: [nestedExpression.Root, { Kind: 2, Children: [] }] } }
    const moveGroup = editFilterExpression(wrapped, { kind: 'move', path: [0], target: [1] }, cap)
    expect(readReportFilterExpression(moveGroup)?.Root).toEqual({ Kind: 1, Children: [{ Kind: 2, Children: [nestedExpression.Root] }] })
    expect(editFilterExpression(nestedExpression, { kind: 'move', path: [], target: [1] }, cap)).toBe(nestedExpression)
    expect(editFilterExpression(nestedExpression, { kind: 'move', path: [1], target: [1, 0] }, cap)).toBe(nestedExpression)
    expect(editFilterExpression(nestedExpression, { kind: 'move', path: [0], target: [1] }, { ...cap, MaximumDepth: 2 })).toBe(nestedExpression)
  })
  it('never inserts duplicate references, allows explicit ungroup, and preserves presets with valuation/ordering/flags', () => {
    expect(editFilterExpression(nestedExpression, { kind: 'add-selection', path: [1], index: 0 }, cap)).toBe(nestedExpression)
    const expanded = editFilterExpression(nestedExpression, { kind: 'ungroup', path: [1] }, cap)
    expect(readReportFilterExpression(expanded)?.Root).toEqual({ Kind: 1, Children: [{ Kind: 3, SelectionIndex: 1 }, { Kind: 3, SelectionIndex: 0 }, { Kind: 3, SelectionIndex: 2 }] })
    expect(filterNodeAt(nestedExpression, [0, 1])).toBeNull()
    const data = expressionRequest(), preset = datasetPresetRequest(dataset, 'account-balances-by-purpose-currency', data)
    expect(preset?.Data.filterExpression).toEqual(data.filterExpression)
    expect(preset?.Data.selections).toEqual(data.selections)
    const valuation = datasetPresetRequest(valuationDataset, 'stock-value-by-agreement', { ...data, dataSource: 8, valuationClientAgreementId: 456246 })
    expect(valuation?.Data.filterExpression).toEqual(data.filterExpression)
    expect(valuation?.Data.valuationClientAgreementId).toBe(456246)
  })
})
