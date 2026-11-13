import { describe, expect, it } from 'vitest'
import { currentVparivanieConfigurationError } from './currentVparivanie'
import { currentVparivanieDataset, exactSelection } from './currentVparivanie.test-fixtures'
import { originalMatrixScope } from './originalVparivanieScope'

import { originalScopeRequest } from '../testing/originalVparivanieScopeFixtures'

describe('original matrix exact scope admission', () => {
  it('derives the full saved period and local group without interpreting the ID as a Source reference', () => {
    expect(originalMatrixScope(originalScopeRequest())).toEqual({ World: 'fenix', From: '2025-01-01', Through: '2026-10-09', GroupId: 3569 })
    const dataset = { ...currentVparivanieDataset, currentVparivanie: { ...currentVparivanieDataset.currentVparivanie as object,
      FullScopeVersion: 1, FullScopeContract: 'OneOurSnapshotCompleteSelectedScope', FullScopeMaximumRows: 500000,
      FullScopeMaximumSelectedProducts: 4096, FullScopeMaximumColumns: 256, FullScopeMaximumAddressedCells: 1000000 } }
    expect(currentVparivanieConfigurationError(originalScopeRequest(), dataset, 'workspace')).toBeNull()
    expect(currentVparivanieConfigurationError(originalScopeRequest(), dataset)).toMatch(/366/)
  })
  it('rejects extra selections/options, unsafe aliases and missing full scope', () => {
    const request = originalScopeRequest()
    for (const patch of [{ selections: [...request.selections, exactSelection(5)] }, { currentVparivanieFullScope: false },
      { ordering: { Version: 1, Rows: [], Columns: [] } }, { selections: [exactSelection(4, 6, ['9007199254740993'])] },
      { sorted: { ...request.sorted, Col: request.sorted.Col.slice(1) } }])
      expect(() => originalMatrixScope({ ...request, ...patch } as typeof request)).toThrow()
  })
  it('rejects hidden nested ordering, measure options, exclusions and alternate Source references', () => {
    const mutations = [
      (request: ReturnType<typeof originalScopeRequest>) => Object.assign(request.sorted, { ordering: { Direction: 2 } }),
      (request: ReturnType<typeof originalScopeRequest>) => Object.assign(request.sorted.Row[0], { Descending: true }),
      (request: ReturnType<typeof originalScopeRequest>) => Object.assign(request.sorted.Measurements[0], { Options: { Round: 0 } }),
      (request: ReturnType<typeof originalScopeRequest>) => Object.assign(request.selections[0], { Exclude: true }),
      (request: ReturnType<typeof originalScopeRequest>) => Object.assign(request.selections[0].Values[0].Data, { SourceReference: 'D'.repeat(32) }),
    ]
    for (const mutate of mutations) {
      const request = originalScopeRequest(); mutate(request)
      expect(() => originalMatrixScope(request)).toThrow()
      expect(currentVparivanieConfigurationError(request, undefined, 'workspace')).toMatch(/366/)
    }
  })
})
