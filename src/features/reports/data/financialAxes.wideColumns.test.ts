import { describe, expect, it } from 'vitest'
import { financialAxesCapability } from './financialAxes'
import { currentFinancialAxesCapability } from './currentFinancialAxes'
import { currentFinancialProductTimeAxesCapability } from './currentFinancialProductTimeAxes'
import { currentFinancialDocumentAxesCapability } from './currentFinancialDocumentAxes'
import { documentDataset } from './currentFinancialDocumentAxes.test-fixtures'
import type { ReportDataset } from '../types'

const keys = ['financialAxes', 'currentFinancialAxes', 'currentFinancialProductTimeAxes', 'currentFinancialDocumentAxes'] as const
const readers = {
  financialAxes: financialAxesCapability,
  currentFinancialAxes: currentFinancialAxesCapability,
  currentFinancialProductTimeAxes: currentFinancialProductTimeAxesCapability,
  currentFinancialDocumentAxes: currentFinancialDocumentAxesCapability,
}
const withResultColumns = (value: unknown): ReportDataset => Object.fromEntries(Object.entries(documentDataset).map(([key, capability]) =>
  [key, (keys as readonly string[]).includes(key) ? { ...(capability as object), maximumResultColumns: value } : capability])) as ReportDataset

describe('wide financial axes capabilities', () => {
  it.each(keys)('accepts %s with the legacy 256 window and the additive result bound', key => {
    expect(readers[key](documentDataset)).toBeDefined()
    expect(readers[key](documentDataset)?.maximumResultColumns).toBeUndefined()
    const wide = withResultColumns(16000)
    expect(readers[key](wide)?.maximumOutputColumns).toBe(256)
    expect(readers[key](wide)?.maximumResultColumns).toBe(16000)
    expect(readers[key](withResultColumns(16384))).toBeDefined()
  })

  it.each(keys)('refuses %s with a malformed result bound or a changed legacy window', key => {
    for (const value of [255, 16385, 1.5, '16000', null]) expect(readers[key](withResultColumns(value))).toBeUndefined()
    const changed = { ...documentDataset, [key]: { ...(documentDataset[key] as object), maximumOutputColumns: 16000 } } as ReportDataset
    expect(readers[key](changed)).toBeUndefined()
  })
})
