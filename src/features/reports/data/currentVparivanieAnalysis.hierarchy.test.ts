import { describe, expect, it } from 'vitest'
import wire from './currentVparivanieAnalysis.hierarchy-capability-fixture.json'
import { analysisDataset } from './currentVparivanieAnalysis.test-fixtures'
import {
  analysisConditionUnavailableReason, analysisFilterConditions, analysisHierarchy, analysisHierarchyIdentity, analysisSelectionValueError,
  analysisValueIdentity, changeAnalysisSelectionCondition, currentVparivanieAnalysisCapability, currentVparivanieAnalysisLayoutError,
  validAnalysisFilterValue, ANALYSIS_HIERARCHY_PENDING,
} from './currentVparivanieAnalysis'
import { analysisRequest } from './currentVparivanieAnalysis.test-fixtures'
import type { ReportSelection } from '../types'

const dataset = { ...analysisDataset, currentVparivanie: { ...analysisDataset.currentVparivanie as object, analysis: wire } }
const capability = currentVparivanieAnalysisCapability(dataset)!
const descriptor = (type: number) => capability.filters.find(field => field.type === type)
const FOLDER = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const group = (kind: string, world = 'fenix') => ({ kind, world, id: FOLDER })
const selection = (field: number, condition: number, ...data: Record<string, unknown>[]): ReportSelection => ({
  IsChecked: true, SelectedField: { Type: field, Name: String(field) }, FilterCondition: { Type: condition, Name: String(condition) },
  Values: data.map((Data, index) => ({ Data, Name: `V${index}`, Value: 0 })),
})

describe('server hierarchy capability', () => {
  it('offers all eight comparisons wherever the server declares a real hierarchy', () => {
    const labels = analysisFilterConditions(dataset, 21).map(condition => condition.Name)
    expect(labels).toEqual(['Дорівнює', 'Не дорівнює', 'У списку', 'У групі зі списку', 'Не у списку', 'Не у групі зі списку', 'У групі', 'Не у групі'])
    for (const type of [1, 4, 5, 6, 17, 21]) expect(descriptor(type)?.conditions).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    for (const type of [0, 2, 3, 7, 8, 9, 11, 12, 13, 14, 16, 60]) {
      expect(descriptor(type)?.conditions).toEqual([0, 1, 2, 4])
      expect(analysisHierarchy(descriptor(type))).toBeUndefined()
    }
    expect(analysisHierarchy(descriptor(5))?.groupKind).toBe('counterpartyGroup')
    expect(analysisHierarchy(descriptor(17))?.itemKind).toBe('supplier')
    expect(analysisHierarchy(descriptor(21))?.groupKind).toBe('warehouseGroup')
    expect(analysisHierarchy(descriptor(1))?.groupKind).toBe('productGroup')
  })
  it('rejects a hierarchy that does not belong to its field or points to an arbitrary endpoint', () => {
    const swapped = structuredClone(dataset)
    swapped.currentVparivanie.analysis.filters.find(field => field.type === 21)!.hierarchy!.groupKind = 'counterpartyGroup'
    expect(currentVparivanieAnalysisCapability(swapped)).toBeUndefined()
    const redirected = structuredClone(dataset)
    redirected.currentVparivanie.analysis.filters.find(field => field.type === 5)!.hierarchy!.browseEndpoint = '/elsewhere'
    expect(currentVparivanieAnalysisCapability(redirected)).toBeUndefined()
    const flat = structuredClone(dataset)
    const article = flat.currentVparivanie.analysis.filters.find(field => field.type === 2)! as Record<string, unknown>
    article.hierarchy = flat.currentVparivanie.analysis.filters.find(field => field.type === 1)!.hierarchy
    expect(currentVparivanieAnalysisCapability(flat)).toBeUndefined()
  })
  it('disables group conditions only for hierarchies the server reports as missing', () => {
    expect(analysisConditionUnavailableReason(descriptor(21), 6, null)).toBe(ANALYSIS_HIERARCHY_PENDING)
    expect(analysisConditionUnavailableReason(descriptor(21), 2, null)).toBeNull()
    expect(analysisConditionUnavailableReason(descriptor(4), 6, null)).toBeNull()
    const status = { productGroup: null, counterpartyGroup: null, warehouseGroup: 'Папки складів ще не захоплені.' }
    expect(analysisConditionUnavailableReason(descriptor(21), 3, status)).toBe('Папки складів ще не захоплені.')
    expect(analysisConditionUnavailableReason(descriptor(5), 7, status)).toBeNull()
    expect(analysisConditionUnavailableReason(descriptor(60), 0, status)).toBeNull()
  })
})

