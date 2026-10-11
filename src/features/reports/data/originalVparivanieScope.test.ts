import { describe, expect, it } from 'vitest'
import { currentVparivanieConfigurationError } from './currentVparivanie'
import { currentVparivanieDataset, exactSelection } from './currentVparivanie.test-fixtures'
import { matrixCapability, matrixFixture, matrixWire } from '../testing/originalVparivanieFixtures'
import { matrixBindingRequest, matrixScopeAccepted, normalizeMatrixScopeBinding, normalizeScopedMatrixResult, originalMatrixScope } from './originalVparivanieScope'

import { originalScopeBinding, originalScopeRequest, scopedMatrixFixture } from '../testing/originalVparivanieScopeFixtures'

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
  it('binds Source identity, full period, local group and the canonical normal reference', () => {
    const binding = originalScopeBinding(), scope = originalMatrixScope(originalScopeRequest())
    expect(normalizeMatrixScopeBinding(binding, matrixCapability(), scope)).toEqual(binding)
    for (const patch of [{ GroupId: 3570 }, { Through: '2026-10-08' }, { World: 'amg' }, { GroupReference: '0'.repeat(32) },
      { SchemaId: matrixWire().SourceId }, { AcceptanceProofSha256: null }])
      expect(() => normalizeMatrixScopeBinding({ ...binding, ...patch }, matrixCapability(), scope)).toThrow()
    expect(Object.keys(matrixBindingRequest(binding))).not.toContain('AcceptanceProofSha256')
  })
  it('admits only the current exact input witness while leaving global parity flags false', () => {
    const binding = originalScopeBinding(), result = normalizeScopedMatrixResult(scopedMatrixFixture(), binding)
    expect(matrixScopeAccepted(result)).toBe(true)
    expect(result.SourceParityVerified).toBe(false); expect(result.OriginalFullTaskAccepted).toBe(false)
    for (const patch of [{ InputWitnessSha256: 'c'.repeat(64) }, { AcceptanceProofSha256: 'c'.repeat(64) },
      { AcceptedInputWitnessSha256: 'c'.repeat(64) }, { GroupCaption: 'Інша група' }])
      expect(() => normalizeScopedMatrixResult({ ...result, ...patch }, binding)).toThrow()
    const changed = { ...result, ExactScopeAccepted: false, InputWitnessSha256: 'c'.repeat(64) }
    expect(matrixScopeAccepted(normalizeScopedMatrixResult(changed, binding))).toBe(false)
    expect(matrixScopeAccepted({ ...matrixFixture(), ExactScopeAccepted: true })).toBe(false)
  })
})
