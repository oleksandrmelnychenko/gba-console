import { describe, expect, it } from 'vitest'
import { datasetConfigurationError, datasetPresetRequest } from './reportDatasets'
import { hideZeroCapabilities, hideZeroDataset, hideZeroRequest } from './reportHideZero.test-fixtures'
import { defaultReportHideZero, readHideZeroCapabilities, readReportHideZero, reportHideZeroError, requestHideZero } from './reportHideZero'
import { reportDatasets, valuationDataset } from './reportDatasets.test-fixtures'

describe('strict source11 HideZero contract', () => {
  it('accepts only the exact record grain and retains native filters, TOP/Threshold/ABC, ordering and disabled selections', () => {
    const data = hideZeroRequest(), original = structuredClone(data)
    expect(readHideZeroCapabilities(hideZeroDataset)).toEqual(hideZeroCapabilities)
    expect(datasetConfigurationError(data, hideZeroDataset)).toBeNull()
    expect(defaultReportHideZero(data, hideZeroDataset)).toEqual({ Version: 1 })
    expect(data).toEqual(original)
  })
  it.each([undefined, null])('preserves old behavior for absent/null optional rule %s', hideZero => {
    expect(reportHideZeroError({ ...hideZeroRequest(), hideZero }, reportDatasets[0])).toBeNull()
  })
  it.each([{}, [], true, 1, { Version: '1' }, { Version: 2 }, { Version: 1, OnlyRows: true }, { Version: 1, Sql: 'never executed' }])('rejects unknown/malformed original without stripping it %#', hideZero => {
    const data = { ...hideZeroRequest(), hideZero }, before = structuredClone(data)
    expect(readReportHideZero(hideZero)).toBeNull()
    expect(reportHideZeroError(data, hideZeroDataset)).toContain('Оригінал збережено')
    expect(data).toEqual(before)
  })
  it('retains both conflicting aliases and refuses them even when null', () => {
    const data = { ...hideZeroRequest(), hideZero: null, HideZero: { Version: 1 } }
    expect(requestHideZero(data)).toBeNull()
    expect(reportHideZeroError(data, hideZeroDataset)).toContain('двічі')
    expect(data.HideZero).toEqual({ Version: 1 })
  })
  it.each([{ Version: 2 }, { Measures: [23] }, { GroupingTypes: [40, 42] }, { ProofGrain: 'DisplayedSum' },
    { UnknownAmountsRetained: false }, { FactsRetainedForTotals: false }, { FactsRetainedForAbc: false },
    { GlobalZeroResourceHidden: false }, { CompleteSourceParity: true }, { MaximumContributions: 200001 }])('refuses unproven or changed capability semantics %#', patch => {
    const dataset = { ...hideZeroDataset, HideZero: { ...hideZeroCapabilities, ...patch } }
    expect(readHideZeroCapabilities(dataset)).toBeNull()
    expect(defaultReportHideZero(hideZeroRequest(), dataset)).toBeNull()
    expect(reportHideZeroError(hideZeroRequest(), dataset)).toContain('не підтвердив')
  })
  it.each([undefined, { ...hideZeroDataset, DataSource: 10 }, { ...hideZeroDataset, HideZero: null }])('never promotes another source or missing capabilities %#', dataset => {
    expect(readHideZeroCapabilities(dataset)).toBeNull()
    expect(reportHideZeroError(hideZeroRequest(), dataset)).toContain('не підтвердив')
  })
  it('keeps the rule invalid when its record group is moved, removed or replaced, or the measure disabled', () => {
    for (const scenario of ['move', 'remove', 'replace', 'extra', 'disable']) {
      const data = hideZeroRequest()
      if (scenario === 'move') data.sorted.Col.push(data.sorted.Row.pop()!)
      if (scenario === 'remove') data.sorted.Row.pop()
      if (scenario === 'replace') data.sorted.Row[1] = { type: 40, key: 'PaymentRegister', label: 'Рахунок' }
      if (scenario === 'extra') data.sorted.Row.push({ type: 41, key: 'PaymentCurrency', label: 'Валюта рахунку' })
      if (scenario === 'disable') data.sorted.Measurements[0].IsChecked = false
      const before = structuredClone(data)
      expect(reportHideZeroError(data, hideZeroDataset)).toBeTruthy()
      expect(defaultReportHideZero(data, hideZeroDataset)).toBeNull()
      expect(data).toEqual(before)
    }
  })
  it('retains a mismatched ABC rule for explicit correction', () => {
    const data = { ...hideZeroRequest(), abcClassification: { Version: 1, Axis: 1, Grouping: 40, Measure: 24, PercentA: 80, PercentB: 15, PercentC: 5 } }
    expect(reportHideZeroError(data, hideZeroDataset)).toContain('Обидва правила збережено')
  })
  it('retains the rule across a same-source preset and never substitutes the valuation agreement', () => {
    const current = hideZeroRequest()
    const preset = datasetPresetRequest(hideZeroDataset, 'account-balances-by-purpose-currency', current)
    expect(preset?.Data.hideZero).toEqual({ Version: 1 })
    expect(reportHideZeroError(preset!.Data, hideZeroDataset)).toBeTruthy()
    const incompatible = { ...current, dataSource: 8, valuationClientAgreementId: 456246 }
    expect(datasetConfigurationError(incompatible, valuationDataset)).toBeTruthy()
    expect(incompatible.valuationClientAgreementId).toBe(456246)
  })
})