describe('typed hierarchy values', () => {
  it.each([
    [5, 3, { kind: 'buyer', id: 7 }, true],
    [5, 3, group('counterpartyGroup'), true],
    [5, 6, group('counterpartyGroup'), true],
    [5, 6, { kind: 'buyer', id: 7 }, false],
    [5, 7, { Id: 7 }, false],
    [5, 3, group('counterpartyGroup', 'amg'), false],
    [5, 2, group('counterpartyGroup'), false],
    [5, 2, { kind: 'buyer', id: 7 }, false],
    [5, 2, { Id: 7 }, true],
    [17, 5, { kind: 'supplier', id: '8' }, true],
    [17, 5, { kind: 'buyer', id: '8' }, false],
    [21, 7, group('warehouseGroup', 'amg'), true],
    [21, 3, { kind: 'warehouse', id: 3 }, true],
    [21, 3, { kind: 'warehouseGroup', world: 'fenix', id: '00000000000000000000000000000000' }, false],
    [1, 6, { kind: 'productGroup', id: 9 }, true],
    [1, 6, { Id: 9 }, false],
    [1, 0, { kind: 'product', id: 9 }, false],
  ])('field %i condition %i value %j valid=%s', (field, condition, value, valid) => {
    expect(validAnalysisFilterValue(field, value, descriptor(field), condition)).toBe(valid)
  })
  it('keeps item and group identities distinct and stable across legacy and typed encodings', () => {
    expect(analysisValueIdentity(5, { kind: 'buyer', id: '7' })).toBe(analysisValueIdentity(5, { Id: 7 }))
    expect(analysisValueIdentity(5, group('counterpartyGroup'))).toBe(`counterpartyGroup:fenix:${FOLDER}`)
    expect(analysisValueIdentity(21, group('warehouseGroup', 'amg'))).not.toBe(analysisValueIdentity(21, group('warehouseGroup')))
    expect(analysisValueIdentity(1, { kind: 'productGroup', id: 3 })).not.toBe(analysisValueIdentity(1, { kind: 'product', id: 3 }))
    expect(analysisHierarchyIdentity(21, { kind: 'warehouseGroup', world: 'fenix', id: FOLDER.toLowerCase() })?.id).toBe(FOLDER)
  })
  it('re-encodes exact values when moving between flat and group conditions and keeps groups visible', () => {
    const flat = selection(5, 2, { Id: 7 }, { Id: '8' })
    const grouped = changeAnalysisSelectionCondition(flat, { Type: 3, Name: 'У групі зі списку' })
    expect(grouped.Values.map(value => value.Data)).toEqual([{ kind: 'buyer', id: 7 }, { kind: 'buyer', id: '8' }])
    const mixed = { ...grouped, Values: [...grouped.Values, { Data: group('counterpartyGroup'), Name: 'Київ', Value: 0 }] }
    const back = changeAnalysisSelectionCondition(mixed, { Type: 4, Name: 'Не у списку' })
    expect(back.Values.map(value => value.Data)).toEqual([{ Id: 7 }, { Id: '8' }, group('counterpartyGroup')])
    expect(analysisSelectionValueError(back, descriptor(5))).toBe('Групи можна обрати лише в умовах «У групі…»; приберіть групи або змініть умову.')
    const one = changeAnalysisSelectionCondition(selection(21, 0, { Id: 3 }), { Type: 6, Name: 'У групі' })
    expect(one.Values[0].Data).toEqual({ kind: 'warehouse', id: 3 })
    expect(analysisSelectionValueError(one, descriptor(21))).toBe('Для умов «У групі» та «Не у групі» оберіть групу; окремі значення доступні в умовах «У групі зі списку» та «Не у групі зі списку».')
    expect(analysisSelectionValueError(selection(21, 6, group('warehouseGroup'), group('warehouseGroup', 'amg')), descriptor(21)))
      .toBe('Оберіть одну групу для цієї умови.')
  })
})

describe('analysis layout', () => {
  const request = (...selections: ReportSelection[]) => ({ ...analysisRequest(), selections })
  it('anchors on product groups chosen through the Товар field and keeps one product hierarchy rule', () => {
    expect(currentVparivanieAnalysisLayoutError(request(selection(1, 6, { kind: 'productGroup', id: 4 })), dataset)).toBeNull()
    expect(currentVparivanieAnalysisLayoutError(request(selection(1, 7, { kind: 'productGroup', id: 4 })), dataset))
      .toBe('Оберіть товари або групи товарів для аналізу.')
    expect(currentVparivanieAnalysisLayoutError(request(selection(1, 6, { kind: 'productGroup', id: 4 }), selection(4, 6, { Id: 4 })), dataset))
      .toBe('Задайте відбір за групами товарів одним правилом: «Товар» або «Товарна група».')
  })
  it('blocks a group condition whose hierarchy is unavailable but does not wait for a pending status', () => {
    const data = request(selection(4, 6, { Id: 4 }), selection(21, 7, group('warehouseGroup')))
    expect(currentVparivanieAnalysisLayoutError(data, dataset)).toBeNull()
    expect(currentVparivanieAnalysisLayoutError(data, dataset, false, { warehouseGroup: 'Немає папок складів.' })).toBe('Немає папок складів.')
    expect(currentVparivanieAnalysisLayoutError(data, dataset, false, { warehouseGroup: null })).toBeNull()
    expect(currentVparivanieAnalysisLayoutError(request(selection(4, 6, { Id: 4 }), selection(5, 5, group('counterpartyGroup'), { kind: 'buyer', id: 1 })),
      dataset, false, { counterpartyGroup: null })).toBeNull()
  })
})
