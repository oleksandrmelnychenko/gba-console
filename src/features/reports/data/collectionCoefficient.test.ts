import { expect, it } from 'vitest'
import {
  collectionCoefficientCellText, collectionCoefficientMonthError, collectionCoefficientPeriods,
  createCollectionCoefficientRequest, isCollectionCoefficientCapabilities,
  isCollectionCoefficientCatalogueEntry, normalizeCollectionCoefficientReport,
} from './collectionCoefficient'
import { collectionCoefficientCapability, collectionCoefficientCatalogueEntry, collectionCoefficientReport } from './collectionCoefficient.test-fixtures'

it('binds the original collection identity without borrowing a native dataset mapping', () => {
  const entry = collectionCoefficientCatalogueEntry()
  expect(isCollectionCoefficientCatalogueEntry(entry)).toBe(true)
  expect(isCollectionCoefficientCatalogueEntry({ ...entry, Id: 'custom:amg:other' })).toBe(false)
  expect(isCollectionCoefficientCapabilities(collectionCoefficientCapability())).toBe(true)
  expect(isCollectionCoefficientCapabilities({ ...collectionCoefficientCapability(), SourceIdentity: { ...collectionCoefficientCapability().SourceIdentity, DefinitionSha256: 'c'.repeat(64) } })).toBe(false)
  expect(() => createCollectionCoefficientRequest({ ...collectionCoefficientCapability(), Executable: false }, '2026-09')).toThrow('Сервер не підтвердив')
})

it.each(['0000-09', '0001-01', '7999-12', '8000-01', '2026-13', '2026-09-01'])('refuses month %s outside the complete producer interval', month => {
  expect(collectionCoefficientMonthError(month)).not.toBeNull()
})

it('uses calendar boundaries across January and retains the last full physical month', () => {
  expect(collectionCoefficientPeriods('2026-01').PreviousPeriod).toEqual({ From: '2025-12-01', ThroughExclusive: '2026-01-01' })
  expect(collectionCoefficientPeriods('7999-11').CurrentPeriod).toEqual({ From: '7999-11-01', ThroughExclusive: '7999-12-01' })
})

it('keeps decimal strings exact and rounds both change columns only for presentation', () => {
  const result = collectionCoefficientReport()
  result.Cells[0].Value = '12345678901234567890.12345678'
  const request = createCollectionCoefficientRequest(collectionCoefficientCapability(), result.Month)
  expect(normalizeCollectionCoefficientReport(result, request).Cells[0].Value).toBe(result.Cells[0].Value)
  expect(collectionCoefficientCellText('-1.235', 2)).toBe('-1,24')
  expect(collectionCoefficientCellText('99999999999999999999.125', 2)).toBe('99999999999999999999,13')
})

it('distinguishes a confirmed empty period from an unpublished one', () => {
  const result = collectionCoefficientReport()
  result.Inputs.Current = { ...result.Inputs.Current, CoefficientSum: null, PhysicalRows: 0, ActiveRows: 0, IncludedRows: 0, GrainRows: 0 }
  result.Cells[0] = { ...result.Cells[0], Value: null, Available: true }
  const request = createCollectionCoefficientRequest(collectionCoefficientCapability(), result.Month)
  expect(normalizeCollectionCoefficientReport(result, request).Cells[0]).toMatchObject({ Value: null, Available: true })
  result.Inputs.Current.Available = false
  result.Inputs.Current.RunId = null
  result.Cells[0].Available = false
  result.Cells[2] = { ...result.Cells[2], Value: null, Available: false }
  result.Cells[3] = { ...result.Cells[3], Value: null, Available: false }
  result.Complete = false
  expect(normalizeCollectionCoefficientReport(result, request).Inputs.Current.Available).toBe(false)
})

it('refuses foreign periods, columns, identity and invented missing numeric cells', () => {
  const result = collectionCoefficientReport()
  const request = createCollectionCoefficientRequest(collectionCoefficientCapability(), result.Month)
  for (const patch of [
    { Month: '2026-08' }, { Columns: [...result.Columns].reverse() },
    { PreviousPeriod: result.CurrentPeriod },
    { SourceIdentity: { ...result.SourceIdentity, World: 'amg' } },
    { Cells: result.Cells.map(cell => ({ ...cell, Available: false })) },
    { Inputs: { ...result.Inputs, Current: { ...result.Inputs.Current, UnknownBuyerRows: 1 } } },
    { Complete: false },
    { HasRows: false },
  ]) expect(() => normalizeCollectionCoefficientReport({ ...result, ...patch }, request)).toThrow('некоректний результат')
})
